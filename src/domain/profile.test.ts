import { describe, expect, it } from 'vitest';
import { createDefaultProfile, getActiveProfile, profileIdentity } from './profile';
import { parsePfaProfile } from './schema';
import type { PfaProfile } from './models';
import { lei } from './money';

/** A fully valid profile used as the baseline for schema tests. */
const validProfile: PfaProfile = {
  id: 'profile-1',
  pfaStartYear: 2020,
  fiscalYear: 2026,
  regime: 'impozit_pe_venit',
  caen: '6201',
  salaryStatus: 'nu',
  pensionerStatus: 'nu',
  socialInsuranceStatus: 'obligatoriu',
  vatExempt: false,
  cashFloorLei: lei(0),
  identity: {
    nume: 'Popescu Andrei',
    cnp: '1234567890123',
    adresa: 'Str. Libertății 12, Cluj-Napoca',
    telefon: '0750 123 456',
    email: 'andrei@popescuconsulting.ro',
    denumire: 'Popescu Consulting SRL',
    cui: 'RO4455667788990',
    formaJuridica: 'SRL',
    numarRegComert: 'J40/1234/2020',
    adresaSocietate: 'Str. Libertății 12, Cluj-Napoca',
    telefonSocietate: '0750 123 456',
    emailSocietate: 'contact@popescuconsulting.ro',
    contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
    banca: 'BCR',
  },
  updatedAt: '2026-09-28T10:00:00.000Z',
};

// B-23 standing rule: no test may read the wall clock. `createDefaultProfile` takes an injectable
// `instant`, so pin it — unpinned, `pfaStartYear` / `fiscalYear` / `updatedAt` follow the machine date.
const PINNED_INSTANT = new Date('2026-06-01T12:00:00Z');

describe('createDefaultProfile', () => {
  it('produces safe defaults', () => {
    const p = createDefaultProfile({}, PINNED_INSTANT);
    expect(p.id).toBe('profile-1');
    expect(p.regime).toBe('impozit_pe_venit');
    expect(p.salaryStatus).toBe('nu');
    expect(p.pensionerStatus).toBe('nu');
    // TASK 5: the year-attributed facts are NOT defaulted. A fresh profile has not recorded them, and a
    // default would state a fact the user never entered — for art. 174 alin. (7) lit. c) it would decide
    // a tax relief.
    expect(p.pensionReceiptYears).toBeUndefined();
    expect(p.pensionSuspensionYears).toBeUndefined();
    expect(p.cassPreviousYearContext).toBeUndefined();
    expect(p.foreignSicknessInsurance).toBeUndefined();
    // PG-6d (D-LEG-1, B-41): no ladder amounts are minted either. Six zeros would be a declaration that
    // this person had no income in any art. 155 alin. (1) lit. c)-h) category, and a fresh profile has
    // simply never been asked.
    expect(p.cassLadderYears).toBeUndefined();
    expect(p.vatExempt).toBe(false);
    expect(p.cashFloorLei).toBe(0);
    // Deterministic only because `instant` is pinned above. This is the assertion B-23 exists to protect.
    expect(p.fiscalYear).toBe(2026);
    expect(p.pfaStartYear).toBe(2026);
    expect(p.identity.nume).toBe('');
    expect(p.identity.cui).toBe('');
  });

  it('applies overrides on top of defaults', () => {
    const p = createDefaultProfile({ regime: 'impozit_pe_cit', caen: '6201', cashFloorLei: lei(5000) }, PINNED_INSTANT);
    expect(p.regime).toBe('impozit_pe_cit');
    expect(p.caen).toBe('6201');
    expect(p.cashFloorLei).toBe(lei(5000));
    // untouched fields keep their defaults
    expect(p.salaryStatus).toBe('nu');
    expect(p.cassLadderYears).toBeUndefined();
  });
});

describe('getActiveProfile', () => {
  it('returns the profile when the fiscal year matches', () => {
    expect(getActiveProfile(validProfile, 2026)).toBe(validProfile);
  });

  it('returns null when the fiscal year differs', () => {
    expect(getActiveProfile(validProfile, 2025)).toBeNull();
  });

  it('returns null when there is no profile', () => {
    expect(getActiveProfile(null, 2026)).toBeNull();
  });
});

