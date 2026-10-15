import type { FiscalRule, RuleRelease } from './rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
// B-112 stage 1 — the DPI rules land on this release, which is what the release exists for.
import { DPI_RULES_2026 } from './dpi2026';
import { ruleSetDigest } from './ruleSetDigest';

/**
 * B-112 — the FY2026 rule package **plus the DPI income path**, and the release that supersedes
 * `PFA_2026_SYSTEM_REAL` v5 to carry it.
 *
 * **Why a new releaseId at all, rather than an edit.** `registry.register` refuses to re-register a
 * `releaseId` whose rule set hashes differently (`RuleReleaseImmutableError`): *„An ACTIVE release is
 * never edited in place — a revision gets a new releaseId and the old one is superseded."* The DPI rules
 * are formula-bearing content, so adding them to `PFA_2026_SYSTEM_REAL` is exactly the in-place edit that
 * gate exists to make impossible. The id is named for what the revision **adds**, not for its number, so a
 * reader in 2027 can tell from the identifier alone why a second FY2026 release exists.
 *
 * **What this package carries at the moment of minting: the same 54 rules as v5, byte-for-byte.** That is
 * deliberate and staged. The DPI rules arrive on top of this release in the following stages; minting the
 * release first is what keeps v5 frozen at the digest it already has. The consequence is stated plainly
 * rather than hidden: while the two rule sets were identical, `ruleSetDigest` gave them the **same** digest,
 * so `entryByContentHash` resolved to whichever was registered first (v5) and the two releases were
 * distinguishable only by `releaseId` and `version`. The registry does **not** reject a content-identical
 * release under a new id — it only rejects a *different* rule set under an id already registered — and no
 * filler rule was added to force a difference. That staged state is pinned by a test rather than left to be
 * rediscovered.
 *
 * **Stage 1 ends that state.** `DPI_ART72_2026` (see `./dpi2026`) now rides on this package, which separates
 * the two digests: the FY2026 revision is addressable by content as well as by name, and a snapshot can be
 * pinned to a rule set that actually contains the DPI rule. Nothing inherited from v5 was edited — each of
 * the 54 keeps its parameters, citations and `version: 1` byte-for-byte, and the registry's per-rule digest
 * check would have thrown otherwise.
 *
 * ## The effective dating, and why the boundary is 1 January
 *
 * `selectRuleSet(taxYear, asOfDate)` resolves through `activeEntry`, and `checkSingleActive` forbids two
 * ACTIVE FY2026 releases with overlapping windows. So the two windows must partition the year, and where
 * the cut falls is a legal question, not a formatting one.
 *
 * **The engine's own as-of date is 1 January of the fiscal year** — `tax.ts` computes
 * `const asOf = `${inputs.fiscalYear}-01-01``, and `snapshots/ruleProvenance.ts` `engineAsOf` reproduces
 * exactly that pairing. Every calculation this app runs therefore selects its rules at 1 January. A
 * revision opened at, say, 2026-10-14 would be selected by **no** engine call at all: every FY2026
 * calculation would keep resolving v5, and the DPI rules would be dead data.
 *
 * That is the right answer, not an obstacle to work around. The DPI rules are not a mid-year amendment —
 * art. 72, art. 72¹, art. 73, art. 137 alin. (1) lit. b¹), art. 148 alin. (3), art. 155 alin. (1) lit. c),
 * art. 170 alin. (2)-(4) and art. 174¹ are FY2026 law, in force for the whole of the FY2026 income year.
 * What changed on the `createdAt` date is the app's **record** of that law, not the law. So the revision
 * opens at `2026-01-01`, exactly as v1–v5 each did (v5 carries `effectiveFrom: '2026-01-01'` beside a
 * `createdAt` of 2026-10-13 — the house convention is that `effectiveFrom` is when the law bites and
 * `createdAt` is when the record was made; see `docs/ai/phases/20_rule_release_immutability.md` §4).
 *
 * v5 is therefore superseded with `effectiveTo: '2025-12-31'`: its window closes the day before the
 * revision's opens, so **no `asOfDate` selects two FY2026 releases at once**, and no `asOfDate` in 2026
 * selects v5. That is not v5 being deleted — it is v5 ceasing to be the answer to *"which FY2026 law is in
 * force?"*, which is precisely what superseding means. v5 stays registered, deep-frozen, readable by
 * `releaseId` forever, and every snapshot pinned to it still resolves its own rules and reproduces its own
 * number. That is the audit trail, and `release2026dpi.test.ts` proves it end to end rather than asserting
 * it in a comment.
 *
 * ## The lifecycle walk, and why it is written in this order
 *
 * `register` runs `checkSingleActive` only for a release handed in as ACTIVE, and v5 is ACTIVE until it is
 * superseded. So the order is forced: register the revision `SCHEDULED`, supersede v5, then `advance` the
 * revision to ACTIVE — one legal ladder step, with no moment at which two ACTIVE FY2026 windows overlap.
 * The seeding lives in `registry.ts`, beside the v5 seed, so there is one place that answers *"what does
 * this build carry?"*.
 */
