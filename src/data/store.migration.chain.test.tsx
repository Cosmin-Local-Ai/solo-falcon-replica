/**
 * Phase 7 — the persisted-data version chain, end to end.
 *
 * Two layers on purpose:
 *  1. the pure chain (`migratePersistedData`) so each step's effect is checkable
 *     without React, and
 *  2. the store load path, so the chain is proven to be the thing that actually
 *     runs when the app opens a payload written by an older build.
 *
 * Acceptance criteria covered here: 2 (legacy payload migrates and keeps its
 * data — asserted BY ID), 3 (a pre-Phase-7 payload including its STORED
 * SNAPSHOTS still loads, i.e. F-1 handled rather than avoided), and the F-2
 * load-path half: a payload already at the current version is never re-hashed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider, useStore, STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './store';
import {
  CURRENT_DATA_VERSION,
  DATA_VERSION_BASE,
  DATA_VERSION_DATES,
  DATA_VERSION_VAT_DATE,
  DATA_VERSION_MONEY_BANI,
  DATA_VERSION_EXPENSE_CATEGORY,
  DATA_VERSION_TAX_RESERVE,
  DATA_VERSION_PENSION_FACTS,
  DATA_VERSION_RULE_SET_DIGEST,
  DATA_VERSION_IDENTITY,
  DATA_VERSION_PROFILE,
  MIGRATION_CHAIN,
  UnsupportedDataVersionError,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { canonicalize } from '../domain/snapshots/serialize';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type { PfaProfile } from '../domain/models';
import type { AppData, Client, Declaration, Expense, Revenue } from './types';
import { lei, type Bani } from '../domain/money';

let storeRef: ReturnType<typeof useStore> | null = null;
function Probe() {
  storeRef = useStore();
  return null;
}

function load(): void {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

/**
 * A revenue/expenses/clients/declarations set with STABLE ids, so "the data
 * survived" is asserted by identity and not merely by the app rendering.
 */
const revenues: Revenue[] = [
  {
    id: 'r-legacy-1',
    tip: 'factura',
    nr: 'FCT-2025-001',
    date: '2025-03-15',
    client: 'Client Vechi',
    cui: 'RO11111111',
    valoareFaraTva: lei(10000),
    tva: lei(1900),
    status: 'inregistrata',
  },
  {
    id: 'r-legacy-2',
    tip: 'factura',
    nr: 'FCT-2025-002',
    date: '2025-09-02',
    client: 'Alt Client',
    cui: 'RO22222222',
    valoareFaraTva: lei(5000),
    tva: lei(950),
    status: 'inregistrata',
  },
];
const expenses: Expense[] = [
  {
    id: 'e-legacy-1',
    tip: 'factura',
    nr: 'CH-2025-001',
    date: '2025-04-01',
    furnizor: 'Furnizor Vechi',
    cui: 'RO33333333',
    valoareFaraTva: lei(1000),
    tva: lei(190),
    status: 'inregistrata',
  },
];
const clients: Client[] = [
  { id: 'c-legacy-1', denumire: 'Client Vechi', cui: 'RO11111111', email: 'vechi@example.test' },
];
const declarations: Declaration[] = [
  {
    id: 'd-legacy-1',
    an: 2025,
    luna: 3,
    venituri: lei(10000),
    cheltuieli: lei(1000),
    status: 'inregistrata',
    dataInregistrare: '2025-04-10',
  },
];

/**
 * A profile exactly as it looked BEFORE Phase 7: the deprecated `caen` string,
 * and an `identity` carrying only the 14 fields that existed then.
 */
function prePhase7Profile(): PfaProfile & { caen?: string } {
  const profile = JSON.parse(JSON.stringify(seedData.profile)) as PfaProfile & { caen?: string };
  delete profile.caen;
  const identity = profile.identity as unknown as Record<string, unknown>;
  delete identity.codTvaIntra;
  delete identity.caen;
  delete identity.mentiuniFactura;
  profile.caen = '6201';
  return profile;
}

/**
 * A snapshot as it would be stored by a pre-Phase-7 build: its embedded profile
 * is the old shape, and `inputsHash` is the digest recorded at calculation time.
 */
