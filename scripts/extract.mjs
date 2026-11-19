// Step 3: turn each official site's text into a settlement record.
//
// Claude reads the pages and returns fields as VERBATIM quotes. Code keeps a quote only if it
// is really on the page (lib/text.js quoteOnPage), and code, not the model, turns a kept quote
// into a date or a dollar amount. A field whose quote is not on the page is dropped and listed
// in `unverified`, so nothing on the site is the model's own words about the law or the money.
// Only sites whose text changed since the last run are sent (page hash), so a daily run costs
// cents. The same honesty rule as breach-to-complaint's draft.py.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { squash, quoteOnPage, parseDate, slugify } from "../lib/text.js";
import { hostOf } from "./read_sites.mjs";

const CACHE = new URL("../cache/pages/", import.meta.url);
const CAND = new URL("../data/candidates.json", import.meta.url);
const OUT = new URL("../data/settlements.json", import.meta.url);
const MODEL = "claude-opus-5-5";

const q = { type: "string", description: "Copied character for character from the page text, or empty string if the page does not say it." };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_open_class_settlement", "kind", "defendant", "defendant_aliases", "case_name", "case_number", "court", "administrator", "incident_quote", "incident_period", "data_exposed", "class_definition_quote", "subclasses", "notice_id_required_quote", "claim_deadline_quote", "opt_out_deadline_quote", "objection_deadline_quote", "final_approval_hearing_quote", "fund_total_quote", "class_size_quote", "benefits", "loss_window_quote", "contact_quote", "claim_url"],
  properties: {
    is_open_class_settlement: { type: "boolean", description: "true if this is the official website of a class-action settlement that takes claims from the public" },
    kind: { type: "string", enum: ["data_breach", "privacy_tracking", "other"], description: "data_breach = personal data stolen or exposed in a cyberattack, hack, ransomware or unauthorized access; privacy_tracking = a website or app shared people's data (pixels, tracking, recordings, biometrics) without a breach; other = anything else" },
    defendant: { type: "string", description: "The company or organization being sued, as the page names it, without Inc./LLC" },
    defendant_aliases: { type: "array", items: { type: "string" }, description: "Other names the page uses for the defendant or the brand people know (d/b/a, parent company, product name). Empty if none." },
    case_name: { type: "string" },
    case_number: { type: "string" },
    court: { type: "string" },
    administrator: { type: "string", description: "Settlement administrator company if the page names it (e.g. Kroll, Angeion, Epiq, Simpluris, Apex, Atticus, CPT, Verita), else empty" },
    incident_quote: { ...q, description: "One or two sentences, verbatim, saying what happened (the breach or the tracking) and when." },
    incident_period: { type: "string", description: "When the incident happened, as the page says it (e.g. 'May 2025', 'between March 1 and March 5, 2024'), else empty" },
    data_exposed: { type: "array", items: { type: "string" }, description: "Kinds of personal information the page says were involved (e.g. 'Social Security numbers'). Empty if not stated." },
    class_definition_quote: { ...q, description: "The class definition, verbatim: the sentence(s) beginning like 'The Settlement Class is…' or 'You are a Class Member if…'. Include exclusions only if in the same passage." },
    subclasses: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "definition_quote"], properties: { name: { type: "string" }, definition_quote: q } } },
    notice_id_required_quote: { ...q, description: "Verbatim sentence saying a claim needs a notice ID, class member ID, unique ID or confirmation code from the notice, or that only people who received notice can claim. Empty if the page does not say so." },
    claim_deadline_quote: { ...q, description: "Verbatim text that states the claim deadline and contains its date (e.g. 'File a Claim Form Deadline: January 21, 2027' or 'Claim Deadline 1/17/2027')." },
    opt_out_deadline_quote: q,
    objection_deadline_quote: q,
    final_approval_hearing_quote: q,
    fund_total_quote: { ...q, description: "Verbatim text stating the total settlement fund amount, e.g. 'A $16,125,000 settlement has been reached'. Empty if none." },
    class_size_quote: { ...q, description: "Verbatim text stating how many people are in the class or were notified. Empty if none." },
    benefits: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["type", "summary", "max_amount_usd", "requires_documentation", "quote"],
        properties: {
          type: { type: "string", enum: ["documented_losses", "lost_time", "cash_payment", "statutory_subclass_payment", "credit_monitoring", "identity_restoration", "business_changes", "other"] },
          summary: { type: "string", description: "Plain words, under 25 words, what a person gets and what they must show." },
          max_amount_usd: { type: ["number", "null"], description: "The cap or fixed amount in dollars for this benefit as stated in the quote, else null. For insurance coverage inside credit monitoring, null." },
          requires_documentation: { type: "boolean" },
          quote: q,
        },
      },
    },
    loss_window_quote: { ...q, description: "Verbatim text saying from what date losses must have happened to be reimbursed. Empty if none." },
    contact_quote: { ...q, description: "Verbatim text with the settlement administrator's phone number and/or email." },
    claim_url: { type: "string", description: "The URL of the online claim form, chosen from the LINKS list given, else empty." },
  },
};

