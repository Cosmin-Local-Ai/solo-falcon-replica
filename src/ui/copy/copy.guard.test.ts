/**
 * TASK 7 — the language-layer guard.
 *
 * Three properties that were true the day this file was written and must stay true:
 *
 *  1. **No sentence lives in a component or a page.** Every Romanian sentence-shaped literal in
 *     `src/components/**` and `src/pages/**` is a defect: the words belong in `src/ui/copy/**` and the
 *     call site imports a key. This is the rule whose absence produced `checkLabels.ts` and the four
 *     `checkLabel` fallback maps that TASK 7 deleted.
 *
 *  2. **No internal token reaches the screen.** A `snake_case` identifier printed as JSX text or as a
 *     `title` / `placeholder` / `aria-label` is an enum value posing as a sentence. `personal_or_family_use`
 *     was a dropdown label and `review_required` was a settings hint until TASK 7.
 *
 *  3. **No sentence is spelled twice.** `Înregistrată` and `Respinsă` used to exist three times over
 *     (`REV_STATUS_LABEL`, `EXP_STATUS_LABEL`, `DECL_STATUS_LABEL` in `src/data/types.ts`), which is how a
 *     wording fix ends up half-applied.
 *
 * The scan is AST-based (`typescript` is already a dev dependency), so comments, import specifiers and
 * property names are never mistaken for user-visible text. Sources come in through Vite's raw glob, not
 * `node:fs` — this is a browser app with no `@types/node`, the same choice recorded in
 * `src/domain/thresholds.language.test.ts` and `src/data/identity.source.test.ts`.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Two globs, because Vite writes a glob key relative to this file: a page reads as
 * `../../pages/Dashboard.tsx` while a sibling copy module reads as `./records.ts`.
 */
const SURFACES = import.meta.glob('../../{components,pages}/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const COPY = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Test files assert on wording; they are not surfaces a person reads. */
const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path);

const surfaces = Object.keys(SURFACES).filter(p => !isTest(p)).sort();
const copyFiles = Object.keys(COPY).filter(p => !isTest(p)).sort();

/** A `snake_case` identifier — an internal code, never a word a person would read. */
const INTERNAL_TOKEN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

/** Attributes whose value is shown on screen or read aloud. */
const VISIBLE_ATTRS = new Set(['title', 'placeholder', 'aria-label', 'alt', 'label', 'summary']);

const DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;

/**
 * Function words that make a phrase Romanian even without a diacritic. Deliberately short: a miss here
 * only means a human still has to notice a stray sentence, while a false positive would block an
 * unrelated change.
 */
const ROMANIAN_WORDS = new Set([
  'nu', 'este', 'sunt', 'pentru', 'fără', 'din', 'și', 'sau', 'care', 'această', 'acesta', 'aceea',
  'nostru', 'propriu', 'prima', 'nicio', 'niciun', 'cum', 'am', 'ajuns', 'sumă', 'sumele', 'date',
  'datele', 'în', 'la', 'pe', 'un', 'de', 'mai', 'foarte', 'poate', 'trebuie', 'dvs', 'dumneavoastră',
  'când', 'dacă', 'toate', 'impozit', 'contribuție', 'venit', 'cheltuială', 'document', 'client',
  'furnizor', 'lună', 'anul', 'iulie', 'august', 'septembrie', 'decembrie',
]);
// Note: 'date' is deliberately NOT in the list — it collides with the English `date` in import paths
// and CSS, which is how the first version of this guard flagged `import { fmtDate } from '../domain/date'`.

/** Alphabetic words of ≥3 letters, diacritics included. */
const wordTokens = (s: string): string[] => s.match(/[A-Za-zĂăÂâÎîȘșȚț]{3,}/g) ?? [];

/**
 * Is this literal a sentence a person would read? Two real words plus either a Romanian diacritic or a
 * known Romanian function word. Technical strings (`1px solid var(--border)`, `btn btn-ghost`,
 * `RJIP_2026.csv`, `badge-warning`) fail the second test and pass through.
 */
function isRomanianSentence(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const tokens = wordTokens(trimmed);
  if (tokens.length < 2) return false;
  return DIACRITICS.test(trimmed) || tokens.some(t => ROMANIAN_WORDS.has(t.toLowerCase()));
}

