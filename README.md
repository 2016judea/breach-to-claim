# Breach to Claim

**Live:** https://breach-to-claim.vercel.app

You got a letter saying your data was in a breach. Is a class-action settlement paying people for it, how much, are you in it, and where do you file before the deadline?

Breach to Claim answers that, in a chat or on a phone:

- **The list.** Every open US data-breach (and tracking-pixel privacy) settlement it can find, soonest claim deadline first, with the most cash it pays, whether there is an option with no receipts, and whether the claim needs the code printed on your notice. Updated daily, each row dated.
- **Your checklist.** One page per settlement: the deadline and days left, the class definition read back word for word, what it pays, what to gather, and a button to the official claim site. Two yes/no questions (got a letter? had costs?) tailor the steps.
- **An MCP connector** at `https://breach-to-claim.vercel.app/mcp` for Claude, ChatGPT and any MCP client. Ask "I got a breach notice from DaVita, am I owed anything?" and it finds the settlement, reads you who is in the class, gives the deadline and the money, and hands back a link that opens the checklist already filled in.

It never files a claim (the claim form is signed under penalty of perjury by the person), never asks for a Social Security number, notice ID, claim ID or name, and never puts anything identifying in a URL or in analytics. It is independent: not the court, the lawyers or the settlement administrator. Not legal advice.

## Where every fact comes from

Each settlement is read off its **official, court-authorized settlement website**, the one the court's notice names and the administrator (Angeion, Kroll, Epiq, Simpluris, Apex and others) runs.

1. `scripts/discover.mjs` finds official sites. Public settlement indexes (classaction.org, claimdepot.com) are used only to learn that an official site exists; nothing else is taken from them. Paths read are allowed by their robots.txt. Hand seeds live in `data/seeds.json`.
2. `scripts/read_sites.mjs` reads each official site's home, FAQ and important-dates pages, one visit a second apart. About a third of official sites put a bot wall in front of plain HTTP; a headless browser reads most of those.
3. `scripts/extract.mjs` has Claude fill a form from the page text, **every field as a verbatim quote**. Code keeps a quote only if it is on the page, and code, not the model, turns kept quotes into dates and dollar amounts. Anything that fails is dropped and listed in the record's `unverified`. Only pages whose text changed are sent again. Without a model key the daily run still re-checks every stored deadline quote against the live page in code and flags any that vanished.
4. `scripts/notices.mjs` pulls breach notices from the California AG list and the Washington AG dataset (ported from [breach-to-complaint](https://github.com/2016judea/breach-to-complaint)), so a breach with no settlement yet gets an honest answer: it's on record, nothing to claim yet, keep the letter.
5. `scripts/build.mjs` builds the site, `llms.txt`, `llms-full.txt`, `settlements.json`, the sitemap and the IndexNow key.

`.github/workflows/refresh.yml` runs all of it daily and pings IndexNow. The data model it was built against, and which fields reality can and cannot fill, is in [`DATA_MODEL.md`](DATA_MODEL.md).

## Run it

```bash
npm install
npm test                                   # 10 tests, no network
PLAYWRIGHT_DIR=/path/to/node_modules ANTHROPIC_API_KEY=... npm run refresh
```

The site is static (`public/`) plus two functions: `api/mcp.js` (Streamable HTTP MCP, stateless) and `api/search.js` (the front page's lookup for a name with no open settlement).

## Analytics

Every page loads Vercel Web Analytics and PostHog. Events: `claim_site_click` (a click through to an official site, with the settlement and where on the page), `checklist_answer` (which question, not the answer), and `mcp_tool_call` server-side (tool, ok, duration, match count; never the question). Every link the connector hands out carries `src=mcp`. Claude's connector calls arrive from Anthropic's servers, so `mcp_tool_call` counts calls, not people: **people are counted on the web side, as visitors whose landing URL carries `src=mcp`.**

## Expectation

Written 2026-11-19, before any listing or launch. Read on **2026-12-17**.

- **Base rate.** heistclips' Claude connector sent 151 people to its site in its first four days (11/16 to 11/19), 54% of whom used the tool. The Brick & Mortar business connector, same channel, got zero human calls in seven days. The difference: people already ask an AI the heistclips question. "Am I owed money from the X breach" is asked of AI the same way, and spikes around each claim deadline (on 2026-11-19, 31 of the 82 open settlements close within 30 days, 10 within a week).
- **Expected by 2026-12-17:** 10 people landing from `src=mcp` links, 40 `mcp_tool_call` events from real clients (`client` not `script`; my deploy checks are `script`), and 30% of all landings clicking through to an official site. Directory listings are not live yet and Claude/ChatGPT review takes days to weeks, so most of this window runs on manual installs and search.
- **Would surprise us upward:** 50 or more `src=mcp` people by the read date, meaning the channel works for this question even before a directory listing.
- **Would surprise us downward:** zero `src=mcp` people with a directory listing live for two weeks or more, meaning nobody asks a connector this question; and under 10% click-through to official sites, meaning the page answers without moving anyone to claim.

## Licence

MIT. Facts about each settlement belong to the public record; the repo holds short verification quotes and links to each official site.
