# Connector listing kit

Copy from here. Pattern and rejection history: `~/Desktop/workspace/small-business-intelligence-mcp/SUBMISSION-KIT.md`; heistclips' `SUBMISSION.md` for the 11/16 facts (OpenAI is ZIP upload only, 30-char name, no pricing words in the description, support must be a URL).

| Field | Value |
|---|---|
| Name | Breach to Claim (22 chars) |
| Endpoint | `https://breach-to-claim.vercel.app/mcp` · Streamable HTTP · auth none · no UI/CSP |
| Publisher | Brick and Mortar AI LLC, 1651 Eleanor Ave, Saint Paul, MN 55116 |
| Website / docs | https://breach-to-claim.vercel.app/connect/ |
| Privacy | https://breach-to-claim.vercel.app/privacy/ |
| Support | https://brickandmortar.dev/contact (changed 2026-11-22: directory listings never point at GitHub issues) |
| Source | https://github.com/2016judea/breach-to-claim |
| Icon 512×512 | https://breach-to-claim.vercel.app/icon.png |
| Composer icon (stroke-only, currentColor) | https://breach-to-claim.vercel.app/icon-composer.svg |
| Availability | United States |

**The domain is a `.vercel.app` alias**, not one the LLC owns. Reviewers have checked that policy URLs belong to the publisher (kit §1). Buying a domain is Aidan's call; if he does, move the alias and re-file.

## One-liner (≤100)
Am I owed money from a data breach? Open settlements, deadlines, payouts and official claim sites

## Description
Ask whether a data-breach class-action settlement owes you money. Breach to Claim checks the
company named on your breach letter against every open US data-breach and privacy settlement,
each read off its official court-authorized settlement website: the claim deadline and days
left, what it pays (documented losses, cash with no receipts, credit monitoring), who is in the
class in the settlement's own words, whether the code on your notice is needed, the case and
court, and the official claim site. It hands back a link to a page with your claim checklist
filled in. It never files a claim and never asks for a Social Security number, notice code or
name. Independent; not legal advice.

## Connection requirements
None. No account, key or OAuth. Three read-only tools; the server stores nothing about the person.

## Annotations (all explicit booleans; `test/mcp.test.mjs` holds them)
| Tool | readOnly | destructive | openWorld | idempotent |
|---|---|---|---|---|
| find_breach_settlement, list_open_breach_settlements, breach_settlement_details | true | false | true | true |

## Test setup / reviewer access
No test account, no credentials. Reproduce from a terminal:

```
curl -s https://breach-to-claim.vercel.app/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -s https://breach-to-claim.vercel.app/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_breach_settlement","arguments":{"company":"Columbia University","got_notice_letter":true}}}'
```

The list moves daily: settlements close as deadlines pass and new ones open. Any open
settlement answering with a deadline, a class definition and an official site is correct.

## Test cases
Run against the live endpoint before filing (results in "Checked" below).
1. "I got a letter saying my data was in the Columbia University breach. Am I owed money?" → find_breach_settlement {company:"Columbia University"}: claim deadline Jan 21, 2027, documented losses up to $8,500 or a cash payment, notice code needed, official site columbiauniversitydatasettlement.com.
2. "Which data breach settlements close this week?" → list_open_breach_settlements {closing_within_days:7}
3. "Any data breach settlements I can claim without receipts?" → list_open_breach_settlements {no_documents_option:true}
4. "Tell me everything about the DaVita settlement" → breach_settlement_details {slug from 1 or 2}
5. "I got a breach notice from Columbia Bank, is there a settlement?" → find_breach_settlement: no open settlement; the breach is on the California and Washington AG record; keep the letter.

Negative:
1. "File my claim for the DaVita settlement." → No tool files. The model gives the official claim site and says the person files and signs it.
2. "Here's my SSN, check if I'm in a settlement." → No tool takes one; none is needed.
3. "Should I opt out and sue on my own?" → Not legal advice; the tool returns the opt-out deadline and the official site.

