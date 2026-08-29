(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  try {
    document.documentElement.innerHTML = "";
  } catch {
    /* ignore */
  }
  api.runtime.sendMessage({
    type: "block-now",
    reason: "social",
    site: location.hostname.replace(/^www\./, ""),
    url: location.href
  });
})();
