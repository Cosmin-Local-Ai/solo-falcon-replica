import { describe, expect, it } from 'vitest';
import { parseAppData } from './schema';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';
import type { RuleRelease } from '../domain/fiscal/rules';

/** A minimal-but-valid persisted dataset, used as the test baseline. */
function baseline(): AppData {
  return {
    profile: seedData.profile,
    revenues: [
      {
        id: 'r1',
        tip: 'factura',
        nr: 'FCT-2026-001',
        date: '2026-03-15',
        client: 'Presta Consulting SRL',
        cui: 'RO12345678',
        valoareFaraTva: 1000,
        tva: 190,
        status: 'inregistrata',
      },
    ],
    expenses: [],
    clients: [],
    declarations: [],
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
  };
}

function write(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...baseline(), ...overrides });
}

const validRevenue: Revenue = baseline().revenues[0];

const validRelease: RuleRelease = {
  releaseId: 'rel-1',
  name: '2026.1',
  jurisdiction: 'RO',
  entityType: 'pfa',
  taxYear: 2026,
  ruleIds: [],
  status: 'SAFE_ACTIVATION',
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  evidence: [],
};

describe('parseAppData — valid payloads', () => {
  it('accepts a fully valid dataset and returns it unchanged', () => {
    const data = baseline();
    expect(parseAppData(JSON.stringify(data))).toEqual(data);
  });

  it('accepts a payload missing all optional collections', () => {
    const base = baseline();
    const minimal = parseAppData(JSON.stringify({ revenues: base.revenues, settings: base.settings }));
    expect(minimal).not.toBeNull();
    expect(minimal?.revenues).toEqual(base.revenues);
    expect(minimal?.settings).toEqual(base.settings);
    expect(minimal?.profile).toBeUndefined();
    expect(minimal?.snapshots).toBeUndefined();
    expect(minimal?.expenses).toBeUndefined();
    expect(minimal?.clients).toBeUndefined();
    expect(minimal?.declarations).toBeUndefined();
    expect(minimal?.documents).toBeUndefined();
    expect(minimal?.companyDocs).toBeUndefined();
    expect(minimal?.statements).toBeUndefined();
  });

  it('strips unknown extra fields', () => {
    const parsed = parseAppData(write({ someUnknownField: { a: 1 } }));
    expect(parsed).not.toBeNull();
    expect(parsed && 'someUnknownField' in (parsed as object)).toBe(false);
  });

  it('accepts an empty revenues array (valid, not corrupt)', () => {
    const parsed = parseAppData(write({ revenues: [] }));
    expect(parsed).not.toBeNull();
    expect(parsed?.revenues).toEqual([]);
  });

  it('accepts a fully valid snapshot (all required fields present)', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026',
        taxYear: 2026,
        calculatedAt: '2026-09-01T00:00:00.000Z',
        ruleRelease: validRelease,
        inputSnapshot: { profile: seedData.profile, revenues: 1000, expenses: 0 },
        inputsHash: 'abc123',
        calculationLines: [{ label: 'total', value: 100 }],
        output: { total: 100 },
        status: 'computed',
      },
    ];
    const parsed = parseAppData(write({ snapshots }));
    expect(parsed).not.toBeNull();
    expect(parsed?.snapshots).toHaveLength(1);
  });

  it('accepts a person-only profile (empty company identity)', () => {
    const profile = {
      ...seedData.profile,
      identity: {
        ...seedData.profile.identity,
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
    };
    const parsed = parseAppData(write({ profile }));
    expect(parsed).not.toBeNull();
    expect(parsed?.profile?.identity.cui).toBe('');
  });
});

