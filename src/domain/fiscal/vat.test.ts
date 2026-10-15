/**
 * PG-6f — the input-VAT decision (`research/42` §6).
 *
 * Each test below is one row of that table, and the row number is in its name so the acceptance list can
 * be checked against the suite rather than against prose. The rows the brief names are 1, 2, 3, 7, 9,
 * 11, 14, 18 and 20; the rest of §6 that this phase encodes is covered alongside them.
 *
 * Two things every test here guards at once:
 *
 * - **A switch is decided by the fact the law names**, not by a profile-level flag. The retired
 *   `vatExempt` boolean answered fourteen of these rows with one bit, wrongly in both directions.
 * - **Unresolved is not zero.** A line the app cannot decide leaves `claimableTotal` alone and appears in
 *   `unresolved`. Adding it would overstate the claim; dropping it silently would hide a record — the
 *   PG-1 failure mode this project refuses everywhere.
 */
import { describe, expect, it } from 'vitest';
import {
  VAT_ONLY_VEHICLE_EXCEPTION,
  VAT_VEHICLE_EXCEPTION_VALUES,
  VAT_VEHICLE_MASS_KG_LIMIT,
  VAT_VEHICLE_SEATS_LIMIT,
  capitalGoodClawback,
  decideInputVat,
  registrationEffectiveDate,
  type InputVatExpenseRecord,
  type InputVatInput,
  type VatRegistration,
} from './vat';
import { VEHICLE_EXCEPTION_CATEGORIES } from './deductibility';
import { lei, subBani, sumBani, type Bani } from '../money';

/** 1.000,00 lei of VAT, the amount every case below starts from. */
const TVA = lei(1000);

const REGISTERED: VatRegistration = { status: 'inregistrat_art316', effectiveFrom: '2026-01-01' };

/**
 * A line that clears every switch, so each test can move exactly one fact and see that fact decide.
 * `supplierRegime: 'inregistrat'` and `eFactura: 'da'` are declared rather than assumed: a domestic B2B
 * invoice's standing is a fact the app reads, never one it infers from the invoice existing.
 */
function cleanLine(over: Partial<InputVatExpenseRecord> = {}): InputVatExpenseRecord {
  return {
    id: over.id ?? 'e1',
    date: '2026-03-10',
    paid: '2026-03-20',
    supplierCui: 'RO12345678',
    tip: 'factura',
    tva: { amount: TVA, currency: 'RON' },
    vatFacts: {
      destination: 'taxabila',
      supplierRegime: 'inregistrat',
      documentKind: 'factura',
      eFactura: 'da',
    },
    ...over,
  };
}

function decide(over: Partial<InputVatInput> = {}) {
  return decideInputVat({
    expenses: [cleanLine()],
    registration: REGISTERED,
    fiscalYear: 2026,
    asOfDate: '2026-12-31',
    ...over,
  });
}

/** The outcome of the single line a case under test produced. */
function outcome(d: ReturnType<typeof decide>) {
  expect(d.lines).toHaveLength(1);
  return d.lines[0]!.outcome;
}

describe('§6 row 1 — registration decides whether a right exists at all', () => {
  it('an art. 310 person claims nothing, on the litera and not on a flag', () => {
    const d = decide({ registration: { status: 'scutit_art310' } });
    expect(outcome(d)).toEqual({
      kind: 'zero',
      reason: 'fara_drept_nicio_inregistrare',
      rule: 'art. 310 alin. (10) lit. a)',
    });
    expect(d.claimableTotal).toBe(lei(0));
    // The VAT is not lost to the world: it is a cost the PFA paid, and it reaches the expense base.
    expect(d.nonRecoverableTotal).toBe(TVA);
  });

  it('an undeclared registration is unresolved, never a silent zero and never a silent claim', () => {
    const d = decide({ registration: undefined });
    expect(outcome(d).kind).toBe('unresolved');
    expect(d.registrationDeclared).toBe(false);
    expect(d.claimableTotal).toBe(lei(0));
    expect(d.unresolved).toHaveLength(1);
    // `zero` is where a provision put a line. Nothing put this one anywhere, so it must not appear there.
    expect(d.zero).toHaveLength(0);
  });

  it('an annulled code carries no deduction for the annulled period', () => {
    const d = decide({ registration: { status: 'inregistrare_anulata' } });
    expect(outcome(d)).toMatchObject({
      kind: 'zero',
      reason: 'cod_anulat_perioada',
      rule: 'Norme pct. 11 alin. (6)',
    });
  });
});

