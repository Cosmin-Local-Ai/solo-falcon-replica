# Phase 10c — FX end to end: a rate can be entered, and one ledger feeds every lei figure

**Numbering note, stated up front:** brief 29 asked for this file as `docs/ai/phases/26_fx_end_to_end.md`.
`docs/ai/phases/25_euro_caps_provisional_rates.md` already exists and is **TASK 10b's** handoff. The brief's
filename was followed literally rather than silently renumbered; the next phase doc should take **26**.

**Date:** 2026-10-10 (`date +%F`). **Brief:** `docs/ai/briefs/29_phase10c_fx_end_to_end.md`.
**Read first, and not re-derived here:** `phases/24_currency_fx_store.md` (TASK 10a — the money type, the
rate record, `FxRateProvider`, why a rate is a string), `phases/25_euro_caps_provisional_rates.md` (TASK 10b —
`capCeiling.ts`, `fx/ledger.ts`, `recordFxRate`, the provisional → final lifecycle),
`research/23_fx_conversion_and_bnr_rates_2026.md` (the law, the series codes, and the list of what must stay
unresolved).

**Baseline before any change, measured at `35e94d8`:** `tsc` 0 · **77 files / 1332 tests** · `build` 0 ·
**`e2e` 37 passed**.
**After:** `tsc` 0 · **80 files / 1368 tests** (+3 files, +36 tests) · `build` 0 · **`e2e` 39 passed**
(+2 settings specs). **No money figure moved. No snapshot digest moved. No data version moved. The copy-guard
allow-list is still empty.**

---

## 1. What was actually missing

The FX **machinery** was built and tested by 10a and 10b. Two **wires** were not connected.

- **B-36 — no door.** `recordFxRate` (`data/store.tsx:118`, impl `:374`) was a correct validated upsert
  keyed by `rateKey` with **zero callers**. Settings showed recorded rates and offered no way to produce
  one. A user holding a EUR invoice therefore met the missing-rate refusal with no route out except a
  developer writing to `localStorage`. The app could report its own missing datum and could not resolve it.
- **B-37 — two money paths.** `normaliseLedgerToRon` had exactly one importer, `estimateBasis.ts`, while
  `aggregation.ts:140` still returned `null` for a non-lei record. So the estimate converted and the
  summary, the monthly series, the projection behind the graph and the threshold rows did not. **One user,
  two revenue totals** — the same record, 5.347,00 lei in one card and 0,00 lei in another, with nothing on
  screen to say which was which.

This phase is wiring. Nothing in `src/domain/fx/` was re-modelled: no new basis, no new rate kind, no new
anchor, no averaging, no network path.

## 2. The boundary — one call, `normaliseStoredLedger`

`src/domain/fx/ledger.ts` gained the two pieces the boundary needed and nothing else:

```ts
export function recordedRateProvider(data: AppData): FxRateProvider;      // RateStore over data.fxRates
export function normaliseStoredLedger(data: AppData): LedgerNormalisation; // normaliseLedgerToRon + that provider
```

`estimateBasis.ts` had its own private copy of the provider builder (`rateProviderFor`, three lines that
were byte-for-byte the same construction). It is **deleted**, and both of its normalisation calls now go
through the shared functions. That is the only change to `estimateBasis.ts`, and it changes no policy: the
conversion basis, the exclusion reasons, the cap logic and the two-pass assembly are untouched. A duplicated
provider builder is exactly how two surfaces came to disagree, so it is not kept "just in case".

The pass is idempotent — a RON record is returned untouched — so calling it per selector cannot drift and
cannot convert an already-converted record. Pinned in `fx/ledger.test.ts` and `data/dashboard.fx.test.ts`:
a second pass reports **zero** conversions and returns the same lei amounts.

## 3. What each surface now reads

| Surface | Before | Now |
|---|---|---|
| Summary card (`getFinancialSummary`) | raw `selectYtd(data)` | `selectYtd(normaliseStoredLedger(data).data)` |
| Graph (`getProjectedFinancialSeries`, `getMonthlyFinancialSeries`) | raw | normalised |
| Threshold rows (`getThresholdStatuses`) | raw | normalised — a EUR invoice with a rate now measures against the VAT plafon like a lei one |
| Snapshot (`buildSnapshot` → `pfaRevenue`) | raw | normalised |
| Derived view (`domain/derived.ts selectFinancialDerived`) | raw | normalised for `ytd` / `monthly` / `projection` |
| Estimate (`selectEstimateOperands`) | normalised (its own copy) | the same shared call |

