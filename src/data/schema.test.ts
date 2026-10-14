import { describe, expect, it } from 'vitest';
import { parseAppData } from './schema';
import { seedData } from './seed';
import type { AppData, Revenue } from './types';
import type { RuleRelease } from '../domain/fiscal/rules';
import { lei, ron } from '../domain/money';

/** A minimal-but-valid persisted dataset, used as the test baseline. */
function baseline(): AppData {
  return {
    reservedAmount: null,
    profile: seedData.profile,
    revenues: [
      {
        id: 'r1',
        tip: 'factura',
        nr: 'FCT-2026-001',
        date: '2026-03-15',
        client: 'Codexa SRL',
        cui: 'RO12345678',
        valoareFaraTva: ron(1000),
        tva: ron(190),
        status: 'inregistrata',
      },
    ],
    expenses: [],
    clients: [],
    filings: [],
    // PG-6g: a fixture with no periodic VAT return recorded. Absent would be a different
    // claim, and `[]` here is what `emptyData()` and the v18→v19 step produce.
    vatReturns: [],
    occupancySheets: [],
    vehicles: [],
    // PG-6e (B-31, D-FA-1): an empty register — no asset has been declared. Required on the
    // loaded object, resolved from an absent key by the load path, never defaulted by a step.
    fixedAssets: [],
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

  // TASK 2b: `category` is declared in `expenseSchema` for the same reason `moneyNotices` is — zod
  // STRIPS undeclared keys, so a field that exists only on the TS type would be erased on the next
  // load and the user's classification would silently disappear.
  it('keeps an expense category through the parse gate', () => {
    const parsed = parseAppData(
      write({ expenses: [{ ...seedData.expenses[0], category: 'postal_and_telecom' }] }),
    );
    expect(parsed?.expenses?.[0].category).toBe('postal_and_telecom');
  });

  it('accepts an expense with no category — absence is legal input, not corruption', () => {
    const { category: _category, ...uncategorised } = seedData.expenses[0];
    const parsed = parseAppData(write({ expenses: [uncategorised] }));
    expect(parsed).not.toBeNull();
    // Absent, not null: a stored null would fail this same gate on the NEXT load and quarantine the
    // payload, which is why the form writes an absent field rather than a null.
    expect(parsed?.expenses?.[0] && 'category' in parsed.expenses[0]).toBe(false);
  });

  // PG-6e (B-31, D-FA-1): `fixedAssets` is declared in `persistedAppDataSchema` for the same reason
  // `category` and `reservedAmount` are — zod STRIPS undeclared keys, so a register that lived only on the
  // TypeScript type would be erased on the next save-and-load, and the taxpayer would lose the register
  // OMFP 170/2015 obliges them to keep, with no error anywhere to show it.
  it('keeps the fixed-asset register through the parse gate', () => {
    const parsed = parseAppData(write({
      fixedAssets: [{
        id: 'a1',
        label: 'Utilaj de birou',
        entryDate: '2026-02-10',
        fiscalValue: 12000000,
      }],
    }));
    expect(parsed?.fixedAssets).toHaveLength(1);
    expect(parsed?.fixedAssets?.[0].label).toBe('Utilaj de birou');
    // Every other fact stays absent unless it was written — the gate neither defaults nor backfills.
    expect('putInFunctionDate' in parsed!.fixedAssets![0]!).toBe(false);
    expect('normalLifeMonths' in parsed!.fixedAssets![0]!).toBe(false);
  });

  it('accepts a payload with no fixedAssets key at all — a pre-v17 write is not corruption', () => {
    const preV17 = JSON.stringify(
      Object.fromEntries(Object.entries(baseline()).filter(([k]) => k !== 'fixedAssets')),
    );
    const parsed = parseAppData(preV17);
    expect(parsed).not.toBeNull();
    expect(parsed && 'fixedAssets' in (parsed as object)).toBe(false);
  });

  it('is permissive about an asset money shape and strict about a negative one — the same split as every other collection', () => {
    // The gate checks shape, not arithmetic: a fractional stored value is what the v5 `money-bani` step
    // exists to notice and report, and a gate that silently converts is a gate that decides. A negative
    // depreciable value, by contrast, is not a shape this application will hold.
    const fractional = parseAppData(write({
      fixedAssets: [{ id: 'a1', label: 'X', entryDate: '2026-02-10', fiscalValue: 12000.5 }],
    }));
    expect(fractional).not.toBeNull();
    const negative = parseAppData(write({
      fixedAssets: [{ id: 'a1', label: 'X', entryDate: '2026-02-10', fiscalValue: -1 }],
    }));
    expect(negative).toBeNull();
  });

  it('refuses a category outside the rule vocabulary — the token space belongs to the rules, not to free text', () => {
    // Only a build with a wider vocabulary could write such a token, and that payload is already
    // refused by its version number before this gate matters. Pinning it here keeps `category` from
    // quietly becoming a free-text field the classifier would answer `undetermined` for.
    const parsed = parseAppData(write({ expenses: [{ ...seedData.expenses[0], category: 'aleatoriu' }] }));
    expect(parsed).toBeNull();
  });

  // TASK 3: `reservedAmount` is declared in `persistedAppDataSchema` for the same reason `category`
  // and `moneyNotices` are — zod STRIPS undeclared keys, so a reserve that lived only on the TS type
  // would be erased on the next load and the „Rezervă fiscală sub țintă” warning would silently come
  // back. This is the gate that makes the reload acceptance criterion possible at all.
  it('keeps a recorded reserve through the parse gate', () => {
    const parsed = parseAppData(write({ reservedAmount: lei(250) }));
    expect(parsed?.reservedAmount).toBe(lei(250));
  });

  // The tri-state, at the gate. `null` is a recorded state („no reserve”), `0` is a different recorded
  // state („recorded nothing”), and absence is a third (a pre-v7 payload). Collapsing any two of them
  // is the defect this task exists to close.
  it('keeps an explicit null reserve — null is a recorded state, not corruption and not 0', () => {
    const parsed = parseAppData(write({ reservedAmount: null }));
    expect(parsed).not.toBeNull();
    expect(parsed?.reservedAmount).toBeNull();
    expect(parsed?.reservedAmount).not.toBe(0);
  });

  it('keeps an explicit 0 lei reserve, distinct from null', () => {
    const parsed = parseAppData(write({ reservedAmount: 0 }));
    expect(parsed).not.toBeNull();
    expect(parsed?.reservedAmount).toBe(0);
  });

  it('refuses a negative reserve instead of clamping it — corrupt money quarantines, it does not guess', () => {
    // Clamping on the way IN would rewrite the user's ledger without telling them; the load path
    // quarantines the payload and preserves the bytes instead.
    expect(parseAppData(write({ reservedAmount: -1 }))).toBeNull();
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
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        calculationLines: [{ label: 'total', value: lei(100) }],
        output: { total: lei(100) },
        status: 'computed',
      },
    ];
    const parsed = parseAppData(write({ snapshots }));
    expect(parsed).not.toBeNull();
    expect(parsed?.snapshots).toHaveLength(1);
  });

  /*
   * B-109 — the load-bearing test for adding `assetRegisterHash` as an optional key with NO chain step.
   *
   * The payload below is not authored for this test. It is a snapshot produced by the PRE-CHANGE code at
   * commit `72b50c5` — captured by a throwaway probe recorded in commit `4bb68d3`, then pasted here verbatim
   * — so it is a real record from the tree before the key existed, with no `assetRegisterHash` key at all.
   * It must still parse, still round-trip, and still carry the same `inputsHash`. If a later edit makes the
   * new key required, or moves it into `inputSnapshot`, this test is what fails.
   */
  const PRE_CHANGE_SNAPSHOT = {
    calculationId: 'calc-2025-003f86de-2b94-462d-9a52-253f7ef78d82',
    taxYear: 2025,
    calculatedAt: '2026-10-14T15:56:00.672Z',
    ruleRelease: {
      releaseId: 'rel-2025-001',
      name: 'PFA 2025 rules',
      jurisdiction: 'RO',
      entityType: 'PFA',
      taxYear: 2025,
      ruleIds: ['rule-2025-1'],
      status: 'SAFE_ACTIVATION',
      effectiveFrom: '2025-01-01',
      createdAt: '2025-01-01T00:00:00.000Z',
      evidence: ['https://example.com/legis-2025'],
    },
    ruleSetHash: 'df6ec4fcf54864070ff7e1f264f15e41046ffd68cd6742770e75d935a2892724',
    inputSnapshot: {
      profile: {
        id: 'pfa-test',
        pfaStartYear: 2020,
        fiscalYear: 2025,
        regime: 'impozit_pe_venit',
        caen: '6201',
        salaryStatus: 'nu',
        pensionerStatus: 'nu',
        socialInsuranceStatus: 'obligatoriu',
        vatRegistration: { status: 'scutit_art310' },
        cashFloorLei: 0,
        identity: {
          nume: 'Enache Sorin',
          cnp: '0123456789012',
          adresa: 'Str. Test 1, Bucuresti',
          telefon: '0700000000',
          email: 'sorin@example.com',
          denumire: '',
          cui: '',
          formaJuridica: 'PFA',
          numarRegComert: '',
          adresaSocietate: '',
          telefonSocietate: '',
          emailSocietate: '',
          contBancar: '',
          banca: '',
        },
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      revenues: 100000,
      expenses: 40000,
    },
    inputsHash: '88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a',
    calculationLines: [],
    output: { total: 0 },
    status: 'computed',
  };

  it('a pre-B-109 snapshot payload with no assetRegisterHash key still parses, and its inputsHash is unchanged', () => {
    // The key is absent, not null: this record was written before the register was ever addressed, and no
    // digest added later can honestly supply one.
    expect('assetRegisterHash' in PRE_CHANGE_SNAPSHOT).toBe(false);
    const raw = write({ snapshots: [PRE_CHANGE_SNAPSHOT] });
    const parsed = parseAppData(raw);
    expect(parsed).not.toBeNull();
    const snap = parsed!.snapshots?.[0];
    expect(snap).toBeDefined();
    expect(snap!.assetRegisterHash).toBeUndefined();
    // The stored digest is untouched — this is the whole reason the new field is a sibling and not a member.
    expect(snap!.inputsHash).toBe('88215ab2b0aa3b03fd87f17225234f24458a494768da0b66ecb4f433a27b7b0a');
    expect(Object.keys(snap!.inputSnapshot).sort()).toEqual(['expenses', 'profile', 'revenues']);
    // And it round-trips: re-serialising what parse produced parses to the same record, with nothing added.
    const again = parseAppData(JSON.stringify({ ...baseline(), snapshots: [snap] }));
    expect(again).not.toBeNull();
    expect(again!.snapshots?.[0]).toEqual(snap);
  });

  // B-19: the marker that tells a consumer a CASS figure is not grounded in a rule must survive the
  // load path. zod strips unknown keys by default, so an undeclared marker would be erased on load
  // and the unverified zero would come back as a plain fact — the exact failure this phase closes.
  it('keeps a line-level review_required marker through the persisted schema', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026-b19',
        taxYear: 2026,
        calculatedAt: '2026-09-01T00:00:00.000Z',
        ruleRelease: validRelease,
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        calculationLines: [
          {
            label: 'CASS (exceptat — art. 154 alin. (1); temeiul nu a fost verificat)',
            value: lei(0),
            reviewRequired: true,
            reason: 'art. 154 alin. (1) este o listă închisă și nu acoperă un PFA',
          },
          { label: 'Total taxe', value: lei(0) },
        ],
        output: { total: lei(0) },
        status: 'computed',
      },
    ];
    const parsed = parseAppData(write({ snapshots }));
    expect(parsed).not.toBeNull();
    const lines = parsed?.snapshots?.[0].calculationLines ?? [];
    expect(lines).toHaveLength(2);
    expect(lines[0].reviewRequired).toBe(true);
    expect(lines[0].reason).toContain('art. 154 alin. (1)');
    // A grounded line keeps having NO marker — absence is meaningful here, not missing data.
    expect(lines[1].reviewRequired).toBeUndefined();
  });

  /*
   * TASK 6 — `ruleSetHash` and the widened release fields have to be DECLARED in the zod schema, not
   * merely present in the TypeScript type. zod strips undeclared keys, so an undeclared digest would come
   * back absent: a record that silently stops claiming which rules produced it, which is the exact
   * failure this phase is about.
   */
  it('keeps ruleSetHash and the TASK 6 release fields through the persisted schema', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026-task6',
        taxYear: 2026,
        calculatedAt: '2026-10-09T00:00:00.000Z',
        ruleRelease: {
          ...validRelease,
          lifecycle: 'ACTIVE',
          version: 1,
          effectiveTo: null,
          contentHash: 'c'.repeat(64),
        },
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        ruleSetHash: 'd'.repeat(64),
        calculationLines: [{ label: 'Total taxe', value: lei(0) }],
        output: { total: lei(0) },
        status: 'computed',
      },
    ];
    const parsed = parseAppData(write({ snapshots }));
    expect(parsed).not.toBeNull();
    const snap = parsed!.snapshots![0];
    expect(snap.ruleSetHash).toBe('d'.repeat(64));
    expect(snap.ruleRelease.contentHash).toBe('c'.repeat(64));
    expect(snap.ruleRelease.lifecycle).toBe('ACTIVE');
    expect(snap.ruleRelease.version).toBe(1);
    expect(snap.ruleRelease.effectiveTo).toBeNull();
  });

  it('accepts ruleSetHash: null — a record saying its rules cannot be reconstructed', () => {
    const snapshots = [
      {
        calculationId: 'calc-2025-old',
        taxYear: 2025,
        calculatedAt: '2025-06-01T00:00:00.000Z',
        ruleRelease: validRelease,
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        ruleSetHash: null,
        calculationLines: [],
        output: { total: lei(0) },
        status: 'computed',
      },
    ];
    const parsed = parseAppData(write({ snapshots }));
    expect(parsed).not.toBeNull();
    expect(parsed!.snapshots![0].ruleSetHash).toBeNull();
  });

  it('returns null for a ruleSetHash that is neither a string nor null', () => {
    const snapshots = [
      {
        calculationId: 'calc-2026-bad',
        taxYear: 2026,
        calculatedAt: '2026-10-09T00:00:00.000Z',
        ruleRelease: validRelease,
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        ruleSetHash: 17,
        calculationLines: [],
        output: { total: lei(0) },
        status: 'computed',
      },
    ];
    expect(parseAppData(write({ snapshots }))).toBeNull();
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
    expect(parseAppData(write({ revenues: [{ ...validRevenue, valoareFaraTva: ron(-5) }] }))).toBeNull();
    expect(parseAppData(write({ revenues: [{ ...validRevenue, tva: '190' }] }))).toBeNull();
    expect(parseAppData(write({ revenues: [{ ...validRevenue, tva: ron(-1) }] }))).toBeNull();
  });

  it('returns null for a revenue with an empty id', () => {
    expect(parseAppData(write({ revenues: [{ ...validRevenue, id: '' }] }))).toBeNull();
  });

  it('returns null for an invalid revenue status', () => {
    expect(parseAppData(write({ revenues: [{ ...validRevenue, status: 'plata' }] }))).toBeNull();
  });

  it('returns null for invalid expense entries', () => {
    expect(parseAppData(write({ expenses: [{ ...seedData.expenses[0], valoareFaraTva: ron(-5) }] }))).toBeNull();
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
    // PG-5b: the monthly record type is gone from the application, but this key still parses. That is
    // deliberate — zod strips undeclared keys, so a payload whose `declarations` were stripped at the gate
    // would lose its rows before the migration chain ran, and it is the `annual-filing` step that is
    // supposed to decide to drop them. A corrupt row still quarantines the payload rather than loading a
    // quietly-shrunken one, exactly as before.
    // TASK 9: built from a local fixture instead of `seedData.declarations[0]`, which the seed no longer
    // carries. Spreading `undefined` would have left this test asserting that `{status: 'saptamanal'}`
    // fails to parse — true for the wrong reason (it is missing every required field), and it would have
    // stopped testing the status enum, which is the thing under test.
    const declaration = {
      id: 'd1',
      an: 2026,
      luna: 3,
      venituri: 1250000,
      cheltuieli: 180000,
      status: 'inregistrata',
      dataInregistrare: '2026-04-10',
    };
    const declarations = [{ ...declaration, status: 'saptamanal' }];
    expect(parseAppData(write({ declarations }))).toBeNull();
    // The same record with a valid status does parse, so the rejection above is the status and not the
    // shape.
    expect(parseAppData(write({ declarations: [declaration] }))).not.toBeNull();
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
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
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
        inputSnapshot: { profile: seedData.profile, revenues: lei(1000), expenses: lei(0) },
        inputsHash: 'abc123',
        calculationLines: [],
        output: { total: lei(100) },
        status: 'computed',
      },
    ];
    expect(parseAppData(write({ snapshots }))).toBeNull();
  });
});
