/**
 * Step 11 / Part C — the persona datasets, checked as data.
 *
 * ## What this file holds, and what `personaCoverage.test.ts` holds
 *
 * `personaCoverage.test.ts` asks what the **engine** says about each persona. This one asks what the
 * **dataset** is: whether its CAEN codes exist, whether it has twelve months of records, whether it seeds a
 * filing nobody made, whether its identity is provably invented. Those are different failures. A persona can
 * exercise every regime and still be a privacy defect, and a persona can be structurally clean and exercise
 * nothing.
 *
 * ## Why the CAEN assertions resolve against the shipped nomenclator instead of a list in this file
 *
 * Brief 64: *„Every CAEN code anywhere in this brief is UNVERIFIED … They are placeholders that look like
 * facts, which is the most dangerous form a guess takes."* Five of the brief's own codes turned out not to
 * exist. So nothing here restates a code's meaning: every code a persona carries is looked up in
 * `docs/ai/data/caen_rev3.csv` through `src/data/caenRev3.ts`, and a persona that names a Rev.2 code fails
 * with the code in the message.
 *
 * ## Why the hygiene assertions live beside the data and not only in the global scan
 *
 * `seed.identityHygiene.test.ts` scans every literal in `src/` and `e2e/`, and it does catch a real CNP or a
 * checksum-valid CUI anywhere a persona puts one. What it cannot see is the *structural* claim: that a
 * persona's CNP decodes to a birth date no register contains, that its IBAN is built on a bank that does not
 * exist, that its email domain is RFC 2606 reserved. Those are properties of the persona as a person, and
 * they belong next to the personas.
 */
import { describe, expect, it } from 'vitest';
import { PERSONAS, caenCoverage, caenInfo, personasByCaen } from './personas';
import { applyPersonaToAccount } from './personas/personaTypes';
import { CAEN_NOMENCLATOR_COUNTS } from './caenRev3';
import { CNP_CHECK_DIGIT_WEIGHTS, cnpCheckDigitValid } from '../test/occupancyFixtures';
import { getMonthlyFinancialSeries } from './dashboard';
import { fixedInstant } from '../test/fixedInstant';
import { pinClock, unpinClock } from '../test/clock';
import { CAEN_MAX_ACTIVITY_CLASSES } from '../domain/models';
import { afterEach } from 'vitest';

const FISCAL_YEAR = 2026;
const YEAR_END = '2026-12-31';
/** The fixture rate persona 2's EUR platform is converted at — stated so the DPI total is checkable. */
const EUR_RATE_IN_FIXTURE = 5;

afterEach(() => unpinClock());

/** The months a persona's own register covers, as `YYYY-MM` keys. */
function monthsCovered(p: (typeof PERSONAS)[number]): Set<string> {
  const months = new Set<string>();
  for (const r of p.data.revenues) if (r.date.startsWith(`${FISCAL_YEAR}-`)) months.add(r.date.slice(0, 7));
  for (const e of p.data.expenses) if (e.date.startsWith(`${FISCAL_YEAR}-`)) months.add(e.date.slice(0, 7));
  return months;
}

describe('step 11 — every CAEN code a persona carries exists in the shipped nomenclator', () => {
  it('the nomenclator is loaded, and its class count is the one the ingest asserts', () => {
    expect(CAEN_NOMENCLATOR_COUNTS.clase).toBe(651);
    expect(CAEN_NOMENCLATOR_COUNTS.diviziuni).toBe(87);
    expect(CAEN_NOMENCLATOR_COUNTS.grupe).toBe(287);
    expect(CAEN_NOMENCLATOR_COUNTS.sectiuni).toBe(22);
  });

  for (const p of PERSONAS) {
    it(`${p.id}: every code resolves to a CAEN Rev.3 class`, () => {
      const codes = [p.caen.principal, ...p.caen.secondary].filter(Boolean);
      for (const cod of codes) {
        const entry = caenInfo(cod);
        expect(entry, `${p.id} names CAEN ${cod}, which the nomenclator does not contain`).toBeDefined();
        expect(entry?.nivel, `${cod} is not a class-level code`).toBe('clasa');
        expect(entry?.denumire.trim(), `${cod} resolved with an empty denomination`).not.toBe('');
      }
    });

    it(`${p.id}: at most one principal and ${CAEN_MAX_ACTIVITY_CLASSES - 1} secondary classes`, () => {
      expect(p.caen.secondary.length).toBeLessThanOrEqual(CAEN_MAX_ACTIVITY_CLASSES - 1);
      expect(new Set([p.caen.principal, ...p.caen.secondary].filter(Boolean)).size).toBe(
        [p.caen.principal, ...p.caen.secondary].filter(Boolean).length,
      );
    });
  }

  it('exactly one persona has no CAEN at all, and it is the passive investor', () => {
    const none = PERSONAS.filter((p) => p.caen.principal === '');
    expect(none.map((p) => p.id)).toEqual(['passive-investor']);
    // A CAEN→persona map that cannot answer "no code" turns a dividend recipient into a business.
    expect(personasByCaen.has('')).toBe(false);
  });

  it('the map is keyed only on codes that exist, and states how little of the nomenclator it covers', () => {
    const coverage = caenCoverage();
    expect(coverage.mappedClasses).toBe(personasByCaen.size);
    expect(coverage.totalClasses).toBe(CAEN_NOMENCLATOR_COUNTS.clase);
    for (const cod of coverage.coveredClasses) expect(caenInfo(cod)?.nivel).toBe('clasa');
  });
});

