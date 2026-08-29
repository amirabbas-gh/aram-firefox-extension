import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCS = join(ROOT, "docs");
const FRAME_DIR = join(tmpdir(), "aram-docs-frames");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2"
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        const file = join(ROOT, decodeURIComponent(url.pathname));
        if (!file.startsWith(ROOT)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const body = await readFile(file);
        res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadPuppeteer() {
  const cache = join(tmpdir(), "aram-puppeteer");
  const require = createRequire(join(cache, "package.json"));
  try {
    return require("puppeteer-core");
  } catch {
    await mkdir(cache, { recursive: true });
    await exec("npm", ["init", "-y"], cache);
    await exec("npm", ["install", "puppeteer-core@24.15.0", "--no-fund", "--no-audit"], cache);
    return require("puppeteer-core");
  }
}

function exec(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: cmd === "ffmpeg" ? "ignore" : "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} -> ${code}`))));
  });
}

async function shotGif(page, { url, selector, pad = 0, name, width, extraCss = "", endSelector = "" }) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle0" });
  if (extraCss) {
    await page.addStyleTag({ content: extraCss });
  }
  await page.evaluate(() => document.fonts.ready);
  await sleep(250);

  const clip = await page.evaluate((sel, padding, endSel) => {
    const el = document.querySelector(sel);
    const end = endSel ? document.querySelector(endSel) : el;
    const a = el.getBoundingClientRect();
    const b = end.getBoundingClientRect();
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.right, b.right);
    const bottom = Math.max(a.bottom, b.bottom);
    return {
      x: Math.max(0, left - padding),
      y: Math.max(0, top - padding),
      width: Math.ceil(right - left + padding * 2),
      height: Math.ceil(bottom - top + padding * 2)
    };
  }, selector, pad, endSelector);

  await page.setViewport({
    width: Math.max(width, Math.ceil(clip.x + clip.width) + 24),
    height: Math.max(200, Math.ceil(clip.y + clip.height) + 24),
    deviceScaleFactor: 2
  });
  await sleep(80);

  const clipAfter = await page.evaluate((sel, padding, endSel) => {
    const el = document.querySelector(sel);
    const end = endSel ? document.querySelector(endSel) : el;
    const a = el.getBoundingClientRect();
    const b = end.getBoundingClientRect();
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    const right = Math.max(a.right, b.right);
    const bottom = Math.max(a.bottom, b.bottom);
    return {
      x: Math.max(0, left - padding),
      y: Math.max(0, top - padding),
      width: Math.ceil(right - left + padding * 2),
      height: Math.ceil(bottom - top + padding * 2)
    };
  }, selector, pad, endSelector);

  const frames = [];
  for (let i = 0; i < 4; i += 1) {
    const path = join(FRAME_DIR, `${name}-${i}.png`);
    await page.screenshot({ path, clip: clipAfter, type: "png" });
    frames.push(path);
    await sleep(260);
  }

  const out = join(DOCS, `${name}.gif`);
  await exec("ffmpeg", [
    "-y",
    "-start_number", "0",
    "-framerate", "1000/260",
    "-i", join(FRAME_DIR, `${name}-%d.png`),
    "-filter_complex",
    "split[a][b];[a]palettegen=max_colors=64:reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=none",
    "-loop", "0",
    out
  ], ROOT);
  return out;
}

const BLOCKED_CSS = `
  html, body { min-height: 0 !important; height: auto !important; }
  body { display: block !important; padding: 16px !important; }
`;

async function main() {
  await rm(FRAME_DIR, { recursive: true, force: true });
  await mkdir(FRAME_DIR, { recursive: true });
  await mkdir(DOCS, { recursive: true });

  const server = await serve();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--font-render-hinting=none"]
  });
  const page = await browser.newPage();

  try {
    await shotGif(page, {
      url: `${origin}/pages/popup.html`,
      selector: "body",
      pad: 0,
      name: "popup",
      width: 440,
      extraCss: `
        html, body {
          max-height: none !important;
          height: auto !important;
          overflow: visible !important;
          width: 428px !important;
          padding: 16px 36px 16px 16px !important;
        }
        details { display: none !important; }
      `
    });
    await shotGif(page, {
      url: `${origin}/pages/blocked.html?reason=social&site=instagram.com`,
      selector: ".card",
      pad: 6,
      name: "blocked-social",
      width: 560,
      extraCss: BLOCKED_CSS
    });
    await shotGif(page, {
      url: `${origin}/pages/blocked-shorts.html`,
      selector: ".card",
      pad: 6,
      name: "blocked-shorts",
      width: 560,
      extraCss: BLOCKED_CSS
    });
    await shotGif(page, {
      url: `${origin}/pages/blocked-limit.html`,
      selector: ".card",
      pad: 6,
      name: "blocked-limit",
      width: 560,
      extraCss: BLOCKED_CSS
    });
    await shotGif(page, {
      url: `${origin}/scripts/shots/youtube.html`,
      selector: ".stage",
      pad: 0,
      name: "youtube-reminder",
      width: 400
    });
  } finally {
    await browser.close();
    server.close();
    await rm(FRAME_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
