# Every open defect, in plain language

**Prepared 2026-10-16 for the audit handover. Regenerated against the register after brief 83 — it supersedes the version issued earlier the same day.**

**How to read this.** 136 defects have been recorded in this project's history. **96 are closed, 4 turned out not to be defects, 1 is parked by your decision.** That leaves **35 live** — **28 free to work on, and 7 waiting on something outside the code.**

**These counts come from `docs/ai/tools/register_rollup.py`, not from anyone adding them up by hand.** An earlier copy of this document was stale within hours of being written, which is why the numbers are now generated.

**Difficulty is not size.** A defect can be a one-line change and still be hard, because the hard part is deciding what the right answer is.

| Rating | Meaning |
|---|---|
| **S** | Small. Contained change, no decision needed, low risk. |
| **M** | Medium. Several files, or a real decision first, or it touches money. |
| **L** | Large. Architectural, changes how a calculation works, or needs a data migration. |
| **XL** | A subsystem. Not a fix — a feature that does not exist yet. |
| **Decision** | The code is not the blocker. Someone has to choose what the app should do. |

**"Money"** means: if this is wrong, a taxpayer's figures are wrong — not just the screen.

---

## 1. The ones that change a taxpayer's numbers

| Id | In plain language | Difficulty | Money |
|---|---|---|---|
| **B-112** | **The app looks at too little income before it picks the pension bracket.** Someone earning from their business *and* from intellectual property should have those added together first. The app adds only the business. **On ANAF's own published example it charges 12.150 lei where the correct figure is 24.300 — half.** | M | **yes, understates** |
| **B-133** | **Two warning signs on screen measure a different amount than the calculation does.** The app can show someone comfortably under a threshold while the calculation deciding their contribution measures a larger figure. The disagreement is invisible. | M | **yes, misleading** |
| **B-115** | **When only half an expense is allowed, the VAT on the disallowed half should be added to the cost.** The app does this for assets but not for everyday expenses — so a fuel receipt with half-personal use records a smaller cost than the law allows. | S–M | **yes, understates a deduction** |
| **B-54** | **The app guesses a full year's income from a partial one by multiplying by twelve.** No legal basis was found. The law measures what was actually received and paid, and the proration rule for people who started mid-year was **deleted in 2024**. A forecast is not a legal base. | L | **yes, the base itself** |
| **B-126** | **Dividends voted during 2025 keep the old 10 % rate even if paid in 2026.** The rate follows the *decision*, not the payment date. The app can only express one rate per year. | M | **yes** |
| **B-119** | **The health-contribution ladder wants dividends *after* withholding tax is taken off.** There is no dividend record in the app, so it takes what is typed. **Type the gross by mistake and the bracket is overstated, and nothing catches it.** | M + decision | **yes, overstates** |
| **B-146** | **Pension withholding only knows one of the three income types that trigger it.** Health contributions were fixed for all three; pension withholding was not in that brief's scope. | M | **yes** |
| **B-87** | **For a partly-business car, the 50 % limit should apply *after* adding back the VAT you couldn't reclaim.** The rule saying so is written for companies; the sole-trader rules don't repeat it. **Someone must decide whether we apply it.** | decision | **yes** |
| **B-80** | **Booking-platform fees are excluded from taxable rental income — the law is clear and the app already gets it right.** What is written nowhere is *which line items on a platform statement count as that fee* — cleaning, service charges, host-paid advertising. **The rule isn't uncertain; the person's statement is.** The app needs to ask, not guess. | decision + M | **yes** |
| **B-152** | **The health ladder needs six income amounts at once.** The app can now work one out from records; the other five still have to be typed. **This is the blocker on the intellectual-property decision already made.** | L (chain) | **yes** |
| **B-116** | **Income from intellectual property is stored in two places at once** — a number the person types, and documents the app could calculate from. The app currently refuses to run when both exist for the same year, which is honest but not final. **The retirement of the typed figure is not built.** | L (chain) | **yes** |

---

## 2. Facts the app can compute but a person can never enter

The biggest theme in the open list, and a pattern worth naming: **the app knows the rule and has no way to ask the question.**

