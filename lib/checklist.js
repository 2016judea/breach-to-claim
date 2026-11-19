// The person's claim checklist, from a settlement record and two yes/no answers.
// Pure and self-contained on purpose: the MCP server imports it, and scripts/build.mjs inlines
// its source into each settlement page so the page and the chat give the same steps.
export function checklist(s, a) {
  a = a || {};
  var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var day = function (iso) { var p = String(iso).split("-"); return p.length === 3 ? M[Number(p[1]) - 1] + " " + Number(p[2]) + ", " + p[0] : iso; };
  var steps = [];
  var losses = s.benefits.filter(function (b) { return b.type === "documented_losses" || b.type === "lost_time"; });
  var cash = s.benefits.filter(function (b) { return b.type === "cash_payment" || b.type === "statutory_subclass_payment"; });
  if (s.notice_id_required) {
    steps.push(a.got_notice_letter === false
      ? "This settlement needs the code printed on the notice. Without a letter, contact the settlement administrator first" + (s.contact ? ": " + s.contact : ".")
      : "Have the notice letter or email in hand: the claim form asks for the code printed on it. Type it only on the official site.");
  } else {
    steps.push("Keep the notice letter or email if you have one: the official site may ask for the ID printed on it.");
  }
  var list = function (bs) { return bs.map(function (b) { return b.summary; }).join(" "); };
  if (a.had_out_of_pocket_losses === true && losses.length) {
    steps.push("Gather receipts or statements for each cost" + (s.losses_from ? " dated on or after " + day(s.losses_from) : "") + ". " + list(losses));
  } else if (a.had_out_of_pocket_losses === false && cash.length) {
    steps.push("With no costs to show, take the cash payment. " + list(cash));
  } else if (losses.length || cash.length) {
    steps.push("Pick one: " + losses.concat(cash).map(function (b) { return b.summary; }).join(" Or: "));
  }
  var mon = s.benefits.filter(function (b) { return b.type === "credit_monitoring"; })[0];
  if (mon) steps.push("Credit monitoring: " + mon.summary);
  steps.push("File by " + ((s.deadlines.claim && s.deadlines.claim.date && day(s.deadlines.claim.date)) || "the deadline on the official site") + " on the official site: " + (s.claim_url || s.official_site) + ". You sign the claim form yourself.");
  return steps;
}

var CASH = { documented_losses: 1, lost_time: 1, cash_payment: 1, statutory_subclass_payment: 1, other: 1 };
export function noDocsOption(s) { return s.benefits.some(function (b) { return CASH[b.type] && !b.needs_documents; }); }
