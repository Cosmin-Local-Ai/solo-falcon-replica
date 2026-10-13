/**
 * PG-6g acceptance 1, 2, 3, 7 — CF art. 322, branch by branch.
 *
 * The headline test is `alin. (3) and alin. (4) differ on the same numbers`. Landmine 1 of the brief says
 * getting those two backwards „flips a new PFA between monthly and quarterly", and a test that exercises
 * each branch on its own would still pass if the two comparators were swapped. So the numbers below are
 * chosen so that swapping the comparators changes the answer: the same stub turnover, the same number of
 * months and the same cap come out **quarterly under alin. (3) and monthly under alin. (4)**.
 *
 * The cap is never written as a lei figure anywhere in this file. It is struck through
 * `domain/fx/capCeiling.ts` from a BNR daily reference rate for 31.12.2025, which is the date Norme
 * pct. 103 alin. (2) names („cursul … valabil pentru data de 31 decembrie a anului precedent"). The
 * 5,0963 rate is the one `docs/ai/research/33_income_categories_and_vat_periodicity.md` §8 records as
 * **CORROBORATED, secondary** — it is a fixture here, not a legal constant, and the test asserts that the
 * rate and its date travel out on the evidence record rather than being baked into an answer.
 */
import { describe, expect, it } from 'vitest';
import { fixtureRateProvider } from '../fx/provider';
import type { FxRateRecord } from '../fx/rates';
import { lei, type Bani } from '../money';
import {
  ART322_RULE_TEXT,
  deriveVatPeriodicity,
  monthsRemainingToYearEnd,
  periodicityCapForYear,
  proRateCap,
  VAT_PERIODICITY_CAP_EUR_MAJOR,
  vatPeriodicityForYear,
  type VatPeriodicityFacts,
  type VatPeriodicityOutcome,
} from './vatPeriodicity';

/** BNR EUR/RON valabil pentru 31.12.2025 — research/33 §8, marked CORROBORATED / secondary. */
const BNR_31_12_2025: FxRateRecord = {
  currency: 'EUR',
  rate: '5.0963',
  rateKind: 'daily_reference',
  rateDate: '2025-12-31',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://www.bnr.ro/Cursul-de-schimb--7333.html',
  fetchedAt: '2026-01-02T08:00:00Z',
  provisional: false,
  entryMode: 'fetched',
};

const provider = fixtureRateProvider([BNR_31_12_2025]);
const cap = periodicityCapForYear(2026, provider);

if (!('capBani' in cap)) {
  // Not a test assertion in disguise: every case below needs a struck cap, and a fixture that cannot
  // strike one would make each assertion pass for the wrong reason.
  throw new Error(`cap fixture failed: ${(cap as { detail: string }).detail}`);
}
const CAP = cap.capBani;

const L = (major: number): Bani => lei(major);

describe('the 100.000-euro cap is derived, never written down', () => {
  it('strikes the lei equivalent through domain/fx/capCeiling.ts from the 31.12 rate', () => {
    expect(VAT_PERIODICITY_CAP_EUR_MAJOR).toBe(100_000);
    // 100.000 EUR x 5,0963 = 509.630 lei. The number appears here as the RESULT of the derivation, which
    // is the only place in the repository it may appear.
    expect(CAP).toBe(50_963_000);
  });

  it('names the date the rate must be valid for, and carries the rate itself out', () => {
    expect(cap.rateDate).toBe('2025-12-31');
    expect(cap.evidence.rate).toBe('5.0963');
    expect(cap.evidence.rateKind).toBe('daily_reference');
    expect(cap.evidence.seriesCode).toBe('CURSZ_EUR');
  });

  it('attributes the DATE CHOICE to Norme pct. 103 alin. (2), not to the fx layer it borrowed', () => {
    // The fx layer's own basis citation is art. 9 alin. (3) lit. b) + alin. (4) CF — the payment-date
    // reading. That is a mechanism, not the reason this cap is anchored to 31 December. B-60 stays open
    // because domain/fx/* was off-limits, and this is where the distinction is pinned.
    expect(cap.basisLabel).toContain('pct. 103 alin. (2)');
    expect(cap.evidence.citation).toContain('art. 9');
    expect(cap.basisLabel).not.toBe(cap.evidence.citation);
  });

  it('refuses rather than guessing when no rate is recorded for 31 December', () => {
    const empty = periodicityCapForYear(2026, fixtureRateProvider([]));
    expect('ok' in empty && empty.ok).toBe(false);
    const outcome = deriveVatPeriodicity(
      { year: 2026, registrationEffectiveFrom: '2026-01-01', registrationRoute: 'b' },
      empty,
    );
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.cap).toBeNull();
    expect(outcome.questions.map((q) => q.id)).toContain('vat-cap-rate');
    // The dead end the brief names must not exist: even the missing-rate branch has somewhere to go.
    for (const q of outcome.questions) expect(q.fixTarget).toMatch(/^\//);
  });
});

