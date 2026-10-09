import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectYtd } from './aggregation';
import { selectProjectionV1 } from './projection';
import { lei, type Bani } from './money';
import type { TaxEstimateResult } from './tax';
import {
  actualEstimateAmounts,
  amountsForEstimate,
  attachEstimateBasis,
  estimateBasisExplanation,
  estimateBasisLabel,
  estimateBasisOf,
  estimateFigureLabel,
  formatElapsedMonths,
  selectTaxEstimateBasis,
  withEstimateBasis,
} from './estimateBasis';

/**
 * Task 1 (pre-Phase-11) — the contract between the projection model and the tax engine.
 *
 * These tests are deliberately about the DATA, not the wording: which operands enter the engine, and
 * whether a consumer can tell actual from projected without parsing a label. The wording tests at the
 * end exist because the brief is explicit that a run-rate figure must not be presented as a certainty.
 */

function identity(): PfaIdentity {
  return {
    nume: 'Test SRL', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com',
    denumire: 'Test SRL', cui: '12345678', formaJuridica: 'SRL', numarRegComert: 'J40/123/2026',
    adresaSocietate: 'Str. Test 1', telefonSocietate: '0700000000', emailSocietate: 'test@example.com',
    contBancar: 'RO49BANK1234', banca: 'Test Bank',
  };
}

function profile(fiscalYear = 2026): PfaProfile {
  return {
    id: 'profile-test', pfaStartYear: 2026, fiscalYear, regime: 'impozit_pe_venit', caen: '6201',
    salaryStatus: 'nu', pensionStatus: 'nu', otherIncome: [], socialInsuranceStatus: 'obligatoriu',
    vatExempt: false, cashFloorLei: lei(0), identity: identity(),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const emptySettings: SettingsState = {
  cotaTva: 0.19,
  company: { denumire: 'Test SRL', cui: '12345678', numarRegComert: 'J40/123/2026', adresa: 'Str. Test 1', caen: [] },
  personal: { nume: 'Test', cnp: '', adresa: 'Str. Test 1', telefon: '0700000000', email: 'test@example.com' },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '' },
};

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    reservedAmount: null,
    profile: profile(), revenues: [], expenses: [], clients: [], declarations: [], documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
    settings: emptySettings, ...overrides,
  };
}

function revenue(date: string, net: Bani, tva: Bani): Revenue {
  return { id: 'rev-' + date + '-' + net, tip: 'factura', nr: '1', date, client: 'Client Test', cui: '12345678',
    valoareFaraTva: net, tva, status: 'inregistrata' };
}

function expense(date: string, net: Bani, tva: Bani): Expense {
  return { id: 'exp-' + date + '-' + net, tip: 'factura', nr: '1', date, furnizor: 'Furnizor Test', cui: '87654321',
    valoareFaraTva: net, tva, status: 'inregistrata' };
}

/**
 * The fixture from projection.test.ts, so the two files read the same numbers.
 * YTD at any date from September 2026: revenue 1.071,00 lei / revenueNet 900,00 lei /
 * expenses 90,00 lei / expenseNet 71,00 lei.
 */
function midYearData(extra: Revenue[] = []): AppData {
  return makeData({
    revenues: [revenue('2026-03-10', lei(300), lei(57)), revenue('2026-06-20', lei(600), lei(114)), ...extra],
    expenses: [expense('2026-04-15', lei(71), lei(19))],
  });
}

