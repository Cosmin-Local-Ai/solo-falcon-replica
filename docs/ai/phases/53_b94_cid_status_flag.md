# 53 — B-94: the CID (EU) 2024/1641 status flag on the 50 % vehicle VAT cut

Written from my own diff. No line numbers, per §12.11 / §12.14.

## (a) The premise was reversed, and this is the section a future reader needs

**B-94 asked what happens to the app's 50 % when Council Implementing Decision (EU) 2024/1641 lapses on
31 December 2026. The question assumed the rule rests on the derogation. It does not.** The 50 % is
**art. 298 alin. (1) Cod fiscal** — a free-standing domestic rule: no date, no sunset clause, no reference
to Directive 2006/112/CE, no reference to any Council implementing decision, and no „autorizată" condition
anywhere in its text. Its only condition is factual. The derogation is what makes the rule *compatible*
with art. 168 of the Directive, not what makes it *exist* (`docs/ai/research/45_cid_2024_1641_vehicle_vat_2027.md`
§4.2, which corrects what `research/42` §3 used to assert in those words).

**The proof is two alineate away in the same article.** art. 298 **alin. (4^1)** — the buildings rule —
*is* expressly conditional on Romania being „autorizată să aplice o măsură specială de derogare de la
dispozițiile Directivei 2006/112/CE…". **Conditional for buildings, unconditional for cars.** The
legislator knows how to write the dependency and chose not to write it here.

**So there was no expiry to handle, and the tempting fix was the defect.** Setting an end date on the
vehicle rule, or adding a rule that switches to 100 % from 1 January 2027, would be wrong under Romanian
law as it stands: repealing art. 298 alin. (1) takes a legislative act. `git diff` shows neither — no
`effectiveTo` anywhere in the diff, and no rule with `effectiveFrom >= 2027-01-01` or `taxYear >= 2027`
was added. `VAT_VEHICLE_ART298_STATUS.anchorEndsOn` is `null` for exactly this reason, and a test asserts
the whole frozen package contains no rule ending on `2026-12-31` and no 2027 successor in it.

**What was actually built is a dated status flag, carried as data and surfaced where the 50 % is already
explained.** Nothing about the arithmetic changed.

## What the flag is

`VAT_VEHICLE_ART298_STATUS` in `src/domain/fiscal/vat.ts`, with `VatVehicleRuleStatus` as its derived type.
It is data, not prose: `anchor`, `anchorEndsOn`, `anchorDependsOnDerogation`, `fraction`, a `derogation`
block (`name`, `celex`, `appliesFrom`, `endsOn`, `endsBy`, `derogatesFrom`), an `extension` block
(`proposedOn`, `instrument`, `file`, `councilDocument`, `wouldEndOn`, `adopted`), `asOf`, `recheckBy`, and
a `postLapse` block (`computed`, `domesticRuleStaysInForce`, `contraryTo`, `deemedSupplyReturns`,
`direction`).

It sits in section 3b of that file — beside the vehicle constants and immediately before the decision that
applies them — and the two branches inside `decideInputVat` that set `fraction = 0.5` each carry a comment
pointing back to it, so the flag is found from the number rather than only from the constant.

**The wording lives in one place.** `src/ui/copy/records.ts` gained `cidStatusHeading`, `cidStatusAnchor`,
`cidStatusDerogation`, `cidStatusExtension`, `cidStatusRisk` and `cidStatusGap` on the existing `vatReturn`
object. Every date and reference is interpolated from the domain object through `formatRoCalendarDate`;
none is typed into a sentence, because a date typed into a sentence is a date nobody re-checks.

**Two surfaces, one producer.** `src/pages/Declarations.tsx` renders the block inside the Form 300 rubric
panel — the page that already puts art. 298 wording in front of the taxpayer through
`D300_DEDUCTIBLE_LINES` — and `src/pages/Dashboard.tsx` renders the identical block inside the
`estimate-input-vat` disclosure, immediately after `dashboardCopy.estimate.inputVat.notOneFormLine`, which
is the sentence that already names „limitarea de 50 % pentru vehicule". Both call the same six functions
over the same object, and `src/pages/vat.cidStatus.surface.test.tsx` asserts the two surfaces produce
byte-identical text. A second spelling of these sentences would be the B-70 defect class.

