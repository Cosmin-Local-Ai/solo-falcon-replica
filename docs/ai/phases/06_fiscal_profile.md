# Phase 6 — Fiscal regime + profile foundation

Worker: Phase 6 only. Date: 2026-10-06.
Scope authority: `docs/ai/PLAN.md` (Phase 6 section). Defect context: `docs/ai/STATE.md` B-9, B-13, B-14, B-15.
Sources of record used: `research/08_art118_income_tax_2026.md`, `research/09_u8_amendment_scan_and_optare.md`,
`phases/02_fiscal_baseline.md` §4. **`research/06_2026_fiscal_research.md` was never cited** (non-authoritative).

---

## 1. What this phase was for

Three things, and nothing else:

1. Make the **fiscal regime** an explicit model: exactly one regime is computable for a PFA in 2026,
   the others are refused with a reason, and the UI never offers an impossible one (B-9, B-14).
2. Make the **profile editable and persisted** — before this phase `updateProfile` had zero UI
   callers, so every fiscal input was frozen at seed values (B-9).
3. Give the engine the input the CASS 6 SM test actually needs, so a **salaried PFA below the floor
   gets a computed estimate instead of `REVIEW_REQUIRED`** (B-13's remaining half).

Out of scope and untouched: schema `version` + migration chain (B-11/B-12, Phase 7), identity
unification (B-8, Phase 7), amount semantics / VAT threshold basis (Phase 8), date semantics
(Phase 9), money & rounding policy (B-17, Phase 10). The CAS/CASS/income-tax **arithmetic** (rates,
bases, ladders, caps) from Phases 3–5 was not changed — `calcCass` gained only the art. 174 alin. (7)
lit. a) **branch** (§6), i.e. a decision-table change driven by a new input, not a rate or base change.

**Not delivered from the PLAN's own Phase 6 list** (recorded, not hidden): the 24 SM `tier-floor`
threshold surface (§7 item 5), rules that key on CAEN (§7 item 8) and a VAT regime richer than the
boolean `vatExempt` (§7 item 9). Each was declined because the 2026 sources of record give nothing to
cite for it, or because it needs a threshold-type change that belongs to Phase 7/9.

---

## 2. Legal basis (verbatim, 2026 income year)

| Provision | Text relied on | Effect in code |
|---|---|---|
| CF art. 123 alin. (1) | PFA income determined in the Titlul IV sistem real | the only selectable+computable regime |
| CF art. 13 alin. (1), art. 14, art. 15 | Titlul II (impozit pe profit) applies to **persoane juridice** | `impozit_pe_cit` is never selectable for a PFA |
| CF art. 120 — **Abrogat** (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff. 01.01.2025) | the option to owe profit tax is gone | no "PFA may opt for CIT" path exists |
| CF art. 68 alin. (1) | the closed exception list is art. 68^1, 68^3, 69 | `norma_venit` is a **boundary**, not a computable regime |
| CF art. 118 alin. (6) | „veniturile din activități agricole definite la art. 103 alin. (1), pentru care sunt stabilite norme de venit" are excluded from alin. (1)-(5) | the only verified mention of norms; no norm **values** exist in the sources |
| CF art. 174 alin. (6) | „o diferență de contribuție … până la nivelul celei corespunzătoare bazei de calcul egale cu 6 salarii minime brute pe țară" | top-up 2.430 lei when 0 < net < 24.300 lei |
| CF art. 174 alin. (7) lit. a) | „Diferența … prevăzută la alin. (6) **nu se datorează** în cazul în care, în anul fiscal …, persoana fizică a realizat venituri: a) din salarii și asimilate salariilor la un nivel cel puțin egal cu 6 salarii minime brute" | the test is **numeric** → the profile must carry the amount |
| CF art. 174 alin. (7) lit. c) (Legea 141/2025 Art. I pct. 34, MO 699/25.07.2025) | „venituri din pensii, definite conform art. 99" | removes only the alin. (6) difference; evaluated **before** lit. a) (no monetary threshold) |
| CF art. 174 alin. (2) | zero net / fiscal loss ⇒ no CASS | upstream of every relief |
| CF art. 156 | CASS cota **10%** | never 16% |
| CF art. 118 alin. (2) lit. b) | deducts contributions „cu excepția diferenței de contribuție … prevăzută la art. 174 alin. (6)" | the top-up stays non-deductible |
| CF art. 118 alin. (3) | „Veniturile … ce se realizează într-o fracțiune de an … se consideră venit anual" | a mid-year start does **not** prorate the base |
| CF art. 170 alin. (1) | ceiling 72 SM = 291.600 lei | unchanged from Phase 3 |

