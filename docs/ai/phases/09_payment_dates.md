# Phase 9 — Date semantics (collected / paid), B-20, and the event-relative deadline

**Date:** 2026-10-07 · **Brief:** `docs/ai/briefs/09_payment_dates.md` · **Baseline HEAD:** `cd25e3c`
**Legal basis:** `docs/ai/research/10_art80_negative_and_payment_timing_2026.md` (read in full) and
`docs/ai/phases/02_fiscal_baseline.md:187-215`.

---

## 1. What the law actually requires (settled before this phase — not re-opened here)

| Question | Provision | Effect in code |
|---|---|---|
| Which date attributes a **revenue** to a fiscal year? | **CF art. 68 alin. (2) lit. a)** — venit brut is measured by „**sumele încasate**" (amounts **collected**) | `Revenue.collected` is the fiscal date |
| Which date attributes an **expense**? | **CF art. 68 alin. (4) lit. b)** — „cuprinse în cheltuielile exercițiului financiar **al anului în cursul căruia au fost plătite**" | `Expense.paid` is the fiscal date |
| Does the invoice **issue** date gate anything? | **No.** Art. 68 alin. (4) lit. a) requires only that expenses be „**justificate prin documente**" — the invoice is the justificativ, its date does not pick the year | **No `issued` field was added.** `collected`/`paid` are load-bearing; `issued` is not |
| Is a late-paid expense disallowed? | **No.** There is **no 15-day collection threshold** in the Cod fiscal — art. 80 is *„Termenul de plată a impozitului"*, a **payroll** payment deadline (see `research/10` §1: 0 hits for the rule across 2.5 M chars of CF and 3.7 M of CF+norms; seven 2026 amending acts read directly, none touches art. 80) | **No late-payment disallowance was implemented.** `tax.ts:112` deducting every expense unconditionally is **correct on this ground** and was left alone |

The consequence of art. 68 is **attribution, not punishment**: a record collected or paid in a later
year moves to that year. It is not lost. That is exactly what the new tests assert.

## 2. The date model

```
Revenue:  date (legacy, always present)  +  collected?  ← fiscal date when present
Expense:  date (legacy, always present)  +  paid?       ← fiscal date when present
```

**One named accessor per record type**, not scattered `??` chains (decision D-P9-2), with the art. 68
citations at the point where the choice is made — `src/domain/aggregation.ts`:

```ts
export function revenueFiscalDate(r: Pick<Revenue, 'date' | 'collected'>): string { return r.collected ?? r.date; }
export function expenseFiscalDate(e: Pick<Expense, 'date' | 'paid'>): string     { return e.paid    ?? e.date; }
```

Every site that selects records by date now goes through them: `selectYtd`, `selectMonthly`, and the
per-record provenance lines in `domain/derived.ts` (`toLines`). A provenance line now **displays the
same date that decided whether the record counted** — previously it displayed `date` while `counted`
was computed from `date`, which was consistent but hid the fiscal question; it can no longer diverge.

### 2.1 The load-bearing assumption (pinned by test)

**A legacy payload's single `date` IS the fiscal date.** `revenueFiscalDate` / `expenseFiscalDate`
fall back to it. This is a deliberate reading of a field that was always ambiguous, not a per-record
guess: it preserves every figure that existed before Phase 9 (see §5) and it is asserted in
`src/domain/aggregation.test.ts` → *"treats a legacy record's single `date` as the fiscal date"*.

## 3. Persistence: the v2 → v3 migration step

`CURRENT_DATA_VERSION` **2 → 3**. The chain was **appended to**, never renumbered:

| # | step | `from → to` | what it does |
|---|---|---|---|
| 1 | `profile-materialization` | 0 → 1 | unchanged (Phase 6) |
| 2 | `identity-absorption` | 1 → 2 | unchanged (Phase 7) |
| 3 | **`payment-dates`** | **2 → 3** | stamps the version. **Backfills nothing.** |