/**
 * A pre-v5 payload stores money as plain LEI. Every fixture in this file is such a payload, so its
 * amounts are deliberately NOT bani even though the types say they are — the brand describes the
 * post-migration world, and `migrateMoneyBaniV5` is what turns these numbers into bani. Naming the
 * lie in one helper keeps it from being mistaken for a real `Bani` value.
 */
const legacyLei = (amount: number): Bani => amount as unknown as Bani;

function prePhase7Snapshot(calculationId: string, revenuesValueLei: number): TaxCalculationSnapshot {
  const profile = prePhase7Profile();
  const inputSnapshot = {
    profile,
    revenues: legacyLei(revenuesValueLei),
    expenses: legacyLei(400),
  };
  return {
    calculationId,
    taxYear: 2026,
    calculatedAt: '2026-05-01T10:00:00.000Z',
    ruleRelease: seedData.snapshots[0]?.ruleRelease ?? {
      releaseId: 'rel-legacy',
      name: '2026.1',
      jurisdiction: 'RO',
      entityType: 'pfa',
      taxYear: 2026,
      ruleIds: [],
      status: 'SAFE_ACTIVATION',
      effectiveFrom: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
      evidence: [],
    },
    inputSnapshot,
    // The digest the calculating build recorded. Deliberately computed here so
    // the test can prove the migrated digest differs from it.
    inputsHash: computeInputsHashSync(inputSnapshot),
    calculationLines: [{ label: 'Impozit estimat', value: legacyLei(1000) }],
    output: { total: legacyLei(1000) },
    status: 'computed',
  };
}

function prePhase7Payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: AppData = {
    reservedAmount: null,
    profile: seedData.profile,
    revenues,
    expenses,
    clients,
    declarations,
    documents: [],
    companyDocs: { im: [], cs: [], tva: [], facturi: [] },
    statements: [],
    snapshots: [],
    settings: seedData.settings,
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  storeRef = null;
});

