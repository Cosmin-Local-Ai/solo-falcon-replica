/**
 * PG-4 (B-71) — the weighted-coverage denominator must use the money date, like the estimate does.
 *
 * PG-1 made completeness a share of recorded AMOUNT, and it filtered expenses by
 * `expenseFiscalDate(e)` but revenues by the bare `r.date`. Once PG-2 made `collected` writable that
 * became a live contradiction: a revenue documented 20 Dec 2026 and collected 10 Jan 2027 is correctly
 * absent from the 2026 estimate, yet it still sat in the 2026 denominator — so the percentage and the
 * figure disagreed about one and the same record, which is the class of defect PG-1 was built to close.
 *
 * The numbers below are stated in bani so the disagreement is visible as an amount, not as a rounding
 * argument.
 */
import { describe, expect, it } from 'vitest';
import { assessCompleteness } from './completeness';
import { getTaxEstimate } from '../data/dashboard';
import { seedData } from '../data/seed';
import type { AppData, Revenue } from '../data/types';
import { lei, ron } from './money';

const AS_OF = '2026-12-31';

function collectedIn2027(over: Partial<Revenue> = {}): Revenue {
  return {
    id: 'rev-cross-year',
    tip: 'factura',
    nr: 'FCT-B71-1',
    date: '2026-12-20',
    client: 'Client B71 SRL',
    cui: 'RO00000000',
    valoareFaraTva: ron(5_000),
    tva: ron(0),
    status: 'inregistrata',
    collected: '2027-01-10',
    ...over,
  };
}

function dataWith(revenues: Revenue[]): AppData {
  return { ...seedData, revenues: [...seedData.revenues, ...revenues] };
}

describe('the coverage denominator follows the money date (B-71)', () => {
  it('a revenue collected in 2027 is not part of the 2026 denominator', () => {
    const base = assessCompleteness(dataWith([]), [], AS_OF).coverage;
    const withCrossYear = assessCompleteness(dataWith([collectedIn2027()]), [], AS_OF).coverage;

    // The record is in the register and out of the fiscal year the view describes: the denominator
    // counts what the estimate could have consumed, and it could not have consumed this.
    expect(withCrossYear.recordedBani).toBe(base.recordedBani);
    expect(withCrossYear.recordedBani).not.toBe(base.recordedBani + lei(5_000));
  });

  it('the same revenue with no money date IS in the 2026 denominator', () => {
    // The control. Without `collected` the document date is the fiscal date — the Phase 9 fallback —
    // and the record belongs to 2026. If this assertion moved with the one above, the fix would be a
    // blanket exclusion rather than the right one.
    const base = assessCompleteness(dataWith([]), [], AS_OF).coverage;
    const withDocumentDate = assessCompleteness(
      dataWith([collectedIn2027({ collected: undefined })]),
      [],
      AS_OF,
    ).coverage;
    expect(withDocumentDate.recordedBani).toBe(base.recordedBani + lei(5_000));
  });

  it('the percentage and the estimate agree about the same record', async () => {
    const seedOnly = await getTaxEstimate(seedData, AS_OF);
    const crossYear = await getTaxEstimate(dataWith([collectedIn2027()]), AS_OF);
    const documentDate = await getTaxEstimate(dataWith([collectedIn2027({ collected: undefined })]), AS_OF);
    if (seedOnly.status !== 'computed' || crossYear.status !== 'computed' || documentDate.status !== 'computed') {
      throw new Error('expected all three estimates to compute');
    }

    // The engine's gross base is unchanged by a record whose money date is in 2027, and rises when the
    // same record has no money date. The coverage denominator does the same two things, in the same
    // direction — one record, one fiscal date, one answer.
    expect(crossYear.bases.venitulBrut).toBe(seedOnly.bases.venitulBrut);
    expect(documentDate.bases.venitulBrut).toBeGreaterThan(seedOnly.bases.venitulBrut);

    const crossCoverage = assessCompleteness(dataWith([collectedIn2027()]), [], AS_OF).coverage;
    const documentCoverage = assessCompleteness(
      dataWith([collectedIn2027({ collected: undefined })]),
      [],
      AS_OF,
    ).coverage;
    expect(crossCoverage.recordedBani).toBe(assessCompleteness(seedData, [], AS_OF).coverage.recordedBani);
    expect(documentCoverage.recordedBani).toBe(crossCoverage.recordedBani + lei(5_000));
  });

  it('an expense paid in 2027 is already handled the same way (the half PG-1 got right)', () => {
    const base = assessCompleteness(dataWith([]), [], AS_OF).coverage;
    const data: AppData = {
      ...seedData,
      expenses: [
        ...seedData.expenses,
        {
          id: 'exp-cross-year',
          tip: 'factura',
          nr: 'CH-B71-1',
          date: '2026-12-20',
          furnizor: 'Furnizor B71 SRL',
          cui: 'RO00000000',
          valoareFaraTva: ron(5_000),
          tva: ron(0),
          status: 'inregistrata',
          paid: '2027-01-10',
        },
      ],
    };
    expect(assessCompleteness(data, [], AS_OF).coverage.recordedBani).toBe(base.recordedBani);
  });
});
