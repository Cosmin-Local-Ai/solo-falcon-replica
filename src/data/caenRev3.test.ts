import { describe, expect, it } from 'vitest';

import {
  CAEN_ENTRIES,
  CAEN_NOMENCLATOR_COUNTS,
  CAEN_NOMENCLATOR_EXPECTED_COUNTS,
  CAEN_NOMENCLATOR_VERSION,
  caenByCod,
  caenClassProblem,
  caenLabel,
  caenLineage,
  caenLineageLabel,
  foldCaenText,
  isCaenClass,
  searchCaen,
  searchCaenClasses,
} from './caenRev3';

/**
 * Step 11 / Part A1 — the CAEN Rev.3 nomenclator as application reference data.
 *
 * This file is the guard that makes a future source swap safe. The dataset in
 * `docs/ai/data/caen_rev3.csv` was parsed from a verbatim paste of Ordinul INS 377/2024,
 * MO I 385/25.04.2024 by `ingest_caen_rev3.py`, which refuses to write the CSV when these
 * counts fail. The counts had been *corroborated* from the NACE Rev.2.1 equivalence for
 * weeks and had never been counted from the primary text; they are counted here, from the
 * file the app actually loads, so the app cannot ship a nomenclator that quietly lost a
 * diviziune.
 *
 * The second half of the file is the part that catches the subtler failure. A CAEN list
 * copied from a Rev.2 source has the right *shape* and the wrong *codes* — Rev.3 added
 * `5540` and dissolved `45` and `04`. Counting alone would pass it.
 */

describe('the nomenclator is complete, and the counts are counted rather than restated', () => {
  it('holds 87 diviziuni, 287 grupe, 651 clase and 22 secțiuni', () => {
    // The numbers the ingest script enforces, asserted independently of it.
    expect(CAEN_NOMENCLATOR_COUNTS).toEqual(CAEN_NOMENCLATOR_EXPECTED_COUNTS);
    expect(CAEN_NOMENCLATOR_COUNTS.diviziuni).toBe(87);
    expect(CAEN_NOMENCLATOR_COUNTS.grupe).toBe(287);
    expect(CAEN_NOMENCLATOR_COUNTS.clase).toBe(651);
    expect(CAEN_NOMENCLATOR_COUNTS.sectiuni).toBe(22);
  });

  it('loads all 1.025 rows, and every row has a denomination', () => {
    expect(CAEN_ENTRIES).toHaveLength(1025);
    for (const entry of CAEN_ENTRIES) {
      expect(entry.denumire, `empty denumire for ${entry.cod}`).not.toBe('');
      expect(entry.cod).toHaveLength(entry.nivel === 'diviziune' ? 2 : entry.nivel === 'grupa' ? 3 : 4);
    }
  });

  it('has no duplicate code at any level', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of CAEN_ENTRIES) {
      if (seen.has(entry.cod)) duplicates.push(entry.cod);
      seen.add(entry.cod);
    }
    expect(duplicates).toEqual([]);
  });

  it('the 22nd secțiune is V, the extraterrestrial one — caen3.ro advertises 21 and is wrong', () => {
    const sections = [...new Set(CAEN_ENTRIES.map((e) => e.sectiune))].sort();
    expect(sections).toHaveLength(22);
    expect(sections[0]).toBe('A');
    expect(sections[21]).toBe('V');
    expect(caenByCod('9900')?.sectiune).toBe('V');
  });
});

