# Phase 19 — the pension / CASS input model (pre-Phase-11 TASK 5)

Brief: `docs/ai/briefs/21_task5_pension_cass_input_model.md`.
Legal basis: `docs/ai/research/25_pension_cass_exception_2026.md` (Cod fiscal as amended by OUG 146/2025
and Legea 239/2025, consolidated text `legislatie.just.ro/Public/DetaliiDocument/171282`).
Previous phase: `docs/ai/phases/18_threshold_semantics.md` (TASK 4).

---

## 1. The defect, stated exactly

One boolean — `PfaProfile.pensionStatus` — answered three questions that the Cod fiscal asks
differently:

| Provision | What it actually asks | What the boolean did |
|---|---|---|
| art. 150 alin. (1) | Is the person a pensioner / insured in their own social system? | correct — status is the key |
| art. 174 alin. (7) lit. c) | Did the person **receive sums as pensions** („sume primite ca pensii”, art. 99 alin. (1)) **in the fiscal year for which the D212 is filed**? | wrong — read the status as if it were the receipt |
| art. 174 alin. (8) | Was the person, **in the previous year**, in art. 154 alin. (1) lit. a), b), e) or f), or opted under art. 180 alin. (1)? | wrong — that list **excludes** pensioners (they sit at lit. h²)) |

The consequence was a tax relief granted from a status flag. `applicabilityFor` returned
`not_applicable` for `CASS_MIN_BASE` on `pensionStatus === 'da'`, and `calcCass` returned the
relieved amount, for every pensioner — including one who received no pension sums that year, and
including the case the research explicitly forbids.

## 2. The legal finding the model now encodes

- **lit. c) keys on receipt, not status.** The chapeau of alin. (7) is „în anul fiscal … a realizat
  venituri: … c) venituri din pensii, definite conform art. 99”, and art. 99 alin. (1) defines them as
  „sume primite ca pensii”. A pensioner who received nothing does not qualify; a person who was not a
  pensioner all year but received some does.
- **lit. c) has no amount threshold.** lit. a) and lit. b) each carry „la un nivel cel puțin egal cu 6
  salarii minime brute pe țară”; lit. c) does not. Applying one would be an invented rule. Quantum
  belongs to a different computation (the 3.000 lei/month pension CASS line, art. 154 alin. (1)
  lit. h²)) and is not modelled here.
- **The relief removes only the art. 174 alin. (6) top-up.** The art. 174 alin. (1) / art. 170 alin. (1)
  contribution of 10 % × VNA stays owed, and `CASS_MAX_BASE` stays applicable. The CAS pensioner
  exemption (art. 150 alin. (1)) is never mirrored into CASS.
- **alin. (8) is the only status-based extension**, and its list excludes pensioners — so it needs its
  own recorded fact and can never be inferred from `pensionerStatus`.
- **art. 153 alin. (2) is the one total exclusion** on this path (sickness/maternity insurance in another
  EU/SEE/Elvețian or bilateral-agreement state, **with proof**), and it is not a pension rule.

## 3. The fact model (`src/domain/models.ts`)

New year-attributed records, all **optional** on `PfaProfile` — absence is a state, not a default:

- `PensionReceiptYear { fiscalYear: number; received: PfaYesNo }` → `pensionReceiptYears?`. The fact
  art. 174 alin. (7) lit. c) tests. **No amount field exists on it**, so an invented threshold cannot
  even be applied by accident.
- `PensionSuspensionYear { fiscalYear: number; months: number[] }` → `pensionSuspensionYears?`. Recorded
  with **no legal consequence attached** — research 25 gap 1 is UNVERIFIED, so the app stores the months
  and draws nothing from them.
- `CassPreviousYearContext { previousFiscalYear: number; inExceptedCategory?: PfaYesNo; optedUnderArt180Alin1?: PfaYesNo }`
  → `cassPreviousYearContext?`. The art. 174 alin. (8) route, with its two halves independent.
