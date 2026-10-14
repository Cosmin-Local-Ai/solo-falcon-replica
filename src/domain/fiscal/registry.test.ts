/**
 * TASK 6 — the lifecycle and the registry, enforced rather than documented.
 *
 * Every test here asserts that something is REFUSED. The 2026 rule set was edited in place three times —
 * CAS (Phase 3), CASS (Phase 4), income tax (Phase 5) — under a `releaseId` and a `createdAt` that never
 * moved, and nothing in the code stopped it. The registry is where that becomes impossible, so the value
 * of this file is the list of things it makes throw.
 */
import { describe, expect, it } from 'vitest';
import type { FiscalRule, RuleRelease } from './rules';
import {
  LifecycleTransitionError,
  RELEASE_LIFECYCLE_STEPS,
  RuleReleaseImmutableError,
  RuleReleaseValidationError,
  activeRuleRelease,
  assertLifecycleTransition,
  createRuleReleaseRegistry,
  defaultRuleReleaseRegistry,
  nextLifecycleStep,
  selectRuleSet,
} from './registry';
import { ruleSetDigest } from './ruleSetDigest';
import { PFA_2026_RELEASE } from './release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { selectApplicableRules } from './select';

function rule(over: Partial<FiscalRule> = {}): FiscalRule {
  return {
    ruleId: 'CAS_2026',
    name: 'CAS 2026',
    jurisdiction: 'RO',
    entityType: 'PFA',
    taxRegime: 'cas',
    taxYear: 2026,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    parameters: [{ id: 'rate', label: 'Rata', value: 25, unit: 'percent' }],
    calculatorId: 'calc-cas',
    sourceAct: 'Cod fiscal',
    sourceArticle: 'art. 148 alin. (2)',
    sourceUrl: 'https://legislatie.just.ro/Public/DetaliiDocument/312601',
    verifiedAt: '2026-10-05',
    status: 'ACTIVE',
    version: 1,
    ...over,
  };
}

function release(over: Partial<RuleRelease> = {}): RuleRelease {
  return {
    releaseId: 'R1',
    name: 'rule set R1',
    jurisdiction: 'RO',
    entityType: 'PFA',
    taxYear: 2026,
    ruleIds: ['CAS_2026'],
    status: 'SAFE_ACTIVATION',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    createdAt: '2026-10-09T09:05:44+03:00',
    evidence: ['https://legislatie.just.ro/Public/DetaliiDocument/312601'],
    lifecycle: 'ACTIVE',
    version: 1,
    ...over,
  };
}

describe('the default registry and the 2026 release', () => {
  it('the 2026 release carries the digest of the rule set it names', () => {
    expect(PFA_2026_RELEASE.contentHash).toBe(ruleSetDigest(PFA_2026_SYSTEM_REAL_PACKAGE));
    expect(defaultRuleReleaseRegistry.entryByContentHash(PFA_2026_RELEASE.contentHash!)?.release.releaseId).toBe(
      'PFA_2026_SYSTEM_REAL',
    );
  });

  it('selects the 2026 release for a 2026 date, and nothing for a year it has no rules for', () => {
    // B-112 stage 0 moved both of these from 'PFA_2026_SYSTEM_REAL' to 'PFA_2026_DPI_INCOME_PATH'. That is
    // not a re-baseline to keep the suite green: it is what supersession is for. v5's window closed at
    // 2025-12-31 because the DPI articles are FY2026 law for the whole income year and the engine selects
    // its rules at 1 January, so no FY2026 date may resolve the package that cannot represent DPI income.
    // v5 stays registered and readable by releaseId, and `release2026dpi.test.ts` proves a v5-pinned
    // snapshot still reproduces its own number.
    expect(selectRuleSet(2026, '2026-06-15')?.release.releaseId).toBe('PFA_2026_DPI_INCOME_PATH');
    expect(activeRuleRelease(2026, '2026-12-31')?.releaseId).toBe('PFA_2026_DPI_INCOME_PATH');
    // And the superseded release is still addressable by id, which is how an old snapshot resolves.
    expect(defaultRuleReleaseRegistry.entryByReleaseId('PFA_2026_SYSTEM_REAL')!.release.lifecycle).toBe(
      'SUPERSEDED',
    );
    // No fallback to a neighbouring year: the caller has to say there are no rules.
    expect(selectRuleSet(2025, '2025-06-15')).toBeUndefined();
    expect(activeRuleRelease(2027, '2027-06-15')).toBeUndefined();
  });

  it('refuses a date outside the release window instead of reaching for it anyway', () => {
    expect(selectRuleSet(2026, '2025-12-31')).toBeUndefined();
  });
});

