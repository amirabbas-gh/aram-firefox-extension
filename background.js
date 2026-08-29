import {
  blockedPageUrl,
  isBlockedHost,
  isYouTubeHost,
  isYouTubeShortsUrl,
  normalizeHost,
  trackingHost
} from "./lib/sites.js";
import {
  bumpRedirect,
  dayKey,
  getSettings,
  getTimeLog,
  incrementTime,
  isUnlockPhrase,
  pruneOldLogs,
  saveSettings
} from "./lib/storage.js";

const api = typeof browser !== "undefined" ? browser : chrome;
const YOUTUBE_LIMIT_RULE_ID = 9001;
const CUSTOM_RULE_START = 100;
const IDLE_SECONDS = 30;
const COUNTED_RECENT_MS = 12000;

let lastPruneDay = "";
let lastIdleState = "active";
const lastCountedAt = new Map();

try {
  api.idle.setDetectionInterval(IDLE_SECONDS);
} catch {
  /* older runtimes */
}

if (api.idle?.onStateChanged) {
  api.idle.onStateChanged.addListener((state) => {
    lastIdleState = state;
  });
}

api.tabs.onRemoved.addListener((tabId) => {
  lastCountedAt.delete(tabId);
});

async function systemIsActive() {
  if (lastIdleState !== "active") return false;
  try {
    const state = await api.idle.queryState(IDLE_SECONDS);
    lastIdleState = state;
    return state === "active";
  } catch {
    return true;
  }
}

async function tabIsInFocus(tab) {
  if (!tab?.active) return false;
  try {
    const win = await api.windows.get(tab.windowId);
    return Boolean(win?.focused);
  } catch {
    return false;
  }
}

function recentlyCounted(tabId) {
  if (typeof tabId !== "number") return false;
  return Date.now() - (lastCountedAt.get(tabId) || 0) < COUNTED_RECENT_MS;
}

async function isActivelyFocusing(tab) {
  if (!(await tabIsInFocus(tab))) return false;
  if (!(await systemIsActive())) return false;
  return true;
}

async function isTemporarilyUnlocked() {
  const settings = await getSettings(api);
  return settings.unlockUntil && Date.now() < settings.unlockUntil;
}

async function allBlockedHosts() {
  const settings = await getSettings(api);
  return settings.extraBlockedHosts || [];
}

async function youtubeSecondsToday() {
  const log = await getTimeLog(api);
  return log[dayKey()]?.["youtube.com"] || 0;
}

async function youtubeLimitReached() {
  if (await isTemporarilyUnlocked()) return false;
  const settings = await getSettings(api);
  const used = await youtubeSecondsToday();
  return used >= settings.youtubeLimitMinutes * 60;
}

function redirectTab(tabId, reason, site, original) {
  const dest = blockedPageUrl(api, reason, site, original);
  return api.tabs.update(tabId, { url: dest });
}

async function syncStaticBlocks(unlocked) {
  try {
    const enabled = await api.declarativeNetRequest.getEnabledRulesets();
    const on = enabled.includes("hard_blocks");
    if (unlocked && on) {
      await api.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["hard_blocks"]
      });
    } else if (!unlocked && !on) {
      await api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["hard_blocks"]
      });
    }
  } catch {
    /* older runtimes */
  }
}

async function syncDynamicRules() {
  const unlocked = await isTemporarilyUnlocked();
  const extra = unlocked ? [] : await allBlockedHosts();
  const limitHit = unlocked ? false : await youtubeLimitReached();
  await syncStaticBlocks(unlocked);
  const existing = await api.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  const addRules = extra.map((host, index) => ({
    id: CUSTOM_RULE_START + index,
    priority: 2,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/pages/blocked.html" }
    },
    condition: {
      urlFilter: `||${normalizeHost(host)}`,
      resourceTypes: ["main_frame"]
    }
  }));

  if (limitHit) {
    addRules.push({
      id: YOUTUBE_LIMIT_RULE_ID,
      priority: 5,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/pages/blocked-limit.html" }
      },
      condition: {
        requestDomains: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
        resourceTypes: ["main_frame"]
      }
    });
  }

  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function maybeRedirect(tabId, rawUrl) {
  if (!rawUrl || tabId < 0) return false;
  if (rawUrl.startsWith(api.runtime.getURL(""))) return false;
  if (await isTemporarilyUnlocked()) return false;

  const host = trackingHost(rawUrl);
  if (!host) return false;

  if (isYouTubeShortsUrl(rawUrl)) {
    await bumpRedirect(api, "youtube-shorts");
    await redirectTab(tabId, "shorts", "youtube.com", rawUrl);
    return true;
  }

  const extra = await allBlockedHosts();
  if (isBlockedHost(host, extra)) {
    await bumpRedirect(api, host);
    await redirectTab(tabId, "social", host, rawUrl);
    return true;
  }

  if (isYouTubeHost(host) && (await youtubeLimitReached())) {
    await bumpRedirect(api, "youtube-limit");
    await redirectTab(tabId, "limit", "youtube.com", rawUrl);
    return true;
  }

  return false;
}