describe('§6 rows 2-4 — the destination of the purchase', () => {
  it('a purchase used for taxable operations is claimed whole', () => {
    const d = decide();
    expect(outcome(d)).toEqual({
      kind: 'claimable',
      fraction: 1,
      rule: 'art. 297 alin. (4) lit. a); art. 300 alin. (3)',
    });
    expect(d.claimableTotal).toBe(TVA);
  });

  it('a purchase used for exempt operations without a right is zero on art. 300 alin. (4)', () => {
    const d = decide({
      expenses: [
        cleanLine({ vatFacts: { destination: 'scutita_fara_drept', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } }),
      ],
    });
    expect(outcome(d)).toMatchObject({ kind: 'zero', reason: 'destinatie_fara_drept', rule: 'art. 300 alin. (4)' });
    expect(d.claimableTotal).toBe(lei(0));
  });

  it('an undeclared destination is parked, not assumed taxable', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'unresolved', reason: 'destinatie_nedeclarata' });
    expect(d.unresolved).toHaveLength(1);
  });
});

describe('§6 rows 7-10 — the vehicle restriction, and its inverted evidence rule', () => {
  const car = (facts: Record<string, unknown>) => ({
    vehicles: [{ id: 'v1', years: [{ fiscalYear: 2026, ...facts }] }],
  });
  const carLine = cleanLine({ id: 'ev1', vehicleId: 'v1' });

  it('row 7: a mixed-use car is cut to 50 % and needs NO foaie de parcurs', () => {
    const d = decide({
      expenses: [carLine],
      ...car({ use: 'mixed' }),
    });
    expect(outcome(d)).toMatchObject({ kind: 'claimable', fraction: 0.5 });
    // Norme pct. 68 alin. (4): the 50 % branch is not the one that must be evidenced. The rule string
    // carries that, so the surface cannot present the cut as an unevidenced claim.
    expect((outcome(d) as { rule: string }).rule).toBe('art. 298 alin. (1); Norme pct. 68 alin. (4)');
    expect(d.claimableTotal).toBe(lei(500));
  });

  it('row 8: full deduction is the branch that needs the logbook', () => {
    const full = decide({ expenses: [carLine], ...car({ use: 'exclusive', logbook: 'da' }) });
    expect(outcome(full)).toMatchObject({
      kind: 'claimable',
      fraction: 1,
      rule: 'art. 298 alin. (4); Norme pct. 68 alin. (2)',
    });
    // Exclusive use claimed WITHOUT the logbook falls to the statutory 50 % — it is a settled figure,
    // not an unresolved line, because the 50 % branch asks for no evidence at all.
    const unevidenced = decide({ expenses: [carLine], ...car({ use: 'exclusive', logbook: 'nu' }) });
    expect(outcome(unevidenced)).toMatchObject({ kind: 'claimable', fraction: 0.5 });
    expect(unevidenced.unresolved).toHaveLength(0);
  });

  it('row 9: over 3.500 kg or over 9 seats the restriction does not apply at all', () => {
    expect(VAT_VEHICLE_MASS_KG_LIMIT).toBe(3500);
    expect(VAT_VEHICLE_SEATS_LIMIT).toBe(9);
    const heavy = decide({ expenses: [carLine], ...car({ use: 'mixed', massMaxKg: 4000 }) });
    expect(outcome(heavy)).toMatchObject({ kind: 'claimable', fraction: 1, rule: 'art. 298 alin. (2)' });
    const manySeats = decide({ expenses: [carLine], ...car({ use: 'mixed', seats: 12 }) });
    expect(outcome(manySeats)).toMatchObject({ kind: 'claimable', fraction: 1, rule: 'art. 298 alin. (2)' });
    // Exactly at the limit the restriction still bites — alin. (2) says „depășește" / „mai mult de".
    const atLimit = decide({ expenses: [carLine], ...car({ use: 'mixed', massMaxKg: 3500, seats: 9 }) });
    expect(outcome(atLimit)).toMatchObject({ kind: 'claimable', fraction: 0.5 });
  });

  it('row 10: a category vehicle is whole, including the VAT-only leasing category', () => {
    const d = decide({
      expenses: [carLine],
      ...car({ use: 'mixed', exceptionCategory: VAT_ONLY_VEHICLE_EXCEPTION }),
    });
    expect(outcome(d)).toMatchObject({ kind: 'claimable', fraction: 1, rule: 'art. 298 alin. (3)' });
  });

  it('acceptance 5: `not_used` is zero, not 50 %', () => {
    const d = decide({ expenses: [carLine], ...car({ use: 'not_used' }) });
    expect(outcome(d)).toMatchObject({ kind: 'zero', reason: 'vehicul_neutilizat', rule: 'art. 300 alin. (4)' });
    expect(d.claimableTotal).toBe(lei(0));
    // The distinction is load-bearing: a `mixed` car on the same facts would have claimed 500 bani.
    const mixed = decide({ expenses: [carLine], ...car({ use: 'mixed' }) });
    expect(mixed.claimableTotal).toBe(lei(500));
  });
});

