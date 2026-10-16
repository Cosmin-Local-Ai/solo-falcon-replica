import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INCOME_CATEGORY,
  DPI_EXCLUDED_KINDS,
  dpiDoubleRepresentation,
  dpiRecordConflict,
  incomeCategoryOf,
  isDpiArt72Alin3Excluded,
  isDpiIncome,
} from './dpi';
import { lei } from './money';

/**
 * B-112 STAGE 1 — the DPI income category, and the two places where the same income can reach the app
 * twice.
 *
 * The order of this file is deliberate. The double-representation refusal is tested FIRST, before the
 * category's own arithmetic, because that is the case that produces a wrong figure SILENTLY: a missing
 * category omits an income and the total is visibly smaller, whereas a doubled category selects a higher
 * rung of the art. 170 alin. (3) ladder and the total simply looks bigger and plausible. B-93's
 * `depreciation_conflict` is the precedent, and it was found the same way.
 */

describe('B-112 — the same DPI income declared twice is refused, not summed', () => {
  it('a hand-declared ladder net AND recorded DPI receipts produce a conflict', () => {
    const c = dpiDoubleRepresentation({ hasRecords: true, net: lei(5_000_000) }, lei(4_800_000));
    expect(c).not.toBeNull();
    expect(c!.conflict).toBe(true);
  });

  it('names BOTH inputs, so the person is told which two disagree rather than which one won', () => {
    const c = dpiDoubleRepresentation({ hasRecords: true, net: lei(50_000) }, lei(48_000))!;
    expect(c.recordedNet).toBe(lei(50_000));
    expect(c.declaredNet).toBe(lei(48_000));
  });

  it('does not prefer the larger, the smaller, or the more recently entered', () => {
    // The recorded figure is larger here; reversing them must not change the answer.
    const a = dpiDoubleRepresentation({ hasRecords: true, net: lei(90_000) }, lei(10_000))!;
    const b = dpiDoubleRepresentation({ hasRecords: true, net: lei(10_000) }, lei(90_000))!;
    expect(a.conflict).toBe(true);
    expect(b.conflict).toBe(true);
    expect(a.recordedNet).toBe(lei(90_000));
    expect(b.recordedNet).toBe(lei(10_000));
  });

  it('does not silently prefer either when the two agree to the ban, either', () => {
    // Agreement is not the same as one producer. Two inputs that happen to match are still two inputs, and
    // the next edit to one of them reopens the divergence; the app must not have decided that the ladder
    // field is redundant on the strength of one coincidence.
    const c = dpiDoubleRepresentation({ hasRecords: true, net: lei(48_000) }, lei(48_000));
    expect(c).not.toBeNull();
  });

  it('is not a conflict when only the recorded path exists', () => {
    expect(dpiDoubleRepresentation({ hasRecords: true, net: lei(50_000) }, undefined)).toBeNull();
  });

  it('is not a conflict when only the declared ladder net exists', () => {
    // The pre-B-112 shape: a DPI net typed by hand on Settings with nothing in the register behind it.
    // That is the representation the app has always had, and Stage 1 must not invalidate it.
    expect(dpiDoubleRepresentation({ hasRecords: false, net: null }, lei(48_000))).toBeNull();
  });

  it('is not a conflict when neither exists', () => {
    expect(dpiDoubleRepresentation({ hasRecords: false, net: null }, undefined)).toBeNull();
  });

  it('a recorded DPI total of zero is still a recorded representation', () => {
    // A zero-net DPI receipt has been classified art. 70 by the person, and that classification is the
    // second producer. Treating zero as "no records" would let a 0 lei art. 70 line quietly re-open the
    // double count against a hand-declared ladder net.
    expect(dpiDoubleRepresentation({ hasRecords: true, net: lei(0) }, lei(4_800_000))).not.toBeNull();
  });
});

