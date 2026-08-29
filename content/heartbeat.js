(() => {
  if (window.__aramHeartbeat) return;
  window.__aramHeartbeat = true;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const SKIP = /^(moz-extension:|chrome-extension:|about:|chrome:|resource:)/;
  let last = Date.now();

  function tick() {
    if (SKIP.test(location.href)) return;
    if (document.visibilityState !== "visible") {
      last = Date.now();
      return;
    }
    const now = Date.now();
    const seconds = Math.min(12, Math.max(1, Math.round((now - last) / 1000)));
    last = now;
    api.runtime.sendMessage({
      type: "heartbeat",
      url: location.href,
      seconds
    }).catch(() => {});
  }

  setInterval(tick, 5000);
  document.addEventListener("visibilitychange", () => {
    last = Date.now();
  });
})();
