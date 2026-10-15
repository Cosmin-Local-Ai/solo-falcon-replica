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
import { THRESHOLD_SPECS, type FiscalBase } from './thresholds';
import type { CapBase } from './fiscal/deductibility';
import { capBaseLabels, capBaseSentence, fiscalBaseLabels, unmeasuredBasisReason } from '../ui/copy/thresholds';

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

/**
 * B-55 — no internal identifier inside a rendered Romanian sentence.
 *
 * `computeThresholds` used to write
 *   `Baza „${spec.requiredFiscalBase}” nu a fost furnizată; pragul nu poate fi evaluat.`
 * which put `net-income` / `revenue-excl-vat` on a person's screen. The copy guard cannot catch this: its
 * glob is `components/**` and `pages/**`, it inspects only literal nodes, and its internal-token regex is
 * underscore-only, so a kebab-case enum would have slipped past even in a file it does scan. This file
 * already walks the whole `src/**` tree, so the rule lives here.
 *
 * It is deliberately scoped to the `FiscalBase` family rather than to "any identifier in a quote":
 * `src/domain/estimateBasis.ts` has the same defect with the `CapBase` union and is outside this brief's
 * boundary. Widening the rule here would have turned a reported defect into a red suite.
 *
 * B-138 closed that deferral: the `CapBase` case is now fixed, so the rule below covers it too. The
 * sentence above is kept because it records why the widening did not happen in TASK 7 — a guard widened
 * over a live defect reports a red suite instead of a fixed app, and that trade was the right one then.
 */
const FISCAL_BASES: readonly FiscalBase[] = [
  'revenue-incl-vat',
  'revenue-excl-vat',
  'expense-incl-vat',
  'expense-excl-vat',
  'net-income',
];

describe('no internal identifier reaches a rendered Romanian sentence (B-55)', () => {
  it('no app source quotes a FiscalBase code inside a Romanian sentence', () => {
    for (const base of FISCAL_BASES) {
      const pattern = quote(`„${base}”`);
      expect(
        offenders(pattern, p => codeOnly(SOURCES[p])),
        `„${base}” is still quoted at a person rather than at a compiler`,
      ).toEqual([]);
    }
  });

  it('every base the shipped specs can require has a Romanian wording', () => {
    // The compile-time half is `Record<FiscalBase, string>`, so a new base is a type error. This is the
    // runtime half: a base that can reach the screen has words before it ships.
    const required = [...new Set(THRESHOLD_SPECS.map(s => s.requiredFiscalBase))];
    expect(required.length).toBeGreaterThan(0);
    for (const base of required) {
      expect(fiscalBaseLabels[base], `no Romanian wording for the fiscal base '${base}'`).toBeTruthy();
    }
  });

  it('the unmeasured-basis sentence names the base in Romanian and never as a code', () => {
    for (const base of FISCAL_BASES) {
      const reason = unmeasuredBasisReason(base);
      expect(reason).toContain(fiscalBaseLabels[base]);
      for (const code of FISCAL_BASES) expect(reason).not.toContain(code);
      // Still the sentence the component test and `e2e/dashboard.spec.ts` match on.
      expect(reason).toContain('nu a fost furnizată');
    }
  });
});

/**
 * B-138 — the same leak, the other identifier family.
 *
 * `estimateBasis.ts unresolvedCapDetail` used to write
 *   `Plafonul se calculează pe baza „${cap.base}” (${article}) — …`
 * which put `annual_eur_per_person` / `annual_salary_expense` on a person's screen, and three tests
 * asserted the code as the way to find the node — the suite had pinned the leak as correct behaviour.
 * The wording is now `ui/copy/thresholds.ts capBaseLabels`, exhaustive over `CapBase`; the rule below is
 * what stops the next cap base from shipping as an enum.
 */
const CAP_BASES: readonly CapBase[] = [
  'expense_itself',
  'art68_alin6_base',
  'gross_income',
  'annual_salary_expense',
  'annual_eur_per_person',
];

describe('no internal cap identifier reaches a rendered Romanian sentence (B-138)', () => {
  it('no app source quotes a CapBase code inside a Romanian sentence', () => {
    for (const base of CAP_BASES) {
      const pattern = quote(`„${base}”`);
      expect(
        offenders(pattern, p => codeOnly(SOURCES[p])),
        `„${base}” is still quoted at a person rather than at a compiler`,
      ).toEqual([]);
    }
  });

  it('every cap base the union can carry has a Romanian wording', () => {
    // The compile-time half is `Record<CapBase, string>`. This is the runtime half: a base that can reach
    // the screen has words before it ships.
    for (const base of CAP_BASES) {
      expect(capBaseLabels[base], `no Romanian wording for the cap base '${base}'`).toBeTruthy();
    }
  });

  it('the cap sentence names the base in Romanian and never as a code', () => {
    for (const base of CAP_BASES) {
      const sentence = capBaseSentence(base, 'art. 154 alin. (1) lit. b) CF');
      expect(sentence).toContain(capBaseLabels[base]);
      for (const code of CAP_BASES) expect(sentence).not.toContain(code);
      // Still the sentence `Expenses.capBanner.test.tsx` and the exclusion rows match on.
      expect(sentence).toContain('Plafonul se calculează pe baza');
    }
  });
});

