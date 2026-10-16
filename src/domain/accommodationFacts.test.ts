/**
 * PG-6h-2 (B-82, B-84) — the room count is a **category switch**, and this file is where that is pinned.
 *
 * The whole task turns on one distinction the app had no way to make before: CF art. 83 alin. (2) gives a
 * „proprietar, uzufructuar sau alt deținător legal” who lets **1–7 camere** in a personal dwelling to the
 * *cedarea folosinței bunurilor* title, art. 85 alin. (1) treats that taxpayer as a category of its own,
 * and art. 83 alin. (4) moves the same person into a activitate independentă only **„începând cu anul
 * fiscal în care numărul camerelor … este de peste 7”**. Choosing between them does not shift a figure —
 * it moves the income under different rules. So the tests here assert *titles*, never amounts, and the
 * unknown state is asserted first, because a migration or a form that filled the count in would have
 * invented a tax category rather than a number.
 *
 * Three more things this file holds the line on:
 *
 * - **Per year, not one scalar.** art. 83 alin. (4) speaks per fiscal year, so two years with two counts
 *   must give two titles — one test per year, as the brief requires.
 * - **The fiscal 7 is not the tourism 7.** `ACCOMMODATION_ROOM_COUNT_BOUNDARY` is art. 83 alin. (4)'s
 *   „peste 7 camere”. Ordin ANT 65/2013 alin. (12) caps a natural person's right to *request tourism
 *   classification* at „7 camere/14 locuri”. Different authors, different purposes; `research/39` §3 keeps
 *   them apart and so does the code under test.
 * - **CAEN prompts, never answers.** The list is this app's own normative choice under HG 656/1997 art. 4
 *   alin. (1)-(2), it is Rev. 3's five classes, and no code may be read as an answer to any of the three
 *   questions.
 */
import { describe, expect, it } from 'vitest';
import {
  ACCOMMODATION_ROOM_COUNT_BOUNDARY,
  TOURISM_CAEN_CLASSES,
  accommodationIncomeTitleForYear,
  accommodationRoomCountForYear,
  profileHasTourismCaen,
  withAccommodationRoomCount,
  type AccommodationRoomCountYear,
} from './models';
import { seedData } from '../data/seed';

const years = (...pairs: Array<[number, number]>): AccommodationRoomCountYear[] =>
  pairs.map(([fiscalYear, rooms]) => ({ fiscalYear, rooms }));

describe('the room count decides a title, not a figure (acceptance 2)', () => {
  it('an unrecorded count asserts no title at all — the unknown state, not a default', () => {
    // This is the state every existing profile is in, and the one a backfill would have destroyed.
    expect(accommodationIncomeTitleForYear(undefined, 2026)).toBeNull();
    expect(accommodationIncomeTitleForYear([], 2026)).toBeNull();
    // A count recorded for another year is not a count for this one.
    expect(accommodationIncomeTitleForYear(years([2027, 9]), 2026)).toBeNull();
  });

  it('1–7 rooms puts the income in cedarea folosinței — art. 83 alin. (2), art. 85', () => {
    for (const rooms of [1, 2, 3, 7]) {
      expect(accommodationIncomeTitleForYear(years([2026, rooms]), 2026)).toBe('cedarea_folosintei');
    }
  });

  it('more than 7 rooms puts it under art. 68^3 as independent activity — art. 83 alin. (4)', () => {
    for (const rooms of [8, 9, 40]) {
      expect(accommodationIncomeTitleForYear(years([2026, rooms]), 2026)).toBe(
        'activitate_independenta_68x3',
      );
    }
  });

  it('the boundary sits at „peste 7”, so 7 and 8 fall on opposite sides of it', () => {
    expect(ACCOMMODATION_ROOM_COUNT_BOUNDARY).toBe(7);
    expect(accommodationIncomeTitleForYear(years([2026, 7]), 2026)).toBe('cedarea_folosintei');
    expect(accommodationIncomeTitleForYear(years([2026, 8]), 2026)).toBe('activitate_independenta_68x3');
    // Zero rooms is a recorded answer, not an absence: it is still under the cedarea title, and reading it
    // as "unanswered" would make an explicit 0 indistinguishable from nobody having answered.
    expect(accommodationIncomeTitleForYear(years([2026, 0]), 2026)).toBe('cedarea_folosintei');
  });
});