The per-record **register lines** in `selectFinancialDerived` deliberately stay on the records **as the user
wrote them** — a register that printed the converted lei figure instead of the euro amount on the invoice
would hide the datum the user needs in order to check the conversion.

**No stored figure moved.** Every fixture in the suite is a RON ledger, and for a RON ledger the boundary is
a no-op — asserted, not assumed, by `dashboard.fx.test.ts` ("a RON ledger is untouched by the boundary"),
which compares a whole `DashboardSnapshot` with and without a rate on record.

## 4. The disclosure — extended, not duplicated

The brief's rule was: *do not build a second disclosure mechanism — extend the one that exists.* The one
that exists is `aggregation.ts selectUnconvertedRecords`, which had **no caller at all** (production or
test). It is extended in place:

```ts
export interface UnconvertedRecord {
  id: string; kind: 'revenue' | 'expense'; currency: CurrencyCode;
  amount: Money;   // the amount that is out of the totals, in the currency it is written in
  detail: string;  // the datum that is missing — supplied by the conversion pass, not invented by the view
}
export function selectUnconvertedRecords(data: AppData, details?: readonly UnconvertedDetail[]): UnconvertedRecord[]
```

`data/dashboard.ts getLedgerDisclosure(data)` returns `{ conversions, unconverted }` from **the same pass
the totals were built on**, and `DashboardData.ledger` carries it so no surface can render a total without
it. Rendered in three places:

- `components/FinancialSummary.tsx` — under the three lei figures: *"N înregistrări în valută nu sunt în
  niciun total în lei…"*. A total with something missing from it is labelled incomplete **on the card that
  shows the total**, not only in a section further down the page.
- `components/FinancialChart.tsx` — the same sentence under the series the record is absent from.
- `components/dashboard/CurrencySection.tsx` (new) — the full two-table disclosure: what came in, with the
  printed rate, the anchor date, the series code, the source URL and the provisional/final badge; and what
  is still out, with the amount in its own currency and the reason.

`LedgerConversion` gained `netRecorded` / `vatRecorded` (`Money`, each with its own currency) so the
disclosure can show *1.000,00 EUR → 5.347,00 lei at 5.3470* rather than a lei figure with no origin. They
are `Money`, not `Bani`, because a record may legitimately carry a lei net and a foreign VAT — printing the
lei amount under the foreign currency would be a lie the display tells.

## 5. Rate ingress — `components/ui/FxRateEntryForm.tsx`

Mounted in Settings' fiscal tab, inside the existing FX card, above the read-only register. It calls the
**existing** `recordFxRate` and adds nothing to it.

