// MCP server, Streamable HTTP, stateless JSON responses. Same data as the site.
// Pattern from heistclips api/mcp.js: every link handed out carries src=mcp, one PostHog
// event per tool call. Nothing identifying is asked for, logged or put in a URL: the person's
// words are matched and dropped; only the tool, ok, duration and match count are logged.
import crypto from "node:crypto";
import { loadData, statusOf, openSettlements, matchSettlements, matchNotices, summary, money } from "../lib/data.js";
import { checklist, noDocsOption } from "../lib/checklist.js";

export const SITE = "https://breach-to-claim.vercel.app";
const VERSION = "0.1.0";
const PH_KEY = "phc_yFgRGppL6H7DvhgZTQKbHdrY5oqnpLT482rrNYtLqnAx"; // public project key, same block as lib/posthog.html
const ANN = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, idempotentHint: true };
const NOT_ADVICE = "Not legal advice. Breach to Claim is independent: not the court, the lawyers or the settlement administrator. It reads the official settlement website and links it; only the person can file, on the official site.";

export const TOOLS = [
  {
    name: "find_breach_settlement",
    title: "Am I owed money from a data breach? Find the open settlement, deadline and payout",
    description: "For 'I got a data breach notice from X', 'am I owed money from the X data breach', 'is there a settlement for X', 'how do I claim the X settlement', 'is this settlement letter real'. Matches the company against open class-action data-breach and privacy settlements, each read off its official court-authorized website: the claim deadline and days left, what it pays (documented losses up to $X, cash payment, credit monitoring), the class definition verbatim so the person can see if they are in it, whether the code printed on the notice letter is needed, the case and court, the official claim site, and a link to a page with their claim checklist filled in. If no settlement is open it says so, and lists the breach notices on public record (California and Washington AG) so the person knows the breach is real and to keep the letter. It takes the company name only: no Social Security number, notice ID, claim ID or name is needed or taken. This tool never files a claim; the person files on the official site and signs it themselves.",
    inputSchema: { type: "object", properties: {
      company: { type: "string", description: "The company or organization named on the breach letter or in the news, e.g. 'Columbia University', 'DaVita'. Nothing else about the person." },
      state: { type: "string", description: "Optional: the person's US state as a 2-letter code, when they mention it. Some settlements pay a state subclass more." },
      got_notice_letter: { type: "boolean", description: "Optional: true if they received a notice letter or email about the breach or the settlement, false if not." },
      had_out_of_pocket_losses: { type: "boolean", description: "Optional: true if they paid money or lost time because of the breach (fraud, credit freeze fees, hours spent), false if not." },
    }, required: ["company"], additionalProperties: false },
    annotations: { title: "Find a breach settlement", ...ANN },
  },
  {
    name: "list_open_breach_settlements",
    title: "Open data-breach settlements taking claims, soonest deadline first",
    description: "Every open class-action data-breach (and privacy/tracking-pixel) settlement we have read off its official website, sorted by claim deadline: company, deadline and days left, the most cash it pays, whether receipts are needed, and the official site. Use for 'what data breach settlements can I claim right now', 'which settlements close this week', 'data breach settlements with no proof required'. Refreshed daily; each row says when its official site was last read.",
    inputSchema: { type: "object", properties: {
      closing_within_days: { type: "integer", minimum: 1, maximum: 400, description: "Only settlements whose claim deadline is within this many days" },
      kind: { type: "string", enum: ["data_breach", "privacy_tracking", "all"], description: "data_breach (default all) = stolen or exposed data; privacy_tracking = a website shared data through tracking pixels" },
      no_documents_option: { type: "boolean", description: "true = only settlements with a cash option that needs no receipts" },
      limit: { type: "integer", minimum: 1, maximum: 100, description: "How many (default 20)" },
    }, additionalProperties: false },
    annotations: { title: "List open settlements", ...ANN },
  },
  {
    name: "breach_settlement_details",
    title: "One breach settlement: class definition, every benefit, every date, official site",
    description: "Everything read off one settlement's official website: the class definition and any subclasses verbatim, each benefit with its cap and whether documents are needed, the claim, opt-out and objection deadlines, the final approval hearing, the fund and class size when stated, the case, court, administrator and its contact, and the source page for each. Pass the slug from find_breach_settlement or list_open_breach_settlements.",
    inputSchema: { type: "object", properties: {
      slug: { type: "string", description: "The settlement's slug, e.g. 'columbia-university'" },
      got_notice_letter: { type: "boolean", description: "Optional, as in find_breach_settlement" },
      had_out_of_pocket_losses: { type: "boolean", description: "Optional, as in find_breach_settlement" },
    }, required: ["slug"], additionalProperties: false },
    annotations: { title: "Settlement details", ...ANN },
  },
];