export const PFA_2026_DPI_PACKAGE: FiscalRule[] = [...PFA_2026_SYSTEM_REAL_PACKAGE, ...DPI_RULES_2026];

/**
 * The `releaseId` of the revision. Named for what it adds — the *drepturi de proprietate intelectuală*
 * income path (CF art. 70, 72, 72¹, 73; CAS art. 137 alin. (1) lit. b¹) and art. 148 alin. (3); CASS
 * art. 155 alin. (1) lit. c) and art. 170 alin. (2)-(4) + art. 174¹) — so the reason for a second FY2026
 * release is legible from the identifier itself.
 */
export const PFA_2026_DPI_RELEASE_ID = 'PFA_2026_DPI_INCOME_PATH';

export const PFA_2026_DPI_RELEASE: RuleRelease = {
  releaseId: PFA_2026_DPI_RELEASE_ID,
  name: 'PFA 2026 system-real package + DPI income path (art. 70, 72, 72¹, 73)',
  jurisdiction: 'RO',
  entityType: 'PFA',
  taxYear: 2026,
  // Registered SCHEDULED, then advanced to ACTIVE by `registry.ts` immediately after v5 is superseded.
  // See the lifecycle note above: registering it ACTIVE would trip `checkSingleActive` against a v5 that
  // is still ACTIVE at that moment.
  lifecycle: 'SCHEDULED',
  version: 6,
  contentHash: ruleSetDigest(PFA_2026_DPI_PACKAGE),
  // The revision names the whole FY2026 set, not a DPI-only fragment: a release that named only its new
  // rules would leave the 54 it inherits unselected, and `validate` refuses the mismatch in both
  // directions. The DPI rule ids are appended in the following stages.
  ruleIds: PFA_2026_DPI_PACKAGE.map((r) => r.ruleId),
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  createdAt: '2026-10-14T12:00:00+03:00',
  evidence: [
    // Cod fiscal, consolidated — the articles the DPI path rests on: art. 70 (defining DPI), art. 72 and
    // art. 72¹ (the 40 % forfetară quota and the withholding), art. 73 (the actual-expense election),
    // art. 137 alin. (1) lit. b¹) and art. 148 alin. (3) (CAS), art. 155 alin. (1) lit. c) and art. 170
    // alin. (2)-(4) + art. 174¹ (CASS — the base is alin. (3), the cumulation alin. (4); OUG 128/2024 moved
    // the ladder off the old alin. (5), see research/50), art. 118 alin. (2²)-(2⁴) (the apportionment),
    // art. 135¹ alin. (3) (the 1 January SMN anchor).
    'https://legislatie.just.ro/Public/DetaliiDocument/312601',
    // ANAF DGRFP București, „Noutăți privind Declarația Unică 2026 – exemple" — Exemplul 3, the worked
    // example this path is pinned to (AI net 68.000 + DPI net 50.000 → bază CAS 97.200 → CAS 24.300).
    'https://static.anaf.ro/static/10/Bucuresti/Noutati_privind_DU_2026_exemple.pdf',
    // ANAF DGRFP Cluj, 12 Feb 2026 (the DPI forfetară quota includes the social contributions owed) and
    // 22 Apr 2026 („!!! Veniturile din activități independente nu se cumulează cu alte venituri pentru
    // determinarea obligației de plată a CASS.").
    'https://static.anaf.ro/static/10/Cluj/continut/2026/noutati_dpi_2026.html',
    // OPANAF 2736/2025 — the D212 instructions that route DPI net, CAS reținută (art. 151 alin. (9)) and
    // CASS reținută (art. 174¹ alin. (6)) to their subsecțiuni. Row numbers are release-scoped and are not
    // encoded as stable identifiers anywhere.
    'https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf',
  ],
  notes:
    'B-112. This release supersedes PFA_2026_SYSTEM_REAL v5 and is its revision, not a second FY2026 ' +
    'regime: v5 keeps its rules, its digest and its releaseId unchanged and stays readable forever, and ' +
    'every snapshot pinned to it still resolves v5 and reproduces its own number. The reason a new ' +
    'releaseId is required at all is that registry.register refuses to re-register a releaseId whose rule ' +
    'set hashes differently, and the DPI rules are formula-bearing content. AT MINTING THIS RELEASE the ' +
    'rule set is identical to v5 — the DPI rules are added in the following stages — so the two releases ' +
    'share one content hash and are distinguished only by releaseId and version; that is a staged state, ' +
    'pinned by test, not a defect. effectiveFrom is 2026-01-01 because the DPI articles are FY2026 law for ' +
    'the whole income year and because the engine selects its rules at 1 January of the fiscal year ' +
    '(tax.ts, and snapshots/ruleProvenance.ts engineAsOf); a later boundary would leave every FY2026 ' +
    'calculation resolving v5 and the new rules unreachable. v5 is superseded with effectiveTo 2025-12-31 ' +
    'so the two windows partition the year and no asOfDate selects two FY2026 releases at once. No rule ' +
    'value, threshold or citation from v5 moved.',
};