describe('register — a release cannot claim a rule set it does not contain', () => {
  it('refuses a releaseId reused with different rules: an ACTIVE release is never edited in place', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release(), [rule()]);
    const revised = [rule({ parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }], version: 2 })];
    expect(() => registry.register(release(), revised)).toThrow(RuleReleaseImmutableError);
    // The original is untouched, digest included.
    expect(registry.entryByReleaseId('R1')!.digest).toBe(ruleSetDigest([rule()]));
  });

  it('accepts the identical rule set under the same releaseId as a no-op', () => {
    const registry = createRuleReleaseRegistry();
    const a = registry.register(release(), [rule()]);
    const b = registry.register(release(), [rule()]);
    expect(b.digest).toBe(a.digest);
    expect(registry.entries()).toHaveLength(1);
  });

  it('refuses a declared contentHash that does not match the rules handed in', () => {
    const registry = createRuleReleaseRegistry();
    expect(() => registry.register(release({ contentHash: 'f'.repeat(64) }), [rule()])).toThrow(
      /cannot claim a rule set it does not contain/,
    );
  });

  it('fills in the digest when a release is registered without one, so the registry always holds a content address', () => {
    const registry = createRuleReleaseRegistry();
    const entry = registry.register(release(), [rule()]);
    expect(entry.release.contentHash).toBe(ruleSetDigest([rule()]));
  });

  it('refuses a ruleIds list that disagrees with the rules, in either direction', () => {
    const registry = createRuleReleaseRegistry();
    expect(() => registry.register(release({ ruleIds: ['CAS_2026', 'CASS_2026'] }), [rule()])).toThrow(
      /names rule 'CASS_2026', which is not in its rule set/,
    );
    const registry2 = createRuleReleaseRegistry();
    expect(() =>
      registry2.register(release({ ruleIds: ['CAS_2026'] }), [
        rule(),
        rule({ ruleId: 'CASS_2026', taxRegime: 'cass' }),
      ]),
    ).toThrow(/not in its ruleIds/);
  });

  it('refuses a rule whose taxYear is not the release taxYear', () => {
    const registry = createRuleReleaseRegistry();
    expect(() => registry.register(release(), [rule({ taxYear: 2025 })])).toThrow(/taxYear 2025/);
  });

  it('refuses a release with no lifecycle, and a rule with an off-ladder status', () => {
    const registry = createRuleReleaseRegistry();
    const { lifecycle: _omitted, ...noLifecycle } = release();
    expect(() => registry.register(noLifecycle as RuleRelease, [rule()])).toThrow(/must declare a lifecycle/);
    const registry2 = createRuleReleaseRegistry();
    expect(() => registry2.register(release(), [rule({ status: 'FOO' as never })])).toThrow(
      /not on the lifecycle ladder/,
    );
  });

  it('refuses a release that names no rules at all', () => {
    const registry = createRuleReleaseRegistry();
    expect(() => registry.register(release({ ruleIds: [] }), [])).toThrow(/names no rules/);
  });
});

describe('register — one ACTIVE release per tax year', () => {
  it('refuses a second ACTIVE release whose window overlaps the first', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    expect(() => registry.register(release({ releaseId: 'R2', effectiveFrom: '2026-06-01' }), [rule()])).toThrow(
      /One active release per year/,
    );
  });

  it('accepts an ACTIVE release whose window starts where the previous one ends open', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1', effectiveTo: '2026-06-30' }), [rule()]);
    const entry = registry.register(release({ releaseId: 'R2', effectiveFrom: '2026-07-01' }), [rule()]);
    expect(entry.release.releaseId).toBe('R2');
    expect(registry.activeEntry(2026, '2026-03-01')!.release.releaseId).toBe('R1');
    expect(registry.activeEntry(2026, '2026-09-01')!.release.releaseId).toBe('R2');
  });

  it('lets a not-yet-active release coexist: only ACTIVE releases compete', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    const staged = registry.register(release({ releaseId: 'R2', lifecycle: 'SCHEDULED' }), [rule()]);
    expect(staged.release.lifecycle).toBe('SCHEDULED');
    expect(registry.activeEntry(2026, '2026-06-01')!.release.releaseId).toBe('R1');
  });
});