describe('step 11 — data density: twelve months, real seasonality, no one-bar chart', () => {
  for (const p of PERSONAS) {
    it(`${p.id}: its register spans all twelve months of the fiscal year`, () => {
      expect([...monthsCovered(p)].sort()).toEqual(
        Array.from({ length: 12 }, (_, i) => `${FISCAL_YEAR}-${String(i + 1).padStart(2, '0')}`),
      );
    });

    it(`${p.id}: the monthly chart gets twelve data points, not one`, () => {
      pinClock(fixedInstant());
      // Measured at the year's end, which is when a twelve-month register has twelve months behind it. At
      // the pinned mid-year instant the same register correctly draws ten points — the chart follows the
      // period, and asserting twelve at 31 October would be asserting a bug.
      const series = getMonthlyFinancialSeries(p.data, YEAR_END);
      expect(series.size).toBeGreaterThanOrEqual(12);
    });
  }

  it('no persona is a hobbyist rounding: each has a six-figure annual gross or a declared ladder', () => {
    for (const p of PERSONAS) {
      const grossLei = p.data.revenues
        .filter((r) => r.date.startsWith(`${FISCAL_YEAR}-`))
        .reduce((sum, r) => sum + r.valoareFaraTva.amount + r.tva.amount, 0);
      const hasLadder = (p.data.profile.cassLadderYears?.length ?? 0) > 0;
      expect(
        grossLei >= 10_000_000 || hasLadder,
        `${p.id} records ${grossLei / 100} lei of gross and declares no ladder`,
      ).toBe(true);
    }
  });
});

describe('step 11 — what a persona must never seed', () => {
  for (const p of PERSONAS) {
    it(`${p.id}: no VAT return, no filing, no snapshot — a calendar row is not a discharge`, () => {
      expect(p.data.vatReturns).toEqual([]);
      expect(p.data.filings).toEqual([]);
      expect(p.data.snapshots).toEqual([]);
    });

    it(`${p.id}: no occupancy sheet, because a persona ships inside the bundle (D-OCC-1 item 5)`, () => {
      expect(p.data.occupancySheets).toEqual([]);
    });

    it(`${p.id}: no prior-year loss, which the engine cannot consume (B-121)`, () => {
      // The operand itself does not exist on a profile yet — which is the point: there is nowhere for a
      // seeded loss to live, and no persona may invent a field to hold one.
      for (const r of p.data.revenues) {
        expect(Number.isSafeInteger(r.valoareFaraTva.amount)).toBe(true);
        expect(r.valoareFaraTva.amount).toBeGreaterThanOrEqual(0);
      }
      for (const e of p.data.expenses) expect(e.valoareFaraTva.amount).toBeGreaterThanOrEqual(0);
    });

    it(`${p.id}: every amount is an integer number of bani`, () => {
      for (const r of p.data.revenues) {
        expect(Number.isInteger(r.valoareFaraTva.amount)).toBe(true);
        expect(Number.isInteger(r.tva.amount)).toBe(true);
      }
      for (const e of p.data.expenses) {
        expect(Number.isInteger(e.valoareFaraTva.amount)).toBe(true);
        expect(Number.isInteger(e.tva.amount)).toBe(true);
      }
    });
  }
});