describe('the count is per fiscal year (acceptance 3)', () => {
  it('2026 with 5 rooms is cedarea folosinței', () => {
    const record = years([2026, 5], [2027, 9]);
    expect(accommodationRoomCountForYear(record, 2026)).toBe(5);
    expect(accommodationIncomeTitleForYear(record, 2026)).toBe('cedarea_folosintei');
  });

  it('2027 with 9 rooms is art. 68^3 — the same profile, the other title', () => {
    const record = years([2026, 5], [2027, 9]);
    expect(accommodationRoomCountForYear(record, 2027)).toBe(9);
    expect(accommodationIncomeTitleForYear(record, 2027)).toBe('activitate_independenta_68x3');
  });

  it('the crossing year is the year the title changes, which is what art. 83 alin. (4) says', () => {
    // A taxpayer who crosses 7 rooms during 2027 is under cedarea for 2026 and under art. 68^3 for 2027.
    // One scalar on the profile could not represent this at all.
    const crossing = years([2026, 7], [2027, 8]);
    expect(accommodationIncomeTitleForYear(crossing, 2026)).toBe('cedarea_folosintei');
    expect(accommodationIncomeTitleForYear(crossing, 2027)).toBe('activitate_independenta_68x3');
  });
});

describe('editing one year leaves the others alone', () => {
  it('writing a year replaces that year only', () => {
    const next = withAccommodationRoomCount(years([2026, 5]), 2027, 9);
    expect(next).toEqual([{ fiscalYear: 2026, rooms: 5 }, { fiscalYear: 2027, rooms: 9 }]);
  });

  it('clearing a year makes that year unanswered again and keeps the rest', () => {
    const next = withAccommodationRoomCount(years([2026, 5], [2027, 9]), 2027, undefined);
    expect(next).toEqual([{ fiscalYear: 2026, rooms: 5 }]);
    expect(accommodationIncomeTitleForYear(next, 2027)).toBeNull();
  });

  it('clearing the last recorded year returns absence, not an empty array', () => {
    // An empty array and an absent field mean the same thing to the resolver, but not to the payload: the
    // profile should not carry a key it has no answer for.
    expect(withAccommodationRoomCount(years([2026, 5]), 2026, undefined)).toBeUndefined();
  });
});

describe('the CAEN list is the app\'s own prompt, and answers nothing (acceptance 5, 6)', () => {
  it('the list is CAEN Rev. 3\'s five Division 55 classes, not Rev. 2\'s four', () => {
    // `research/39` §2: Rev. 3 (Ordin INS 377/2024, in force 01.01.2025) added 5540. A list copied from a
    // Rev. 2 source is silently one class short.
    expect(TOURISM_CAEN_CLASSES.map(c => c.cod)).toEqual(['5510', '5520', '5530', '5540', '5590']);
  });

  it('5540 is annotated as intermediation, not accommodation', () => {
    const c = TOURISM_CAEN_CLASSES.find(x => x.cod === '5540')!;
    expect(c.title).toBe('Intermedieri pentru servicii de cazare');
    expect(c.caveat).toContain('NU este cazare');
  });

  it('5590 is annotated as not necessarily tourism', () => {
    const c = TOURISM_CAEN_CLASSES.find(x => x.cod === '5590')!;
    expect(c.caveat).toContain('Nu este neapărat turism');
  });

  it('a Division 55 code is recognised as a prompt; an unrelated code is not', () => {
    expect(profileHasTourismCaen({ ...seedData.profile.identity, caen: [{ cod: '5520', descriere: '' }] }))
      .toBe(true);
    expect(profileHasTourismCaen({ ...seedData.profile.identity, caen: [{ cod: '6201', descriere: '' }] }))
      .toBe(false);
  });

  it('no CAEN list at all is the normal case, and reads as false without implying anything', () => {
    // `research/39` §1: the likeliest affected taxpayer — a natural person letting 1–7 rooms — is outside
    // the trade-registry chain and has no CAEN code. A trigger keyed on the code would never reach them,
    // which is exactly why D-COM-2 moved the trigger to the declared family.
    expect(profileHasTourismCaen({ ...seedData.profile.identity, caen: [] })).toBe(false);
    expect(profileHasTourismCaen({ ...seedData.profile.identity, caen: undefined })).toBe(false);
    expect(profileHasTourismCaen(undefined)).toBe(false);
  });

  it('a CAEN code never supplies a room count, a title, an eligibility answer or a commission reading', () => {
    // The profile below carries a Division 55 code and no answers. Every fact stays absent, and the title
    // stays unknown: the code opened a question, it did not answer one.
    const profile = {
      ...seedData.profile,
      identity: { ...seedData.profile.identity, caen: [{ cod: '5510', descriere: 'Hoteluri' }] },
    };
    expect(profile.accommodationRoomCounts).toBeUndefined();
    expect(profile.accommodationCommissionReading).toBeUndefined();
    expect(profile.accommodationTourismEligibility).toBeUndefined();
    expect(accommodationIncomeTitleForYear(profile.accommodationRoomCounts, profile.fiscalYear)).toBeNull();
  });
});
