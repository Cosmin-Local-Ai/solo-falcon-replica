import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { selectYtd } from './aggregation';
import { selectProjectionV1 } from './projection';
import { lei, money, ron, type Bani } from './money';
import type { TaxEstimateResult } from './tax';
import {
  actualEstimateAmounts,
  amountsForEstimate,
  attachEstimateBasis,
  estimateBasisExplanation,
  estimateBasisLabel,
  estimateBasisOf,
  estimateFigureLabel,
  estimateForecastExplanation,
  estimateForecastLabel,
  formatElapsedMonths,
  selectTaxEstimateBasis,
  withEstimateBasis,
  type EstimateAmounts,
  type TaxEstimateBasis,
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
    salaryStatus: 'nu', pensionerStatus: 'nu', cassLadderYears: [], socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'inregistrat_art316' as const }, cashFloorLei: lei(0), identity: identity(),
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
    profile: profile(), revenues: [], expenses: [], clients: [], filings: [], vatReturns: [], documents: [],
    occupancySheets: [],
    vehicles: [],
    // PG-6e (B-31, D-FA-1): an empty register — no asset has been declared. Required on the
    // loaded object, resolved from an absent key by the load path, never defaulted by a step.
    fixedAssets: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
    settings: emptySettings, ...overrides,
  };
}

function revenue(date: string, net: Bani, tva: Bani): Revenue {
  return { id: 'rev-' + date + '-' + net, tip: 'factura', nr: '1', date, client: 'Client Test', cui: '12345678',
    valoareFaraTva: money(net, 'RON'), tva: money(tva, 'RON'), status: 'inregistrata' };
}