describe('selectTaxEstimateBasis — what enters the engine', () => {
  it('records the projected operands AND the actuals they were derived from', () => {
    const data = midYearData();
    // 2026-10-31: 9 full months + 31/31 = 10 elapsed months, so every operand is YTD x 12/10 = x 1,2.
    const basis = selectTaxEstimateBasis(selectProjectionV1(data, '2026-10-31'), selectYtd(data, '2026-10-31'));

    if (basis.kind !== 'annual-projected') throw new Error('expected an annual-projected basis');
    expect(basis.method).toBe('run-rate-v1');
    expect(basis.elapsedMonths).toBe(10);
    expect(basis.projected).toEqual({
      revenues: lei(1285.2), // 1.071,00 x 1,2
      expenses: lei(108), //    90,00 x 1,2
      revenuesNet: lei(1080), //  900,00 x 1,2  <- the operand a non-vatExempt profile actually uses
      expensesNet: lei(85.2), //   71,00 x 1,2
    });
    expect(basis.actual).toEqual({
      revenues: lei(1071), expenses: lei(90), revenuesNet: lei(900), expensesNet: lei(71),
    });
  });

  it('hands over exactly the model output, with no re-derivation of its own', () => {
    const data = midYearData();
    const asOf = '2026-09-15'; // 8,5 elapsed months — a fractional denominator, not a whole month
    const projection = selectProjectionV1(data, asOf);
    const basis = selectTaxEstimateBasis(projection, selectYtd(data, asOf));

    // 900,00 x 12 / 8,5 = 127.058,82 bani -> toBaniNearest -> 127.059; 71,00 x 12 / 8,5 -> 10.024.
    expect(basis.kind).toBe('annual-projected');
    if (basis.kind !== 'annual-projected') return;
    expect(basis.projected.revenuesNet).toBe(projection.annualProjectedExclVat.revenueNet);
    expect(basis.projected.expensesNet).toBe(projection.annualProjectedExclVat.expenseNet);
    expect(basis.projected.revenuesNet).toBe(lei(1270.59));
    expect(basis.projected.expensesNet).toBe(lei(100.24));
  });

  it('at 12 elapsed months the projection is the identity, so the operands are the actuals', () => {
    const data = midYearData();
    const basis = selectTaxEstimateBasis(selectProjectionV1(data, '2026-12-31'), selectYtd(data, '2026-12-31'));
    expect(basis.elapsedMonths).toBe(12);
    expect(amountsForEstimate(basis)).toEqual(actualEstimateAmounts(selectYtd(data, '2026-12-31')));
  });

  it('with no run rate it answers actuals-only, never an annualised zero', () => {
    // asOf before the fiscal year start: the model's own denominator is 0 and every total is 0.
    // Annualising that would print a plausible 0,00 RON ANNUAL estimate. It is refused instead.
    const data = midYearData();
    const asOf = '2025-12-31';
    const ytd = selectYtd(data, asOf);
    const basis = selectTaxEstimateBasis(selectProjectionV1(data, asOf), ytd);

    expect(basis.elapsedMonths).toBe(0);
    if (basis.kind !== 'actuals-only') throw new Error('expected an actuals-only basis');
    expect(basis.method).toBeNull();
    expect(basis.reason).toContain('neannualizate');
    // The operands are the actuals-to-date themselves — the module did not invent a year.
    expect(amountsForEstimate(basis)).toEqual(actualEstimateAmounts(ytd));
  });

  it('amountsForEstimate follows the basis, in both directions', () => {
    const data = midYearData();
    const projected = selectTaxEstimateBasis(selectProjectionV1(data, '2026-10-31'), selectYtd(data, '2026-10-31'));
    expect(amountsForEstimate(projected)).toEqual(projected.kind === 'annual-projected' ? projected.projected : projected.actual);
    expect(amountsForEstimate(projected).revenuesNet).toBe(lei(1080));

    const actuals = selectTaxEstimateBasis(selectProjectionV1(data, '2025-12-31'), selectYtd(data, '2025-12-31'));
    expect(amountsForEstimate(actuals)).toEqual(actuals.actual);
  });

  it('a different asOf changes the operands that enter the engine', () => {
    const data = midYearData();
    const oct = amountsForEstimate(selectTaxEstimateBasis(selectProjectionV1(data, '2026-10-31'), selectYtd(data, '2026-10-31')));
    const sep = amountsForEstimate(selectTaxEstimateBasis(selectProjectionV1(data, '2026-09-15'), selectYtd(data, '2026-09-15')));
    // Same data, same actuals; a shorter year means a higher run rate.
    expect(oct.revenuesNet).toBe(lei(1080));
    expect(sep.revenuesNet).toBe(lei(1270.59));
  });

  it('a different run-rate changes the operands, and the actuals stay the real ones', () => {
    const base = midYearData();
    const more = midYearData([revenue('2026-08-05', lei(100), lei(19))]);
    const asOf = '2026-10-31';
    const a = selectTaxEstimateBasis(selectProjectionV1(base, asOf), selectYtd(base, asOf));
    const b = selectTaxEstimateBasis(selectProjectionV1(more, asOf), selectYtd(more, asOf));
    expect(amountsForEstimate(b).revenuesNet).toBe(lei(1200)); // (900 + 100) x 1,2
    expect(a.actual.revenuesNet).toBe(lei(900));
    expect(b.actual.revenuesNet).toBe(lei(1000));
  });
});