SM 2026 = 4.050 lei (HG 1.506/2024); 4.325 lei from 01.07.2026 (HG 146/2026) — this does **not**
re-anchor the 2026 annual bases, so 6 SM = 24.300 lei for the whole 2026 income year.

---

## 3. The regime model — one source of truth

New file **`src/domain/regimes.ts`**:

- `PFA_REGIME_VALUES: [PfaRegime, ...PfaRegime[]]` — also feeds `z.enum()` in `domain/schema.ts`,
  so the schema and the model cannot drift apart.
- `PFA_REGIME_DESCRIPTORS` — per regime: `label` (UI wording), `selectable`, `computable`, `note`
  (the legal reason).
- `isComputableRegime`, `isSelectableRegime`, `selectableRegimes()`, `regimeRefusalReason()`.

| Regime | selectable | computable | why |
|---|---|---|---|
| `impozit_pe_venit` | yes | yes | CF art. 123 alin. (1) + art. 118 sistem real |
| `impozit_pe_cit` | **no** | **no** | Titlul II is for persoane juridice (art. 13 alin. (1), 14, 15); art. 120 Abrogat |
| `norma_venit` | **no** | **no** | no norm rule in the 2026 package, no norm values held — **nothing invented** |

Design decisions:

- The three union members are **kept parseable**. Deleting `impozit_pe_cit` from the union would
  make an old payload invalid, and an invalid payload destroys the whole dataset (§4). Refusal
  belongs in the engine, not in the parser.
- `regimeRefusalReason('impozit_pe_cit')` keeps the exact wording Phase 5 pinned (unit + e2e):
  „nu poate aparține unui PFA", `art. 13 alin. (1)`, `art. 14`, `art. 15`, `art. 120`, `abrogată`.
  It is a **data-integrity** failure, not "a different base applies" (B-14).
- An **unknown** regime string (defensive: the schema already rejects it) is refused, not computed.
  Found while testing: `regimeRefusalReason` used to return `null` for an unrecognised regime,
  which would have let the gate fall through. Fixed in this phase.
- The regime list exists in exactly one place. The three consts briefly added to `models.ts`
  (`COMPUTABLE_PFA_REGIMES` etc.) were **removed** — a second literal list is the same
  second-source-of-truth failure Phases 3–5 removed.

---

## 4. The profile contract, and the data-loss trap

`pfaProfileSchema` (`src/domain/schema.ts`) declared **every field required**. `data/schema.ts:129`
validates the persisted profile through it, and `store.tsx:109-114` answers *any* invalid payload by
returning `seedData` for the **entire dataset**, silently. So adding a *required* profile field would
have made every existing `pfa-app-data-v2` payload fail validation — the user loses all revenues,
expenses, clients and declarations with no message.

**Rule applied: every new profile field is `.optional()`, with no default invented.**

| Field | Type | Required | Legal basis | Engine use |
|---|---|---|---|---|
| `pfaStartDate` | `string` `YYYY-MM-DD` | **optional** | CF art. 118 alin. (3) | adds the line „Fracțiune de an (art. 118 alin. (3)): venit anual"; base **not** prorated |
| `salaryIncomeLei` | `number` ≥ 0, finite | **optional** | CF art. 174 alin. (7) lit. a) | decides the 6 SM test in `calcCass`; **never** passed to `calcCas` |
| `salaryStatus` | `'nu' \| 'da'` | required (pre-existing) | — | gate into the lit. a) branch |
| `regime` | `z.enum(PFA_REGIME_VALUES)` | required (pre-existing) | art. 123 alin. (1) | regime gate |
| others | unchanged | unchanged | — | — |