describe('migration chain (pure)', () => {
  it('covers the Phase 6 profile backfill, the Phase 7 identity absorption, the Phase 9 payment dates, the VAT exceedance date, the Phase 10 money scale, the TASK 2b expense category, the TASK 3 tax reserve, the TASK 5 pension facts and the TASK 6 rule-set digest as separate steps', () => {
    expect(MIGRATION_CHAIN.map((s) => [s.from, s.to])).toEqual([
      [DATA_VERSION_BASE, DATA_VERSION_PROFILE],
      [DATA_VERSION_PROFILE, DATA_VERSION_IDENTITY],
      [DATA_VERSION_IDENTITY, DATA_VERSION_DATES],
      [DATA_VERSION_DATES, DATA_VERSION_VAT_DATE],
      [DATA_VERSION_VAT_DATE, DATA_VERSION_MONEY_BANI],
      [DATA_VERSION_MONEY_BANI, DATA_VERSION_EXPENSE_CATEGORY],
      [DATA_VERSION_EXPENSE_CATEGORY, DATA_VERSION_TAX_RESERVE],
      [DATA_VERSION_TAX_RESERVE, DATA_VERSION_PENSION_FACTS],
      [DATA_VERSION_PENSION_FACTS, DATA_VERSION_RULE_SET_DIGEST],
    ]);
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_RULE_SET_DIGEST);
  });

  // Phase 9 acceptance criterion 4: a payload written by a newer build is refused loudly rather
  // than silently down-migrated. Asserted on the PURE chain here; the load-path half is the
  // quarantine test below.
  it('throws UnsupportedDataVersionError for a version newer than the chain', () => {
    const payload = prePhase7Payload({ version: CURRENT_DATA_VERSION + 1 });
    expect(() => migratePersistedData(payload as never)).toThrow(UnsupportedDataVersionError);
  });

  // Phase 9: the v2→v3 step widens the schema and NOTHING MORE. It must not manufacture a
  // collection or payment event that the payload never recorded — absence is the honest state, and
  // an invented one would be indistinguishable from a recorded fact.
  it('the payment-dates step backfills nothing: collected/paid stay absent', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_IDENTITY });
    const outcome = migratePersistedData(payload as never);
    // The chain runs to the current version, so the money-scale step follows; it converts
    // amounts and invents no fields, which is what the assertions below check.
    expect(outcome.stepsApplied).toEqual(['payment-dates', 'vat-exceedance-date', 'money-bani', 'expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    for (const r of outcome.data.revenues) {
      expect('collected' in r).toBe(false);
    }
    const expenses = outcome.data.expenses ?? [];
    for (const e of expenses) {
      expect('paid' in e).toBe(false);
    }
    // Every record survives the step unchanged and by id.
    expect(outcome.data.revenues.map((r) => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
    expect(expenses.map((e) => e.id)).toEqual(['e-legacy-1']);
  });

  // P-PROFILE-VAT-DATE: same discipline one version later. The v3→v4 step widens the profile
  // schema and invents nothing — no legacy field records when the plafon was crossed, and a
  // manufactured exceedance date would manufacture a filing deadline.
  it('the VAT exceedance-date step backfills nothing: the field stays absent', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_DATES });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_DATES);
    expect(outcome.stepsApplied).toEqual(['vat-exceedance-date', 'money-bani', 'expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect('vatExceedanceDate' in outcome.data.profile!).toBe(false);
    // And nothing else about the profile moved.
    expect(outcome.data.profile).toEqual(seedData.profile);
  });

  it('treats a payload with no version key as the base of the chain', () => {
    const payload = prePhase7Payload({ version: undefined });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_BASE);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect(outcome.migrated).toBe(true);
    expect(outcome.stepsApplied).toEqual([
      'profile-materialization',
      'identity-absorption',
      'payment-dates',
      'vat-exceedance-date',
      'money-bani',
      'expense-category',
      'tax-reserve',
      'pension-facts',
      'rule-set-digest',
    ]);
    expect(outcome.data.version).toBe(CURRENT_DATA_VERSION);
  });

  // TASK 2b: the v5→v6 step widens the expense schema and NOTHING MORE. Every pre-v6 expense is a real
  // invoice and it would be easy to guess a category from the supplier name — but a category decides
  // whether the amount enters the deductible base, so a guess would manufacture the user's tax position.
  // Absence is carried forward instead: an uncategorised expense classifies as `undetermined`.
  it('the expense-category step backfills nothing: the field stays absent and every record survives by id', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_MONEY_BANI });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_MONEY_BANI);
    expect(outcome.stepsApplied).toEqual(['expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    const migrated = outcome.data.expenses ?? [];
    expect(migrated.map((e) => e.id)).toEqual(['e-legacy-1']);
    for (const e of migrated) {
      expect('category' in e).toBe(false);
    }
  });

  // A payload that already carries a category keeps it byte-for-byte: the step neither validates nor
  // rewrites it, so loading a classified payload can never lose the classification.
  it('keeps an expense category that is already on the payload, unchanged', () => {
    const payload = prePhase7Payload({
      version: DATA_VERSION_MONEY_BANI,
      expenses: [{ ...expenses[0], category: 'rent_business_space' }],
    });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.stepsApplied).toEqual(['expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(outcome.data.expenses?.[0].category).toBe('rent_business_space');
  });

  // TASK 3: the v6→v7 step widens the dataset with `reservedAmount` and NOTHING MORE. A reserve is a
  // fact about cash the user physically set aside; no legacy field records it, so writing `0` would
  // manufacture a claim about the user's money — and would silently clear the „Rezervă fiscală sub
  // țintă” warning for every upgraded install, which is the opposite of making it clearable.
  it('the tax-reserve step backfills nothing: reservedAmount stays absent and every record survives by id', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_EXPENSE_CATEGORY });
    // The fixture carries the field for the runtime type; a pre-v7 payload genuinely does not.
    delete payload.reservedAmount;
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_EXPENSE_CATEGORY);
    expect(outcome.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // Absence carried forward verbatim — not `null`, not `0`, not an empty string.
    expect('reservedAmount' in outcome.data).toBe(false);
    // And nothing else about the payload moved.
    expect(outcome.data.revenues.map((r) => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
    expect(outcome.data.expenses?.map((e) => e.id)).toEqual(['e-legacy-1']);
    expect(outcome.data.profile).toEqual(seedData.profile);
  });

  // A payload that already carries a reserve keeps it byte-for-byte: the step neither validates nor
  // rewrites it, so an explicit 0 lei can never be upgraded away and a recorded amount can never be
  // scaled. An explicit zero is a fact the user recorded, not a gap to fill.
  it('keeps a reserved amount that is already on the payload, unchanged — including an explicit 0', () => {
    const withAmount = migratePersistedData(
      prePhase7Payload({ version: DATA_VERSION_EXPENSE_CATEGORY, reservedAmount: lei(25000) }) as never,
    );
    expect(withAmount.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest']);
    expect(withAmount.data.reservedAmount).toBe(lei(25000));

    const explicitZero = migratePersistedData(
      prePhase7Payload({ version: DATA_VERSION_EXPENSE_CATEGORY, reservedAmount: 0 }) as never,
    );
    expect(explicitZero.data.reservedAmount).toBe(0);
  });

  // TASK 5: the v7→v8 step renames ONE key and widens the profile. It must not manufacture the fact the
  // CASS relief turns on. An old `pensionStatus: 'da'` recorded *calitatea de pensionar*; it never
  // recorded whether pension sums were received in the income year. Writing a receipt record from it
  // would grant a tax relief out of a boolean — and writing `received: 'nu'` would refuse one out of the
  // same boolean. Both are legal conclusions the data does not support.
  it('the pension-facts step carries the status across and backfills NO receipt fact: an old `da` becomes unknown, not a relief', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_TAX_RESERVE });
    payload.profile = { ...prePhase7Profile(), pensionStatus: 'da' };
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_TAX_RESERVE);
    expect(outcome.stepsApplied).toEqual(['pension-facts', 'rule-set-digest']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // The status fact travels, under the name that says what it is.
    expect(outcome.data.profile!.pensionerStatus).toBe('da');
    // The deprecated key is gone from the live profile — it was folded, not duplicated.
    expect(outcome.data.profile!.pensionStatus).toBeUndefined();
    // And the receipt fact stays ABSENT: neither `da` (a granted relief) nor `nu` (a refused one).
    expect(outcome.data.profile!.pensionReceiptYears).toBeUndefined();
    expect('pensionReceiptYears' in outcome.data.profile!).toBe(false);
    expect(outcome.data.profile!.cassPreviousYearContext).toBeUndefined();
    expect(outcome.data.profile!.foreignSicknessInsurance).toBeUndefined();
    expect(outcome.data.profile!.pensionSuspensionYears).toBeUndefined();
    // Nothing else about the profile moved.
    expect(outcome.data.profile!.regime).toBe('impozit_pe_venit');
    expect(outcome.data.revenues.map((r) => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
  });

  it('the pension-facts step leaves a `nu` status as a `nu` status — it never infers a receipt either way', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_TAX_RESERVE });
    payload.profile = { ...prePhase7Profile(), pensionStatus: 'nu' };
    const profile = migratePersistedData(payload as never).data.profile!;
    expect(profile.pensionerStatus).toBe('nu');
    expect(profile.pensionStatus).toBeUndefined();
    expect(profile.pensionReceiptYears).toBeUndefined();
  });

  it('the pension-facts step leaves a profile that already carries the new facts completely alone', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_TAX_RESERVE });
    payload.profile = {
      ...prePhase7Profile(),
      pensionerStatus: 'da',
      pensionReceiptYears: [{ fiscalYear: 2026, received: 'da' }],
      pensionSuspensionYears: [{ fiscalYear: 2026, months: [3, 4] }],
      cassPreviousYearContext: { previousFiscalYear: 2025, inExceptedCategory: 'nu' },
      foreignSicknessInsurance: { fiscalYear: 2026, held: 'da', proved: 'nu' },
    };
    const profile = migratePersistedData(payload as never).data.profile!;
    expect(profile.pensionerStatus).toBe('da');
    expect(profile.pensionReceiptYears).toEqual([{ fiscalYear: 2026, received: 'da' }]);
    expect(profile.pensionSuspensionYears).toEqual([{ fiscalYear: 2026, months: [3, 4] }]);
    expect(profile.cassPreviousYearContext).toEqual({ previousFiscalYear: 2025, inExceptedCategory: 'nu' });
    expect(profile.foreignSicknessInsurance).toEqual({ fiscalYear: 2026, held: 'da', proved: 'nu' });
  });

  // The step edits the LIVE profile only. `buildInputSnapshot` embeds the profile a calculation was made
  // with, so a stored snapshot keeps its own bytes and its digest must not move — the same landmine TASK 3
  // pinned for `tax-reserve`, now on a step that really does rewrite a profile.
  it('the pension-facts step moves no stored snapshot digest', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_TAX_RESERVE, profile: prePhase7Profile(), snapshots: [legacy] });
    payload.profile = { ...prePhase7Profile(), pensionStatus: 'da' };
    const outcome = migratePersistedData(payload as never);
    const stored = outcome.data.snapshots![0];
    // The live profile was renamed…
    expect(outcome.data.profile!.pensionerStatus).toBe('da');
    expect(outcome.data.profile!.pensionStatus).toBeUndefined();
    // …and the stored record is byte-for-byte what it was, digest included: it still describes the
    // inputs the calculation actually saw, and no re-hash marker was written.
    expect(stored.inputSnapshot).toEqual(legacy.inputSnapshot);
    expect(stored.inputsHash).toBe(legacy.inputsHash);
    expect(stored.preMigrationInputsHash).toBeUndefined();
    expect(stored.inputsHash).toBe(computeInputsHashSync(stored.inputSnapshot));
  });

  it('materializes a missing profile from settings instead of leaving it undefined', () => {
    const payload = prePhase7Payload();
    delete payload.profile;
    const outcome = migratePersistedData(payload as never);
    expect(outcome.data.profile).toBeDefined();
    expect(outcome.data.profile!.identity.nume).toBe(seedData.settings.personal.nume);
    expect(outcome.data.profile!.identity.denumire).toBe(seedData.settings.company.denumire);
  });

  it('absorbs the fields only settings.company used to carry', () => {
    // A legacy settings block that DOES carry them — the current seed does not,
    // which is exactly why these fields must stay optional in the schema.
    const settings = {
      ...seedData.settings,
      company: {
        ...seedData.settings.company,
        codTvaIntra: 'RO9999999999999',
        mentiuniFactura: 'De plată la 30 de zile.',
      },
    };
    const outcome = migratePersistedData(prePhase7Payload({ settings, profile: prePhase7Profile() }) as never);
    const identity = outcome.data.profile!.identity;
    expect(identity.codTvaIntra).toBe('RO9999999999999');
    expect(identity.mentiuniFactura).toBe('De plată la 30 de zile.');
    expect(identity.caen).toEqual(seedData.settings.company.caen);
    expect(identity.numarRegComert).toBe(seedData.settings.company.numarRegComert);
  });

  it('leaves an absorbed field absent when no legacy payload carries it', () => {
    const outcome = migratePersistedData(prePhase7Payload({ profile: prePhase7Profile() }) as never);
    expect(outcome.data.profile!.identity.codTvaIntra).toBeUndefined();
    expect(outcome.data.profile!.identity.mentiuniFactura).toBeUndefined();
  });

  it('never overwrites an identity value the profile already carries', () => {
    const settings = {
      ...seedData.settings,
      company: { ...seedData.settings.company, codTvaIntra: 'RO9999999999999' },
    };
    // The profile (current shape) already has a cod TVA intracomunitar; the
    // legacy settings block must not clobber it.
    const outcome = migratePersistedData(prePhase7Payload({ settings }) as never);
    expect(outcome.data.profile!.identity.codTvaIntra).toBe(seedData.profile.identity.codTvaIntra);
  });

  it('drops the deprecated profile.caen from the live profile once folded', () => {
    const outcome = migratePersistedData(prePhase7Payload({ profile: prePhase7Profile() }) as never);
    expect((outcome.data.profile as { caen?: unknown }).caen).toBeUndefined();
    expect(outcome.data.profile!.identity.caen).toEqual(seedData.settings.company.caen);
  });

  it('is a no-op for a payload already at the current version', () => {
    const payload = prePhase7Payload({ version: CURRENT_DATA_VERSION });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.migrated).toBe(false);
    expect(outcome.stepsApplied).toEqual([]);
    expect(outcome.data).toEqual(payload);
  });
});

