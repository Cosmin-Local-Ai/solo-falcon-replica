# Every open defect, in plain language

**Prepared 2026-10-16 for the audit handover.**

**How to read this.** 134 defects have been recorded in this project's history. **90 are closed, 4 turned out not to be defects, 1 is parked by your decision.** That leaves **39 still open** — 32 free to work on, and 7 waiting on something outside the code. They are listed below.

**Difficulty is not size.** A defect can be a one-line change and still be hard, because the hard part is deciding what the right answer is. The ratings are:

| Rating | Meaning |
|---|---|
| **S** | Small. A contained change, no decision needed, low risk of breaking anything. |
| **M** | Medium. Several files, or a real decision to make first, or it touches money. |
| **L** | Large. Architectural, or it changes how a calculation is done, or it needs a data migration. |
| **XL** | A subsystem. It is not a fix, it is a feature that does not exist yet. |
| **Decision** | The code is not the blocker. Someone has to choose what the app should do. |

**"Money"** means: if this is wrong, a taxpayer's figures are wrong — not just the screen.

---

## 1. The ones that change a taxpayer's numbers

These are the defects an auditor will care about most, because they change what someone owes.

| Id | In plain language | Difficulty | Money |
|---|---|---|---|
| **B-112** | **The app looks at too little income when it works out the pension contribution.** If someone earns both from their own business *and* from intellectual property (books, patents, copyright), the law adds those together before it decides which bracket they fall into. The app only adds the business income. **On ANAF's own published example, the app would charge 12.150 lei where the correct figure is 24.300 lei — half.** | **M** | **Yes — understates** |
| **B-133** | **Two warning signs on screen measure a different amount than the calculation itself uses.** So the app can show someone as comfortably under a threshold while the calculation that decides their contribution is measuring a larger figure. The two disagree, and the disagreement is invisible. | **M** | **Yes — misleading display** |
| **B-115** | **When only half an expense is allowed, the VAT on the disallowed half should be added to the expense. The app doesn't do that for everyday expenses** — though it does for assets. A fuel receipt where half the use is personal ends up with a smaller recorded cost than the law allows. | **S–M** | **Yes — understates a deduction** |
| **B-54** | **The app guesses a full year's income from a partial one by multiplying by twelve.** The research found no legal basis for that. The law measures what was actually received and paid; the special rule that used to prorate for people who started mid-year was **deleted in 2024**. A projection is a forecast, not the legal basis. | **L** | **Yes — the base itself** |
| **B-126** | **Dividends keep the old 10 % rate if they were voted on during 2025, even if the money was paid in 2026.** The rate is fixed by the *decision*, not the payment date. The app can only express one rate per year, so it cannot represent this. | **M** | **Yes** |
| **B-119** | **The app cannot work out the dividend figure the health-contribution ladder actually wants.** The law counts dividends *after* withholding tax is taken off. There is no dividend record in the app, so it takes whatever the person types. **Type the gross by mistake and the contribution bracket is overstated, and nothing catches it.** | **Decision + M** | **Yes — overstates** |
| **B-87** | **For a car used partly for business, the 50 % limit should be applied *after* adding back the VAT you couldn't reclaim.** The rule that says so is written for companies, not for sole traders, and the sole-trader rules don't repeat it. **Someone has to decide whether we apply it.** | **Decision** | **Yes** |
| **B-80** | **Booking-platform fees are excluded from taxable rental income — the law is clear and the app already gets it right.** What nobody has written down anywhere is *which line items on a platform statement count as that fee* — cleaning fees, service charges, host-paid advertising. **The rule isn't uncertain; the person's statement is.** The app needs to ask, not guess. | **Decision + M** | **Yes** |
| **B-146** | **The pension-withholding calculation only knows about one of the three income types that trigger withholding.** Health contributions were fixed for all three in an earlier pass; pension withholding was not in that brief's scope and still only handles one. | **M** | **Yes** |
| **B-152** | **The health-contribution ladder needs six income amounts at once.** The app can now work one of them from records, but the other five still have to be typed. **This is the blocker on the DPI decision you already made** — see B-116. | **L (chain)** | **Yes** |
| **B-116** | **Income from intellectual property is stored in two places at once: a number the person types, and documents the app could calculate from.** You've decided which one survives. The app currently refuses to run when both exist for the same year, which is honest but not final. **The retirement half is not built yet.** | **L (chain)** | **Yes** |

