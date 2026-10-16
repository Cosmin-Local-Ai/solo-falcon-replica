# Phase 21 — the user-facing language layer (TASK 7)

Date: 2026-10-09 (`date +%F`). Brief: `docs/ai/briefs/23_task7_language_layer.md`.
Baseline at handoff: `tsc` 0 · **62 files / 1076 tests** (was 61 / 1071) · `build` 0 · **e2e 36 passed** (26 dashboard + 10 settings, unchanged).

---

## 1. What existed before

There was no copy layer. Every Romanian sentence was inline in a component or a page. Consequences that were
visible on screen:

- `src/pages/Settings.tsx` printed the literal token `review_required` next to statute paragraphs.
- `src/components/dashboard/checkLabels.ts` plus four `checkLabel` fallback maps existed only because the
  words had no home; each site could invent its own.
- The deductibility dropdown rendered internal keys (`protocol`, `personal_or_family_use`,
  `mandatory_professional_contribution`) as option labels.
- `src/data/types.ts` spelled `Înregistrată` and `Respinsă` three times (`REV_STATUS_LABEL`,
  `EXP_STATUS_LABEL`, `DECL_STATUS_LABEL`) and carried the Documente section labels (`title`, `desc`,
  `helper`) below the data layer, where no language test could reach them.
- The same sentence existed twice in the copy layer itself once the layer was built — the guard test found
  both (see §4).

## 2. The copy layer: `src/ui/copy/`

**Location and why.** A UI-layer home, never inside `src/domain`: the domain produces computed legal facts
(a threshold `consequence`, an `applicabilityReason`, a tax line label) with a citation attached, and
`src/domain/thresholds.language.test.ts` already pins that wording where it is produced. Moving those into
`src/ui/copy` would separate a legal conclusion from the code that derives it. So the boundary is:

- **domain sentences stay in the domain** (engine output, pinned by the domain's own language test);
- **UI sentences live in `src/ui/copy`** (labels, prompts, empty states, validation, disclosures, notes).

**Addressing.** `copy.<surface>.<key>`, camelCase, keyed by the surface that speaks. A key reads as a
sentence's location: `copy.reserve.noEstimate`, `copy.thresholds.warningBandPolicy`, `copy.notes.capReading`.
Parameterised sentences are **functions**, not `%s` templates, so TypeScript checks the call site. Where
markup has to survive inside a sentence (an amount inside a `<strong>`, an interpolated date), the sentence
is split into `…Lead` / `…Tail` fragments so the DOM keeps the shape the tests and the screen reader depend
on.

**Modules** (`src/ui/copy/index.ts` re-exports every name explicitly — no `export *` — so the public surface
is visible in one place):

| module | exports |
| --- | --- |
| `common.ts` | `ui`, `disclosure`, `noteLabel`, `fields`, `validation`, `empty`, `nav`, `shell` |
| `dashboard.ts` | `dashboard`, `chart`, `summary`, `insights`, `reserve`, `actions`, `deadlines`, `completeness`, `legislation`, `moneyPrecision`, `CHECK_LABELS`, `checkLabel`, `deadlineAppliesToLabels`, `actionAppliesToLabels` |
| `thresholds.ts` | `thresholds`, `thresholdStatusLabels`, `measuredBasisLabels`, `thresholdDomainLabels`, `thresholdRowLabels`, `thresholdKindLabels` |
| `notes.ts` | `notes` (16 keys), `sources` (15 keys) |
| `provenance.ts` | `provenance`, `severity` — **keys for TASK 8 and TASK 9, not wired by TASK 7** |
| `settings.ts` | `settings` |
| `records.ts` | `revenues`, `expenses`, `expenseCategoryLabels`, `clients`, `declarations`, `recordStatus`, `documents`, `eFactura` |

`copy` is also exported as one namespaced object for call sites that prefer `copy.x.y`.

**De-duplication done at the source, not by convention:**

- `REV_STATUS_LABEL` / `EXP_STATUS_LABEL` / `DECL_STATUS_LABEL` deleted from `src/data/types.ts`. The words
  now exist once, in `copy.recordStatus.revenueLabels / expenseLabels / declarationLabels`; the status codes
  stay in the data layer, and `statusBadge` (code → colour) stays too, because that is presentation logic,
  not language.
- `DOC_SECTIONS` keeps `code`, `icon`, `allowMultiple`. Its `title` / `desc` / `helper` moved to
  `copy.documents.sections`, keyed by the same `DocTypeCode`.
- `App.tsx` spelled the eight nav labels twice (`NAV` and `TITLES`). `copy.nav` feeds both;
  `TITLES: Record<Page, string> = nav`.
- `copy.expenseCategoryLabels` is typed `Record<ExpenseCategory, string>`, so a new category in the rule set
  is a compile error rather than a raw key on screen. All 35 categories are named.

## 3. No enum token reaches the UI

Every one of these now goes through a label map before it can be rendered: `review_required`, `computed`,
`breached`, `min-base`, `not_applicable`, `tier_transition`, `over_limit`, `pinned`, `drifted`,
`unregistered`, `unpinned`, plus the 35 `ExpenseCategory` keys and the `Depunere` values (`SOLO`,
`personală`).

`Settings.tsx` no longer shows `review_required`: the row reads **„De verificat"**
(`copy.thresholdStatusLabels.review_required`) with one sentence saying what is uncertain and what to do, and
the statute text sits behind the sources disclosure with the citation kept.

The four `checkLabel` fallback maps and `checkLabels.ts` were deleted: a label map that falls back to the raw
token is how an enum reaches the screen, and `ThresholdKind` / `ThresholdStatus` / `MeasuredBasis` /
`ThresholdDomain` are now covered by exhaustive `Record<…>` maps in the copy layer.

## 4. The guard test — `src/ui/copy/copy.guard.test.ts`

Follows the precedent of `thresholds.language.test.ts` and the `registry.test.ts` source-tree scan. Sources
come in through Vite's raw glob, not `node:fs` — this is a browser app with no `@types/node`. The scan is
AST-based (`typescript` is already a dev dependency), so comments, import specifiers and property names are
never mistaken for user-visible text.

Four properties, five tests:

1. **Coverage of the guard itself** — the scanned set must be non-trivial and must contain known files, so a
   moved directory cannot silently shrink it to nothing.
2. **No sentence in a component or page.** A literal is *sentence-shaped* when it has ≥2 alphabetic tokens of
   ≥3 letters **and** either a Romanian diacritic or a known Romanian function word. This is deliberately not
   a blunt ban: `btn btn-ghost`, `1px solid var(--border)`, `badge-warning`, `RJIP_2026.csv` pass through.
3. **No internal `snake_case` token rendered** as JSX text or as a `title` / `placeholder` / `aria-label` /
   `alt` / `label` / `summary` value.
4. **No sentence spelled twice inside the copy layer** (≥4 word tokens; short shared labels like `Data` as a
   column header are normal UI language).
5. **The allow-list earns its place** — an entry that no longer matches a real violation must be deleted.

**Allow-list contents: empty.**

```ts
const ALLOW_LIST: readonly string[] = [];
```

It may only shrink, and an entry needs a reason recorded in this file. TASK 7 finished the sweep instead of
parking exceptions, so the list is at its minimum.

**What the guard found on its first run** (both fixed, not allow-listed):

- `„Tipul declarației este obligatoriu"` in `common.ts` **and** `records.ts` → `records.ts` now references
  `validation.declarationTypeRequired`.
- `„Nu este obligatoriu să incluzi datele tale de contact în e-Factura."` in `notes.ts` **and** `settings.ts`
  → the unused `sources.eFacturaContact` was deleted; `settings.eFactura.contactHint` is the one home.

It also caught a leftover JSX sentence in `Documents.tsx` (`Niciun document încărcat.`) and, while the
detector was being tuned, a false positive on the import specifier `'../domain/date'` — which is why `date` is
deliberately absent from the Romanian word list and module specifiers are skipped.

## 5. The „Notă de interpretare" pattern — one component

`src/components/ui/InterpretationNote.tsx`

```ts
export interface InterpretationNoteProps {
  note: string;       // one plain sentence: what the law does not state, and what the app does about it
  citation?: string;  // the provision the note rests on, kept visible
  id?: string;
  className?: string;
}
```

Rendered as `role="note"` with `data-note="interpretare"`, the label from the copy constant `noteLabel`
(„Notă de interpretare"), so no site renames it. Two rules by construction: the label is a constant, and
`note` is one sentence from `copy.notes.*`. **A note may explain an uncertainty; it may never resolve one.**
Sites: `ThresholdSection` (3 direct), `Expenses` (2 direct — the art. 68 alin. (6) pre-cap / post-cap choice
and the cap-conflict banner), and `Settings`, where the local `FieldLegal` wrapper renders it for **22** field
sites. The sites that previously improvised their own wording now all pass through the one component.

## 6. Disclosure, never hover

`src/components/ui/Disclosure.tsx`

```ts
export interface DisclosureProps {
  label: string;        // always copy: `disclosure.breakdown` or `disclosure.sources`
  children: ReactNode;
  defaultOpen?: boolean; // false: the detail is collapsed, not hidden
  className?: string;
  id?: string;
}
```

Native `<details>` / `<summary>`: keyboard-operable with no script, state visible and announced, content
present in the DOM when closed. Captions are `copy.disclosure.breakdown` („Cum am ajuns la această sumă") and
`copy.disclosure.sources` („Surse și note de interpretare"). Five direct uses — `Dashboard`, `Settings`,
`Expenses`, `ThresholdSection`, `MoneyPrecisionNotice` — and no `title=` tooltip or CSS `:hover` reveal is used
anywhere for this content (`grep ':hover' src/*.css` finds no display/opacity/visibility reveal).

## 7. Grammar sweep — phrases changed and why

Reference fix: `nu înregistrat` → `nu este înregistrat` (`76f480b`, TASK 5). Kept as `copy.ui.answerUnrecorded`
and the rule is written into `common.ts`: a negated past participle needs an auxiliary.

| was | now | why |
| --- | --- | --- |
| `2 sume nu au putut fi reproduse exact.` | `Sumele nu au putut fi reproduse exact.` (and `O sumă nu a putut fi reprodusă exact.`) | a bare noun without the definite article is not Romanian for "the sums"; the singular also agrees the participle |
| `Nimic nu necesită atenție` / `fără atenție` as a status | `nu necesită atenție imediată` (`severity.none`) | the old phrasing read as "without attention"; it now says what is not needed and when |
| `necesită puțină atenție`, `atenție medie` | `prioritate scăzută`, `prioritate medie`, `prioritate ridicată` | "attention" is not a property of a row; the word must say what the person should do, and a level must not sound like a milder spelling of the next one |
| `doar „Contribuția este datorată" este…` run on without quoting | `Dintre cele trei valori, doar „Contribuția este datorată" este un temei confirmat pentru un PFA; celelalte două lasă linia de verificat și nu schimbă calculul.` | the label and the verb collided into unreadable Romanian; the label is now quoted and the sentence parses |
| `lectura care dă deducerea cea mai mică`, `care lectură se aplică`, `cealaltă lectură, post-plafon`, `celeilalte lecturi` | `interpretarea…`, `care interpretare se aplică`, `cealaltă interpretare`, `celeilalte interpretări` | „lectură" is a book-reading word; a legal reading is an „interpretare". Fixed in the three domain strings in `src/domain/fiscal/deductibility2026.ts` and in the copy keys |
| `3 item de rezolvat` / `1 item` / `4 item` | `3 elemente de rezolvat` / `1 element de rezolvat` | an English plural dropped into Romanian; the numeral also has to agree |
| `Nicio document încărcat.` | `Niciun document încărcat.` | gender agreement: *document* is neuter |
| `Fișierul depășește 2 MB…`, `Maxim 2 MB` | `Fișierul depășește ${MAX_MB} MB…`, `Maxim ${MAX_MB} MB` | not grammar but the same class of defect: the number in the message was not the number the code enforces (`MAX_DOC_BYTES` is 5 MB). The message is now derived from the constant |

Also removed: the `checkLabels.ts` fallback wording, which had drifted from the labels the dashboard actually
used.

## 8. e2e re-pins (every one replaced, none deleted)

| file | old | new |
| --- | --- | --- |
| `e2e/dashboard.spec.ts:370` | `getByText('3 item de rezolvat')` | `getByText('3 elemente de rezolvat')` |
| `e2e/dashboard.spec.ts:862` | `expect(hero.getByText(/51\.510/)).toBeVisible()` | `expect(hero.locator('.tax-hero-value')).toHaveText(/51\.510/)` |

The second is not a wording change: the Estimare impozit section now also carries the breakdown disclosure,
which repeats the same figure in a table row, so the bare `getByText` became a strict-mode violation. The
assertion is scoped to the hero element and the figure is unchanged — `51.510,00 RON`.

Unit-test re-pins, same rule (replaced, recorded):

| test | old | new |
| --- | --- | --- |
| `ActionSection.test.tsx` | `'1 item de rezolvat'`, `'4 item de rezolvat'` | `'1 element de rezolvat'`, `'4 elemente de rezolvat'` |
| `MoneyPrecisionNotice.test.tsx` | `'2 sume nu au putut fi reproduse exact.'` | `'Sumele nu au putut fi reproduse exact.'` |
| `Expenses.capExplanation.test.tsx` | `Legea nu stabilește care lectură se aplică`, `/cealaltă lectură, post-plafon: …/` | `…care interpretare se aplică`, `/cealaltă interpretare, post-plafon: …/` |
| `ThresholdSection.test.tsx` | severity wording | `copy.severity` wording |

No assertion was deleted, no matcher loosened, no timeout widened. Figures did not move: seed deductible
120,00 / 144,00 lei, VNA 9.096,00 · impozit 819,00 · total 3.249,00 · reserve 1.083,00 · hero 51.510 lei all
still pass.

## 9. The reserve landmine

`DashboardSnapshot.taxReserve.currentReserveBani` is **unchanged** (`Bani`, still `?? (0 as Bani)` in
`src/data/dashboard.ts`). The precondition in the brief is "if any copy names the amount the user has
reserved". It does not: no UI path reads that field. The card renders
`TaxReserveRecommendation.reservedAmount`, which is already `Bani | null` since TASK 3, and the null-vs-0
distinction is asserted in `src/components/TaxReserve.test.tsx` — *"renders an unrecorded reserve as 'no
reserve recorded', never as 0,00 lei"* and *"renders an explicit 0 lei reserve as a real amount, distinct from
the unrecorded state"*. `copy.reserve` has a separate key for the unrecorded state, so the UI cannot print
`0,00 lei` for a person who recorded nothing.

**Recommendation for TASK 8/9:** if a card ever starts reading the snapshot aggregate instead of the
recommendation, widen `currentReserveBani` to `Bani | null` first. The `?? 0` is currently confined to
arithmetic and documented at the call site.

## 10. Keys TASK 8 and TASK 9 must use

**TASK 8 (prioritisation, severity, rendering)** — `copy.severity: Record<ThresholdSeverity, string>` in
`src/ui/copy/provenance.ts`: `none` = „nu necesită atenție imediată", `low` = „prioritate scăzută", `medium` =
„prioritate medie", `high` = „prioritate ridicată". TASK 7 supplies the words; ranking and styling stay
TASK 8's. Also `copy.actions.count(n)` (the only place the count is phrased), `copy.actions.emptyDescription`
/ `emptyBody`, and `copy.deadlines` / `copy.completeness` / `copy.legislation` for section bodies. TASK 8
should not add a new sentence inline — the guard test will reject it.

**TASK 9 (provenance)** — `copy.provenance` in the same file, all four states plus two invariants:
`pinned(releaseId)`, `drifted`, `unregistered(releaseId)`, `unpinned`, `noRelease`,
`label` („Regulile din spatele acestei cifre") and `digestIsNotACitation`. The last one is the rule written
into the copy: a digest is a content address, never a legal citation, so the article stays on screen next to
it. Open it with `copy.disclosure.sources` and the `Disclosure` component.

## 11. Validation

- `npx tsc --noEmit` → 0
- `npm run test` → **62 files / 1076 tests passed** (baseline 61 / 1071; +1 file and +5 tests are the guard)
- `npm run build` → 0
- `npx playwright test` → **36 passed** (26 dashboard + 10 settings)

## 12. Findings worth carrying

- The upload limit and its message had drifted (message said 2 MB, `MAX_DOC_BYTES` is 5 MB). Fixed by
  deriving the sentence from the constant.
- `src/data/types.ts` carried user-visible labels; the status label maps were dead code and the document
  section labels were unreachable from any language test. Both moved.
- The pi-lens LSP server in this environment kept a stale module graph for `src/ui/copy/` and reported
  `has no exported member` for names that `npx tsc --noEmit` resolves (exit 0) and that the Vitest suite
  imports at runtime. The barrel was switched from `export *` to explicit named re-exports, which cleared it.
  Treat `tsc` + the suite as authoritative here.

## 13. Post-audit wording fixes (2026-10-09, after the user audited the copy)

The user audited the Romanian and the logic of `src/ui/copy/` directly. The architecture held; the wording
had real defects. Applied on the user's authority — semantics, `unknown` handling and every figure unchanged.

### Fixed — verifiable defects

| key | was | now | why |
| --- | --- | --- | --- |
| `notes.runRateProjection` | `pentru întreaga an` | `pentru întreg anul` | gender error: *an* is masculine. Made to agree with `measuredBasisLabels['annual-projected']`, which already read `întreg anul` — the user confirmed that form is correct, so `notes.ts` moved, not `thresholds.ts` |
| `notes.runRateProjection` | `nu o sume încasată` | `nu o sumă încasată` | the singular article `o` with the plural `sume` — number disagreement |
| `sources.foreignInsuranceProof` | `din Cod fiscal` | `din Codul fiscal` | definite article required |
| `sources.foreignInsuranceProof` | `exceptia nu produce nimic` | `excepția nu produce nimic` | missing ț |
| `sources.salarySixSm` | `Sub acest prag diferența de 2.430 lei se datorează` | `Sub acest prag se datorează diferența până la baza de 6 salarii minime brute — 10 % din acel deficit, deci maximum 2.430 lei în 2026, valoare atinsă doar când baza este zero.` | **factual error in user-facing text**: 2.430 lei is the maximum of `10 % × (6 SM − baza)`, reached only when the base is zero. The old sentence stated the ceiling as the amount owed |
| `sources.salarySixSm` | `(art. 118 alin. (2) lit. b))` as a bare parenthetical | the article quoted: `art. 118 alin. (2) lit. b) o exclude expres („cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin. (6)”))` | the citation was challenged as unverified. **It is verified** — `docs/ai/research/21_expense_deductibility_framework_2026.md` quotes art. 118 alin. (2) lit. b) verbatim and that text expressly excludes the alin. (6) difference; the same doc's legislative history (OUG 128/2024, applicable „începând cu veniturile aferente anului 2025") puts it in force for FY2026. Kept, now with the words that carry it |
| `sources.pensionSuspension` | `Faptă înregistrată, fără efect juridic:` | `Fapta consemnată; efectul juridic nu este stabilit de nicio prevedere verificată` | the old wording asserted as fact that there is **no** legal effect. What is verified (research 25 gap 1) is that no verified provision **states** one. `Fapta` per the user |
| `sources.eFacturaDeadline` | `Termenul legal de transmitere a unei e-Facturi este de maximum 5 zile de la emitere.` | `OUG 120/2021 art. 10 alin. (7): termenul-limită pentru transmiterea unei facturi în sistemul național RO e-Factura este de 5 zile lucrătoare de la data emiterii facturii (modificat de OUG 89/2025 pct. 2 art. X, în vigoare de la 01-01-2026).` | a statute sentence in the **sources** block with **no citation at all**, and an ambiguous unit. Cited and unit fixed from `docs/ai/research/16_efactura_term_and_fiscal_term_computation_2026.md` §Q2 (CONFIRMED, verbatim, Portal Legislativ doc 310662, consolidare 01.06.2026): **zile lucrătoare**, not calendaristice. No deadline-engine change — `src/domain/deadlines.ts` carries no e-Factura deadline (grep: zero occurrences) |
| `thresholdKindLabels.over_limit` | `plafon` | `prag maxim` | one concept, two names on one screen: `thresholdRowLabels['max-base']` already reads `Prag maxim …`. `over_limit` is the 72-SM ceiling on the CASS base (art. 170 alin. (1)), i.e. that same row. Stays distinct from the `min-base` rows (research 24 must-not-state 7). Not rendered today — `thresholdKindLabels` has no `.tsx` consumer — so this is a forward fix for TASK 8, and no test moved (`thresholds.test.ts:337` pins `plafon` in the **domain** consequence sentence, untouched) |
| `thresholds.ts` header + `thresholdDomainLabels` | claimed every map is exhaustive | states plainly that this one is not | `FiscalThreshold.affectedDomain` is an open `string` in `src/domain/thresholds.ts` (`// e.g. 'pfa-revenue'`), so `Record<string, string>` is forced and `ThresholdSection.tsx:92` keeps a `?? t.affectedDomain` fallback — the leak path the header claimed was gone. Closing `affectedDomain` to a union is a domain change and was not made here |

### Left as-is, awaiting the user's native-speaker judgement

Raised in the audit and deliberately **not** changed, so the call stays with the user. Proposed wording is
given so a yes/no settles each.

| key | current | proposed |
| --- | --- | --- |
| `notes.cassZeroYear` | `raportează diferența ca nedeasă` | `ca nedecisă` — the participle of *a decide* is *decis*; `nedeasă` looks like a nonword |
| `sources.regimeOffered` | `… art. 123 alin. (1). impozit pe profit nu este oferit: …` | starts lowercase after a full stop → `Impozitul pe profit nu este oferit` |
| `notes.previousYearRoute` | `Art. 174 alin. (8) cere o faptă din anul precedent` | a provision does not "ask for a fact" → `se întemeiază pe o faptă din anul precedent` |
| `notes.warningBand` | `nu primește nicio citare legală` | calque → `nu are nicio bază legală` |
| `notes.cassFlagUnverified` vs `notes.applicabilityUndecided` | `lasă linia de verificat` / `marchează linia ca fiind de verificat` | one state, one phrasing — unify on the second |
| `provenance.*` | `digest`, `digestului`, `adresării prin digest` | developer jargon in user-facing Romanian → `amprentă` / `amprenta de conținut`; `unpinned` especially needs a rewrite a non-developer can follow. Keep `digest` / `contentHash` in identifiers and comments |
| `thresholds.description` | `Praguri fiscale față de valorile curente` | incomplete phrase → e.g. `Praguri fiscale măsurate pe valorile înregistrate acum` |
| `sources.establishmentDate`, `sources.vatExceedanceDate` | `Necompletat = …` | no `=` in prose → `Dacă nu se completează, …` |
| `sources.capReadingChoice`, `records.capAppliedReading` | `«înregistrată»` | the app's own quote style is `„…”` → `„înregistrată”` |

Explicitly **not** changed, on the user's ruling: `întreg anul` (correct as it stands), `nici o parte`
(*nici* + the indefinite article = „not even one part", which is what the sentence asserts), `Codul CAEN`
(the articulated form of *cod CAEN*, standard business usage) and `Fapta este încasarea din an, nu statutul.`
in `sources.pensionReceipt` (the legal register is right in the statute-text block).

**Re-run after these edits:** `tsc` 0 · guard 5 tests pass · `npm run test` **62 files / 1076 tests**
(unchanged — no assertion moved, because no test pinned any of the changed strings) · `npm run build` 0 ·
`npx playwright test` **36 passed**.
