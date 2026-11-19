// Step 4: build the static site in public/ from data/settlements.json.
// Every page carries Vercel Web Analytics and the shared PostHog block (lib/posthog.html),
// here in the generator, so a rebuild can never drop them.
import fs from "node:fs";
import { loadData, statusOf, openSettlements, summary, money } from "../lib/data.js";
import { checklist, noDocsOption } from "../lib/checklist.js";
import { SITE } from "../api/mcp.js";

const ROOT = new URL("../public/", import.meta.url);
const POSTHOG = fs.readFileSync(new URL("../lib/posthog.html", import.meta.url), "utf8");
const CHECKLIST_SRC = fs.readFileSync(new URL("../lib/checklist.js", import.meta.url), "utf8").replace(/^\/\/.*$/gm, "").replace(/export /g, "");
export const INDEXNOW_KEY = "b7c41e0f9a2d4c6e8f13a5b9d2e70c48";
const GITHUB = "https://github.com/2016judea/breach-to-claim";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso, year = true) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${MON[m - 1]} ${d}${year ? ", " + y : ""}`; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const write = (rel, body) => { const f = new URL(rel, ROOT); fs.mkdirSync(new URL(".", f), { recursive: true }); fs.writeFileSync(f, body); };
const KIND = { data_breach: "data breach", privacy_tracking: "privacy (tracking)" };

const CSS = `:root{--bg:#f7f6f2;--card:#fff;--ink:#1b1b19;--mute:#5d5b55;--line:#e3e0d8;--accent:#0f5b3a;--accent-ink:#fff;--soon:#a3410b;--chip:#efece4;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#151513;--card:#1e1e1b;--ink:#efede7;--mute:#a7a49b;--line:#34322d;--accent:#5fc493;--accent-ink:#0d1f16;--soon:#f0a36b;--chip:#2a2925;color-scheme:dark}}
:root[data-theme=dark]{--bg:#151513;--card:#1e1e1b;--ink:#efede7;--mute:#a7a49b;--line:#34322d;--accent:#5fc493;--accent-ink:#0d1f16;--soon:#f0a36b;--chip:#2a2925;color-scheme:dark}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}a{color:var(--accent)}
header.top{padding-block:14px;border-bottom:1px solid var(--line)}header.top .wrap{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.brand{font-weight:800;letter-spacing:-.01em;text-decoration:none;color:var(--ink)}.indep{font-size:12px;color:var(--mute)}
h1{font-size:clamp(26px,6.4vw,38px);line-height:1.12;letter-spacing:-.02em;margin:22px 0 10px}h2{font-size:19px;margin:30px 0 8px}
.lede{color:var(--mute);margin:0 0 16px;font-size:17px}
.stats{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--mute);margin:0 0 14px}.stats b{color:var(--ink);font-size:20px}
input[type=search]{width:100%;font-size:17px;padding:13px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink)}
input[type=search]:focus{outline:none;border-color:var(--accent)}
.miss{margin:10px 0 0;padding:12px 14px;border-radius:12px;background:var(--chip);font-size:15px}.miss[hidden]{display:none}
ul.list{list-style:none;padding:0;margin:14px 0 0}
.row{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:0 0 10px;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;padding:12px 14px}
.row .main{flex:1 1 260px;text-decoration:none;color:var(--ink);display:grid;gap:2px;min-width:0}
.co{font-weight:700;font-size:17px;overflow-wrap:anywhere}.due{font-size:14px;color:var(--mute)}.due b{color:var(--ink)}.soon .due b{color:var(--soon)}
.pay{font-size:14px}.aka{font-size:13px;color:var(--mute)}.chip{display:inline-block;font-size:12px;background:var(--chip);border-radius:999px;padding:1px 8px;margin-left:4px;color:var(--mute)}
.off{font-size:14px;white-space:nowrap;padding:10px 0 10px 4px}
.big{font-size:clamp(22px,5.4vw,28px);font-weight:800;margin:4px 0}
.btn{display:block;text-align:center;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:700;font-size:18px;padding:15px 18px;border-radius:12px;margin:14px 0 4px}
.sub{font-size:13px;color:var(--mute);text-align:center;margin:0 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:12px 0}
.q{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:6px 0}.q>span:first-child{flex:1 1 200px;font-size:15px}
.seg{display:inline-flex;border:1.5px solid var(--line);border-radius:10px;overflow:hidden}.seg button{font:inherit;font-size:15px;border:0;background:transparent;color:var(--ink);padding:9px 16px;min-width:56px;cursor:pointer}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink)}
ol.steps{padding-left:22px;margin:10px 0 0}ol.steps li{margin:0 0 8px;overflow-wrap:anywhere}
blockquote{margin:8px 0;padding:10px 14px;border-left:3px solid var(--accent);background:var(--card);border-radius:0 10px 10px 0;font-size:15px}
.benefit{margin:0 0 12px}.benefit b{display:block}details{font-size:14px;color:var(--mute)}summary{cursor:pointer}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;font-size:15px;margin:8px 0}dl.facts dt{color:var(--mute)}dl.facts dd{margin:0;overflow-wrap:anywhere}
footer{margin:36px 0 0;padding:18px 0 40px;border-top:1px solid var(--line);font-size:13px;color:var(--mute)}footer p{margin:0 0 8px}
.passed{opacity:.7}code{font-size:14px;background:var(--chip);padding:1px 5px;border-radius:5px;overflow-wrap:anywhere}
pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;overflow-x:auto;font-size:14px}`;

const VA = `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script>`;
// Keeps ?src=mcp on every later event of the visit, and counts clicks through to an official site.
const TRACK = `<script>(function(){var u=new URLSearchParams(location.search),src=u.get("src");if(src&&window.posthog)posthog.register({src:src});
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-claim]");if(!a)return;var p={slug:a.getAttribute("data-claim"),where:a.getAttribute("data-where")||"",src:src||""};
try{window.posthog&&posthog.capture("claim_site_click",p)}catch(x){}try{window.va&&va("event",{name:"claim_site_click",data:p})}catch(x){}});})();</script>`;

function page({ title, desc, path, body, jsonld }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}"><meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
${VA}
${POSTHOG}
</head><body>
<header class="top"><div class="wrap"><a class="brand" href="/">Breach to Claim</a><span class="indep">Independent. Not the court, the lawyers or the administrator.</span></div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">
<p>Every fact here is read from the settlement's official, court-authorized website, linked on each page with the date it was read. Not legal advice. We never ask for your Social Security number or the code on your notice, and we never file a claim: you file and sign it on the official site.</p>
<p><a href="/">All open settlements</a> · <a href="/connect/">Use it in Claude or ChatGPT</a> · <a href="/privacy/">Privacy</a> · <a href="${GITHUB}">Source</a></p>
</div></footer>
${TRACK}
</body></html>`;
}