/**
 * B-139 — the guard widened to the general case, instead of extended with a fourth family list.
 *
 * Three briefs have fixed one defect. B-55 added `const FISCAL_BASES`, B-138 added `const CAP_BASES`, and
 * each added a loop over its own list. A hand-written list can only police the families somebody already
 * thought of, so the next enum guarantees a fourth brief and then a fifth — which is what happened.
 *
 * Two rules replace the lists, and neither names a family:
 *
 * **Rule 1 — the code universe is derived, not written out.** Every code→Romanian map the app ships is a
 * runtime object, and the house pattern makes those maps exhaustive over their union (`satisfies
 * Record<Union, string>`). So `Object.keys()` of every such map in the copy layer IS the set of internal
 * codes that have wordings, including families this file has never heard of. No app source may quote one
 * inside „…”.
 *
 * **Rule 2 — an interpolation inside „…” is denied by default.** The three leaks were never literal codes;
 * they were `„${spec.requiredFiscalBase}”`, `„${cap.base}”` and `„${field}”`, and a literal-code scan cannot
 * see those. What can be decided without knowing the family is *what kind of thing is being quoted*: a
 * wording lookup, or a value the person typed or a record carries, are allowed; anything else is an internal
 * name and fails until a human adds it with a reason. The test `the three historical families fail the shape
 * rule on shape alone` is the proof this is a rule and not a renamed list — it rejects the exact expressions
 * B-55, B-138 and B-139 shipped, without knowing the names `FiscalBase`, `CapBase` or `FiscalDateField`.
 *
 * **What these rules cannot do, stated plainly.** They cannot prove an interpolation is safe; they can only
 * make an unjustified one fail. `„${status}”` is a person's e-Factura status in `ui/copy/attention.ts` and
 * could be an internal enum in another file — the syntax is identical, so the guard cannot tell them apart
 * and the difference has to be written down by a person next to the site. Neither rule follows data flow: a
 * sentence assembled as `const w = cap.base; … „${w}”` is invisible to a text scan, and so is a code that
 * reaches a sentence through a template built in another module. Closing that would need the type checker,
 * and this suite runs in the browser with no `@types/node` and no compiler API (the choice recorded at the
 * top of this file). The honest deliverable is therefore default-deny with a named, countable exemption
 * list: it converts „someone leaked an enum” into „someone had to justify a site, by name, with a reason”.
 */