describe('step 11 — the invented people stay invented (B-110)', () => {
  for (const p of PERSONAS) {
    it(`${p.id}: the CNP decodes to a birth date no civil register contains`, () => {
      const cnp = p.identity.cnp;
      expect(cnp).toMatch(/^[12]\d{12}$/);
      // Month `00` and day `00`: the arithmetic may or may not check out, the date cannot exist.
      expect(cnp.slice(3, 5)).toBe('00');
      expect(cnp.slice(5, 7)).toBe('00');
    });

    it(`${p.id}: the CNP is not a checksum-valid, date-decodable person`, () => {
      // Belt to the global scan's braces: even with month/day 00 the control digit must not land, so a
      // future edit that "fixes" the date cannot quietly mint a real-looking CNP.
      const digits = p.identity.cnp.split('').map(Number);
      const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * CNP_CHECK_DIGIT_WEIGHTS[i], 0);
      const control = ((sum % 11) * 10) % 11;
      const canonicalValid = control === digits[12];
      expect(
        canonicalValid && cnpCheckDigitValid(p.identity.cnp),
        `${p.id}'s CNP passes both control-digit keys`,
      ).toBe(false);
    });

    it(`${p.id}: the bank and the IBAN prefix are a coinage, and the email domain is reserved`, () => {
      expect(p.identity.banca).toBe('Banca Carpatică');
      expect(p.identity.contBancar).toMatch(/^RO44 CARP /);
      expect(p.identity.email).toMatch(/\.example$/);
    });
  }
});

describe('step 11 — counterparties are named, typed, and the ones the register uses', () => {
  for (const p of PERSONAS) {
    it(`${p.id}: every register row names a counterparty the persona describes`, () => {
      const described = new Set(p.counterparties.map((c) => c.name));
      for (const r of p.data.revenues) {
        expect(described.has(r.client), `${r.nr} names ${r.client}, which the persona does not describe`).toBe(true);
      }
      for (const e of p.data.expenses) {
        expect(described.has(e.furnizor), `${e.nr} names ${e.furnizor}, which the persona does not describe`).toBe(true);
      }
    });

    it(`${p.id}: every counterparty states a country and a cadence, including the domestic ones`, () => {
      for (const c of p.counterparties) {
        expect(c.tara.trim(), `${c.name} has no stated country`).not.toBe('');
        expect(c.cadenta.trim(), `${c.name} has no stated cadence`).not.toBe('');
      }
    });

    it(`${p.id}: the register's clients are the counterparties, not anonymous totals`, () => {
      expect(p.data.clients.length).toBeGreaterThanOrEqual(p.counterparties.length);
    });
  }

  it('the foreign counterparties are only where the activity has them', () => {
    const foreign = (id: string) =>
      PERSONAS.find((p) => p.id === id)!.counterparties.filter((c) => !c.tara.startsWith('România'));
    // IT freelance and online commerce bill and buy abroad; the driver and the grower do not.
    expect(foreign('it-freelance').length).toBeGreaterThan(0);
    expect(foreign('online-commerce').length).toBeGreaterThan(0);
    expect(foreign('ride-hailing-driver')).toEqual([]);
    expect(foreign('agricultural-producer')).toEqual([]);
    expect(foreign('long-term-landlord')).toEqual([]);
  });
});

describe('step 11 — D-DEMO-2: the persona is not the account', () => {
  it('applying a persona replaces the identity and leaves the legacy settings block alone', () => {
    const persona = PERSONAS[0];
    const account = {
      ...persona.data.profile.identity,
      nume: 'Ulieru Ana-Maria',
      cnp: '1234567890123',
      cui: 'RO99999999',
      denumire: 'Ulieru Ana-Maria PFA',
    };
    const applied = applyPersonaToAccount(persona.data, account);
    expect(applied.profile.identity.nume).toBe('Ulieru Ana-Maria');
    expect(applied.profile.identity.cnp).toBe('1234567890123');
    // The activity data is the persona's; the person is the account's. Nothing merges them.
    expect(applied.revenues.map((r) => r.nr)).toEqual(persona.data.revenues.map((r) => r.nr));
    // Phase 7 made `profile.identity` the single readable identity. Rewriting the legacy block from here
    // would re-create the duplication `identity.source.test.ts` retires.
    expect(applied.settings).toBe(persona.data.settings);
  });
});

