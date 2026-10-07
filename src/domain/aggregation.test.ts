import { describe, expect, it } from 'vitest';
import type { AppData, Expense, Revenue, SettingsState } from '../data/types';
import type { PfaIdentity, PfaProfile } from './models';
import { inPeriod, selectMonthly, selectYtd, revenueFiscalDate, expenseFiscalDate, auditFiscalDates } from './aggregation';
import { addBani, lei, subBani, type Bani } from './money';

function identity(): PfaIdentity {
  return {
    nume: 'Test SRL',
    cnp: '',
    adresa: 'Str. Test 1',
    telefon: '0700000000',
    email: 'test@example.com',
    denumire: 'Test SRL',
    cui: '12345678',
    formaJuridica: 'SRL',
    numarRegComert: 'J40/123/2026',
    adresaSocietate: 'Str. Test 1',
    telefonSocietate: '0700000000',
    emailSocietate: 'test@example.com',
    contBancar: 'RO49BANK1234',
    banca: 'Test Bank',
  };
}

function profile(fiscalYear = 2026): PfaProfile {
  return {
    id: 'profile-test',
    pfaStartYear: 2026,
    fiscalYear,
    regime: 'impozit_pe_venit',
    caen: '6201',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'obligatoriu',
    vatExempt: false,
    cashFloorLei: lei(0),
    identity: identity(),
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
    profile: profile(),
    revenues: [],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: emptySettings,
    ...overrides,
  };
}

