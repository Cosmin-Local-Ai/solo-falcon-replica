# Phase 8 — Financial amount semantics

Worker notes: `docs/ai/notes/08_amount_semantics_worker_notes.md` (not a source of record).
Baseline HEAD `811ec5d`; measured before: `tsc` 0 · build 0 · **578 unit / 41 files** · **32 e2e**.
After: `tsc` 0 · build 0 · **587 unit / 41 files** · **33 e2e**.

## 1. The defect, as measured (wider than the archived prompt said)

`computeThresholds` took ONE `currentValue` for every spec whose `requiredFiscalBase` matched. All four
specs declared `'gross-revenue'`, and both call sites passed the same VAT-inclusive `ytd.revenue`. Two
distinct errors:

1. **Wrong VAT basis** — `VAT_REGISTRATION` measured a VAT-exclusive plafon (CF art. 310 alin. (1))
   against a VAT-inclusive number. `revenueNet` already existed and was used only for display.
2. **Wrong quantity entirely** — `CAS_MIN_BASE` (48 600), `CASS_MIN_BASE` (24 300) and `CASS_MAX_BASE`
   (291 600) compared **contribution bases** to **gross revenue**. `net-income` was in the `FiscalBase`
   union but **no production spec used it**.

On the seed the error is large: the four cards all read **9 317,00 lei** where the law reads
**7 700,00 lei** (VAT) and **7 494,50 lei** (CAS/CASS).

## 2. Base decisions, each with the article that defines the base

| Spec | Base now | Value | Article defining the BASE |
|---|---|---|---|
| `CAS_MIN_BASE` | `net-income` | 48 600 (12 SM) | CF art. 148 alin. (1)-(2) lit. a) — floors attach to *venitul net anual realizat* |
| `CASS_MIN_BASE` | `net-income` | 24 300 (6 SM) | CF art. 174 alin. (6) cor. art. 170 alin. (1) — top-up by reference to VNA |
| `CASS_MAX_BASE` | `net-income` | 291 600 (72 SM) | CF art. 170 alin. (1) — "nu poate fi mai mare decât" 72 SM **din venitul net anual** |
| `VAT_REGISTRATION` | `revenue-excl-vat` | 395 000 | CF art. 310 alin. (1) — *cifră de afaceri*, exclusiv taxa |

Each `ThresholdSpec` now carries a **`baseSourceArticle`** field, asserted by test, so a row cannot
travel without the provision that names its base (distinct from the rule's own `sourceArticle`, which
cites the provision that sets the *value*).

### The contribution base is the engine's, not an aggregate

`net-income` is supplied **only** by `computeTaxEstimate`: it is the `net` behind the
`'Venit net din activitate'` line (`src/domain/tax.ts`), i.e. `gross - deductibleBase`, and it is the
same value already passed as `base:` to `calcCas` and `calcCass`. Phases 3–5 defined it; this phase
reuses it rather than inventing one.

**Correction recorded against the old code's own doc comment**, which said
`net-income: YTD profit/loss (YtdTotals.net)`. That is **wrong in law**: `YtdTotals.net` is
`revenue - expenses` on **VAT-inclusive** operands = **9 068,34 lei** on the seed, whereas the fiscal
VNA is **7 494,50 lei**. `YtdTotals.net` is now documented as "Cash profit — not a fiscal contribution
base" and is never wired to a threshold.

## 3. The design constraint, solved rather than worked around

The brief framed it as "one call cannot serve two bases". That was only true of the *query shape*. The
real defect: `ThresholdQuery` carried exactly one number and one label, so a spec needing a different
quantity had nothing to read.

**Decision (D-1): `ThresholdQuery.bases: ThresholdBases`** — a record keyed by `FiscalBase` whose
entries may be absent. One `computeThresholds` call now serves all four specs. `getThresholdStatuses`
gained a third parameter `tax: TaxEstimateResult`; `buildThresholdBases(ytd, tax)` assembles the map and
adds `'net-income'` **only when the engine actually computed**.

Alternatives considered and rejected:
- *Drop the three contribution rows from the display path* — satisfies "no wrong base" but loses the
  four cards and hides a real obligation.
- *Two separate `computeThresholds` calls* — keeps one-base queries but lets the two paths drift, which
  is exactly how the inline duplicate in `buildSnapshot` and `getThresholdStatuses` diverged.

`buildSnapshot` no longer duplicates the call; it reuses `getThresholdStatuses`, so the snapshot rows and
`DashboardData.thresholds` have one origin.

## 4. The silent-skip trap, closed

`thresholds.ts` used to hold `if (spec.requiredFiscalBase !== query.fiscalBase) continue;` — a base
mismatch **silently deleted a threshold card**. That `continue` is gone. A spec whose required base has
no supplied value now emits a row with `status: 'review_required'`, `currentValue: null` and a
`reviewReason`. Adding `'review_required'` to the status union made `STATUS_BADGE`/`STATUS_LABEL`
(`Record<FiscalThreshold['status'], …>`) **compile errors** until the UI handled it — the loudness is
enforced by the type system, so the trap cannot silently return.

Rule/param lookup stays **before** the base lookup, so the pre-existing "no rule → skip" behaviour (and
the `income has no fiscal rule spec` test) is preserved; only a missing **base** is loud.

Tests that now fail if a spec is dropped by a base mismatch:
- `a spec is never silently dropped by a base mismatch (silent-skip guard)` — loops several base maps and
  asserts row count === `THRESHOLD_SPECS.length` and the id set matches.
- `the production caller supplies a base for every spec` — runs the real `seedData` through
  `getThresholdStatuses` and asserts every spec comes back measured on its declared base.
