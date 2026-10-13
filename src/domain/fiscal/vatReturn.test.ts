/**
 * PG-6g acceptance 4, 5, 6, 8 — the art. 322/323 filing calendar, the record discipline, and the D300
 * line layout.
 *
 * The calendar test that matters most is the fourth quarter. Landmine 4 of the brief: „The quarterly
 * filing term is not uniform across quarters" — art. 323 alin. (1) says „până la data de 25 inclusiv a
 * lunii următoare celei în care se încheie perioada fiscală", and for a period ending 31 December the
 * following month is in the NEXT calendar year. A renderer that assumed the term and the period share a
 * year would have shown a Q4 2026 decont as due on 25.12.2026.
 *
 * The three kinds of obligation are asserted to be three kinds, not one list of dates: a decont, the
 * alin. (6) mențiuni until 25 ianuarie, and the alin. (8) 5-working-day mențiuni for an intra-community
 * goods acquisition. Collapsing them is how a mențiuni duty would come to be presented as a periodic
 * return.
 */
import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  aicFlipForQuarter,
  aicMentiuniObligation,
  annualMentiuniObligation,
  D300_DEDUCTIBLE_LINES,
  decontObligations,
  decontTerm,
  parkedGroups,
  periodEnd,
  periodLabel,
  periodStart,
  unfiledFigureNote,
  vatFiscalPeriods,
  type VatFiscalPeriod,
} from './vatReturn';
import { isFiledVatReturn, type VatReturnRecord } from '../../data/types';
import { alin7MonthStart, type PeriodicitySegment } from './vatPeriodicity';
import { lei } from '../money';

describe('art. 323 alin. (1) — the decont term, per fiscal period', () => {
  it('is the 25th of the month following the one in which the period ends', () => {
    expect(decontTerm({ kind: 'month', year: 2026, month: 1 })).toBe('2026-02-25');
    expect(decontTerm({ kind: 'month', year: 2026, month: 6 })).toBe('2026-07-25');
    expect(decontTerm({ kind: 'quarter', year: 2026, quarter: 1 })).toBe('2026-04-25');
    expect(decontTerm({ kind: 'quarter', year: 2026, quarter: 2 })).toBe('2026-07-25');
    expect(decontTerm({ kind: 'quarter', year: 2026, quarter: 3 })).toBe('2026-10-25');
  });

  it('the fourth quarter is due in the FOLLOWING calendar year', () => {
    // Landmine 4. research/33 §10 pins this, and it is the single most likely place for a
    // „25th after the quarter" generalisation to break.
    expect(decontTerm({ kind: 'quarter', year: 2026, quarter: 4 })).toBe('2027-01-25');
    expect(decontTerm({ kind: 'month', year: 2026, month: 12 })).toBe('2027-01-25');
  });

  it('a December decont is keyed to the year of the PERIOD, not the year of the term', () => {
    const rows = decontObligations('month', 2026);
    const dec = rows.find((r) => r.period?.kind === 'month' && r.period.month === 12)!;
    expect(dec.year).toBe(2026);
    expect(dec.dueOn).toBe('2027-01-25');
    // art. 326 alin. (1): the payment is due the day the return is due, so there is no second date to
    // invent and no separate "payment deadline" row beside the filing row.
    expect(dec.paymentDueOn).toBe(dec.dueOn);
  });

  it('the monthly series is twelve periods and the quarterly series is four', () => {
    expect(vatFiscalPeriods('month', 2026)).toHaveLength(12);
    expect(vatFiscalPeriods('quarter', 2026)).toHaveLength(4);
    expect(decontObligations('month', 2026)).toHaveLength(12);
    expect(decontObligations('quarter', 2026)).toHaveLength(4);
  });

  it('period boundaries are right, including leap February', () => {
    expect(periodStart({ kind: 'quarter', year: 2026, quarter: 2 })).toBe('2026-04-01');
    expect(periodEnd({ kind: 'quarter', year: 2026, quarter: 2 })).toBe('2026-06-30');
    expect(periodEnd({ kind: 'month', year: 2028, month: 2 })).toBe('2028-02-29');
    expect(periodEnd({ kind: 'month', year: 2026, month: 2 })).toBe('2026-02-28');
    expect(periodLabel({ kind: 'partial', year: 2026, fromMonth: 4, toMonth: 5 })).toBe('04-05.2026');
  });

  it('closedThrough drops an open period but never an overdue closed one', () => {
    const rows = decontObligations('quarter', 2026, { closedThrough: '2026-12-01' });
    // Q4 2026 is still running on 1 December, so no decont can be stated for it yet.
    expect(rows.map((r) => r.period && periodLabel(r.period))).toEqual(['T1 2026', 'T2 2026', 'T3 2026']);
    const late = decontObligations('quarter', 2026, { closedThrough: '2027-06-01' });
    // T1 was due 25.04.2026 and is long past on 1 June — an overdue decont is exactly what has to show.
    expect(late).toHaveLength(4);
    expect(late[0]!.dueOn).toBe('2026-04-25');
  });
});