const SYSTEM = `You read the official website of a class-action settlement and fill a form about it.
Rules:
- Every field ending in _quote, and every benefit quote, must be copied exactly from the page text given: same words, same numbers, same punctuation. Never paraphrase inside a quote. If the page does not say it, return an empty string.
- Never add facts that are not on the page. Do not guess amounts, dates or courts.
- Short quotes are fine: the shortest exact passage that carries the fact and its date or amount.`;

const MONEY = (n) => new RegExp("\\$\\s?" + Math.round(n).toLocaleString("en-US").replace(/,/g, ",?") + "(\\.\\d{2})?(?!\\d)");
const firstMoney = (s) => { const m = String(s).match(/\$\s?([\d,]+(?:\.\d{2})?)(\s*(million|billion))?/i); if (!m) return null; let v = Number(m[1].replace(/,/g, "")); if (m[3]) v *= /billion/i.test(m[3]) ? 1e9 : 1e6; return v; };
const firstCount = (s) => { const m = String(s).replace(/\$[\d,.]+/g, "").match(/(\d{1,3}(?:,\d{3})+|\d{4,})(\s*(million))?/i); if (!m) return null; let v = Number(m[1].replace(/,/g, "")); if (m[3]) v *= 1e6; return v; };

// The name people know: "Trustees of Columbia University in the City of New York" is
// "Columbia University" on the letter. For a long legal name only, use an alias of two or more
// words found inside it.
export function displayName(defendant, aliases) {
  if (defendant.split(/\s+/).length < 7 && !/^(trustees|board|regents|president and fellows) of /i.test(defendant)) return defendant;
  const inside = aliases.filter((a) => a.split(/\s+/).length >= 2 && defendant.toLowerCase().includes(a.toLowerCase()));
  return inside.length ? inside.sort((a, b) => b.length - a.length)[0] : defendant;
}