describe('every clasă resolves upward, so a code is never shown without what it sits under', () => {
  it('each of the 651 clase has a grupa, a diviziune and a secțiune letter', () => {
    const broken: string[] = [];
    for (const entry of CAEN_ENTRIES) {
      if (entry.nivel !== 'clasa') continue;
      const lineage = caenLineage(entry.cod);
      if (!lineage?.grupa || lineage.grupa.nivel !== 'grupa') broken.push(`${entry.cod} grupa`);
      if (!lineage?.diviziune || lineage.diviziune.nivel !== 'diviziune') {
        broken.push(`${entry.cod} diviziune`);
      }
      if (!/^[A-V]$/.test(entry.sectiune)) broken.push(`${entry.cod} sectiune`);
      if (lineage?.grupa && lineage.grupa.parinte !== lineage.diviziune?.cod) {
        broken.push(`${entry.cod} grupa.parinte`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('the parent links agree with the code prefixes, not with a hand-maintained table', () => {
    const grupa = caenByCod('479');
    expect(grupa?.parinte).toBe('47');
    expect(caenLineage('4791')).toMatchObject({
      grupa: { cod: '479', denumire: expect.any(String) },
      diviziune: { cod: '47', denumire: expect.any(String) },
    });
  });

  it('the absent diviziuni are genuine Rev.3 structure, not gaps in the paste', () => {
    // 04 and 45 are the two that matter: Rev.3 dissolved Rev.2's `04` into `07` and Rev.2's
    // `45` (auto trade and repair) into `467` / `478` / `953`. A Rev.2 list would have them.
    for (const absent of ['04', '34', '40', '44', '45', '48', '54', '57', '67', '76', '83', '89']) {
      expect(caenByCod(absent), `${absent} should not exist in Rev.3`).toBeUndefined();
    }
    expect(caenByCod('07')?.nivel).toBe('diviziune');
    for (const successor of ['467', '478', '953']) {
      expect(caenByCod(successor)?.nivel, `${successor} is a Rev.3 grupa`).toBe('grupa');
    }
  });
});

describe('the version marker ships with the data', () => {
  it('names the revision, the act, the monitor and the in-force date', () => {
    expect(CAEN_NOMENCLATOR_VERSION.rev).toBe(3);
    expect(CAEN_NOMENCLATOR_VERSION.denumire).toBe('CAEN Rev.3');
    expect(CAEN_NOMENCLATOR_VERSION.act).toContain('377/2024');
    expect(CAEN_NOMENCLATOR_VERSION.monitor).toContain('385');
    expect(CAEN_NOMENCLATOR_VERSION.inVigoareDeLa).toBe('2025-01-01');
  });

  it('carries the attribution, so the credit is not buried in a docs file', () => {
    expect(CAEN_NOMENCLATOR_VERSION.atribuire).toContain('INS');
    expect(CAEN_NOMENCLATOR_VERSION.atribuire).toContain('377/2024');
    expect(CAEN_NOMENCLATOR_VERSION.atribuire).toContain('385');
  });
});

describe('Rev.3, not Rev.2 — the trap the brief names', () => {
  it('5540 exists: Rev.3 added „Intermedieri pentru servicii de cazare“', () => {
    expect(caenByCod('5540')).toMatchObject({
      nivel: 'clasa',
      sectiune: 'I',
      denumire: 'Intermedieri pentru servicii de cazare',
    });
  });

  it('the five codes this project previously guessed are all absent', () => {
    // `research/51` and brief 64 record that these were written from memory. They are absent
    // from Rev.3, and `6201` is the one that was sitting in the seed.
    for (const ghost of ['6201', '6202', '6311', '6312', '9003', '4110']) {
      expect(caenByCod(ghost), `${ghost} is not a CAEN Rev.3 class`).toBeUndefined();
    }
    // …and the Rev.3 classes that replace them are present.
    for (const real of ['6210', '6220', '6290', '6310', '9011', '4100']) {
      expect(caenByCod(real)?.nivel, `${real} is a Rev.3 class`).toBe('clasa');
    }
  });
});

describe('the type-ahead searches code AND description', () => {
  it('a partial code finds the classes under it, each labelled `cod — denumire`', () => {
    const codes = searchCaenClasses('47').map((e) => e.cod);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((c) => c.startsWith('47'))).toBe(true);
    expect(caenLabel(caenByCod('4791')!)).toBe(
      '4791 — Intermedieri în comerțul cu amănuntul nespecializat',
    );
  });

  it('an exact code resolves to one class', () => {
    const hits = searchCaenClasses('4791');
    expect(hits.map((e) => e.cod)).toEqual(['4791']);
  });

  it('a phrase works even when no class contains it — it expands the grupa that does', () => {
    // No CAEN Rev.3 *clasă* contains „programare“; diviziunea 62 and grupa 621 do. A
    // class-only search would answer this ordinary question with an empty list.
    const rows = searchCaen('programare');
    expect(rows.length).toBeGreaterThan(0);
    const headers = rows.filter((r) => !r.selectable).map((r) => r.entry.cod);
    expect(headers).toEqual(expect.arrayContaining(['62', '621']));
    const codes = rows.filter((r) => r.selectable).map((r) => r.entry.cod);
    expect(codes).toEqual(expect.arrayContaining(['6210', '6220', '6290']));
    // A header is never selectable: registration is at the 4-digit class.
    for (const row of rows) {
      expect(row.selectable).toBe(row.entry.nivel === 'clasa');
    }
  });

  it('a description phrase that does hit classes returns classes, not headers', () => {
    const codes = searchCaenClasses('cazare').map((e) => e.cod);
    expect(codes).toEqual(expect.arrayContaining(['5510', '5520', '5540', '5590']));
    expect(searchCaen('cazare').every((r) => r.selectable)).toBe(true);
  });

  it('matching is diacritic-insensitive, so the row on screen matches what the user types', () => {
    expect(foldCaenText('Intermedieri în comerțul')).toBe('intermedieri in comertul');
    expect(searchCaenClasses('comertul cu amanuntul').length).toBeGreaterThan(0);
    expect(searchCaenClasses('cazare').length).toBeGreaterThan(0);
  });

  it('an empty or whitespace query offers nothing', () => {
    expect(searchCaen('')).toEqual([]);
    expect(searchCaen('   ')).toEqual([]);
  });
});

describe('free text is not a CAEN', () => {
  it('accepts only a class that is in the nomenclator', () => {
    for (const cod of ['6210', '4791', '5540', '5520', '6820', '0125']) {
      expect(caenClassProblem(cod), `${cod} should be accepted`).toBeNull();
      expect(isCaenClass(cod)).toBe(true);
    }
  });

  it('refuses a Rev.2 code that no longer exists', () => {
    expect(caenClassProblem('6201')).toContain('nu există în CAEN Rev.3');
    expect(isCaenClass('6201')).toBe(false);
  });

  it('refuses free text and a wrong-length code', () => {
    expect(caenClassProblem('programare')).toContain('4 cifre');
    expect(caenClassProblem('621')).toContain('4 cifre');
    expect(caenClassProblem('62100')).toContain('4 cifre');
    expect(caenClassProblem('9999')).toContain('nu există în CAEN Rev.3');
  });

  it('names the level when the typed code is a real grupa or diviziune, and says a class is required', () => {
    const problem = caenClassProblem('479') ?? '';
    expect(problem).toContain('grupă');
    expect(problem).toContain('4 cifre');
    expect(caenClassProblem('62') ?? '').toContain('diviziune');
  });

  it('absence is legal: an empty field is not an error', () => {
    expect(caenClassProblem('')).toBeNull();
    expect(caenClassProblem('   ')).toBeNull();
  });
});

describe('the lineage line tells the user what a class sits under', () => {
  it('shows the secțiune, the diviziune and the grupa', () => {
    const label = caenLineageLabel('4791');
    expect(label).toContain('Secțiunea G');
    expect(label).toContain('47 ');
    expect(label).toContain('479 ');
  });

  it('is empty for an unknown code rather than inventing one', () => {
    expect(caenLineageLabel('6201')).toBe('');
  });
});