describe('art. 322 alin. (7) — the quarter splits, and only in one of the three letters', () => {
  it('lit. a) exigibility in month 1: monthly from month 1, no distinct period', () => {
    const flip = aicFlipForQuarter(2026, 2, 4)!;
    expect(flip.letter).toBe('a');
    expect(flip.periods.map(periodLabel)).toEqual(['04.2026', '05.2026', '06.2026']);
  });

  it('lit. b) exigibility in month 2: months 1-2 become ONE distinct fiscal period with its own decont', () => {
    const flip = aicFlipForQuarter(2026, 2, 5)!;
    expect(flip.letter).toBe('b');
    expect(flip.periods.map(periodLabel)).toEqual(['04-05.2026', '06.2026']);
    // The distinct period carries its own decont under art. 323 alin. (1): it ends 31 May, so it is due
    // 25 June — the same formula, applied to a period the law created mid-quarter.
    expect(decontTerm(flip.periods[0]!)).toBe('2026-06-25');
  });

  it('lit. c) exigibility in month 3: the quarter is untouched, the month starts next quarter', () => {
    const flip = aicFlipForQuarter(2026, 2, 6)!;
    expect(flip.letter).toBe('c');
    expect(flip.periods.map(periodLabel)).toEqual(['T2 2026']);
  });

  it('the split really produces an extra decont in the calendar', () => {
    const flip = aicFlipForQuarter(2026, 2, 5)!;
    const rows = decontObligations('quarter', 2026, { flips: [flip] });
    expect(rows.map((r) => r.period && periodLabel(r.period))).toEqual([
      'T1 2026', '04-05.2026', '06.2026', 'T3 2026', 'T4 2026',
    ]);
    expect(rows).toHaveLength(5);
  });
});

/**
 * B-99 — the flip has to be honoured whichever periodicity the calendar is walking.
 *
 * Art. 322 alin. (7) sets the periodicity to `month` itself, so on the alin. (7) branch the year arrives at
 * `decontObligations` as twelve month periods and the quarter the article names has to be recovered from
 * them. Joining the flip to `kind === 'quarter'` periods only meant the split was computed, passed in, and
 * never read: the confirmation panel said „se depun 2 deconturi” and the calendar listed three monthly ones
 * and no distinct period at all.
 *
 * These assertions are written as **month-by-month coverage**, not as presence. Splicing a distinct period
 * into an already-monthly year is the obvious fix and the obvious way to cover March twice or drop it, and
 * either error changes what the taxpayer is told to file.
 *
 * **B-101 corrects the lists this block shipped.** They asserted coverage, which passed, and the year they
 * covered was wrong: `01.2026, 02.2026, 03.2026` are three monthly returns for a first quarter that was
 * never monthly. Art. 322 alin. (7) makes the month begin at a point inside the year, so everything before
 * that point is still one return for a quarter. Coverage and count are both asserted now, and so is the
 * exact list — a count alone hid this once already (lit. a) is 10, not 12, and only the list says so).
 */