describe('acceptance 4 — six VAT categories, five income-tax ones, never one list', () => {
  it('the VAT list has six members and the income-tax list has five', () => {
    expect(VAT_VEHICLE_EXCEPTION_VALUES).toHaveLength(6);
    expect(VEHICLE_EXCEPTION_CATEGORIES).toHaveLength(5);
  });

  it('the leasing category exists for VAT and not for income tax', () => {
    expect(VAT_VEHICLE_EXCEPTION_VALUES).toContain('inchiriere_sau_leasing');
    expect(VEHICLE_EXCEPTION_CATEGORIES).not.toContain(VAT_ONLY_VEHICLE_EXCEPTION);
    // art. 68 alin. (7) lit. k) merges rental into its own category 4 and never says „leasing financiar
    // ori operațional", so the two lists genuinely differ rather than being spelled differently.
    expect(VEHICLE_EXCEPTION_CATEGORIES).toContain('servicii_plata_inchiriere_instruire');
    expect(VAT_VEHICLE_EXCEPTION_VALUES).not.toContain('servicii_plata_inchiriere_instruire');
  });

  it('the two lists are different values, not one value with a second name', () => {
    expect(VAT_VEHICLE_EXCEPTION_VALUES).not.toEqual(VEHICLE_EXCEPTION_CATEGORIES);
  });
});

describe('§6 row 18 — alcohol and tobacco', () => {
  it('never deductible when not for resale', () => {
    const d = decide({
      expenses: [
        cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da', alcoholOrTobacco: 'da', forResale: 'nu' } }),
      ],
    });
    expect(outcome(d)).toMatchObject({ kind: 'zero', reason: 'alcool_tutun_fara_revanzare', rule: 'art. 297 alin. (7) lit. b)' });
  });

  it('the resale carve-out is real: the bar does not bite', () => {
    const d = decide({
      expenses: [
        cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da', alcoholOrTobacco: 'da', forResale: 'da' } }),
      ],
    });
    expect(outcome(d)).toMatchObject({ kind: 'claimable', fraction: 1 });
  });

  it('an unanswered resale question is parked, not read as "not for resale"', () => {
    const d = decide({
      expenses: [
        cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da', alcoholOrTobacco: 'da' } }),
      ],
    });
    expect(outcome(d).kind).toBe('unresolved');
  });
});

describe('§6 rows 22-23 — the supplier decides whether this invoice can ever support a claim', () => {
  it('VAT charged by an art. 310 supplier is never deductible, at no rate', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'scutit_art310', documentKind: 'factura', eFactura: 'da' } })],
    });
    expect(outcome(d)).toMatchObject({ kind: 'zero', reason: 'furnizor_art310' });
    expect(d.claimableTotal).toBe(lei(0));
  });

  it('a supplier whose code was annulled gives no deduction', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'cod_anulat', documentKind: 'factura', eFactura: 'da' } })],
    });
    expect(outcome(d)).toMatchObject({ kind: 'zero', reason: 'furnizor_cod_anulat', rule: 'art. 11 alin. (7)-(9)' });
  });
});

