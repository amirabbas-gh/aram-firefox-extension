import { siteLabel } from "../lib/sites.js";
import {
  formatDuration,
  formatJalaliLong,
  toFaDigits
} from "../lib/jalali.js";
import { lastNDayKeys, sumRange, isUnlockPhrase } from "../lib/storage.js";

const api = typeof browser !== "undefined" ? browser : null;

const DEMO = {
  settings: {
    youtubeLimitMinutes: 30,
    reminderEveryMinutes: 10,
    extraBlockedHosts: ["reddit.com"],
    unlockUntil: 0
  },
  timeLog: {
    [todayKey()]: {
      "youtube.com": 18 * 60,
      "github.com": 42 * 60,
      "wikipedia.org": 11 * 60
    }
  },
  redirects: {
    [todayKey()]: { "instagram.com": 3, "youtube-shorts": 2 }
  }
};

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function loadStore() {
  if (!api) return DEMO;
  return api.storage.local.get({
    settings: DEMO.settings,
    timeLog: {},
    redirects: {}
  });
}

function rangeKeys(range) {
  if (range === "week") return lastNDayKeys(7);
  if (range === "month") return lastNDayKeys(30);
  return [todayKey()];
}

function hostTone(host) {
  const palette = ["#16352a", "#d85a32", "#f2c14e", "#7eb8a2", "#7a4b32"];
  let hash = 0;
  for (const char of host) hash = (hash + char.charCodeAt(0) * 17) % palette.length;
  return palette[hash];
}

function renderYoutube(settings, used) {
  const limit = settings.youtubeLimitMinutes * 60;
  const remain = Math.max(0, limit - used);
  const ratio = Math.min(1, used / Math.max(1, limit));
  document.getElementById("youtube-remain").textContent =
    remain > 0 ? `${formatDuration(remain)} مانده` : "سقف پر شد";
  document.getElementById("youtube-fill").style.width = `${Math.round(ratio * 100)}%`;
  document.getElementById("youtube-hero").classList.toggle("warn", ratio >= 0.75);
  document.getElementById("youtube-copy").textContent =
    `امروز ${formatDuration(used)} یوتیوب دیدی. سقف تو ${toFaDigits(settings.youtubeLimitMinutes)} دقیقه است.`;
}

function renderList(totals) {
  const root = document.getElementById("site-list");
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!rows.length) {
    root.innerHTML = `<div class="empty">هنوز چیزی ثبت نشده.<br>همین بهتر است.</div>`;
    return;
  }
  const max = rows[0][1] || 1;
    root.innerHTML = rows.map(([host, seconds]) => `
    <div class="row">
      <div class="row-top">
        <span class="site">
          <i class="dot" style="--c:${hostTone(host)}"></i>
          ${siteLabel(host)}
        </span>
        <b>${formatDuration(seconds)}</b>
      </div>
      <div class="mini"><i style="width:${Math.round((seconds / max) * 100)}%"></i></div>
    </div>
  `).join("");
}

function renderExtras(hosts) {
  const root = document.getElementById("extra-list");
  root.innerHTML = (hosts || []).map((host) => `<span class="chip">${host}</span>`).join("");
}

function redirectTotal(redirects, keys) {
  let count = 0;
  for (const key of keys) {
    const day = redirects[key] || {};
    count += Object.values(day).reduce((sum, value) => sum + value, 0);
  }
  return count;
}

async function render(range = "day") {
  const store = await loadStore();
  const settings = { ...DEMO.settings, ...store.settings };
  const keys = rangeKeys(range);
  const { totals, all } = sumRange(store.timeLog || {}, keys);
  const labels = {
    day: "زمان امروز",
    week: "زمان این هفته",
    month: "زمان این ماه"
  };

  document.getElementById("today-label").textContent = formatJalaliLong(new Date());
  document.getElementById("total-label").textContent = labels[range];
  document.getElementById("total-time").textContent = formatDuration(all);
  document.getElementById("redirect-count").textContent = toFaDigits(
    redirectTotal(store.redirects || {}, keys)
  );
  document.getElementById("limit").value = settings.youtubeLimitMinutes;
  document.getElementById("reminder").value = settings.reminderEveryMinutes;
  renderYoutube(settings, (store.timeLog || {})[todayKey()]?.["youtube.com"] || 0);
  renderList(totals);
  renderExtras(settings.extraBlockedHosts);
  const remainMs = (settings.unlockUntil || 0) - Date.now();
  if (remainMs > 0) {
    const mins = Math.max(1, Math.ceil(remainMs / 60000));
    setUnlockStatus("ok", `${toFaDigits(mins)} دقیقه باز است`);
  } else {
    setUnlockStatus("", "");
  }
}

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    render(button.dataset.range);
  });
});

document.getElementById("add-host").addEventListener("click", async () => {
  const value = document.getElementById("extra-host").value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!value) return;
  const store = await loadStore();
  const extra = new Set(store.settings?.extraBlockedHosts || []);
  extra.add(value.replace(/^www\./, ""));
  document.getElementById("extra-host").value = "";
  if (!api) {
    DEMO.settings.extraBlockedHosts = [...extra];
    render(document.querySelector(".tabs button.active").dataset.range);
    return;
  }
  await api.runtime.sendMessage({
    type: "save-settings",
    patch: { extraBlockedHosts: [...extra] }
  });
  render(document.querySelector(".tabs button.active").dataset.range);
});

document.getElementById("save").addEventListener("click", async () => {
  const patch = {
    youtubeLimitMinutes: Number(document.getElementById("limit").value) || 30,
    reminderEveryMinutes: Number(document.getElementById("reminder").value) || 10
  };
  if (!api) {
    Object.assign(DEMO.settings, patch);
    render(document.querySelector(".tabs button.active").dataset.range);
    return;
  }
  await api.runtime.sendMessage({ type: "save-settings", patch });
  render(document.querySelector(".tabs button.active").dataset.range);
});

function setUnlockStatus(kind, text) {
  const status = document.getElementById("unlock-status");
  if (!text) {
    status.hidden = true;
    status.textContent = "";
    status.className = "unlock-status";
    return;
  }
  status.hidden = false;
  status.className = `unlock-status ${kind}`;
  status.textContent = text;
}

async function tryUnlock() {
  const phrase = document.getElementById("unlock-phrase").value;
  if (!isUnlockPhrase(phrase)) {
    setUnlockStatus("err", "جمله درست نیست");
    return;
  }
  if (!api) return;
  const result = await api.runtime.sendMessage({ type: "emergency-unlock", phrase });
  if (!result?.ok) {
    setUnlockStatus("err", "باز نشد. دوباره بزن.");
    return;
  }
  document.getElementById("unlock-phrase").value = "";
  render(document.querySelector(".tabs button.active").dataset.range);
}

document.getElementById("unlock").addEventListener("click", tryUnlock);
document.getElementById("unlock-phrase").addEventListener("keydown", (event) => {
  if (event.key === "Enter") tryUnlock();
});

const REPO_URL = "https://github.com/amirabbas-gh/aram-firefox-extension";
document.getElementById("star-repo").addEventListener("click", async (event) => {
  event.preventDefault();
  if (api?.tabs?.create) {
    await api.tabs.create({ url: REPO_URL });
    window.close();
    return;
  }
  window.open(REPO_URL, "_blank", "noopener,noreferrer");
});

render("day");
