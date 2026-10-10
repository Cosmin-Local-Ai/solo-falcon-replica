import { describe, it, expect } from 'vitest';
import { buildRjipRegister, rjipCsv } from './Documents';
import { lei, type Bani } from '../domain/money';
import { seedData } from '../data/seed';
import type { AppData, Expense, Revenue } from '../data/types';

/**
 * Phase 10 — an exported register is a screen. The RJIP cashflow CSV used to build its money cells with
 * `value.toFixed(2).replace('.', ',')` on a value that is now **bani**, so a 142,50 lei invoice exported
 * as `14250,00`. Nothing else in the suite reads the exported bytes, so nothing caught it.
 */
describe('RJIP CSV export — money is rendered, not dumped', () => {
  const rows = [
    { data: '2026-01-15', descriere: 'Factură F1 – Client', venit: lei(142.5), cheltuiala: 0 as Bani },
    { data: '2026-02-03', descriere: 'Bon fiscal B9 – Furnizor', venit: 0 as Bani, cheltuiala: lei(85.5) },
  ];

  it('writes lei with two decimals, never the raw ban count', () => {
    const csv = rjipCsv(rows);
    expect(csv).toContain('142,50');
    expect(csv).toContain('85,50');
    expect(csv).not.toContain('14250');
    expect(csv).not.toContain('8550');
  });

  it('keeps the semicolon separator, the comma decimal and the BOM Excel needs', () => {
    const lines = rjipCsv(rows).split('\r\n');
    expect(lines[0]).toBe('\uFEFFData;Descriere;Venit (RON);Cheltuiala (RON)');
    expect(lines).toHaveLength(3);
    expect(lines[1]!.split(';')).toHaveLength(4);
  });

  it('escapes a description that contains a quote', () => {
    const csv = rjipCsv([{ ...rows[0], descriere: 'Factură "A" – Client' }]);
    expect(csv).toContain('"Factură ""A"" – Client"');
  });

  it('sums a large register without float drift before rendering', () => {
    const many = Array.from({ length: 10_000 }, () => rows[0]);
    const csv = rjipCsv(many);
    // 10 000 × 142,50 lei = 1 425 000,00 lei exactly. In float lei this is where the cents start to lie.
    const cells = rjipCsv(many)
      .split('\r\n')
      .slice(1)
      .map((line) => line.split(';').slice(2));
    expect(cells).toHaveLength(10_000);
    expect(new Set(cells.flat())).toEqual(new Set(['142,50', '0,00']));
  });
});

/**
 * PG-2 (B-66, B-70) — which date the register posts on, and which lei amounts it may hold.
 *
 * OMFP 170/2015 cap. V: the RJIP is kept „în funcție de data efectuării operațiunii de încasare/plată",
 * and its mandatory information list opens with that date. Before PG-2 this export filtered the year with
 * `date.slice(0, 4)` and stamped the row with the document date, never reading `collected` / `paid` — so a
 * sum collected on 10 Jan 2027 was exported into the **2026** register, under a date on which nothing was
 * collected. An exported register is a document the tax office reads; these tests exist so it cannot
 * quietly go back.
 *
 * The leu amounts come from `getLedgerDisclosure`, the same pass the dashboard's totals read (B-70): a
 * foreign record that a recorded BNR rate converted belongs in the leu register at its lei amount, and one
 * with no rate does not belong there at all.
 */
function payload(over: Partial<AppData>): AppData {
  return { ...seedData, ...over };
}

/** The EUR row research 23 captured from BNR for 2026-10-08 — a real published figure. */
const EUR_DAILY_2026_10_08 = {
  currency: 'EUR' as const,
  rate: '5.3470',
  rateKind: 'daily_reference' as const,
  rateDate: '2026-10-08',
  seriesCode: 'CURSZ_EUR',
  sourceUrl: 'https://curs.bnr.ro/nbrfxrates.xml',
  fetchedAt: '2026-10-08T13:05:00Z',
  provisional: false,
  entryMode: 'fetched' as const,
};

function revenue(over: Partial<Revenue>): Revenue {
  return {
    id: 'rjip-rev',
    tip: 'factura',
    nr: 'FCT-RJIP-001',
    date: '2026-12-20',
    client: 'Presta Consulting SRL',
    cui: 'RO12345678',
    valoareFaraTva: { amount: 100000 as Bani, currency: 'RON' },
    tva: { amount: 20000 as Bani, currency: 'RON' },
    status: 'inregistrata',
    ...over,
  };
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'rjip-exp',
    tip: 'factura',
    nr: 'FCT-RJIP-002',
    date: '2026-12-30',
    furnizor: 'CloudHost SRL',
    cui: 'RO87654321',
    valoareFaraTva: { amount: 50000 as Bani, currency: 'RON' },
    tva: { amount: 10000 as Bani, currency: 'RON' },
    status: 'inregistrata',
    category: 'postal_and_telecom',
    ...over,
  };
}

