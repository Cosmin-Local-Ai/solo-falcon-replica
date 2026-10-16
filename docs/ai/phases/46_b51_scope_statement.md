# 46 — B-51: the scope statement

**Task:** brief `docs/ai/briefs/49_b51_scope_statement.md`. **Defect closed:** **B-51** — no statement anywhere in
user-facing copy that this is decision-support, not tax advice, and not a filing.
**Defect explicitly NOT closed here:** **B-56**. See §6.

Written from this task's own diff, with no line numbers (§12.11). Every path and identifier named below appears
in that diff or in a file opened during the task.

---

## 1. The defect, re-measured before touching anything

The brief's claim was checked rather than inherited. A grep for `consultan`, `nu constituie`, `informativ`,
`răspunder` across `src/` returned three hits, and all three are comments or identifiers, not copy:

- `src/ui/copy/onboarding.ts` — a doc comment about a software consultant;
- `src/domain/scenarios.ts` and `src/domain/activityFamily.test.ts` — the same sentence about a software
  consultant, in comments.

So the defect stands as written: **zero user-facing sentences**. Nothing in the app said what the figures are.

That silence sits on top of a claimable-VAT total that is filed nowhere (D-VAT-3), a Form 300 rubric whose
lines are deliberately drawn without values (B-98), and figures the corpus records as INFERRED or CORROBORATED
rather than FACT.

## 2. The statement

One key, in the shared half of the language layer: `scope` in `src/ui/copy/common.ts`, exported from
`src/ui/copy/index.ts` (added to the named re-export, the matching import, and the `copy` namespace object —
the three places every other copy group is listed).

Card title:

> **Estimări, nu declarații**

Sentence:

> **Cifrele de aici sunt estimări: le calculăm din ce ai introdus și din regulile anului fiscal respectiv.
> Nimic nu se depune și nimic nu se trimite la ANAF din acest cont — declarația o depui tu, la ghișeu sau în
> SPV. Un consultant fiscal și ANAF pot ajunge la o altă cifră, iar o cifră de aici poate fi greșită pentru că
> legea se schimbă în timpul anului. Temeiurile legale ale calculelor sunt afișate, iar calculele sunt
> testate; totuși ele nu înlocuiesc consultanța fiscală.**

Why each clause is there, and why nothing else is:

| Clause | What it has to do |
|---|---|
| „sunt estimări … din ce ai introdus și din regulile anului fiscal respectiv" | The figures are computed, not measured, and the input is the person's own records. Naming the fiscal year's rules also sets up the fourth clause honestly. |
| „Nimic nu se depune și nimic nu se trimite la ANAF din acest cont — declarația o depui tu, la ghișeu sau în SPV" | The scope boundary, stated as a negative and then handed back to the taxpayer. „SPV" is already house vocabulary (`src/ui/copy/attention.ts`, „Verifică statusul transmiterii în SPV."). |
| „Un consultant fiscal și ANAF pot ajunge la o altă cifră" | Not a substitute for a consultant or for the ANAF window — said as a fact about disagreement, not as a legal boilerplate disclaimer. |
| „o cifră de aici poate fi greșită pentru că legea se schimbă în timpul anului" | The honest reason a figure can be wrong. |
| „Temeiurile legale ale calculelor sunt afișate, iar calculele sunt testate" | The anti-undersell clause. The arithmetic in this app is cited and tested; a disclaimer that made it sound like a toy would be its own defect. This clause comes **before** the last one, so the sentence states what the work rests on before it states what it does not replace. |
| „totuși ele nu înlocuiesc consultanța fiscală" | The required non-substitution, closing the sentence. |

Deliberately absent, per the brief's landmines:

- **No filing, sending or guaranteeing verb in the affirmative.** The only filing verbs in the sentence are
  negated („Nimic nu se depune") or the taxpayer's own action („declarația o depui tu"). This is B-56's
  discipline applied in reverse, and it is pinned by a test, not just by intent (§5).
- **No product self-reference.** No „software", no „program", no „acest produs". The subjects are „cifrele",
  „calculele" and „declarația" — what the reader can and cannot rely on, not what the thing is called.
- **No English calque and no legalese.** „nu constituie", „în scop informativ", „fără răspundere" are all
  absent; the sentence uses the informal address the house settled on in D-LANG-3.
- **No accuracy promise.** It says the bases are displayed and the calculations are tested. It does not say
  the figure is right, and it does not say the figure is a guess.

## 3. Where it lives, and why those two surfaces

Two surfaces, one key, rendered verbatim from both:

1. **`src/pages/Onboarding.tsx`** — a `Card` titled `scopeCopy.title` placed after `copy_.intro` and before the
   sandbox card, i.e. before the form and before any figure exists on screen. This is where expectations are
   set: the person has not yet trusted a number, so the sentence costs nothing and cannot be read as a caveat
   about one.
2. **`src/pages/Settings.tsx`** — the same `Card`, first in the `tab === 'data'` branch, above
   `settingsCopy.data.card`. That tab already answers „where do these numbers come from"
   (`settingsCopy.data.originPersisted` and its siblings), so the durable statement belongs beside the
   provenance answer, not in a footer nobody opens.

**No third surface.** The Dashboard was considered and rejected: the brief allows it only if the sentence is
short enough not to compete with the hero, and this sentence is four clauses long precisely because it must
not undersell the arithmetic. A shortened dashboard variant would have meant a second string, which is the
drift the duplicate-sentence test in `src/ui/copy/copy.guard.test.ts` exists to stop. Two surfaces, one
statement, no hedge repeated beside individual figures.

Both paragraphs carry `data-scope-statement` and **no class**. `.muted` is B-52 at 4.43:1 against a 4.5
requirement, and `.hint` sits on the same low-contrast token ladder (`--text-4`, `--text-3` in
`src/styles.css`); an unclassed `<p>` inherits the body colour `--text`, which is the highest-contrast token
in the file. Axe will look at whatever is added, so nothing was added that it could fail on.

## 4. What was **not** touched

`git diff --stat -- src/domain/ src/data/` returns **empty**. No fiscal constant, no rule, no citation, no
calculation, no digest, no release version bump, no migration step. `src/domain/fiscal/release2026.ts` was not
opened for editing and not modified — a rule-note edit there moves `contentHash` and forces a version bump,
which is not what this brief is for.

The seed estimate is unchanged: the suite that pins **311.200 bani** passes unmodified.

`src/ui/copy/copy.guard.test.ts` was read before any copy was written, and `ALLOW_LIST` is still
`const ALLOW_LIST: readonly string[] = [];`. The new sentence lives in the copy layer and both call sites
import the key, so no new inline literal exists in a page and no allow-list entry was needed.

## 5. Tests

**New unit file — `src/pages/scope.statement.test.tsx`** (4 tests):

- the statement renders on the first-run screen, and the rendered text equals `scope.statement`;
- it renders again in Settings on the Date tab, from the same key, with the same wording — the assertion is
  equality against the one key, so a second hand-written copy of the sentence on either surface fails;
- the sentence still says the four things it exists to say, asserted as stable fragments: `sunt estimări`,
  `ce ai introdus`, `nu se depune`, `consultant fiscal`, `ANAF`, `legea se schimbă`,
  `calculele sunt testate`;
- it claims no filing, no transmission and no guarantee: `am depus`, `am trimis`, `vom depune`,
  `vom trimite`, `garantăm` must all be absent, while `nimic nu se depune` and `declarația o depui tu` must
  be present. This is the B-56 discipline as a machine check.

**e2e — two new functional tests, one per surface:**

- `e2e/first-run.spec.ts`, in the fresh-profile describe: on a brand-new profile the statement is visible and
  contains `sunt estimări` and `Nimic nu se depune`;
- `e2e/settings.spec.ts`, new describe: at `/settings#!/data` the statement is visible, contains the same two
  fragments, and after `page.reload()` still contains `consultanța fiscală` — reachable again, from the same
  route, which is what makes it a durable statement rather than a first-run message.

Both specs assert fragments, not the whole paragraph. The content pins live in the unit file.

**One iteration was needed:** the first e2e run failed both new tests because `toContainText` is
case-sensitive and the fragment was written `nimic nu se depune` while the sentence opens that clause with
`Nimic`. Fixed in the specs, not in the copy.

## 6. B-51 closes. B-56 does not.

**B-51 is closed by this task.** There is now a scope statement in user-facing copy, in Romanian, reachable
from two surfaces, produced by one key.

**B-56 is not touched, and must not be read as fixed.** B-56 is the success-message defect: messages that
claim operations the app does not perform. This task deliberately did not go near them — fixing them would
have widened a small task into a medium one, and the brief says so. The consequence is worth stating plainly,
because it is now visible rather than latent:

- the new sentence says **Nimic nu se depune și nimic nu se trimite la ANAF din acest cont**;
- B-56's messages say the opposite, in the app's own voice, at the moment of the action.

That contradiction is real and it is B-56's to resolve. The correct fix is to change the success messages, not
to soften this sentence: the sentence is the true one. Whoever picks up B-56 should expect
`src/ui/copy/settings.ts` (`eFactura.connected`) and the declaration success wording to be where the conflict
lives, and should expect the new `scope` key to be the reference for what the app is allowed to claim.

## 7. Counts, before → after

| | before (baseline at `c7ab77a`) | after |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| unit tests | 132 files / 2027 tests | **133 files / 2031 tests**, all passing |
| `npm run build` | 0 | 0 |
| e2e | 123 (118 functional + 5 axe) | **125 (120 functional + 5 axe)**, all passing |
| copy-guard `ALLOW_LIST` | empty | empty |
| seed estimate | 311.200 bani | 311.200 bani |

The axe gate's routes are unchanged — `e2e/a11y.spec.ts` still scans `/dashboard`, `/declarations`,
`/documents#!/occupancy`, `/assets` and `/documents#!/fixed-assets`, and the fiscal Settings tab remains
scanned-but-not-in-the-gate for the pre-existing label debt that file records. This task added no axe route
and changed no markup those scans cover.

## 8. Files changed

- `src/ui/copy/common.ts` — new `scope` group (`title`, `statement`) with the reasoning recorded in its doc comment.
- `src/ui/copy/index.ts` — `scope` added to the named re-export, the import, and the `copy` namespace.
- `src/pages/Onboarding.tsx` — imports `scope as scopeCopy`; renders the statement as a card after the intro.
- `src/pages/Settings.tsx` — imports `scope as scopeCopy`; renders the same card first in the `data` tab.
- `src/pages/scope.statement.test.tsx` — new.
- `e2e/first-run.spec.ts`, `e2e/settings.spec.ts` — one new functional test each.

## 9. Left open, on purpose

- **B-56** — untouched, §6.
- **D-6 in `docs/ai/USER_DECISIONS.md`** — „who owns the disclaimer and terms wording" is still listed as an
  open user decision. This sentence is the house voice, written to the brief's four requirements; if the user
  wants it reviewed by a fiscal consultant, `scope` in `src/ui/copy/common.ts` is the single place to change,
  and the fragment pins in `src/pages/scope.statement.test.tsx` are what will need re-wording with it.
- **Terms of use / a legal page** — out of scope. The brief asked for one statement, not a legal section.
- **B-52** — the contrast ladder. This task avoided it rather than fixing it; the new paragraph is unclassed.
