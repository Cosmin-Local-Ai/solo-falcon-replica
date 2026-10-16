import { describe, expect, it } from 'vitest';
import { defaultRuleReleaseRegistry } from './registry';
import { calculatorRegistry } from './calculators';

/**
 * B-148 — a rule package is a claim about what is computable. This guard makes the claim payable.
 *
 * **The defect this exists for (B-147).** `DPI_ART72_2026` declares `calculatorId: 'calc-dpi-flat-quota'`.
 * `calcDpiFlatQuota` is written, correct, and registered in `calculatorRegistry`. `dpi2026.test.ts` calls it
 * directly and has been green the whole time. **And the engine never ran it** — not once, in any path, for
 * four briefs. The 40 % quota of art. 72 alin. (2) / art. 72¹ alin. (1) was a number the app quoted inside a
 * coverage sentence and never applied to a leu.
 *
 * **Why a test that calls the calculator proves nothing.** Dispatch in `tax.ts` is seven hardcoded literal
 * keys — `calculatorRegistry['calc-cas']`, `['calc-cass']`, `['calc-cass-ladder']`, `['calc-income-tax']`,
 * and the three flat-ratio ones. **Nothing anywhere dispatches on `rule.calculatorId`.** So the three things
 * that all look like "this rule is implemented" — the rule declares an id, the id is registered, the
 * function has tests — are jointly consistent with the engine never calling it. `ruleSetDigest.ts` used to
 * document the opposite mechanism (`calculatorRegistry[rule.calculatorId]`), which is false; the only
 * function that reads `rule.calculatorId` is `computeFiscal`, and it has no production caller.
 *
 * **This is the same shape as B-137**, whose annual-average lifecycle was implemented, unit-tested and had no
 * e2e route for an entire phase. Implemented-and-unreachable reads as done. Here there was not even a browser
 * route to discover it, which is why the guard is at the rule-package level and not at the UI.
 *
 * **What it is NOT.** It is not a refactor and it does not make dispatch dynamic. Making
 * `calculatorRegistry[rule.calculatorId]` the real mechanism would let a rule package change the formula the
 * engine runs by editing a data file, and the year-scoping guards in `tax.ts` exist precisely because the
 * engine chooses which rule to apply. The guard holds the two halves together instead.
 */

/**
 * Every production source, read raw. The same idiom `thresholds.language.test.ts` and
 * `registry.test.ts` use — `import.meta.glob(..., '?raw')`, no `node:fs`, because this is a browser app and
 * a guard that only runs under Node is a guard that does not run.
 */
const SOURCES = import.meta.glob('../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PRODUCTION = Object.entries(SOURCES).filter(
  ([path, _src]) => !path.includes('.test.') && !path.includes('/test/'),
);

/**
 * Code only, comments stripped.
 *
 * Needed because a comment is exactly how this defect travels: `ruleSetDigest.ts` documented a mechanism the
 * engine does not have, and the next agent believed it. A guard that matched on prose would either flag its
 * own correction or have to dodge the words that describe the defect — so it reads code and ignores words.
 */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