describe('RJIP register — it posts on the money date (B-66)', () => {
  it('a collection on 10 Jan 2027 is exported into the 2027 register, under 10 Jan 2027', () => {
    const data = payload({ revenues: [revenue({ collected: '2027-01-10' })], expenses: [] });
    const register = buildRjipRegister(data, 2027);
    const row = register.rows.find(r => r.descriere.includes('FCT-RJIP-001'));
    expect(row?.data).toBe('2027-01-10');
    expect(row?.venit).toBe(lei(1200));
    // The exported bytes, not only the row object — this is the artefact the tax office reads.
    const csv = rjipCsv(register.rows);
    expect(csv).toContain('2027-01-10;');
    expect(csv).toContain('1.200,00');
    expect(csv).not.toContain('2026-12-20');
  });

  it('the same record is no longer in the 2026 register it used to be exported into', () => {
    const data = payload({ revenues: [revenue({ collected: '2027-01-10' })], expenses: [] });
    expect(buildRjipRegister(data, 2026).rows.some(r => r.descriere.includes('FCT-RJIP-001'))).toBe(false);
  });

  it('an expense paid on 12 Jan 2027 is in the 2027 register, not the 2026 one', () => {
    const data = payload({ revenues: [], expenses: [expense({ paid: '2027-01-12' })] });
    const row2027 = buildRjipRegister(data, 2027).rows.find(r => r.descriere.includes('FCT-RJIP-002'));
    expect(row2027?.data).toBe('2027-01-12');
    expect(row2027?.cheltuiala).toBe(lei(600));
    expect(buildRjipRegister(data, 2026).rows.some(r => r.descriere.includes('FCT-RJIP-002'))).toBe(false);
  });

  it('a record with no money date is posted on the document date, and the register counts how many were', () => {
    const data = payload({
      revenues: [
        revenue({ id: 'rjip-rev-a' }),
        revenue({ id: 'rjip-rev-b', nr: 'FCT-RJIP-009', collected: '2026-12-28' }),
      ],
      expenses: [],
    });
    const register = buildRjipRegister(data, 2026);
    expect(register.rows.find(r => r.descriere.includes('FCT-RJIP-001'))?.data).toBe('2026-12-20');
    // One rests on the document date; the other has a collection date of its own.
    expect(register.postedOnDocumentDate).toBe(1);
  });

  it('a converted foreign record enters at its lei amount — the ledger decides, not a local isRon filter (B-70)', () => {
    const data = payload({
      revenues: [],
      expenses: [
        expense({
          paid: '2026-10-08',
          valoareFaraTva: { amount: 100000 as Bani, currency: 'EUR' },
          tva: { amount: 0 as Bani, currency: 'EUR' },
        }),
      ],
      fxRates: [EUR_DAILY_2026_10_08],
    });
    const register = buildRjipRegister(data, 2026);
    const row = register.rows.find(r => r.descriere.includes('FCT-RJIP-002'));
    // 1 000,00 EUR at the published 5,3470 lei/EUR of 2026-10-08 — the same lei figure the totals use.
    expect(row?.cheltuiala).toBe(lei(5347));
    expect(register.unconverted).toBe(0);
  });

  it('a foreign record with no rate stays out of the leu register, and is counted rather than hidden', () => {
    const data = payload({
      revenues: [],
      expenses: [
        expense({
          valoareFaraTva: { amount: 100000 as Bani, currency: 'EUR' },
          tva: { amount: 0 as Bani, currency: 'EUR' },
        }),
      ],
      fxRates: [],
    });
    const register = buildRjipRegister(data, 2026);
    expect(register.rows.some(r => r.descriere.includes('FCT-RJIP-002'))).toBe(false);
    expect(register.unconverted).toBe(1);
  });

  it('rows are ordered by the money date, which is the column the chronology is defined on', () => {
    const data = payload({
      revenues: [
        revenue({ id: 'rjip-rev-late', nr: 'FCT-RJIP-003', date: '2026-01-05', collected: '2026-09-30' }),
        revenue({ id: 'rjip-rev-early', nr: 'FCT-RJIP-004', date: '2026-09-01', collected: '2026-02-11' }),
      ],
      expenses: [],
    });
    expect(buildRjipRegister(data, 2026).rows.map(r => r.data)).toEqual(['2026-02-11', '2026-09-30']);
  });
});