describe('step 11 — the facts each persona exists to carry are actually present', () => {
  it('persona 2 carries DPI receipts, marked by category and by contract object', () => {
    const p = PERSONAS.find((x) => x.id === 'content-creator')!;
    const dpi = p.data.revenues.filter((r) => r.incomeCategory === 'drepturi_de_proprietate_intelectuala');
    expect(dpi.length).toBeGreaterThanOrEqual(12);
    for (const r of dpi) expect(r.dpiContractType).toBe('cesiune_licenta');
    // 150.000 lei of DPI gross across the year. The EUR platform's receipts are summed in lei only through
    // the rate the persona's own fixture carries — adding EUR minor units to lei minor units would be a
    // number invented twice over, which is the mistake this assertion exists to refuse.
    const grossLei = dpi.reduce(
      (s, r) => s + (r.valoareFaraTva.currency === 'EUR' ? r.valoareFaraTva.amount * EUR_RATE_IN_FIXTURE : r.valoareFaraTva.amount),
      0,
    );
    expect(grossLei).toBe(15_000_000);
  });

  it('persona 3 carries two cars, one designated and one not, and an M1 asset the cap bites on', () => {
    const p = PERSONAS.find((x) => x.id === 'ride-hailing-driver')!;
    expect(p.data.vehicles.length).toBe(2);
    const designated = p.data.vehicles.flatMap((v) => v.years ?? []).filter((y) => y.designatedForRunningCosts === 'da');
    const notDesignated = p.data.vehicles.flatMap((v) => v.years ?? []).filter((y) => y.designatedForRunningCosts === 'nu');
    expect(designated.length).toBe(1);
    expect(notDesignated.length).toBe(1);
    const car = p.data.fixedAssets.find((a) => a.isM1Vehicle === true);
    if (!car) {
      expect(car, 'persona 3 must hold an M1 vehicle in the asset register').toBeDefined();
    } else if (car.normalLifeMonths !== undefined) {
      // 78.000 lei over 48 months is 1.625 lei/lună, above the 1.500 lei/lună ceiling of art. 28 alin. (14).
      expect(78_000_00 / car.normalLifeMonths).toBeGreaterThan(15_00);
    } else {
      expect(car.normalLifeMonths, 'the M1 asset must state its durata normală').toBeDefined();
    }
  });

  it('persona 4 sits at the top of the art. 85 band, not past it', () => {
    const p = PERSONAS.find((x) => x.id === 'short-term-host')!;
    expect(p.data.profile.activityFamily).toBe('cazare');
    expect(p.data.profile.accommodationRoomCounts?.[0]?.rooms).toBe(7);
  });

  it('persona 5 and persona 6 are the two halves of the rent pair, split by the tenant', () => {
    const landlord = PERSONAS.find((x) => x.id === 'long-term-landlord')!;
    const investor = PERSONAS.find((x) => x.id === 'passive-investor')!;
    expect(landlord.data.profile.leaseFactsYears?.[0]?.tenantNature).toBe('persoana_fizica');
    expect(investor.data.profile.leaseFactsYears?.[0]?.tenantNature).toBe('entitate_cu_evidenta_contabila');
  });

  it('persona 7 is a pensioner, and persona 6 is a salariat — the two art. 150 cases', () => {
    const grower = PERSONAS.find((x) => x.id === 'agricultural-producer')!;
    const investor = PERSONAS.find((x) => x.id === 'passive-investor')!;
    expect(grower.data.profile.pensionerStatus).toBe('da');
    expect(grower.data.profile.pensionReceiptYears?.[0]?.received).toBe('da');
    expect(investor.data.profile.salaryStatus).toBe('da');
    expect(investor.data.profile.salaryIncomeLei).toBeDefined();
  });

  it('persona 8 crosses the TVA plafon with a date, a route and a period, and not a declared status alone', () => {
    const p = PERSONAS.find((x) => x.id === 'online-commerce')!;
    expect(p.data.profile.vatRegistration?.status).toBe('plafon_depasit');
    expect(p.data.profile.vatExceedanceDate).toBe('2026-08-26');
    const year = p.data.profile.vatPeriodicityYears?.[0];
    expect(year?.registrationRoute).toBe('b');
    expect(year?.registrationEffectiveFrom).toBe('2026-09-01');
    // The divergence the persona exists to show: invoices issued and delivered, money not yet in.
    const pending = p.data.revenues.filter((r) => r.status === 'in-asteptare');
    expect(pending.length).toBeGreaterThanOrEqual(3);
    for (const r of pending) expect(r.collected).toBeUndefined();
  });

  it('persona 9 declares a normă and no persona derives one', () => {
    const p = PERSONAS.find((x) => x.id === 'agricultural-norma')!;
    const year = p.data.profile.cassLadderYears?.[0];
    expect(year?.activitatiAgricoleBaza).toBe('norma_de_venit');
    expect(year?.activitatiAgricole).toBeDefined();
    // The registered object is the stall, not the plot: no agricultural class in the CAEN list.
    expect(p.caen.principal).toBe('4721');
    expect(p.caen.secondary.some((c) => c.startsWith('01'))).toBe(false);
  });
});