`TaxInputsReference` (`src/domain/derived.ts`) carries both new fields as `number | null` /
`string | null` and the selector fills `?? null`, so `inputsKey` (a canonical hash of the inputs)
stays stable and a profile edit invalidates the cached calculation instead of reusing it.

Regression proof: **`src/data/store.profileBackfill.test.tsx`** (9 tests) loads a payload whose
profile has *no* `pfaStartDate`/`salaryIncomeLei` keys and asserts `dataOrigin === 'persisted'` and
that revenues/expenses/clients/declarations are **non-empty and byte-identical** — not merely that
the app rendered. It also proves the validation is still live (a malformed `pfaStartDate` or a
negative `salaryIncomeLei` does fall back to seed), because optional-ness has to be a deliberate
choice, not an accident.

---

## 5. The UI write path (B-9)

New Settings tab **`Regim fiscal`** (`src/pages/Settings.tsx`), registered in `App.tsx`
`VALID_TABS.settings` so the route `/settings#!/fiscal` is canonical.

- Writes through `const { profile, updateProfile } = useStore()` — the first real caller of
  `store.tsx:213` in the app's history. Persistence is the existing `useEffect` at `store.tsx:143-152`.
- The regime `<select>` is built from `selectableRegimes()`, so `impozit_pe_cit` and `norma_venit`
  are **not offered**. If a stored payload already holds a non-selectable regime, the tab shows the
  refusal text and marks the stored value as a disabled option — visible, not re-selectable.
- Fields: regime, CAEN, start year, fiscal year, start date, salary status + **salary amount**,
  pension status, CASS status, VAT exemption, cash floor.
- Validation follows the `Revenues.tsx` pattern (`errors: Record<string,string>`, `.invalid`,
  `.error`). A salary without an amount is rejected in the UI for the same reason the engine halts:
  the 6 SM test cannot be evaluated without the number. Setting salary to `nu` clears the amount
  instead of leaving a stale value behind.
- Not touched: identity/personal fields and the `settings.company` ↔ `profile` duplication
  (both Phase 7 / B-8).

---

## 6. Salaried PFA below the 6 SM floor (the input Phase 4 could not evaluate)

`calcCass` (`src/domain/fiscal/calculators.ts`) previously returned `reviewRequired` whenever
`salaryStatus === 'da'` and net income was under 6 SM — because the profile carried no salary
amount, and art. 174 alin. (7) lit. a) is a **numeric** condition („cel puțin egal cu 6 salarii
minime brute"), not a status flag. With `salaryIncomeLei` supplied:

| Case (net 20.000 lei, 2026) | CASS | Deductible | Taxable | Total |
|---|---|---|---|---|
| salary 30.000 lei (≥ 24.300) | **2.000** (10% × net, art. 174 alin. (1)) | 2.000 | 18.000 | **3.800** |
| salary 24.300 lei (boundary, „cel puțin egal") | 2.000 | 2.000 | 18.000 | 3.800 |
| salary 20.000 lei (< 24.300) | **2.430** (10% × 6 SM, alin. (6) difference owed) | 2.000 | 18.000 | **4.230** |
| salary amount absent | `REVIEW_REQUIRED` — refuses to guess | — | — | — |

Branch order is deliberate: **pension relief (lit. c) is evaluated before salary relief (lit. a)**
because lit. c) has no monetary threshold, so it is certain exactly where lit. a) cannot be
evaluated. Neither relief touches the 10% × net contribution itself — alin. (7) removes only the
alin. (6) *difference*, and only the difference is non-deductible (art. 118 alin. (2) lit. b)).
`salaryStatus` is never passed to `calcCas`: art. 150 alin. (2) covers only art. 148 alin. (2)
lit. b¹), not salaried persons generally.