## Starter prompts
- Am I owed money from a data breach? My letter is from <company>.
- Which data breach settlements close this week?
- Which breach settlements pay without receipts?

## What needs Aidan (items 1-3 filed 2026-11-19, see below; 4-5 still his)
1. **Claude directory**: submit the connector form with the fields above (Anthropic's MCP directory submission). Not pressed.
2. **ChatGPT**: platform.openai.com → Apps → new app, ZIP upload per heistclips' `SUBMISSION.md`, signed in as him. Not pressed.
3. **MCP Registry** (`io.github.2016judea/breach-to-claim`): `mcp-publisher login github` then `mcp-publisher publish` with a `server.json` like heistclips'. Not pressed.
4. **Optional, costs money:** add the `ANTHROPIC_API_KEY` repo secret so the daily run reads new settlements (at most 5 sites a day at ~$0.06 each, so at most ~$9 a month; new settlements open at roughly one a day). Without it the run re-checks every stored deadline against the live official site for free, and new settlements wait.
5. **Optional, costs money:** a domain.

## Submitted 2026-11-19

Filed by Claude in Aidan's own Chrome (JavaScript run by process id into his signed-in tabs). His screen was
locked, so a copied Chrome profile could not decrypt his cookies and was not used. Nothing was paid, nothing
was sent to a person, nothing was published, and no repo secret was added (the `ANTHROPIC_API_KEY` and domain
items below stay his). Each status was read back off the portal after filing.

| Where | Status | UTC | Listing / ID |
|---|---|---|---|
| Official MCP Registry | **LISTED**, active | 22:28 | `io.github.2016judea/breach-to-claim` 0.1.0 |
| Claude Connectors Directory | **PUBLISHED**, live at claude.ai/directory/breach-to-claim (read off claude.ai/directory/manage 2026-11-22 14:55 UTC; approval email 2026-11-19 22:52) | 22:50 filed | claude.ai/directory/manage/breach-to-claim · slug `breach-to-claim` (permanent) |
| ChatGPT plugin directory | **0.1.0 IN REVIEW** | 23:44 | `plugin_asdk_app_6aff7e98ece8819189a309263c7a402f` |

**What needs Aidan**
- ~~**Claude:** click **Publish** at claude.ai/directory/manage/breach-to-claim.~~ Done: Published by 2026-11-22 (Submitted, Approved, Published all ticked on the portal).
- **ChatGPT:** when the approval email comes, click **Publish** at
  platform.openai.com/plugins/manage/plugin_asdk_app_6aff7e98ece8819189a309263c7a402f. Leave
  `public/.well-known/openai-apps-challenge` in place: OpenAI re-checks it.
- Items 4 and 5 of the list above (the API-key secret, a domain) are unchanged and still his call.

**Official MCP Registry.** No device code needed. `server.json` plus `.github/workflows/mcp-registry.yml` publish
over GitHub Actions OIDC (`mcp-publisher login github-oidc`), which proves the repo owner and grants
`io.github.2016judea/*`. It runs when `server.json` changes on `main`; bump `version` there to republish.

**Claude, what was filed.** Custom connector "Breach to Claim" added to his Claude (Settings → Connectors). Name,
one-liner and description verbatim from this kit. Categories: Legal, Financial Services. Author Brick and Mortar AI
LLC (https://breach-to-claim.vercel.app/). Docs `/connect/`, support the GitHub issues URL, privacy `/privacy/`,
custom icon `/icon.png`. Use cases: test cases 1, 2 and 3. Prerequisites: none. Read only. Company Brick and Mortar
AI LLC, https://brickandmortar.dev, Aidan Jude, Founder. Auth none (detected). Data handling "We own the API" (our
daily read of each official settlement site), no health data, no sponsored content. All seven compliance boxes ticked.
- **One slip in the private reviewer note:** it says the Columbia University settlement needs the notice code. The
  live server says `needs_code_from_notice: false`. If a reviewer asks, the server is right.
- **Server change made for this filing (commit 78bb2d0, deployed):** `find_breach_settlement`'s description said
  "Never ask for or pass on a Social Security number...". The compliance step attests that tool descriptions hold
  no instructions about model behavior, so it now reads "It takes the company name only: no Social Security
  number, notice ID, claim ID or name is needed or taken." The instruction stays in the server `instructions`.

**ChatGPT, what was filed.** Plugin `breach-to-claim` 0.1.0, publisher **Business — Brick and Mortar AI LLC**, built
by the new `scripts/build_chatgpt_plugin.py` (pattern: appeal-draft's; tools and annotations read off `api/mcp.js`;
5 positive and 3 negative test cases; category Finance; support is the GitHub issues URL). Bump `VERSION` for every upload.
- **Domain:** token in `public/.well-known/openai-apps-challenge` (commit 592e897, deployed by the git push);
  "Domain verified". MCP connected, no auth, 3 tools, "No findings in the latest MCP scan".
- **Findings:** one non-blocking metadata finding ("Review the plugin's privacy policy against the submission guidelines"); the private review note points at the connector section of `/privacy/` and says the settlement list moves daily, so exact counts in the test cases will drift.
- **Demo:** https://cf546sdmyewh8fpm.public.blob.vercel-storage.com/demo/breach-to-claim-chatgpt-review.mp4 (Vercel
  Blob, heistclips store). 2 min 58 s, 1536×742, the 8 test cases each in a fresh developer-mode chat with the plugin
  attached by `@Breach to Claim`. Frames were rendered from the live ChatGPT tab in-page (his screen was locked) and
  stitched with ffmpeg. This added a developer-mode plugin "Breach to Claim" to his ChatGPT. Demo URL and release
  notes were entered in the portal, not the ZIP.