| Id | In plain language | Difficulty |
|---|---|---|
| **B-97** | **One goods purchase from abroad can split a tax quarter into two different periods.** The app calculates it and has tests for it — but no control on any screen lets you say it happened. | M |
| **B-100** | **The rest of the VAT registration history is the same story.** When someone joined the VAT system, whether they were already over the threshold before joining, the turnover figures the law compares — the app asks for them in words and cannot accept them as input. | L |
| **B-104** | **The calendar can tell you a filing is owed, then give you no way to record that you filed it.** The rule is correct and unreachable. | M |
| **B-124** | **A business can have several activity codes; the screen shows and edits only the first.** And there is no official code list in the app at all, so nothing checks a typed code. | M |
| **B-127** | **The app can't tell a two-month-old business from a seven-year-old one that just started using it.** It asks for the start date and uses it for exactly one thing: whether the box is filled in. | S–M |
| **B-89** | **A year that mixes two ways of being taxed can't be calculated**, because an income record doesn't say which pot it belongs to. | L |
| **B-119** | *(also above)* — no dividend record exists, so a figure the law wants calculated can only be typed. | M |

---

## 3. Things the app states incorrectly about the law, or about itself

| Id | In plain language | Difficulty |
|---|---|---|
| **B-63** | **Anything the app says about electronic invoicing is wrong for 336 days of the year.** A sole trader identified by personal numeric code was only obliged to use the state's e-Factura system from **1 January to 29 January 2026**. From **1 June 2026 they are not obliged at all, permanently** — the article that created the obligation was rewritten into the exemption. The project's own earlier conclusion ("this profile is an e-Factura emitter in 2026") is true for 29 days and false for the rest. **The official consolidated text still shows the old obligation, so reading one source gives the opposite answer.** | M |
| **B-61** | **The app calls a bookkeeping register by the wrong name — wrong on four counts.** It says „Rapoarte de mișcări de trezorerie (RJIP)". The real name is *Registrul-jurnal de încasări și plăți*. Wrong noun, wrong number, wrong thing — and it presents a running record as if it were a filed return. The feature itself is correct. | S |
| **B-92** | **A note in the app still says the app has no asset register.** It has had one for weeks. A user-facing note that misstates what the app does is a factual error, not a comment. | S |
| **B-53** | **The big revenue number on the dashboard includes VAT; the tax calculation underneath uses figures that exclude it.** Two numbers on one screen — 9.317 and 7.700 — both presented as revenue. | L |
| **B-59** | **Thresholds the law writes as "12 × the minimum wage" are stored as fixed sums of money.** The app checks the two agree and, if they don't, changes a **label** — it does not stop the calculation. Building a 2027 rule set means hand-writing six new sums, with only a test enforcing they're right. | M |
| **B-158** | **A legal citation in the app carries a paragraph number we have never been able to verify.** Twelve places fixed. Ten remain, baked into the rule set — changing them means issuing a new rule version, which is a release decision, not a wording fix. | L (release) |
| **B-96** | **The demo business declares itself VAT-registered on 9.700 lei of turnover, against a 395.000-lei threshold.** Legal, but the demo is what teaches people the shape of their own situation, and almost nobody at that turnover is registered. | decision + S |
| **B-123** | **Four stages of intellectual-property income work and match ANAF's published numbers — and appear nowhere in the demo.** Nothing in the product shows the feature working. | S |

---

## 4. Accessibility — the cheapest credibility win, and three of them are one job

| Id | In plain language | Difficulty |
|---|---|---|
| **B-52** | **Grey text is too light to read** for the partially sighted (fails in 6 places), there's no keyboard skip link, and four or five links read only „Deschide" out of context. | S |
| **B-69** | **The same problem, measured:** two colours at 2.57:1 and 4.43:1 against a required 4.5:1. Found by an automated gate, not by anyone noticing. | S |
| **B-86** | **No page in the app has a "main content" marker,** so screen readers report content floating outside every landmark. One structural fix, not one per page. | S |

---

## 5. Record-keeping, evidence and the audit trail