function payLine(s) {
  const parts = [];
  if (s.max_cash_usd) parts.push(`Up to <b>${money(s.max_cash_usd)}</b>`);
  const cash = s.benefits.find((b) => (b.type === "cash_payment" || b.type === "statutory_subclass_payment") && !b.needs_documents);
  if (cash && cash.max_usd && cash.max_usd !== s.max_cash_usd) parts.push(`${money(cash.max_usd)} with no receipts`);
  else if (noDocsOption(s) && !cash) parts.push("an option with no receipts");
  else if (cash && !cash.max_usd) parts.push("cash with no receipts");
  if (!parts.length && s.benefits.some((b) => b.type === "credit_monitoring")) parts.push("Credit monitoring");
  return parts.join(" · ") || "See the official site";
}

function row(s, today) {
  const st = statusOf(s, today), d = s.deadlines.claim?.date;
  const names = [s.name, s.defendant, ...(s.aliases || [])].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const aka = (s.aliases || []).filter((a) => !s.name.toLowerCase().includes(a.toLowerCase()))[0];
  return `<li class="row${st.days_left != null && st.days_left <= 7 ? " soon" : ""}" data-name="${esc(names)}" data-deadline="${d || ""}">
<a class="main" href="/s/${s.slug}/"><span class="co">${esc(s.name)}${s.kind === "privacy_tracking" ? '<span class="chip">privacy</span>' : ""}${s.notice_id_required ? '<span class="chip">needs code from letter</span>' : ""}</span>
${aka ? `<span class="aka">also ${esc(aka)}</span>` : ""}<span class="due">File by ${fmt(d)} · <b class="left">${st.days_left === 0 ? "today" : st.days_left + " days"}</b></span><span class="pay">${payLine(s)}</span></a>
<a class="off" href="${esc(s.claim_url || s.official_site)}" data-claim="${s.slug}" data-where="list" rel="nofollow noopener" target="_blank">Official site ↗</a></li>`;
}