- `ForeignSicknessInsurance { fiscalYear: number; held: PfaYesNo; proved?: PfaYesNo }` →
  `foreignSicknessInsurance?`. The art. 153 alin. (2) route. **Both halves required**: `held: 'da'`
  without `proved` reads `unknown`, never the exclusion.
- `FactState = 'da' | 'nu' | 'unknown'` — the read-side type. `unknown` is produced by **absence**, and
  is never a soft `nu`.

`pensionStatus` is **deprecated, not deleted**: it stays declared as optional so that old payloads stay
parseable, and `pensionerStatus` is the live key. Renaming rather than reusing the old name is what makes
the two legal questions stop sharing a field.

## 4. The readers (`src/domain/pensionFacts.ts`, new)

One home for every lookup, so no call site can re-derive a fact differently:

`readPensionerStatus` · `readPensionSumsReceived(fields, fiscalYear)` ·
`readPreviousYearExceptedCategory(fields, fiscalYear)` · `readPreviousYearArt180Option(fields, fiscalYear)` ·
`readForeignSicknessInsuranceProved(fields, fiscalYear)` · `readPensionSuspension(fields, fiscalYear)` ·
`readCassExceptionFacts(fields, fiscalYear)`.

Rules the readers enforce:

- Every year-attributed reader is **year-scoped**; a record for another year reads `unknown`, never a
  carry-over.
- `readPensionSumsReceived` consults **no amount** and **no status**.
- A `null` (the `TaxInputsReference` spelling of "not recorded") reads the same as absence.
- `readCassExceptionFacts` returns `receiptGapNote` — a withheld-conclusion string — exactly when a
  pensioner status is recorded **and** the year has no receipt fact at all. It is `null` when the receipt
  fact exists, including when it is `nu` (a checked negative is an answer).
- `pensionStatus` has **no reader at all**. `pensionFacts.test.ts` scans the production source tree and
  fails if the identifier appears anywhere outside `models.ts`, `schema.ts` and `data/migration.ts`.

## 5. Persistence (`src/data/migration.ts`, v7 → v8)

`DATA_VERSION_PENSION_FACTS = 8`, `CURRENT_DATA_VERSION = 8`, chain step **`pension-facts`**.

`migratePensionFactsV8` renames one key and **backfills nothing**:

- `pensionStatus` → `pensionerStatus`, old key removed from the live profile (the same shape as the
  v0→v1 `profile.caen` → `identity.caen` fold).
- No `pensionReceiptYears` record is minted. Writing `received: 'da'` from an old `pensionStatus: 'da'`
  would grant a relief from a boolean; writing `received: 'nu'` would refuse one from the same boolean.
  Both are legal conclusions the stored data does not support.
- Stored snapshots are untouched: `inputSnapshot` is the enumerated subset `{profile, revenues,
  expenses}`, so a stored record keeps its bytes and its digest, and no re-hash marker is written.

`persistedPfaProfileSchema` declares the new keys (zod strips undeclared keys, so declaring them is what
lets them survive a reload) and keeps `pensionStatus` parseable for the migration's sake.

## 6. What flipped, and why that is the fix

`CASS_MIN_BASE` applicability for a profile with `pensionerStatus: 'da'` and no receipt fact — the state
**every pre-TASK-5 install lands in after migration**:

| | before | after |
|---|---|---|
| `CASS_MIN_BASE` | `not_applicable` (relief granted on status) | **`unknown`**, reason = the receipt gap, citing art. 174 alin. (7) lit. c) and art. 99 alin. (1) |
| `CASS_MAX_BASE` | `applicable` | `applicable` (unchanged — never mirrored) |
| CASS amount | 10 % × VNA (relieved) | the art. 174 alin. (6) top-up stands, with a `NOTA (EXCEPTIE NESTABILITA)` line naming the missing fact |

