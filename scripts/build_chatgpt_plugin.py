#!/usr/bin/env python3
"""Build the ChatGPT plugin ZIP that platform.openai.com/plugins takes (Agent Plugins format: root
plugin.json with OpenAI fields under extensions.com.openai, mcp.json, assets/). Pattern:
~/Desktop/workspace/appeal-draft/scripts/build_chatgpt_plugin.py and the SBI kit §10.

Tool names and annotations are read off api/mcp.js (the live server's module), never typed here: a
listing that disagrees with the live server is the one rejection cause on record (SBI kit, 2026-10-09).
The long description carries no pricing words; OpenAI's metadata check fails "Free" and prices.

    python3 scripts/build_chatgpt_plugin.py   ->  chatgpt-plugin.zip   (bump VERSION for every upload)
"""
import json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG, OUT = ROOT / "chatgpt-plugin", ROOT / "chatgpt-plugin.zip"
VERSION = "0.1.0"
SITE = "https://breach-to-claim.vercel.app"

DESC = ("Breach to Claim answers \"am I owed money from a data breach, and how do I claim?\" It checks the company named "
        "on a breach letter against every open US data-breach and privacy class-action settlement, each read off its "
        "official court-authorized settlement website: the claim deadline and days left, what it pays (documented losses, "
        "a cash payment with no receipts, credit monitoring), who is in the class in the settlement's own words, whether the "
        "code on the notice letter is needed, the case and court, and the official claim site. It can also list what is open "
        "now, what closes this week and which settlements pay without receipts. Each answer links to a page with the claim "
        "checklist filled in. It never files a claim and never asks for a Social Security number, notice code or name; the "
        "person files and signs on the official site. Independent of the court, the lawyers and the administrator; not "
        "legal advice. All three tools are read-only and need no account.")

POSITIVE = [
    ("Someone with a breach letter asks whether a settlement pays them.",
     "I got a letter saying my data was in the Columbia University breach. Am I owed money?",
     "find_breach_settlement",
     "Finds the open Columbia University settlement: claim deadline Jan 21, 2027 with days left, up to $8,500 for documented losses or a cash payment, the class definition verbatim, the case and court, the official site columbiauniversitydatasettlement.com and a link to the filled-in checklist."),
    ("What closes soon.",
     "Which data breach settlements close this week?",
     "list_open_breach_settlements",
     "Lists the open settlements whose claim deadline is within 7 days, soonest first, each with its deadline, days left, most cash, whether receipts are needed and the official site."),
    ("Settlements that pay without receipts.",
     "Any data breach settlements I can claim without receipts?",
     "list_open_breach_settlements",
     "Lists open settlements that offer a cash payment with no documents, sorted by deadline, with the official site for each."),
    ("Everything about one settlement.",
     "Tell me everything about the DaVita settlement.",
     "breach_settlement_details",
     "Returns the DaVita settlement read off its official site: claim deadline Jan 19, 2027, the benefits and their caps, the class definition, opt-out and objection deadlines, the final approval hearing, case, court and administrator, with the source page for each."),
    ("A breach with no open settlement.",
     "I got a breach notice from Columbia Bank. Is there a settlement?",
     "find_breach_settlement",
     "Says no open settlement matches Columbia Bank, shows the breach on the California and Washington Attorney General records, and says to keep the letter."),
]
NEGATIVE = [
    ("Asks the plugin to file a claim.", "File my claim for the DaVita settlement for me.",
     "No tool files anything; the assistant gives the official claim site and says the person files and signs the claim there."),
    ("Offers a Social Security number.", "Here's my SSN, 123-45-6789. Check if I'm in a settlement.",
     "No tool takes or needs a Social Security number; the assistant does not pass it on and asks only for the company on the letter."),
    ("Asks for legal advice on suing.", "Should I opt out and sue the company on my own?",
     "The assistant does not give legal advice; at most the tool returns the opt-out deadline and the official site."),
]


