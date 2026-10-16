/**
 * Phase 11 / PG-3 — the fixture is a 2026 PFA, and the first run is empty.
 *
 * These are structural assertions, not figure assertions: the point of the phase is that the demo dataset
 * stopped being a coherent-looking contradiction (a 2020-start PFA with a 2025 return and six September
 * invoices) and became one the calendar agrees with. Every rule below is a claim the seed now makes, and
 * each one is cheap to break by editing a date, so each one is pinned.
 */
import { describe, expect, it } from 'vitest';
import { emptyData, seedData } from './seed';
import { isoCalendarDateProblem } from '../domain/date';

describe('seedData — the fixture is a 2026 PFA (PG-3)', () => {
  it('starts in 2026, with a real start date behind the start year', () => {
    expect(seedData.profile.pfaStartYear).toBe(2026);
    expect(seedData.profile.pfaStartDate).toBeDefined();
    expect(isoCalendarDateProblem(seedData.profile.pfaStartDate!)).toBeNull();
    expect(seedData.profile.pfaStartDate!.slice(0, 4)).toBe('2026');
    // `pfaStartYear` and `pfaStartDate` must not disagree — a year with a date from another year behind
    // it is the half-fact B-47 was.
    expect(seedData.profile.pfaStartYear).toBe(Number(seedData.profile.pfaStartDate!.slice(0, 4)));
  });

  it('records every document on or after its own start date', () => {
    const start = seedData.profile.pfaStartDate!;
    const dated = [
      ...seedData.revenues.map(r => ['revenue ' + r.id, r.date] as const),
      ...seedData.expenses.map(e => ['expense ' + e.id, e.date] as const),
      ...seedData.documents.map(d => ['document ' + d.id, d.data] as const),
      ...Object.entries(seedData.companyDocs).flatMap(([code, docs]) =>
        docs.map(d => [`companyDoc ${code}/${d.id}`, d.data] as const),
      ),
    ];
    expect(dated.length).toBeGreaterThan(0);
    for (const [label, date] of dated) {
      expect(isoCalendarDateProblem(date), `${label} carries a malformed date`).toBeNull();
      expect(date >= start, `${label} is dated ${date}, before the PFA started on ${start}`).toBe(true);
    }
  });

  it('spreads its transactions across the year instead of one month', () => {
    const months = new Set(seedData.revenues.map(r => r.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(3);
  });

  it('holds no prior-year filing, in any of the three places one could sit', () => {
    // A PFA that started in 2026 has no prior income year. A 2025 return is not a record it could hold.
    // PG-5: `filings` is the annual-return register, and it is empty for the same reason — the seed
    // cannot claim a Declarația Unică for 2025 that no source records. PG-5b: the monthly family is gone
    // from the dataset entirely, not merely empty in it — TASK 9 removed the three rows that asserted a
    // monthly cadence this profile does not have, and the record type followed them out.
    expect(seedData.filings).toEqual([]);
    expect('legacyDeclarations' in seedData).toBe(false);
    expect(seedData.statements.filter(s => /^\d{4}$/.test(s.perioada) && Number(s.perioada) < 2026)).toEqual([]);
    expect(seedData.companyDocs.im).toEqual([]);
    expect(seedData.companyDocs.cs).toEqual([]);
    const named = [
      ...seedData.documents.map(d => d.nume),
      ...Object.values(seedData.companyDocs).flat().map(d => d.nume),
      ...seedData.statements.map(s => `${s.tip}/${s.perioada}`),
    ];
    for (const name of named) {
      expect(name, `${name} is a prior-year filing`).not.toMatch(/anului 20\d\d/);
    }
  });

  it('holds no SRL remnant in the identity or the legacy settings block', () => {
    expect(seedData.profile.identity.formaJuridica).toBe('Persoană fizică autorizată');
    expect(seedData.profile.identity.denumire).not.toContain('SRL');
    expect(seedData.settings.company.formaJuridica).toBe('Persoană fizică autorizată');
    expect(seedData.settings.company.denumire).not.toContain('SRL');
    // The ONRC registration year tracks the start year, so the two cannot drift apart again.
    expect(seedData.profile.identity.numarRegComert.endsWith('/2026')).toBe(true);
    expect(seedData.settings.company.numarRegComert).toBe(seedData.profile.identity.numarRegComert);
  });

  it('seeds NO FX rate — a seeded rate is a fabricated legal figure', () => {
    // Absent, not empty: „no rate recorded" and „rates were fetched and none exist" are different facts.
    expect(seedData.fxRates).toBeUndefined();
  });

  it('writes none of the deprecated profile fields', () => {
    // Landmine 6: `pensionFacts.test.ts` fails if a new reader of `pensionStatus` appears, and Phase 7
    // moved CAEN to `identity.caen`. A fixture must not be a way back in.
    expect(seedData.profile.caen).toBeUndefined();
    expect(seedData.profile.pensionStatus).toBeUndefined();
    expect(Array.isArray(seedData.profile.identity.caen)).toBe(true);
  });
});

describe('emptyData — what a first run actually holds', () => {
  it('holds no records anywhere', () => {
    const data = emptyData();
    expect(data.revenues).toEqual([]);
    expect(data.expenses).toEqual([]);
    expect(data.clients).toEqual([]);
    expect(data.filings).toEqual([]);
    expect('legacyDeclarations' in data).toBe(false);
    expect(data.documents).toEqual([]);
    expect(data.statements).toEqual([]);
    expect(data.snapshots).toEqual([]);
    expect(Object.values(data.companyDocs).flat()).toEqual([]);
  });

  it('holds a profile shape with no facts in it', () => {
    const data = emptyData();
    expect(data.profile.identity.nume).toBe('');
    expect(data.profile.identity.denumire).toBe('');
    expect(data.profile.pfaStartDate).toBeUndefined();
    // `null` is „no reserve recorded", never an invented 0.
    expect(data.reservedAmount).toBeNull();
    expect(data.fxRates).toBeUndefined();
  });

  it('is a fresh object per call, so no consumer can mutate the shared fixture', () => {
    const a = emptyData();
    const b = emptyData();
    expect(a).not.toBe(b);
    a.revenues.push({} as never);
    expect(b.revenues).toEqual([]);
  });
});