`migratePaymentDatesV3` is a documented no-op beyond the version stamp. Copying `date` into
`collected`/`paid` would **manufacture a collection or payment event that was never recorded** and
would make an unrecorded fact indistinguishable from a recorded one — the same class of error as
Phase 7's F-1 `canonicalize` defect, where a normalisation step silently asserted something the
source never said. Absence is the honest state, so absence survives. The step is the single place a
future, *evidenced* backfill would live.

**Digest exposure was verified, not assumed.** `CalculationInput`
(`domain/snapshots/types.ts:21-27`) hashes `{ profile, revenues: number, expenses: number }` — the
record **arrays are not inside `inputSnapshot`**, so adding an optional field to `Revenue`/`Expense`
changes **no stored digest**. (It *would* if the field were added to `PfaProfile`/`PfaIdentity`, which
`canonicalize` serialises key-by-key — no such field was added.)

New fields are **optional** on both the interface (`data/types.ts`) and the zod mirror
(`data/schema.ts`); the compile-time `Equal<>` guard at `schema.ts:284-297` forces the two to stay in
step. A payload with no payment data keeps the keys **absent** — asserted by
`store.migration.chain.test.tsx` → *"the payment-dates step backfills nothing"*.

## 4. B-20 — `snapshot.thresholds[].breached` was inverted for floor rows

`buildSnapshot` re-derived the flag as `t.currentValue !== null && t.distance > 0`. `distance` is
`currentValue - thresholdValue`, so for a **`min-base` (floor)** row a breach is `distance < 0`: the
expression inverted exactly the floor rows and contradicted the domain, which already branches on the
threshold type (`thresholds.ts:199`, `statusFor`). Because `insights.ts:168` filters on this flag, the
seed's two real breaches — **CAS_MIN_BASE** and **CASS_MIN_BASE**, both far above the measured
net-income of **7 494,50** — rendered `Depășit` in *Praguri* while producing **no** explanation in
*Observații*.

Fixed by driving the flag off the domain status: `breached: t.status === 'breached'`
(`src/data/dashboard.ts`). The new test asserts the **consistency** of every snapshot row with its
domain row, and that the floor rows specifically come out `breached: true` — that assertion fails
under the old derivation.

Visible consequence (intended): *Observații* gains **one** `Prag depășit:` insight on the seed. CASS
and CAS collapse into at most one canonical alert (`canonicalCassCas`), so it is one, not two.

## 5. Item 3 — the profile's PFA start date now reaches the deadline engine

`computeDeadlines` was called at both call sites (`data/dashboard.ts`, in `getUpcomingDeadlines` and
`buildSnapshot`) with only `{ taxYear, asOfDate }`, so every event-relative deadline resolved to
`date: null` and was filtered out of the UI. Both call sites now pass `data.profile.pfaStartDate`.

### 5.1 Deviation from the brief's literal wording (D-P9-7) — recorded deliberately

Brief §4.3 says "feed `pfaStartDate` to `DeadlineQuery.eventDate`". Taken **literally that would
fabricate a fact**: `eventDate` was **one field serving two different events**, and `vat_registration`
computes `month_end(exceedance_month) + 30 days`. Passing a PFA **start** date into it would render a
**VAT registration deadline for an exceedance that never happened**.

`DeadlineQuery` was therefore split into two named fields, each read by exactly one rule:

```ts
pfaStartDate?: string;        // resolves pfa_estimated_declaration ONLY
vatExceedanceMonth?: string;  // resolves vat_registration ONLY
```

Acceptance criterion 6 ("an event-relative deadline resolves to a real date instead of `null`") is
met; two tests pin the negative direction (neither field may resolve the other rule).
`vatExceedanceMonth` currently has **no production caller** — nothing in the app records an
exceedance month yet. It is not invented; it is the seam.

## 6. Invariants that did not move (proof the tax base is untouched)

Measured after the change, on the real seed, at `asOf = 2026-12-31`:

- engine **VNA (venit net anual) = 7 494,50 lei** — unchanged;
- seeded **total due = 3 104,505 lei**, rendered `3.104,51` / `1.034,84` per month — unchanged;
- `VAT_REGISTRATION` measured on `revenue-excl-vat` = **7 700** (not the VAT-inclusive 9 317) — unchanged;
- the three contribution rows measured on `net-income` = **7 494,50** — unchanged;
- `YtdTotals.net` (9 068,34) is still used as **no** fiscal base.

