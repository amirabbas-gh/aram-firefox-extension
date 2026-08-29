(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;

  function blockNow() {
    try {
      document.documentElement.replaceChildren();
    } catch {
      /* ignore */
    }
    api.runtime.sendMessage({
      type: "block-now",
      reason: "social",
      site: location.hostname.replace(/^www\./, ""),
      url: location.href
    });
  }

  api.runtime.sendMessage({ type: "should-block" }).then((state) => {
    if (state?.block === false) return;
    blockNow();
  }).catch(blockNow);
})();
