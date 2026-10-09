# User decisions — record

Running log of decisions the **user** made, what was asked, what they chose, and how it was implemented. Distinct from `docs/ai/decisions/07_*` and `09_*`, which are step-era spec documents. Where a decision is not yet implemented, that is stated rather than implied.

Evidence is a commit or a file path. `—` means not yet built.

---

## 2026-10-10 — FX and currency (TASK 10), four questions asked by the Orchestrator

### D-FX-1 — Where do FX rates come from?
**Asked:** local-first app with no network layer; the art. 68 caps need the BNR annual average (`CURSA_EURM`), which is **obtainable, not computable**; daily rates moved to `curs.bnr.ro` on 6 Aug 2026; no FY2026 annual average exists yet.
**Options offered:** verified seed + manual entry / manual entry only / **fetcher behind a boundary**.
**User chose: fetcher behind a boundary.**

**Implemented** (`8732e3f`): `src/domain/fx/provider.ts` — `FxRateProvider` with `dailyRate` and `annualAverage`, both synchronous. Loading is `loadDailyRates`; manual entry is `manualAnnualAverage` and remains the fallback. BNR XML client in `src/domain/fx/bnrXml.ts`. **No test performs a network call** — tests use `fixtureRateProvider`.
**Honest limitation, recorded not hidden:** „XSD-validated" is a **structural validator**, not XSD conformance — there is no XSD processor in the dependency set. Stated in code and in `phases/24_currency_fx_store.md`, **not claimed on screen**.

### D-FX-2 — How is a foreign-currency amount stored?
**Asked:** defect B-32 — `Revenue`/`Expense` carry no currency field and money is integer RON `Bani` end to end. Options: bolt a currency field onto the RON number, or a **multi-currency money type**.
**User chose: multi-currency money type.**

**Implemented** (`84dda5b`): `src/domain/money.ts` — `interface Money<C extends CurrencyCode = CurrencyCode> { amount: Bani; currency: C }`, `CURRENCY_CODES = ['RON','EUR','USD','GBP','HUF']`, integer minor units, `RonMoney = Money<'RON'>`. Arithmetic is per currency (`addMoney` / `subMoney` / `sumMoney` / `maxMoney`) and **mixing currencies is a `tsc` error** through `addMoney<A, B extends A>`; `requireRon` is the explicit boundary. Persistence: data version **10**, chain step **`record-currency`**, which stamps `RON` on existing records — a **value-preserving no-op**, because those records were always treated as RON.
**The digest question, answered with evidence rather than assumption:** `canonicalize` emits every own key, but it is handed `inputSnapshot`, and `CalculationInput` is `{ profile, revenues: Bani, expenses: Bani }` — **aggregate lei totals, not record arrays**. A currency on a record is unreachable from the digest bytes, so **no stored `inputsHash` moved and no `preMigrationInputsHash` was written**. The two ways it *could* have moved (a `PfaProfile` field, an `inputSnapshot` key) were deliberately not done.

### D-FX-3 — A payment or collection falls on a day BNR publishes no rate
**Asked:** research 23 Q3 is UNVERIFIED as a general rule — BNR publishes only on banking days, CF art. 9 alin. (4) requires a rate „valabil pentru datele respective" but never defines *valabil*, and „ultima zi bancară anterioară încasării" occurs **exactly twice in the whole Codul fiscal** (art. 68^3 alin. (4), art. 85 alin. (4)). Options: refuse / carry forward labelled as policy / ask the user for the rate.
**User chose: carry forward, labelled as app policy.**

**Implemented** (`8732e3f`, `b54d756`): `src/domain/fx/carryForward.ts`; the rate record carries `carriedFrom?`, and `convertToRon(...)` returns `carriedForward`. Surfaced through the existing `InterpretationNote` component as **application policy by analogy from art. 68^3 alin. (4) / art. 85 alin. (4)** — never as a statute sentence.

### D-FX-4 — Do the euro caps compute, or only become representable?
**Asked:** the seven art. 68 alin. (5) euro caps are excluded as unmeasurable; for FY2026 the required annual average does not exist, so any 2026 cap is provisional (B-33). Options: compute only when a rate exists / **also compute provisional 2026 caps**.
**User chose: also compute provisional 2026 caps.**

