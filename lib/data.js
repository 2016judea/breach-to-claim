// The data the site and the MCP server answer from: settlements read off official sites
// (scripts/extract.mjs) and breach notices on public record (scripts/notices.mjs).
import fs from "node:fs";
import path from "node:path";
import { nameTokens, daysBetween, todayIso } from "./text.js";

function readJson(rel) {
  const tries = [new URL("../" + rel, import.meta.url), path.join(process.cwd(), rel)];
  for (const t of tries) { try { return JSON.parse(fs.readFileSync(t, "utf8")); } catch {} }
  throw new Error("missing " + rel);
}

let cache = null;
export function loadData() {
  if (!cache) {
    const s = readJson("data/settlements.json");
    let n = { notices: [] };
    try { n = readJson("data/notices.json"); } catch {}
    cache = { generated_at: s.generated_at, settlements: s.settlements, notices: n.notices, notices_at: n.generated_at };
  }
  return cache;
}

export function statusOf(s, today = todayIso()) {
  const d = s.deadlines && s.deadlines.claim && s.deadlines.claim.date;
  if (!d) return { status: "deadline not stated", days_left: null };
  const left = daysBetween(today, d);
  return left >= 0 ? { status: "open", days_left: left } : { status: "claim deadline passed", days_left: left };
}

export const openSettlements = (data = loadData(), today = todayIso()) =>
  data.settlements.filter((s) => statusOf(s, today).status === "open").sort((a, b) => a.deadlines.claim.date.localeCompare(b.deadlines.claim.date));

// A name matches when every distinctive word of the company's name is in what the person typed
// ("my letter is from Columbia University Irving Medical Center" finds Columbia University), or
// when every word they typed is in the company's name ("davita" finds DaVita).
export function nameScore(query, name) {
  const q = new Set(nameTokens(query)), n = [...new Set(nameTokens(name))];
  if (!q.size || !n.length) return 0;
  const hit = n.filter((w) => q.has(w)).length;
  if (hit === n.length) return 1;
  const qs = [...q];
  if (qs.every((w) => n.includes(w)) && qs.some((w) => w.length >= 4)) return 0.8;
  // Joined names: "bluecross" vs "blue cross"
  const qj = qs.join(""), nj = n.join("");
  if (qj.length >= 5 && (nj === qj || nj.startsWith(qj))) return 0.75;
  return 0;
}

export function matchSettlements(query, data = loadData()) {
  return data.settlements
    .map((s) => ({ s, score: Math.max(...[s.name || s.defendant, s.defendant, ...(s.aliases || [])].map((n) => nameScore(query, n))) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.s.deadlines.claim?.date || "9").localeCompare(b.s.deadlines.claim?.date || "9"))
    .map((x) => x.s);
}

export function matchNotices(query, data = loadData(), limit = 6) {
  return data.notices.filter((n) => nameScore(query, n.organization) >= 0.8).slice(0, limit);
}

export const money = (n) => (n == null ? null : "$" + Math.round(n).toLocaleString("en-US"));

// The headline numbers on the front page and in the MCP list: counted, never typed.
export function summary(data = loadData(), today = todayIso()) {
  const open = openSettlements(data, today);
  const within = (d) => open.filter((s) => statusOf(s, today).days_left <= d).length;
  const funds = open.filter((s) => s.fund_total_usd).map((s) => s.fund_total_usd);
  const caps = open.filter((s) => s.max_cash_usd).map((s) => s.max_cash_usd).sort((a, b) => a - b);
  return {
    open: open.length,
    closing_in_7_days: within(7),
    closing_in_30_days: within(30),
    stated_funds_total_usd: funds.reduce((a, b) => a + b, 0),
    settlements_stating_a_fund: funds.length,
    median_max_cash_usd: caps.length ? caps[Math.floor(caps.length / 2)] : null,
    need_notice_code: open.filter((s) => s.notice_id_required).length,
    breach: open.filter((s) => s.kind === "data_breach").length,
    privacy: open.filter((s) => s.kind === "privacy_tracking").length,
  };
}
