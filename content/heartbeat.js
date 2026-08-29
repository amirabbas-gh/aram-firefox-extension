(() => {
  if (window.__aramHeartbeat) return;
  window.__aramHeartbeat = true;

  const api = typeof browser !== "undefined" ? browser : chrome;
  const SKIP = /^(moz-extension:|chrome-extension:|about:|chrome:|resource:)/;
  const AWAY_AFTER_MS = 120000;
  const TICK_MS = 5000;

  let lastTick = Date.now();
  let lastInput = Date.now();

  function markInput() {
    lastInput = Date.now();
  }

  ["pointerdown", "keydown", "scroll", "wheel", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, markInput, { passive: true, capture: true });
  });
  window.addEventListener("pointermove", markInput, { passive: true, capture: true });

  function mediaIsPlaying() {
    const nodes = document.querySelectorAll("video, audio");
    for (const node of nodes) {
      if (!node.paused && !node.ended && node.readyState >= 2) return true;
    }
    return false;
  }

  function pageIsForeground() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function userIsEngaged() {
    if (!pageIsForeground()) return false;
    if (Date.now() - lastInput <= AWAY_AFTER_MS) return true;
    return mediaIsPlaying();
  }

  function pauseClock() {
    lastTick = Date.now();
  }

  document.addEventListener("visibilitychange", () => {
    pauseClock();
    if (document.visibilityState === "visible") markInput();
  });
  window.addEventListener("focus", () => {
    pauseClock();
    markInput();
  });
  window.addEventListener("blur", pauseClock);

  function tick() {
    if (SKIP.test(location.href)) return;
    if (!userIsEngaged()) {
      pauseClock();
      return;
    }
    const now = Date.now();
    const seconds = Math.min(8, Math.max(1, Math.round((now - lastTick) / 1000)));
    lastTick = now;
    api.runtime.sendMessage({
      type: "heartbeat",
      url: location.href,
      seconds,
      engaged: true
    }).catch(() => {});
  }

  setInterval(tick, TICK_MS);
})();