function indexPage(data, today) {
  const open = openSettlements(data, today), sm = summary(data, today);
  const stamp = data.generated_at.slice(0, 16).replace("T", " ") + " UTC";
  const body = `<h1>Were you in a data breach? See if a settlement owes you money.</h1>
<p class="lede">Every open data-breach settlement we can find, soonest deadline first, with what it pays and the official place to claim.</p>
<p class="stats"><span><b>${sm.open}</b> open settlements</span><span><b>${sm.closing_in_30_days}</b> close in 30 days</span><span><b>${sm.closing_in_7_days}</b> this week</span></p>
<input type="search" id="q" placeholder="Company on your breach letter" aria-label="Company on your breach letter" autocomplete="off" enterkeyhint="search">
<div class="miss" id="miss" hidden></div>
<ul class="list" id="list">${open.map((s) => row(s, today)).join("\n")}</ul>
<p class="sub">Each official site read ${stamp}. Sources and method: <a href="/llms-full.txt">llms-full.txt</a> · <a href="/settlements.json">settlements.json</a></p>
<script>(function(){var q=document.getElementById("q"),rows=[].slice.call(document.querySelectorAll("#list .row")),miss=document.getElementById("miss"),t;
var today=new Date();today=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
rows.forEach(function(r){var d=r.getAttribute("data-deadline");if(!d)return;var left=Math.round((Date.parse(d+"T00:00:00Z")-today)/864e5);if(left<0){r.remove();return;}r.querySelector(".left").textContent=left===0?"today":left+" days";});
function words(s){return s.toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(/\\s+/).filter(function(w){return w.length>1&&["inc","llc","the","of","and","data","breach","settlement","letter","from","my"].indexOf(w)<0;});}
function run(){var w=words(q.value),n=0;rows.forEach(function(r){var name=r.getAttribute("data-name"),hit=!w.length||w.every(function(x){return name.indexOf(x)>=0;});r.hidden=!hit;if(hit)n++;});
miss.hidden=true;if(n||q.value.trim().length<3)return;clearTimeout(t);t=setTimeout(function(){fetch("/api/search?q="+encodeURIComponent(q.value.trim())).then(function(r){return r.json();}).then(function(d){
var h="<b>No open settlement under that name.</b> ";if(d.settlements.length){h+=d.settlements.map(function(s){return '<a href="/s/'+s.slug+'/">'+s.company+"</a>: claim deadline "+s.claim_deadline+" ("+s.status+")";}).join("; ")+". ";}
if(d.notices.length){var x=d.notices[0];h+=x.organization+" reported a breach to the "+x.reported_to+" on "+x.reported_at+' (<a href="'+x.source+'" rel="nofollow noopener" target="_blank">record</a>). Nothing to claim yet: keep the letter and any receipts.';}
else if(!d.settlements.length){h+="Check the exact name on the letter, or a parent company.";}miss.innerHTML=h;miss.hidden=false;}).catch(function(){});},350);}
q.addEventListener("input",run);})();</script>`;
  return page({ title: "Data breach settlements open now: deadlines, payouts, how to claim | Breach to Claim", desc: `${sm.open} open data-breach class-action settlements, soonest claim deadline first, each read off its official settlement website: what it pays, who qualifies, and where to file.`, path: "/", body });
}

