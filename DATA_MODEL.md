# Data model — Breach to Claim

Written 2026-11-19 from the need alone, before touching any source
(`~/.claude/BUSINESS.md` rule 5). The customer is one person who got a letter
saying their data was in a breach, or saw a headline, and asks an AI: *am I owed
money from the X data breach, and how do I claim?* The job: tell them, in the
chat, whether an open settlement covers that breach, whether they are likely in
the class, what it pays, the deadline, and the official place to file. Each
field names the question it answers for that person.

## 1. Settlement — one court-approved class settlement with a claims process

| field | question it answers |
|---|---|
| id / slug | Which settlement are we talking about, in a link that carries nothing about the person? |
| defendant | Who is paying? Is this the company on my letter? |
| aliases[] | My letter says "Change Healthcare", the case says "UnitedHealth": is it the same one? |
| kind (data breach / tracking-pixel privacy) | Is this about stolen data, or about a website sharing what I did? |
| incident_summary | What happened, and when? Is it the incident in my letter? |
| incident_period | Was my data exposed in the window the class covers? |
| data_exposed[] | Was it my SSN, my medical record, or just an email? |
| case_name, case_number, court | Is this real? Where can I check it myself? |
| administrator | Who runs the claims, and is the site I found actually theirs? |
| official_site | Where is the court-authorized website? |
| claim_url | Where exactly do I file? |
| claim_deadline | When is it too late? How many days do I have? |
| opt_out_deadline, objection_deadline | When must I act if I don't want to be bound by it? |
| final_approval_hearing | When does the court decide? When might money arrive? |
| status (open / deadline passed / final approved / paying) | Can I still claim, or is it over? |
| fund_total | How big is the pot? |
| class_size | How many people share it? |
| class_definition (verbatim) | Am I in it? |
| subclasses[] (e.g. California residents) | Does living in my state pay more? |
| notice_id_required | Can I file with no letter, or do I need the code printed on my notice? |
| benefits[] — type, amount, cap, documentation needed | What can I get: cash, reimbursed losses, lost time, credit monitoring? Do I need receipts? |
| loss_window_start | My losses from before the breach: do they count? |
| administrator_contact (phone/email) | Who do I ask if I lost my letter? |
| sources[] per field, verified_at | Where did each fact come from, and how fresh is it? |

## 2. Breach notice — a public report of a breach that may have no settlement yet

| field | question it answers |
|---|---|
| organization | Did the company on my letter report a breach? |
| reported_to / reported_at | Is my letter real? Which regulator holds the record, and when? |
| breach_dates | When did it happen? |
| residents_affected | How many people like me? |
| data_exposed[] | What of mine is out there? |
| source_url | Where can I read the record myself? |

## 3. Lawsuit — a filed case that has not settled yet

| field | question it answers |
|---|---|
| case_name, court, docket, filed_at | Is someone suing on my behalf already? Do I need to do anything now? |
| stage (filed / consolidated / settlement pending) | How close is money? |

## 4. The person's situation — answered in the chat, never stored

| field | question it answers |
|---|---|
| company named on their letter | Which settlement or notice to match. |
| state of residence | Does a state subclass pay more? Does the class cover them? |
| got a notice letter (yes/no) | Can they file in a closed-class settlement? |
| had out-of-pocket losses after the breach (yes/no) | Documented-loss claim or the flat cash payment? |

Never asked for and never stored: SSN, name, address, notice ID, class member
ID, claim ID, confirmation code. A claim form is signed under penalty of
perjury by the person; the tool reads the class definition back and links the
official site. It never files.

## Joins

- settlement.defendant + aliases ↔ notice.organization (normalised name) — a
  notice with no open settlement is the "nothing to claim yet" answer.
- settlement ↔ lawsuit by case_number — a settlement's case is a lawsuit that
  resolved.

## Reality check, field by field (2026-11-19)

Measured on 85 official settlement sites found through public settlement
indexes, plus Columbia University (a claim filed by hand on 2026-10-27).

| field | source | can we get it? |
|---|---|---|
| official_site | the court-approved notice; discovered through public indexes that link it | yes, 85 of 85 |
| case_name, case_number, court | official site home page | yes, 54 of the 56 sites curl reads; most of the rest through a headless browser |
| claim / opt-out / objection deadlines, hearing | official site "important dates" | yes, every site read had dated deadlines |
| class_definition, benefits, notice_id_required, loss window | official site home + FAQ | yes, as verbatim quotes |
| fund_total, class_size | official site or long-form notice | often, not always (claims-made settlements have no fund) |
| administrator, contact | official site footer / contact | yes |
| status | computed from today against the dates | yes |
| breach notice (entity 2) | California AG list, Washington AG on data.wa.gov (the breach-to-complaint pipeline) | yes, for breaches touching CA or WA residents |
| lawsuit (entity 3) | CourtListener needs a token, PACER costs money | **no, today** — a pending suit is reported only when its settlement appears |
| aliases | written by hand when a defendant name differs from the letter | partly |

Cloudflare walls about a third of official sites against plain HTTP; a headless
browser reads most of them. A site we cannot read today keeps its last verified
record and shows when that was. Lawsuits without a settlement are the one gap;
the answer for a breach with no settlement says that plainly rather than
guessing.