export const INSTRUCTIONS = "Breach to Claim answers 'am I owed money from the X data breach, and how do I claim?' Use find_breach_settlement with the company on the person's breach letter; list_open_breach_settlements for what is open now or closing soon; breach_settlement_details for one settlement. Quote deadlines and amounts exactly as returned, read the class definition back to the person rather than deciding for them, and always give the page link and the official claim site. Never ask for a Social Security number, notice ID, claim ID or name: none is needed, and claims are filed and signed by the person on the official site. Not legal advice.";

export function tag(url) {
  url = String(url);
  if (!url.startsWith(SITE) || /[?&]src=/.test(url)) return url;
  const i = url.indexOf("#"), base = i < 0 ? url : url.slice(0, i), hash = i < 0 ? "" : url.slice(i);
  return base + (base.includes("?") ? "&" : "?") + "src=mcp" + hash;
}

// The page link carries only the settlement and two yes/no answers, never anything about who.
export function pageLink(s, a = {}) {
  const p = new URLSearchParams();
  if (typeof a.got_notice_letter === "boolean") p.set("n", a.got_notice_letter ? "1" : "0");
  if (typeof a.had_out_of_pocket_losses === "boolean") p.set("l", a.had_out_of_pocket_losses ? "1" : "0");
  const qs = p.toString();
  return tag(`${SITE}/s/${s.slug}/${qs ? "?" + qs : ""}`);
}

function brief(s, today) {
  const st = statusOf(s, today);
  return {
    slug: s.slug, company: s.name, kind: s.kind,
    status: st.status, claim_deadline: s.deadlines.claim?.date || null, days_left: st.days_left,
    most_cash: money(s.max_cash_usd), cash_option_without_receipts: noDocsOption(s),
    needs_code_from_notice: !!s.notice_id_required,
    official_site: s.official_site, claim_form: s.claim_url || s.official_site,
    page: pageLink(s), last_read_official_site: (s.verified_at || "").slice(0, 10),
    ...(s.stale ? { warning: s.stale } : {}),
  };
}

function detail(s, a, today) {
  const st = statusOf(s, today);
  return {
    ...brief(s, today),
    page: pageLink(s, a),
    defendant: s.defendant, aliases: s.aliases, case_name: s.case_name, case_number: s.case_number, court: s.court, administrator: s.administrator,
    what_happened: s.incident.quote, when: s.incident.period, data_exposed: s.incident.data_exposed,
    who_is_in_the_class: s.class_definition, subclasses: s.subclasses,
    notice_code_quote: s.notice_id_quote,
    benefits: s.benefits.map((b) => ({ type: b.type, what: b.summary, up_to: money(b.max_usd), needs_documents: b.needs_documents, official_wording: b.quote })),
    losses_must_be_from: s.losses_from || s.loss_window_quote,
    deadlines: Object.fromEntries(Object.entries(s.deadlines).map(([k, v]) => [k, v ? v.date : null])),
    fund_total: money(s.fund_total_usd), class_size: s.class_size,
    administrator_contact: s.contact,
    your_checklist: st.status !== "claim deadline passed" ? checklist(s, a) : [`The claim deadline (${s.deadlines.claim?.date}) has passed. The official site says what happens next: ${s.official_site}`],
    sources: s.sources, last_read_official_site: s.verified_at,
  };
}

