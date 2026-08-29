const COPY = {
  social: {
    bubble: "هان!",
    badge: "بسته شد",
    title: (site) =>
      site && site !== "این سایت" ? `${site} امروز باز نمی‌شود` : "این سایت امروز باز نمی‌شود",
    lead: "اینستاگرام و امثالش وقت را بی‌صدا می‌برند. برو سر کارت، یا یک کتاب بردار.",
    quote: "اگر سعدی اینستا داشت، گلستانش ناتمام می‌ماند."
  },
  shorts: {
    bubble: "نه!",
    badge: "شورتس بسته",
    title: () => "این ویدیوها ته ندارند",
    lead: "شورتس پشت‌سرهم می‌آید و یک ساعت می‌پرد. ویدیوی معمولی را ببین، این یکی نه.",
    quote: "این حلقه ته ندارد؛ بهتر است همین‌جا وایستی."
  },
  limit: {
    bubble: "بس است",
    badge: "وقت تمام",
    title: () => "برای امروز کافی بود",
    lead: "وقتی که برای یوتیوب گذاشته بودی تمام شد. فردا دوباره باز می‌شود.",
    quote: "فردا یوتیوب هست. امشب مال خودت باشد."
  },
  default: {
    bubble: "آرام",
    badge: "بسته شد",
    title: () => "این سایت بسته است",
    lead: "یک توقف کوچک، قبل از اینکه یک ساعت بپرد.",
    quote: "تمرکز سخت نیست. فقط همین در را ببند."
  }
};

const LABELS = {
  "instagram.com": "اینستاگرام",
  "twitter.com": "توییتر",
  "x.com": "ایکس",
  "tiktok.com": "تیک‌تاک",
  "threads.net": "تردز",
  "youtube.com": "یوتیوب"
};

const params = new URLSearchParams(location.search);
const reason =
  params.get("reason") || document.documentElement.dataset.reason || "social";
const site = params.get("site") || document.documentElement.dataset.site || "";
const copy = COPY[reason] || COPY.default;
const label = LABELS[site] || site || "این سایت";

document.getElementById("bubble").textContent = copy.bubble;
document.getElementById("letter-badge").textContent = copy.badge;
document.getElementById("title").textContent = copy.title(label);
document.getElementById("lead").textContent = copy.lead;
document.getElementById("quote").textContent = copy.quote;

document.getElementById("close").addEventListener("click", () => {
  window.close();
  setTimeout(() => {
    location.href = "about:blank";
  }, 150);
});