**Two copy sites the brief named were deliberately left alone.** `src/ui/copy/vehicles.ts` explains the
**income-tax** 50 % — its own wording says „regula generală de 50 % din art. 68 alin. (7) lit. k)” — and
`src/ui/copy/assets.ts` carries two other 50 % strings: `m1ExceptionNoEvidence`, about the *foaie de
parcurs* evidence rule for running costs, and `provenance.vat`, about non-deductible VAT entering a fixed
asset's fiscal value under pct. 28 lit. b) of the Titlul II norms. **None of the three is the art. 298
deduction cut the flag describes**, and putting a VAT-derogation status next to them would merge two
provisions that `research/42` §3 keeps apart. `src/ui/copy/dashboard.ts` was not edited either: its VAT
sentence — `estimate.inputVat.notOneFormLine` — is the one the new block is placed *after*, not one it
duplicates.

## (b) The flag carries its own as-of date, and absence findings expire

„Not adopted" is only true **as of 13 October 2026**. `asOf: '2026-10-13'` is a field, not a comment, and
it is rendered into the sentence the user reads — `…și nu fusese adoptată la data verificării, 13.10.2026`
— so the claim cannot outlive its date without the screen showing the date it was checked at.
`recheckBy: '2026-12-31'` records `research/45` §6's trigger: confirm whether adoption landed before the
derogation's own end.

**The flag says NOT ADOPTED, never REJECTED.** `adopted: false` is an absence finding; nothing in the
Council chain rejects COM(2026) 457 / file 2026/0253(NLE) / ST 13267/2026. This is enforced, not intended:
the first draft of `cidStatusExtension` explained that „neadoptată" does not mean „respinsă" — and the
assertion `expect(text).not.toMatch(/respins/i)` failed on that sentence's own wording. The sentence now
says the file is still open and that the app does not anticipate its fate. The same assertion exists in
both the domain suite and the e2e spec.

## (c) The direction of the risk runs the other way

`postLapse.direction` is `'entitlement_could_be_broader'`, and `cidStatusRisk` says it to the user: if the
derogation lapses unreplaced, art. 298 alin. (1) stays in force but becomes contrary to art. 168, and
**the taxpayer's entitlement could be broader than the app computes, not narrower.** There is no
standstill fallback behind the domestic rule — Art. 394 of the Directive grandfathers only measures
applied at 1 January 1977, unreachable for a 2007 accession state, which is why Romania has needed an
art. 395 authorisation continuously since 2012/232/EU. This is the opposite of the ordinary staleness
failure, where a stale rule over-claims on the state's behalf, and it is stated plainly rather than
buried.

## (d) The deemed-supply gap is recorded, not computed

On lapse, art. 26(1)(a) of the Directive springs back and private use of a business asset becomes a deemed
taxable supply again — CID Art. 3 is what currently disapplies it for 50 %-restricted cars. **This app has
no deemed-supply machinery and none was written.** `postLapse.computed` is `false`, and the only
occurrences of the concept in the diff are the citation string `deemedSupplyReturns` and the sentence
`cidStatusGap` says to the user: „Ce nu calculează aplicația…". Inventing the computation would have been
worse than the acknowledged gap, because an invented deemed supply would enter a tax figure the research
has not verified the Romanian transposition of (`research/45` §7 item 4).

## (e) The release version did not move, and no chain step was added

**Rule package untouched: `package2026.ts`, `rules.ts` and `release2026.ts` have an empty `git diff --stat`,
so the release stays at version 5 and the content hash is unchanged.** The flag is not a rule value. It
carries no parameter any calculator reads, and putting an *expiring* absence finding inside a frozen,
content-addressed release would have been actively wrong: `research/45` §6 requires the flag to be
re-checked and updated, while the immutability and digest suites exist to make the package un-updatable.
A fact that must be revised does not belong inside an artefact whose identity is its digest. The four
pinned rules — `ACCOMMODATION_ART85_ROOMS_2026`, `CEDARE_ART84_2026`, `CEDARE_ART84X1_2026`,
`CEDARE_CONTRACT_REGISTRATION_DEADLINE_2026` — are unmodified.

**No chain step.** The flag is a status about the law, not a new user fact: no stored payload changes
shape, nothing is derived from a record, and no migration would have anything to migrate. The chain head
stays where it was.

## (f) art. 298 alin. (4^1) was left alone, and stays a different animal

alin. (4^1) — the 50 % on residential buildings — **is** expressly derogation-conditional and still not in
force. That is the opposite structure to alin. (1), and merging the two would give one status string to
two alineate with opposite commencement. Its status stays where it is applied, in
`src/domain/fiscal/deductibility2026.ts`, which this pass did not touch. A test asserts the vehicle flag's
own serialisation contains no `4^1`.