/** One pre-Phase-7 snapshot, reused across the snapshot and load-path groups. */
const legacy = prePhase7Snapshot('calc-legacy-1', 15000);

describe('stored snapshots survive the migration (F-1, acceptance criterion 3)', () => {
  it('keeps every stored snapshot by calculationId', () => {
    const payload = prePhase7Payload({
      profile: prePhase7Profile(),
      snapshots: [legacy, prePhase7Snapshot('calc-legacy-2', 9000)],
    });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.data.snapshots!.map((s) => s.calculationId)).toEqual([
      'calc-legacy-1',
      'calc-legacy-2',
    ]);
  });

  // TASK 3 landmine, asserted rather than assumed. The v6→v7 step adds a top-level `AppData` field.
  // `createCalculationSnapshot` hashes `inputSnapshot = { profile, revenues, expenses }` — an
  // explicitly enumerated subset, not the dataset object — and `canonicalize` walks only the keys
  // present in THAT object, so a new top-level field never reaches the digest. If this assertion ever
  // fails, a stored record has been made to claim something other than what it contained at
  // calculation time, and a blanket re-hash migration would be the wrong fix.
  it('the tax-reserve step moves no stored digest', () => {
    const stored = prePhase7Snapshot('calc-v6-1', 15000);
    const payload = prePhase7Payload({
      version: DATA_VERSION_EXPENSE_CATEGORY,
      profile: prePhase7Profile(),
      snapshots: [stored],
    });
    delete payload.reservedAmount;
    const outcome = migratePersistedData(payload as never);
    expect(outcome.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest']);
    const [after] = outcome.data.snapshots!;
    expect(after.inputSnapshot).toEqual(stored.inputSnapshot);
    expect(after.inputsHash).toBe(stored.inputsHash);
    // No re-hash marker: nothing was re-derived, because nothing inside the hashed subset moved.
    expect(after.preMigrationInputsHash).toBeUndefined();
    expect(after.inputsHash).toBe(computeInputsHashSync(after.inputSnapshot));
  });

  /*
   * TASK 6 — the v8→v9 step, and the two things it must refuse to do.
   *
   * A stored snapshot gains `ruleSetHash`, and the value it gains is `null`. Computing today's rule-set
   * digest and stamping it onto a years-old record would assert that today's arithmetic is the arithmetic
   * that produced that number — and the rule set has moved three times (CAS, CASS, income tax) under an
   * unchanged `releaseId`, so that claim would be false. `null` is the record admitting it cannot be
   * reproduced. Same discipline as the pension-facts step refusing to mint a receipt fact.
   */
  it('the rule-set-digest step stamps ruleSetHash: null and invents no digest', () => {
    const stored = prePhase7Snapshot('calc-v8-1', 15000);
    const payload = prePhase7Payload({
      version: DATA_VERSION_PENSION_FACTS,
      profile: prePhase7Profile(),
      snapshots: [stored],
    });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.stepsApplied).toEqual(['rule-set-digest']);
    const [after] = outcome.data.snapshots!;
    // The record now says out loud that its rules cannot be reconstructed…
    expect(after.ruleSetHash).toBeNull();
    // …while everything it DID record stays exactly as it was, digest included.
    expect(after.inputSnapshot).toEqual(stored.inputSnapshot);
    expect(after.inputsHash).toBe(stored.inputsHash);
    expect(after.preMigrationInputsHash).toBeUndefined();
    expect(after.calculationLines).toEqual(stored.calculationLines);
    expect(after.output).toEqual(stored.output);
  });

  it('the rule-set-digest step does not retrofit a contentHash onto an embedded rule release', () => {
    const stored = prePhase7Snapshot('calc-v8-2', 15000);
    const payload = prePhase7Payload({
      version: DATA_VERSION_PENSION_FACTS,
      profile: prePhase7Profile(),
      snapshots: [stored],
    });
    const after = migratePersistedData(payload as never).data.snapshots![0];
    // The embedded release is a historical copy. Minting `contentHash` / `lifecycle` / `version` for it
    // would describe a release nobody recorded at the time the calculation ran.
    expect(after.ruleRelease).toEqual(stored.ruleRelease);
    expect(after.ruleRelease.contentHash).toBeUndefined();
    expect(after.ruleRelease.lifecycle).toBeUndefined();
    expect(after.ruleRelease.version).toBeUndefined();
  });

  it('leaves a snapshot that already carries a ruleSetHash untouched', () => {
    const pinned = { ...prePhase7Snapshot('calc-v8-3', 15000), ruleSetHash: 'a'.repeat(64) };
    const payload = prePhase7Payload({
      version: DATA_VERSION_PENSION_FACTS,
      profile: prePhase7Profile(),
      snapshots: [pinned],
    });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.data.snapshots![0]).toEqual(pinned);
  });

  it("backfills the embedded profile's CAEN from the snapshot's OWN deprecated string", () => {
    const payload = prePhase7Payload({ profile: prePhase7Profile(), snapshots: [legacy] });
    const outcome = migratePersistedData(payload as never);
    const embedded = outcome.data.snapshots![0].inputSnapshot.profile;
    expect(embedded.identity.caen).toEqual([{ cod: '6201', descriere: '' }]);
    expect((embedded as { caen?: unknown }).caen).toBeUndefined();
  });

  it('does NOT write today into a historical snapshot', () => {
    // codTvaIntra / mentiuniFactura have no source inside the snapshot, so they
    // stay absent: a snapshot is an audit record of one past calculation.
    const payload = prePhase7Payload({ profile: prePhase7Profile(), snapshots: [legacy] });
    const embedded = migratePersistedData(payload as never).data.snapshots![0].inputSnapshot.profile;
    expect(embedded.identity.codTvaIntra).toBeUndefined();
    expect(embedded.identity.mentiuniFactura).toBeUndefined();
  });

  it('re-derives inputsHash and keeps the calculation-time digest', () => {
    const payload = prePhase7Payload({ profile: prePhase7Profile(), snapshots: [legacy] });
    const migrated = migratePersistedData(payload as never).data.snapshots![0];
    // The stored digest still matches the stored input — the provenance contract
    // (`snapshots.test.ts`) holds for migrated snapshots too.
    expect(migrated.inputsHash).toBe(computeInputsHashSync(migrated.inputSnapshot));
    expect(migrated.inputsHash).not.toBe(legacy.inputsHash);
    expect(migrated.preMigrationInputsHash).toBe(legacy.inputsHash);
  });

  it('leaves the fiscal policy inputs byte-identical and scales the money inside a snapshot exactly once', () => {
    // The recorded `output` must still correspond to the inputs it was computed from. Phase 10
    // changes the SCALE of every amount inside a snapshot, so "byte-identical" can no longer hold
    // for money; what has to hold is that the rule-selecting inputs do not move at all, and that
    // every amount is multiplied by exactly 100 — once, not twice, and not per field inconsistently.
    const policyKeys = (p: PfaProfile) =>
      canonicalize({
        regime: p.regime,
        salaryStatus: p.salaryStatus,
        pensionStatus: p.pensionStatus,
        otherIncome: p.otherIncome,
        socialInsuranceStatus: p.socialInsuranceStatus,
        vatExempt: p.vatExempt,
        fiscalYear: p.fiscalYear,
        pfaStartDate: p.pfaStartDate ?? null,
      });
    const payload = prePhase7Payload({ profile: prePhase7Profile(), snapshots: [legacy] });
    const migrated = migratePersistedData(payload as never).data.snapshots![0];
    expect(policyKeys(migrated.inputSnapshot.profile)).toBe(policyKeys(legacy.inputSnapshot.profile));
    expect(migrated.inputSnapshot.revenues).toBe(lei(legacy.inputSnapshot.revenues));
    expect(migrated.inputSnapshot.expenses).toBe(lei(legacy.inputSnapshot.expenses));
    expect(migrated.output).toEqual({ total: lei(legacy.output.total) });
    expect(migrated.calculationLines.map((l) => l.value)).toEqual([lei(1000)]);
    // The profile fields that carry money follow the same single scaling; the ones that do not
    // carry money are untouched.
    expect(migrated.inputSnapshot.profile.cashFloorLei).toBe(lei(legacy.inputSnapshot.profile.cashFloorLei));
    expect(migrated.inputSnapshot.profile.fiscalYear).toBe(legacy.inputSnapshot.profile.fiscalYear);
  });

  it('leaves the digest alone when the identity step has nothing to add, and re-derives it when the money step does', () => {
    // The identity-absorption step genuinely has nothing to add here, so on its own it would leave
    // the snapshot byte-identical and keep the digest. The money-scale step does have something to
    // say — it rewrites every amount — so the digest MUST move and the calculation-time digest MUST
    // survive beside it. That is the provenance contract, not a regression.
    const alreadyCurrent: TaxCalculationSnapshot = {
      ...legacy,
      inputSnapshot: {
        ...legacy.inputSnapshot,
        profile: { ...seedData.profile }, // already carries identity.caen
      },
    };
    const payload = prePhase7Payload({ snapshots: [alreadyCurrent] });
    const migrated = migratePersistedData(payload as never).data.snapshots![0];
    expect(migrated.preMigrationInputsHash).toBe(alreadyCurrent.inputsHash);
    expect(migrated.inputsHash).not.toBe(alreadyCurrent.inputsHash);
    expect(migrated.inputsHash).toBe(computeInputsHashSync(migrated.inputSnapshot));
    expect(migrated.inputSnapshot.revenues).toBe(lei(alreadyCurrent.inputSnapshot.revenues));
  });
});