describe('the basis travels with the engine result', () => {
  type Refused = Extract<TaxEstimateResult, { status: 'review_required' }>;
  const bare = { status: 'review_required', reason: 'test', lines: [] } as unknown as Refused;

  it('attachEstimateBasis keeps every existing field readable', () => {
    const basis = selectTaxEstimateBasis(selectProjectionV1(midYearData(), '2026-10-31'), selectYtd(midYearData(), '2026-10-31'));
    const withBasis = attachEstimateBasis(bare, basis);
    if (withBasis.status !== 'review_required') throw new Error('the refusal must survive the intersection');
    expect(withBasis.reason).toBe('test');
    expect(withBasis.basis).toBe(basis);
  });

  it('an unattributed result is labelled unknown, not guessed', () => {
    expect(estimateBasisOf(bare)).toBeNull();
    const normalised = withEstimateBasis(bare);
    expect(normalised.basis.kind).toBe('unknown');
    expect(normalised.basis.elapsedMonths).toBeNull();
    // Already-attributed results are passed through untouched.
    expect(withEstimateBasis(normalised)).toBe(normalised);
  });
});

describe('wording never claims more than a run-rate assumption carries', () => {
  const projected = selectTaxEstimateBasis(selectProjectionV1(midYearData(), '2026-09-15'), selectYtd(midYearData(), '2026-09-15'));
  const actuals = selectTaxEstimateBasis(selectProjectionV1(midYearData(), '2025-12-31'), selectYtd(midYearData(), '2025-12-31'));

  it('formats a fractional month count in Romanian typography', () => {
    expect(formatElapsedMonths(10)).toBe('10');
    expect(formatElapsedMonths(8.5)).toBe('8,5');
    expect(formatElapsedMonths(9.2580645)).toBe('9,3');
  });

  it('says YTD only for actuals', () => {
    expect(estimateFigureLabel(projected)).toBe('Estimare impozit anuală (rată de desfășurare)');
    expect(estimateFigureLabel(actuals)).toBe('Estimare impozit YTD');
    expect(estimateFigureLabel(null)).toBe('Estimare impozit');
    expect(estimateFigureLabel(undefined)).toBe('Estimare impozit');
  });

  it('names the assumption and how many months it rests on', () => {
    expect(estimateBasisLabel(projected)).toBe('Estimare anuală pe rată de desfășurare (8,5 din 12 luni scurse)');
    expect(estimateBasisLabel(actuals)).toBe('Înregistrat până acum (neannualizat)');
    expect(estimateBasisLabel(undefined)).toBe('Estimare impozit');
  });

  it('states that a projected figure is not a forecast of fact', () => {
    const text = estimateBasisExplanation(projected);
    expect(text).toContain('8,5 din 12');
    expect(text).toContain('Nu sunt o previziune a cifrelor reale');
    expect(estimateBasisExplanation(actuals)).toContain('neannualizate');
    expect(estimateBasisExplanation(null)).toContain('nu este înregistrată');
  });
});
