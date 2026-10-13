/**
 * B-102 — the divergence guard.
 *
 * Two surfaces answer the same question, „care este perioada fiscală pe acest an?”, and they must never
 * answer it differently:
 *
 * - `getVatPeriodicity` in `data/dashboard.ts`, which feeds the Form 300 panel and the filing calendar;
 * - `vatFilingPeriodCheck` in `domain/completeness.ts`, which feeds the completeness channel.
 *
 * Before B-102 both called `vatPeriodicityForYear` with the same four arguments, so they could not drift.
 * B-102 gives that call a fifth argument — the alin. (8) premise, which needs the filed returns as well as
 * the facts — and a fifth argument is exactly where two call sites start disagreeing. The case where they
 * would disagree is not hypothetical: in the alin. (8) return year, the surface that threads the filing
 * answers `quarter` and the surface that does not answers `month`, for one profile and one year.
 *
 * So this file is the reason threading the premise into `domain/completeness.ts` is safe rather than a
 * one-time fix. It takes the **same profile and the same year** through **both** surfaces and asserts they
 * say the same thing, for every year of a three-year alin. (8) span. If either call site later drops an
 * argument, this fails.
 *
 * It also pins the second half of the same rule: the sentence naming the period comes from
 * `vatPeriodicityYearSentence`, one producer, so the panel and the check cannot spell the same fact twice
 * — which is how B-103 happened.
 */
import { describe, expect, it } from 'vitest';
import { getVatPeriodicity } from '../data/dashboard';
import type { AppData, SettingsState, VatReturnRecord } from '../data/types';
import type { PfaProfile } from './models';
import { assessCompleteness } from './completeness';
import { vatPeriodicityYearSentence } from './fiscal/vatPeriodicity';
import { lei } from './money';

const BNR = (rateDate: string) => ({
  currency: 'EUR' as const,
  rate: '5.0000',
  rateKind: 'daily_reference' as const,
  rateDate,
  seriesCode: 'CURSZ_EUR' as const,
  sourceUrl: 'https://www.bnr.ro/Cursul-de-schimb--7333.html',
  fetchedAt: '2026-01-02T08:00:00Z',
  provisional: false,
  entryMode: 'fetched' as const,
});

/** The three-year alin. (8) span: a June-2026 acquisition, 2027 as the second monthly year, 2028 as the return year. */
const YEARS = [
  {
    year: 2026,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: lei(10_000),
    precedingYearAicGoods: 'nu' as const,
    aicGoodsWhileQuarterly: 'da' as const,
    aicGoodsExigibilityMonth: 6,
  },
  {
    year: 2027,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: lei(10_000),
    precedingYearAicGoods: 'nu' as const,
  },
  {
    year: 2028,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b' as const,
    precedingYearTurnover: lei(10_000),
    precedingYearAicGoods: 'nu' as const,
  },
];

function data(fiscalYear: number, vatReturns: VatReturnRecord[] = []): AppData {
  const profile: PfaProfile = {
    id: 'profile-alin8',
    pfaStartYear: 2024,
    pfaStartDate: '2024-01-01',
    fiscalYear,
    regime: 'impozit_pe_venit',
    caen: '6201',
    salaryStatus: 'nu',
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'inregistrat_art316', effectiveFrom: '2025-01-01' },
    vatPeriodicityYears: YEARS,
    cashFloorLei: lei(0),
    identity: {
      nume: 'Test Person', cnp: '1234567890123', adresa: 'Adresa Test', telefon: '0700000000',
      email: 'test@example.com', denumire: 'Test PFA', cui: 'RO12345678', formaJuridica: 'SRL',
      numarRegComert: 'J40/123/2024', adresaSocietate: 'Adresa', telefonSocietate: '0700000001',
      emailSocietate: 'firma@example.com', contBancar: 'RO44BANK', banca: 'Test Bank',
    },
    updatedAt: '2028-12-31T10:00:00.000Z',
  };
  return {
    reservedAmount: null,
    profile,
    revenues: [],
    expenses: [],
    clients: [],
    filings: [],
    vatReturns,
    occupancySheets: [],
    vehicles: [],
    fixedAssets: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: {} as SettingsState,
    fxRates: [BNR('2025-12-31'), BNR('2026-12-31'), BNR('2027-12-31')],
  };
}

const filedMentiuni2028: VatReturnRecord = {
  id: 'vr-mentiuni-2028',
  obligationId: 'mentiuni-25-ianuarie-2028',
  year: 2028,
  form: '300',
  periodKind: 'quarter',
  periodIndex: 1,
  status: 'depusa',
  filedOn: '2028-01-10',
};

describe('the Form 300 panel and the completeness channel give one answer per profile-year', () => {
  const completenessDetail = (d: AppData): string => {
    const report = assessCompleteness(d);
    const check = report.checks.find((c) => c.key === 'vatFilingPeriod');
    if (!check) throw new Error('the vatFilingPeriod check disappeared — the guard has nothing to compare');
    return check.detail;
  };

  for (const year of [2026, 2027, 2028]) {
    it(`year ${year}: the completeness sentence is the sentence the panel renders`, () => {
      const d = data(year);
      const outcome = getVatPeriodicity(d);
      expect(outcome.kind === 'derived' || outcome.kind === 'user_confirmed').toBe(true);
      if (!(outcome.kind === 'derived' || outcome.kind === 'user_confirmed')) return;
      // One producer, two surfaces. `toContain` on the exact sentence is the assertion: if the check
      // re-spells its own ternary, or drops the premise and lands on the other periodicity, this fails.
      expect(completenessDetail(d)).toContain(
        `perioada fiscală este ${vatPeriodicityYearSentence(outcome, year)}`,
      );
    });
  }

  it('the return year is the case that would diverge: both surfaces say quarter, and only if both thread the filing', () => {
    // With the alin. (6) declaration on record the derivation returns to the quarter. A completeness
    // channel that did not thread `alin8PremiseForYear` would still see the year's own facts and answer
    // „luna calendaristică” — the same profile, the same year, two answers. That is the drift this guards.
    const d = data(2028, [filedMentiuni2028]);
    const outcome = getVatPeriodicity(d);
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('quarter');
    expect(outcome.kind === 'derived' && outcome.alin8?.returned).toBe(true);
    const detail = completenessDetail(d);
    expect(detail).toContain('perioada fiscală este trimestrul calendaristic');
    expect(detail).not.toContain('perioada fiscală este luna calendaristică');
  });

  it('and with no filing on record both surfaces still say the month', () => {
    // The mirror case. A guard that only tested the divergent direction would not notice a channel that
    // returned to the quarter too early — the wrong fix that looks right.
    const d = data(2028);
    const outcome = getVatPeriodicity(d);
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    expect(completenessDetail(d)).toContain('perioada fiscală este luna calendaristică');
  });

  it('the second monthly year is the month on both surfaces, though its own facts say quarter', () => {
    // The other half of B-102. Asked alone, 2027 is a quarter under alin. (2); as the second year of a
    // 2026 flip it is the month. If either surface stopped reading the previous year, the two would split.
    const d = data(2027);
    const outcome = getVatPeriodicity(d);
    expect(outcome.kind === 'derived' && outcome.branch).toBe('alin8');
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    expect(completenessDetail(d)).toContain('perioada fiscală este luna calendaristică');
  });
});
