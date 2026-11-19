// Step 1: find the official settlement websites of open data-breach and privacy settlements.
//
// Public settlement indexes are used ONLY to learn that an official site exists (its URL).
// Nothing else is taken from them: every fact we publish is read from the official,
// court-authorized site itself (scripts/read_sites.mjs, scripts/extract.mjs).
// Paths read here are allowed by each index's robots.txt (checked 2026-11-19).
import fs from "node:fs";
import { decode } from "../lib/text.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const OUT = new URL("../data/candidates.json", import.meta.url);
const SEEDS = new URL("../data/seeds.json", import.meta.url);
const DATAISH = /data|breach|privacy|cyber|pixel|incident|ransomware|hack|security/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

export function normUrl(u) {
  try {
    const x = new URL(u.trim());
    return `https://${x.hostname.toLowerCase().replace(/^www\./, "")}/`;
  } catch { return null; }
}

// classaction.org/settlements: each card links straight to the official site.
export function parseClassActionOrg(html) {
  const out = [];
  for (const chunk of html.split(/<div id="(?=[a-z0-9-]+" data-name=)/).slice(1)) {
    const name = decode((chunk.match(/data-name="([^"]*)"/) || [])[1] || "");
    const href = (chunk.match(/href="([^"]+)" class="js-settlement-link/) || [])[1];
    const desc = decode(((chunk.match(/<p class="f6[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "").replace(/<[^>]+>/g, ""));
    if (!href || !/^https?:/.test(href)) continue;
    if (!DATAISH.test(name + " " + desc)) continue;
    if (!/data|breach|privacy|cyber|pixel|incident|ransomware|tracking|personal information|compromised/i.test(name + " " + desc)) continue;
    out.push({ name_hint: name.replace(/\s+-\s+Data (Breach|Privacy).*$/i, "").trim(), url: href });
  }
  return out;
}

const NOT_OFFICIAL = /claimdepot|website-files|facebook|youtube|reddit|x\.com|twitter|disqus|elevenlabs|google|gstatic|apple\.com|amazonaws|instagram|tiktok|linkedin|pinterest|spotify|cloudflare|courtlistener|pacer|uscourts|justia|law360|reuters|bloomberg/i;

// claimdepot.com/settlements/<slug>: the official site is the external host the page links most.
export function officialFromPage(html) {
  const hosts = {};
  for (const [, u] of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const n = normUrl(u);
    if (!n || NOT_OFFICIAL.test(n)) continue;
    hosts[n] = (hosts[n] || 0) + 1;
  }
  const ranked = Object.entries(hosts).sort((a, b) => b[1] - a[1] + (/settlement|claim/.test(b[0]) - /settlement|claim/.test(a[0])) * 100);
  return ranked.length ? ranked[0][0] : null;
}

export async function discover({ log = console.log } = {}) {
  const found = new Map();
  const add = (url, name_hint, via) => {
    const k = normUrl(url);
    if (!k) return;
    const cur = found.get(k) || { url: k, name_hint, found_via: [] };
    if (!cur.found_via.includes(via)) cur.found_via.push(via);
    if (!cur.name_hint && name_hint) cur.name_hint = name_hint;
    found.set(k, cur);
  };

  try {
    const cards = parseClassActionOrg(await get("https://www.classaction.org/settlements"));
    cards.forEach((c) => add(c.url, c.name_hint, "classaction.org"));
    log(`classaction.org: ${cards.length} data/privacy settlements`);
  } catch (e) { log("classaction.org failed: " + e.message); }

  try {
    const list = await get("https://www.claimdepot.com/settlements");
    const slugs = [...new Set([...list.matchAll(/href="\/settlements\/([a-z0-9-]+)"/g)].map((m) => m[1]))].filter((s) => DATAISH.test(s));
    let n = 0;
    for (const s of slugs) {
      try {
        const off = officialFromPage(await get("https://www.claimdepot.com/settlements/" + s));
        if (off) { add(off, s.replace(/-/g, " "), "claimdepot.com"); n++; }
      } catch (e) { log("claimdepot " + s + ": " + e.message); }
      await sleep(1000);
    }
    log(`claimdepot.com: ${n} of ${slugs.length} data/privacy pages gave an official site`);
  } catch (e) { log("claimdepot.com failed: " + e.message); }

  const seeds = fs.existsSync(SEEDS) ? JSON.parse(fs.readFileSync(SEEDS, "utf8")) : [];
  seeds.forEach((s) => add(s.url, s.name_hint, "seed"));

  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
  const today = new Date().toISOString().slice(0, 10);
  const prevBy = new Map(prev.map((p) => [p.url, p]));
  const merged = [...found.values()].map((c) => ({ ...c, first_seen: prevBy.get(c.url)?.first_seen || today, last_seen: today }));
  // Keep candidates that dropped off an index: an index removing a card is not the settlement closing.
  for (const p of prev) if (!found.has(p.url)) merged.push(p);
  merged.sort((a, b) => a.url.localeCompare(b.url));
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 1) + "\n");
  log(`candidates: ${merged.length} (${found.size} seen today)`);
  return merged;
}

if (import.meta.url === `file://${process.argv[1]}`) await discover();
