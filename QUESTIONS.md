# Questions people bring, and the tool that answers each

Per `~/.claude/CLAUDE.md`, *Every question theme gets a tool* (2026-11-22). Counts are PostHog
`mcp_tool_call`, `site = breach-to-claim`, all time to 2026-11-22: 54 calls, the directory filing's
own test runs included (`client = script`), so they rank themes rather than prove demand. Themes
with no call on record are marked **inferred**: they come from what a person with a breach letter
asks a chatbot, not from our logs.

## From the logs

| theme | user's words | calls | tool |
|---|---|---|---|
| what's open now / closing soon | "what settlements can I claim", "which close this week" | 18 (5 returned exactly 10, a closing-window filter) | `list_open_breach_settlements` |
| am I owed money from X | "I got a breach letter from X" | 19 (13 found no open match) | `find_breach_settlement` |
| one settlement in full | "tell me more about the DaVita one" | 9 (6 with no usable slug) | `breach_settlement_details` |
| a tool that doesn't exist | (not recorded) | 8 | none |

Two readings: 13 of 19 company lookups found nothing open, so the "no settlement yet" answer (breach
notices on record, keep the letter) is the most-seen answer this connector gives. And 8 calls
reached for a tool name we don't have. Until 2026-11-22 those were logged only as `unknown`.
**Now logged:** `attempted`, the name the caller tried (letters, digits, `_.-`, 60 characters).
Read it before the next pass: it is the cheapest list of missing doors there is.

## Theme doors (shipped 2026-11-22)

| theme | user's words | tool | engine | basis |
|---|---|---|---|---|
| closing soon | "settlements closing this week" | `settlements_closing_soon` | list, deadline window (default 14 days) | logs |
| no proof needed | "settlements with no receipts required" | `breach_settlements_no_proof_needed` | list, no-documents cash option (76 of 79 open) | inferred |
| tracking pixels | "Meta Pixel settlements" | `tracking_pixel_privacy_settlements` | list, kind privacy_tracking (10 open) | inferred |
| biggest payouts | "which settlement pays the most" | `biggest_breach_settlement_payouts` | open settlements ranked by stated cash cap (67 state one) | inferred |
| is this letter real | "is this settlement email a scam" | `is_this_settlement_letter_real` | find: official site, administrator, case, AG notices | inferred (the old find description already named it) |
| deadline | "when is the Columbia deadline", "is it too late" | `settlement_claim_deadline` | details: every deadline, days left | inferred |
| how much | "how much will I get from DaVita" | `how_much_will_i_get_from_settlement` | details: each benefit with cap, fund, class size | inferred |
| how to file | "how do I claim", "I lost my notice letter" | `how_to_file_breach_claim` | details: the checklist + claim form | inferred |
| did X have a breach | "was my bank hacked", "did Kaiser have a breach" | `did_company_have_data_breach` | 2,344 CA + WA AG breach notices, plus any settlement | logs (the 13 empty lookups) |

## Gaps left, and why

| theme | user's words | why not yet |
|---|---|---|
| was MY data in it | "was my email in a breach" | needs the person's identifier; we take none, on purpose. Have I Been Pwned answers it |
| state-specific | "settlements for Texas residents" | only 6 open settlements carry a state subclass; breach notices cover CA and WA only |
| payout status | "when will I get paid", "did my claim go through" | lives with the administrator, behind the claim ID we never take; details returns the administrator contact |
| non-breach class actions | "settlements for a product I bought" | outside the data model (DATA_MODEL.md); breach and privacy settlements only |
| closed settlements in depth | "what did the Equifax settlement pay" | closed ones are kept only when a lookup matches them; no door ranks past payouts |