The relief is neither granted on the status nor refused on its absence: the missing fact is named. When
the receipt fact **is** recorded, the row resolves in the direction the fact points — `received: 'da'` →
`not_applicable`, `received: 'nu'` → `applicable`.

Also now reachable, and previously not:

- art. 174 alin. (8) — a recorded previous-year category or art. 180 alin. (1) option relieves the
  top-up, in `calcCass` and in `applicabilityFor`.
- art. 153 alin. (2) — proved foreign sickness/maternity insurance removes CASS taxpayer quality for
  **both** CASS rows, checked before everything else in `calcCass`.
- art. 174 alin. (2) zero/loss year — the two rows now **split**: `CASS_MAX_BASE` keeps the
  `not_applicable` + art. 174 alin. (2) citation, `CASS_MIN_BASE` reports `unknown` with a Notă de
  interpretare, because whether the 6-SM **difference** survives a zero/loss year is research 25 gap 2
  and must not be settled by inference. The engine still computes 0 lei for the art. 170 alin. (1)
  contribution and says the difference is undecided.
- art. 174 alin. (7) lit. b) — the profile records *that* art. 155 alin. (1) lit. c)-h) income exists but
  holds no amount, so the row reports `unknown` rather than assuming either side.

## 7. Engine input selector (`src/domain/derived.ts`)

`selectTaxDerived` now carries `pensionerStatus`, `pensionReceiptYears`, `pensionSuspensionYears`,
`cassPreviousYearContext` and `foreignSicknessInsurance` into `TaxInputsReference`, normalised to
`null` / `[]` so `canonicalize` keeps the digest stable, and `inputsKey` changes when the receipt fact
changes **independently of status** — the receipt fact is a tax input in its own right.

`src/domain/tax.ts` passes the read facts (not the raw profile) into `calcCass`, and `calcCass`
normalises an absent fact to `'unknown'` once, so the withheld-conclusion notes fire for absent and
explicitly-unknown alike.

## 8. UI (`src/pages/Settings.tsx`)

Six fields on the Regim fiscal tab, each with a hint that cites its own article and says what the app
does **not** conclude: *Calitate de pensionar* (art. 150 alin. (1), explicitly not a CASS ground) ·
*Sume primite ca pensii în anul fiscal* (art. 174 alin. (7) lit. c) + art. 99 alin. (1), explicitly no
value threshold) · *Luni cu pensia suspendată* (fact, no legal effect) · *Excepție art. 154 alin. (1)
lit. a), b), e) sau f) în anul precedent* and *Opțiune CASS (art. 180 alin. (1)) în anul precedent*
(art. 174 alin. (8), list excludes pensioners) · *Asigurare de sănătate în alt stat* (art. 153 alin. (2),
held **and** proved).

Every select offers **`nu înregistrat`** as its first option and an empty selection writes `undefined`
(absent), never `'nu'`. The hint on the status field states that „nu înregistrat” means the app does not
know, not that the person is not a pensioner.

## 9. What did **not** move

- **No seed or e2e money figure changed.** The seed profile is not a pensioner, so no CASS branch
  changes: deductible 120,00 / 144,00 lei, VNA 9.096,00 lei, e2e clock 3.249,00 lei, reserve 1.083,00 lei
  all unchanged — verified by running the suite, not assumed.
- **No stored snapshot digest moved**, and no re-hash migration was added.
- **`CASS_MAX_BASE` never becomes `not_applicable` on any pension fact** — pinned in
  `thresholds.test.ts` and `fiscal.test.ts`.
- The CAS rows keep art. 150 alin. (1) as their ground; only the key's name changed.

## 10. Re-pinned tests (each replaced, none deleted)

- `src/data/store.migration.chain.test.tsx` — chain table gains `[7, 8]`; six `stepsApplied` arrays gain
  `'pension-facts'`; `CURRENT_DATA_VERSION` expectation; four new v7→v8 tests (rename, no receipt
  backfill, already-recorded facts left alone, no stored digest moves).