describe('acceptance 7 — unresolved lines leave the total and are listed', () => {
  it('§6 row 14: a domestic B2B invoice that never went through RO e-Factura is excluded and listed', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'nu' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'unresolved', reason: 'document_fara_e_factura' });
    expect(d.claimableTotal).toBe(lei(0));
    expect(d.unresolved.map((l) => l.id)).toEqual(['e1']);
    // The strict view is NOT encoded as a rule: the line is not `zero`, and it carries no provision.
    expect(d.zero).toHaveLength(0);
  });

  it('§6 row 5: an unknown pro rata parks a mixed-destination line instead of assuming 100 %', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'mixta', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'unresolved', reason: 'pro_rata_nedeclarat' });
    // With the ratio declared, the same line is decided — and the ratio, not a guess, sets the amount.
    const withRatio = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'mixta', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } })],
      proRataYears: [{ fiscalYear: 2026, percent: 40 }],
    });
    expect(outcome(withRatio)).toMatchObject({ kind: 'claimable', fraction: 0.4 });
    expect(withRatio.claimableTotal).toBe(lei(400));
  });

  it('§6 row 16: a 100-400 euro simplified invoice is contested and therefore parked', () => {
    const d = decide({
      expenses: [cleanLine({ vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'simplificata_100_400_eur' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'unresolved', reason: 'document_simplificata_100_400_eur' });
    expect(d.claimableTotal).toBe(lei(0));
  });

  it('§6 row 15: a simplified invoice under 100 euro needs the buyer code, and a pre-registration one does not', () => {
    const noCode = decide({
      expenses: [cleanLine({ tip: 'bon-fiscal', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'simplificata_sub_100_eur' } })],
    });
    expect(outcome(noCode)).toEqual({ kind: 'unresolved', reason: 'document_simplificata_fara_cod_cumparator' });

    const withCode = decide({
      expenses: [cleanLine({ tip: 'bon-fiscal', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'simplificata_sub_100_eur', buyerVatCodeOnDocument: 'da' } })],
    });
    expect(outcome(withCode)).toMatchObject({ kind: 'claimable', fraction: 1 });

    // Norme pct. 83 alin. (13): a pre-registration invoice need not carry the buyer's code. Rejecting
    // such a line for the missing code is itself the defect this case guards against.
    const preReg = decide({
      expenses: [cleanLine({ tip: 'bon-fiscal', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'simplificata_sub_100_eur', preRegistration: 'da' } })],
    });
    expect(outcome(preReg)).toMatchObject({ kind: 'claimable', fraction: 1 });
    expect(preReg.lines[0]!.preRegistrationAdjustment).toBe(true);
  });
});