function expense(date: string, net: Bani, tva: Bani): Expense {
  return { id: 'exp-' + date + '-' + net, tip: 'factura', nr: '1', date, furnizor: 'Furnizor Test', cui: '87654321',
    valoareFaraTva: money(net, 'RON'), tva: money(tva, 'RON'), status: 'inregistrata' };
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

describe('selectTaxEstimateBasis — what enters the engine (PG-5C)', () => {
  it('feeds the engine the recorded actuals and keeps the run rate beside them', () => {
    const data = midYearData();
    // 2026-10-31: 10 elapsed months of a 12-month active period, so the model would gross these up by
    // 1,2. PG-5C removed that step between the model and the engine: the operands are the register.
    const basis = selectTaxEstimateBasis(
      selectProjectionV1(data, '2026-10-31'), selectYtd(data, '2026-10-31'), '2026-10-31',
    );

    if (basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(basis.method).toBeNull();
    expect(basis.asOfDate).toBe('2026-10-31');
    expect(basis.closed).toBe(false);
    expect(basis.actual).toEqual({
      revenues: lei(1071), expenses: lei(90), revenuesNet: lei(900), expensesNet: lei(71),
      asOfDate: '2026-10-31',
    });
    // The forecast is still produced, because it is a legitimate planning figure and D-PROJ-1 protects
    // it. What it is not is an operand: `amountsForEstimate` returns the actuals beside it.
    expect(basis.forecast?.method).toBe('run-rate-v1');
    expect(basis.forecast?.amounts).toEqual({
      revenues: lei(1285.2), // 1.071,00 x 1,2
      expenses: lei(108),    //    90,00 x 1,2
      revenuesNet: lei(1080),//  900,00 x 1,2
      expensesNet: lei(85.2),//   71,00 x 1,2
      net: lei(1177.2),
    });
    expect(amountsForEstimate(basis)).toEqual(basis.actual);
  });

  it('hands the forecast over as the model output, with no re-derivation of its own', () => {
    const data = midYearData();
    const asOf = '2026-09-15'; // 8,5 elapsed months — a fractional denominator, not a whole month
    const projection = selectProjectionV1(data, asOf);
    const basis = selectTaxEstimateBasis(projection, selectYtd(data, asOf), asOf);

    // 900,00 x 12 / 8,5 = 127.058,82 bani -> toBaniNearest -> 127.059; 71,00 x 12 / 8,5 -> 10.024.
    if (basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(basis.forecast?.amounts.revenuesNet).toBe(projection.annualProjectedExclVat.revenueNet);
    expect(basis.forecast?.amounts.expensesNet).toBe(projection.annualProjectedExclVat.expenseNet);
    expect(basis.forecast?.amounts.revenuesNet).toBe(lei(1270.59));
    expect(basis.forecast?.amounts.expensesNet).toBe(lei(100.24));
    // …and none of those four numbers reaches the engine.
    expect(amountsForEstimate(basis).revenuesNet).toBe(lei(900));
  });

  it('at the end of the active period there is no forecast, because the projection is the actuals', () => {
    const data = midYearData();
    const basis = selectTaxEstimateBasis(
      selectProjectionV1(data, '2026-12-31'), selectYtd(data, '2026-12-31'), '2026-12-31',
    );
    // Showing "forecast 900,00" next to "actual 900,00" would present one number twice under two
    // labels, so the model's own horizon test is what removes the forecast here.
    expect(basis.forecast).toBeUndefined();
    expect(amountsForEstimate(basis)).toEqual(actualEstimateAmounts(selectYtd(data, '2026-12-31'), '2026-12-31'));
  });

  it('with no run rate it still answers with the actuals, never with an annualised zero', () => {
    // asOf before the fiscal year start: the model's own denominator is 0 and every total is 0.
    // Annualising that would print a plausible 0,00 RON ANNUAL estimate. PG-5C never annualises at all,
    // so the case that used to need its own basis kind needs no special handling any more.
    const data = midYearData();
    const asOf = '2025-12-31';
    const ytd = selectYtd(data, asOf);
    const basis = selectTaxEstimateBasis(selectProjectionV1(data, asOf), ytd, asOf);

    if (basis.kind !== 'recorded-actuals') throw new Error('expected a recorded-actuals basis');
    expect(basis.forecast).toBeUndefined();
    expect(amountsForEstimate(basis)).toEqual(actualEstimateAmounts(ytd, asOf));
  });

  it('the operands do not move with the calendar — only the forecast does', () => {
    // This is the defect. Before PG-5C these two reads of the SAME register produced different engine
    // inputs (lei(1080) on 31 Oct, lei(1270.59) on 15 Sep), because a shorter elapsed period meant a
    // higher run rate and the run rate was the legal figure. A taxpayer's FY2026 income cannot depend
    // on the date the app was opened.
    const data = midYearData();
    const oct = amountsForEstimate(selectTaxEstimateBasis(
      selectProjectionV1(data, '2026-10-31'), selectYtd(data, '2026-10-31'), '2026-10-31'));
    const sep = amountsForEstimate(selectTaxEstimateBasis(
      selectProjectionV1(data, '2026-09-15'), selectYtd(data, '2026-09-15'), '2026-09-15'));
    expect(oct.revenuesNet).toBe(lei(900));
    expect(sep.revenuesNet).toBe(lei(900));
  });

  it('a different record changes the operands; a different as-of date does not', () => {
    const base = midYearData();
    const more = midYearData([revenue('2026-08-05', lei(100), lei(19))]);
    const asOf = '2026-10-31';
    const a = selectTaxEstimateBasis(selectProjectionV1(base, asOf), selectYtd(base, asOf), asOf);
    const b = selectTaxEstimateBasis(selectProjectionV1(more, asOf), selectYtd(more, asOf), asOf);
    // Money the taxpayer actually collected changes the figure. That is the only thing that may.
    expect(amountsForEstimate(b).revenuesNet).toBe(lei(1000));
    expect(a.actual.revenuesNet).toBe(lei(900));
    expect(b.actual.revenuesNet).toBe(lei(1000));
  });
});

describe('PG-5C — the engine cannot be handed a projected operand', () => {
  it('a forecast amount is not assignable to an engine operand', () => {
    // The guarantee is structural, not behavioural. `EstimateAmounts` carries the date it was measured
    // as of; a run-rate projection has no measurement date, because nothing was measured. So the
    // assignment below is a compile error, and `@ts-expect-error` fails this test if the guard ever
    // stops working — which is the point: the assertion is not "we happen not to do this".
    const basis = selectTaxEstimateBasis(
      selectProjectionV1(midYearData(), '2026-10-31'), selectYtd(midYearData(), '2026-10-31'), '2026-10-31',
    );
    if (basis.kind !== 'recorded-actuals' || basis.forecast === undefined) {
      throw new Error('expected a basis carrying a forecast');
    }
    // @ts-expect-error ForecastAmounts lacks `asOfDate`, so it is not an EstimateAmounts.
    const operand: EstimateAmounts = basis.forecast.amounts;
    expect(operand).toBeDefined();
  });

  it('amountsForEstimate has no branch to choose a forecast with', () => {
    // Read off the source, not off behaviour: the function that used to read
    // `basis.kind === 'annual-projected' ? basis.projected : basis.actual` must not grow one back.
    const src = amountsForEstimate.toString();
    expect(src).not.toContain('forecast');
    expect(src).not.toContain('projected');
    expect(src).toContain('basis.actual');
  });
});

describe('the basis travels with the engine result', () => {
  type Refused = Extract<TaxEstimateResult, { status: 'review_required' }>;
  const bare = { status: 'review_required', reason: 'test', lines: [] } as unknown as Refused;

  it('attachEstimateBasis keeps every existing field readable', () => {
    const basis = selectTaxEstimateBasis(
      selectProjectionV1(midYearData(), '2026-10-31'), selectYtd(midYearData(), '2026-10-31'), '2026-10-31');
    const withBasis = attachEstimateBasis(bare, basis);
    if (withBasis.status !== 'review_required') throw new Error('the refusal must survive the intersection');
    expect(withBasis.reason).toBe('test');
    expect(withBasis.basis).toBe(basis);
  });

  it('an unattributed result is labelled unknown, not guessed', () => {
    expect(estimateBasisOf(bare)).toBeNull();
    const normalised = withEstimateBasis(bare);
    const unknownBasis = normalised.basis as Extract<TaxEstimateBasis, { kind: 'unknown' }>;
    expect(unknownBasis.kind).toBe('unknown');
    expect(unknownBasis.elapsedMonths).toBeNull();
    // Already-attributed results are passed through untouched.
    expect(withEstimateBasis(normalised)).toBe(normalised);
  });
});

describe('wording never claims more than the register carries (PG-5C)', () => {
  const open = selectTaxEstimateBasis(
    selectProjectionV1(midYearData(), '2026-09-15'), selectYtd(midYearData(), '2026-09-15'), '2026-09-15');
  const closed = selectTaxEstimateBasis(
    selectProjectionV1(midYearData(), '2027-06-30'), selectYtd(midYearData(), '2027-06-30'), '2027-06-30');
  const openForecast = open.kind === 'recorded-actuals' ? open.forecast : undefined;

  it('formats a fractional month count in Romanian typography', () => {
    expect(formatElapsedMonths(10)).toBe('10');
    expect(formatElapsedMonths(8.5)).toBe('8,5');
    expect(formatElapsedMonths(9.2580645)).toBe('9,3');
  });

  it('names the figure as realised money, never as an annualised rate', () => {
    expect(estimateFigureLabel(open)).toBe('Impozit calculat din încasări și plăți înregistrate');
    expect(estimateFigureLabel(closed)).toBe('Impozit final pe înregistrările anului');
    expect(estimateFigureLabel(null)).toBe('Estimare impozit');
    expect(estimateFigureLabel(undefined)).toBe('Estimare impozit');
  });

  it('the fiscal label says nothing about months, because the figure says nothing about months', () => {
    // B-72 re-premised rather than deleted. PG-4 fixed that defect by making the sentence name the
    // active period; PG-5C removes the sentence from the fiscal figure altogether, because the figure
    // is now a register read at a date and no arithmetic over months produced it. The months wording
    // survives where the months ARE the arithmetic — on the forecast, below.
    expect(estimateBasisLabel(open)).toBe('Calculat din încasări și plăți înregistrate');
    expect(estimateBasisLabel(closed)).toBe('Calcul final pe înregistrările anului');
    expect(estimateBasisLabel(undefined)).toBe('Estimare impozit');
    expect(estimateBasisLabel(open)).not.toContain('luni');
    expect(estimateBasisLabel(open)).not.toContain('12');
  });

  it('the explanation names the date the register was read at and the article that makes it annual', () => {
    const text = estimateBasisExplanation(open);
    expect(text).toContain('2026-09-15');
    expect(text).toContain('art. 118 alin. (3)');
    // The pre-2024 numbering of the same sentence is a live trap in this area; it must not appear.
    expect(text).not.toContain('art. 118 alin. (2)');
    expect(estimateBasisExplanation(closed)).toContain('s-a încheiat');
    expect(estimateBasisExplanation(null)).toContain('nu este înregistrată');
  });

  it('the forecast keeps the months wording, and labels itself as not a fiscal figure', () => {
    expect(estimateForecastLabel(openForecast)).toBe('Previziune pe rată de desfășurare (8,5 din 12 luni de activitate)');
    const text = estimateForecastExplanation(openForecast);
    expect(text).toContain('8,5 din 12');
    expect(text).toContain('nu o cifră fiscală');
    expect(text).toContain('Nu alimentează calculul');
    // No forecast, no label: a surface that has nothing to show must not grow a caption for it.
    expect(estimateForecastLabel(undefined)).toBe('');
    expect(estimateForecastExplanation(undefined)).toBe('');
  });

  it('B-72: for a mid-year starter the forecast names the active period, not twelve calendar months', () => {
    // The profile starts 1 Jul 2026. At 15 Sep 2026 the run rate is measured over 2,5 months and the
    // forecast multiplies it by a 6-month active period. The old wording said „din 12 luni scurse” for
    // those same numbers, which described a window the figure was never computed over.
    const data = makeData({
      profile: { ...profile(), pfaStartDate: '2026-07-01' },
      revenues: [revenue('2026-07-10', lei(300), lei(57))],
    });
    const basis = selectTaxEstimateBasis(
      selectProjectionV1(data, '2026-09-15'), selectYtd(data, '2026-09-15'), '2026-09-15');
    const forecast = basis.kind === 'recorded-actuals' ? basis.forecast : undefined;
    expect(estimateForecastLabel(forecast)).toBe('Previziune pe rată de desfășurare (2,5 din 6 luni de activitate)');
    // And the sentence never says „12” for a profile whose active period is shorter than that.
    expect(estimateForecastLabel(forecast)).not.toContain('12');
    expect(estimateForecastExplanation(forecast)).toContain('2,5 din 6');
    // The fiscal figure beside it names no window at all — it is what was collected.
    expect(estimateBasisLabel(basis)).not.toContain('6');
  });
});