/** A key that reads as an internal code rather than as Romanian. */
function codeShaped(key: string): boolean {
  return /^[a-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/.test(key);
}

interface DerivedCodeMap {
  path: string;
  /** The exported binding; `parent.child` for a map nested inside a copy namespace. */
  name: string;
  labels: Record<string, string>;
}

const COPY_MODULES = import.meta.glob('../ui/copy/**/*.ts', {
  eager: true,
}) as Record<string, unknown>;

function collectCodeMaps(value: unknown, path: string, name: string, out: DerivedCodeMap[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 0 && entries.every(([k, v]) => codeShaped(k) && typeof v === 'string' && v.trim().length > 0)) {
    out.push({ path, name, labels: Object.fromEntries(entries) as Record<string, string> });
    return; // the values of a code map are words; there is nothing below it to descend into
  }
  for (const [k, v] of entries) collectCodeMaps(v, path, name ? `${name}.${k}` : k, out);
}

const CODE_MAPS: DerivedCodeMap[] = [];
for (const [path, mod] of Object.entries(COPY_MODULES)) {
  // `index.ts` only re-exports the others; counting it twice would inflate the map list without adding a code.
  if (path.endsWith('/index.ts')) continue;
  for (const [name, value] of Object.entries((mod ?? {}) as Record<string, unknown>)) {
    collectCodeMaps(value, path, name, CODE_MAPS);
  }
}

const DERIVED_CODES: readonly string[] = [...new Set(CODE_MAPS.flatMap(m => Object.keys(m.labels)))].sort();

/**
 * What may sit inside `„${…}”` without a per-site exemption: the names of values a person typed or a record
 * carries. This is a list of *kinds of value*, not of enum families — which is what makes the rule general.
 */
const QUOTABLE_VALUE_NAMES: ReadonlySet<string> = new Set([
  'value', 'name', 'shown', 'code', 'status', 'reason', 'onDate', 'd',
  'label', 'nr', 'nume', 'denumire', 'reference', 'currency',
]);

/**
 * Decide whether an expression interpolated inside `„…”` is justified.
 *
 * Three ways to pass, and everything else fails: it is a copy-layer wording lookup; it is a member chain
 * whose final segment is a value name; or it is a bare value name. A wording lookup passes whatever it is
 * indexed by, because the index is the code the compiler reads and the map is what the person reads.
 */
function justifiesQuotedExpression(expr: string): boolean {
  if (/(Labels|labels|Source)\[/.test(expr)) return true;

  // String literals are prose, not names — `'(necompletat)'` must not be read as an identifier.
  const withoutStrings = expr.replace(/'[^']*'/g, ' ').replace(/"[^"]*"/g, ' ');
  const chains = withoutStrings.match(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g) ?? [];
  const standalone = withoutStrings
    .replace(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g, ' ')
    .match(/[A-Za-z_$][\w$]*/g) ?? [];

  return (
    chains.every(c => QUOTABLE_VALUE_NAMES.has(c.slice(c.lastIndexOf('.') + 1)))
    && standalone.every(n => QUOTABLE_VALUE_NAMES.has(n))
  );
}

/**
 * A derived code quoted literally, listed per site. There is one, and it is a false positive kept visible
 * rather than hidden: `aport` is simultaneously a code in `ui/copy/assets.ts` and an ordinary Romanian
 * legal noun, and the v17 migration summary uses it as the noun („Un „aport” … inventat decide întrebarea
 * contestată”). No shape test can separate the two either — `aport` is a perfectly ordinary lowercase
 * identifier-shaped Romanian word — so the exemption records the judgement instead of the rule pretending
 * not to have made one.
 */
const LITERAL_QUOTE_EXEMPTIONS: ReadonlyArray<{ file: string; code: string; why: string }> = [
  // ── Romanian words that are also map keys. The derivation cannot tell these apart from codes, because
  //    `da`, `nu` and `aport` are ordinary lowercase Romanian words AND keys in a copy map. Each is a word
  //    used as a word, in a sentence that is *about* the answer or the noun, not a value substituted in.
  {
    file: '../data/migration.ts',
    code: 'aport',
    why: 'Romanian legal noun in the v17 summary („Un „aport” … inventat decide întrebarea contestată”), not the `ui/copy/assets.ts` acquisition-kind code. The word and the code coincide.',
  },
  { file: '../data/migration.ts', code: 'da', why: 'the Romanian word for „yes”, discussing a stored yes/no answer.' },
  { file: '../ui/copy/settings.ts', code: 'da', why: 'the Romanian word for „yes”; D-AIC-2 is about what a „da” commits the person to.' },
  { file: './fiscal/package2026.ts', code: 'nu', why: 'the Romanian word for „no”, used as „no” in prose.' },
  // ── The fourth instance the guard found, reported rather than fixed. Migration step summaries quote the
  //    storage key or the stored status they are *about*. Rewriting shipped migration copy is a separate
  //    decision from a copy sweep — the summary is the record of what a step did, and here the key IS the
  //    subject of the sentence („pensionStatus” a fost redenumit în „pensionerStatus”), not a value dropped
  //    into prose. Recorded so the next pass can decide, not quietly reworded by this one.
  { file: '../data/migration.ts', code: 'declarations', why: 'the v10 summary names the storage key it left in lei.' },
  { file: '../data/migration.ts', code: 'inregistrata', why: 'the v11 summary quotes the monthly row\'s status to explain why it was not read as proof of a filing.' },
  { file: '../data/migration.ts', code: 'pensionerStatus', why: 'the v8 summary names the key it renamed — the key is the subject, not a substituted value.' },
];

/**
 * Sites the shape rule cannot justify, listed one per site so the count is visible and a new one fails. An
 * entry here is not a pass — it is a leak or a judgement call with a name and a reason attached, and the
 * last test in this block fails if the site stops existing, so an exemption cannot outlive the code it excuses.
 */
const QUOTED_INTERPOLATION_EXEMPTIONS: ReadonlyArray<{ file: string; expr: string; why: string }> = [
  {
    file: './regimes.ts',
    expr: 'regime',
    why: 'B-139 boundary: the regime refusal quotes the stored value it refused. `PFA_REGIME_DESCRIPTORS[regime].label` exists and should be used, but four B-9/B-14 tests pin this wording and §4 of brief 67 puts the regime vocabulary out of scope. Reported, not fixed.',
  },
  {
    file: './regimes.ts',
    expr: 'String(regime)',
    why: 'same site family as the line above — the unknown-regime branch.',
  },
  {
    file: '../ui/copy/onboarding.ts',
    expr: 'regime',
    why: 'the same leak in the onboarding copy; outside brief 67\'s boundary, reported as a finding.',
  },
  {
    file: './estimateBasis.ts',
    expr: 'c.treatment',
    why: 'a rule-package treatment code quoted at a person; found by this guard, outside brief 67\'s boundary, reported as a finding.',
  },
];

/** Every `„${…}”` in one app source, as the expression text being quoted. */
function quotedInterpolations(path: string): string[] {
  const code = codeOnly(SOURCES[path] ?? '');
  const out: string[] = [];
  const re = /„\$\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code)) !== null) out.push(match[1].trim());
  return out;
}