`src/data/dashboard.test.ts` (the Phase 8 amount-semantics block) passes unmodified, which is the
evidence: the seed's records carry no `collected`/`paid`, so the fallback keeps every figure identical.

## 7. Tests

**Unit: 587 → 603** (41 files, all passing). New coverage:

- `domain/aggregation.test.ts` — fiscal-date semantics: legacy `date` fallback; `collected` / `paid`
  **override** the document date and move a record into the next fiscal year (attribution, not
  punishment); `asOfDate` honoured against the collected date; monthly buckets keyed by fiscal date;
  a collected date earlier than the document date attributes normally.
- `data/store.migration.chain.test.tsx` — chain is 3 steps and `CURRENT_DATA_VERSION === 3`;
  **`UnsupportedDataVersionError` is thrown for a newer payload** (no such test existed before);
  the `payment-dates` step leaves `collected`/`paid` **absent** and keeps every record by id.
- `data/dashboard.test.ts` — B-20 consistency of `snapshot.thresholds[].breached` with the domain
  status, the floor rows specifically, and the resulting *Observații* alert; `pfaStartDate` resolves
  the estimated declaration, degrades to absent when the profile has none, and never resolves VAT.
- `domain/deadlines.test.ts` — each event field resolves only its own rule (two new negative tests).

**e2e: 33 → 34.** `e2e/dashboard.spec.ts` insights count **12 → 13** and `Urgent` **7 → 8** (B-20's
canonical threshold alert), with a new assertion for `Prag depășit:`; deadline counts stay **6**
because the seed profile has no `pfaStartDate`. One **new** test seeds a profile **with**
`pfaStartDate` and asserts the *Declarație estimativă PFA* row renders — and that *Înregistrare TVA*
does **not**, i.e. no invented deadline.

## 8. Archive claims this phase contradicts

- `docs/ai/steps/**` describes **one `date` field per document** (`steps/01_real_baseline.md`, citing
  `aggregation.ts:85-87,96,102`). That is the **pre-Phase-9** shape; it is now legacy-compatible
  input, not the current model. The frozen archive was not edited.
- The standing prompt's **"15-day collection threshold"** is false and was **not implemented** — see
  `research/10` §1 and `STATE.md` → *Archive corrections*.

## 9. Flagged, not touched (no Researcher available; not invented)

1. `pfa_estimated_declaration`'s formula cites **art. 81 + 15 days**. `research/10` covers **art. 80**
   only, so this repo's verified baseline does **not** cover the article behind that formula. Wiring
   the date does not re-endorse the citation. **Needs verification before the deadline is presented as
   authoritative.**
2. `vat_registration` cites **art. 338**, while `VAT_THRESHOLD_2026` was corrected in Phase 2 to
   **art. 310 alin. (1)**. Unverified inconsistency, left as-is.
3. Two day-diff implementations coexist: `daysBetween` (`data/dashboard.ts:57`, `Date.parse` with no
   `Z`) and `daysRemaining` (`domain/deadlines.ts:46`, `+'T00:00:00Z'`). Not a Phase 9 question.
4. `inPeriod` has **no format validation** and no lower bound: `''` or `'2026-6-1'` silently drops or
   mis-sorts. The new `collected`/`paid` fields inherit that weakness — the zod schema types them as
   `string`, not as a validated ISO date. Worth a defect entry.
5. `settings.cotaTva` is still read by nothing; money representation and rounding (**B-17**, the
   `3 104,505` lei half-cent) remain **Phase 10**.

## 10. Out of scope, respected

No receivables/payables ledger, no invoice workflow, no banking or e-Factura plumbing, no payroll
modelling, no CPF citations added to the UI (C-1), no new `docs/ai/research/**` (C-3), no rounding
policy (Phase 10), no edits to the frozen `docs/ai/steps/**` archive.