---

## 7. Deliberately NOT implemented (open gaps, recorded not fixed)

1. **B-15's activity-source gap is still open.** The art. 118 alin. (2^2)/(2^3) proration ratios and
   the alin. (2^4) cap are implemented (Phase 5), but the app still has **no multi-source activity
   model** — `otherIncome` is a flag list, not income with a source. A single-source PFA keeps
   ratio = 1. Adding a multi-source model would require inventing legal categories, which is out of
   scope per the brief.
2. **`chosenBase` is still unwired.** `TaxInputsReference.chosenBase` exists but no UI sets it; the
   art. 180 alin. (1) CASS **option** (with its term) and the art. 180 alin. (2) base remain
   unmodelled. They are surfaced only as an `OPTIUNE NEMODELATA` breakdown line, and only on the
   VNA ≤ 0 path (`fiscal/calculators.ts:202`) — elsewhere the option is simply absent.
3. **`pensionStatus` is a flag, but art. 174 alin. (7) lit. c) requires „venituri din pensii
   … REALIZATE" in that fiscal year.** A stored status flag cannot prove income was realised. The
   code says so in the breakdown; the model is still a flag.
4. **`socialInsuranceStatus` `'exempt'` / `'neplata'` zero CASS with no verified basis.** CF
   art. 154 alin. (1) was never retrieved in the sources of record. The UI now labels this
   explicitly as unverified. Do not treat those values as evidence of a legal exemption.
5. **The 24 SM CAS tier-floor surface was deferred from Phase 3 to Phase 6 and was NOT built.**
   `src/domain/thresholds.ts` still has `ThresholdType = 'min-base' | 'max-base' | 'registration' |
   'income'`; expressing the art. 148 alin. (2) ladder floors (12 SM / 24 SM) needs a new
   `ThresholdType` plus UI label maps. Left as an explicit open item rather than half-built.
6. **`pfaStartDate` is not fed to deadlines.** It only produces the art. 118 alin. (3) line.
   Deadline semantics are Phase 9 territory.
7. **No `version` field, no migration chain** (B-11/B-12, Phase 7). Optional fields are what keep
   old payloads loading today; a migration chain is still the correct long-term answer.
8. **No rules key on CAEN.** The PLAN asked for "rules that key on CAEN". CAEN is now user-writable
   (`Settings.tsx:529`) and still round-trips, but the engine reads no CAEN-keyed rule — the 2026
   package names **no CAEN → rule mapping** to cite, and the only place CAEN would matter legally is
   the norm-of-income regime, which this package refuses (item in §3). Inventing a CAEN table would be
   fabrication, so the item is left open rather than half-built.
9. **The VAT regime is still the boolean `vatExempt`.** The PLAN asked for "a VAT regime richer than
   the boolean". The boolean is now user-writable (`Settings.tsx:640`) and still drives the gross/net
   choice at `tax.ts:87-88`; no richer regime (scutit / încarcare taxară / taxă pe din afara) was
   invented, because the 2026 thresholds and treatment for those variants are not in the sources of
   record. Related open question: the VAT turnover basis (Q-NETGROSS, Phase 8).

---

## 8. Tests and validation

Measured 2026-10-06 after this phase (Phase 5 baseline: tsc 0 · build 0 · **489 unit / 36 files** · **24 e2e**):

- `npx tsc --noEmit` → **0 errors**
- `npm run build` → **exit 0**
- `npm run test` → **531 passed / 38 files** (+42 tests, +2 files)
- `npm run test:e2e` → **29 passed** (+5)

New / extended:

| File | Added |
|---|---|
| `src/data/store.profileBackfill.test.tsx` (new) | 9 — pre-Phase-6 payload keeps collections non-empty; new fields accepted when present; malformed values still rejected |
| `src/domain/regimes.test.ts` (new) | 10 — one computable regime, `selectableRegimes()` length 1, refusal wording cites provisions, unknown regime refused |
| `e2e/settings.spec.ts` (new) | 5 — profile edit round-trips through reload; invalid save rejected; legacy payload keeps revenues/expenses; both 6 SM branches compute on the dashboard |
| `src/pages/Settings.test.tsx` | +6 — fiscal tab: regime options, persistence, remount restore, salary-without-amount, stale amount cleared, negative cash floor |
| `src/domain/tax.test.ts` | +7 — both salary branches at engine level, amount-absent halt, `norma_venit` refusal, `impozit_pe_cit` wording, mid-year line ×2 |
| `src/domain/fiscal/fiscal.test.ts` | +6 — `calcCass` salary branches incl. the 24.300 boundary and pension-before-salary order |
| `src/domain/derived.test.ts` | +4 — the new fields reach the engine inputs, default to `null`, and change `inputsKey` |

Incidental fixes needed to keep the build clean (pre-existing lint blockers in `App.tsx`):
`SAFETY:` comment for the `inert` double assertion, keyboard handler + `role` on the nav overlay,
`type="button"` on the nav toggle. No behaviour change intended.

---

## 9. Provenance

- Regime impossibility for a PFA: `research/08_art118_income_tax_2026.md` (art. 13 alin. (1),
  art. 14, art. 15; art. 120 Abrogat by OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024).
- Norm-of-income boundary only: art. 68 alin. (1) closed exceptions (68^1, 68^3, 69) and
  art. 118 alin. (6) — **no norm values were retrieved**, so none were invented.
- art. 174 alin. (6)/(7) text and the lit. c) amendment (Legea 141/2025 Art. I pct. 34,
  MO 699/25.07.2025): `phases/02_fiscal_baseline.md` §4 and `research/09_u8_amendment_scan_and_optare.md`.
- art. 156 10% rate, art. 170 alin. (1) 72 SM ceiling, art. 118 alin. (2) lit. b) carve-out:
  `phases/02_fiscal_baseline.md` §4 / `research/08`.
- U-8 / OPTARE scan (art. 180 option unmodelled): `research/09_u8_amendment_scan_and_optare.md`.
- **Contradiction with archived step files:** `docs/ai/steps/10_profile_domain.md:57` defines the
  regime union as only `'impozit_pe_cit' | 'impozit_pe_venit'`. This phase widens it to three
  members and makes `impozit_pe_cit` non-selectable — the archived step is superseded, and archived
  step files are not evidence.

---

## 10. Traps for the next reader (Phase 7+)

1. **Any new required profile field is a data-loss event.** `store.tsx:109-114` resets the whole
   dataset to seed on any validation failure. Add fields as `.optional()` and keep
   `store.profileBackfill.test.tsx` green; when Phase 7 adds `version` + migrations, that test is
   the safety net the migration chain must not silently replace.
2. **`addInitScript` re-runs on reload.** An e2e that seeds localStorage and then reloads will
   re-apply the seed payload over anything the UI just saved — the round-trip assertion then proves
   nothing. The Phase 6 round-trip test deliberately does not seed.
3. **`salaryIncomeLei` is CASS-only.** Passing it to `calcCas` would invent a pension exemption
   that art. 150 alin. (2) does not grant.
4. **CASS rate is 10% (art. 156).** The 16% string is a dead Phase 2 artefact.
5. **`makeInputs` in `tax.test.ts` defaults `salaryStatus: 'da'`.** A test with net < 24.300 and no
   `salaryIncomeLei` now halts in `REVIEW_REQUIRED`; pass `salaryStatus: 'nu'` or an amount.
6. **`playwright.config.ts:9` "No overload matches this call" is LSP-only**, not a defect — do not
   "fix" it.
7. `profile.caen` (engine) and `settings.company.caen` (Settings → PFA tab) are still **two
   disconnected sources**; unifying them is B-8 / Phase 7.