api.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

api.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeRedirect(details.tabId, details.url);
});

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "loading") return;
  const url = changeInfo.url || tab.url;
  maybeRedirect(tabId, url);
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  const run = async () => {
    if (message?.type === "heartbeat") {
      const tab = sender.tab;
      if (message.engaged === false) return { ok: true, ignored: "not-engaged" };
      if (!(await isActivelyFocusing(tab))) {
        return { ok: true, ignored: lastIdleState !== "active" ? "idle" : "unfocused" };
      }

      const host = trackingHost(message.url || tab.url);
      if (!host) return { ok: true, ignored: "skip-host" };

      const extra = await allBlockedHosts();
      if (isBlockedHost(host, extra) || isYouTubeShortsUrl(message.url || tab.url)) {
        return { ok: true, ignored: "blocked" };
      }

      const seconds = Math.min(8, Math.max(1, Number(message.seconds) || 5));
      const total = await incrementTime(api, host, seconds);
      if (typeof tabId === "number") lastCountedAt.set(tabId, Date.now());
      const settings = await getSettings(api);
      const youtubeUsed = isYouTubeHost(host) ? total : await youtubeSecondsToday();
      const limitSeconds = settings.youtubeLimitMinutes * 60;
      const reached = isYouTubeHost(host) && youtubeUsed >= limitSeconds && !(await isTemporarilyUnlocked());

      if (reached) {
        await syncDynamicRules();
        if (typeof tabId === "number") {
          await bumpRedirect(api, "youtube-limit");
          await redirectTab(tabId, "limit", "youtube.com", message.url || tab.url);
        }
      }

      if (dayKey() !== lastPruneDay) {
        lastPruneDay = dayKey();
        const log = await getTimeLog(api);
        await api.storage.local.set({ timeLog: pruneOldLogs(log) });
        await syncDynamicRules();
      }

      return {
        ok: true,
        host,
        youtubeUsed,
        limitSeconds,
        reminderEveryMinutes: settings.reminderEveryMinutes,
        limitReached: reached
      };
    }

    if (message?.type === "get-focus-state") {
      const settings = await getSettings(api);
      const used = await youtubeSecondsToday();
      const tab = sender.tab;
      const focusing = await isActivelyFocusing(tab);
      const seen = typeof tabId === "number" && lastCountedAt.has(tabId);
      return {
        youtubeUsed: used,
        limitSeconds: settings.youtubeLimitMinutes * 60,
        reminderEveryMinutes: settings.reminderEveryMinutes,
        unlocked: await isTemporarilyUnlocked(),
        limitReached: used >= settings.youtubeLimitMinutes * 60 && !(await isTemporarilyUnlocked()),
        counting: focusing && (!seen || recentlyCounted(tabId))
      };
    }

    if (message?.type === "should-block") {
      return { block: !(await isTemporarilyUnlocked()) };
    }

    if (message?.type === "block-now") {
      if (await isTemporarilyUnlocked()) return { ok: true, ignored: "unlocked" };
      if (typeof tabId === "number") {
        await bumpRedirect(api, message.site || "unknown");
        await redirectTab(tabId, message.reason || "social", message.site, message.url);
      }
      return { ok: true };
    }

    if (message?.type === "save-settings") {
      const settings = await saveSettings(api, message.patch || {});
      await syncDynamicRules();
      return { settings };
    }

    if (message?.type === "emergency-unlock") {
      if (!isUnlockPhrase(message.phrase)) {
        return { ok: false, error: "phrase" };
      }
      const until = Date.now() + 15 * 60 * 1000;
      const settings = await saveSettings(api, { unlockUntil: until });
      await syncDynamicRules();
      return { ok: true, settings };
    }

    return { ok: false };
  };

  run().then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error) });
  });
  return true;
});

api.alarms.create("aram-sync", { periodInMinutes: 1 });
api.alarms.onAlarm.addListener(() => {
  syncDynamicRules();
});

syncDynamicRules();