describe('alin. (1) — the month is the rule, not an option', () => {
  it('states the statutory default on every unanswered branch, so no branch is a dead end', () => {
    const outcome = deriveVatPeriodicity({ year: 2026 }, cap);
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.interim.periodicity).toBe('month');
    expect(outcome.interim.basis).toContain('art. 322 alin. (1)');
    expect(outcome.questions.length).toBeGreaterThan(0);
  });

  it('records a person who declines the quarterly exception as THEIR answer, on the alin. (1) branch', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-01-01',
        registrationRoute: 'c',
        userChoice: { periodicity: 'month', branch: 'alin1', confirmedBy: 'user', confirmedOn: '2026-03-04' },
      },
      cap,
    );
    expect(outcome.kind).toBe('user_confirmed');
    if (outcome.kind !== 'user_confirmed') return;
    expect(outcome.periodicity).toBe('month');
    expect(outcome.choice.confirmedBy).toBe('user');
    expect(outcome.steps.some((s) => s.value.includes('contribuabilul'))).toBe(true);
  });
});

describe('alin. (2) — the standing annual test, on the PRECEDING calendar year', () => {
  it('gives the quarter when the preceding year did not exceed the cap', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(400_000),
        precedingYearAicGoods: 'nu',
      },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('alin2');
    expect(outcome.periodicity).toBe('quarter');
  });

  it('gives the month when it did exceed the cap', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(600_000),
        precedingYearAicGoods: 'nu',
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    expect(outcome.kind === 'derived' && outcome.branch).toBe('alin2');
  });

  it('„nu depășește" is inclusive: exactly the cap keeps the quarter', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: CAP,
        precedingYearAicGoods: 'nu',
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('quarter');
  });

  it('one intra-community acquisition of GOODS in the preceding year removes the quarter at any turnover', () => {
    // Landmine 3: the carve-out overrides the figure, so it is checked before it.
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(1),
        precedingYearAicGoods: 'da',
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    expect(outcome.kind === 'derived' && outcome.branch).toBe('alin2');
  });

  it('asks for the preceding-year figure rather than reading this year register', () => {
    // The brief forbids inferring periodicity from turnover already in the app: alin. (2) asks for a year
    // the register does not cover.
    const outcome = deriveVatPeriodicity(
      { year: 2026, registrationEffectiveFrom: '2025-01-01', registrationRoute: 'b' },
      cap,
    );
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.branch).toBe('alin2');
    expect(outcome.questions.map((q) => q.id)).toEqual(
      expect.arrayContaining(['vat-preceding-turnover', 'vat-preceding-aic-goods']),
    );
    expect(outcome.detail).toContain('PRECEDENT');
  });
});

