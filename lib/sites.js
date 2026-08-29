export const DEFAULT_BLOCKED_HOSTS = [
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "threads.net"
];

const YOUTUBE_FAMILY = new Set([
  "youtube.com",
  "m.youtube.com",
  "www.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "music.youtube.com"
]);

const SKIP_SCHEMES = new Set([
  "moz-extension:",
  "chrome-extension:",
  "about:",
  "chrome:",
  "resource:",
  "file:",
  "blob:",
  "data:"
]);

export function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function normalizeHost(hostname) {
  if (!hostname) return "";
  let host = hostname.toLowerCase();
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (host.startsWith("www.")) host = host.slice(4);
  if (YOUTUBE_FAMILY.has(host) || YOUTUBE_FAMILY.has(`www.${host}`)) {
    return "youtube.com";
  }
  const parts = host.split(".");
  if (parts.length >= 3 && (parts[0] === "m" || parts[0] === "mobile" || parts[0] === "l")) {
    host = parts.slice(1).join(".");
  }
  return host;
}

export function trackingHost(rawUrl) {
  const url = typeof rawUrl === "string" ? parseUrl(rawUrl) : rawUrl;
  if (!url || SKIP_SCHEMES.has(url.protocol)) return null;
  return normalizeHost(url.hostname);
}

export function isYouTubeHost(host) {
  return host === "youtube.com";
}

export function isYouTubeShortsUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return false;
  const host = normalizeHost(url.hostname);
  if (host !== "youtube.com") return false;
  if (url.pathname.startsWith("/shorts/") || url.pathname === "/shorts") return true;
  if (url.hostname.includes("youtube.com") && url.searchParams.get("feature") === "shorts") {
    return true;
  }
  return false;
}

export function isBlockedHost(host, extraHosts = []) {
  const all = new Set([...DEFAULT_BLOCKED_HOSTS, ...extraHosts.map(normalizeHost)]);
  if (all.has(host)) return true;
  for (const blocked of all) {
    if (host === blocked || host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function siteLabel(host) {
  const labels = {
    "youtube.com": "یوتیوب",
    "instagram.com": "اینستاگرام",
    "twitter.com": "توییتر",
    "x.com": "ایکس",
    "tiktok.com": "تیک‌تاک",
    "threads.net": "تردز",
    "reddit.com": "ردیت",
    "facebook.com": "فیسبوک",
    "netflix.com": "نتفلیکس"
  };
  return labels[host] || host;
}

export function blockedPageUrl(api, reason, site, original) {
  const base = api.runtime.getURL("pages/blocked.html");
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  if (site) params.set("site", site);
  if (original) params.set("from", original);
  return `${base}?${params.toString()}`;
}