**Partly implemented.** 10a built the representation: `provisional` on the rate record, and `RateStore.replace` keyed by `rateKey` as the provisional → final mechanism. **The caps themselves are TASK 10b** — `docs/ai/briefs/27_task10b_euro_caps_provisional_rates.md`.

---

## Decisions from the same round that are not FX

### D-SEED-1 — How far does TASK 9 go on declaration-shaped seed facts?
**Asked by the Worker.** The seed asserted quarterly D100/D220 filings that are not obligations for this profile (research 06: D212 replaced 232 and 220; research 12: art. 120/120¹ abrogated from 01-01-2025, one operative 25 May annual deadline). Options: minimal / **seed-only, quarterly removed** / model change.
**Orchestrator chose B**, with three conditions the user's brief did not contain: **no invented nil returns** (there is no monthly obligation either, so a nil return would replace one fictional obligation with another); the annual D212 must not manufacture a second deadline; gross 205,50 lei and deductible 120,00 lei stay visibly distinct.
**Implemented** (`76b50ca`): `declarations: []`; the quarterly artefacts became the one return this profile files, **D212 for 2025, filed 20.05.2026**; no nil return minted. Two model defects **recorded, not fixed** — **B-34** (`Declaration` is monthly `{an, luna}` and cannot hold an annual filing) and **B-35** (D300 periodicity is undetermined by the seed's own facts). The plan's CUI-collision claim **does not reproduce** and is recorded as stale.

### D-TEST-1 — Browser-level reserve reload test
**User decision, 2026-10-09.** TASK 3 proved the round trip in jsdom against real `localStorage`; a Playwright test exercises a real browser's storage lifecycle.
**Implemented** (`dd7f812`): new spec, deliberately **no `addInitScript`** — it re-runs on reload and would make the round trip vacuous. **e2e 36 → 37**, and every document pinning 36 was updated.

### D-SCOUT-1 — Scout concurrency
**Asked:** the updated roadmap permits parallel Scouts. **User chose: keep sequential** — „scout concurrency remains the same as we are doing right now. its better."
**Implemented:** every brief since carries rule 4 as an explicit override with the reason (one engine slot, ~390 MiB headroom, two Workers SIGKILLed mid-run), so no future Worker re-litigates it.

### D-LANG-1 — Three Romanian rulings against the Orchestrator's audit
The Orchestrator's language audit was **wrong three times**; the user corrected it. Recorded because the wording was deliberately left alone:
- **„fapta"** is attested Romanian, the legal/judicial register (*fapta prevăzută de legea penală*) — finding withdrawn.
- **„Codul CAEN"** is the articulated form of *cod CAEN*, standard business usage — finding withdrawn.
- **„nici o parte"** with *nici* as intensifier plus the article *o* means „not even one part" — finding withdrawn.
**Implemented:** the Worker left all three unchanged and parked **nine wording calls** for the user's native judgement in `phases/21_language_layer.md` §13, rather than changing them on the Orchestrator's authority.

### D-SCOPE-1 — Where this round stops
**User:** „We stop after task 10." Updated **Phases 11–34** were supplied and mapped in `docs/ai/roadmap_11_34_mapping.md`, but are **not started**.

---

## Still open — to be put to the user
1. **Severity vocabulary** — keep `none | low | medium | high` (what ships) or map back onto `info | warning | danger` as Phase 19 asks. Both cannot exist.
2. **Rule `version` numbers** — the roadmap wants revisions bumped off `version: 1`; TASK 6 left all 48 at 1 because bumping them would invent unreconstructable history.
3. **Phase docs location** — `docs/ai/phases/` (current) vs the roadmap's `docs/ai/steps/NN_*.md`, which would overwrite unrelated frozen files.
4. **First-run seed (D1 in the mapping)** — a clean install is handed `seedData` and never told. Should it start empty, or with a clearly-labelled demo the user chooses?
5. **The nine parked Romanian wording calls** in `phases/21_language_layer.md` §13.