- Fields: currency (EUR / USD / GBP / HUF — the schema's set; `RON` is the target, never the source), rate
  (the printed decimal, `5.3470`, never reformatted), `rateKind`, **date or year per kind**, series code,
  source URL, provisional / final.
- Changing currency or kind re-anchors the series and the source with it — a stale `CURSZ_EUR` on a USD
  record is a wrong citation, not a typo. Non-EUR series are named with the same `-PATTERN` honesty
  `bnrXml.ts` uses, and `seriesCodeStatus()` renders the unverified-series note beside them.
- **`problems[]` is rendered verbatim** under one lead sentence. The app does not rewrite a validator's
  message into friendlier words; a refusal nobody can act on is not a refusal, it is a shrug.
- **The upsert is the correction route.** Same currency + kind + date-or-year ⇒ same `rateKey` ⇒ the record
  is replaced, and the saved message says *a replacement happened* rather than pretending a second rate was
  recorded. There is no in-place edit of a cited rate and no delete.
- **An annual average of a year that has not closed is forced provisional**, with the control disabled and
  the reason shown. That is `manualAnnualAverage`'s existing decision mirrored, not a new one.
- **No fetch.** Asserted: the entry test stubs `globalThis.fetch` and asserts it was never called.

## 6. `onDate` is a fiscal date — and the datum PG-2 owns is still missing

`onDate` comes from `revenueFiscalDate` / `expenseFiscalDate`: `collected ?? date`, `paid ?? date`. The
fallback to the **document** date is the standing Phase 9 reading of a field older payloads only ever had
(pinned by `aggregation.test.ts`), and it is the same confusion **B-66** names in the RJIP export.

What 10c does is **name it, not repair it**. `LedgerConversion` gained:

```ts
export type LedgerDateSource = 'collected' | 'paid' | 'date';
onDateSource: LedgerDateSource;
```

and `CurrencySection` renders, whenever any conversion is anchored on `date`:

> *„Cursul este ancorat pe data documentului, pentru că înregistrarea nu are dată de încasare sau de plată.
> Data documentului nu este data la care suma a fost încasată ori plătită."*

**This is the interaction with PG-2 / Phase 12C, stated rather than fixed.** No screen in this app can
write `collected` or `paid`. Until PG-2 does, every conversion of a record created today is anchored on the
document date, and the honest consequence is that the anchor is disclosed, not that a date is invented.
10c deliberately did **not**: add a payment/collection input (PG-2's scope), change the Phase 9 fallback
(would move records between fiscal years on a 10c-sized change), or push a record into `unconverted` for
lacking a money date (would refuse every legacy record in every existing install and make the ledger
unusable — the fallback is a reading of an ambiguous field, not a per-record guess).

## 7. Provisional stays provisional

A provisional rate is labelled at every surface it reaches: the Settings register (`FxRateProvenance`,
10a), the conversion row in `CurrencySection` (`data-provisional="true"` + `notes`), and **inside the
converted total** — `FinancialSummary` renders `fx.ledger.provisionalInTotal` whenever any conversion behind
the three lei figures used a provisional rate. Pinned in `FinancialSummary.test.tsx` and
`CurrencySection.test.tsx`.

## 8. A record must not vanish — the `hasData` gate

Found while writing the page-level test, and fixed: `pages/Dashboard.tsx` gated the whole dashboard on
`snapshot.pfaRevenue > 0 || pendingCounts…`. A ledger whose **only** record is a foreign one converts to
zero lei, so the dashboard rendered the **onboarding empty state** — telling a user holding a real EUR
invoice to go and add their first invoice. That is B-37 at its most literal: the record had vanished from
the financial picture entirely, disclosure included. The gate now also counts
`data.ledger.unconverted.length > 0`.

## 9. Refusals, and what stays out of scope

- **No fourth `ConversionBasis`.** Defect **B-60** is 18B's. 10c needed no basis the union does not offer —
  the ledger converts at `payment_date_daily` and nothing else — so the union, `BASIS_CITATIONS` and the
  discriminated anchor are untouched. Nothing in this phase attaches a citation to a basis that does not
  carry one.
- **No network path.** `bnrXml.ts` still has no caller over the wire; `loadDailyRates` still takes an
  injected `FetchText` and nothing in `src/` supplies one. `grep -n "\bfetch(" src` (production) returns
  nothing.
- **No PG-2 date inputs** — see §6.
- **No touch to the VAT periodicity cap, the calculators, rule values, the rule registry, snapshots or the
  migration chain.** `CURRENT_DATA_VERSION` stays 10; `fxRates` was already declared at v10 by 10a.
- **No silent in-place edit of a cited rate.** The upsert is the correction route, and it says so.
- `paramBani` still refuses any unit but `lei`.

## 10. Validation, and every re-pin

`tsc` 0 · **80 files / 1368 tests** (+3 files, +36 tests) · `build` 0 · **`e2e` 39 passed** (37 → 39).

New tests:

- `src/data/dashboard.fx.test.ts` (7) — the acceptance proof as arithmetic: **the same 5.347,00 lei**
  (1.000,00 EUR × 5,3470, the BNR rate research 23 captured for 2026-10-08) out of the summary, the monthly
  series, the projection, the estimate assembler, `getTaxEstimate`, `selectFinancialDerived` and the
  snapshot; the same record with no rate absent from every total **and** present in the disclosure; a rate
  added after the fact reconciles it without touching the record; provisional survives; the threshold rows
  measure the converted turnover; the pass is idempotent; a RON ledger is untouched.
- `src/pages/Settings.fx.test.tsx` (8) — the B-36 proof: a rate typed into the form enters the totals; the
  rate **survives a reload** (unmount → fresh `StoreProvider` → `loadInitial` reads it back) and the record
  still reconciles; an incomplete rate is refused with the validator's own words; a rate with no date is
  refused by the rule that a daily rate must name its day; the upsert replaces rather than adds; an annual
  average of an open year is recorded provisional; **no `fetch` is performed**.
- `src/components/dashboard/CurrencySection.test.tsx` (5) — the converted row (rate, series, source,
  `Definitiv`), the unconverted row (amount in its own currency, the date the rate would have been keyed
  to), the provisional label inside a converted total, the document-date note, and the empty state.
- Additions to `fx/ledger.test.ts` (6), `aggregation.test.ts` (4), `FinancialSummary.test.tsx` (3),
  `FinancialChart.test.tsx` (1), `pages/Dashboard.test.tsx` (2 — the page-level pair: disclosed at 0 lei,
  reconciled at 5.347,00 lei).
- `e2e/settings.spec.ts` (2) — the record disclosed in a browser, the rate typed into Settings, the reload,
  and `5.347,00 RON` in the summary card; plus the refusal path showing the validator's sentence.

**Assertion adaptations, all of one kind.** `FinancialChart.test.tsx` fixtures gained
`ledger: { conversions: [], unconverted: [] }` — the chart now reads the ledger disclosure from
`useDashboardData()`, and a fixture that omits it is a fixture for a dashboard that no longer exists. Four
override sites, one field each; **no matcher loosened, no assertion deleted, no timeout widened.**
`pages/Dashboard.test.tsx` gained a `writeCurrentPayload` helper that writes a payload at
`CURRENT_DATA_VERSION` (the existing `writePayload` writes a versionless legacy payload on purpose, to
exercise the chain — a currency test needs the opposite: a payload the chain leaves alone).

**Nothing was re-pinned:** no data version, no digest, no seed figure, no deadline, no threshold value. The
seed ledger is RON, so every pinned figure (deductible 120,00 / 144,00 lei, VNA 9.096,00, impozit 819,00,
total 3.249,00, reserve 1.083,00, year-end 3.112,00, hero 51.510 lei) is unchanged and still green.

## 11. What still cannot be converted, and why

1. **A foreign record with no rate for its money date.** The store holds no rate, and the app will not
   invent one, average daily rates into an annual one, or borrow a neighbouring day. It is out of every lei
   total and named in the disclosure with the currency, the amount and the date the rate would have been
   keyed to. **This is now resolvable by the user** — that is what the Settings form is for — but it is
   still unresolvable *by the app*.
2. **A foreign record with no usable money date at all** (`date` malformed and no `collected`/`paid`):
   `normaliseLedgerToRon` refuses it and says the anchor date is not a calendar date. Unchanged from 10b.
3. **A record anchored on the document date** converts — but at a rate keyed to a day that is *not* proven
   to be the day the money moved. Disclosed (§6), not hidden. Closes only with PG-2.
4. **A statutory ceiling stated in a foreign currency** still converts only where the store holds the
   **annual average** pct. 7 alin. (6) names. No FY2026 average exists; nothing computes one. Unchanged
   from 10b, and the art. 322 100.000-euro cap basis is still missing from the union — **B-60, 18B's**.
5. **`GBP` / `HUF`** can be stored and entered, but no rule in the package states a ceiling in them and no
   fixture holds a record in them; the path is generic, the coverage is not.

## 12. NEXT HANDOFF

- **PG-2 / 12C** owns the money dates. When `collected` / `paid` become writable, `onDateSource` becomes
  `'collected'` / `'paid'` on new records with **no change to this layer** — the field already carries the
  distinction, and the disclosure already renders both sentences. The document-date fallback should then be
  revisited as a **migration/UX question**, not patched inside FX.
- **B-66** (the RJIP export posts on the document date) is the same confusion on the other side of the app.
  10c did not touch `Documents.tsx`; the `onDateSource` vocabulary here is the one that answer should use.
- **18B** still owes the fourth basis for the art. 322 cap, with its own citation. Nothing here pre-empts
  it, and nothing here makes reusing a ledger rate for a ceiling look tempting: the ledger basis is
  `payment_date_daily` and the ceiling path still refuses anything but an annual average.
- **Phase 11** (coherent 2026 seed) may want a foreign-currency record in the seed: it can now exist
  end-to-end, and the disclosure will show it. Do not seed a rate — a seeded rate is a fabricated legal
  figure, the same reason 10a refused to backfill `fxRates`.
- **PG-1** (estimate coverage — no silent exclusions) should read `DashboardData.ledger` rather than
  re-walking the records: it is the same list, produced by the same pass.
- The copy guard's allow-list is **empty** and this phase added no inline sentence to any component or page.