export function buildRecord(x, site, cand) {
  const page = squash(site.pages.map((p) => p.text).join("\n"));
  const unverified = [];
  const keep = (field, quote) => {
    if (!quote) return null;
    if (quoteOnPage(quote, page)) return quote.trim();
    unverified.push(field);
    return null;
  };
  const dateFrom = (field, quote) => { const kq = keep(field, quote); return kq ? { date: parseDate(kq), quote: kq } : null; };

  const benefits = [];
  for (const b of x.benefits || []) {
    const kq = keep("benefit:" + b.type, b.quote);
    if (!kq) continue;
    const amt = b.max_amount_usd != null && MONEY(b.max_amount_usd).test(kq) ? b.max_amount_usd : null;
    benefits.push({ type: b.type, summary: b.summary, max_usd: amt, needs_documents: !!b.requires_documentation, quote: kq });
  }
  const CASH = new Set(["documented_losses", "lost_time", "cash_payment", "statutory_subclass_payment", "other"]);
  const cashCaps = benefits.filter((b) => CASH.has(b.type) && b.max_usd).map((b) => b.max_usd);
  const fundQ = keep("fund_total", x.fund_total_quote);
  const sizeQ = keep("class_size", x.class_size_quote);
  const lossQ = keep("loss_window", x.loss_window_quote);
  const noticeQ = keep("notice_id_required", x.notice_id_required_quote);
  const classQ = keep("class_definition", x.class_definition_quote);
  const claimUrl = x.claim_url && Object.values(site.links || {}).includes(x.claim_url) ? x.claim_url : (site.links && site.links.claim) || null;
  const official = site.final_url ? new URL(site.final_url).origin + "/" : cand.url;
  const defendant = (x.defendant || cand.name_hint || hostOf(cand.url)).trim();

  const aliases = [...new Set((x.defendant_aliases || []).map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== defendant.toLowerCase()))];
  const display = displayName(defendant, aliases);
  return {
    slug: slugify(display + (x.kind === "privacy_tracking" ? " privacy" : "")),
    kind: x.kind,
    name: display,
    defendant,
    aliases,
    case_name: x.case_name || null,
    case_number: x.case_number || null,
    court: x.court || null,
    administrator: x.administrator || null,
    official_site: official,
    claim_url: claimUrl,
    incident: { quote: keep("incident", x.incident_quote), period: x.incident_period || null, data_exposed: x.data_exposed || [] },
    class_definition: classQ,
    subclasses: (x.subclasses || []).map((s) => ({ name: s.name, definition: keep("subclass:" + s.name, s.definition_quote) })).filter((s) => s.definition),
    notice_id_required: noticeQ ? true : null,
    notice_id_quote: noticeQ,
    deadlines: {
      claim: dateFrom("claim_deadline", x.claim_deadline_quote),
      opt_out: dateFrom("opt_out_deadline", x.opt_out_deadline_quote),
      objection: dateFrom("objection_deadline", x.objection_deadline_quote),
      final_approval_hearing: dateFrom("final_approval_hearing", x.final_approval_hearing_quote),
    },
    fund_total_usd: fundQ ? firstMoney(fundQ) : null,
    fund_total_quote: fundQ,
    class_size: sizeQ ? firstCount(sizeQ) : null,
    class_size_quote: sizeQ,
    max_cash_usd: cashCaps.length ? Math.max(...cashCaps) : null,
    benefits,
    losses_from: lossQ ? parseDate(lossQ) : null,
    loss_window_quote: lossQ,
    contact: keep("contact", x.contact_quote),
    sources: site.pages.map((p) => p.url),
    read_via: site.via,
    verified_at: site.fetched_at,
    page_hash: site.hash,
    unverified,
  };
}

async function ask(client, site) {
  const pages = site.pages.map((p) => `=== PAGE (${p.kind}) ${p.url} ===\n${p.text}`).join("\n\n");
  const links = Object.entries(site.links || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
  const r = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `${pages}\n\n=== LINKS ===\n${links || "(none)"}` }],
  });
  if (r.stop_reason === "refusal") throw new Error("refusal");
  const t = r.content.find((b) => b.type === "text");
  return { data: JSON.parse(t.text), usage: r.usage };
}

