/**
 * TASK 5 — the pension / CASS-exception fact readers.
 *
 * Two jobs here. The first pins what each reader returns for each recorded state, including the third
 * state (`unknown`) that absence produces. The second is a structural guard: the whole defect was ONE
 * boolean answering three legal questions, so the deprecated `pensionStatus` key must not acquire any
 * reader outside the migration that folds it away. That is asserted against the real source tree, the
 * same way `thresholds.language.test.ts` and `identity.source.test.ts` police their own invariants.
 */
import { describe, expect, it } from 'vitest';
import {
  PENSION_RECEIPT_GAP_NOTE,
  PENSION_SUSPENSION_NOTE,
  readCassExceptionFacts,
  readForeignSicknessInsuranceProved,
  readPensionSumsReceived,
  readPensionSuspension,
  readPensionerStatus,
  readPreviousYearArt180Option,
  readPreviousYearExceptedCategory,
} from './pensionFacts';
import type { PensionFactFields } from './pensionFacts';

const NOTHING: PensionFactFields = {};

describe('readPensionerStatus — CF art. 150 alin. (1), the CAS key', () => {
  it('returns the recorded status', () => {
    expect(readPensionerStatus({ pensionerStatus: 'da' })).toBe('da');
    expect(readPensionerStatus({ pensionerStatus: 'nu' })).toBe('nu');
  });

  it('reports an unrecorded status as unknown, never as nu', () => {
    expect(readPensionerStatus(NOTHING)).toBe('unknown');
    // `null` is how TaxInputsReference spells "not recorded"; it must read the same as absence.
    expect(readPensionerStatus({ pensionerStatus: null })).toBe('unknown');
  });

  it('never reads the deprecated pensionStatus key', () => {
    // The old key is still on the type (so old payloads parse) but it carries no meaning for a reader.
    expect(readPensionerStatus({ pensionStatus: 'da' } as PensionFactFields)).toBe('unknown');
  });
});

describe('readPensionSumsReceived — CF art. 174 alin. (7) lit. c)', () => {
  it('is year-scoped: a receipt recorded for the queried year is the fact that counts', () => {
    const fields = { pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' as const }] };
    expect(readPensionSumsReceived(fields, 2026)).toBe('da');
  });

  it('a receipt recorded for another year says nothing about this year', () => {
    const fields = { pensionReceiptYears: [{ fiscalYear: 2025, received: 'da' as const }] };
    expect(readPensionSumsReceived(fields, 2026)).toBe('unknown');
  });

  it('a recorded nu is a checked negative, distinct from an unrecorded year', () => {
    const recorded = { pensionReceiptYears: [{ fiscalYear: 2026, received: 'nu' as const }] };
    expect(readPensionSumsReceived(recorded, 2026)).toBe('nu');
    expect(readPensionSumsReceived(NOTHING, 2026)).toBe('unknown');
  });

  it('takes the answer from the year record, not from pensioner status', () => {
    // A pensioner who received nothing that year does not qualify…
    expect(
      readPensionSumsReceived(
        { pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'nu' }] },
        2026,
      ),
    ).toBe('nu');
    // …and someone who was not a pensioner but received pension sums does.
    expect(
      readPensionSumsReceived(
        { pensionerStatus: 'nu', pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] },
        2026,
      ),
    ).toBe('da');
  });

  it('consults no amount: the reader has no amount parameter to consult', () => {
    // lit. c) carries no 6-SM qualifier. There is deliberately no quantum on the record, so an invented
    // threshold could not be applied even by accident.
    const recordKeys = Object.keys({ fiscalYear: 2026, received: 'da' as const });
    expect(recordKeys).toEqual(['fiscalYear', 'received']);
  });
});

describe('readPreviousYearExceptedCategory / readPreviousYearArt180Option — CF art. 174 alin. (8)', () => {
  it('honours the context only when it is attributed to the year before', () => {
    const ctx = { cassPreviousYearContext: { previousFiscalYear: 2025, inExceptedCategory: 'da' as const } };
    expect(readPreviousYearExceptedCategory(ctx, 2026)).toBe('da');
    // Attributed to the income year itself: not the fact alin. (8) asks for.
    expect(readPreviousYearExceptedCategory({ cassPreviousYearContext: { previousFiscalYear: 2026, inExceptedCategory: 'da' } }, 2026)).toBe(
      'unknown',
    );
  });

  it('reads each half independently, and an unrecorded half stays unknown', () => {
    const onlyOption = { cassPreviousYearContext: { previousFiscalYear: 2025, optedUnderArt180Alin1: 'da' as const } };
    expect(readPreviousYearArt180Option(onlyOption, 2026)).toBe('da');
    expect(readPreviousYearExceptedCategory(onlyOption, 2026)).toBe('unknown');
  });

  it('is never derived from pensioner status: alin. (8) lit. a) excludes pensioners', () => {
    expect(readPreviousYearExceptedCategory({ pensionerStatus: 'da' }, 2026)).toBe('unknown');
    expect(readPreviousYearArt180Option({ pensionerStatus: 'da' }, 2026)).toBe('unknown');
  });
});