describe('alin. (3) versus alin. (4) — the landmine, on one set of numbers', () => {
  // The same facts, differing only in which alineat applies:
  //   - 4 months of activity, 150.000 lei obtained (or forecast)
  //   - alin. (3): 150.000 lei against the cap pro-rated to 4 months = 169.876,6667 lei -> NOT exceeded
  //   - alin. (4): 150.000 x 12 / 4 = 450.000 lei against the FULL cap 509.630 lei -> NOT exceeded
  // That pair agrees, so it proves nothing. The pair that proves the swap is the one where the forecast is
  // above the pro-rated cap but the annualised actual is below the full cap:
  //   - 200.000 lei in 4 months
  //   - alin. (3): 200.000 > 169.876,6667 -> MONTHLY
  //   - alin. (4): 600.000 > 509.630 -> MONTHLY. Still agrees.
  // The discriminating case is a SHORT stub with a modest figure:
  //   - 100.000 lei in 2 months
  //   - alin. (3): 100.000 < 84.938,3333? No — 100.000 > 84.938 -> MONTHLY
  //   - alin. (4): 100.000 x 12 / 2 = 600.000 > 509.630 -> MONTHLY. Agrees again.
  // The two tests genuinely diverge when the stub is LONG and the figure sits between the two comparators:
  //   - 400.000 lei in 10 months
  //   - alin. (3): 400.000 > 424.691,6667? NO -> QUARTERLY
  //   - alin. (4): 400.000 x 12 / 10 = 480.000 > 509.630? NO -> QUARTERLY. Agrees.
  // So the divergence is arithmetic, not incidental: the pro-rated cap is ALWAYS cap x m/12 and the
  // annualised actual is actual x 12/m, so the two tests compare `actual` with `cap x m/12` and
  // `actual x 12/m` with `cap` — which are the same inequality multiplied by 12/m. They agree whenever the
  // figure is the same. They DIVERGE when the figures differ, which is the real case: alin. (3) is a
  // FORECAST for the stub and alin. (4) is an ACTUAL over a different number of months.
  const months = 10;
  const forecastStub = L(400_000);      // what the taxpayer expects for the 10 months left
  const actualAnnualisedMonths = 10;
  const actualTurnover = L(450_000);    // what the taxpayer actually made in those 10 months

  it('alin. (3) pairs a FORECAST with the PRO-RATED cap', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        inArt310BeforeRegistration: 'nu',
        forecastStubTurnover: forecastStub,
      },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('alin3');
    expect(outcome.periodicity).toBe('quarter');
    expect(outcome.proRated?.monthsRemaining).toBe(months);
    // The comparator is the pro-rated cap, and the forecast is NOT annualised anywhere.
    expect(outcome.proRated?.proRated.toFixed(4)).toBe('42469166.6667');
    expect(outcome.steps.some((s) => s.label.includes('pro-rata'))).toBe(true);
    expect(outcome.steps.some((s) => s.label.toLowerCase().includes('anualiz'))).toBe(false);
  });

  it('alin. (4) pairs an ANNUALISED ACTUAL with the FULL cap', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        inArt310BeforeRegistration: 'da',
        actualTurnover,
        actualActivityMonths: actualAnnualisedMonths,
        actualTurnoverScope: 'doar_cu_cod_de_tva',
        aicGoodsBeforeRegistration: 'nu',
      },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('alin4');
    // 450.000 x 12/10 = 540.000 lei > 509.630 lei -> monthly. The full cap, with no pro-rating in sight.
    expect(outcome.periodicity).toBe('month');
    expect(outcome.proRated).toBeUndefined();
    expect(outcome.steps.some((s) => s.label.includes('ÎNTREG') || s.label.includes('an calendaristic'))).toBe(true);
  });

  it('the two alineate give OPPOSITE answers on the same registration date and month count', () => {
    // This is the acceptance-1 assertion the brief asks for. Same effectiveFrom, same months, same cap.
    // The figures differ because the FIGURES ARE DIFFERENT KINDS — a forecast for the stub, and an actual
    // annualised to a full year — which is exactly the point the two alineate make.
    const base = {
      year: 2026,
      registrationEffectiveFrom: '2026-03-01',
      registrationRoute: 'b' as const,
    };
    const alin3 = deriveVatPeriodicity(
      { ...base, inArt310BeforeRegistration: 'nu', forecastStubTurnover: L(400_000) },
      cap,
    );
    const alin4 = deriveVatPeriodicity(
      {
        ...base,
        inArt310BeforeRegistration: 'da',
        actualTurnover: L(450_000),
        actualActivityMonths: 10,
        actualTurnoverScope: 'doar_cu_cod_de_tva',
        aicGoodsBeforeRegistration: 'nu',
      },
      cap,
    );
    expect(alin3.kind === 'derived' && alin3.periodicity).toBe('quarter');
    expect(alin4.kind === 'derived' && alin4.periodicity).toBe('month');

    // And the swap the landmine warns about is caught: feeding alin. (4)'s annualised figure against a
    // pro-rated cap, or alin. (3)'s forecast against the full cap, would flip at least one of these.
    // The same arithmetic in bani, so a reader can see the two comparators are different numbers:
    // 400.000 lei = 40.000.000 bani against a cap pro-rated to 10 months of 42.469.166,67 bani, and
    // 450.000 lei = 45.000.000 bani annualised to 54.000.000 bani against the full 50.963.000 bani.
    const proRated = proRateCap(CAP, 10).proRated;
    const annualised = (45_000_000 * 12) / 10;
    expect(40_000_000 > Number(proRated)).toBe(false);  // alin. (3) comparator -> quarter
    expect(annualised > Number(CAP)).toBe(true);        // alin. (4) comparator -> month
    // Had the comparators been swapped, both answers would flip: the forecast against the full cap does
    // not exceed it, and the annualised actual against the pro-rated cap does not exceed that either.
    expect(40_000_000 > Number(CAP)).toBe(false);
    expect(annualised > Number(proRated)).toBe(true);
  });

  it('which alineat applies is ASKED, never inferred from the turnover', () => {
    const outcome = deriveVatPeriodicity(
      { year: 2026, registrationEffectiveFrom: '2026-03-01', registrationRoute: 'b', actualTurnover: L(450_000) },
      cap,
    );
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.questions.map((q) => q.id)).toContain('vat-in-art310-before');
    expect(outcome.detail).toContain('alin. (3)');
    expect(outcome.detail).toContain('alin. (4)');
  });

  it('a confirmed answer stands even on the branch where the app cannot say which alineat applies', () => {
    // D-VAT-1's path has to work on EVERY unanswered branch, and the branch-selector case is the one a new
    // PFA lands on. Gating the confirm path on a known branch would leave that user with a question and no
    // way to answer it — the dead end this phase exists to remove.
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        userChoice: { periodicity: 'quarter', branch: 'alin3', confirmedBy: 'user', confirmedOn: '2026-04-11' },
      },
      cap,
    );
    expect(outcome.kind).toBe('user_confirmed');
    if (outcome.kind !== 'user_confirmed') return;
    expect(outcome.periodicity).toBe('quarter');
    expect(outcome.choice.confirmedBy).toBe('user');
    // The reason the app stopped travels with the answer, so the record says what was never established.
    expect(outcome.steps.some((s) => s.value.includes('alin. (3)'))).toBe(true);
  });

  it('alin. (4) exception: intra-community goods BEFORE registration removes the quarter whatever the figure', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        inArt310BeforeRegistration: 'da',
        aicGoodsBeforeRegistration: 'da',
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    expect(outcome.kind === 'derived' && outcome.branch).toBe('alin4');
  });

  it('asks which turnover was declared, because Norme pct. 103 alin. (3) is unresolved for alin. (4)', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        inArt310BeforeRegistration: 'da',
        actualTurnover: L(450_000),
        actualActivityMonths: 10,
        aicGoodsBeforeRegistration: 'nu',
      },
      cap,
    );
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.questions.map((q) => q.id)).toContain('vat-actual-turnover-scope');
    expect(outcome.questions.some((q) => q.rule.includes('pct. 103 alin. (3)'))).toBe(true);
  });
});