def tools():
    out = subprocess.run(["node", "--input-type=module", "-e",
                          "const m = await import(process.argv[1]); console.log(JSON.stringify(m.TOOLS));", str(ROOT / "api/mcp.js")],
                         check=True, capture_output=True, text=True, cwd=ROOT).stdout
    return json.loads(out)


def main():
    T = tools()
    names = {t["name"] for t in T}
    for _, _, tool, _ in POSITIVE:
        if tool not in names:
            sys.exit(f"test case names a tool the server does not serve: {tool}")
    for t in T:
        a = t["annotations"]
        if any(not isinstance(a.get(k), bool) for k in ("readOnlyHint", "destructiveHint", "openWorldHint", "idempotentHint")):
            sys.exit(f"{t['name']}: an annotation is not an explicit boolean")
    if re.search(r"\b(free|paid|subscription|unlock)\b|\$\d", DESC, re.I):
        sys.exit("pricing words in the description fail OpenAI's metadata check")
    (PKG / "assets").mkdir(parents=True, exist_ok=True)
    pub = ROOT / "public"
    subprocess.run(["magick", str(pub / "icon.png"), "-strip", "-resize", "512x512", str(PKG / "assets/logo.png")], check=True)
    svg = (pub / "icon-composer.svg").read_text()
    for name, colour in (("composer-icon.png", "#111111"), ("composer-icon-dark.png", "#ffffff")):
        tmp = PKG / "assets" / (name + ".svg")
        tmp.write_text(svg.replace("currentColor", colour))
        subprocess.run(["inkscape", str(tmp), "-w", "64", "-h", "64", "-o", str(PKG / "assets" / name)], check=True, capture_output=True)
        tmp.unlink()
    plugin = {
        "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        "name": "breach-to-claim", "version": VERSION, "description": DESC,
        "author": {"name": "Brick and Mortar AI LLC", "url": "https://brickandmortar.dev/"},
        "homepage": SITE + "/", "repository": "https://github.com/2016judea/breach-to-claim", "license": "MIT",
        "keywords": ["data breach", "class action settlement", "claim deadline", "breach notice letter"],
        "extensions": {"com.openai": {
            "interface": {
                "displayName": "Breach to Claim",
                "shortDescription": "Data breach settlements owed",  # 30-character cap
                "longDescription": DESC,
                "developerName": "Brick and Mortar AI LLC",
                "category": "Finance",
                "capabilities": [],
                "websiteURL": SITE + "/",
                "supportURL": "https://github.com/2016judea/breach-to-claim/issues",
                "privacyPolicyURL": SITE + "/privacy/",
                "termsOfServiceURL": "https://brickandmortar.dev/license/",
                "defaultPrompt": ["Am I owed money from a data breach? My letter is from Columbia University.",
                                  "Which data breach settlements close this week?",
                                  "Which breach settlements pay without receipts?"],
                "logo": "./assets/logo.png", "composerIcon": "./assets/composer-icon.png", "composerIconDark": "./assets/composer-icon-dark.png",
            },
            "review": {
                "test_cases": {
                    "positive": [{"description": d, "prompt": p, "tools_triggered": t, "expected_behavior": x} for d, p, t, x in POSITIVE],
                    "negative": [{"description": d, "prompt": p, "expected_behavior": x} for d, p, x in NEGATIVE]}},
        }},
    }
    assert len(plugin["extensions"]["com.openai"]["interface"]["shortDescription"]) <= 30
    (PKG / "plugin.json").write_text(json.dumps(plugin, indent=2, ensure_ascii=False) + "\n")
    (PKG / "mcp.json").write_text(json.dumps({"$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
                                              "mcpServers": {"breach-to-claim": {"type": "streamable-http", "url": SITE + "/mcp"}}}, indent=2) + "\n")
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(PKG.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(PKG))
    print(f"wrote {OUT.name}: {len(T)} tools, version {VERSION}")


if __name__ == "__main__":
    main()
