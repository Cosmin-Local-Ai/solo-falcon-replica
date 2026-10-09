/**
 * TASK 6 — the rule-release registry: lifecycle enforced in code, and one place that answers
 * "which rules apply for this year at this date?".
 *
 * Before this module existed, nothing selected a release. Every consumer imported the constant
 * `PFA_2026_RELEASE` / `PFA_2026_SYSTEM_REAL_PACKAGE` by name, so the release was not chosen — it was
 * baked in. That is the second half of the defect: a stored snapshot could not say which law produced
 * it, AND a call site could not ask for the law of a given year without naming the 2026 one.
 *
 * What is enforced here, rather than documented:
 *
 * 1. **A release cannot be edited in place.** Registering a `releaseId` that already exists with a
 *    DIFFERENT rule-set digest throws (`RuleReleaseImmutableError`). A revision gets a new identity.
 *    This is the exact failure that happened three times before TASK 6: the CAS, CASS and income-tax
 *    corrections changed formula-bearing parameters while `releaseId` and `createdAt` stood still, so
 *    two snapshots carrying the same `releaseId` encoded different arithmetic.
 * 2. **A release cannot claim a rule set it does not contain.** `ruleIds` and the rules must match in
 *    both directions, every rule must carry the release's `taxYear`, and `contentHash` — when present —
 *    must equal the digest of the rules actually registered. (The both-directions rule was previously
 *    asserted only by `fiscal.test.ts`; now it is a runtime gate.)
 * 3. **The lifecycle is a ladder, not a suggestion.** `PROPOSED → VALIDATED → STAGED → SCHEDULED →
 *    ACTIVE → SUPERSEDED`, one step forward at a time, `SUPERSEDED` terminal.
 * 4. **At most one ACTIVE release per tax year, and their windows may not overlap.** "A single active
 *    release selected by date" is the boundary; anything more is future-year automation this phase
 *    deliberately does not build.
 * 5. **A rule's `version` moves exactly when its content does.** Re-registering identical rule content
 *    under a bumped version throws; changing rule content without a bump throws. `version` therefore
 *    stops being a display number.
 * 6. **Registered rule sets are frozen.** Deep-frozen, in place: an attempt to mutate an ACTIVE rule
 *    throws a `TypeError` instead of quietly re-binding old calculations to new law.
 *
 * What is deliberately NOT here: any calendar automation, any per-year generation of rules, any
 * fallback that invents a release for a year none is registered for. `activeEntry` returns `undefined`
 * in that case, and the caller must say so — the same honesty the migration chain uses about facts it
 * cannot reconstruct.
 */
import type { FiscalRule, ReleaseLifecycle, RuleRelease } from './rules';
import { DuplicateRuleIdError, ruleDigest, ruleSetDigest } from './ruleSetDigest';
import { PFA_2026_RELEASE } from './release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';

/** The ladder, in order. */
export const RELEASE_LIFECYCLE_STEPS: readonly ReleaseLifecycle[] = [
  'PROPOSED',
  'VALIDATED',
  'STAGED',
  'SCHEDULED',
  'ACTIVE',
  'SUPERSEDED',
];

export function isReleaseLifecycle(value: unknown): value is ReleaseLifecycle {
  return (RELEASE_LIFECYCLE_STEPS as readonly unknown[]).includes(value);
}

/** The only legal forward step, or `null` when the state is terminal. */
export function nextLifecycleStep(from: ReleaseLifecycle): ReleaseLifecycle | null {
  const i = RELEASE_LIFECYCLE_STEPS.indexOf(from);
  return i >= 0 && i < RELEASE_LIFECYCLE_STEPS.length - 1 ? RELEASE_LIFECYCLE_STEPS[i + 1] : null;
}

export class LifecycleTransitionError extends Error {
  constructor(
    readonly from: ReleaseLifecycle,
    readonly to: ReleaseLifecycle,
  ) {
    super(
      `Illegal rule-release lifecycle transition ${from} → ${to}. ` +
        `The ladder is ${RELEASE_LIFECYCLE_STEPS.join(' → ')} and moves one step forward at a time.`,
    );
    this.name = 'LifecycleTransitionError';
  }
}