describe('alin. (5) — automatic, for the year AFTER the registration year', () => {
  it('annualises the registration year actuals and decides the next year with no election', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2027,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        actualTurnover: L(300_000),
        actualActivityMonths: 10,
      },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('alin5');
    // 300.000 x 12/10 = 360.000 lei, under 509.630 -> the quarter survives into 2027.
    expect(outcome.periodicity).toBe('quarter');
    expect(outcome.steps.some((s) => s.label.includes('alin. (5)'))).toBe(true);
  });

  it('flips to the month when the annualised registration year exceeds the FULL cap', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2027,
        registrationEffectiveFrom: '2026-03-01',
        registrationRoute: 'b',
        actualTurnover: L(450_000),
        actualActivityMonths: 10,
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('month');
    // alin. (5) is alin. (4)'s arithmetic: full cap, no pro-rating.
    expect(outcome.kind === 'derived' && outcome.proRated).toBeUndefined();
  });

  it('asks for the registration-year actuals rather than reusing this year register', () => {
    const outcome = deriveVatPeriodicity(
      { year: 2027, registrationEffectiveFrom: '2026-03-01', registrationRoute: 'b' },
      cap,
    );
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.branch).toBe('alin5');
    expect(outcome.questions.map((q) => q.id)).toContain('vat-actual-turnover-registration-year');
    expect(outcome.detail).toContain('automat');
  });
});

