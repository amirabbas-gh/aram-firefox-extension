(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;
  const ROOT_ID = "aram-focus-root";
  let lastShortsCheck = "";
  let lastReminderAt = 0;
  let lastToastKey = "";

  function isShortsPath() {
    return location.pathname === "/shorts" || location.pathname.startsWith("/shorts/");
  }

  function redirectShorts() {
    if (!isShortsPath()) return;
    if (lastShortsCheck === location.href) return;
    lastShortsCheck = location.href;
    api.runtime.sendMessage({
      type: "block-now",
      reason: "shorts",
      site: "youtube.com",
      url: location.href
    });
  }

  function formatFa(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const digits = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
    if (h > 0) return `${digits(h)} ساعت و ${digits(m)} دقیقه`;
    return `${digits(m)} دقیقه`;
  }

  function ensureUi() {
    let host = document.getElementById(ROOT_ID);
    if (host) return host.shadowRoot;
    host = document.createElement("div");
    host.id = ROOT_ID;
    host.style.all = "initial";
    const shadow = host.attachShadow({ mode: "open" });
    const font = api.runtime.getURL("fonts/YekanBakh-VF.ttf");
    const bird = api.runtime.getURL("assets/bulbul.gif");
    const glass = api.runtime.getURL("assets/hourglass.gif");
    shadow.innerHTML = `
      <style>
        @font-face {
          font-family: YekanBakh;
          src: url("${font}") format("truetype");
          font-weight: 100 900;
        }
        :host { all: initial; }
        .wrap { all: initial; font-family: YekanBakh, Tahoma, sans-serif; }
        .badge {
          position: fixed;
          z-index: 2147483646;
          left: 16px;
          bottom: 16px;
          width: min(276px, calc(100vw - 32px));
          padding: 10px 12px;
          background: #fff6e3;
          color: #1d2a22;
          border: 3px solid #16352a;
          box-shadow: 4px 4px 0 #16352a;
          direction: rtl;
        }
        .badge.warn { background: #ffe7d6; }
        .top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .top img { width: 42px; height: 42px; image-rendering: pixelated; }
        .kicker { font-size: 12px; color: #d85a32; font-weight: 800; }
        .brand { font-size: 11px; color: #6d5b45; }
        .time { font-size: 14px; font-weight: 800; line-height: 1.7; }
        .remain { font-size: 12px; color: #6d5b45; }
        .bar { height: 8px; margin-top: 8px; background: #efe0bc; border: 2px solid #16352a; }
        .bar > i { display: block; height: 100%; width: 0; background: #f2c14e; }
        .toast {
          position: fixed;
          z-index: 2147483647;
          left: 50%;
          top: 72px;
          transform: translateX(-50%);
          background: #fff6e3;
          color: #1d2a22;
          border: 3px solid #16352a;
          box-shadow: 4px 4px 0 #16352a;
          padding: 12px 16px;
          direction: rtl;
          text-align: center;
          max-width: 340px;
          opacity: 0;
          pointer-events: none;
        }
        .toast.show { opacity: 1; }
        .toast b { display: block; font-size: 16px; margin-bottom: 4px; }
        .veil {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: #f3e2c4;
          color: #1d2a22;
          direction: rtl;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 28px;
        }
        .veil.show { display: flex; }
        .veil-card {
          width: min(480px, 100%);
          padding: 24px 20px;
          background: #fff6e3;
          border: 3px solid #16352a;
          box-shadow: 5px 5px 0 #16352a;
        }
        .veil img { width: 72px; height: 72px; image-rendering: pixelated; }
        .veil h1 { font-size: 28px; margin: 8px 0 10px; }
        .veil p { font-size: 15px; line-height: 2; margin: 0; }
      </style>
      <div class="wrap">
        <div class="badge" id="badge">
          <div class="top">
            <img src="${bird}" alt="" />
            <div>
              <div class="kicker">هنوز اینجایی؟</div>
              <div class="brand">یادآوری آرام</div>
            </div>
          </div>
          <div class="time" id="time">در حال شمارش…</div>
          <div class="remain" id="remain"></div>
          <div class="bar"><i id="fill"></i></div>
        </div>
        <div class="toast" id="toast"></div>
        <div class="veil" id="veil">
          <div class="veil-card">
            <img src="${glass}" alt="" />
            <h1>وقت امروز تمام شد</h1>
            <p>یوتیوب تا فردا بسته است. برو کتاب بخوان یا سر کارت برگرد.</p>
          </div>
        </div>
      </div>
    `;
    (document.documentElement || document.body).appendChild(host);
    return shadow;
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((video) => {
      try {
        video.pause();
      } catch {
        /* ignore */
      }
    });
  }

  function showToast(shadow, used, limit) {
    const toast = shadow.getElementById("toast");
    const minutes = Math.max(1, Math.round(used / 60));
    toast.innerHTML = `<b>یکم وایسا</b>امروز ${formatFa(used)} یوتیوب دیدی. سقف روزانه ${formatFa(limit)} است.`;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 7000);
  }

  function render(state) {
    if (isShortsPath()) return;
    const shadow = ensureUi();
    const used = state.youtubeUsed || 0;
    const limit = state.limitSeconds || 30 * 60;
    const ratio = Math.min(1, used / limit);
    const remain = Math.max(0, limit - used);
    const badge = shadow.getElementById("badge");
    const veil = shadow.getElementById("veil");

    shadow.getElementById("time").textContent = `امروز ${formatFa(used)} در یوتیوب بودی`;
    shadow.getElementById("remain").textContent =
      remain > 0 ? `${formatFa(remain)} تا سقف مانده` : "سقف امروز تمام شد";
    shadow.getElementById("fill").style.width = `${Math.round(ratio * 100)}%`;
    badge.classList.toggle("warn", ratio >= 0.75);

    if (state.limitReached) {
      veil.classList.add("show");
      badge.style.display = "none";
      pauseVideos();
    } else {
      veil.classList.remove("show");
      badge.style.display = "block";
    }

    const every = (state.reminderEveryMinutes || 10) * 60;
    const bucket = Math.floor(used / every);
    const toastKey = `${dayKeyLocal()}-${bucket}`;
    if (bucket > 0 && used >= every && toastKey !== lastToastKey && Date.now() - lastReminderAt > 20000) {
      lastToastKey = toastKey;
      lastReminderAt = Date.now();
      showToast(shadow, used, limit);
    }
  }

  function dayKeyLocal() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function refresh() {
    redirectShorts();
    if (isShortsPath()) return;
    api.runtime.sendMessage({ type: "get-focus-state" }).then((state) => {
      if (state) render(state);
    }).catch(() => {});
  }

  redirectShorts();
  document.addEventListener("yt-navigate-start", redirectShorts);
  document.addEventListener("yt-navigate-finish", refresh);
  window.addEventListener("yt-page-data-updated", refresh);
  setInterval(redirectShorts, 700);
  setInterval(refresh, 8000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh);
  } else {
    refresh();
  }
})();