describe('load path runs the chain (acceptance criteria 2 and 3)', () => {
  it('loads a versionless payload, migrates it, and keeps every collection by id', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prePhase7Payload()));
    load();
    expect(storeRef!.dataOrigin).toBe('persisted');
    expect(storeRef!.revenues.map((r) => r.id)).toEqual(['r-legacy-1', 'r-legacy-2']);
    expect(storeRef!.expenses.map((e) => e.id)).toEqual(['e-legacy-1']);
    expect(storeRef!.clients.map((c) => c.id)).toEqual(['c-legacy-1']);
    expect(storeRef!.declarations.map((d) => d.id)).toEqual(['d-legacy-1']);
    expect(storeRef!.dataVersion).toBe(CURRENT_DATA_VERSION);
    expect(storeRef!.migration).toEqual({
      fromVersion: DATA_VERSION_BASE,
      toVersion: CURRENT_DATA_VERSION,
      stepsApplied: [
        'profile-materialization',
        'identity-absorption',
        'payment-dates',
        'vat-exceedance-date',
        'money-bani',
        'expense-category',
        'tax-reserve',
        'pension-facts',
        'rule-set-digest',
      ],
    });
    // Not the seed: the seed's ids are different.
    expect(storeRef!.revenues).not.toEqual(seedData.revenues);
  });

  it('loads a pre-Phase-7 payload that CONTAINS stored snapshots', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(prePhase7Payload({ profile: prePhase7Profile(), snapshots: [legacy] })),
    );
    load();
    expect(storeRef!.snapshots.map((s) => s.calculationId)).toEqual(['calc-legacy-1']);
    expect(storeRef!.getSnapshot('calc-legacy-1')?.status).toBe('computed');
    expect(storeRef!.profile.identity.caen).toEqual(seedData.settings.company.caen);
  });

  it('never re-hashes a current-version payload on load (F-2 load path)', () => {
    const snapshot = prePhase7Snapshot('calc-current-1', 20000);
    const payload = prePhase7Payload({
      version: CURRENT_DATA_VERSION,
      snapshots: [snapshot],
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    load();
    const loaded = storeRef!.snapshots.find((s) => s.calculationId === 'calc-current-1')!;
    expect(loaded.inputsHash).toBe(snapshot.inputsHash);
    expect(loaded.preMigrationInputsHash).toBeUndefined();
    expect(storeRef!.migration).toBeNull();
  });

  it('quarantines a payload written by a NEWER build instead of down-migrating it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(prePhase7Payload({ version: CURRENT_DATA_VERSION + 1 })),
    );
    load();
    expect(storeRef!.dataOrigin).toBe('quarantined');
    expect(storeRef!.quarantine!.reason).toBe('unsupported-version');
    expect(storeRef!.revenues).toEqual(seedData.revenues);
    const preserved = JSON.parse(localStorage.getItem(QUARANTINE_STORAGE_KEY)!) as {
      reason: string;
      raw: string;
    };
    expect(preserved.reason).toBe('unsupported-version');
    // Written from the CURRENT build forward, so it tracks the version constant instead of a literal.
    expect(preserved.raw).toContain(`"version":${CURRENT_DATA_VERSION + 1}`);
  });
});