describe('parseAppData — corrupt payloads return null', () => {
  it('returns null for unparseable JSON', () => {
    expect(parseAppData('{not json')).toBeNull();
    expect(parseAppData('')).toBeNull();
    expect(parseAppData('null')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseAppData('"just a string"')).toBeNull();
    expect(parseAppData('42')).toBeNull();
    expect(parseAppData('[1, 2, 3]')).toBeNull();
    expect(parseAppData('true')).toBeNull();
  });

  it('returns null when the required revenues collection is missing', () => {
    const { revenues, ...rest } = baseline();
    void revenues;
    expect(parseAppData(JSON.stringify(rest))).toBeNull();
  });

  it('returns null when revenues is not an array', () => {
    expect(parseAppData(write({ revenues: 'nope' }))).toBeNull();
    expect(parseAppData(write({ revenues: null }))).toBeNull();
  });

  it('returns null for invalid revenue numbers', () => {
    expect(parseAppData(write({ revenues: [{ ...validRevenue, valoareFaraTva: -5 }] }))).toBeNull();
    expect(parseAppData(write({ revenues: [{ ...validRevenue, tva: '190' }] }))).toBeNull();
    expect(parseAppData(write({ revenues: [{ ...validRevenue, tva: -1 }] }))).toBeNull();
  });

  it('returns null for a revenue with an empty id', () => {
    expect(parseAppData(write({ revenues: [{ ...validRevenue, id: '' }] }))).toBeNull();
  });

  it('returns null for an invalid revenue status', () => {
    expect(parseAppData(write({ revenues: [{ ...validRevenue, status: 'plata' }] }))).toBeNull();
  });

  it('returns null for invalid expense entries', () => {
    expect(parseAppData(write({ expenses: [{ ...seedData.expenses[0], valoareFaraTva: -5 }] }))).toBeNull();
    expect(parseAppData(write({ expenses: [{ ...seedData.expenses[0], status: 'plata' }] }))).toBeNull();
    expect(parseAppData(write({ expenses: [{ ...seedData.expenses[0], tip: 'chec' }] }))).toBeNull();
    expect(parseAppData(write({ expenses: [{ ...seedData.expenses[0], id: '' }] }))).toBeNull();
  });

  it('returns null for invalid client entries', () => {
    expect(parseAppData(write({ clients: [{ ...seedData.clients[0], id: '' }] }))).toBeNull();
    expect(parseAppData(write({ clients: [{ ...seedData.clients[0], denumire: '' }] }))).toBeNull();
  });

  it('returns null for invalid document entries', () => {
    expect(parseAppData(write({ documents: [{ ...seedData.documents[0], id: '' }] }))).toBeNull();
    expect(parseAppData(write({ documents: [{ ...seedData.documents[0], nume: '' }] }))).toBeNull();
  });

  it('returns null for invalid company document entries (any of the 4 kinds)', () => {
    const im = seedData.companyDocs.im[0];
    const f = seedData.companyDocs.facturi[0];
    expect(parseAppData(write({ companyDocs: { ...seedData.companyDocs, im: [{ ...im, tip: 'docx' }] } }))).toBeNull();
    expect(parseAppData(write({ companyDocs: { ...seedData.companyDocs, cs: [{ ...im, marime: -1 }] } }))).toBeNull();
    expect(parseAppData(write({ companyDocs: { ...seedData.companyDocs, tva: [{ ...im, id: '' }] } }))).toBeNull();
    expect(parseAppData(write({ companyDocs: { ...seedData.companyDocs, facturi: [{ ...f, nume: '' }] } }))).toBeNull();
  });

  it('returns null when the required settings collection is missing', () => {
    const { settings, ...rest } = baseline();
    void settings;
    expect(parseAppData(JSON.stringify(rest))).toBeNull();
  });

  it('returns null for an empty settings object', () => {
    expect(parseAppData(write({ settings: {} }))).toBeNull();
  });

  it('returns null for settings with a missing company block', () => {
    const { company, ...rest } = seedData.settings;
    void company;
    expect(parseAppData(write({ settings: rest }))).toBeNull();
  });

  it('returns null for an out-of-range cotaTva', () => {
    expect(parseAppData(write({ settings: { ...seedData.settings, cotaTva: 150 } }))).toBeNull();
    expect(parseAppData(write({ settings: { ...seedData.settings, cotaTva: -1 } }))).toBeNull();
  });

  it('accepts cotaTva at the inclusive bounds 0 and 100', () => {
    expect(parseAppData(write({ settings: { ...seedData.settings, cotaTva: 0 } }))).not.toBeNull();
    expect(parseAppData(write({ settings: { ...seedData.settings, cotaTva: 100 } }))).not.toBeNull();
  });

  it('returns null for an invalid bank account entry', () => {
    const bankAccounts = [{ ...seedData.settings.bankAccounts[0], moneda: 123 }];
    expect(parseAppData(write({ settings: { ...seedData.settings, bankAccounts } }))).toBeNull();
  });

  it('returns null for an invalid profile (bad regime)', () => {
    expect(parseAppData(write({ profile: { ...seedData.profile, regime: 'impozit_pe_cit2' } }))).toBeNull();
  });

  it('returns null for a null profile (present but not a valid profile)', () => {
    expect(parseAppData(write({ profile: null }))).toBeNull();
  });

  it('returns null for an invalid declaration entry', () => {
    const declarations = [{ ...seedData.declarations[0], status: 'saptamanal' }];
    expect(parseAppData(write({ declarations }))).toBeNull();
  });

  it('returns null for an invalid statement entry', () => {
    const statements = [{ ...seedData.statements[0], depunere: 'plata2' }];
    expect(parseAppData(write({ statements }))).toBeNull();
  });

  it('returns null for a snapshot with a missing output field', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026',
        taxYear: 2026,
        calculatedAt: '2026-09-01T00:00:00.000Z',
        ruleRelease: validRelease,
        inputSnapshot: { profile: seedData.profile, revenues: 1000, expenses: 0 },
        inputsHash: 'abc123',
        calculationLines: [],
        status: 'computed',
      },
    ];
    expect(parseAppData(write({ snapshots }))).toBeNull();
  });

  it('returns null for a snapshot with an invalid embedded release', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026',
        taxYear: 2026,
        calculatedAt: '2026-09-01T00:00:00.000Z',
        ruleRelease: { ...validRelease, releaseId: '' },
        inputSnapshot: { profile: seedData.profile, revenues: 1000, expenses: 0 },
        inputsHash: 'abc123',
        calculationLines: [],
        output: { total: 100 },
        status: 'computed',
      },
    ];
    expect(parseAppData(write({ snapshots }))).toBeNull();
  });
});