describe('register — a rule version moves exactly when its content does', () => {
  it('refuses a version bump over identical content', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    expect(() => registry.register(release({ releaseId: 'R2' }), [rule({ version: 2 })])).toThrow(
      /version may only move when the content moves/,
    );
  });

  it('refuses changed content that keeps the same version', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    const changed = rule({
      parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }],
      version: 1,
    });
    expect(() => registry.register(release({ releaseId: 'R1_B' }), [changed])).toThrow(
      /changed its formula-bearing content/,
    );
  });

  it('accepts changed content with a bumped version — the same ruleId, a new revision', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1', effectiveTo: '2026-06-30' }), [rule()]);
    const bumped = rule({
      parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }],
      version: 2,
    });
    const entry = registry.register(release({ releaseId: 'R2', effectiveFrom: '2026-07-01' }), [bumped]);
    expect(entry.digest).not.toBe(ruleSetDigest([rule()]));
  });
  it('refuses a rule with no usable version at all', () => {
    const registry = createRuleReleaseRegistry();
    expect(() => registry.register(release(), [rule({ version: 0 })])).toThrow(/integer version >= 1/);
  });
});

describe('the lifecycle ladder', () => {
  it('is the six documented states, in order', () => {
    expect(RELEASE_LIFECYCLE_STEPS).toEqual([
      'PROPOSED',
      'VALIDATED',
      'STAGED',
      'SCHEDULED',
      'ACTIVE',
      'SUPERSEDED',
    ]);
  });

  it('allows exactly one step forward and nothing else', () => {
    expect(nextLifecycleStep('PROPOSED')).toBe('VALIDATED');
    expect(nextLifecycleStep('ACTIVE')).toBe('SUPERSEDED');
    expect(nextLifecycleStep('SUPERSEDED')).toBeNull();
    assertLifecycleTransition('SCHEDULED', 'ACTIVE');
    expect(() => assertLifecycleTransition('PROPOSED', 'ACTIVE')).toThrow(LifecycleTransitionError);
    expect(() => assertLifecycleTransition('ACTIVE', 'PROPOSED')).toThrow(LifecycleTransitionError);
    expect(() => assertLifecycleTransition('VALIDATED', 'SUPERSEDED')).toThrow(LifecycleTransitionError);
    expect(() => assertLifecycleTransition('SUPERSEDED', 'ACTIVE')).toThrow(LifecycleTransitionError);
  });
});

describe('supersede — a revision gets a new identity, the old one stays readable', () => {
  it('marks the old release SUPERSEDED with a bound and a successor, and moves no content digest', () => {
    const registry = createRuleReleaseRegistry();
    const r1 = registry.register(release({ releaseId: 'R1' }), [rule()]);
    const r2 = registry.register(
      release({ releaseId: 'R2', effectiveFrom: '2026-07-01', effectiveTo: null, lifecycle: 'SCHEDULED' }),
      [rule({ parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }], version: 2 })],
    );
    const superseded = registry.supersede('R1', 'R2', '2026-06-30');
    expect(superseded.release.lifecycle).toBe('SUPERSEDED');
    expect(superseded.release.effectiveTo).toBe('2026-06-30');
    expect(superseded.release.supersededBy).toBe('R2');
    // Lifecycle is not content: the digest that pins the arithmetic is untouched.
    expect(superseded.digest).toBe(r1.digest);
    expect(r2.digest).not.toBe(r1.digest);
  });

  it('a release only becomes ACTIVE by walking the ladder, and only then does it take force', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    registry.register(
      release({ releaseId: 'R2', effectiveFrom: '2026-07-01', lifecycle: 'SCHEDULED' }),
      [rule({ parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }], version: 2 })],
    );
    expect(() => registry.advance('R2', 'SUPERSEDED')).toThrow(LifecycleTransitionError);
    expect(() => registry.advance('R2', 'PROPOSED')).toThrow(LifecycleTransitionError);
    // While R1 is still ACTIVE and unbounded, R2 may not take force.
    expect(() => registry.advance('R2', 'ACTIVE')).toThrow(/One active release per year/);
    registry.supersede('R1', 'R2', '2026-06-30');
    expect(registry.advance('R2', 'ACTIVE').release.lifecycle).toBe('ACTIVE');
  });

  it('refuses to supersede something that is not ACTIVE', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1', lifecycle: 'SCHEDULED' }), [rule()]);
    registry.register(release({ releaseId: 'R2', effectiveFrom: '2026-07-01', lifecycle: 'SCHEDULED' }), [
      rule({ parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }], version: 2 }),
    ]);
    expect(() => registry.supersede('R1', 'R2', '2026-06-30')).toThrow(LifecycleTransitionError);
  });

  it('refuses an unknown releaseId on either side', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    expect(() => registry.supersede('R9', 'R1', '2026-06-30')).toThrow(/Unknown rule release 'R9'/);
    expect(() => registry.supersede('R1', 'R9', '2026-06-30')).toThrow(/Unknown rule release 'R9'/);
  });

  it('a superseded release stays readable, so an old snapshot can still be re-run', () => {
    const registry = createRuleReleaseRegistry();
    registry.register(release({ releaseId: 'R1' }), [rule()]);
    registry.register(
      release({ releaseId: 'R2', effectiveFrom: '2026-07-01', lifecycle: 'SCHEDULED' }),
      [rule({ parameters: [{ id: 'rate', label: 'Rata', value: 26, unit: 'percent' }], version: 2 })],
    );
    registry.supersede('R1', 'R2', '2026-06-30');
    registry.advance('R2', 'ACTIVE');
    const oldRules = registry.rulesOf('R1');
    expect(oldRules).toBeDefined();
    expect(ruleSetDigest([...oldRules!])).toBe(ruleSetDigest([rule()]));
    // The rules inside the historical set are still selectable — the release is superseded, not void.
    expect(selectApplicableRules([...oldRules!], { taxYear: 2026, asOfDate: '2026-03-01' })).toHaveLength(1);
    // A date inside R1's own window still resolves to R1: answering with R2 there would re-bind a past
    // date to a law that was not in force on it.
    expect(registry.activeEntry(2026, '2026-03-01')!.release.releaseId).toBe('R1');
    // A date inside R2's window resolves to R2.
    expect(registry.activeEntry(2026, '2026-09-01')!.release.releaseId).toBe('R2');
  });
});

