// Run: npm test (from the repo root). Drives the MCP tools against the committed data.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { callTool, handleOne, tag, pageLink, TOOLS } from "../api/mcp.js";
import { nameScore, loadData, openSettlements } from "../lib/data.js";
import { parseDate, quoteOnPage, squash } from "../lib/text.js";
import { checklist } from "../lib/checklist.js";
import { buildRecord } from "../scripts/extract.mjs";

process.env.BTC_NO_ANALYTICS = "1";
const data = loadData();

test("dates parse in every shape official sites print", () => {
  assert.equal(parseDate("File a Claim Form Deadline: January 21, 2027"), "2027-01-21");
  assert.equal(parseDate("Claim Deadline\n1/17/2027"), "2027-01-17");
  assert.equal(parseDate("Jan. 5, 2027 at 8:45 a.m."), "2027-01-05");
  assert.equal(parseDate("2026-12-04"), "2026-12-04");
});

test("a model quote that is not on the page is dropped and listed", () => {
  const site = { pages: [{ text: "Claim Deadline 1/17/2027. Up to $5,000.00 for documented losses." }], links: {}, hash: "x", fetched_at: "2026-11-19T00:00:00Z", final_url: "https://x.com/" };
  const x = { defendant: "Acme", defendant_aliases: [], kind: "data_breach", benefits: [{ type: "documented_losses", summary: "s", max_amount_usd: 5000, requires_documentation: true, quote: "Up to $5,000.00 for documented losses." }, { type: "cash_payment", summary: "s", max_amount_usd: 900, requires_documentation: false, quote: "An invented $900 payment." }], claim_deadline_quote: "Claim Deadline 1/17/2027", class_definition_quote: "Everyone in America", subclasses: [], data_exposed: [] };
  const r = buildRecord(x, site, { url: "https://x.com/" });
  assert.equal(r.deadlines.claim.date, "2027-01-17");
  assert.equal(r.max_cash_usd, 5000);
  assert.equal(r.benefits.length, 1);
  assert.equal(r.class_definition, null);
  assert.deepEqual(r.unverified.sort(), ["benefit:cash_payment", "class_definition"]);
});

test("an amount the quote does not print is not kept", () => {
  const site = { pages: [{ text: "Up to $500 for lost time." }], links: {}, hash: "x", fetched_at: "t", final_url: "https://x.com/" };
  const r = buildRecord({ defendant: "A", kind: "data_breach", benefits: [{ type: "lost_time", summary: "s", max_amount_usd: 5000, requires_documentation: true, quote: "Up to $500 for lost time." }], subclasses: [], data_exposed: [] }, site, { url: "https://x.com/" });
  assert.equal(r.benefits[0].max_usd, null);
});

test("names match the way a letter is worded", () => {
  assert.equal(nameScore("my letter is from Columbia University Irving Medical Center", "Columbia University"), 1);
  assert.equal(nameScore("davita", "DaVita"), 1);
  assert.ok(nameScore("Columbia", "Columbia University") > 0);
  assert.equal(nameScore("Columbia University", "Columbia Bank"), 0);
  assert.equal(nameScore("the data breach settlement", "Acme Data Inc."), 0);
});

test("every settlement record carries its sources and an official site", () => {
  assert.ok(data.settlements.length > 0);
  for (const s of data.settlements) {
    assert.ok(s.official_site.startsWith("https://"), s.slug);
    assert.ok(s.sources.length >= 1, s.slug);
    assert.ok(s.verified_at, s.slug);
    for (const b of s.benefits) assert.ok(b.quote, s.slug + " benefit without quote");
  }
});

test("links carry src=mcp and nothing about the person", () => {
  const s = data.settlements[0];
  const u = pageLink(s, { got_notice_letter: true, had_out_of_pocket_losses: false, company: "secret" });
  assert.match(u, /\?n=1&l=0&src=mcp$/);
  assert.equal(tag("https://example.com/"), "https://example.com/");
});

test("find_breach_settlement answers for an open settlement and for a miss", () => {
  const s = openSettlements(data)[0];
  const r = callTool("find_breach_settlement", { company: s.defendant, got_notice_letter: true });
  assert.ok(r.out.matches.length >= 1);
  const m = r.out.matches[0];
  assert.ok(m.claim_deadline && m.official_site && m.page.includes("src=mcp"));
  assert.ok(m.your_checklist.length >= 2);
  const miss = callTool("find_breach_settlement", { company: "Zzyzx Nonexistent Widgets" });
  assert.equal(miss.out.matches.length, 0);
  assert.match(miss.out.answer, /No open settlement/);
});

test("the tool output never contains an SSN-shaped string or asks for one", () => {
  const all = JSON.stringify(TOOLS) + JSON.stringify(callTool("list_open_breach_settlements", { limit: 100 }).out);
  assert.doesNotMatch(all, /\b\d{3}-\d{2}-\d{4}\b/);
});

test("checklist follows the two answers", () => {
  const s = { benefits: [{ type: "documented_losses", summary: "Losses up to $5,000 with receipts." }, { type: "cash_payment", summary: "$50 cash, no receipts." }], deadlines: { claim: { date: "2027-01-21" } }, notice_id_required: true, contact: "call 1-800", claim_url: "https://x.com/claim", official_site: "https://x.com/", losses_from: "2025-05-16" };
  assert.match(checklist(s, { got_notice_letter: false }).join(" "), /contact the settlement administrator first: call 1-800/);
  assert.match(checklist(s, { had_out_of_pocket_losses: true }).join(" "), /on or after May 16, 2025/);
  assert.match(checklist(s, { had_out_of_pocket_losses: false }).join(" "), /take the cash payment/);
});

test("JSON-RPC: initialize, tools/list, tools/call", async () => {
  const meta = { ip: "t", ua: "test", client: "script", test: true };
  assert.equal((await handleOne({ id: 1, method: "initialize", params: {} }, meta)).result.serverInfo.name, "breach-to-claim");
  assert.equal((await handleOne({ id: 2, method: "tools/list" }, meta)).result.tools.length, 12);
  const r = await handleOne({ id: 3, method: "tools/call", params: { name: "list_open_breach_settlements", arguments: { limit: 3 } } }, meta);
  assert.ok(r.result.structuredContent.settlements.length <= 3);
  for (const t of TOOLS) for (const k of ["readOnlyHint", "destructiveHint", "openWorldHint", "idempotentHint"]) assert.equal(typeof t.annotations[k], "boolean");
});

test("theme doors answer in the user's words", async () => {
  const meta = { ip: "t", ua: "test", client: "script", test: true };
  for (const t of TOOLS) { assert.ok(t.title && t.annotations.title, t.name); assert.doesNotMatch(t.description, /^(Use|Call|Always) /, t.name); }
  const call = async (name, args) => (await handleOne({ id: 9, method: "tools/call", params: { name, arguments: args } }, meta)).result;
  const soon = await call("settlements_closing_soon", { within_days: 400 });
  assert.match(soon.structuredContent.answer, /open settlements? close within 400 days/);
  const big = await call("biggest_breach_settlement_payouts", { limit: 5 });
  const caps = big.structuredContent.settlements.map((s) => Number(s.most_cash.replace(/[$,]/g, "")));
  assert.deepEqual(caps, [...caps].sort((a, b) => b - a));
  const miss = await call("settlement_claim_deadline", { company: "Zzyzx Nonexistent Holdings" });
  assert.match(miss.structuredContent.answer, /^No settlement for/);
  assert.equal((await call("how_to_file_breach_claim", {})).isError, true);
  assert.equal((await call("no_such_tool", {})).isError, true);
});