function settlementPage(s, data, today) {
  const st = statusOf(s, today), d = s.deadlines.claim?.date, open = st.status === "open";
  const claim = s.claim_url || s.official_site;
  const rec = { benefits: s.benefits.map(({ quote, ...b }) => b), deadlines: { claim: s.deadlines.claim ? { date: d } : null }, notice_id_required: s.notice_id_required, contact: s.contact, claim_url: s.claim_url, official_site: s.official_site, losses_from: s.losses_from };
  const benefits = s.benefits.filter((b) => b.type !== "business_changes").map((b) => `<div class="benefit"><b>${esc(b.summary)}</b><details><summary>Official wording</summary>“${esc(b.quote)}”</details></div>`).join("");
  const dates = [["Claim deadline", s.deadlines.claim], ["Opt out by", s.deadlines.opt_out], ["Object by", s.deadlines.objection], ["Final approval hearing", s.deadlines.final_approval_hearing]].filter(([, v]) => v && v.date).map(([k, v]) => `<dt>${k}</dt><dd>${fmt(v.date)}</dd>`).join("");
  const title = `${s.name} ${s.kind === "privacy_tracking" ? "privacy" : "data breach"} settlement: ${open ? "claim by " + fmt(d) : d ? "deadline passed" : "how to claim"}${s.max_cash_usd ? ", up to " + money(s.max_cash_usd) : ""}`;
  const body = `<p style="margin:14px 0 0"><a href="/">← All open settlements</a></p>
<h1>${esc(s.name)} ${s.kind === "privacy_tracking" ? "privacy" : "data breach"} settlement</h1>
${open ? `<p class="big">File by ${fmt(d)}</p><p class="due" style="margin:0"><b class="left" data-deadline="${d}">${st.days_left} days left</b></p>` : d ? `<p class="big">The claim deadline (${fmt(d)}) has passed.</p>` : `<p class="big">Deadline: on the official site</p><p class="due" style="margin:0">The pages we read did not print a claim deadline.</p>`}
<p class="pay" style="margin:8px 0 0">${payLine(s)}</p>${s.stale ? `<p class="miss">${esc(s.stale)}</p>` : ""}
<a class="btn" href="${esc(claim)}" data-claim="${s.slug}" data-where="page" rel="nofollow noopener" target="_blank">${open || !d ? "File on the official site ↗" : "Open the official site ↗"}</a>
<p class="sub">${esc(host(claim))} · the court-authorized settlement website</p>
${open || !d ? `<h2>Your checklist</h2><div class="card">
<div class="q"><span>Did you get a letter or email about this breach or settlement?</span><span class="seg" data-k="n"><button type="button" data-v="1">Yes</button><button type="button" data-v="0">No</button></span></div>
<div class="q"><span>Did the breach cost you money or time (fraud, fees, hours)?</span><span class="seg" data-k="l"><button type="button" data-v="1">Yes</button><button type="button" data-v="0">No</button></span></div>
<ol class="steps" id="steps">${checklist(s, {}).map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>` : ""}
<h2>Who's in it</h2>${s.class_definition ? `<blockquote>${esc(s.class_definition)}</blockquote><p class="sub" style="text-align:left">From the official site. You decide whether it describes you.</p>` : "<p>The official site states who is in the class.</p>"}
${s.subclasses.map((x) => `<p><b>${esc(x.name)}</b></p><blockquote>${esc(x.definition)}</blockquote>`).join("")}
${s.notice_id_quote ? `<p><b>Letter code:</b> “${esc(s.notice_id_quote)}”</p>` : ""}
<h2>What it pays</h2>${benefits || "<p>See the official site.</p>"}
${s.fund_total_usd ? `<p>Total fund: ${money(s.fund_total_usd)}${s.class_size ? ` for about ${s.class_size.toLocaleString("en-US")} people` : ""}.</p>` : s.class_size ? `<p>About ${s.class_size.toLocaleString("en-US")} people are in the class.</p>` : ""}
<h2>What happened</h2>${s.incident.quote ? `<blockquote>${esc(s.incident.quote)}</blockquote>` : ""}${s.incident.data_exposed.length ? `<p>Data involved: ${esc(s.incident.data_exposed.join(", "))}.</p>` : ""}
<h2>Is this real?</h2><dl class="facts">
<dt>Defendant</dt><dd>${esc(s.defendant)}${s.aliases.length ? " (also " + esc(s.aliases.join(", ")) + ")" : ""}</dd>
${s.case_name ? `<dt>Case</dt><dd>${esc(s.case_name)}</dd>` : ""}${s.case_number ? `<dt>Number</dt><dd>${esc(s.case_number)}</dd>` : ""}${s.court ? `<dt>Court</dt><dd>${esc(s.court)}</dd>` : ""}
${s.administrator ? `<dt>Administrator</dt><dd>${esc(s.administrator)}</dd>` : ""}<dt>Official site</dt><dd><a href="${esc(s.official_site)}" data-claim="${s.slug}" data-where="facts" rel="nofollow noopener" target="_blank">${esc(host(s.official_site))}</a></dd>
${s.contact ? `<dt>Questions</dt><dd>${esc(s.contact)}</dd>` : ""}${dates}</dl>
<p class="sub" style="text-align:left">Read from ${s.sources.map((u) => `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(host(u) + new URL(u).pathname)}</a>`).join(", ")} on ${fmt((s.verified_at || "").slice(0, 10))}. The official site is the last word: if anything here differs, it wins.</p>
${open || !d ? `<script>(function(){var S=${JSON.stringify(rec).replace(/</g, "\\u003c")};${CHECKLIST_SRC}
var u=new URLSearchParams(location.search),a={};function b(v){return v==="1"?true:v==="0"?false:undefined;}a.got_notice_letter=b(u.get("n"));a.had_out_of_pocket_losses=b(u.get("l"));
var steps=document.getElementById("steps"),keys={n:"got_notice_letter",l:"had_out_of_pocket_losses"};
function draw(){[].forEach.call(document.querySelectorAll(".seg"),function(g){var v=a[keys[g.getAttribute("data-k")]];[].forEach.call(g.children,function(x){x.setAttribute("aria-pressed",String(v===(x.getAttribute("data-v")==="1")&&v!==undefined));});});
steps.innerHTML="";checklist(S,a).forEach(function(t){var li=document.createElement("li");li.textContent=t;steps.appendChild(li);});}
document.addEventListener("click",function(e){var x=e.target.closest&&e.target.closest(".seg button");if(!x)return;var k=keys[x.parentNode.getAttribute("data-k")];a[k]=x.getAttribute("data-v")==="1";draw();try{window.posthog&&posthog.capture("checklist_answer",{slug:"${s.slug}",q:k})}catch(z){}});
var el=document.querySelector(".left[data-deadline]");if(el){var t=new Date();t=Date.UTC(t.getFullYear(),t.getMonth(),t.getDate());var left=Math.round((Date.parse(el.getAttribute("data-deadline")+"T00:00:00Z")-t)/864e5);el.textContent=left<0?"The deadline has passed":left===0?"Last day: today":left+" days left";}
draw();})();</script>` : ""}`;
  const jsonld = { "@context": "https://schema.org", "@type": "Event", name: `${s.name} class action settlement claim deadline`, startDate: d, endDate: d, eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled", location: { "@type": "VirtualLocation", url: s.official_site }, description: s.class_definition || undefined, url: `${SITE}/s/${s.slug}/` };
  return page({ title, desc: `${s.name} settlement: ${open ? "file by " + fmt(d) : d ? "claim deadline passed" : "deadline on the official site"}. ${payLine(s).replace(/<[^>]+>/g, "")}. Who qualifies, what you need, and the official claim site.`, path: `/s/${s.slug}/`, body, jsonld: d ? jsonld : null });
}

function connectPage() {
  const body = `<h1>Ask Claude or ChatGPT: am I owed money from a data breach?</h1>
<p class="lede">Add Breach to Claim as a connector and your assistant can check any company against every open settlement, read you the class definition, and hand you a link to your checklist and the official claim site.</p>
<h2>Server URL</h2><pre>${SITE}/mcp</pre>
<p>Streamable HTTP. No account, no key, nothing to sign in to. Three read-only tools: <code>find_breach_settlement</code>, <code>list_open_breach_settlements</code>, <code>breach_settlement_details</code>.</p>
<h2>Claude</h2><p>Settings → Connectors → Add custom connector → paste the URL above.</p>
<h2>ChatGPT</h2><p>Settings → Apps &amp; Connectors → Advanced → Developer mode → Create → paste the URL above, authentication: none.</p>
<h2>Then ask</h2><p>“I got a letter saying my data was in the DaVita breach. Am I owed anything?”</p>
<p>The connector never asks for your Social Security number, the code on your letter, or your name, and it never files a claim. <a href="/privacy/">Privacy</a>.</p>`;
  return page({ title: "Breach to Claim connector for Claude and ChatGPT (MCP)", desc: "Add the Breach to Claim MCP server to Claude or ChatGPT: ask whether a data-breach settlement owes you money and get the deadline, the payout and the official claim site.", path: "/connect/", body });
}

function privacyPage() {
  const body = `<h1>Privacy</h1>
<p>Breach to Claim needs nothing about you. It never asks for your Social Security number, the code or ID on your notice, a claim ID, your name or your address, and it never files a claim.</p>
<p><b>The connector.</b> A company name you ask about is matched against the settlement list and not stored. We log one event per call: which tool, whether it worked, how long it took and how many settlements matched. We do not log what was asked.</p>
<p><b>This website.</b> We count visits with Vercel Web Analytics and PostHog: pages viewed, clicks through to an official site, and whether a visit came from the connector (<code>src=mcp</code> in the link). Links carry the settlement and, at most, two yes/no answers (got a letter, had costs), never anything that identifies you.</p>
<p><b>Claims.</b> Filed only on each settlement's official website, run by the court-appointed administrator. Their privacy policy covers what you type there.</p>
<p>Questions: open an issue at <a href="${GITHUB}/issues">${GITHUB.replace("https://", "")}/issues</a>.</p>`;
  return page({ title: "Privacy | Breach to Claim", desc: "Breach to Claim never asks for your SSN, notice code or name, never files a claim, and logs no queries.", path: "/privacy/", body });
}

function llms(data, today, full) {
  const open = openSettlements(data, today), sm = summary(data, today);
  const head = `# Breach to Claim

> Open class-action data-breach and privacy settlements in the US, each read off its official court-authorized settlement website: claim deadline, what it pays, who is in the class, and where to file. Independent; not legal advice. Updated ${data.generated_at}.

- ${sm.open} settlements open for claims; ${sm.closing_in_30_days} close within 30 days, ${sm.closing_in_7_days} within 7.
- MCP server (Streamable HTTP, no auth): ${SITE}/mcp — tools find_breach_settlement, list_open_breach_settlements, breach_settlement_details.
- Full list as JSON: ${SITE}/settlements.json
- Each settlement page: ${SITE}/s/<slug>/
`;
  if (!full) return head + `\n## Settlements\n\n${open.map((s) => `- [${s.name}](${SITE}/s/${s.slug}/): claim by ${s.deadlines.claim.date}${s.max_cash_usd ? ", up to " + money(s.max_cash_usd) : ""}`).join("\n")}\n\n## Optional\n\n- [Full text of every settlement](${SITE}/llms-full.txt)\n`;
  return head + "\n" + open.map((s) => `## ${s.name} (${KIND[s.kind]})

- Claim deadline: ${s.deadlines.claim.date} (${statusOf(s, today).days_left} days left on ${today})
- Pays: ${s.benefits.map((b) => b.summary).join(" | ")}
- Most cash: ${money(s.max_cash_usd) || "not stated"}; option without receipts: ${noDocsOption(s) ? "yes" : "no"}
- Needs the code on the notice: ${s.notice_id_required ? "yes" : "not stated"}
- Who is in the class: ${s.class_definition || "see official site"}
- Case: ${[s.case_name, s.case_number, s.court].filter(Boolean).join(", ")}
- Administrator: ${s.administrator || "not stated"}
- Official site: ${s.official_site} ; claim form: ${s.claim_url || s.official_site}
- Read from: ${s.sources.join(", ")} on ${(s.verified_at || "").slice(0, 10)}
- Page: ${SITE}/s/${s.slug}/
`).join("\n");
}

export function build({ log = console.log } = {}) {
  const data = loadData(), today = new Date().toISOString().slice(0, 10);
  fs.rmSync(new URL("s/", ROOT), { recursive: true, force: true });
  write("style.css", CSS);
  write("favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0f5b3a"/><path d="M18 33l9 9 19-20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
  write("index.html", indexPage(data, today));
  for (const s of data.settlements) write(`s/${s.slug}/index.html`, settlementPage(s, data, today));
  write("connect/index.html", connectPage());
  write("privacy/index.html", privacyPage());
  write("llms.txt", llms(data, today, false));
  write("llms-full.txt", llms(data, today, true));
  const open = openSettlements(data, today);
  write("settlements.json", JSON.stringify({ generated_at: data.generated_at, method: `${SITE}/llms.txt`, settlements: open.map(({ official_site_key, page_hash, read_via, unverified, ...s }) => s) }, null, 1));
  const urls = ["/", "/connect/", "/privacy/", ...data.settlements.map((s) => `/s/${s.slug}/`)];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${data.generated_at.slice(0, 10)}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
  log(`built ${data.settlements.length} settlement pages (${open.length} open) + index, connect, privacy, llms, sitemap`);
  return urls;
}

if (import.meta.url === `file://${process.argv[1]}`) build();