| Id | In plain language | Difficulty |
|---|---|---|
| **B-43** | **The app throws away the evidence behind a calculation** — how records were classified, what was excluded and why, which caps applied, which currency conversions were used. **This is now the only thing standing between "a calculation is saved" and "a saved calculation explains itself"**: the saving was fixed in brief 83, the evidence still isn't kept. Fourteen evidence structures reach the live screen and none is stored. **Deliberately left open rather than done thinly** — a saved calculation carrying a summary instead of the evidence is the same defect with a green tick on it. | L |
| **B-50** | **All 39 expense rules are marked active and verified on the same date, while most of their caps carry "conflict unresolved."** That contradicts the project's own rule that ambiguous law is staged for review rather than shipped as settled. | M |
| **B-151** | **Six calculation routines are declared in the rule set but nothing in the app can reach them, and two don't exist at all.** They look like working features in the rule catalogue and are inert. | M |
| **B-60** | **The currency layer has three conversion rules and none of them is the one the law fixes for the 100.000-euro VAT threshold** — the rate on 31 December of the previous year. The app currently gets the right *number* by borrowing the payment-date machinery, which is the wrong rule producing a right answer. | M |
| **B-160** | **The figure on screen can be stale in two specific ways.** The app freezes "today" when the page loads, so **a dashboard left open past midnight still measures yesterday's period cut.** And the rule book is loaded once with no subscription, so a rule change won't refresh an open screen. The third consequence runs the other way: it recomputes far too often — an unrelated popup re-runs the whole engine and flashes the loading state. | M |

---

## 6. Data safety

| Id | In plain language | Difficulty |
|---|---|---|
| **B-110** | **The demo data uses identifiers that belong to, or could belong to, real third parties.** Worst case: a bank account string beginning with a real Romanian bank's real BIC prefix, inside a real-format IBAN, in three places. Also a real supermarket chain as a demo supplier, and a domain we neither own nor verified. **Mitigating: every tax ID and personal ID in the demo already fails its own check digit, so none can match a real person.** | S–M |

**This is the one item in this section.** The defect it was paired with — a first-time user unable to tell demo data from their own — **was checked this pass and found to be already fixed**: a fresh install starts from empty storage and goes to onboarding, proven in a browser. That row is now closed.

---

## 7. The one that isn't a defect and isn't small

**B-135** — **a sole trader employing staff is not modelled at all.** The law allows up to three employees. Once they exist there is a second set of contributions (25 % pension, 10 % health, 10 % income tax, 2.25 % local levy), a separate return (Declarația 112), and a different accounting problem. **This is not a fix; it is a product area that does not exist.** **XL — blocked on research.**

---

## Summary

| | Count |
|---|---|
| Recorded in total | 136 |
| Closed | 96 |
| Refuted (weren't defects) | 4 |
| Parked by your decision | 1 |
| **Open, free to work on** | **28** |
| **Blocked on a decision from you** | **3** — B-80, B-87, B-96 |
| **Blocked on a data migration step** | **2** — B-116, B-152 |
| **Blocked on more research** | **2** — B-119, B-135 |

**Two ids appear twice in the register** — B-110 and B-150 each have two rows with different premises. Both are counted; neither has been silently merged. **B-16 (remainder)** still asserts something that B-121 and B-145 appear to have answered, and was never marked closed. These are named rather than tidied, because deciding to merge them is not a mechanical call.

---

## What the release gate actually says

**`docs/ai/PG13_GO_NO_GO.md` verdict: NOT READY.** Refreshed this pass against the tree, not carried forward — its baseline had been frozen at 2026-10-10 (77 files / 1332 tests) while the tree moved to **200 files / 3235 unit tests / 237 e2e / data version 26.**

**Five conditions block it:**

1. **B-54** — the estimate must be computed on realised income, not a ×12 projection. **Not met.**
2. **B-50** — the active rule package must have no open legal conflict, or the conflict must be surfaced rather than resolved silently. **Partly met, therefore not met.**
3. **B-51** — a disclaimer stating what the app is not. **Partly met** — it exists, renders on exactly two surfaces, and is proven in a browser.
4. **B-160** — the figure a person is looking at must be the figure the current facts produce. **Not met.**
5. **B-43** — a saved calculation must be able to explain itself later. **Not met.**

**Plus two decisions only you can make:** who gets the next data-format version (the migration step reserved for the intellectual-property retirement is also what B-43's evidence would need), and **a single 2026 rule-package release** — B-50 and B-158's residue both need one change that moves the rule digest, and the registry refuses to load a rule whose digest moved while its version stayed put, so no one can do it piecemeal.