describe('the general identifier-leak guard (B-139)', () => {
  it('derives a code universe without being told which families exist', () => {
    // A guard that quietly finds nothing is worse than the lists it replaces.
    expect(CODE_MAPS.length).toBeGreaterThan(10);
    expect(DERIVED_CODES.length).toBeGreaterThan(50);

    // The families this file has already been asked about are all in the derived set — which is the proof
    // the derivation reaches them without naming them.
    for (const code of ['net-income', 'annual_eur_per_person', 'collected', 'paid', 'valoareFaraTva', 'tva']) {
      expect(DERIVED_CODES.includes(code), `the derived universe does not contain '${code}'`).toBe(true);
    }
  });

  it('no app source quotes a code that has a Romanian wording', () => {
    const found: string[] = [];
    for (const code of DERIVED_CODES) {
      const pattern = quote(`„${code}”`);
      for (const path of offenders(pattern, p => codeOnly(SOURCES[p]))) {
        if (LITERAL_QUOTE_EXEMPTIONS.some(e => e.file === path && e.code === code)) continue;
        found.push(`${path}: „${code}”`);
      }
    }
    expect(found, 'a code that has a Romanian wording is quoted at a person').toEqual([]);
  });

  it('every derived code has a wording, and the wording is not the code', () => {
    for (const map of CODE_MAPS) {
      for (const [code, label] of Object.entries(map.labels)) {
        expect(label, `${map.path} ${map.name}[${code}] has no wording`).toBeTruthy();
        expect(label, `${map.path} ${map.name}[${code}] labels the code with itself`).not.toBe(code);
      }
    }
  });

  it('every „${…}” in an app source is justified by shape or listed by name', () => {
    const unjustified: string[] = [];
    for (const path of APP_FILES) {
      for (const expr of quotedInterpolations(path)) {
        if (justifiesQuotedExpression(expr)) continue;
        if (QUOTED_INTERPOLATION_EXEMPTIONS.some(e => e.file === path && e.expr === expr)) continue;
        unjustified.push(`${path}: „\${${expr}}”`);
      }
    }
    expect(unjustified, 'an internal name is quoted at a person').toEqual([]);
  });

  it('the three historical families fail the shape rule on shape alone', () => {
    // The proof the rule is general: these are the expressions B-55, B-138 and B-139 actually shipped, and
    // the rule rejects them without knowing the names FiscalBase, CapBase or FiscalDateField.
    for (const expr of ['spec.requiredFiscalBase', 'cap.base', 'field', 'c.treatment', 'regime', 'onDateSource']) {
      expect(justifiesQuotedExpression(expr), `'${expr}' must not be justified`).toBe(false);
    }
    // …and it accepts the forms that replaced them, plus the value quotations that were always fine.
    for (const expr of [
      'fiscalBaseLabels[base]', 'capBaseLabels[base]', 'fiscalDateSource[field]', 'moneyFieldLabels[field]',
      "value === '' ? '(necompletat)' : value", 'record.nr', 'resolution.label', 'shown', 'onDate',
    ]) {
      expect(justifiesQuotedExpression(expr), `'${expr}' must be justified`).toBe(true);
    }
  });

  it('no exemption outlives the site it excuses', () => {
    const staleInterpolations = QUOTED_INTERPOLATION_EXEMPTIONS
      .filter(e => !quotedInterpolations(e.file).includes(e.expr))
      .map(e => `${e.file}: \${${e.expr}}`);
    expect(staleInterpolations, 'an interpolation exemption outlived its site').toEqual([]);

    const staleLiterals = LITERAL_QUOTE_EXEMPTIONS
      .filter(e => !offenders(quote(`„${e.code}”`), p => codeOnly(SOURCES[p])).includes(e.file))
      .map(e => `${e.file}: „${e.code}”`);
    expect(staleLiterals, 'a literal-quote exemption outlived its site').toEqual([]);
  });
});
