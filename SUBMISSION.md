# Connector listing kit

Copy from here. Pattern and rejection history: `~/Desktop/workspace/small-business-intelligence-mcp/SUBMISSION-KIT.md`; heistclips' `SUBMISSION.md` for the 11/16 facts (OpenAI is ZIP upload only, 30-char name, no pricing words in the description, support must be a URL).

| Field | Value |
|---|---|
| Name | Breach to Claim (22 chars) |
| Endpoint | `https://breach-to-claim.vercel.app/mcp` · Streamable HTTP · auth none · no UI/CSP |
| Publisher | Brick and Mortar AI LLC, 1651 Eleanor Ave, Saint Paul, MN 55116 |
| Website / docs | https://breach-to-claim.vercel.app/connect/ |
| Privacy | https://breach-to-claim.vercel.app/privacy/ |
| Support | https://github.com/2016judea/breach-to-claim/issues |
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

## What needs Aidan (clicks only)
1. **Claude directory**: submit the connector form with the fields above (Anthropic's MCP directory submission). Not pressed.
2. **ChatGPT**: platform.openai.com → Apps → new app, ZIP upload per heistclips' `SUBMISSION.md`, signed in as him. Not pressed.
3. **MCP Registry** (`io.github.2016judea/breach-to-claim`): `mcp-publisher login github` then `mcp-publisher publish` with a `server.json` like heistclips'. Not pressed.
4. **Optional, costs money:** add the `ANTHROPIC_API_KEY` repo secret so the daily run reads new settlements (at most 5 sites a day at ~$0.06 each, so at most ~$9 a month; new settlements open at roughly one a day). Without it the run re-checks every stored deadline against the live official site for free, and new settlements wait.
5. **Optional, costs money:** a domain.