interface Literal {
  text: string;
  line: number;
  /** True when the literal sits in a JSX text node or in a user-visible attribute. */
  rendered: boolean;
}

/**
 * The explicit allow-list. Each entry is a `<glob key>:<line>` where a sentence-shaped literal is
 * knowingly still inline in a component or page. It may only SHRINK: an entry needs a reason recorded in
 * `docs/ai/phases/21_language_layer.md`, and the last test in this file fails if an entry stops matching
 * a real violation, so a settled exception cannot linger as cover for the next one.
 *
 * It is empty. TASK 7 finished the sweep instead of parking exceptions.
 */
const ALLOW_LIST: readonly string[] = [];

/** Every literal in one file, with whether the renderer would print it. */
function literals(path: string, source: string): Literal[] {
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Literal[] = [];
  const lineAt = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const underVisibleAttr = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isJsxAttribute(parent)) return VISIBLE_ATTRS.has(parent.name.getText());
    if (ts.isJsxExpression(parent)) return underVisibleAttr(parent);
    return false;
  };

  /** `import … from '../domain/date'` is a module specifier, not text on screen. */
  const isModuleSpecifier = (node: ts.Node): boolean => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return true;
    return false;
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text) found.push({ text, line: lineAt(node.pos), rendered: true });
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isModuleSpecifier(node)) {
        found.push({ text: node.text, line: lineAt(node.pos), rendered: underVisibleAttr(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('the language layer (TASK 7)', () => {
  it('scans the surfaces it claims to scan', () => {
    // Guards the guard: a moved directory must not silently shrink coverage to nothing.
    expect(surfaces.length).toBeGreaterThan(20);
    expect(surfaces).toContain('../../pages/Dashboard.tsx');
    expect(surfaces).toContain('../../components/FinancialChart.tsx');
    expect(copyFiles.length).toBeGreaterThan(5);
  });

  it('no component or page carries a user-visible sentence', () => {
    const violations: string[] = [];
    for (const file of surfaces) {
      for (const lit of literals(file, SURFACES[file])) {
        if (isRomanianSentence(lit.text)) {
          const key = `${file}:${lit.line}`;
          if (ALLOW_LIST.includes(key)) continue;
          violations.push(`${key}  „${lit.text.replace(/\s+/g, ' ').slice(0, 110)}”`);
        }
      }
    }
    expect(violations, 'sentences belong in src/ui/copy, not in components or pages').toEqual([]);
  });

  it('the allow-list earns its place', () => {
    // An entry that no longer corresponds to a real violation must be deleted, not kept "just in case".
    const live = new Set<string>();
    for (const file of surfaces) {
      for (const lit of literals(file, SURFACES[file])) {
        if (isRomanianSentence(lit.text)) live.add(`${file}:${lit.line}`);
      }
    }
    const stale = ALLOW_LIST.filter(key => !live.has(key));
    expect(stale, 'these allow-list entries no longer match anything — delete them').toEqual([]);
  });

  it('no internal snake_case token is rendered as text', () => {
    const violations: string[] = [];
    for (const file of surfaces) {
      for (const lit of literals(file, SURFACES[file])) {
        const text = lit.text.trim();
        if (!INTERNAL_TOKEN.test(text)) continue;
        // A snake_case value printed as JSX text, or handed to a tooltip/label, is an enum on screen.
        if (lit.rendered) violations.push(`${file}:${lit.line}  ${text}`);
      }
    }
    expect(violations, 'an internal code reached the screen').toEqual([]);
  });

  it('no sentence is spelled twice inside the copy layer', () => {
    const seen = new Map<string, string[]>();
    for (const file of copyFiles) {
      for (const lit of literals(file, COPY[file])) {
        const text = lit.text.trim().replace(/\s+/g, ' ');
        // Sentences only. 'Data' as a column header in two tables is normal UI language; a whole
        // sentence in two modules is a drift hazard.
        if (!isRomanianSentence(text) || wordTokens(text).length < 4) continue;
        const where = seen.get(text) ?? [];
        if (!where.includes(file)) where.push(file);
        seen.set(text, where);
      }
    }
    const duplicates = [...seen.entries()]
      .filter(([, where]) => where.length > 1)
      .map(([text, where]) => `„${text.slice(0, 80)}” in ${where.join(', ')}`);
    expect(duplicates, 'the same sentence lives in more than one copy module').toEqual([]);
  });
});
