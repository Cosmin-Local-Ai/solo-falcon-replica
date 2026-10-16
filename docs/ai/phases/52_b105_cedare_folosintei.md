# 52 — B-105: art. 84 and art. 84¹, the ordinary *cedarea folosinței bunurilor* regimes

Written from my own diff. No line numbers, per §12.11.

## What was missing

A long-term landlord had no rule to be measured under. The package resolved the correct **title** for them —
art. 155 alin. (1) lit. e), *cedarea folosinței bunurilor* — and then had nothing to compute. That is the same
shape B-88 had one sub-category over, and the fix is the same shape: a rule of their own, with its own
citations, added beside `ACCOMMODATION_ART85_ROOMS_2026`, which is untouched.

**The first thing not to get wrong is the number in the defect's own title.** The „20 %” is the *cota forfetară
de cheltuieli* — an **expense** ratio. The tax is **10 % of the net**, and the rate does not live in art. 84 at
all: it is art. 123 alin. (2). Net = 80 % of gross; tax = 10 % of that net. Both facts are pinned as rule
parameters and as test assertions, because a reader who takes the 20 % for a rate produces a figure off by a
factor of five and nothing downstream notices.

## (a) The three gross rules, side by side — the distinction a future reader will collapse

Three regimes, three different answers to „when is income income”. The totals agree on 31 December and differ
on every other day of the year, which is exactly why a shared gross path would survive review and be wrong in
production.

| regime | when income is income | the FX anchor the article names |
|---|---|---|
| **art. 84** alin. (1)-(2) | the rent stipulated by the contract „pentru fiecare an fiscal, **indiferent de momentul încasării**” — annual accrual | **curs mediu anual** din anul realizării venitului — alin. (3¹) |
| **art. 84¹** alin. (1),(3) | the net is fixed „**la fiecare plată**”, by the payer — per payment | **cursul din ziua precedentă plății** — alin. (2) |
| **art. 85** alin. (2) (shipped last pass) | „**încasate în cursul anului fiscal**” — cash | **ultima zi bancară anterioară încasării** — alin. (4) |

**art. 84¹ alin. (1) deliberately omits the annual clause art. 84 alin. (1) carries.** Reusing the accrual
selection there is the trap, and it is the quietest possible bug: the same register, the same record, the same
year gives a gross under art. 84 and none under art. 84¹.

The three measures are three code paths, and one test per regime proves a different rate date is selected. A
single EUR rent document — issued 20 Dec 2026, collected 10 Jan 2027 — yields three different lei amounts:
4.900 lei at the 2026 annual average (art. 84, counted in FY2026), 5.120 lei at the rate of 9 Jan 2027 (art.
84¹, counted in FY2027), 5.150 lei at the rate of the collection day through the ledger pass (the art. 85
measure). The fixture records a rate for the Saturday as well as the Friday precisely so the test measures
**which date each regime asks for**, not which date the rate store happens to hold.

The FX itself goes through the boundary that already exists — `convertToRon` over `recordedRateProvider(data)`.
`domain/fx/` internals are untouched (`git diff --stat` on them is empty). The app never averages the daily
rows into an annual average: BNR publishes CURSA_EURM after the year closes, and computing one out of daily
rows would be the app manufacturing the very rate the law names. Where the anchor has no recorded rate, the
gross is `null` and the reason is reported.

The ratio is linear, so the sum of art. 84¹'s per-payment nets equals the ratio applied to the sum of the
payments — but only while each payment's own net is a whole number of bani. Where it is not, the calculator
reports rather than inventing a per-payment rounding rule the alineat does not write.

## (b) Facts reused and facts added — the chain head

**Reused, not re-added:** `activityFamily`, `accommodationRoomCounts` (the room count is what carves the
short-term case out of the ordinary duty set), `accommodationTourismEligibility`, `vatRegistration` (the
measure of every leu in a gross), the CASS ladder's `cedareaFolosinteiBunurilor` category and its
`cedareaSursa` gate, and the whole `Money`/FX record layer.

**Added — one new per-year fact family, `profile.leaseFactsYears`:**

- `tenantNature` — `persoana_fizica` or `entitate_cu_evidenta_contabila`. This is the fact that selects
  between art. 84 and art. 84¹, and it is declared, never inferred: a CUI in the tenant column is a tax
  number, not a bookkeeping obligation.
- `contractRentAnnual` — the accrual measure art. 84 alin. (2) asks for.
- `ownerCostsPaidByTenant` — the art. 84 alin. (1) uplift. It joins the gross **before** the ratio, because
  the ratio is a percentage of the gross and the order changes the net.
- `rentPaidExclusivelyInKind`, `guaranteeAppliedToRent` — the two art. 84¹ alin. (8) triggers.
- `contractDate`, `contractRegistered` — the event the 30-day term runs from, and the person's own statement
  about discharging it.