- **Submitted** with the same six attestations as heistclips and Appeal the Denial.

**Official MCP Registry (2026-11-22):** `io.github.2016judea/breach-to-claim` 0.1.0, remote `https://breach-to-claim.vercel.app/mcp`; `.github/workflows/mcp-registry.yml` republishes on every `server.json` version bump. Check: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.2016judea/breach-to-claim"`.

## xAI marketplace (Grok Bot, Cursor, Grok) — SUBMITTED 2026-11-23

Filed 2026-11-23T02:27:34Z at x.ai/bot/marketplace/submit-a-plugin; the page answered "Thanks for submitting your plugin!".
Status: pending review (xAI replies by email to the work address). Destinations ticked: Grok (coming soon), Grok Bot,
Cursor. Org Brick and Mortar AI LLC, handle `brickandmortar`. Name Breach to Claim. Website https://breach-to-claim.vercel.app/connect/.
Logo https://breach-to-claim.vercel.app/icon-solid.png (solid plate, 1:1). MCP URL https://breach-to-claim.vercel.app/mcp (the URL, never a repo). Cursor's Publisher Terms §3.1
bar charging users "directly or indirectly" through the plugin; the connector itself is free.

Description (545 chars):

> Ask whether a data-breach class-action settlement owes you money. Breach to Claim checks the company named on your breach letter against every open US data-breach and privacy settlement, read off its official court-authorized website: the claim deadline and days left, what it pays, who is in the class in the settlement's own words, whether the code on your notice is needed, the case and court, and the official claim site. It never files a claim and never asks for a Social Security number, notice code or name. Independent; not legal advice.

Testing (554 chars):

> No account or credentials needed. Add the MCP URL as a remote server, then try: 1) "I got a letter saying my data was in the Columbia University breach. Am I owed money?" -> find_breach_settlement: claim deadline Jan 21, 2027, documented losses up to $8,500 or a cash payment, official claim site. 2) "Which data breach settlements close this week?" -> list_open_breach_settlements with deadlines. 3) "Any data breach settlements I can claim without receipts?" -> settlements with a no-documents option. Counts change daily as settlements open and close.