describe('acceptance 6 — TVA la încasare defers in BOTH directions, keyed on Expense.paid', () => {
  const unpaid = cleanLine({ paid: undefined });

  it("the PFA's own scheme defers until the supplier is paid (art. 297 alin. (3))", () => {
    const d = decide({ registration: { ...REGISTERED, cashAccounting: 'da' }, expenses: [unpaid] });
    expect(outcome(d)).toEqual({ kind: 'deferred', reason: 'plata_ammnata_regim_propriu' });
    expect(d.claimableTotal).toBe(lei(0));
    // Deferred is its own state: not zero (nothing denied it) and not unresolved (nothing is unknown).
    expect(d.zero).toHaveLength(0);
    expect(d.unresolved).toHaveLength(0);
    expect(d.deferred).toHaveLength(1);
  });

  it("the SUPPLIER's scheme defers too (art. 297 alin. (2)) — the half that overstates a claim when missed", () => {
    const d = decide({
      // The PFA is NOT in the scheme; only the supplier is.
      registration: { ...REGISTERED, cashAccounting: 'nu' },
      expenses: [cleanLine({ paid: undefined, vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da', supplierCashAccounting: 'da' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'deferred', reason: 'plata_ammnata_furnizor' });
    expect(d.claimableTotal).toBe(lei(0));
  });

  it('paying the invoice lifts the deferral, and a payment after the as-of date does not', () => {
    const paid = decide({ registration: { ...REGISTERED, cashAccounting: 'da' }, expenses: [cleanLine({ paid: '2026-03-20' })] });
    expect(outcome(paid)).toMatchObject({ kind: 'claimable', fraction: 1 });

    const paidLater = decide({
      registration: { ...REGISTERED, cashAccounting: 'da' },
      expenses: [cleanLine({ paid: '2026-06-01' })],
      asOfDate: '2026-05-31',
    });
    expect(outcome(paidLater).kind).toBe('deferred');
  });

  it('import, AIC and reverse charge are outside the deferral', () => {
    const d = decide({
      registration: { ...REGISTERED, cashAccounting: 'da' },
      expenses: [cleanLine({ paid: undefined, vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'vamal_sau_autofactura' } })],
    });
    expect(outcome(d)).toMatchObject({ kind: 'claimable', fraction: 1 });
  });
});

describe('§6 row 20 — the capital-good clawback, and the vehicle exception that withholds it', () => {
  it('a movable capital good adjusts over five years, an immovable over twenty', () => {
    expect(capitalGoodClawback({ isCapitalGood: true, immovable: false, alreadyUnderFiftyPercentArt298: false })).toEqual({
      years: 5,
      annualShare: expect.anything(),
    });
    expect(capitalGoodClawback({ isCapitalGood: true, immovable: true, alreadyUnderFiftyPercentArt298: false })!.years).toBe(20);
  });

  it('a vehicle already under the art. 298 50 % limit is NOT clawed back', () => {
    // art. 305 alin. (4) lit. a) pct. 1 withholds the adjustment here. Encoding it anyway would invent
    // an adjustment the law expressly does not allow.
    expect(capitalGoodClawback({ isCapitalGood: true, immovable: false, alreadyUnderFiftyPercentArt298: true })).toBeNull();
  });

  it('a non-capital good is not adjusted on the capital-good schedule at all', () => {
    expect(capitalGoodClawback({ isCapitalGood: false, immovable: false, alreadyUnderFiftyPercentArt298: false })).toBeNull();
  });
});

describe('art. 316 alin. (1¹) — the effective date, and the exceedance date already on the profile', () => {
  it('the plafon case uses vatExceedanceDate rather than duplicating it', () => {
    const d = registrationEffectiveDate({ status: 'plafon_depasit' }, '2026-04-15');
    expect(d).toEqual({ date: '2026-04-15', basis: expect.stringContaining('art. 316 alin. (1¹) lit. b)') });
  });

  it('a state with no date recorded produces no date, not a guessed one', () => {
    expect(registrationEffectiveDate({ status: 'inregistrat_art316' }, undefined)).toBeNull();
  });

  it('a purchase before the effective date is flagged as an adjustment, not denied', () => {
    const d = decide({
      registration: { status: 'plafon_depasit' },
      vatExceedanceDate: '2026-06-01',
      expenses: [cleanLine({ date: '2026-02-01' })],
    });
    expect(outcome(d)).toMatchObject({ kind: 'claimable', fraction: 1 });
    expect(d.lines[0]!.preRegistrationAdjustment).toBe(true);
  });
});

describe('the totals', () => {
  it('unresolved and deferred lines leave the claimable total; claimable ones enter it at their fraction', () => {
    const d = decide({
      expenses: [
        cleanLine({ id: 'ok', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } }),
        cleanLine({ id: 'half', vehicleId: 'v1', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } }),
        cleanLine({ id: 'noef', vatFacts: { destination: 'taxabila', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'nu' } }),
        cleanLine({ id: 'zero', vatFacts: { destination: 'scutita_fara_drept', supplierRegime: 'inregistrat', documentKind: 'factura', eFactura: 'da' } }),
      ],
      vehicles: [{ id: 'v1', years: [{ fiscalYear: 2026, use: 'mixed' as const }] }],
    });
    // 1.000 whole + 500 from the 50 % car; the e-Factura-less line and the zero line add nothing.
    expect(d.claimableTotal).toBe(lei(1500));
    expect(d.unresolved.map((l) => l.id)).toEqual(['noef']);
    expect(d.zero.map((l) => l.id)).toEqual(['zero']);
    // B-114 changed what this total means, and this case shows all four outcomes at once. The zero line's
    // whole 1.000 lei plus the 50 % car's denied half of 500 lei = 1.500 lei. The e-Factura-less line
    // contributes nothing: its recoverability is undecided, so counting its VAT as lost would mint a
    // non-recoverable amount the person may still claim once a compliant e-Factura exists
    // (art. 301 alin. (2)). That exclusion is why the figure is not `sum(tvaBani) − claimableTotal`,
    // which here would read 2.500 lei.
    expect(d.nonRecoverableTotal).toBe(lei(1500));
    expect(subBani(sumBani(d.lines.map((l) => l.tvaBani)), d.claimableTotal)).toBe(lei(2500));
  });

  it('a foreign-currency line is unresolved rather than summed at an unstamped rate', () => {
    const d = decide({
      expenses: [cleanLine({ tva: { amount: 1000 as Bani, currency: 'EUR' } })],
    });
    expect(outcome(d)).toEqual({ kind: 'unresolved', reason: 'record_neconvertit' });
    expect(d.claimableTotal).toBe(lei(0));
  });
});