## Citation hygiene — the three errors, kept out

- CELEX is **`32024D1641`** — a Decision, not a Regulation. `derogation.celex` carries it, and a test
  asserts `32024R1641` appears nowhere in the flag or its rendered sentences.
- The derogation is from **art. 168 and art. 26 (1) (a)** of Directive 2006/112/CE. `derogatesFrom` says
  exactly that; a test asserts no `168 … 169` pairing appears. art. 169 is untouched.
- The anchor is **art. 298 alin. (1)**, never art. 297 — art. 297 is the general scope article that art. 298
  expressly derogates from. `anchor` is `'art. 298 alin. (1) Cod fiscal'` and a test asserts it does not
  contain `297`. The code already cited art. 298 correctly; the error had been in prose, and stays out.
- **art. 168a is named in the diff only to say it is not the fallback** — it is an immovable-property
  provision and authorises no flat percentage cut-off.

## Files changed

| file | change |
|---|---|
| `src/domain/fiscal/vat.ts` | `VAT_VEHICLE_ART298_STATUS` + `VatVehicleRuleStatus` (new section 3b); a pointer comment at each of the two `fraction = 0.5` branches. No arithmetic touched. |
| `src/ui/copy/records.ts` | six `cidStatus*` keys on `vatReturn`; type import of `VatVehicleRuleStatus`; value import of `formatRoCalendarDate`. |
| `src/pages/Declarations.tsx` | the flag block, `data-testid="vat-cid-status"`, inside the Form 300 panel after `d300NotAFacsimile`. |
| `src/pages/Dashboard.tsx` | the same block inside the `estimate-input-vat` disclosure, after `notOneFormLine`. |
| `src/domain/fiscal/vat.vehicleRuleStatus.test.ts` | new — 14 tests. |
| `src/pages/vat.cidStatus.surface.test.tsx` | new — 4 tests. |
| `e2e/vat-cid-status.spec.ts` | new — 2 tests. |

## Verification

`tsc --noEmit` 0 · **unit 139 files / 2179 tests, all passing** (baseline 137 / 2161 — the delta is
exactly the two new files and their 18 tests; **no existing test moved**) · `npm run build` 0 ·
**e2e 141 passing** (baseline 139 = 131 functional + 8 axe; now 133 functional + 8 axe) · copy-guard
`ALLOW_LIST` still empty · the seed estimate pins at **311.200 bani** still pass, unmoved ·
`git diff --stat` empty for `src/domain/fiscal/vatPeriodicity.ts`, `src/domain/fx/`, `package2026.ts`,
`rules.ts`, `release2026.ts`, `src/domain/date.ts`, `src/test/clock.ts`, `src/test/fixedInstant.ts` and
`src/data/migration.ts`.

Acceptance 1 — the one that matters most — is pinned three ways: a FY2027 vehicle line asserts
`fraction: 0.5` with `rule: 'art. 298 alin. (1); Norme pct. 68 alin. (4)'` and a `claimableTotal` of half
the VAT; 2026, 2027 and 2028 are asserted to produce identical outcomes for identical facts; and the
decision's fraction is asserted equal to `VAT_VEHICLE_ART298_STATUS.fraction`.

## Deviation, recorded per §12.12

Scout A named `src/data/dashboardAdapter.ts`; the file is `src/data/dashboardAdapter.tsx`. The report was
therefore treated as untrusted in full and the territory was covered directly with a bounded grep over the
identifiers it named, every hit followed by reading. Everything else it named exists and checked out.

## Left open

- **The flag expires.** `recheckBy: '2026-12-31'` is a standing instruction, not a completed one: re-check
  EUR-Lex 32024D1641 „Subsequent related instruments" and the OJ in the last week of December 2026. If the
  Council adopts, `extension.adopted` and `asOf` change and the sentences change with them — no arithmetic
  does.
- **Retroactivity if adoption slips past 31 December 2026** is unquantified (`research/45` §7 item 2): the
  draft takes effect on notification and carries no backdating recital of the kind CID 2024/1641 had.
- **The deemed-supply gap** under art. 26(1)(a) stays unimplemented by decision, and is now visible to the
  user as a stated limit rather than only in a phase doc.
- **art. 298 alin. (4^1)** carries its own, genuinely different, pending-authorisation staleness risk and
  was not touched here.