describe('registered rule sets are frozen', () => {
  it('an in-place edit of a registered rule throws instead of silently re-binding history', () => {
    const registry = createRuleReleaseRegistry();
    const entry = registry.register(release(), [rule()]);
    const mutable = entry.rules[0] as unknown as { parameters: { value: number }[] };
    expect(() => {
      mutable.parameters[0].value = 26;
    }).toThrow(TypeError);
    const releaseCopy = entry.release as unknown as { notes?: string };
    expect(() => {
      releaseCopy.notes = 'rescris';
    }).toThrow(TypeError);
    // And the digest still describes the rules that were actually registered.
    expect(entry.digest).toBe(ruleSetDigest([rule()]));
  });
});

/*
 * TASK 6 — no production call site may name the release.
 *
 * The defect was not only that a snapshot pinned metadata instead of rules; it was that every consumer
 * reached for `PFA_2026_RELEASE` / `PFA_2026_SYSTEM_REAL_PACKAGE` by name, so the release was never
 * selected and a new rule set would silently re-bind calculations that were supposed to be pinned to an
 * old one. Policing that against the real source tree is the only way it stays true — a convention is
 * what let 15 call sites hard-code the 2026 constants in the first place.
 *
 * Inside `src/domain/fiscal/` the constants are allowed: that is where they are defined, where the
 * barrel re-exports them, and where the default registry seeds itself.
 */
describe('no production call site hard-codes the 2026 release', () => {
  const SOURCES = import.meta.glob('../../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const normalize = (path: string) => {
    // `import.meta.glob` paths are relative to THIS file (src/domain/fiscal), so `./x.ts`, `../x.ts` and
    // `../../data/x.ts` all appear. Resolving them segment by segment keeps the allow-list unambiguous.
    const parts = ['src', 'domain', 'fiscal'];
    for (const seg of path.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  };

  const BY_PATH: Record<string, string> = Object.fromEntries(
    Object.entries(SOURCES).map(([raw, source]) => [normalize(raw), source]),
  );

  const productionPaths = Object.keys(BY_PATH)
    .filter((p) => !/\.test\.tsx?$/.test(p) && !/\.d\.ts$/.test(p) && !p.startsWith('src/domain/fiscal/'));

  it('scans the sources it means to scan', () => {
    expect(productionPaths.length).toBeGreaterThan(20);
    // The three files that used to hard-code the release are in the scanned set.
    expect(productionPaths).toEqual(
      expect.arrayContaining(['src/data/dashboard.ts', 'src/data/derived.ts', 'src/pages/Expenses.tsx']),
    );
  });

  it('finds no import of the year-named release or package outside src/domain/fiscal', () => {
    for (const path of productionPaths) {
      // Strip comments: the phase history names the old constants in prose, and that prose is the point.
      const code = BY_PATH[path].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1//');
      expect(code, `PFA_2026_* must not be imported in ${path}`).not.toMatch(
        /\bPFA_2026_(RELEASE|SYSTEM_REAL_PACKAGE)\b/,
      );
    }
  });

  it('every production consumer goes through the selector instead', () => {
    for (const path of ['src/data/dashboard.ts', 'src/data/derived.ts', 'src/pages/Expenses.tsx']) {
      expect(BY_PATH[path], `${path} must select its rules`).toMatch(/selectRuleSet\(/);
    }
  });
});