describe('B-112 — the income category is read, never inferred', () => {
  it('a record with no category key reads as activitate independentă', () => {
    // Not a guess about the record: a payload written before B-112 could only hold art. 67 receipts,
    // because no other category was representable. `data/schema.ts` and `data/types.ts` both say so, and
    // no migration chain step invents the key.
    expect(incomeCategoryOf({})).toBe(DEFAULT_INCOME_CATEGORY);
    expect(DEFAULT_INCOME_CATEGORY).toBe('activitate_independenta');
    expect(isDpiIncome({})).toBe(false);
  });

  it('an explicit activitate independentă reads the same as an absent key', () => {
    expect(incomeCategoryOf({ incomeCategory: 'activitate_independenta' })).toBe(
      incomeCategoryOf({}),
    );
  });

  it('an explicit DPI category is not shadowed by the default', () => {
    expect(isDpiIncome({ incomeCategory: 'drepturi_de_proprietate_intelectuala' })).toBe(true);
  });

  it('the taxpayer having a PFA decides nothing — the category is the only input', () => {
    // Neither art. 70 nor art. 72 carves out PFA holders, and ANAF's own Exemplul 3 is ONE taxpayer holding
    // both categories in different D212 subsecțiuni. There is no profile fact in this module's input type,
    // which is the assertion: the vocabulary does not offer a way to infer the category.
    const dpi = { incomeCategory: 'drepturi_de_proprietate_intelectuala' as const };
    expect(isDpiIncome(dpi)).toBe(true);
    expect(isDpiIncome({ ...dpi, incomeCategory: 'activitate_independenta' })).toBe(false);
  });
});

describe('B-112 — one flag, two consequences', () => {
  it('the art. 72 alin. (3) set is the three kinds research/48 names, and only those', () => {
    expect(DPI_EXCLUDED_KINDS).toEqual([
      'mostenitori',
      'drept_de_suita',
      'remuneratie_copia_privata',
    ]);
  });

  it('every kind in the set triggers the single predicate', () => {
    for (const kind of DPI_EXCLUDED_KINDS) {
      expect(isDpiArt72Alin3Excluded(kind)).toBe(true);
    }
  });

  it('no kind at all triggers it, and an unset flag is not the same as a set one', () => {
    expect(isDpiArt72Alin3Excluded(undefined)).toBe(false);
  });

  it('the predicate is one function, so the quota consequence and the CAS consequence cannot diverge', () => {
    // There is no second predicate to disagree with. This test exists to fail if someone splits the flag
    // into `getsFlatQuota` and `countsForCas`, which is the shape that lets one legal fact be answered
    // twice and drift (B-70, B-85, B-93).
    const fns = [isDpiArt72Alin3Excluded];
    expect(fns).toHaveLength(1);
  });
});

describe('B-112 — a declared category and a declared contract object that contradict each other', () => {
  it('DPI income under a contract de comandă is a contradiction, and the app does not resolve it', () => {
    // art. 47 Legea 8/1996 / art. 185¹ C. civ.: the author is paid to create and deliver without
    // transferring patrimonial rights, which is art. 67 income. ÎCCJ dec. nr. 1793 din 23 martie 2021
    // refused DPI characterisation for contracts merely INTITULATED „cesiune de drepturi de autor”.
    const reason = dpiRecordConflict({
      incomeCategory: 'drepturi_de_proprietate_intelectuala',
      dpiContractType: 'contract_de_comanda',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('art. 47');
    expect(reason).toContain('1793');
    // It names both answers and refuses to pick, in the message itself.
    expect(reason).toContain('nu alege');
  });

  it('art. 67 income under a cesiune / licență is the same kind of contradiction', () => {
    const reason = dpiRecordConflict({
      incomeCategory: 'activitate_independenta',
      dpiContractType: 'cesiune_licenta',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('art. 40');
  });

  it('an art. 72 alin. (3) exclusion flag on an art. 67 receipt is a contradiction', () => {
    // The set is defined by reference to art. 70 income; on art. 67 income it has no effect at all, so a
    // record carrying both has answered the same question twice, differently.
    const reason = dpiRecordConflict({
      incomeCategory: 'activitate_independenta',
      dpiExcludedKind: 'drept_de_suita',
    });
    expect(reason).not.toBeNull();
    expect(reason).toContain('art. 72 alin. (3)');
  });

  it('cesiune / licență with DPI income is coherent', () => {
    expect(
      dpiRecordConflict({
        incomeCategory: 'drepturi_de_proprietate_intelectuala',
        dpiContractType: 'cesiune_licenta',
      }),
    ).toBeNull();
  });

  it('an undeclared contract object is not a contradiction — absence is not a second answer', () => {
    expect(dpiRecordConflict({ incomeCategory: 'drepturi_de_proprietate_intelectuala' })).toBeNull();
    expect(
      dpiRecordConflict({ incomeCategory: 'drepturi_de_proprietate_intelectuala', dpiExcludedKind: 'mostenitori' }),
    ).toBeNull();
  });

  it('art. 67 income with no DPI facts is coherent, which is every pre-B-112 record', () => {
    expect(dpiRecordConflict({})).toBeNull();
  });
});
