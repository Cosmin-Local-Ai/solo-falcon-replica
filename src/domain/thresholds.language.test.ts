/**
 * TASK 4 — the false legal claims are gone from the source, not just from the screen.
 *
 * `thresholds.ts` used to carry `breachMeaningFor`, which returned
 *   'Sub baza minimă — dezcalificare din regim'            (min-base)
 *   'Peste plafonul maxim al bazei — schimbare de regim'   (max-base)
 *
 * Both were deleted rather than reworded, because a reworded sentence still asserts a legal
 * consequence the law does not create. `docs/ai/research/24_cas_floor_consequence_2026.md` searched
 * the consolidated Cod fiscal (through Legea 170/2026) and found ZERO occurrences of „decălificare"
 * and no provision making a net income below 12 salarii minime a breach, a regime change, a
 * mandatory rectification, a penalty or a reportable event: the 12-SM figure is the entry threshold
 * for the CAS obligation (art. 148 alin. (1)) and the minimum base (art. 148 alin. (2) lit. a)), and
 * below it the consequence is `nu datorează contribuția de asigurări sociale`, with an optional
 * election under art. 148 alin. (4).
 *
 * A grep written into a phase doc goes stale the moment someone adds a file, so the check lives in
 * the suite: it walks the real source tree and fails with the offending paths. Sources are pulled in
 * with Vite's raw glob rather than `node:fs` — this is a browser app with no `@types/node` (the same
 * choice `src/data/identity.source.test.ts` records).
 */
import { describe, expect, it } from 'vitest';

/** Every app source file, as raw text, keyed by path relative to this file. */
const SOURCES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const APP_FILES = Object.keys(SOURCES)
  // This test names the deleted strings in order to forbid them; test files are not app copy.
  .filter((path) => !/\.test\.tsx?$/.test(path) && !/\.d\.ts$/.test(path))
  .sort();

/**
 * The two sentences TASK 4 deletes, verbatim. They must not survive anywhere — not in a domain
 * string, not in a component, not in a comment that would let them be pasted back.
 */
const DELETED_SENTENCES = [
  'Sub baza minimă — dezcalificare din regim',
  'Peste plafonul maxim al bazei — schimbare de regim',
];

/**
 * Legal claims no primary source supports for these thresholds (research 24, "What the app must not
 * state" items 1-4). `decălificare` is the term the Researcher searched the whole Cod fiscal for and
 * found zero occurrences of; `dezcalificare` is the misspelling the deleted string used.
 */
const FORBIDDEN_CLAIMS = ['dezcalificare', 'decălificare', 'decific', 'decertific'];

function offenders(pattern: RegExp, text: (path: string) => string = (p) => SOURCES[p]): string[] {
  return APP_FILES.filter((path) => pattern.test(text(path)));
}

/**
 * Strip comments so prose that NAMES a retired claim ("this asserted a `dezcalificare` the law does
 * not create") does not trip a check about copy the app actually renders. The two deleted SENTENCES
 * are still policed across the raw text: a comment that pastes them back is exactly the drift this
 * task exists to prevent.
 */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function quote(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

describe('the deleted threshold claims stay deleted (TASK 4 acceptance)', () => {
  it('finds the source tree it is meant to police', () => {
    // Guards against the check silently passing because the glob stopped matching.
    expect(APP_FILES.length).toBeGreaterThan(30);
    expect(APP_FILES.map((p) => p.slice(p.lastIndexOf('/') + 1))).toContain('thresholds.ts');
    expect(APP_FILES.map((p) => p.slice(p.lastIndexOf('/') + 1))).toContain('ThresholdSection.tsx');
  });

  it('contains neither deleted sentence, anywhere in the app sources', () => {
    for (const sentence of DELETED_SENTENCES) {
      expect(offenders(quote(sentence)), sentence).toEqual([]);
    }
  });

  it('contains no decălificare-style claim in any rendered copy', () => {
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(offenders(quote(claim), (p) => codeOnly(SOURCES[p])), claim).toEqual([]);
    }
  });

  it('no longer exports or references breachMeaningFor / breachMeaning', () => {
    // The field and the function are gone, so nothing can render them by accident. A rename to
    // `consequence` is what makes an un-migrated consumer a compile error instead of a stale string.
    // Comments may still recount what was deleted; code may not still call it.
    const code = (p: string) => codeOnly(SOURCES[p]);
    expect(offenders(/\bbreachMeaningFor\b/, code)).toEqual([]);
    expect(offenders(/\bbreachMeaning\b/, code)).toEqual([]);
  });

  it('the replacement vocabulary is present where the claims used to live', () => {
    const thresholds = SOURCES['./thresholds.ts'];
    expect(thresholds).toBeDefined();
    // The kind union TASK 4 introduces, exactly as the handoff states it.
    expect(thresholds).toContain(
      "export type ThresholdKind = 'registration' | 'tier_transition' | 'over_limit' | 'informational';",
    );
    expect(thresholds).toContain("export type ThresholdSeverity = 'none' | 'low' | 'medium' | 'high';");
    expect(thresholds).toContain("export type Applicability = 'applicable' | 'not_applicable' | 'unknown';");
    // And the factual consequence the research supports, cited.
    expect(thresholds).toContain('nu se datorează contribuția de asigurări sociale pentru acest an');
    expect(thresholds).toContain('art. 148 alin. (1) și (4) din Codul fiscal');
  });
});