---

## 2. Facts the app can compute but a person can never enter

This is the single biggest theme in the open list, and it's a pattern worth naming: **the app knows the rule and has no way to ask the question.**

| Id | In plain language | Difficulty |
|---|---|---|
| **B-38** | **A bill issued in December and paid in January can land in the wrong tax year, because there's nowhere to say when the money actually moved.** This is the one currently being fixed. | **M — in flight** |
| **B-97** | **One goods purchase from abroad can split a tax quarter into two different periods.** The app can calculate that, and has tests for it — but there is no control on any screen that lets you say it happened. | **M** |
| **B-100** | **The rest of the VAT registration history is the same story.** When someone joined the VAT system, whether they were already over the threshold before joining, the turnover figures the law compares — the app asks for them in words and cannot accept them as input. | **L** |
| **B-104** | **The calendar can tell you that you owe a filing, and then give you no way to record that you filed it.** The rule is correct and unreachable. | **M** |
| **B-124** | **A business can have several activity codes; the screen shows and edits only the first one.** And there is no official code list in the app at all, so nothing checks a typed code. | **M** |
| **B-127** | **The app can't tell a two-month-old business from a seven-year-old one that just started using the app.** It asks for the start date and then uses it for exactly one thing: whether the box is filled in. | **S–M** |
| **B-89** | **A year that mixes two ways of being taxed can't be calculated, because an income record doesn't say which pot it belongs to.** | **L** |
| **B-119** | *(also above)* — no dividend record exists, so a figure the law wants calculated can only be typed. | **M** |

---

## 3. Things that are wrong on screen, or that mislead the person reading them

| Id | In plain language | Difficulty |
|---|---|---|
| **B-61** | **The app calls a bookkeeping register by the wrong name — wrong on four counts.** It says „Rapoarte de mișcări de trezorerie (RJIP)". The real name is *Registrul-jurnal de încasări și plăți*. Wrong noun, wrong number, wrong thing, and it presents a running record as if it were a filed return. | **S** |
| **B-92** | **A note in the app still says the app has no asset register.** It has one, and has had one for weeks. A user-facing note that misstates what the app does is a factual error, not a comment. | **S** |
| **B-53** | **The big revenue number on the dashboard includes VAT; the tax calculation underneath uses figures that exclude it.** Two numbers on the same screen, 9.317 against 7.700, both labelled as revenue. | **L** |
| **B-158** | **A legal citation in the app includes a paragraph number we have never been able to verify.** Twelve places have been fixed. Ten remain, and those ten are baked into the rule set — changing them means issuing a new rule version, which is a release decision, not a wording fix. | **L (release decision)** |
| **B-45** | **The minimum-wage figure the whole year's thresholds hang off is marked "unverified" in one place but not everywhere it's used.** Six days later you can't tell from a saved calculation which wage assumption produced it. | **M** |
| **B-59** | **Thresholds that the law writes as "12 × the minimum wage" are stored as fixed sums of money.** The app checks that the two agree, and if they don't, it changes a label — it does not stop the calculation. | **M** |
| **B-96** | **The demo business declares itself VAT-registered on 9.700 lei of turnover, against a 395.000-lei threshold.** Legal, but the demo is what teaches people the shape of their own situation, and almost nobody at that turnover is registered. | **Decision + S** |
| **B-123** | **Four stages of intellectual-property income work, are tested against ANAF's own published numbers — and appear nowhere in the demo.** No demo profile exercises any of it, so nothing in the product shows it working. | **S** |

---

## 4. Accessibility and interface quality

These are the ones an auditor or a reviewer can see immediately without reading any code.

| Id | In plain language | Difficulty |
|---|---|---|
| **B-52** | **Grey text is too light to read for the partially sighted** (fails the standard in 6 places), there's no way to skip to the main content with a keyboard, and four or five links read only „Deschide" out of context. | **S** |
| **B-69** | **The same contrast problem, measured precisely:** two colours at 2.57:1 and 4.43:1 against a required 4.5:1. Found by an automated gate, not by anyone noticing. | **S** |
| **B-86** | **No page in the app has a "main content" marker,** so screen readers report every route as having content floating outside any landmark. One structural fix, not one per page. | **S** |