/** Throws unless `from → to` is the single legal forward step. */
export function assertLifecycleTransition(from: ReleaseLifecycle, to: ReleaseLifecycle): void {
  if (nextLifecycleStep(from) !== to) throw new LifecycleTransitionError(from, to);
}

export class RuleReleaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleReleaseValidationError';
  }
}

/** A `releaseId` reused with different content — the in-place edit this phase exists to make impossible. */
export class RuleReleaseImmutableError extends RuleReleaseValidationError {
  constructor(
    readonly releaseId: string,
    readonly previousDigest: string,
    readonly attemptedDigest: string,
  ) {
    super(
      `Rule release '${releaseId}' is already registered with content hash ${previousDigest}; ` +
        `the rules offered for it hash to ${attemptedDigest}. An ACTIVE release is never edited in ` +
        `place — a revision gets a new releaseId and the old one is superseded.`,
    );
    this.name = 'RuleReleaseImmutableError';
  }
}

/** One release plus the rule set it names, as the registry holds it: frozen, and digest-pinned. */
export interface RuleSetEntry {
  readonly release: RuleRelease;
  readonly rules: readonly FiscalRule[];
  /** Digest of the FULL rule set the release names — its content address. */
  readonly digest: string;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && (typeof value === 'object' || Array.isArray(value))) {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** ISO date strings compare correctly as strings, and every date in this codebase is `YYYY-MM-DD`. */
function windowsOverlap(a: RuleRelease, b: RuleRelease): boolean {
  const aEnd = a.effectiveTo ?? '9999-12-31';
  const bEnd = b.effectiveTo ?? '9999-12-31';
  return a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd;
}

export interface RuleReleaseRegistry {
  /** Register a release with the rule set it names. Idempotent for identical content; throws otherwise. */
  register(release: RuleRelease, rules: readonly FiscalRule[]): RuleSetEntry;
  /** Mark a registered release SUPERSEDED by another. Lifecycle only — the content address never moves. */
  supersede(releaseId: string, byReleaseId: string, effectiveTo: string): RuleSetEntry;
  entries(taxYear?: number): RuleSetEntry[];
  entryByReleaseId(releaseId: string): RuleSetEntry | undefined;
  /** Superseded releases stay readable forever: an old snapshot must still be interpretable. */
  rulesOf(releaseId: string): readonly FiscalRule[] | undefined;
  /** Find a release by the digest of its full rule set. */
  entryByContentHash(digest: string): RuleSetEntry | undefined;
  /** The single release in force for `taxYear` on `asOfDate`, or `undefined` when none is. */
  activeEntry(taxYear: number, asOfDate: string): RuleSetEntry | undefined;
}

export function createRuleReleaseRegistry(): RuleReleaseRegistry {
  const entries: RuleSetEntry[] = [];
  /** ruleId → the content address and version it was registered with. The version ladder's memory. */
  const ruleVersions = new Map<string, { digest: string; version: number }>();

  function checkRuleVersions(rules: readonly FiscalRule[]): void {
    for (const rule of rules) {
      const digest = ruleDigest(rule);
      const known = ruleVersions.get(rule.ruleId);
      if (!known) {
        if (!Number.isInteger(rule.version) || rule.version < 1) {
          throw new RuleReleaseValidationError(
            `Rule '${rule.ruleId}' must carry an integer version >= 1; got ${String(rule.version)}.`,
          );
        }
        ruleVersions.set(rule.ruleId, { digest, version: rule.version });
        continue;
      }
      if (known.digest === digest) {
        if (known.version !== rule.version) {
          throw new RuleReleaseValidationError(
            `Rule '${rule.ruleId}' was re-registered with version ${rule.version} but identical content ` +
              `(digest ${digest.slice(0, 12)}…). A version may only move when the content moves.`,
          );
        }
        continue;
      }
      if (rule.version <= known.version) {
        throw new RuleReleaseValidationError(
          `Rule '${rule.ruleId}' changed its formula-bearing content (digest ${known.digest.slice(0, 12)}… → ` +
            `${digest.slice(0, 12)}…) but its version stayed at ${rule.version}. A material legal or ` +
            `formula change must bump the rule's version.`,
        );
      }
      ruleVersions.set(rule.ruleId, { digest, version: rule.version });
    }
  }

  function validate(release: RuleRelease, rules: readonly FiscalRule[], digest: string): void {
    if (!Number.isInteger(release.taxYear)) {
      throw new RuleReleaseValidationError(`Release '${release.releaseId}' needs an integer taxYear.`);
    }
    if (!isReleaseLifecycle(release.lifecycle)) {
      throw new RuleReleaseValidationError(
        `Release '${release.releaseId}' must declare a lifecycle on the ladder ` +
          `${RELEASE_LIFECYCLE_STEPS.join(' | ')}; got ${String(release.lifecycle)}.`,
      );
    }
    if (release.contentHash !== undefined && release.contentHash !== digest) {
      throw new RuleReleaseValidationError(
        `Release '${release.releaseId}' declares contentHash ${release.contentHash} but its rule set ` +
          `hashes to ${digest}. A release cannot claim a rule set it does not contain.`,
      );
    }
    const ids = rules.map((r) => r.ruleId);
    if (new Set(ids).size !== ids.length) {
      throw new DuplicateRuleIdError(ids.find((id, i) => ids.indexOf(id) !== i) as string);
    }
    if (release.ruleIds.length === 0) {
      throw new RuleReleaseValidationError(`Release '${release.releaseId}' names no rules.`);
    }
    for (const id of release.ruleIds) {
      if (!ids.includes(id)) {
        throw new RuleReleaseValidationError(
          `Release '${release.releaseId}' names rule '${id}', which is not in its rule set.`,
        );
      }
    }
    for (const id of ids) {
      if (!release.ruleIds.includes(id)) {
        throw new RuleReleaseValidationError(
          `Rule '${id}' is in the rule set of release '${release.releaseId}' but not in its ruleIds, ` +
            `so it would never be selected.`,
        );
      }
    }
    for (const rule of rules) {
      if (rule.taxYear !== release.taxYear) {
        throw new RuleReleaseValidationError(
          `Rule '${rule.ruleId}' has taxYear ${rule.taxYear} but release '${release.releaseId}' has ` +
            `taxYear ${release.taxYear}.`,
        );
      }
      if (!isReleaseLifecycle(rule.status)) {
        throw new RuleReleaseValidationError(
          `Rule '${rule.ruleId}' has status ${String(rule.status)}, which is not on the lifecycle ladder.`,
        );
      }
    }
    checkRuleVersions(rules);
  }

  function checkSingleActive(candidate: RuleRelease): void {
    if (candidate.lifecycle !== 'ACTIVE') return;
    const clash = entries.find(
      (e) =>
        e.release.taxYear === candidate.taxYear &&
        e.release.lifecycle === 'ACTIVE' &&
        e.release.releaseId !== candidate.releaseId &&
        windowsOverlap(e.release, candidate),
    );
    if (clash) {
      throw new RuleReleaseValidationError(
        `Release '${candidate.releaseId}' cannot be ACTIVE for tax year ${candidate.taxYear}: ` +
          `'${clash.release.releaseId}' is already ACTIVE and its window ` +
          `[${clash.release.effectiveFrom} .. ${clash.release.effectiveTo ?? '∞'}] overlaps ` +
          `[${candidate.effectiveFrom} .. ${candidate.effectiveTo ?? '∞'}]. One active release per year.`,
      );
    }
  }

  const registry: RuleReleaseRegistry = {
    register(release, rules) {
      const digest = ruleSetDigest(rules);
      const existing = entries.find((e) => e.release.releaseId === release.releaseId);
      if (existing) {
        if (existing.digest === digest) return existing;
        throw new RuleReleaseImmutableError(release.releaseId, existing.digest, digest);
      }
      validate(release, rules, digest);
      checkSingleActive(release);
      // The digest is what the registry guarantees, so a release registered without one is stored with
      // one. It is never stored with a digest that does not match its rules.
      const pinned: RuleRelease =
        release.contentHash === undefined ? { ...release, contentHash: digest } : release;
      const entry: RuleSetEntry = {
        release: deepFreeze(pinned),
        rules: deepFreeze([...rules]),
        digest,
      };
      entries.push(entry);
      return entry;
    },

    supersede(releaseId, byReleaseId, effectiveTo) {
      const entry = entries.find((e) => e.release.releaseId === releaseId);
      if (!entry) throw new RuleReleaseValidationError(`Unknown rule release '${releaseId}'.`);
      const replacement = entries.find((e) => e.release.releaseId === byReleaseId);
      if (!replacement) throw new RuleReleaseValidationError(`Unknown rule release '${byReleaseId}'.`);
      assertLifecycleTransition(entry.release.lifecycle as ReleaseLifecycle, 'SUPERSEDED');
      // A lifecycle change is not a content change: the rules and their digest are untouched, which is
      // exactly why an old snapshot can still be re-run against them.
      const next: RuleSetEntry = {
        release: deepFreeze({
          ...entry.release,
          lifecycle: 'SUPERSEDED',
          effectiveTo,
          supersededBy: byReleaseId,
        }),
        rules: entry.rules,
        digest: entry.digest,
      };
      entries[entries.indexOf(entry)] = next;
      return next;
    },

    entries(taxYear) {
      const copy = [...entries];
      return taxYear === undefined ? copy : copy.filter((e) => e.release.taxYear === taxYear);
    },

    entryByReleaseId(releaseId) {
      return entries.find((e) => e.release.releaseId === releaseId);
    },

    rulesOf(releaseId) {
      return registry.entryByReleaseId(releaseId)?.rules;
    },

    entryByContentHash(digest) {
      return entries.find((e) => e.digest === digest);
    },

    activeEntry(taxYear, asOfDate) {
      const inForce = entries.filter(
        (e) =>
          e.release.taxYear === taxYear &&
          e.release.lifecycle === 'ACTIVE' &&
          e.release.effectiveFrom <= asOfDate &&
          (e.release.effectiveTo === null ||
            e.release.effectiveTo === undefined ||
            e.release.effectiveTo >= asOfDate),
      );
      if (inForce.length === 0) return undefined;
      // `checkSingleActive` makes more than one impossible; the sort only keeps the choice deterministic.
      return inForce.sort((a, b) =>
        a.release.effectiveFrom === b.release.effectiveFrom
          ? a.release.releaseId < b.release.releaseId
            ? -1
            : 1
          : a.release.effectiveFrom < b.release.effectiveFrom
            ? -1
            : 1,
      )[inForce.length - 1];
    },
  };

  return registry;
}

/** The registry the application uses. Seeded with the one rule set this build carries. */
export const defaultRuleReleaseRegistry: RuleReleaseRegistry = createRuleReleaseRegistry();
defaultRuleReleaseRegistry.register(PFA_2026_RELEASE, PFA_2026_SYSTEM_REAL_PACKAGE);

/**
 * The release in force for a fiscal year on a date, or `undefined` when this build registers none for
 * that year. Returning `undefined` is the point: a caller must then say there are no rules, instead of
 * quietly falling back to a release from a different year.
 */
export function selectRuleSet(taxYear: number, asOfDate: string): RuleSetEntry | undefined {
  return defaultRuleReleaseRegistry.activeEntry(taxYear, asOfDate);
}

export function activeRuleRelease(taxYear: number, asOfDate: string): RuleRelease | undefined {
  return selectRuleSet(taxYear, asOfDate)?.release;
}
