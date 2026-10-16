/**
 * B-158 — the citation marker the corpus could not confirm is not allowed to spread back.
 *
 * **What was measured, and what was changed.** `research/55` §3 confirmed the *letter* of the postal /
 * telecom line and its verbatim text in the FY2026 Titlul IV norms, but **could not confirm the alineat
 * marker for the illustrative list at all** — the free extract does not render the marker, and the Portal
 * Legislativ consolidated norms (~5 MB) would not fetch whole. Brief 80 swept `… lit. o)` (B-157) and
 * brief 81 swept the rest: **12 further sites** across `data/dashboard.test.ts`, `data/seed.ts`,
 * `fiscal/deductibility.ts`, `fiscal/depreciation.ts` and the six `NORME(…)` citation strings in
 * `fiscal/deductibility2026.ts` now read `pct. 7` plus the letter and the quoted text, with no alineat
 * (D-CITE-1: the text carries the meaning, the locator is secondary).
 *
 * **The sweep was proven citation-only, not assumed.** `ruleSetDigest` hashes **every** parameter of every
 * rule, including the text parameters the engine surfaces to the user (`condition`, `missing_fact`, `note`,
 * `conflict`), while `sourceAct` / `sourceArticle` / `sourceUrl` are deliberately excluded — „a hash is not
 * a legal citation". So the six `NORME(…)` strings could be corrected without touching arithmetic, and that
 * was checked: the digest of all 54 rules and of the whole 2026 set is byte-identical before and after
 * (captured by a throwaway probe, then deleted).
 *
 * **What is frozen, and why this file exists.** Ten occurrences of the marker sit inside **rule parameters**
 * or inside files this brief fenced. Changing a parameter moves that rule's digest, and `registry.ts`
 * refuses a digest change without a version bump — so removing the marker there is a **release-version
 * decision**, not a wording edit, and brief 81's boundary said the rule package and its digests stay
 * untouched. Those sites are listed below with their reason rather than quietly left out: the list may only
 * **shrink**, and the second test fails if an entry stops matching a real occurrence, so a settled fix
 * cannot linger as cover for the next unverified marker.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['/src/**/*.{ts,tsx}', '/e2e/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SELF = '/src/domain/fiscal/citationHonesty.test.ts';

/**
 * The unverified alineat on the pct. 7 illustrative list. Written as a pattern rather than a literal so
 * this file cannot be the thing it scans for.
 */
const UNVERIFIED_MARKER = /pct\. 7 alin\. \(5\)/g;

/**
 * Every place the marker is still allowed to stand, with the reason it stands.
 *
 * `occurrences` is exact, not a ceiling: an entry that no longer matches reality must be deleted.
 */
const FROZEN: ReadonlyArray<{ file: string; occurrences: number; reason: string }> = [
  {
    file: '/src/domain/fiscal/deductibility2026.ts',
    occurrences: 7,
    reason:
      'Six `note`/`missingFact` spec strings and the PROFESSIONAL_CONTRIBUTION_CONFLICT text become rule ' +
      'PARAMETERS (`rule()` pushes them as `{id, value, unit: "text"}`), and `digestRule` hashes every ' +
      'parameter. Editing them moves that rule\'s digest, and `registry.ts` throws unless the rule\'s ' +
      '`version` moves with it — a 2026 release-version bump, which is a release decision, not a wording fix.',
  },
  {
    file: '/src/domain/fiscal/package2026.ts',
    occurrences: 3,
    reason:
      'One parameter value (`payment_timing_open_question`), one `sourceArticle`, one comment. The rule ' +
      'package itself is fenced by brief 81\'s boundary; the `sourceArticle` occurrence would be ' +
      'digest-safe and is left only because the file is fenced.',
  },
];

const occurrences = (): Map<string, number> => {
  const found = new Map<string, number>();
  for (const [file, source] of Object.entries(SOURCES)) {
    if (file === SELF) continue;
    const n = (source.match(UNVERIFIED_MARKER) ?? []).length;
    if (n > 0) found.set(file, n);
  }
  return found;
};

describe('B-158 — an unverified citation marker does not get to spread', () => {
  it('the marker appears nowhere except the frozen list, and never in a new file', () => {
    const allowed = new Map(FROZEN.map((f) => [f.file, f.occurrences]));
    const strays: string[] = [];
    for (const [file, n] of occurrences()) {
      if (!allowed.has(file)) strays.push(`${file} (${n})`);
    }
    expect(strays, 'a pct. 7 alineat was re-introduced somewhere the corpus never confirmed').toEqual([]);
  });

  it('the frozen list earns its place: every entry still matches reality, exactly', () => {
    const live = occurrences();
    const stale = FROZEN.filter((f) => live.get(f.file) !== f.occurrences).map(
      (f) => `${f.file}: list says ${f.occurrences}, the file has ${live.get(f.file) ?? 0} — ${f.reason}`,
    );
    expect(stale, 'the frozen list drifted — fix the sites or update the list, do not leave the entry').toEqual([]);
  });

  it('the sweep happened: the citation-carrying files read pct. 7 with a letter and no alineat', () => {
    // Asserting the corrected form, not only the absence of the old one — otherwise a later edit could
    // drop the alineat AND the letter, and the citation would quietly stop naming anything.
    for (const file of [
      '/src/domain/fiscal/depreciation.ts',
      '/src/domain/fiscal/deductibility2026.ts',
      '/src/data/seed.ts',
    ]) {
      const source = SOURCES[file];
      expect(source, `${file} is not scanned`).toBeDefined();
      expect(/pct\. 7 lit\. [a-z]/.test(source), `${file} still cites pct. 7 without a litera`).toBe(true);
    }
  });
});