describe('profileIdentity', () => {
  it('returns the identity block of the profile', () => {
    expect(profileIdentity(validProfile)).toBe(validProfile.identity);
    expect(profileIdentity(validProfile).cui).toBe('RO4455667788990');
  });
});

describe('parsePfaProfile', () => {
  it('accepts a valid profile', () => {
    expect(parsePfaProfile(validProfile)).toEqual(validProfile);
  });

  it('accepts a profile with declared art. 155 alin. (1) lit. c)-h) amounts', () => {
    const p = parsePfaProfile({
      ...validProfile,
      cassLadderYears: [
        {
          fiscalYear: 2026,
          proprietateIntelectuala: lei(30000),
          investitii: lei(20000),
          investitiiBaza: 'dividende_platite_diminuate_cu_impozitul_retinut',
          alteSurse: lei(5000),
          alteSurseArt114: 'da',
        },
      ],
    });
    expect(p?.cassLadderYears?.[0]?.proprietateIntelectuala).toBe(lei(30000));
    // A declared zero is a fact and survives; absence is a different state and must not be coerced into it.
    const zero = parsePfaProfile({
      ...validProfile,
      cassLadderYears: [{ fiscalYear: 2026, activitatiAgricole: lei(0), activitatiAgricoleBaza: 'norma_de_venit' }],
    });
    expect(zero?.cassLadderYears?.[0]?.activitatiAgricole).toBe(lei(0));
  });

  it('rejects an invalid regime', () => {
    expect(parsePfaProfile({ ...validProfile, regime: 'impozit_pe_cit2' })).toBeNull();
  });

  it('rejects a negative cash floor', () => {
    expect(parsePfaProfile({ ...validProfile, cashFloorLei: lei(-1) })).toBeNull();
  });

  it('rejects a non-integer fiscal year', () => {
    expect(parsePfaProfile({ ...validProfile, fiscalYear: 2026.5 })).toBeNull();
  });

  it('rejects an out-of-range PFA start year', () => {
    expect(parsePfaProfile({ ...validProfile, pfaStartYear: 1980 })).toBeNull();
  });

  it('rejects a profile missing identity fields', () => {
    const { identity, ...rest } = validProfile;
    const partial = { ...rest, identity: { ...identity, cui: undefined as unknown as string } };
    expect(parsePfaProfile(partial)).toBeNull();
  });

  it('rejects a ladder amount that is not a non-negative number of bani', () => {
    expect(parsePfaProfile({ ...validProfile, cassLadderYears: [{ fiscalYear: 2026, investitii: -1 }] })).toBeNull();
    expect(
      parsePfaProfile({ ...validProfile, cassLadderYears: [{ fiscalYear: 2026, activitatiAgricoleBaza: 'norma' }] }),
    ).toBeNull();
  });

  it('rejects null / undefined / non-object input', () => {
    expect(parsePfaProfile(null)).toBeNull();
    expect(parsePfaProfile(undefined)).toBeNull();
    expect(parsePfaProfile('profile')).toBeNull();
  });

  it('accepts a profile with empty company identity fields (person-only)', () => {
    const p = parsePfaProfile({
      ...validProfile,
      identity: {
        ...validProfile.identity,
        denumire: '',
        cui: '',
        formaJuridica: '',
        numarRegComert: '',
        adresaSocietate: '',
        telefonSocietate: '',
        emailSocietate: '',
        contBancar: '',
        banca: '',
      },
    });
    expect(p?.identity.cui).toBe('');
    expect(p?.identity.denumire).toBe('');
  });

  it('rejects an empty id', () => {
    expect(parsePfaProfile({ ...validProfile, id: '' })).toBeNull();
  });

  it('rejects an empty updatedAt', () => {
    expect(parsePfaProfile({ ...validProfile, updatedAt: '' })).toBeNull();
  });
});