- `src/data/store.migration.test.ts` — `p.pensionStatus` → `p.pensionerStatus` plus an assertion that the
  new facts stay absent.
- `src/data/store.taxReserve.test.tsx` — one `stepsApplied` array.
- `src/data/store.profileBackfill.test.tsx` — new test: a payload carrying the pre-v8 `pensionStatus` key
  loads, renames and invents no receipt fact.
- `src/data/dashboard.test.ts` — the pensioner row test now asserts `unknown` for `CASS_MIN_BASE` (it was
  `not_applicable`), and a new test pins the relieved case end to end: at `AS_OF_SEED = 2026-12-31` the
  seed reads from actuals, venit brut 7.700,00 − cheltuieli deductibile 120,00 = VNA 7.580,00 lei,
  CASS = 758,00 lei (was the 2.430,00 lei top-up), `CASS_MAX_BASE` still `applicable`.
- `src/domain/profile.test.ts` — `pensionerStatus`, plus the four new facts asserted absent by default.
- `src/domain/derived.test.ts` — `inputsKey` moves with the receipt fact; new facts normalised to
  `null` / `[]`.
- `e2e/settings.spec.ts` — the B-26 round-trip payload now lands at `version: 8`, and the legacy
  `pensionStatus: 'nu'` is asserted to come back as `pensionerStatus: 'nu'` with the old key gone.

## 11. Verification (measured, not inherited)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run test` | **57 files / 984 tests**, all passing (was 56 / 926: +1 file `src/domain/pensionFacts.test.ts`, +58 tests) |
| `npm run build` | exit 0 |
| `npm run test:e2e` | **36 / 36** — `e2e/dashboard.spec.ts` 26 + `e2e/settings.spec.ts` 10, unchanged in count; no spec deleted or skipped |

## 12. Open items this phase deliberately leaves open

- **Research 25 gaps 1, 2 and 3 stay UNVERIFIED** and are *not* resolved by code: suspension (gap 1) is
  recorded with no consequence; the alin. (2) vs alin. (6) question (gap 2) is reported as `unknown` with
  a Notă de interpretare; the evidence ANAF may demand (gap 3) is not named anywhere in the UI.
- The pension-income CASS line (art. 154 alin. (1) lit. h²), 3.000 lei/month) is still not modelled — it
  needs quantum, which is a different computation and a different input.
- `pensionStatus` remains declared as deprecated on `PfaProfile` and in the persisted schema. It can only
  be removed once no supported payload is older than v8.

---

## NEXT HANDOFF

**The exact new profile fields and their types** (`src/domain/models.ts`, all optional on `PfaProfile`,
all declared in `persistedPfaProfileSchema`):

```ts
type PfaYesNo = 'da' | 'nu';
type FactState = 'da' | 'nu' | 'unknown';   // read-side only; never stored

interface PensionReceiptYear      { fiscalYear: number; received: PfaYesNo }
interface PensionSuspensionYear   { fiscalYear: number; months: number[] }
interface CassPreviousYearContext { previousFiscalYear: number;
                                    inExceptedCategory?: PfaYesNo;
                                    optedUnderArt180Alin1?: PfaYesNo }
interface ForeignSicknessInsurance{ fiscalYear: number; held: PfaYesNo; proved?: PfaYesNo }

pensionerStatus?:          PfaPensionStatus;          // 'da' | 'nu' — the art. 150 alin. (1) key
pensionReceiptYears?:      PensionReceiptYear[];      // art. 174 alin. (7) lit. c)
pensionSuspensionYears?:   PensionSuspensionYear[];   // recorded, no consequence drawn
cassPreviousYearContext?:  CassPreviousYearContext;   // art. 174 alin. (8)
foreignSicknessInsurance?: ForeignSicknessInsurance;  // art. 153 alin. (2)
/** @deprecated folded into `pensionerStatus` by the v7→v8 step. No reader exists. */
pensionStatus?:            PfaPensionStatus;
```

