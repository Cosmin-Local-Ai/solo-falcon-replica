import { describe, expect, it } from 'vitest';
import { legacyProfileFromSettings } from './migration';
import type { SettingsState } from './types';

const settings: SettingsState = {
  cotaTva: 9,
  company: {
    denumire: 'Test Consulting SRL',
    cui: 'RO1234567890',
    numarRegComert: 'J40/1/2020',
    adresa: 'Str. Test 1',
    caen: [{ cod: '6201', descriere: 'Activități de programare computerizate' }],
    formaJuridica: 'SRL',
    codCAEN: '6201',
    telefon: '0700 111 222',
    email: 'company@test.ro',
    contBancar: 'RO44 BACX 0000 0000 1234 5678 9000',
    banca: 'BCR',
  },
  personal: {
    nume: 'Popescu Andrei',
    cnp: '1234567890123',
    adresa: 'Str. Personal 2',
    telefon: '0711 222 333',
    email: 'personal@test.ro',
  },
  bankAccounts: [],
  eFactura: { trimitere: 'manual', dateContact: '2026-09-01' },
};

// B-23 is a STANDING RULE, not a one-off: no test in this suite may read the wall clock.
// `legacyProfileFromSettings` takes an injectable `instant`, so every call below pins it. An unpinned
// call derives `pfaStartYear` / `fiscalYear` / `updatedAt` from whatever the machine says today.
const PINNED_INSTANT = new Date('2026-06-01T12:00:00Z');

describe('legacyProfileFromSettings (profile migration)', () => {
  it('carries personal identity over from settings.personal', () => {
    const p = legacyProfileFromSettings(settings, PINNED_INSTANT);
    expect(p.identity.nume).toBe('Popescu Andrei');
    expect(p.identity.cnp).toBe('1234567890123');
    expect(p.identity.adresa).toBe('Str. Personal 2');
    expect(p.identity.telefon).toBe('0711 222 333');
    expect(p.identity.email).toBe('personal@test.ro');
  });

  it('carries company identity over from settings.company', () => {
    const p = legacyProfileFromSettings(settings, PINNED_INSTANT);
    expect(p.identity.denumire).toBe('Test Consulting SRL');
    expect(p.identity.cui).toBe('RO1234567890');
    expect(p.identity.formaJuridica).toBe('SRL');
    expect(p.identity.numarRegComert).toBe('J40/1/2020');
    expect(p.identity.adresaSocietate).toBe('Str. Test 1');
    expect(p.identity.telefonSocietate).toBe('0700 111 222');
    expect(p.identity.emailSocietate).toBe('company@test.ro');
    expect(p.identity.contBancar).toBe('RO44 BACX 0000 0000 1234 5678 9000');
    expect(p.identity.banca).toBe('BCR');
  });

  it('carries the CAEN list into identity.caen (D-1: identity owns CAEN)', () => {
    const p = legacyProfileFromSettings(settings, PINNED_INSTANT);
    expect(p.identity.caen).toEqual([
      { cod: '6201', descriere: 'Activități de programare computerizate' },
    ]);
  });

  it('falls back to the legacy codCAEN when the caen list is empty', () => {
    const p = legacyProfileFromSettings({ ...settings, company: { ...settings.company, caen: [] } }, PINNED_INSTANT);
    expect(p.identity.caen).toEqual([{ cod: '6201', descriere: '' }]);
  });

  it('does not mint a deprecated profile.caen string', () => {
    const p = legacyProfileFromSettings(settings, PINNED_INSTANT);
    expect('caen' in p).toBe(false);
  });

  it('applies safe defaults for missing optional fields', () => {
    const minimal: SettingsState = {
      cotaTva: 9,
      company: { denumire: 'X', cui: 'Y', numarRegComert: '', adresa: '', caen: [] },
      personal: { nume: '', cnp: '', adresa: '', telefon: '', email: '' },
      bankAccounts: [],
      eFactura: { trimitere: 'manual', dateContact: '' },
    };
    // B-23 (Phase 9b): this used to assert `new Date().getFullYear()`, which turns red on 1 January
    // 2027 for no code reason. No test in this suite may read the wall clock. `instant` is injectable
    // precisely so that `pfaStartYear` / `fiscalYear` / `updatedAt` are deterministic, so pin it.
    const p = legacyProfileFromSettings(minimal, PINNED_INSTANT);
    expect(p.regime).toBe('impozit_pe_venit');
    expect(p.salaryStatus).toBe('nu');
    expect(p.pensionStatus).toBe('nu');
    expect(p.otherIncome).toEqual([]);
    expect(p.vatExempt).toBe(false);
    expect(p.cashFloorLei).toBe(0);
    // No CAEN source at all in this payload ⇒ the field stays absent. The chain
    // never invents a code the user never entered.
    expect(p.identity.caen).toBeUndefined();
    expect(p.identity.formaJuridica).toBe('');
    expect(p.identity.contBancar).toBe('');
    expect(p.fiscalYear).toBe(2026);
    expect(p.pfaStartYear).toBe(2026);
  });
});