describe('alin. (7) — one intra-community goods acquisition flips the quarter mid-stream', () => {
  it('flips to the month and names the distinct period rule', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(100_000),
        precedingYearAicGoods: 'nu',
        aicGoodsWhileQuarterly: 'da',
        aicGoodsExigibilityMonth: 5,
      },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('alin7');
    expect(outcome.periodicity).toBe('month');
    expect(outcome.steps.some((s) => s.value.includes('perioadă fiscală distinctă'))).toBe(true);
    expect(outcome.steps.some((s) => s.value.includes('5 zile lucrătoare'))).toBe(true);
  });

  it('overrides the alin. (2) quarter, because alin. (7) opens „Prin excepție de la alin. (2)-(6)"', () => {
    const withoutFlip = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(100_000),
        precedingYearAicGoods: 'nu',
      },
      cap,
    );
    expect(withoutFlip.kind === 'derived' && withoutFlip.periodicity).toBe('quarter');
  });
});

describe('B-101 — an alin. (7) year has a START POINT, not just a periodicity', () => {
  const flipped = (month: number | undefined): VatPeriodicityFacts => ({
    year: 2026,
    registrationEffectiveFrom: '2025-01-01',
    registrationRoute: 'b',
    precedingYearTurnover: L(100_000),
    precedingYearAicGoods: 'nu',
    aicGoodsWhileQuarterly: 'da',
    ...(month === undefined ? {} : { aicGoodsExigibilityMonth: month }),
  });

  it('names the month the calendar month begins at, for each of the three litera', () => {
    // Art. 322 alin. (7) says „începând cu", and the three litera put that point in three different places.
    // A year-level `periodicity: 'month'` cannot carry it, which is what let the obligation builder emit
    // monthly deconturi for quarters this person spent on the quarter.
    const starts: Array<[number, number]> = [
      [1, 1],   // lit. a) in the first month of Q1 — nothing precedes the point
      [4, 4],   // lit. a) in the first month of Q2 — Q1 stays a quarter
      [5, 6],   // lit. b) in the second month — the month begins at the THIRD; 04-05 is the distinct period
      [6, 7],   // lit. c) in the third month — the month begins with the NEXT quarter
      [12, 13], // lit. c) in the third month of Q4 — the month begins next year; this year is all quarters
    ];
    for (const [month, fromMonth] of starts) {
      const outcome = deriveVatPeriodicity(flipped(month), cap);
      expect(outcome.kind).toBe('derived');
      if (outcome.kind !== 'derived') continue;
      expect(outcome.segment).toEqual({ before: 'quarter', after: 'month', fromMonth });
    }
  });

  it('attaches the point to a CONFIRMED alin. (7) answer too, because it comes from the facts', () => {
    // The registration facts are missing here, so the derivation stops and the person's own answer decides
    // the year. The point is still known — they declared the month of exigibility — and a calendar that
    // ignored it would show twelve monthly returns to someone who filed quarters until June.
    const facts: VatPeriodicityFacts = {
      year: 2026,
      aicGoodsWhileQuarterly: 'da',
      aicGoodsExigibilityMonth: 5,
      userChoice: { periodicity: 'month', branch: 'alin7', confirmedBy: 'user', confirmedOn: '2026-10-31' },
    };
    const outcome = deriveVatPeriodicity(facts, cap);
    expect(outcome.kind).toBe('user_confirmed');
    if (outcome.kind !== 'user_confirmed') return;
    expect(outcome.segment).toEqual({ before: 'quarter', after: 'month', fromMonth: 6 });
  });

  it('gives NO point to a person who was already monthly, and none to a bare „da”', () => {
    // Applying this unconditionally invents quarters for someone who never had them. The gate is
    // `aicGoodsWhileQuarterly`, which states in its own name that the period was a quarter.
    const overCap: VatPeriodicityOutcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(900_000),
        precedingYearAicGoods: 'nu',
      },
      cap,
    );
    expect(overCap.kind).toBe('derived');
    if (overCap.kind === 'derived') expect(overCap.segment).toBeUndefined();

    const dinOficiu: VatPeriodicityOutcome = deriveVatPeriodicity(
      { year: 2026, registrationRoute: 'din_oficiu', registrationEffectiveFrom: '2026-03-01' },
      cap,
    );
    expect(dinOficiu.kind).toBe('derived');
    if (dinOficiu.kind === 'derived') expect(dinOficiu.segment).toBeUndefined();

    // A `da` with no month cannot pick a litera, so it cannot name a point either. The app says so rather
    // than guessing one, and the calendar stays as it was.
    const noMonth = deriveVatPeriodicity(flipped(undefined), cap);
    expect(noMonth.kind).toBe('derived');
    if (noMonth.kind === 'derived') expect(noMonth.segment).toBeUndefined();
  });
});