Read them through `src/domain/pensionFacts.ts` only — `readPensionerStatus`, `readPensionSumsReceived`,
`readPreviousYearExceptedCategory`, `readPreviousYearArt180Option`, `readForeignSicknessInsuranceProved`,
`readPensionSuspension`, `readCassExceptionFacts`. Do not add a reader for `pensionStatus`: the source
scan in `pensionFacts.test.ts` fails the build if the identifier appears outside `models.ts`,
`schema.ts` and `data/migration.ts`.

**Migration behaviour for old records.** `CURRENT_DATA_VERSION = 8` (`DATA_VERSION_PENSION_FACTS`), step
`pension-facts`. It renames `pensionStatus` → `pensionerStatus` and removes the old key from the live
profile; it mints **no** receipt, suspension, previous-year or foreign-insurance record. A pre-v8 payload
therefore arrives with a status and no receipt fact, which reads `unknown` — the relief is neither granted
nor refused. Stored snapshots are not rewritten and their digests do not move. An old record still loads
and renders (`store.profileBackfill.test.tsx`, and the e2e pre-Phase-6 payload spec).

**Every place a legal conclusion is now withheld:**

1. `CASS_MIN_BASE` applicability — pensioner status recorded, no receipt fact for the year → `unknown`,
   reason = `PENSION_RECEIPT_GAP_NOTE` (cites art. 174 alin. (7) lit. c) + art. 99 alin. (1)).
2. `CASS_MIN_BASE` applicability — zero net income / fiscal loss → `unknown` with a Notă de interpretare
   (research 25 gap 2). `CASS_MAX_BASE` on the same profile stays `not_applicable` on art. 174 alin. (2).
3. `CASS_MIN_BASE` applicability — `salaryStatus: 'da'` with no `salaryIncomeLei` → `unknown` (lit. a)
   needs the amount).
4. `CASS_MIN_BASE` applicability — `otherIncome.length > 0` → `unknown` (lit. b) needs an amount the app
   does not hold).
5. `calcCass` → `reviewRequired` when VNA < 6 SM, `salaryStatus: 'da'` and no salary amount.
6. `calcCass` breakdown notes — `NOTA (EXCEPTIE NESTABILITA)` when status is recorded without a receipt
   fact; a note that the receipt fact is simply unregistered; a `NOTA (FAPTA, NU CONCLUZIE)` naming the
   suspension months with no effect drawn; a note that lit. b) could not be evaluated.
7. `readForeignSicknessInsuranceProved` — `held: 'da'` without `proved` → `unknown`, never the exclusion.
8. The UI hint on *Calitate de pensionar* states that „nu înregistrat” means the app does not know, not
   that the person is not a pensioner.

**What TASK 7 must say about the alin. (2) / alin. (6) uncertainty.** It may reword the Notă de
interpretare, but it must keep three things: that art. 174 alin. (2) switches off the contribution
*potrivit art. 170 alin. (1)*; that art. 174 alin. (6) speaks of a base *corespunzătoare veniturilor
realizate* below 6 SM; and that **the code does not decide whether the difference survives a zero/loss
year** — research 25 gap 2, no primary source, explicitly not to be resolved by inference. It must not
collapse the two rows back onto one citation, must not turn the row's `unknown` into `not_applicable` or
`applicable`, and must not state a lei amount for the undecided difference. The row is rendered from
`applicability: 'unknown'` with the `Aplicabilitate nesigură:` label — that label is the honest surface, so
keep it.

**For TASK 8:** `CASS_MIN_BASE` can now legitimately come back `unknown` for a real profile, so the
prioritisation must render `unknown` as a first-class state (it already has a `severity` of its own from
`severityFor`) rather than treating it as a missing value. A pensioner profile is the common case that
produces it.