/** Every `calculatorRegistry[ … ]( … )` call, including the ternary-key form at the cedare site. */
function registryCallKeys(src: string): string[] {
  const found: string[] = [];
  const call = /calculatorRegistry\s*\[([\s\S]{0,400}?)\]\s*\(/g;
  for (const m of src.matchAll(call)) {
    for (const key of m[1].matchAll(/'(calc-[^']+)'/g)) found.push(key[1]);
  }
  return found;
}

const REACHED = new Set<string>(PRODUCTION.map(([, src]) => [codeOnly(src)]).flatMap(([src]) => registryCallKeys(src)));

/**
 * The ids a registered rule package declares but no production call site reaches.
 *
 * **This list may only shrink.** Every entry is a rule that claims the app can compute something it does not
 * compute from the rule package's own declaration — B-147's shape, one id at a time. They are named here
 * rather than minted as separate defects in this brief because B-147's scope is the DPI quota, and silently
 * passing over the rest would be the same failure this file exists to stop.
 *
 * `calc-dpi-flat-quota` is deliberately ABSENT: B-147 gave it its call site, and if that call site is ever
 * removed this test goes red rather than the quota quietly going back to being a caption.
 */
const UNREACHED_ALLOW_LIST: Record<string, string> = {
  'calc-wage-reference':
    'B-148, measured not fixed in brief 72. The SMN reference amounts are read as rule PARAMETERS by '
    + '`calcCas` / `calcCass` (`paramBani`), so the amounts are live while the calculator that would state '
    + 'them alone is not. Reachable only through those two call sites.',
  'calc-vat-threshold':
    'B-148, measured not fixed in brief 72. The art. 310 plafon is computed in `domain/thresholds.ts` from '
    + 'the rule parameters; the registered calculator has no production caller.',
  'calc-deadline':
    'B-148, measured not fixed in brief 72. Deadlines are produced by `domain/deadlines.ts`, not by the '
    + 'registered calculator. Three rules declare it.',
  'calc-expense-deductibility':
    'B-148, measured not fixed in brief 72. Deductibility is decided by `domain/deductibility.ts`, which '
    + 'reads the rule parameters directly.',
  'calc-fiscal-depreciation':
    'B-148, measured not fixed in brief 72. The schedule is struck in `domain/fiscal/depreciation.ts`.',
  'calc-contribution-withholding':
    'B-148, measured not fixed in brief 72. `dpi2026.ts` says of its own rule that `calculatorId` is a label '
    + 'only, because the datorată / reținută / de plătit triple is composed inside `calcCas` and '
    + '`calcCassLadder`. Accepted for that rule; still an unreachable declaration.',
};

/**
 * Ids a rule package declares that are not even keys in `calculatorRegistry`.
 *
 * Weaker than the unreachable list above and worse in one way: an unreachable id at least names a function
 * that exists and is tested. These two name nothing. `deductibility.ts` and the contribution calculators do
 * the work from the rule's `parameters`, so the arithmetic is live and the declaration is decoration. Named
 * here rather than fixed, because registering a calculator nobody calls would make the declaration look more
 * true, not less.
 */
const UNREGISTERED_ALLOW_LIST: Record<string, string> = {
  'calc-expense-deductibility':
    'B-148, measured not fixed in brief 72. No such function exists in `calculatorRegistry`. Deductibility '
    + 'is decided in `domain/deductibility.ts` from the rule parameters.',
  'calc-contribution-withholding':
    'B-148, measured not fixed in brief 72. No such function exists in `calculatorRegistry`. `dpi2026.ts` '
    + 'says of this rule that `calculatorId` is „a label only”, because the datorată / reținută / de plătit '
    + 'triple is composed inside `calcCas` and `calcCassLadder`.',
};

describe('B-148 — every calculatorId a registered rule package declares must be reachable in production', () => {
  const entries = defaultRuleReleaseRegistry.entries();
  const declared = new Map<string, string[]>();
  for (const entry of entries) {
    for (const rule of entry.rules) {
      const list = declared.get(rule.calculatorId) ?? [];
      list.push(`${rule.ruleId} @ ${entry.release.releaseId}`);
      declared.set(rule.calculatorId, list);
    }
  }

  it('the guard has something to guard: registered releases declare calculators', () => {
    // A guard over an empty set passes for the wrong reason. If this ever fails, the enumeration broke —
    // not the rule packages.
    expect(entries.length).toBeGreaterThan(0);
    expect(declared.size).toBeGreaterThan(5);
  });

  it('every declared calculatorId is a key in the registry at all, or is on the unregistered allow-list', () => {
    const missing = [...declared.keys()]
      .filter((id) => !(id in calculatorRegistry))
      .filter((id) => !(id in UNREGISTERED_ALLOW_LIST));
    expect(missing).toEqual([]);
  });

  it('the unregistered allow-list describes real debt: every listed id really is absent AND really is declared', () => {
    const stale = Object.keys(UNREGISTERED_ALLOW_LIST).filter((id) => id in calculatorRegistry);
    expect(stale).toEqual([]);
    const undeclared = Object.keys(UNREGISTERED_ALLOW_LIST).filter((id) => !declared.has(id));
    expect(undeclared).toEqual([]);
  });

  it('every declared calculatorId has a production `calculatorRegistry[...]` call site, or is on the allow-list', () => {
    const unreachable = [...declared.keys()]
      .filter((id) => !REACHED.has(id))
      .filter((id) => !(id in UNREACHED_ALLOW_LIST))
      .map((id) => `${id} ← declared by ${declared.get(id)!.join(', ')}`);
    expect(unreachable).toEqual([]);
  });

  it('the allow-list describes real debt: every listed id really IS unreachable, and really IS declared', () => {
    // The list cannot be used to park a reachable id, and it cannot name an id no rule declares. Both
    // directions, or the list rots into a way of silencing the guard.
    const stale = Object.keys(UNREACHED_ALLOW_LIST).filter((id) => REACHED.has(id));
    expect(stale).toEqual([]);
    const undeclared = Object.keys(UNREACHED_ALLOW_LIST).filter((id) => !declared.has(id));
    expect(undeclared).toEqual([]);
  });

  it('B-147 stays wired: `calc-dpi-flat-quota` is declared, registered AND called in production', () => {
    // The three facts that together were all false before brief 72, asserted together rather than apart.
    // `dpi2026.test.ts` already proved the second and third in isolation and proved nothing about the first.
    expect(declared.has('calc-dpi-flat-quota')).toBe(true);
    expect('calc-dpi-flat-quota' in calculatorRegistry).toBe(true);
    expect(REACHED.has('calc-dpi-flat-quota')).toBe(true);
  });

  it('dispatch is still literal: nothing reads `rule.calculatorId` in production outside `computeFiscal`', () => {
    // Pinned so the next reader of `ruleSetDigest.ts` cannot believe the mechanism the comment used to
    // describe. If dispatch ever becomes dynamic, this test is the one that has to be rewritten on purpose,
    // and the year-scoping guards in `tax.ts` have to be re-thought with it.
    const readers = PRODUCTION
      .filter(([, src]) => /calculatorRegistry\s*\[\s*rule\.calculatorId\s*\]/.test(codeOnly(src)))
      .map(([path]) => path);
    expect(readers).toEqual(['./calculators.ts']);
    // And `computeFiscal`, the one function that does, has no production caller.
    const callers = PRODUCTION
      .filter(([, src]) => /\bcomputeFiscal\s*\(/.test(codeOnly(src)))
      .map(([path]) => path)
      .filter((path) => !path.endsWith('calculators.ts'));
    expect(callers).toEqual([]);
  });
});