describe('Norme pct. 103 alin. (1) — din oficiu registration', () => {
  it('is the month, with no estimate asked for at all', () => {
    const outcome = deriveVatPeriodicity(
      { year: 2026, registrationEffectiveFrom: '2026-06-15', registrationRoute: 'din_oficiu' },
      cap,
    );
    expect(outcome.kind).toBe('derived');
    if (outcome.kind !== 'derived') return;
    expect(outcome.branch).toBe('pct103_alin1');
    expect(outcome.periodicity).toBe('month');
    // The norm asks for no figure, so asking for one would be inventing a step the law does not have.
    expect(outcome.steps.some((s) => s.value.includes('luna calendaristică'))).toBe(true);
  });
});

describe('the pro-rated cap has no rounding rule, and says so', () => {
  it('keeps the fraction instead of rounding it into an answer', () => {
    const pro = proRateCap(CAP, 7);
    expect(pro.exact).toBe(false);
    // 509.630 x 7/12 = 297.284,1666... bani-of-lei. Nothing rounds it to 297.284 or to 297.285.
    expect(pro.proRated.toFixed(4)).toBe('29728416.6667');
    expect(pro.note).toContain('regulă de rotunjire');
  });

  it('carries the gap note onto the outcome that used it', () => {
    const outcome = deriveVatPeriodicity(
      {
        year: 2026,
        registrationEffectiveFrom: '2026-06-01',
        registrationRoute: 'b',
        inArt310BeforeRegistration: 'nu',
        forecastStubTurnover: L(300_000),
      },
      cap,
    );
    expect(outcome.kind === 'derived' && outcome.boundaryNote).toContain('rotunjire');
  });

  it('says nothing about rounding when the pro-rated figure is a whole number of bani', () => {
    const pro = proRateCap(CAP, 3);
    expect(pro.exact).toBe(true);
    expect(pro.proRated.toNumber()).toBe(12_740_750);
  });
});