- e2e `when the engine refuses, the contribution thresholds turn review_required instead of vanishing` —
  on the B-14 `impozit_pe_cit` refusal, 4 `.item-row` still render, 3 show `De verificat` with a reason,
  and the VAT row is still measured at `130.000,00 lei`.

The two unit tests that had **pinned the silent skip as correct** (`toHaveLength(0)`) were deleted and
replaced by the above.

## 5. Amount vocabulary made explicit in types, not comments

- `FiscalBase` = `revenue-incl-vat` · `revenue-excl-vat` · `expense-incl-vat` · `expense-excl-vat` ·
  `net-income`, each documented with its article.
- `ThresholdBases` — one optional key per concept.
- `TaxAmountBases { venitulBrut, cheltuieliDeductibile, venitulNetDinActivitate }` on the **computed**
  variant of `TaxEstimateResult`. Previously these quantities existed only as `lines[]` label strings.
- `YtdTotals` fields each documented as one concept; `Threshold.current` and `FiscalThreshold.currentValue`
  are `number | null` so "unmeasured" is representable instead of being faked as `0`.
- Cash amount vs VAT amount: records still store `valoareFaraTva` + `tva` and derive the total
  (`aggregation.recordTotal`); the two families are now named at every boundary that consumes them.

## 6. Caveats carried forward, not upgraded

- **CF art. 310 alin. (2).** The VAT-exclusive reading of the plafon is **not** grounded in alin. (2)
  being a global definition: "exclusiv taxa" attaches grammatically to the *ieșire din evidență* case, and
  alin. (2) also excludes fixed-asset deliveries. The reading holds because **no provision anywhere
  measures the plafon TVA-inclusiv**. Stated this way in the `VAT_REGISTRATION` spec comment.
- **U-7 / Q-OMFP3254-HISTORY.** OMFP 3254/2017's amendment history could not be verified (the portal's
  "Acțiuni suferite" returned 0 references). Its being in force is established via OMF 808/2026 art. 8's
  express scope (which abrogates OMFP 870/2005 only). The net-of-VAT base rests on that act; the
  provenance gap stays open.
- **U-1 / Q-NONDEDUCT-VAT** remains unverified inference and is not encoded as a computed rule.
- `warningDistance = thresholdValue * 0.1` is a **presentation band chosen by the app**, now documented as
  "NOT a statutory figure… must not acquire a citation". It is not displayed; it only drives `statusFor`.

## 7. Tax engine behaviour: unchanged, and measured to be unchanged

`tax.ts` already selected `revenuesNet` when `profile.vatExempt` is false, and it is false at every seed
and default. VAT does not leak into PFA taxable income. This phase made that selection **named and
typed**, nothing more.

Verified by running the same computation on this branch and on `git stash push -- src/`:

| | venit brut | chelt. deduct. | VNA | taxable | total |
|---|---|---|---|---|---|
| before | 7 700 | 205,5 | 7 494,5 | 6 745,05 | 3 104,505 |
| after | 7 700 | 205,5 | 7 494,5 | 6 745,05 | 3 104,505 |

Identical. The only difference is that `bases` was absent before and now carries exactly those numbers.
Pinned by `acceptance 6: the seeded taxable base is identical before and after the semantics change`.

## 8. Deliberately not done

- **The 24 SM CAS tier-floor surface was NOT taken.** Crossing 24 SM doubles the CAS floor from 12 150 to
  24 300, which is real, but expressing it needs a new `ThresholdType` plus UI `labelFor`/`breachMeaningFor`
  cases, and `min-base`/`max-base` semantics would misdescribe it ("schimbare de regim" is false). Not
  manufactured. The 24 SM figure stays visible in the calculator breakdown.
- **No new thresholds invented.** `CAS_MAX_BASE` remains absent per Phase 3 (CF art. 148 alin. (2) sets
  floors, no CAS ceiling).
- **No rounding policy.** B-17 is Phase 10's.
- **Date semantics** untouched (Phase 9). `data/migration.ts`, `data/quarantine.ts`, `store.tsx`'s load
  path and `domain/snapshots/` untouched (Phase 7). No persisted field added, so no migration needed.
- `settings.cotaTva` still read nowhere; the seed's **21%** VAT is statutory and was not "fixed";
  `playwright.config.ts:9` remains an LSP-only diagnostic.

## 9. Follow-up found, not fixed (handoff)

**`buildSnapshot`'s `breached: t.distance > 0` is wrong for `min-base` rows.** A min-base threshold
breaches when the base falls **below** the floor, but the snapshot ratio-rule shape flags breached only
when `distance > 0`. On the seed the three contribution rows are `breached` in `FiscalThreshold.status`
yet `breached: false` in `snapshot.thresholds`, so **the insights engine never emits a threshold alert
for them**. Pre-existing, not introduced here. Fixing it changes the `Observații` count and breaks
`e2e/dashboard.spec.ts:265` (12 insights), so it needs its own phase rather than a silent change.

**For Phase 10 (B-17):** the basis change makes the half-cent more visible — the seeded total is
**3 104,505 lei**, rendered `3.104,51` by the reserve section and `1.034,84` per month.

## 10. Contradiction with archived material

The archived Phase 8 prompt said this phase is **blocked** by Q-VAT-THRESHOLD, Q-VAT-BASIS and
Q-NETGROSS and must not proceed without a Researcher. That is superseded: all three were closed in
Phase 2 (395 000 lei for 2026; plafon VAT-exclusive; `venituri`/`cheltuieli` net of VAT). It also
described the defect as only the VAT basis; the measured defect additionally covers the three
contribution rows. `PLAN.md`'s "Re-measured 2026-10-06, after Phase 7" block is the accurate framing.