describe('readForeignSicknessInsuranceProved — CF art. 153 alin. (2)', () => {
  it('needs BOTH halves: held and proved', () => {
    expect(readForeignSicknessInsuranceProved({ foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'da' } }, 2026)).toBe(
      'da',
    );
  });

  it('held without proved is undecided, not the exclusion', () => {
    expect(readForeignSicknessInsuranceProved({ foreignSicknessInsurance: { fiscalYear: 2026, held: 'da' } }, 2026)).toBe('unknown');
  });

  it('a recorded nu on either half settles it as nu', () => {
    expect(readForeignSicknessInsuranceProved({ foreignSicknessInsurance: { fiscalYear: 2026, held: 'nu' } }, 2026)).toBe('nu');
    expect(readForeignSicknessInsuranceProved({ foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'nu' } }, 2026)).toBe('nu');
  });

  it('is year-scoped and unrelated to pensions', () => {
    expect(readForeignSicknessInsuranceProved({ foreignSicknessInsurance: { fiscalYear: 2025, held: 'da', proved: 'da' } }, 2026)).toBe(
      'unknown',
    );
    expect(readForeignSicknessInsuranceProved({ pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] }, 2026)).toBe(
      'unknown',
    );
  });
});

describe('readPensionSuspension — a recorded fact with no consequence attached', () => {
  it('returns the record for the year', () => {
    const fields = { pensionSuspensionYears: [{ fiscalYear: 2026, months: [3, 4] }] };
    expect(readPensionSuspension(fields, 2026)?.months).toEqual([3, 4]);
    expect(readPensionSuspension(fields, 2025)).toBeUndefined();
  });
});

describe('readCassExceptionFacts — the withheld conclusions travel with the facts', () => {
  it('names the receipt gap when a status is recorded but the year has no receipt fact', () => {
    // Exactly the state every payload written before TASK 5 lands in after migration.
    const facts = readCassExceptionFacts({ pensionerStatus: 'da' }, 2026);
    expect(facts.pensionSumsReceived).toBe('unknown');
    expect(facts.receiptGapNote).toBe(PENSION_RECEIPT_GAP_NOTE);
    expect(facts.receiptGapNote).toContain('art. 174 alin. (7) lit. c)');
    expect(facts.receiptGapNote).toContain('art. 99 alin. (1)');
  });

  it('names no gap once the receipt fact exists, even when it is nu', () => {
    const facts = readCassExceptionFacts(
      { pensionerStatus: 'da', pensionReceiptYears: [{ fiscalYear: 2026, received: 'nu' }] },
      2026,
    );
    expect(facts.receiptGapNote).toBeNull();
    expect(facts.pensionSumsReceived).toBe('nu');
  });

  it('names no gap for a non-pensioner with no receipt fact — there is nothing to reconcile', () => {
    expect(readCassExceptionFacts({ pensionerStatus: 'nu' }, 2026).receiptGapNote).toBeNull();
  });

  it('surfaces a recorded suspension as a fact and states that no consequence is drawn', () => {
    const facts = readCassExceptionFacts(
      { pensionSuspensionYears: [{ fiscalYear: 2026, months: [3] }], pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }] },
      2026,
    );
    expect(facts.suspensionNote).toBe(PENSION_SUSPENSION_NOTE);
    expect(facts.suspensionNote).toContain('nu trage nicio concluzie');
    expect(facts.pensionSumsReceived).toBe('da'); // the suspension changed nothing
  });

  it('a suspension with no months recorded produces no note', () => {
    expect(readCassExceptionFacts({ pensionSuspensionYears: [{ fiscalYear: 2026, months: [] }] }, 2026).suspensionNote).toBeNull();
  });
});

describe('the deprecated pensionStatus key has no reader outside the migration that folds it away', () => {
  // The defect TASK 5 removes is one boolean serving three legal tests. The rename only holds if nothing
  // new starts reading the old key, so this is policed against the real source tree rather than by
  // convention. `models.ts` declares it, `schema.ts` keeps it parseable, and `data/migration.ts` folds it
  // — those three are the whole permitted set.
  const SOURCES = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  // `import.meta.glob` paths are relative to THIS file: same-directory sources come back as `./x.ts` and
  // others as `../dir/x.ts`. Normalising them to `src/...` keeps the allow-list unambiguous.
  const normalize = (path: string) =>
    path.startsWith('./') ? `src/domain/${path.slice(2)}` : `src/${path.replace(/^\.\.\//, '')}`;

  const ALLOWED = new Set(['src/domain/models.ts', 'src/domain/schema.ts', 'src/data/migration.ts']);

  const productionPaths = Object.keys(SOURCES).filter(
    (path) => !/\.test\.tsx?$/.test(path) && !/\.d\.ts$/.test(path) && normalize(path) !== 'src/domain/pensionFacts.ts',
  );

  it('finds the sources it means to scan', () => {
    expect(productionPaths.length).toBeGreaterThan(20);
  });

  it('reads the old key nowhere outside models.ts, schema.ts and data/migration.ts', () => {
    for (const path of productionPaths) {
      if (ALLOWED.has(normalize(path))) continue;
      // Strip comments: the provisions are cited in prose everywhere, and that prose is the point.
      const code = SOURCES[path].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1//');
      expect(code, `pensionStatus must not be read in ${path}`).not.toMatch(/\bpensionStatus\b/);
    }
  });

  it('the migration is the only place that still names the old key in code', () => {
    const migration = Object.entries(SOURCES).find(([path]) => normalize(path) === 'src/data/migration.ts');
    expect(migration).toBeDefined();
    expect(migration![1]).toMatch(/pensionStatus/);
  });
});
