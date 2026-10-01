import { describe, expect, it } from 'vitest';
import { createDefaultProfile, getActiveProfile, profileIdentity } from './profile';
import { parsePfaProfile } from './schema';
import type { PfaProfile } from './models';

/** A fully valid profile used as the baseline for schema tests. */
const validProfile: PfaProfile = {
  id: 'profile-1',
  pfaStartYear: 2020,
  fiscalYear: 2026,
  regime: 'impozit_pe_venit',
  caen: '6201',
  salaryStatus: 'nu',
  pensionStatus: 'nu',
  otherIncome: [],
  socialInsuranceStatus: 'obligatoriu',
  vatExempt: false,
  cashFloorLei: 0,
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

describe('createDefaultProfile', () => {
  it('produces safe defaults', () => {
    const p = createDefaultProfile();
    expect(p.id).toBe('profile-1');
    expect(p.regime).toBe('impozit_pe_venit');
    expect(p.salaryStatus).toBe('nu');
    expect(p.pensionStatus).toBe('nu');
    expect(p.otherIncome).toEqual([]);
    expect(p.vatExempt).toBe(false);
    expect(p.cashFloorLei).toBe(0);
    expect(p.identity.nume).toBe('');
    expect(p.identity.cui).toBe('');
  });

  it('applies overrides on top of defaults', () => {
    const p = createDefaultProfile({ regime: 'impozit_pe_cit', caen: '6201', cashFloorLei: 5000 });
    expect(p.regime).toBe('impozit_pe_cit');
    expect(p.caen).toBe('6201');
    expect(p.cashFloorLei).toBe(5000);
    // untouched fields keep their defaults
    expect(p.salaryStatus).toBe('nu');
    expect(p.otherIncome).toEqual([]);
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

  it('accepts a profile with other-income flags', () => {
    const p = parsePfaProfile({ ...validProfile, otherIncome: ['imobiliare', 'dividende'] });
    expect(p?.otherIncome).toEqual(['imobiliare', 'dividende']);
  });

  it('rejects an invalid regime', () => {
    expect(parsePfaProfile({ ...validProfile, regime: 'impozit_pe_cit2' })).toBeNull();
  });

  it('rejects a negative cash floor', () => {
    expect(parsePfaProfile({ ...validProfile, cashFloorLei: -1 })).toBeNull();
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

  it('rejects a profile with an unknown other-income flag', () => {
    expect(parsePfaProfile({ ...validProfile, otherIncome: ['loterie'] })).toBeNull();
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
