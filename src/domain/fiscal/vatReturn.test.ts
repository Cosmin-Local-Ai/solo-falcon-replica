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
} from './vatReturn';
import { isFiledVatReturn, type VatReturnRecord } from '../../data/types';
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
    const p: VatReturnRecord = {
      id: 'r-3', obligationId: 'decont-04-05-2026', year: 2026, form: '300', periodKind: 'partial',
      periodIndex: 4, periodToMonth: 5, status: 'in_pregatire',
    };
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