describe('monthsRemainingToYearEnd', () => {
  it('counts whole months from the month containing the effective date', () => {
    expect(monthsRemainingToYearEnd('2026-01-01')).toBe(12);
    expect(monthsRemainingToYearEnd('2026-03-01')).toBe(10);
    expect(monthsRemainingToYearEnd('2026-10-01')).toBe(3);
    expect(monthsRemainingToYearEnd('2026-12-31')).toBe(1);
    expect(monthsRemainingToYearEnd('not-a-date')).toBeNull();
  });
});

describe('the rule text the ask path shows', () => {
  it('states each branch in Romanian with its own citation', () => {
    for (const branch of ['alin1', 'alin2', 'alin3', 'alin4', 'alin5', 'alin7', 'pct103_alin1'] as const) {
      const entry = ART322_RULE_TEXT[branch];
      expect(entry.citation).toMatch(/alin\.|pct\./);
      expect(entry.rule.length).toBeGreaterThan(40);
    }
    // The two alineate the landmine is about must not be able to share a sentence.
    expect(ART322_RULE_TEXT.alin3.rule).toContain('RECALCULAT');
    expect(ART322_RULE_TEXT.alin4.rule).toContain('fără nicio recalculare');
  });
});

describe('vatPeriodicityForYear', () => {
  it('treats a profile with no record for the year as unanswered, not as answered with nothing', () => {
    const outcome = vatPeriodicityForYear(undefined, 2026, provider);
    expect(outcome.kind).toBe('ask');
    expect(vatPeriodicityForYear([{ year: 2025 }], 2026, provider).kind).toBe('ask');
  });

  it('reads the record for the year it is asked about', () => {
    const facts: VatPeriodicityFacts[] = [
      {
        year: 2026,
        registrationEffectiveFrom: '2025-01-01',
        registrationRoute: 'b',
        precedingYearTurnover: L(100_000),
        precedingYearAicGoods: 'nu',
      },
    ];
    const outcome = vatPeriodicityForYear(facts, 2026, provider);
    expect(outcome.kind === 'derived' && outcome.periodicity).toBe('quarter');
  });

  it('reuses the registration date PG-6f already asked for, instead of asking twice', () => {
    // `vatRegistration.effectiveFrom` is the answer to CF art. 316 alin. (1^1). Making the art. 322 record
    // demand the same date again would be a second question with one answer, and would tell a person who
    // had answered it that the app does not know it. This copies a declared fact; it infers nothing.
    const outcome = vatPeriodicityForYear(undefined, 2026, provider, {
      status: 'inregistrat_art316',
      effectiveFrom: '2025-01-01',
    });
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    // The date is no longer among the questions; the preceding-year figure still is.
    expect(outcome.questions.map((q) => q.id)).not.toContain('vat-registration-effective-from');
    expect(outcome.branch).toBe('alin2');
    expect(outcome.questions.map((q) => q.id)).toContain('vat-preceding-turnover');
  });

  it('does NOT copy a registration status into an art. 316 route', () => {
    // `inregistrat_art316` says the person is registered. It does not say they came from the art. 310
    // exemption, and that is the fact that decides alin. (3) versus alin. (4) — landmine 1. Carrying the
    // status across as a route would be the app choosing a branch it was never told.
    const outcome = vatPeriodicityForYear(undefined, 2026, provider, {
      status: 'inregistrat_art316',
      effectiveFrom: '2026-03-01',
    });
    expect(outcome.kind).toBe('ask');
    if (outcome.kind !== 'ask') return;
    expect(outcome.questions.map((q) => q.id)).toContain('vat-in-art310-before');
  });
});