function revenue(date: string, valoareFaraTva: Bani, tva: Bani, status: Revenue['status'] = 'inregistrata'): Revenue {
  return {
    id: `rev-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    client: 'Client Test',
    cui: '12345678',
    valoareFaraTva,
    tva,
    status,
  };
}

function expense(date: string, valoareFaraTva: Bani, tva: Bani, status: Expense['status'] = 'inregistrata'): Expense {
  return {
    id: `exp-${date}-${valoareFaraTva}`,
    tip: 'factura',
    nr: '1',
    date,
    furnizor: 'Furnizor Test',
    cui: '87654321',
    valoareFaraTva,
    tva,
    status,
  };
}

describe('selectYtd', () => {
  it('aggregates only records with status === inregistrata', () => {
    const data = makeData({
      revenues: [
        revenue('2026-02-10', lei(100), lei(19), 'inregistrata'),
        revenue('2026-02-11', lei(200), lei(38), 'in-asteptare'),
        revenue('2026-02-12', lei(300), lei(57), 'respinsa'),
      ],
      expenses: [
        expense('2026-02-15', lei(50), lei(9.5), 'inregistrata'),
        expense('2026-02-16', lei(60), lei(11.4), 'respinsa'),
      ],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(119));
    expect(ytd.expenses).toBe(lei(59.5));
    expect(ytd.net).toBe(lei(59.5));
  });

  it('computes total as valoareFaraTva + tva', () => {
    const data = makeData({
      revenues: [revenue('2026-03-01', lei(1000), lei(190))],
      expenses: [expense('2026-03-02', lei(400), lei(74.4))],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(1190));
    expect(ytd.expenses).toBe(lei(474.4));
    expect(ytd.net).toBe(lei(715.6));
  });

  it('accumulates net (valoareFaraTva) fields separately from gross (Area 6)', () => {
    const data = makeData({
      revenues: [revenue('2026-03-01', lei(100), lei(10))],
      expenses: [expense('2026-03-02', lei(50), lei(5))],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(110));
    expect(ytd.revenueNet).toBe(lei(100));
    expect(ytd.expenses).toBe(lei(55));
    expect(ytd.expenseNet).toBe(lei(50));
    expect(ytd.net).toBe(lei(55));
  });

  it('respects the fiscalYear boundary (profile.fiscalYear, calendar year)', () => {
    const data = makeData({
      revenues: [
        revenue('2025-12-31', lei(100), lei(19)),
        revenue('2026-01-01', lei(200), lei(38)),
        revenue('2026-06-15', lei(300), lei(57)),
        revenue('2027-01-01', lei(400), lei(76)),
      ],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(595));
  });

  it('uses the fiscal year of the profile, not the asOfDate year', () => {
    const data = makeData({
      profile: profile(2025),
      revenues: [
        revenue('2025-05-05', lei(100), lei(19)),
        revenue('2026-05-05', lei(200), lei(38)),
      ],
    });

    // asOfDate is in 2026, but the fiscal year is 2025.
    const ytd = selectYtd(data, '2026-06-30');
    expect(ytd.revenue).toBe(lei(119));
  });

  it('treats asOfDate as an inclusive upper bound', () => {
    const data = makeData({
      revenues: [
        revenue('2026-03-31', lei(100), lei(19)),
        revenue('2026-04-01', lei(200), lei(38)),
      ],
    });

    const ytd = selectYtd(data, '2026-03-31');
    expect(ytd.revenue).toBe(lei(119));
  });

  it('returns zeros for empty data', () => {
    const ytd = selectYtd(makeData(), '2026-06-30');
    expect(ytd).toEqual({ revenue: lei(0), expenses: lei(0), net: lei(0), revenueNet: 0, expenseNet: 0 });
  });

  it('computes negative net when expenses exceed revenue (zero income)', () => {
    const data = makeData({
      expenses: [expense('2026-03-15', lei(500), lei(95))],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(0);
    expect(ytd.expenses).toBe(lei(595));
    expect(ytd.net).toBe(lei(-595));
  });

  it('includes records on the first day of the fiscal year (Jan 1)', () => {
    const data = makeData({
      revenues: [revenue('2026-01-01', lei(100), lei(19))],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(119));
  });

  it('includes records on the last day of the fiscal year (Dec 31)', () => {
    const data = makeData({
      revenues: [revenue('2026-12-31', lei(100), lei(19))],
    });
    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(119));
  });

  it('tva=0 record: revenueNet equals revenue (no VAT to net)', () => {
    const data = makeData({
      revenues: [revenue('2026-03-01', lei(100), lei(0))],
      expenses: [expense('2026-03-02', lei(50), lei(0))],
    });

    const ytd = selectYtd(data, '2026-12-31');
    expect(ytd.revenue).toBe(lei(100));
    expect(ytd.revenueNet).toBe(lei(100));
    expect(ytd.expenses).toBe(lei(50));
    expect(ytd.expenseNet).toBe(lei(50));
    expect(ytd.net).toBe(lei(50));
  });

  it('returns all-zero YTD when asOfDate is before the fiscal year start', () => {
    const data = makeData({
      profile: profile(2026),
      revenues: [
        revenue('2026-01-15', lei(100), lei(19)),
        revenue('2026-06-15', lei(200), lei(38)),
      ],
    });

    const ytd = selectYtd(data, '2025-06-15');
    expect(ytd).toEqual({ revenue: lei(0), expenses: lei(0), net: lei(0), revenueNet: 0, expenseNet: 0 });
  });
});

describe('selectMonthly', () => {
  it('groups totals by YYYY-MM', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', lei(100), lei(19)),
        revenue('2026-01-20', lei(50), lei(9.5)),
        revenue('2026-02-05', lei(200), lei(38)),
        revenue('2026-03-01', lei(300), lei(57)),
      ],
      expenses: [
        expense('2026-01-15', lei(40), lei(7.4)),
        expense('2026-02-10', lei(80), lei(15.2)),
        expense('2026-02-20', lei(20), lei(3.8)),
      ],
    });

    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.get('2026-01')).toEqual({ revenue: lei(178.5), expenses: lei(47.4), net: lei(131.1) });
    expect(monthly.get('2026-02')).toEqual({ revenue: lei(238), expenses: lei(119), net: lei(119) });
    expect(monthly.get('2026-03')).toEqual({ revenue: lei(357), expenses: lei(0), net: lei(357) });
    expect(monthly.size).toBe(3);
  });

  it('excludes out-of-period and non-inregistrata records', () => {
    const data = makeData({
      revenues: [
        revenue('2025-12-31', lei(100), lei(19)),
        revenue('2026-04-01', lei(200), lei(38)),
        revenue('2026-02-10', lei(300), lei(57), 'in-asteptare'),
        revenue('2026-02-11', lei(400), lei(76), 'inregistrata'),
      ],
    });

    const monthly = selectMonthly(data, '2026-03-31');
    expect(monthly.size).toBe(1);
    expect(monthly.get('2026-02')).toEqual({ revenue: lei(476), expenses: lei(0), net: lei(476) });
  });

  it('is deterministic for the same data and asOfDate', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', lei(100), lei(19)),
        revenue('2026-02-10', lei(200), lei(38)),
      ],
      expenses: [expense('2026-01-15', lei(50), lei(9.5))],
    });

    const first = selectMonthly(data, '2026-06-30');
    const second = selectMonthly(data, '2026-06-30');
    expect(second).toEqual(first);
    expect(selectYtd(data, '2026-06-30')).toEqual(selectYtd(data, '2026-06-30'));
  });

  it('omits months with no records (no gap-filling)', () => {
    const data = makeData({
      revenues: [
        revenue('2026-01-10', lei(100), lei(19)),
        revenue('2026-03-10', lei(200), lei(38)),
      ],
    });
    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.size).toBe(2);
    expect(monthly.has('2026-02')).toBe(false);
    expect(monthly.get('2026-01')).toEqual({ revenue: lei(119), expenses: lei(0), net: lei(119) });
    expect(monthly.get('2026-03')).toEqual({ revenue: lei(238), expenses: lei(0), net: lei(238) });
  });

  it('groups by calendar month across the Jan/Dec boundary', () => {
    const data = makeData({
      revenues: [
        revenue('2026-12-31', lei(100), lei(19)),
        revenue('2026-01-01', lei(200), lei(38)),
      ],
    });
    const monthly = selectMonthly(data, '2026-12-31');
    expect(monthly.size).toBe(2);
    expect(monthly.get('2026-12')).toEqual({ revenue: lei(119), expenses: lei(0), net: lei(119) });
    expect(monthly.get('2026-01')).toEqual({ revenue: lei(238), expenses: lei(0), net: lei(238) });
  });
});

describe('inPeriod', () => {
  it('includes the fiscal year start date', () => {
    expect(inPeriod('2026-01-01', '2026-12-31', 2026)).toBe(true);
  });

  it('includes the asOfDate', () => {
    expect(inPeriod('2026-06-15', '2026-06-15', 2026)).toBe(true);
  });

  it('excludes the day after asOfDate', () => {
    expect(inPeriod('2026-06-16', '2026-06-15', 2026)).toBe(false);
  });

  it('excludes dates before the fiscal year', () => {
    expect(inPeriod('2025-12-31', '2026-12-31', 2026)).toBe(false);
  });

  it('excludes dates after the fiscal year', () => {
    expect(inPeriod('2027-01-01', '2026-12-31', 2026)).toBe(false);
  });
});

describe('source-data reactivity', () => {
  it('adding a record changes aggregates', () => {
    const before = selectYtd(makeData({ revenues: [revenue('2026-03-10', lei(100), lei(19))] }), '2026-12-31');
    const after = selectYtd(
      makeData({
        revenues: [revenue('2026-03-10', lei(100), lei(19)), revenue('2026-04-10', lei(200), lei(38))],
      }),
      '2026-12-31',
    );
    // addBani/subBani, not `+`: Bani + Bani widens to number and drops the brand.
    expect(after.revenue).toBe(addBani(before.revenue, lei(238)));
    expect(after.net).toBe(addBani(before.net, lei(238)));
  });

  it('removing a record changes aggregates', () => {
    const data = makeData({
      revenues: [revenue('2026-03-10', lei(100), lei(19)), revenue('2026-04-10', lei(200), lei(38))],
    });
    const before = selectYtd(data, '2026-12-31');
    const after = selectYtd({ ...data, revenues: [data.revenues[0]] }, '2026-12-31');
    expect(after.revenue).toBe(subBani(before.revenue, lei(238)));
  });
});

// --- Phase 9: the FISCAL date is the collected / paid date -------------------------------
// CF art. 68 alin. (2) lit. a) measures venit brut by „sumele încasate" (amounts COLLECTED) and
// art. 68 alin. (4) lit. b) attributes an expense to „anului în cursul căruia au fost plătite"
// (the year it was PAID). The consequence is ATTRIBUTION, not punishment: a record collected or
// paid in a later year moves to that year, it is not disallowed. There is no late-payment
// disallowance in the Cod fiscal — see docs/ai/research/10 §1.

describe('fiscal date (collected / paid)', () => {
  it('treats a legacy record\'s single `date` as the fiscal date', () => {
    // Pinned deliberately: the v2->v3 migration refuses to invent a collection or payment event,
    // so a payload with one ambiguous date is read as if that date were the fiscal date.
    const r = revenue('2026-05-04', lei(100), lei(19));
    const e = expense('2026-05-06', lei(50), lei(9.5));
    expect(revenueFiscalDate(r)).toBe('2026-05-04');
    expect(expenseFiscalDate(e)).toBe('2026-05-06');
    const ytd = selectYtd(makeData({ revenues: [r], expenses: [e] }), '2026-12-31');
    expect(ytd.revenue).toBe(lei(119));
    expect(ytd.expenses).toBe(lei(59.5));
  });

  it('selects a revenue on its COLLECTED date, not its document date', () => {
    const collectedNextYear: Revenue = { ...revenue('2026-12-20', lei(100), lei(19)), collected: '2027-01-05' };
    const in2026 = selectYtd(makeData({ revenues: [collectedNextYear] }), '2026-12-31');
    expect(in2026.revenue).toBe(0);
    const in2027 = selectYtd(
      makeData({ profile: profile(2027), revenues: [collectedNextYear] }),
      '2027-12-31',
    );
    expect(in2027.revenue).toBe(lei(119));
  });

  it('selects an expense on its PAID date, not its document date', () => {
    const paidNextYear: Expense = { ...expense('2026-12-30', lei(50), lei(9.5)), paid: '2027-02-01' };
    expect(selectYtd(makeData({ expenses: [paidNextYear] }), '2026-12-31').expenses).toBe(0);
    expect(
      selectYtd(makeData({ profile: profile(2027), expenses: [paidNextYear] }), '2027-12-31').expenses,
    ).toBe(lei(59.5));
  });

  it('honours asOfDate against the collected date', () => {
    const r: Revenue = { ...revenue('2026-01-05', lei(100), lei(19)), collected: '2026-06-30' };
    expect(selectYtd(makeData({ revenues: [r] }), '2026-06-29').revenue).toBe(0);
    expect(selectYtd(makeData({ revenues: [r] }), '2026-06-30').revenue).toBe(lei(119));
  });

  it('buckets monthly totals by the fiscal date', () => {
    const r: Revenue = { ...revenue('2026-03-31', lei(100), lei(19)), collected: '2026-04-02' };
    const e: Expense = { ...expense('2026-03-31', lei(50), lei(9.5)), paid: '2026-04-03' };
    const monthly = selectMonthly(makeData({ revenues: [r], expenses: [e] }), '2026-12-31');
    // The document month never appears; the collected/paid month does.
    expect(monthly.has('2026-03')).toBe(false);
    expect(monthly.get('2026-04')).toEqual({ revenue: lei(119), expenses: lei(59.5), net: lei(59.5) });
  });

  it('a collected date earlier than the document date still attributes normally', () => {
    // Payment terms are not a legality question here: art. 68 alin. (4) lit. a) only requires the
    // expense be „justificate prin documente", so the issue date is never a timing gate.
    const r: Revenue = { ...revenue('2026-06-10', lei(100), lei(19)), collected: '2026-02-01' };
    expect(revenueFiscalDate(r)).toBe('2026-02-01');
    expect(selectYtd(makeData({ revenues: [r] }), '2026-12-31').revenue).toBe(lei(119));
  });
});

// ── B-21: an unusable date must be visible, never silent ───────────────────────

describe('inPeriod — the date guard (B-21)', () => {
  it('accepts a real calendar day inside the period', () => {
    expect(inPeriod('2026-06-01', '2026-12-31', 2026)).toBe(true);
    expect(inPeriod('2026-12-31', '2026-12-31', 2026)).toBe(true);
  });

  it('refuses every value that is not a real calendar day', () => {
    // Before the guard these failed the comparison by accident and the record disappeared
    // with no trace. Now the refusal is deliberate and `auditFiscalDates` reports it.
    expect(inPeriod('', '2026-12-31', 2026)).toBe(false);
    expect(inPeriod('2026-6-1', '2026-12-31', 2026)).toBe(false);
    expect(inPeriod('2026-13-01', '2026-12-31', 2026)).toBe(false);
    expect(inPeriod('not-a-date', '2026-12-31', 2026)).toBe(false);
    expect(inPeriod('2026-02-30', '2026-12-31', 2026)).toBe(false);
  });

  it('the comparison is lexicographic, and that is now provable rather than assumed', () => {
    // Fixed width (4-2-2), zero-padded, year-first, and a day that exists: those are exactly the
    // conditions under which character order equals chronological order. The old bug lived in the
    // missing conditions — '2026-6-1' <= '2026-06-15' is FALSE because '6' > '0', so a real June
    // day sorted after mid-June. Such a value can no longer reach this comparison.
    const accepted = ['2026-01-31', '2026-02-01', '2026-06-01', '2026-06-15', '2026-12-31'];
    const lexicographic = [...accepted].sort();
    const chronological = [...accepted].sort((a, b) => Date.parse(a) - Date.parse(b));
    expect(lexicographic).toEqual(chronological);
    // And the counter-example the guard makes unreachable:
    expect('2026-6-1' <= '2026-06-15').toBe(false);
    expect(Date.parse('2026-06-01') < Date.parse('2026-06-15')).toBe(true);
  });
});

describe('auditFiscalDates — the exclusion report (B-21)', () => {
  it('is empty for clean data', () => {
    const data = makeData({
      revenues: [revenue('2026-06-01', lei(100), lei(19))],
      expenses: [expense('2026-06-02', lei(50), lei(9.5))],
    });
    expect(auditFiscalDates(data)).toEqual([]);
  });

  it('reports a malformed persisted record as review_required instead of letting it vanish', () => {
    // This is the acceptance case: the record is NOT dropped and NOT backfilled. It still exists,
    // it contributes nothing to the aggregate, and the reason names the field and the value.
    const bad: Revenue = { ...revenue('2026-6-1', lei(100), lei(19)) };
    const data = makeData({ revenues: [bad] });

    const report = auditFiscalDates(data);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      id: bad.id,
      kind: 'revenue',
      field: 'date',
      value: '2026-6-1',
      status: 'review_required',
    });
    expect(report[0].reason).toContain('2026-6-1');
    expect(report[0].reason).toContain('date');
    expect(report[0].reason).toContain('două cifre');

    // Excluded from the aggregate…
    expect(selectYtd(data, '2026-12-31').revenue).toBe(0);
    // …but not deleted from the dataset, and nothing was invented in its place.
    expect(data.revenues).toHaveLength(1);
    expect(data.revenues[0].date).toBe('2026-6-1');
  });

  it('reports the field the fiscal date actually came from', () => {
    // A valid document date with an unusable collection date is still unusable: `collected` is
    // what attributes the revenue (Phase 9), exactly as `revenueFiscalDate` resolves it.
    const r: Revenue = { ...revenue('2026-06-01', lei(100), lei(19)), collected: 'not-a-date' };
    const e: Expense = { ...expense('2026-06-01', lei(50), lei(9.5)), paid: '' };
    const report = auditFiscalDates(makeData({ revenues: [r], expenses: [e] }));
    expect(report.map(x => [x.kind, x.field])).toEqual([
      ['revenue', 'collected'],
      ['expense', 'paid'],
    ]);
    expect(report[1].value).toBe('');
    expect(report[1].reason).toContain('necompletat');
  });

  it('audits records that do not move money yet, because the defect is the same', () => {
    // Only `inregistrata` rows reach the totals today, but a pending row with an unusable date
    // becomes a silent hole the moment its status changes.
    const pending: Revenue = { ...revenue('2026-13-01', lei(100), lei(19), 'in-asteptare') };
    const report = auditFiscalDates(makeData({ revenues: [pending] }));
    expect(report).toHaveLength(1);
    expect(report[0].status).toBe('review_required');
  });

  it('repairs nothing: the offending value is reported verbatim', () => {
    const bad: Expense = { ...expense('2026-02-30', lei(50), lei(9.5)) };
    const report = auditFiscalDates(makeData({ expenses: [bad] }));
    expect(report[0].value).toBe('2026-02-30');
    expect(report[0].reason).toContain('nu există în luna respectivă');
  });
});