**Chain head: v19 → v20, one step, `lease-facts`.** It opens the fact family by writing nothing. A default for
any of these facts is not a missing value — it is a different taxpayer: the tenant's nature moves the income
between two articles and changes who computes the tax, whether it is final, and whether a return is owed for
it. The step is asserted three ways in the chain test (no key minted, idempotent, a declared fact set passes
through untouched) and once in the browser test (the written bytes carry no `leaseFactsYears`).

**Rule package: 51 → 54 rules; release version 4 → 5.** Three rules added — `CEDARE_ART84_2026`,
`CEDARE_ART84X1_2026`, `CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026` — and the version moved because
`contentHash` moved, which is what the release governance makes a consequence of a content change rather than
a display number.

## (c) The tenant-side declaration form is unresolved, and was not guessed

`docs/ai/research/46_art84_84_1_cedare_folosintei_2026.md` §Gaps-1 records that the **plătitor de venit**'s
own return — the form on which the withholding is declared — is not settled for FY2026. This build does not
model a tenant-side filing at all, and does not assert one. What it does state is the landlord's side, which
is settled: the payer calculates, withholds, declares and remits, and the owner is entitled to ask the payer
for the document attesting the tax withheld and remitted (art. 84¹ alin. (4) last sentence). That entitlement
is in the calculator's breakdown; the tenant's form is not invented.

## (d) arendă agricolă is a recorded gap, not a half-implementation

Arendă has its own withholding mechanism, its own cash-basis gross, and **CASS that *can* be withheld**
(art. 174¹ alin. (3) names arendă explicitly, while ordinary rent is absent from that list). It is out of
scope for this task and is not built from the art. 84 rule. The consequence is stated where a reader will hit
it: `leaseRegistrationDutyForYear` treats arendare as one of the two carve-outs art. 83 alin. (5) names, and
the rule's own `carve_outs` parameter says so, so an arendă register is neither measured at 20 % nor given a
registration duty it does not have. **Follow-up defect: an arendă register in this app resolves to sistem-real
with no sentence saying why.**

## (e) B-85 with a fourth regime in play

The leg list is still three-way and nothing here opens a new way for two legs to meet. An ordinary *cedarea
folosinței* register supplies **no art. 155 alin. (1) lit. b) leg at all** — cedarea is lit. e), not lit. b) —
so the CAS/CASS basin measured on lit. b) receipts stays empty and the letting net travels only through the
art. 170 alin. (4) lit. c) ladder. The FY2026 text of that litera reads „stabilite potrivit **art. 84-85**”, a
range that covers 84, 84¹ and 85, and the two ladders stay parallel exactly as B-88 left them: the same 100.000
lei of receipts produces the same income tax under art. 84 and under art. 85, and a different CASS basin.

What did have to change is the **method-selection seam**, and the reason is instructive. Until this task the
whole of `selectIncomeDeterminationMethod` sat behind `family !== 'cazare' → sistem-real`, which was correct
only because every non-sistem-real method in the app was an accommodation one. The ordinary rent regimes are
the first methods this app has that belong to a **non-cazare** register — a long-term landlord is not a cazare
operator — so that guard made them unreachable. The guard now selects the path instead of ending the question,
and the invariant it used to enforce by accident is preserved on purpose: a register whose declared family is
not cazare still cannot select an accommodation method.

The two-producer discipline held too. Where a declared `contractRentAnnual` and the register's documents for
the year disagree, the gross is refused and both figures are named — the app does not pick a winner. The same
rule already governed the ladder's `cedareaFolosinteiBunurilor`, and that refusal's message had to be widened:
it said „regula art. 85 a determinat …” for a net the art. 84 or art. 84¹ rule had determined, which would have
sent the person to the wrong article to fix it.

## (f) The seed estimate did not move

**311.200 bani, unmoved.** The seed profile declares no lease facts, so no cedare method is selected for it and
no cedare rule runs. The assertion in `src/data/dashboard.accommodation.test.ts` still passes unchanged, which
is the proof rather than the claim.

## The quiet one: „withheld and final” is not „nothing to file”

This is the part most implementations miss, and it is not an arithmetic error at all.

art. 84¹ alin. (5)-(6) make the payer calculate a final 10 %, withhold it at the moment of payment and remit it
by the 25th of the following month. art. 122 alin. (6) lit. a) then exempts the owner's Declarația Unică — **for
the income tax only**. The contributions half survives, because art. 174¹ alin. (3) lets the payer withhold
CASS only on daily wage, arendă and association income, never on ordinary rent, so art. 122 alin. (7) still
requires a return from anyone who owes CAS or CASS.

Two consequences, both asserted:

- **The engine.** The withheld sum is reported as a line — it is the owner's income tax, taken out of their
  rent, and they are entitled to the document proving it — and it is **excluded from the total the owner
  owes**. Adding it would tell a landlord to pay the same leu twice. The net still feeds the CASS cumul: the
  payer having settled the income tax does not remove the income from the contribution base.
- **The calendar.** A D212 row now carries a *declaration scope*: `full`, or `contributions_only` with the two
  articles that produce it. A card that says only „Depunere D212” is wrong in both directions — it sends a
  withheld-at-source landlord to prepare a tax section they do not owe, and it can be read as „nothing to
  file”, which is false.

**alin. (8) is a real exception, not an edge case.** Rent paid exclusively in kind, or a contractual guarantee
applied to the rent, switches the withholding off: the owner determines the net, computes the tax and files the
full return under art. 122 alin. (3). Either answer being `da` is enough — the alineat states the two triggers
in the alternative — and absence of both is not `nu`.

## The duty the app did not surface at all: contract registration

art. 83 alin. (5) requires the lease contract and any later change to be registered with the competent tax
body within at most 30 days. The vehicle is the C168 request, instituted by OPANAF 114/2019 and amended by
2031/2022 and 161/2025 — **an ANAF order, not the Cod fiscal**, which names no form; the rule cites the two
separately. The body records it within 5 days.

**The duty is not waived because the tenant is a company.** The only carve-outs are arendare and short-term
letting of 1–7 camere în locuințe proprietate personală — which is precisely why it applies to the regime built
here and not to the one shipped last pass.

The gate is data, not a branch: a deadline rule may declare `applies_when` with the fact family that must be
affirmatively in force, and a rule that declares one and finds the family absent **emits nothing at all** — not
an undated row, not a „neaplicabil” row. The absence of the duty is a fact about the law, and the app states it
by producing no obligation. Rules that declare no family are untouched, so every pre-existing deadline behaves
exactly as before. An ordinary register with a declared contract date gets the term at contract + 30 days; one
without a date gets an undated `not_applicable` row; a short-term-rooms register gets nothing.

## No bookkeeping obligation, and why that is asserted

art. 84 alin. (10) and art. 84¹ alin. (7) both say these taxpayers have no Registrul de evidență fiscală and no
accounting obligation. That is a real difference from the short-term regime, where art. 85 alin. (7) keeps the
income part of the REF. A test asserts the absence in both calculators' breakdowns and asserts that no deadline
rule emits a bookkeeping term for either variant — the negative is pinned, so a future task cannot add one by
analogy with art. 85.

## Citation hygiene, pinned as absence

The hazard list in the brief is live, and each hazard is now a test rather than a warning:

- No cedare rule quotes the pre-2026 tourism wording. (One rule *describes* the hazard — OPANAF 161/2025 still
  points at the old art. 83 numbering — and the description was reworded so the stale phrase itself does not
  appear in the package.)
- No cedare rule cites the abrogated art. 84 alin. (11) or art. 87.
- The annual-average rule is cited to art. 84 alin. (3¹), not to art. 83 — ANAF Cluj's own 2026 deck mislabels
  it, and the rule text says which numbering the app uses and why.
- The `gross_basis` parameter on each rule states which measure that article uses and names the two it does
  not, so a future edit cannot silently swap them.

## Verification

- `tsc --noEmit` → 0.
- Unit tests: **2126 → 2161** (35 added: `src/domain/cedare.test.ts` 32, plus the chain-step, deadline-type and
  card-scope assertions).
- e2e: **135 → 139** (`e2e/cedare-lease-facts.spec.ts`), including the live `/settings#!/fiscal` axe scan and
  the existing a11y routes.
- `npm run build` → 0.
- Copy-guard `ALLOW_LIST` still empty. (One near-miss worth recording: the guard's Romanian word list contains
  `date`, so a `data-lease-contract-date` attribute name in a page reads as a user-visible sentence. The
  attribute was renamed rather than the allow-list grown.)
- `git diff --stat` on `vatPeriodicity.ts`, `vatReturn.ts` and `domain/fx/` internals is empty, and
  `ACCOMMODATION_ART85_ROOMS_2026` is unmodified.
- Chain head moved by exactly one: v19 → v20.
- Seed estimate unmoved at 311.200 bani.

## Deliberate refusals, restated so they are not "fixed" later

- The tenant's legal nature is never inferred from a CUI, a name, or a document type.
- No annual average is computed out of daily rates.
- A declared contract rent and the register's documents are never reconciled by picking one.
- The tenant-side return is not modelled, because its FY2026 form is unresolved.
- arendă agricolă is not measured by the art. 84 rule.
- No REF or bookkeeping obligation is generated for either ordinary regime.