**These three overlap heavily and should be one brief.** They are the cheapest credibility win in the list.

---

## 5. Record-keeping, evidence and the audit trail

| Id | In plain language | Difficulty |
|---|---|---|
| **B-43** | **The app throws away the evidence that produced a calculation** — which records were classified how, what was excluded and why, which caps bit, which currency conversions were applied. So the "show me the calculation" view and the saved snapshot can't explain the expense total. | **L** |
| **B-49** | **The app never actually saves a calculation.** The machinery to replay one under an old rule set exists and is tested, but nothing in the running app writes one. **This is why "Date lipsă: Estimare impozit" can never clear** — the checklist asks for a saved calculation that the app is incapable of making. One defect, two symptoms. | **M** |
| **B-50** | **All 39 expense rules are marked active and verified on the same date, while most of their caps carry "conflict unresolved".** That contradicts the project's own rule that ambiguous law is staged for review rather than shipped as settled. | **M** |
| **B-151** | **Six calculation routines are declared by the rule set but nothing in the app can reach them, and two don't exist at all.** They look like working features in the rule catalogue and are inert. | **M** |
| **B-60** | **The currency layer has three conversion rules and none of them is the one the law fixes for the 100.000-euro VAT threshold** — which is the rate on 31 December of the previous year. The design invites reusing the wrong one. | **M** |

---

## 6. Data safety and reputation

| Id | In plain language | Difficulty |
|---|---|---|
| **B-110** | **The demo data uses names and identifiers that belong to, or could belong to, real third parties.** The worst case: a bank account string that begins with the real BIC prefix of a real Romanian bank, inside a real-format IBAN, in three places. Also a real supermarket chain as a demo supplier, and a domain we neither own nor verified. **Mitigating: every tax ID and personal ID in the demo already fails its own check digit, so none can match a real person.** | **S–M** |
| **D1** | **A brand-new install is handed the demo data, and only a corrupted-data case shows a warning banner.** A first-time user can't tell whether they're looking at their own numbers or a demonstration. | **S–M** |

**For an audit handover, B-110 and D1 are the two I would fix first** — not because they're hard, but because they're the two an outside reviewer notices immediately and forms a judgement on.

---

## 7. The one that isn't a defect and isn't small

| Id | In plain language | Difficulty |
|---|---|---|
| **B-135** | **A sole trader employing staff is not modelled at all.** The law lets them employ up to three people. Once they do, there's a second set of contributions (25 % pension, 10 % health, 10 % income tax, 2.25 % local levy), a separate return (Declarația 112), and a different accounting problem. **This is not a fix; it is a product area that does not exist.** | **XL — blocked on research** |

---

## Summary

| | Count |
|---|---|
| Recorded in total | 134 |
| Closed | 90 |
| Refuted (weren't defects) | 4 |
| Parked by your decision | 1 |
| **Open, free to work on** | **32** |
| **Blocked on a decision from you** | **3** — B-80, B-87, B-96 |
| **Blocked on a data migration step** | **2** — B-116, B-152 |
| **Blocked on more research** | **2** — B-119, B-135 |

**By difficulty:** 8 small · 16 medium · 12 large · 1 extra-large · 4 needing a decision before any code.

**If the goal is a clean audit handover, the short list is:**

1. **B-110 and D1** — demo data with real-looking bank details, and no signal about whether you're looking at your own data. Small, and the first thing an outsider sees.
2. **B-52 / B-69 / B-86** — accessibility, as one brief. Small, visible, and currently failing an automated gate the project already runs.
3. **B-112 and B-133** — two real money errors, both understating or misrepresenting contributions.
4. **B-61 and B-92** — the app describing itself incorrectly to its user. One-line fixes.
5. **B-49** — the app cannot save a calculation, which is why a checklist item can never clear.

**What is genuinely hard is not the code.** B-54 (the multiply-by-twelve assumption), B-43 (throwing away the evidence), B-116/B-152 (income held two ways) and B-135 (employing staff) are all decisions about what the product should do, and each one is bigger than a fix.
