/**
 * Proves the synchronous SHA-256 used by the persisted-data migration is
 * byte-for-byte identical to the platform implementation used everywhere else.
 *
 * This test is the reason `hashSync.ts` is trustworthy: the migration rewrites
 * the digest of historical audit records, and a digest that disagreed with
 * `computeInputsHash` by even one hex character would make every migrated
 * snapshot fail its own provenance check forever (snapshots are append-only, so
 * there is no later chance to correct it).
 */
import { describe, expect, it } from 'vitest';
import { computeInputsHash } from './hash';
import { computeInputsHashSync, sha256Hex } from './hashSync';
import { canonicalize } from './serialize';
import type { CalculationInput } from './types';

describe('sha256Hex agrees with the platform SHA-256', () => {
  const strings = [
    '',
    'abc',
    'a'.repeat(55), // padding edge: exactly one zero byte of length padding left
    'a'.repeat(56), // padding edge: forces a second block
    'a'.repeat(64),
    'a'.repeat(1000), // multi-block
    'ăâîșț unicode — cheie „de test”', // multi-byte UTF-8
    '{"a":1,"b":[1,2,3]}',
  ];

  it.each(strings.map(s => [s.length > 20 ? `${s.slice(0, 20)}…(${s.length} chars)` : s, s] as const))(
    'digest of %s matches',
    async (_label, s) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      const platform = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      expect(sha256Hex(s)).toBe(platform);
    },
  );

  it('matches the known SHA-256 test vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('computeInputsHashSync is the exact sync twin of computeInputsHash', () => {
  const profile = {
    id: 'profile-1',
    pfaStartYear: 2020,
    fiscalYear: 2026,
    regime: 'impozit_pe_venit' as const,
    salaryStatus: 'nu' as const,
    pensionStatus: 'nu' as const,
    otherIncome: [] as [],
    socialInsuranceStatus: 'neplata' as const,
    vatExempt: false,
    cashFloorLei: 0,
    identity: {
      nume: 'Popescu Andrei',
      cnp: '1900101223344',
      adresa: 'Str. Florilor 12, Bucuresti',
      telefon: '0712345678',
      email: 'andrei@example.com',
      denumire: 'Popescu Consulting SRL',
      cui: 'RO12345678',
      formaJuridica: 'PFA',
      numarRegComert: 'J40/1234/2020',
      adresaSocietate: 'Str. Florilor 12, Bucuresti',
      telefonSocietate: '0712345678',
      emailSocietate: 'contact@popescu-consulting.ro',
      contBancar: 'RO24ABCDEFTREASURABANK001',
      banca: 'BCR',
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const inputs: CalculationInput[] = [
    { profile, revenues: 1000, expenses: 400 },
    { profile, revenues: 0, expenses: 0 },
    { profile: { ...profile, pfaStartDate: '2020-01-01', salaryIncomeLei: 6000 }, revenues: 523456.78, expenses: 0 },
    // The exact shape a v0→v1 migration produces: identity gains fields, the
    // deprecated profile.caen string is still embedded.
    {
      profile: {
        ...profile,
        caen: '6201',
        identity: { ...profile.identity, caen: [{ cod: '6201', descriere: '' }] },
      },
      revenues: 1000,
      expenses: 400,
    },
  ];

  it.each(inputs.map((input, i) => [i, input] as const))(
    'input #%i digests identically sync and async',
    async (_i, input) => {
      expect(computeInputsHashSync(input)).toBe(await computeInputsHash(input));
    },
  );

  it('is order-independent like canonicalize', () => {
    const a = computeInputsHashSync({ profile, revenues: 1000, expenses: 400 });
    const reordered = computeInputsHashSync({
      expenses: 400,
      revenues: 1000,
      profile: Object.fromEntries(Object.entries(profile).reverse()) as typeof profile,
    });
    expect(a).toBe(reordered);
  });

  it('changes when the embedded profile gains a key (why migration must re-derive)', () => {
    const before = computeInputsHashSync({ profile, revenues: 1000, expenses: 400 });
    const after = computeInputsHashSync({
      profile: { ...profile, identity: { ...profile.identity, codTvaIntra: '' } },
      revenues: 1000,
      expenses: 400,
    });
    expect(before).not.toBe(after);
    expect(canonicalize({ a: 1 })).not.toBe(canonicalize({ a: 1, b: 0 }));
  });
});