describe('B-99 / B-101 — alin. (7) on a year that is already monthly, from the point the month begins', () => {
  /** Every month the year's periods cover, in calendar order — each month exactly once, or the year is wrong. */
  function coveredMonths(rows: readonly { period?: VatFiscalPeriod }[]): number[] {
    const months: number[] = [];
    for (const r of rows) {
      const p = r.period!;
      const first = Number(periodStart(p).slice(5, 7));
      const last = Number(periodEnd(p).slice(5, 7));
      for (let m = first; m <= last; m += 1) months.push(m);
    }
    return months;
  }

  const YEAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const labelsFor = (periodicity: 'month' | 'quarter', month: number): string[] => {
    const flip = aicFlipForQuarter(2026, Math.ceil(month / 3), month)!;
    return decontObligations(periodicity, 2026, { flips: [flip] }).map((r) => periodLabel(r.period!));
  };
  const rowsFor = (periodicity: 'month' | 'quarter', month: number) => {
    const flip = aicFlipForQuarter(2026, Math.ceil(month / 3), month)!;
    return decontObligations(periodicity, 2026, { flips: [flip] });
  };
  /**
   * B-101 — the call the dashboard actually makes. A flipped year arrives at the builder with BOTH the flip
   * and the point inside the year at which the month begins; the flip alone only ever says what replaces the
   * quarter of exigibility, never what the earlier quarters were.
   */
  const segmentFor = (month: number): PeriodicitySegment => ({
    before: 'quarter',
    after: 'month',
    fromMonth: alin7MonthStart(month)!,
  });
  const flippedRows = (month: number) => {
    const flip = aicFlipForQuarter(2026, Math.ceil(month / 3), month)!;
    return decontObligations('month', 2026, { flips: [flip], segment: segmentFor(month) });
  };
  const flippedLabels = (month: number): string[] => flippedRows(month).map((r) => periodLabel(r.period!));

  it('lit. a) exigibility in January: nothing precedes the point, so twelve months is the right answer', () => {
    // The one case where the year really is twelve months on an alin. (7) year: the month begins at the first
    // month of the first quarter, so there is no quarter left before it to restore.
    expect(flippedLabels(1)).toEqual([
      '01.2026', '02.2026', '03.2026', '04.2026', '05.2026', '06.2026',
      '07.2026', '08.2026', '09.2026', '10.2026', '11.2026', '12.2026',
    ]);
    expect(flippedRows(1).some((r) => r.period!.kind === 'partial')).toBe(false);
    expect(coveredMonths(flippedRows(1))).toEqual(YEAR);
  });

  it('B-101 lit. a) exigibility in April: Q1 was never monthly, so it is ONE return, not three', () => {
    // This is the assertion B-99 shipped wrong. Art. 322 alin. (7) lit. a) starts the month at the FIRST
    // month of the quarter, so the quarter before it is still a quarter. The old list — three monthly rows
    // for January, February and March — showed the taxpayer three deconturi nobody requires. The count is
    // 12 either way, which is exactly how the error survived a count-shaped check: the SHAPE is the finding.
    expect(flippedLabels(4)).toEqual([
      'T1 2026',
      '04.2026', '05.2026', '06.2026',
      '07.2026', '08.2026', '09.2026', '10.2026', '11.2026', '12.2026',
    ]);
    expect(flippedRows(4)).toHaveLength(10);
    expect(flippedRows(4).some((r) => r.period!.kind === 'partial')).toBe(false);
    expect(coveredMonths(flippedRows(4))).toEqual(YEAR);
  });

  it('B-101 lit. b) exigibility in May: T1, the distinct 04-05 period, then months — 9 returns, not 11', () => {
    // Old (wrong): 01.2026, 02.2026, 03.2026, 04-05.2026, 06…12.2026 = 11. The first three are monthly rows
    // for a quarter that was never monthly.
    expect(flippedLabels(5)).toEqual([
      'T1 2026', '04-05.2026', '06.2026',
      '07.2026', '08.2026', '09.2026', '10.2026', '11.2026', '12.2026',
    ]);
    expect(flippedRows(5)).toHaveLength(9);
    expect(coveredMonths(flippedRows(5))).toEqual(YEAR);

    const distinct = flippedRows(5).find((r) => r.period!.kind === 'partial')!;
    expect(distinct.id).toBe('decont-04-05.2026');
    // art. 323 alin. (1) applied to the period the law created mid-quarter: it ends 31 May, so it is due
    // 25 June. Same formula, same citation as every other decont — no separate term is invented here.
    expect(distinct.dueOn).toBe('2026-06-25');
    expect(distinct.paymentDueOn).toBe('2026-06-25');
    expect(distinct.citation).toBe('CF art. 323 alin. (1); plată art. 326 alin. (1)');
  });

  it('B-101 lit. c) exigibility in June: T1 and T2 as quarters, months from July — 8 returns, not 10', () => {
    // Old (wrong): 01.2026, 02.2026, 03.2026, T2 2026, 07…12.2026 = 10. Q1 was quarterly and stays
    // quarterly; the acquisition quarter is untouched; the month begins with the NEXT quarter.
    expect(flippedLabels(6)).toEqual([
      'T1 2026', 'T2 2026',
      '07.2026', '08.2026', '09.2026', '10.2026', '11.2026', '12.2026',
    ]);
    expect(flippedRows(6)).toHaveLength(8);
    expect(flippedRows(6).some((r) => r.period!.kind === 'partial')).toBe(false);
    expect(coveredMonths(flippedRows(6))).toEqual(YEAR);
  });

  it('B-101 lit. c) exigibility in December: the month begins next year, so this year is four quarters', () => {
    // `fromMonth` 13 is not a sentinel to be clamped away — it is what alin. (7) lit. c) says when the
    // exigibility lands in the third month of Q4. Clamping it to 12 would mint a December return.
    expect(alin7MonthStart(12)).toBe(13);
    expect(flippedLabels(12)).toEqual(['T1 2026', 'T2 2026', 'T3 2026', 'T4 2026']);
    expect(coveredMonths(flippedRows(12))).toEqual(YEAR);
  });

  it('B-101 a restored quarter carries the id a plain quarterly person would have had', () => {
    // The id is the join key a filed return is matched on, so a quarter put back into the year must be the
    // SAME term, not a look-alike. A filing recorded against `decont-T1-2026` has to discharge the restored
    // Q1 and nothing else. Only the quarters wholly before the point are restored — the rest of the year is
    // genuinely monthly, and asserting a T4 that the law does not give would be the same invention in
    // reverse.
    const plain = decontObligations('quarter', 2026);
    for (const month of [4, 5, 6, 11, 12]) {
      const start = alin7MonthStart(month)!;
      const restoredQuarters = plain.filter((r) => r.period!.kind === 'quarter'
        && r.period!.quarter * 3 < start);
      expect(restoredQuarters.length).toBeGreaterThan(0);
      for (const p of restoredQuarters) {
        const restored = flippedRows(month).find((r) => r.id === p.id);
        expect(restored).toBeDefined();
        expect(restored!.dueOn).toBe(p.dueOn);
        expect(restored!.label).toBe(p.label);
      }
    }
  });

  it('B-101 the segment and the flip never disagree about where the month begins, for any month', () => {
    // Two readings of one litera is how a calendar drifts from the article: `alin7MonthStart` fixes the
    // point, `aicFlipForQuarter` cuts the quarter. For every month of the year the first month-kind period
    // the flip emits must be the month the segment says the month starts — and for lit. c), which emits no
    // month at all, it must be the first month of the following quarter.
    for (let month = 1; month <= 12; month += 1) {
      const flip = aicFlipForQuarter(2026, Math.ceil(month / 3), month)!;
      const start = alin7MonthStart(month)!;
      const firstMonthly = flip.periods.find((p) => p.kind === 'month');
      expect(firstMonthly ? firstMonthly.month : Math.ceil(month / 3) * 3 + 1).toBe(Math.min(start, 13));
      expect(coveredMonths(flippedRows(month))).toEqual(YEAR);
    }
  });

  it('the quarterly walk is unchanged for all three letters — the path that already worked', () => {
    // This substitution existed before B-99 and must not have moved. Recorded because the fix widened the
    // join: a monthly walk now consults the flip too, and the quarterly answer has to stay the same answer.
    // A quarterly person has no segment at all — the derivation only produces one on the alin. (7) branch —
    // so `yearPeriods` is never reached on this path.
    expect(labelsFor('quarter', 4)).toEqual(['T1 2026', '04.2026', '05.2026', '06.2026', 'T3 2026', 'T4 2026']);
    expect(labelsFor('quarter', 5)).toEqual(['T1 2026', '04-05.2026', '06.2026', 'T3 2026', 'T4 2026']);
    expect(labelsFor('quarter', 6)).toEqual(['T1 2026', 'T2 2026', 'T3 2026', 'T4 2026']);
    for (const month of [4, 5, 6]) expect(coveredMonths(rowsFor('quarter', month))).toEqual(YEAR);
  });

  it('no two obligations share an id, in any walk, for any month of exigibility', () => {
    // The id is the join key a filed return is matched against, not a caption. A collision silently merges
    // two terms into one and lets a single return discharge two periods.
    for (const periodicity of ['month', 'quarter'] as const) {
      for (let month = 1; month <= 12; month += 1) {
        const ids = rowsFor(periodicity, month).map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(coveredMonths(rowsFor(periodicity, month))).toEqual(YEAR);
      }
    }
    for (let month = 1; month <= 12; month += 1) {
      const ids = flippedRows(month).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(coveredMonths(flippedRows(month))).toEqual(YEAR);
    }
  });

  it('a flip computed for another year is dropped rather than spliced into this year', () => {
    // `AicFlip` carries no year of its own, so a stale flip would otherwise inject another year's periods
    // and leave this year's months covered twice or not at all.
    const foreign = aicFlipForQuarter(2027, 2, 5)!;
    const rows = decontObligations('month', 2026, { flips: [foreign] });
    expect(rows).toHaveLength(12);
    expect(coveredMonths(rows)).toEqual(YEAR);
    expect(rows.some((r) => r.id.includes('2027'))).toBe(false);
  });

  it('the decont builder contributes no mențiuni row, so the alin. (8) duty can only appear once', () => {
    // `aicMentiuniObligation` already contributes it. A second copy from the calendar would give the user
    // two of a form that is due once.
    for (const month of [4, 5, 6]) {
      expect(rowsFor('month', month).every((r) => r.kind === 'decont')).toBe(true);
      expect(flippedRows(month).every((r) => r.kind === 'decont')).toBe(true);
    }
  });
});

