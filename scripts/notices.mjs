// Breach notices on public record, for the answer "your breach is real, but nothing is open to
// claim yet". Ported from breach-to-complaint's src/sources.py (ca_ag, wa_ag): the California
// AG's breach list (a filing there means 500+ California residents) and the Washington AG's
// notices on data.wa.gov (resident counts and the kinds of data exposed).
import fs from "node:fs";
import { decode } from "../lib/text.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const OUT = new URL("../data/notices.json", import.meta.url);
const CA_LIST = "https://oag.ca.gov/privacy/databreach/list";
const WA_NOTICES = "https://data.wa.gov/resource/sb4j-ca4h.json";
const WA_ELEMENTS = "https://data.wa.gov/resource/padd-mby7.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mdy = (s) => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
const strip = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function parseCaPage(html) {
  const out = [];
  for (const row of [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 3) continue;
    const reported = mdy(cells[2]);
    if (!reported) continue;
    const link = (cells[0].match(/href="([^"]+)"/) || [])[1];
    out.push({
      organization: strip(cells[0]),
      reported_to: "California Attorney General",
      reported_at: reported,
      breach_dates: [...cells[1].matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => mdy(m[0])),
      residents_affected: null,
      data_exposed: [],
      source_url: link ? (link.startsWith("/") ? "https://oag.ca.gov" + link : link) : CA_LIST,
    });
  }
  return out;
}

async function ca(since) {
  const out = [];
  for (let page = 0; page < 60; page++) {
    const r = await fetch(CA_LIST + (page ? `?page=${page}` : ""), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) break;
    const rows = parseCaPage(await r.text());
    if (!rows.length) break;
    out.push(...rows.filter((x) => x.reported_at >= since));
    if (rows.every((x) => x.reported_at < since)) break;
    await sleep(500);
  }
  return out;
}

async function wa(since) {
  const u = `${WA_NOTICES}?$where=${encodeURIComponent(`datesubmitted >= '${since}T00:00:00'`)}&$order=datesubmitted DESC&$limit=5000`;
  const rows = await (await fetch(u, { signal: AbortSignal.timeout(30000) })).json();
  const el = {};
  for (let i = 0; i < rows.length; i += 200) {
    const ids = rows.slice(i, i + 200).map((x) => `'${x.id}'`).join(",");
    const e = await (await fetch(`${WA_ELEMENTS}?$where=${encodeURIComponent(`id in (${ids})`)}&$select=id,informationtype&$limit=50000`, { signal: AbortSignal.timeout(30000) })).json();
    for (const x of e) if (x.informationtype) (el[x.id] ||= new Set()).add(x.informationtype);
  }
  return rows.map((x) => ({
    organization: x.name,
    reported_to: "Washington Attorney General",
    reported_at: (x.datesubmitted || "").slice(0, 10),
    breach_dates: [x.datestart, x.dateend].filter(Boolean).map((d) => d.slice(0, 10)),
    residents_affected: /^\d+$/.test(x.washingtoniansaffected || "") ? Number(x.washingtoniansaffected) : null,
    data_exposed: [...(el[x.id] || [])].sort(),
    source_url: `https://data.wa.gov/d/sb4j-ca4h`,
  }));
}

export async function notices({ since = "2024-01-01", log = console.log } = {}) {
  const [c, w] = await Promise.all([ca(since).catch((e) => (log("CA AG failed: " + e.message), null)), wa(since).catch((e) => (log("WA AG failed: " + e.message), null))]);
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { notices: [] };
  // A source that failed today keeps yesterday's rows rather than vanishing.
  const keep = (who, rows) => rows || prev.notices.filter((n) => n.reported_to.startsWith(who));
  const all = [...keep("California", c), ...keep("Washington", w)].sort((a, b) => b.reported_at.localeCompare(a.reported_at));
  fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), since, notices: all }) + "\n");
  log(`notices: ${all.length} (CA ${c ? c.length : "kept"}, WA ${w ? w.length : "kept"}) since ${since}`);
  return all;
}

if (import.meta.url === `file://${process.argv[1]}`) await notices();
