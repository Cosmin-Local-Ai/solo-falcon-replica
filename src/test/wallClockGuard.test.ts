import { describe, expect, it } from 'vitest';

/**
 * B-23 (Phase 9b) removed the one assertion that compared a computed fiscal year against the machine
 * clock. That was a fix; THIS is the rule. B-23 is standing, not a one-off: no test under `src/**` may
 * read the wall clock, because a suite that does turns red on 1 January for no code reason and can
 * never be re-run deterministically — the exact failure mode the injectable `instant` parameter on
 * every engine entry point exists to prevent.
 *
 * So the rule is enforced mechanically here and cannot silently regress.
 *
 * Two exclusions, both honest rather than loopholes:
 *  - COMMENT lines are skipped. The brief for this change says comments are fine, and
 *    `store.migration.test.ts` keeps a comment naming the assertion it deleted; forbidding the words
 *    would only encourage deleting the explanation.
 *  - `e2e/**` is not scanned. `e2e/dashboard.spec.ts` builds a profile start date relative to the
 *    current day on purpose, and the assertion it feeds is that the start date changes NOTHING —
 *    clock-relative input, clock-invariant expectation. The acceptance criterion for this rule is
 *    `src/**`, and it is met there.
 *
 * A test that genuinely needs "now" must inject an instant (every entry point already accepts one) or
 * install fake timers explicitly. Neither is a wall-clock read.
 */

const OFFENDERS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'a Date constructed with no arguments', re: /new\s+Date\s*\(\s*\)/ },
  { label: 'the epoch-now accessor', re: /\bDate\s*\.\s*now\s*\(\s*\)/ },
  { label: 'the monotonic-clock accessor', re: /\bperformance\s*\.\s*now\s*\(\s*\)/ },
];

/**
 * The suite's own source, as text. Read through Vite's raw glob rather than `node:fs`: this project
 * deliberately carries no `@types/node`, and `tsc --noEmit` is part of the build.
 */
const SUITE_SOURCES = import.meta.glob<string>('/src/**/*.test.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Blank for a comment-only line; otherwise the line with any trailing line-comment removed. */
function stripComments(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return '';
  const at = line.search(/\s\/\//); // `\s//` so a URL scheme (`https://`) is not read as a comment
  return at === -1 ? line : line.slice(0, at);
}

describe('B-23 standing rule — no test in src/ may read the wall clock', () => {
  it('finds no real-clock read in any vitest file under src/', () => {
    const hits: string[] = [];
    for (const [file, source] of Object.entries(SUITE_SOURCES)) {
      source.split('\n').forEach((raw, index) => {
        const line = stripComments(raw);
        if (!line) return;
        for (const { label, re } of OFFENDERS) {
          if (re.test(line)) hits.push(`${file}:${index + 1} — ${label} — ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('is not vacuous: it scans the whole suite and the patterns still fire', () => {
    // If the glob ever matches nothing, the check above would pass for the wrong reason.
    expect(Object.keys(SUITE_SOURCES).length).toBeGreaterThan(30);
    // Built by concatenation so this file never contains the token it forbids.
    const offender = ['new Date', '()', '.getFullYear()'].join('');
    expect(OFFENDERS.some(({ re }) => re.test(offender))).toBe(true);
    // The sanctioned form — a pinned instant — must not fire.
    expect(OFFENDERS.some(({ re }) => re.test("new Date('2026-06-01T12:00:00Z')"))).toBe(false);
  });
});

/**
 * PG-2 (B-46) — the same rule, pointed at the surfaces that write stored dates.
 *
 * `domain/date.ts` opens by claiming it is the only place `src/` reads the clock, and that claim was
 * false: three form defaults read the wall clock themselves, and because `toISOString()` is UTC they
 * seeded **31 Dec 2026** into a record created at 00:30 on 1 Jan 2027 — a new record born in the previous
 * fiscal year. A comment cannot hold that invariant; this can. A page that needs "today" calls
 * `localDateISO()` / `localYear()`, which take the instant from `now()` and are therefore pinned by
 * `pinClock()` like everything else.
 *
 * The scan is over `pages/` and `components/` only. `domain/date.ts` itself is the seam and is allowed to
 * read the clock; the domain, data and test layers are covered by the rule above and by their own tests.
 */
const PRODUCTION_SURFACES = import.meta.glob<string>('/src/{pages,components}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Page and component tests live beside their surface; they are sanctioned by the rule above. */
const isTestFile = (path: string): boolean => /\.test\.tsx?$/.test(path);

/**
 * The epoch accessor is deliberately not part of this scan. `Settings.tsx` uses it to build a bank-account
 * id, which is not a calendar date and cannot land a record in the wrong fiscal year — B-46 is the class
 * of defect this guard exists for. That call is still an unpinned clock read in a surface, and it belongs
 * on the register as a finding (the app already has `domain/date.ts epochMs()` for exactly that use); it is
 * not fixed here because `Settings.tsx` is outside this phase's boundary.
 */
const PRODUCTION_OFFENDERS = OFFENDERS.filter(({ label }) => label !== 'the epoch-now accessor');

describe('B-46 — no page or component may read the wall clock itself', () => {
  it('finds no real-clock read in any page or component', () => {
    const hits: string[] = [];
    for (const [file, source] of Object.entries(PRODUCTION_SURFACES)) {
      if (isTestFile(file)) continue;
      source.split('\n').forEach((raw, index) => {
        const line = stripComments(raw);
        if (!line) return;
        for (const { label, re } of PRODUCTION_OFFENDERS) {
          if (re.test(line)) hits.push(`${file}:${index + 1} — ${label} — ${line.trim()}`);
        }
      });
    }
    expect(hits, 'a surface that reads the clock itself is not pinned by pinClock(): call domain/date').toEqual([]);
  });

  it('is not vacuous: the glob covers the pages that carried the defect', () => {
    const files = Object.keys(PRODUCTION_SURFACES).filter(f => !isTestFile(f));
    expect(files.length).toBeGreaterThan(20);
    for (const page of ['Revenues', 'Expenses', 'Declarations', 'Documents']) {
      expect(files.some(f => f.endsWith(`/pages/${page}.tsx`)), `pages/${page}.tsx left the scan`).toBe(true);
    }
  });
});