describe('art. 322 alin. (6) — the 25-ianuarie declarație de mențiuni is its own obligation', () => {
  it('exists for a person quarterly under alin. (2), and is not a decont', () => {
    const o = annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin2', requestingArt310Return: false })!;
    expect(o.dueOn).toBe('2027-01-25');
    expect(o.kind).toBe('mentiuni_annuale');
    expect(o.citation).toBe('CF art. 322 alin. (6)');
    expect(o.period).toBeUndefined();
    expect(o.label).toContain('Nu este un decont');
  });

  it('also exists for alin. (5), and NOT for alin. (3) or alin. (4)', () => {
    // The article names „potrivit alin. (2) și (5)". alin. (3) and alin. (4) are absent from it, so a
    // person whose quarterly status came from the registration-year estimate owes no such mențiune for
    // that year — inventing one would be inventing an obligation.
    expect(annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin5', requestingArt310Return: false })).not.toBeNull();
    expect(annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin3', requestingArt310Return: false })).toBeNull();
    expect(annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin4', requestingArt310Return: false })).toBeNull();
    expect(annualMentiuniObligation({ year: 2027, quarterlyUnder: null, requestingArt310Return: false })).toBeNull();
  });

  it('the art. 316 -> art. 310 return request is the exception, and an unchecked exception is stated', () => {
    expect(annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin2', requestingArt310Return: true })).toBeNull();
    const o = annualMentiuniObligation({
      year: 2027, quarterlyUnder: 'alin2', requestingArt310Return: false, art310ReturnUnknown: true,
    })!;
    expect(o.exceptionNote).toContain('art. 310');
  });

  it('the Q4 decont and the mențiuni fall on the SAME day and stay two separate rows', () => {
    // Both are due 25 ianuarie. One list of dates would merge them; the ids and the kinds keep them apart.
    const decont = decontObligations('quarter', 2026).find((r) => r.period?.kind === 'quarter' && r.period.quarter === 4)!;
    const mentiuni = annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin2', requestingArt310Return: false })!;
    expect(decont.dueOn).toBe(mentiuni.dueOn);
    expect(decont.id).not.toBe(mentiuni.id);
    expect(decont.kind).toBe('decont');
    expect(mentiuni.kind).toBe('mentiuni_annuale');
  });
});

describe('art. 322 alin. (8) — the 5-working-day mențiuni after an intra-community acquisition', () => {
  it('counts five working days from the end of the month the exigibility intervened in', () => {
    const o = aicMentiuniObligation({ year: 2026, monthOfExigibility: 3 })!;
    // 31.03.2026 is a Tuesday. Five working days on: 1, 2, 3, 6 and 7 April — the weekend is skipped.
    expect(o.dueOn).toBe('2026-04-07');
    expect(o.holidayCaveat).toContain('sâmbăta și duminica');
    expect(o.holidayCaveat).toContain('1182/71');
  });

  it('is a third kind of obligation, with its own citation', () => {
    const o = aicMentiuniObligation({ year: 2026, monthOfExigibility: 7 })!;
    expect(o.kind).toBe('mentiuni_achizitie');
    expect(o.citation).toBe('CF art. 322 alin. (8)');
    expect(o.period).toBeUndefined();
  });

  it('addWorkingDays never lands on a weekend', () => {
    // 31.07.2026 is a Thursday.
    const { date, skippedWeekendDays } = addWorkingDays('2026-07-31', 5);
    expect(date).toBe('2026-08-07');
    expect(skippedWeekendDays).toBe(2);
    expect(new Date(`${date}T00:00:00Z`).getUTCDay()).not.toBe(0);
    expect(new Date(`${date}T00:00:00Z`).getUTCDay()).not.toBe(6);
  });

  it('refuses a month that is not a month', () => {
    expect(aicMentiuniObligation({ year: 2026, monthOfExigibility: 0 })).toBeNull();
    expect(aicMentiuniObligation({ year: 2026, monthOfExigibility: 13 })).toBeNull();
  });
});

describe('acceptance 5 — the filing record keeps the AnnualFiling discipline', () => {
  const filed: VatReturnRecord = {
    id: 'r-1', obligationId: 'decont-T2-2026', year: 2026, form: '300', periodKind: 'quarter', periodIndex: 2,
    status: 'depusa', filedOn: '2026-07-20', reference: 'RT2026072000123',
  };

  it('only `depusa` says a return was filed', () => {
    expect(isFiledVatReturn(filed)).toBe(true);
    expect(isFiledVatReturn({ status: 'in_pregatire' })).toBe(false);
    expect(isFiledVatReturn({ status: 'respinsa' })).toBe(false);
  });

  it('the monthly legacy status vocabulary cannot be handed to it', () => {
    // The retired monthly rows stored 'inregistrata', 'in-asteptare' and 'transmisa'. Those are not
    // members of VatReturnStatus, so the compiler refuses them; this is the runtime half of the same pin.
    for (const legacy of ['inregistrata', 'in-asteptare', 'transmisa'] as const) {
      expect(isFiledVatReturn({ status: legacy as VatReturnRecord['status'] })).toBe(false);
    }
  });

  it('a record is keyed by fiscal period, and a Q4 2026 record is keyed to 2026', () => {
    const q4: VatReturnRecord = {
      id: 'r-2', obligationId: 'decont-T4-2026', year: 2026, form: '300', periodKind: 'quarter', periodIndex: 4, status: 'depusa',
      filedOn: '2027-01-22',
    };
    expect(q4.year).toBe(2026);
    // The term it discharges is 25.01.2027 — a different calendar year from the one the record names.
    expect(decontTerm({ kind: 'quarter', year: 2026, quarter: 4 })).toBe('2027-01-25');
  });

  it('the distinct alin. (7) period is representable, because `partial` exists', () => {
    // The id written here is the one the calendar actually generates for that period — `periodLabel` renders
    // a partial as `04-05.2026`, so the separator inside the period is a dash and the year is still joined
    // with a dot. A fixture that hand-wrote a different spelling would still compile and still read as a
    // join, but would never match a real obligation: the id is a join key, not a caption.
    const generated = decontObligations('month', 2026, { flips: [aicFlipForQuarter(2026, 2, 5)!] })
      .find((r) => r.period?.kind === 'partial')!;
    const p: VatReturnRecord = {
      id: 'r-3', obligationId: generated.id, year: 2026, form: '300', periodKind: 'partial',
      periodIndex: 4, periodToMonth: 5, status: 'in_pregatire',
    };
    expect(p.obligationId).toBe('decont-04-05.2026');
    expect(p.periodKind).toBe('partial');
    expect(isFiledVatReturn(p)).toBe(false);
  });
});

describe('acceptance 6 — the parked lists stay parked', () => {
  const why = (reason: string) => `de ce: ${reason}`;
  const lines = [
    { tvaBani: lei(500), outcome: { kind: 'claimable' as const } },
    { tvaBani: lei(300), outcome: { kind: 'unresolved' as const, reason: 'pro_rata_nedeclarat' } },
    { tvaBani: lei(200), outcome: { kind: 'unresolved' as const, reason: 'pro_rata_nedeclarat' } },
    { tvaBani: lei(120), outcome: { kind: 'deferred' as const, reason: 'factura_eFactura_lipsa' } },
    { tvaBani: lei(80), outcome: { kind: 'zero' as const, reason: 'document_simplificat_100_400_eur' } },
  ];

  it('groups the excluded lines by reason, with the amount at stake', () => {
    const groups = parkedGroups(lines, why);
    expect(groups).toHaveLength(3);
    const proRata = groups.find((g) => g.reason === 'pro_rata_nedeclarat')!;
    expect(proRata.count).toBe(2);
    expect(proRata.amountBani).toBe(lei(500));
    expect(proRata.why).toContain('pro_rata_nedeclarat');
  });

  it('a claimable line never appears in a parked group', () => {
    const groups = parkedGroups(lines, why);
    expect(groups.some((g) => g.reason === 'claimable')).toBe(false);
    const total = groups.reduce((sum, g) => sum + g.amountBani, 0);
    // 300 + 200 + 120 + 80 parked; the 500 claimable leu is not among them.
    expect(total).toBe(lei(700));
  });

  it('an empty register parks nothing rather than parking a zero row', () => {
    expect(parkedGroups([], why)).toEqual([]);
  });
});

describe('acceptance 8 — nothing claims a return was or will be filed', () => {
  it('the note beside a computed figure says plainly that nothing was filed', () => {
    const note = unfiledFigureNote(lei(1000));
    expect(note).toContain('Nimic nu a fost depus');
    expect(note).toContain('nu este verificată cu nicio declarație');
  });

  it('no calendar row is worded as a confirmation of a filing', () => {
    const rows = [
      ...decontObligations('quarter', 2026),
      annualMentiuniObligation({ year: 2027, quarterlyUnder: 'alin2', requestingArt310Return: false })!,
      aicMentiuniObligation({ year: 2026, monthOfExigibility: 3 })!,
    ];
    for (const r of rows) {
      expect(r.label).not.toMatch(/am depus|a fost depus|vom depune|urmează să depunem/);
      expect(r.citation).toMatch(/art\. \d+/);
    }
  });
});

describe('the D300 line layout — 6f\'s number is not one number on one line', () => {
  it('names rd. 30, rd. 33 and rd. 34, and says what may sit on each', () => {
    const rows = D300_DEDUCTIBLE_LINES.map((l) => l.row);
    expect(rows).toEqual(expect.arrayContaining(['rd. 20–28', 'rd. 30', 'rd. 33', 'rd. 34']));
    const rd30 = D300_DEDUCTIBLE_LINES.find((l) => l.row === 'rd. 30')!;
    expect(rd30.title).toContain('TOTAL TAXĂ DEDUCTIBILĂ');
    expect(rd30.appTreatment).toContain('NUMAI');
  });

  it('leaves rd. 33 and rd. 34 without a value, because nothing was computed for them', () => {
    // PG-6f left the regularisation schedule and the art. 300 alin. (14) annual adjustment unapplied.
    // Putting the claimable total on those rows would be attributing a figure the app never derived.
    for (const row of ['rd. 33', 'rd. 34']) {
      const line = D300_DEDUCTIBLE_LINES.find((l) => l.row === row)!;
      expect(line.appTreatment).toContain('rămâne fără valoare');
    }
  });

  it('cites the OPANAF order that approves the form on every line', () => {
    for (const line of D300_DEDUCTIBLE_LINES) expect(line.citation).toContain('OPANAF 174/2026');
  });
});
