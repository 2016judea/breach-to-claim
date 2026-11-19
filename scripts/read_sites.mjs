// Step 2: read each official settlement website (home page plus its FAQ and important-dates
// pages) and cache the text. Plain HTTP first; a site that answers with a bot wall is read with
// headless Chromium if Playwright is available (PLAYWRIGHT_DIR, or the repo's own node_modules).
// One visit per site per run, a second apart.
import fs from "node:fs";
import crypto from "node:crypto";
import { htmlToText } from "../lib/text.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const CACHE = new URL("../cache/pages/", import.meta.url);
const CAND = new URL("../data/candidates.json", import.meta.url);
const WALL = /Attention Required!? \| Cloudflare|Performing security verification|Just a moment\.\.\.|cf-browser-verification|Access denied/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const hostOf = (u) => new URL(u).hostname.replace(/^www\./, "");

async function plain(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const html = await r.text();
    return { status: r.status, url: r.url, html, walled: r.status === 403 || r.status === 503 || WALL.test(html.slice(0, 5000)) };
  } catch (e) { return { status: 0, url, html: "", walled: false, error: e.message }; }
}

let browser = null;
async function viaBrowser(url) {
  if (browser === false) return null;
  if (!browser) {
    const dir = process.env.PLAYWRIGHT_DIR;
    try {
      const mod = dir ? await import(dir.replace(/\/$/, "") + "/playwright/index.mjs") : await import("playwright");
      const b = await mod.chromium.launch({ headless: true });
      browser = { b, ctx: await b.newContext({ userAgent: UA }) };
    } catch (e) { browser = false; console.log("no headless browser: " + e.message.split("\n")[0]); return null; }
  }
  const p = await browser.ctx.newPage();
  try {
    const r = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(2500);
    const html = await p.content();
    return { status: r ? r.status() : 0, url: p.url(), html, walled: WALL.test(html.slice(0, 5000)) };
  } catch (e) { return { status: 0, url, html: "", walled: false, error: e.message.split("\n")[0] }; }
  finally { await p.close(); }
}

export async function closeBrowser() { if (browser) await browser.b.close(); browser = null; }

// Same-site links worth reading: FAQ, important dates, claim form, documents.
export function siteLinks(html, base) {
  const host = hostOf(base);
  const out = { faq: null, dates: null, claim: null, documents: null };
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const label = htmlToText(m[2]).toLowerCase();
    const path = u.pathname.toLowerCase();
    const same = u.hostname.replace(/^www\./, "").endsWith(host.split(".").slice(-2).join("."));
    if (!out.faq && same && (/faq/.test(path) || /^faqs?$|frequently asked/.test(label))) out.faq = u.href;
    else if (!out.dates && same && (/important-?dates|deadlines/.test(path) || /important dates/.test(label))) out.dates = u.href;
    else if (!out.documents && same && (/documents?/.test(path) || /^(important )?documents$/.test(label))) out.documents = u.href;
    if (!out.claim && (/(submit|file)[-_ ]?(a[-_ ])?claim|claim-?form|\/claim\b|claimform/.test(path + " ") || /^(submit|file) (a |your )?claim|^claim form|^file now|^submit now/.test(label))) out.claim = u.href;
  }
  return out;
}

async function readOne(url, useBrowser) {
  let home = await plain(url), via = "http";
  if ((home.walled || home.status === 0) && useBrowser) {
    const b = await viaBrowser(url);
    if (b && !b.walled && b.status && b.status < 400) { home = b; via = "browser"; }
  }
  if (home.walled || !home.html || home.status >= 400) return { url, status: home.status, walled: !!home.walled, error: home.error || null };
  const links = siteLinks(home.html, home.url);
  const pages = [{ kind: "home", url: home.url, text: htmlToText(home.html) }];
  for (const kind of ["faq", "dates"]) {
    const u = links[kind];
    if (!u || pages.some((p) => p.url === u)) continue;
    await sleep(800);
    let r = via === "browser" ? await viaBrowser(u) : await plain(u);
    if (r && r.walled && via === "http" && useBrowser) r = await viaBrowser(u);
    if (r && r.html && !r.walled && r.status < 400) pages.push({ kind, url: r.url, text: htmlToText(r.html) });
  }
  const all = pages.map((p) => p.text).join("\n\n");
  return { url, final_url: home.url, status: home.status, via, links, pages, hash: crypto.createHash("sha256").update(all).digest("hex").slice(0, 16), fetched_at: new Date().toISOString() };
}

export async function readSites({ only = null, useBrowser = true, log = console.log } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const cands = JSON.parse(fs.readFileSync(CAND, "utf8")).filter((c) => !only || only.some((o) => c.url.includes(o)));
  let ok = 0, walled = 0, failed = 0;
  for (const c of cands) {
    const r = await readOne(c.url, useBrowser);
    fs.writeFileSync(new URL(hostOf(c.url) + ".json", CACHE), JSON.stringify(r, null, 1));
    if (r.pages) ok++; else if (r.walled) walled++; else failed++;
    log(`${r.pages ? "read " + r.via : r.walled ? "WALLED" : "FAILED " + r.status} ${c.url}${r.pages ? " (" + r.pages.map((p) => p.kind).join("+") + ")" : ""}`);
    await sleep(1000);
  }
  await closeBrowser();
  log(`sites: ${cands.length}, read ${ok}, walled ${walled}, failed ${failed}`);
  return { total: cands.length, ok, walled, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2);
  await readSites({ only: only.length ? only : null });
}
