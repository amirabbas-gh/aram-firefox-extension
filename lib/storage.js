export const DEFAULT_SETTINGS = {
  youtubeLimitMinutes: 30,
  reminderEveryMinutes: 10,
  extraBlockedHosts: [],
  unlockUntil: 0
};

export const UNLOCK_PHRASE = "میخواهم حواسم پرت شود";

export function normalizeFaPhrase(value) {
  return String(value || "")
    .trim()
    .replace(/[\u200c\u200d\u200e\u200f\u00ad]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

export function isUnlockPhrase(value) {
  return normalizeFaPhrase(value) === UNLOCK_PHRASE;
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function getSettings(api) {
  const stored = await api.storage.local.get({ settings: DEFAULT_SETTINGS });
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

export async function saveSettings(api, patch) {
  const current = await getSettings(api);
  const settings = { ...current, ...patch };
  await api.storage.local.set({ settings });
  return settings;
}

export async function getTimeLog(api) {
  const stored = await api.storage.local.get({ timeLog: {} });
  return stored.timeLog || {};
}

export async function incrementTime(api, host, seconds) {
  if (!host || seconds <= 0) return;
  const key = dayKey();
  const stored = await api.storage.local.get({ timeLog: {} });
  const timeLog = stored.timeLog || {};
  if (!timeLog[key]) timeLog[key] = {};
  timeLog[key][host] = (timeLog[key][host] || 0) + seconds;
  await api.storage.local.set({ timeLog });
  return timeLog[key][host];
}

export async function bumpRedirect(api, site) {
  const key = dayKey();
  const stored = await api.storage.local.get({ redirects: {} });
  const redirects = stored.redirects || {};
  if (!redirects[key]) redirects[key] = {};
  redirects[key][site] = (redirects[key][site] || 0) + 1;
  await api.storage.local.set({ redirects });
}

export function sumRange(timeLog, keys) {
  const totals = {};
  let all = 0;
  for (const key of keys) {
    const day = timeLog[key] || {};
    for (const [host, seconds] of Object.entries(day)) {
      totals[host] = (totals[host] || 0) + seconds;
      all += seconds;
    }
  }
  return { totals, all };
}

export function lastNDayKeys(n, from = new Date()) {
  const keys = [];
  for (let i = 0; i < n; i += 1) {
    const date = new Date(from);
    date.setDate(from.getDate() - i);
    keys.push(dayKey(date));
  }
  return keys;
}

export function pruneOldLogs(timeLog, keepDays = 120) {
  const keep = new Set(lastNDayKeys(keepDays));
  const next = {};
  for (const [key, value] of Object.entries(timeLog)) {
    if (keep.has(key)) next[key] = value;
  }
  return next;
}