export async function extract({ force = false, only = null, log = console.log } = {}) {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const cands = JSON.parse(fs.readFileSync(CAND, "utf8"));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { settlements: [], skipped: [] };
  const prevBy = new Map([...prev.settlements, ...(prev.skipped || [])].map((s) => [s.official_site_key, s]));
  const settlements = [], skipped = [];
  let inTok = 0, outTok = 0, calls = 0;
  // A scheduled run sends at most this many sites to the model (each ~$0.06), so a site whose
  // page text changes every day cannot run the bill up.
  const cap = Number(process.env.MAX_EXTRACT) || Infinity;
  let reserved = 0;
  const one = async (c) => {
    const key = hostOf(c.url);
    if (only && !only.some((o) => key.includes(o))) { const p = prevBy.get(key); if (p) (p.skip_reason ? skipped : settlements).push(p); return; }
    const f = new URL(key + ".json", CACHE);
    const site = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
    const old = prevBy.get(key);
    if (!site || !site.pages) {
      // Could not read the site this run: keep the last verified record, unchanged.
      if (old) (old.skip_reason ? skipped : settlements).push({ ...old, last_read_failed: new Date().toISOString().slice(0, 10) });
      else skipped.push({ official_site_key: key, url: c.url, name_hint: c.name_hint, skip_reason: site && site.walled ? "site walls automated reading" : "site did not load" });
      return;
    }
    if (old && !force && old.page_hash === site.hash) {
      const { last_read_failed, ...rest } = old;
      (old.skip_reason ? skipped : settlements).push({ ...rest, verified_at: site.fetched_at });
      return;
    }
    const canAsk = client && reserved < cap;
    if (old && !old.skip_reason && !canAsk) {
      // The page changed but the model is not available this run: re-check the stored quotes
      // in code. Still on the page = still true; gone = flag the record, keep the old read date.
      const page = squash(site.pages.map((p) => p.text).join("\n"));
      const quotes = [old.deadlines.claim?.quote, old.class_definition].filter(Boolean);
      const holds = quotes.length && quotes.every((x) => quoteOnPage(x, page));
      const { stale, ...rest } = old;
      settlements.push(holds ? { ...rest, verified_at: site.fetched_at, page_hash: site.hash } : { ...rest, stale: "The official site changed since it was read; check its dates there." });
      return;
    }
    if (!canAsk) {
      if (old) skipped.push(old); else skipped.push({ official_site_key: key, url: c.url, name_hint: c.name_hint, skip_reason: "new, not read yet" });
      return;
    }
    reserved++;
    try {
      const { data, usage } = await ask(client, site);
      calls++; inTok += usage.input_tokens; outTok += usage.output_tokens;
      if (!data.is_open_class_settlement || data.kind === "other") {
        skipped.push({ official_site_key: key, url: c.url, name_hint: data.defendant || c.name_hint, kind: data.kind, skip_reason: data.kind === "other" ? "not a data-breach or privacy settlement" : "not a settlement taking claims", page_hash: site.hash });
        log(`skip ${key}: ${data.kind}`);
        return;
      }
      const rec = { official_site_key: key, ...buildRecord(data, site, c), first_seen: c.first_seen };
      if (old && old.slug) rec.slug = old.slug; // a page link, once handed out, keeps working
      settlements.push(rec);
      log(`ok ${key}: ${rec.defendant} | claim ${rec.deadlines.claim?.date || "?"} | up to ${rec.max_cash_usd ?? "?"} | unverified ${rec.unverified.join(",") || "-"}`);
    } catch (e) {
      log(`FAILED ${key}: ${e.message}`);
      if (old) settlements.push(old);
    }
  };
  // A few sites at a time: each model call takes ~20 s.
  const queue = [...cands], n = Number(process.env.EXTRACT_CONCURRENCY) || 5;
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await one(queue.shift()); }));
  // Two sites, one defendant: keep slugs unique.
  const seen = {};
  settlements.sort((a, b) => a.official_site_key.localeCompare(b.official_site_key));
  for (const s of settlements) { seen[s.slug] = (seen[s.slug] || 0) + 1; if (seen[s.slug] > 1) s.slug += "-" + seen[s.slug]; }
  settlements.sort((a, b) => (a.deadlines.claim?.date || "9999").localeCompare(b.deadlines.claim?.date || "9999"));
  const out = { generated_at: new Date().toISOString(), model: MODEL, settlements, skipped };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  const cost = (inTok * 4 + outTok * 20) / 1e6;
  log(`settlements ${settlements.length}, skipped ${skipped.length}; model calls ${calls}, ${inTok} in / ${outTok} out tokens, ~$${cost.toFixed(2)}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  await extract({ force: args.includes("--force"), only: args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : null });
}