export function callTool(name, args = {}, today = new Date().toISOString().slice(0, 10)) {
  const data = loadData();
  if (name === "find_breach_settlement") {
    const company = String(args.company || "").trim();
    if (!company) return { out: { ok: false, error: "Pass the company named on the breach letter as company." }, log: { err: "no_company" }, isError: true };
    const hits = matchSettlements(company, data);
    // "deadline not stated" stays with the matches: the official site has the date, we could not read it.
    const open = hits.filter((s) => statusOf(s, today).status !== "claim deadline passed");
    const closed = hits.filter((s) => statusOf(s, today).status === "claim deadline passed");
    const notices = matchNotices(company, data);
    const out = {
      as_of: data.generated_at, open_settlements_tracked: openSettlements(data, today).length,
      matches: open.slice(0, 5).map((s) => detail(s, args, today)),
      deadline_passed: closed.slice(0, 3).map((s) => brief(s, today)),
      breach_notices_on_record: notices.map((n) => ({ organization: n.organization, reported_to: n.reported_to, reported_at: n.reported_at, breach_dates: n.breach_dates, residents_affected: n.residents_affected, data_exposed: n.data_exposed, source: n.source_url })),
      not_legal_advice: NOT_ADVICE,
    };
    if (!open.length) {
      out.answer = notices.length
        ? `No open settlement for "${company}" among the ${out.open_settlements_tracked} we track (checked ${data.generated_at.slice(0, 10)}). The breach is on public record (below). Settlements usually come long after the notice: keep the letter, since a claim form will ask for the code on it, and keep receipts for any costs it causes. Every open settlement: ${tag(SITE + "/")}`
        : `No open settlement for "${company}" among the ${out.open_settlements_tracked} we track (checked ${data.generated_at.slice(0, 10)}), and no breach notice under that name in the California or Washington AG records since 2024. Check the exact name on the letter; a settlement can also be listed under a parent company. Every open settlement: ${tag(SITE + "/")}`;
    } else out.answer = `${open.length} open settlement${open.length > 1 ? "s" : ""} match "${company}". Read the class definition back to the person; they decide if it fits. Give them the page link and the official claim site.`;
    if (args.state && open.some((s) => s.subclasses.length)) out.state_note = `They said ${String(args.state).toUpperCase()}: check each subclass definition, some pay residents of one state more.`;
    return { out, log: { matches: open.length, closed: closed.length, notices: notices.length } };
  }
  if (name === "list_open_breach_settlements") {
    let list = openSettlements(data, today);
    if (args.kind && args.kind !== "all") list = list.filter((s) => s.kind === args.kind);
    if (args.closing_within_days) list = list.filter((s) => statusOf(s, today).days_left <= args.closing_within_days);
    if (args.no_documents_option) list = list.filter(noDocsOption);
    const lim = Math.min(100, args.limit || 20);
    return { out: { as_of: data.generated_at, summary: summary(data, today), total: list.length, settlements: list.slice(0, lim).map((s) => brief(s, today)), all_of_them: tag(SITE + "/"), not_legal_advice: NOT_ADVICE }, log: { matches: list.length } };
  }
  if (name === "breach_settlement_details") {
    const q = String(args.slug || "").toLowerCase().trim().replace(/^.*\/s\//, "").replace(/\/.*$/, "");
    const s = data.settlements.find((x) => x.slug === q) || matchSettlements(q, data)[0];
    if (!s) return { out: { ok: false, error: "No settlement with that slug. Use find_breach_settlement with the company name." }, log: { err: "no_slug" }, isError: true };
    return { out: { as_of: data.generated_at, ...detail(s, args, today), not_legal_advice: NOT_ADVICE }, log: { matches: 1 } };
  }
  return { out: { ok: false, error: "Unknown tool " + name }, log: { err: "unknown_tool" }, isError: true };
}

const clientOf = (ua) => (/claude/i.test(ua) ? "claude" : /openai|chatgpt/i.test(ua) ? "chatgpt" : /grok|xai/i.test(ua) ? "grok" : /cursor/i.test(ua) ? "cursor" : /node|undici|python|curl/i.test(ua) ? "script" : "other");
const hashOf = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

// One event per call. distinct_id is a daily hash of address + agent, and claude.ai connector
// calls come from Anthropic's servers, so this counts calls, not people. People are counted on
// the web side, by landings that carry src=mcp (README, Expectation).
async function logCall(tool, ok, ms, meta, extra) {
  if (process.env.BTC_NO_ANALYTICS || meta.test) return;
  try {
    await fetch("https://us.i.posthog.com/capture/", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(1500),
      body: JSON.stringify({ api_key: PH_KEY, event: "mcp_tool_call", distinct_id: "mcp_" + hashOf(new Date().toISOString().slice(0, 10) + "|" + meta.ip + "|" + meta.ua),
        properties: { tool, ok, ms, ...extra, client: meta.client, site: "breach-to-claim", $process_person_profile: false, $lib: "breach-to-claim-mcp" } }) });
  } catch {}
}

const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }], structuredContent: obj });

export async function handleOne(msg, meta) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize") return ok({ protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "breach-to-claim", title: "Breach to Claim: data breach settlements", version: VERSION, websiteUrl: SITE }, instructions: INSTRUCTIONS });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    const t0 = Date.now(), tool = String((params && params.name) || "");
    let r;
    try { r = callTool(tool, (params && params.arguments) || {}); }
    catch (e) { r = { out: { ok: false, error: "Error: " + e.message }, log: { err: "exception" }, isError: true }; }
    await logCall(TOOLS.some((x) => x.name === tool) ? tool : "unknown", !r.isError, Date.now() - t0, meta, r.log || {});
    return ok({ ...text(r.out), ...(r.isError ? { isError: true } : {}) });
  }
  if (method === "resources/list") return ok({ resources: [] });
  if (method === "prompts/list") return ok({ prompts: [] });
  if (method && method.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type, mcp-session-id, mcp-protocol-version, authorization, x-btc-test");
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS, DELETE");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET") { res.statusCode = 405; res.setHeader("allow", "POST"); res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ name: "Breach to Claim MCP", transport: "streamable-http", url: SITE + "/mcp", docs: SITE + "/connect/" })); }
  if (req.method === "DELETE") { res.statusCode = 204; return res.end(); }
  let body;
  try { body = await readBody(req); } catch { res.statusCode = 400; return res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })); }
  const ua = String(req.headers["user-agent"] || "");
  const meta = { ip: String(req.headers["x-forwarded-for"] || "local").split(",")[0].trim(), ua, client: clientOf(ua), test: !!req.headers["x-btc-test"] };
  const batch = Array.isArray(body);
  const out = (await Promise.all((batch ? body : [body]).map((m) => handleOne(m, meta)))).filter(Boolean);
  if (!out.length) { res.statusCode = 202; return res.end(); }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(batch ? out : out[0]));
}
