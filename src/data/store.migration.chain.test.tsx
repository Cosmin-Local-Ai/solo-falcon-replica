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
  DATA_VERSION_RECORD_CURRENCY,
  DATA_VERSION_ANNUAL_FILING,
  DATA_VERSION_ACTIVITY_FAMILY,
  DATA_VERSION_ACCOMMODATION_FACTS,
  DATA_VERSION_OCCUPANCY_SHEET,
  DATA_VERSION_VEHICLE_FACTS,
  DATA_VERSION_OTHER_INCOME_LADDER,
  DATA_VERSION_FIXED_ASSETS,
  DATA_VERSION_INPUT_VAT,
  DATA_VERSION_VAT_RETURNS,
  // B-105 — the version that opens `profile.leaseFactsYears`.
  DATA_VERSION_LEASE_FACTS,
  // PG-11 — the shape declaration for a document's blob pointer; no longer the head.
  DATA_VERSION_DOCUMENT_BLOB_REF,
  // B-140 (D-EFACT-1) — the head of the chain after brief 76: the e-Factura deadline preference retired.
  DATA_VERSION_EFACTURA_DEADLINE,
  // B-108 — the head of the chain after brief 76's second step: `Expense.assetId` opens.
  DATA_VERSION_EXPENSE_ASSET_LINK,
  // B-65 / brief 76 — the head of the chain after brief 76's third step: `FixedAsset.disposalProceeds` opens.
  DATA_VERSION_DISPOSAL_PROCEEDS,
  // B-145 — and after its fourth: a carried-in fiscal loss can be persisted.
  DATA_VERSION_PRIOR_YEAR_LOSSES,
  // D-DPI-2 (B-152) — and after brief 78's: a ladder category can record „nu am avut” as a fact of the
  // person, distinct from nobody having asked. This is the head.
  DATA_VERSION_LADDER_ANSWERS,
  DATA_VERSION_IDENTITY,
  DATA_VERSION_PROFILE,
  MIGRATION_CHAIN,
  UnsupportedDataVersionError,
  migratePersistedData,
} from './migration';
import { seedData } from './seed';
import { canonicalize } from '../domain/snapshots/serialize';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import { SYNTHETIC_SHEET } from '../test/occupancyFixtures';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import type { PfaProfile } from '../domain/models';
// D-DPI-2 — the resolver and the refusal the v26 step is judged against, read from the migrated payload.
import {
  CASS_LADDER_CATEGORY_NAMES,
  cassLadderFactsForYear,
  cassLadderMissingCategories,
} from '../domain/models';
import { calculatorRegistry } from '../domain/fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../domain/fiscal/package2026';
import type { Client, LegacyAppData, LegacyExpense, LegacyRevenue } from './types';
import type { LegacyMonthlyDeclaration } from './schema';
import { lei, type Bani } from '../domain/money';

let storeRef: ReturnType<typeof useStore> | null = null;
// D-DPI-2 — the rule the ladder calculator runs on, so the migrated payload can be pushed through the real
// calculator rather than through a paraphrase of it.
const cassRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CASS_2026')!;
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
const revenues: LegacyRevenue[] = [
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
const expenses: LegacyExpense[] = [
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
// The pre-v11 monthly row. It stays in the legacy payload because that is what an old payload looks
// like; the `annual-filing` step is what drops it (PG-5b), so the fixture is storage, not a record.
const declarations: LegacyMonthlyDeclaration[] = [
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
  const base: LegacyAppData = {
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
      [DATA_VERSION_RULE_SET_DIGEST, DATA_VERSION_RECORD_CURRENCY],
      // PG-5: the monthly→legacy rename plus the annual register. Appended, never renumbered.
      [DATA_VERSION_RECORD_CURRENCY, DATA_VERSION_ANNUAL_FILING],
      // PG-6b: the profile may now record a declared activity family. Appended, never renumbered — and
      // the step backfills nothing, which is the property the test below this one guards.
      [DATA_VERSION_ANNUAL_FILING, DATA_VERSION_ACTIVITY_FAMILY],
      [DATA_VERSION_ACTIVITY_FAMILY, DATA_VERSION_ACCOMMODATION_FACTS],
      // PG-6h-3: the dataset may now hold the occupancy sheet (OPANAF 381/2026). Appended after v13,
      // never renumbered — and the step backfills nothing, which the test below this one guards.
      [DATA_VERSION_ACCOMMODATION_FACTS, DATA_VERSION_OCCUPANCY_SHEET],
      // PG-6c (D-VEH-3): the dataset may now record vehicles with per-car, per-year facts. Appended after
      // v14, never renumbered — and the step backfills nothing and attributes nothing, which the test
      // below the occupancy one guards.
      [DATA_VERSION_OCCUPANCY_SHEET, DATA_VERSION_VEHICLE_FACTS],
      // PG-6d (D-OTH-1, D-OTH-2, D-LEG-1, B-41): the per-year art. 155 alin. (1) lit. c)-h) amounts open,
      // and the retired other-income flags are dropped. Appended after v15, never renumbered — and the step
      // converts no flag into an amount, which is the property the test below this one guards.
      [DATA_VERSION_VEHICLE_FACTS, DATA_VERSION_OTHER_INCOME_LADDER],
      // PG-6e (B-31, D-FA-1): the dataset may now record fixed assets with the facts the fiscal
      // depreciation arithmetic needs. Appended after v16, never renumbered — and the step backfills
      // nothing and converts no expense into an asset, which the test below the vehicle one guards.
      [DATA_VERSION_OTHER_INCOME_LADDER, DATA_VERSION_FIXED_ASSETS],
      // PG-6f (B-30, D-LEG-1): the profile's retired `vatExempt` boolean is dropped and the registration
      // state it stood in for is NOT minted in its place. Appended after v17, never renumbered — and the
      // step backfills nothing, which is the property the test below this one guards.
      [DATA_VERSION_FIXED_ASSETS, DATA_VERSION_INPUT_VAT],
      // PG-6g (B-35 residual, D-VAT-1): the dataset may now record the periodic VAT returns (formular 300,
      // OPANAF 174/2026). Appended after v18, never renumbered — and the step opens the collection EMPTY,
      // which is the property the test below this one guards: a fiscal period existing is no evidence that
      // a return for it was filed.
      [DATA_VERSION_INPUT_VAT, DATA_VERSION_VAT_RETURNS],
      // B-105: the profile may now record the three lease facts that decide which ordinary *cedarea
      // folosinței bunurilor* regime a register falls under. Appended after v19, never renumbered — and the
      // step opens `profile.leaseFactsYears` by writing nothing, because the tenant's legal nature, who pays
      // the owner's costs, and whether the rent is paid exclusively in kind are all facts only the person
      // knows, and each one moves the tax.
      [DATA_VERSION_VAT_RETURNS, DATA_VERSION_LEASE_FACTS],
      // PG-11 (phase 29): a document record may now carry `blobRef` — a pointer to bytes held outside
      // `localStorage` — instead of the bytes themselves. Appended after v20, never renumbered. This is the
      // one step in the chain whose whole subject is the **persisted shape**, and it is also the one step
      // that a later phase must not mistake for the thing that moves the data: the bytes are moved by an
      // asynchronous relocation pass outside the chain, because the chain is synchronous end to end. It
      // fills nothing in, and a payload that already carries pointers is left untouched.
      [DATA_VERSION_LEASE_FACTS, DATA_VERSION_DOCUMENT_BLOB_REF],
      // B-140 (D-EFACT-1): the e-Factura sending-deadline preference is retired. Appended after v21, never
      // renumbered. This is the first step of brief 76's four, and it is first because it is the only one
      // that REPAIRS a value rather than opening a field: the load gate used to refuse `'2-zile'` outright,
      // so a payload carrying it reached no step at all. The read vocabulary in `data/schema.ts` had to be
      // widened for the step to be the thing that decides — brief 67's finding, pinned in
      // `migration.efactura-deadline.test.ts`.
      [DATA_VERSION_DOCUMENT_BLOB_REF, DATA_VERSION_EFACTURA_DEADLINE],
      // B-108: an expense may now name the fixed asset it belongs to. Appended after v22, never renumbered.
      // The step opens the field and attributes NOTHING — matching a typed line to an asset by amount, date
      // or supplier is the inference art. 68 alin. (4) lit. d) was already read as not licensing, and a
      // guessed link would narrow the depreciation conflict on a fiction.
      [DATA_VERSION_EFACTURA_DEADLINE, DATA_VERSION_EXPENSE_ASSET_LINK],
      // B-65 (carried from brief 74): a disposed asset may now record what it brought in, which is the fact
      // Titlul IV pct. 7 alin. (5) lit. o) measures the unamortised residual against. Appended after v23,
      // never renumbered. The step backfills NOTHING — a sale price is a fact about a transaction, and
      // deriving one from the fiscal value or the residual would invent the number the norm measures against.
      [DATA_VERSION_EXPENSE_ASSET_LINK, DATA_VERSION_DISPOSAL_PROCEEDS],
      // B-145: a carried-in fiscal loss can now be persisted, which is the fact art. 118 alin. (4)-(5) need
      // and that brief 70 could only take as an in-memory argument. Appended after v24, never renumbered.
      // The step backfills NOTHING — a carried-in loss is a fact about a filed return.
      [DATA_VERSION_DISPOSAL_PROCEEDS, DATA_VERSION_PRIOR_YEAR_LOSSES],
      // D-DPI-2 (B-152, unblocking B-116): a ladder category may now record that the person was asked and
      // answered „nu am avut”. Appended after v25, never renumbered. The step backfills NOTHING, and that
      // is the entire content of it: every payload in existence has never seen these six questions, so every
      // payload must land on `unknown`. A step that defaulted them to `none` would assert in the person's
      // name that they have no other income and then compute a CASS base out of that assertion.
      [DATA_VERSION_PRIOR_YEAR_LOSSES, DATA_VERSION_LADDER_ANSWERS],
    ]);
    // Brief 76: the head moved by exactly one per step, and no rung was inserted, renumbered or skipped.
    // Brief 78 appended v26 on top of that head; v22-v25 were not touched.
    expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION_LADDER_ANSWERS);
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
    expect(outcome.stepsApplied).toEqual(['payment-dates', 'vat-exceedance-date', 'money-bani', 'expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', // B-105 — the lease-facts step, appended after v19.
      'lease-facts',
      // PG-11 — appended after v20; it opens no collection and fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['vat-exceedance-date', 'money-bani', 'expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    expect('vatExceedanceDate' in outcome.data.profile!).toBe(false);
    // And nothing else about the profile moved.
    expect(outcome.data.profile).toEqual(seedData.profile);
  });

  // PG-6b (B-29): the same discipline two versions later. The v11→v12 step widens the profile schema and
  // invents nothing — no legacy field records which activity family a person has, and defaulting the
  // answer to `'other'` would assert that the sistem real rules apply to somebody who was never asked.
  // `research/30` §3 is the reason the default is forbidden rather than merely unkind: OMFP 925/2017
  // art. 2 alin. (4) keys the determination method to the activity description „independent de codurile
  // CAEN menționate cu titlu exemplificativ”, so the payload's CAEN list is not an answer either.
  it('the activity-family step backfills nothing: an unanswered profile stays unanswered', () => {
    // The demo profile DECLARES a family, so it is stripped here: this must be a payload that never
    // answered, which is the only shape the step can actually be tested against. Copied, never mutated —
    // `seedData.profile` is shared by every test in this file.
    const unanswered = { ...seedData.profile } as PfaProfile;
    delete unanswered.activityFamily;
    const payload = prePhase7Payload({ version: DATA_VERSION_ANNUAL_FILING, profile: unanswered });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_ANNUAL_FILING);
    expect(outcome.stepsApplied).toEqual(['activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // Absence survives. This is the whole content of the step, and the half that a `?? 'other'` would
    // have destroyed silently: the payload would have come out looking like one that answered.
    expect('activityFamily' in outcome.data.profile!).toBe(false);
    // A declared family passes through untouched — the step neither overwrites nor re-reads it.
    const declared = migratePersistedData(
      prePhase7Payload({ version: DATA_VERSION_ANNUAL_FILING, profile: { ...seedData.profile, activityFamily: 'cazare' } }) as never,
    );
    expect(declared.data.profile!.activityFamily).toBe('cazare');
  });

  // PG-6h-2 (B-82, B-84) — the v12→v13 step, and the acceptance criterion that makes this task exist:
  // **a migration that invents a room count invents a tax category.** 1–7 rooms is *cedarea folosinței
  // bunurilor* (art. 83 alin. (2), art. 85); peste 7 camere is a activitate independentă under art. 68^3
  // (art. 83 alin. (4)). The step therefore writes no count, no commission reading and no eligibility
  // answer, and a payload that never answered comes out still unanswered — which is what lets
  // `scenarios.ts` refuse instead of asserting a title.
  it('the accommodation-facts step backfills nothing: no room count, no commission reading, no eligibility', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_ACTIVITY_FAMILY });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_ACTIVITY_FAMILY);
    expect(outcome.stepsApplied).toEqual(['accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    const profile = outcome.data.profile!;
    // Absence, asserted three ways — each of these would be a legal fact the person never stated.
    expect('accommodationRoomCounts' in profile).toBe(false);
    expect('accommodationCommissionReading' in profile).toBe(false);
    expect('accommodationTourismEligibility' in profile).toBe(false);
    // Idempotent-safe under the chain contract: the step writes a version and touches no value, so a
    // payload already at 13 is returned byte-equal by the runner (no step matches `from`).
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
    // A declared count passes through untouched — the step neither overwrites nor re-reads it.
    const declared = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_ACTIVITY_FAMILY,
        profile: { ...seedData.profile, accommodationRoomCounts: [{ fiscalYear: 2027, rooms: 9 }] },
      }) as never,
    );
    expect(declared.data.profile!.accommodationRoomCounts).toEqual([{ fiscalYear: 2027, rooms: 9 }]);
  });

  /*
   * B-105 — v19 → v20, `lease-facts`.
   *
   * The step opens `profile.leaseFactsYears` and writes nothing into it, and the reason is the same one every
   * other step here gives, sharpened: each fact this key would hold decides a legal outcome on its own.
   * The tenant's legal nature moves the income between art. 84 and art. 84^1, and with it moves who computes
   * the tax, whether it is final, and whether the owner files a return for it. Whether the tenant paid the
   * owner's costs changes the gross the 20 % ratio runs on. Whether the rent was paid in kind, or a guarantee
   * was applied to it, switches the withholding off entirely. A default for any of them is not a missing
   * value — it is a different taxpayer.
   */
  it('the lease-facts step backfills nothing: no tenant nature, no uplift, no alin. (8) trigger', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_VAT_RETURNS });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_VAT_RETURNS);
    expect(outcome.stepsApplied).toEqual(['lease-facts', 'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    const profile = outcome.data.profile!;
    // Absence, asserted for each fact family the key would hold. An empty array would be the same lie in a
    // different costume — it would read as „this person declared no leases”, which is a statement the step
    // has no evidence for.
    expect('leaseFactsYears' in profile).toBe(false);
    // Idempotent under the chain contract: the step writes a version and touches no value.
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
    // A declared fact set passes through untouched — the step neither overwrites it nor re-reads it.
    const declared = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_VAT_RETURNS,
        profile: {
          ...seedData.profile,
          leaseFactsYears: [{ fiscalYear: 2027, tenantNature: 'entitate_cu_evidenta_contabila' }],
        },
      }) as never,
    );
    expect(declared.data.profile!.leaseFactsYears).toEqual([
      { fiscalYear: 2027, tenantNature: 'entitate_cu_evidenta_contabila' },
    ]);
  });

  /*
   * PG-6h-3 (D-OCC-1) — v13 → v14, `occupancy-sheet`.
   *
   * For this collection "backfills nothing" is not a convention, it is the only safe behaviour. A sheet
   * records other people's names and identity numbers on a document the taxpayer is required to keep, so
   * a step that opened the collection — with `[]`, with a placeholder, or by deriving one from the
   * recorded room count — would mint identities that never existed. `docs/ai/phases/38_pg6h2_accommodation_facts.md`
   * already warns that the room count must not be used as an occupancy record; a migration that bridged
   * the two would be exactly that bridge, and it would be invisible.
   *
   * The key stays **absent**, not `[]`: „no sheet has been made” and „sheets were made and none exist” are
   * different claims, and the load path is the one place that resolves absence to an empty collection.
   */
  it('the occupancy-sheet step backfills nothing: no key, no placeholder sheet, no derived stay', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_ACCOMMODATION_FACTS });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_ACCOMMODATION_FACTS);
    expect(outcome.stepsApplied).toEqual(['occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // The whole contract, in one line: the step writes a version and nothing else.
    expect('occupancySheets' in outcome.data).toBe(false);
    // Not even an empty array — that would be a written claim, not an absence.
    expect(outcome.data.occupancySheets).toBeUndefined();
    // And the step does not reach sideways into the profile to invent one from the room count.
    expect('accommodationRoomCounts' in outcome.data.profile!).toBe(false);
    // Idempotent-safe under the chain contract: already at 14, no step matches `from`, byte-equal out.
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
    // A sheet the taxpayer really made passes through untouched — the step neither rewrites a stay nor
    // re-dates a form. (The fixture is synthetic: see the comment at its definition.)
    const withSheet = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_ACCOMMODATION_FACTS,
        occupancySheets: [SYNTHETIC_SHEET],
      }) as never,
    );
    expect(withSheet.data.occupancySheets).toEqual([SYNTHETIC_SHEET]);
  });

  /*
   * PG-6c (D-VEH-3) — v14 → v15, `vehicle-facts`.
   *
   * The step writes a version and touches nothing, and for this collection each possible default is a
   * legal assertion rather than a convenience: `usedByPerson` decides whether a car is inside art. 68
   * alin. (5) lit. j) at all, `designatedForRunningCosts` decides which car the single allowance follows
   * (and no primary source supplies any selection criterion), and a `use` default would either claim a
   * deduction that has not been evidenced with a *foaie de parcurs* or deny one the law gives at 50 %.
   *
   * The second thing this test pins is the one that protects every existing profile: the key stays
   * **absent**, not `[]`. A payload written as `vehicles: []` would make each of its `vehicle_related`
   * expenses *unattributable* instead of default-capped, i.e. a migration would move money out of the
   * deductible base.
   */
  it('the vehicle-facts step backfills nothing: no key, no car, no attribution, no designation', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_OCCUPANCY_SHEET });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_OCCUPANCY_SHEET);
    expect(outcome.stepsApplied).toEqual(['vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // Absent, not empty — see the comment above: `[]` would silently reclassify every vehicle expense.
    expect('vehicles' in outcome.data).toBe(false);
    expect(outcome.data.vehicles).toBeUndefined();
    // No expense gained a vehicle link, and no expense lost anything else.
    for (const e of outcome.data.expenses ?? []) expect('vehicleId' in e).toBe(false);
    // Idempotent-safe under the chain contract: already at 15, no step matches `from`, byte-equal out.
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
    // A car the person really declared passes through untouched — the step neither rewrites its facts nor
    // copies them into another fiscal year.
    const withCar = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_OCCUPANCY_SHEET,
        vehicles: [{ id: 'v1', label: 'Dacia neagră', years: [{ fiscalYear: 2026, use: 'mixed', usedByPerson: 'da' }] }],
      }) as never,
    );
    expect(withCar.data.vehicles).toEqual([
      { id: 'v1', label: 'Dacia neagră', years: [{ fiscalYear: 2026, use: 'mixed', usedByPerson: 'da' }] },
    ]);
    expect(withCar.data.vehicles![0].years).toHaveLength(1);
  });

  /**
   * PG-6e (B-31, D-FA-1) — the v16→v17 step, and the one property that matters for it: it writes a version
   * and mints no asset.
   *
   * The forbidden version of this step is `fixedAssets: []`. For this collection the harm is not a moved
   * number but a **completed register**: an empty array in the stored bytes reads as „assets were declared
   * and none exist”, which is a claim about the taxpayer's patrimony that the taxpayer never made, and it
   * is the register the Normele Titlul IV pct. 7 alin. (8) require them to keep.
   *
   * The second thing this test pins is the other forbidden version: deriving an asset from an `Expense`
   * row. A `depreciable_asset_purchase` expense records that money left; art. 68 alin. (7) lit. h) keeps
   * that purchase out of the expense side precisely because „a cost was incurred” and „a depreciable asset
   * entered the patrimony” are different facts, and only the second one starts amortisation.
   */
  it('the fixed-assets step backfills nothing: no key, no asset, no expense turned into an asset', () => {
    const payload = prePhase7Payload({ version: DATA_VERSION_OTHER_INCOME_LADDER });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.fromVersion).toBe(DATA_VERSION_OTHER_INCOME_LADDER);
    expect(outcome.stepsApplied).toEqual(['fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // Absent, not empty — see the comment above: `[]` would read as a completed register.
    expect('fixedAssets' in outcome.data).toBe(false);
    expect(outcome.data.fixedAssets).toBeUndefined();
    // No expense became an asset, and no expense gained or lost a field.
    for (const e of outcome.data.expenses ?? []) {
      expect('assetId' in e).toBe(false);
      expect('putInFunctionDate' in e).toBe(false);
    }
    // Idempotent-safe under the chain contract: already at 17, no step matches `from`, byte-equal out.
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
    // An asset the person really declared passes through untouched — the step neither fills in a missing
    // *punerea în funcțiune* nor a missing duration, nor rewrites the method they chose.
    const withAsset = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_OTHER_INCOME_LADDER,
        fixedAssets: [{ id: 'a1', label: 'Utilaj de birou', entryDate: '2026-02-10', fiscalValue: 12000000 }],
      }) as never,
    );
    expect(withAsset.data.fixedAssets).toEqual([
      { id: 'a1', label: 'Utilaj de birou', entryDate: '2026-02-10', fiscalValue: 12000000 },
    ]);
    expect('putInFunctionDate' in withAsset.data.fixedAssets![0]!).toBe(false);
    expect('normalLifeMonths' in withAsset.data.fixedAssets![0]!).toBe(false);
  });

  /**
   * PG-6f (B-30, D-LEG-1): the v17→v18 step DELETES the retired `vatExempt` boolean and mints nothing in
   * its place. This is the half of D-LEG-1 the chain has to prove, and it is stricter than a backfill
   * ban: the step is not merely forbidden from inventing a registration state, it is forbidden from
   * leaving the old field behind for a reader to re-derive one from.
   *
   * The conversion the step refuses is the obvious one — `false` to `inregistrat_art316`, `true` to
   * `scutit_art310`. `research/42` §11.2 records that the boolean expresses none of the six states the
   * law uses, and the state decides the money measure of every record in the register, so writing one
   * here would assert an ANAF register fact the payload never held.
   */
  it('the input-vat step deletes the retired boolean and mints no registration state', () => {
    // A genuinely pre-v18 profile. The seed profile declares a registration state today, so the fixture
    // has to remove that key as well as carry the old boolean — otherwise the non-write asserted below
    // would be confounded by the fixture rather than proved by the step.
    const preV18Profile: Record<string, unknown> = { ...prePhase7Profile(), vatExempt: false };
    delete preV18Profile.vatRegistration;
    const payload = prePhase7Payload({
      version: DATA_VERSION_FIXED_ASSETS,
      profile: preV18Profile as never,
    });
    const outcome = migratePersistedData(payload as never);
    const profile = outcome.data.profile!;
    expect(outcome.fromVersion).toBe(DATA_VERSION_FIXED_ASSETS);
    expect(outcome.stepsApplied).toEqual(['input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
    expect(outcome.toVersion).toBe(CURRENT_DATA_VERSION);
    // The deletion: the key does not survive, not as a value and not as a default.
    expect('vatExempt' in profile).toBe(false);
    // And the non-write: no registration state was inferred from the deleted boolean, or from anything
    // else in the payload. Absence is the state the readers report as „the app does not know”.
    expect('vatRegistration' in profile).toBe(false);
    expect(profile.vatRegistration).toBeUndefined();
    // A registration the person really declared passes through untouched — the step neither overwrites
    // the state they chose nor fills in an effective date they did not give.
    const declared = migratePersistedData(
      prePhase7Payload({
        version: DATA_VERSION_FIXED_ASSETS,
        profile: {
          ...prePhase7Profile(),
          vatExempt: true,
          vatRegistration: { status: 'inregistrare_voluntara', cashAccounting: 'da' },
        } as never,
      }) as never,
    );
    const declaredProfile = declared.data.profile!;
    expect('vatExempt' in declaredProfile).toBe(false);
    expect(declaredProfile.vatRegistration).toEqual({ status: 'inregistrare_voluntara', cashAccounting: 'da' });
    expect('effectiveFrom' in declaredProfile.vatRegistration!).toBe(false);
    // Idempotent under the chain contract: already at the head, no step matches `from`, byte-equal out.
    const again = migratePersistedData(outcome.data);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data).toEqual(outcome.data);
  });

  // D-DPI-2 (B-152) — the v25→v26 step, and the single property that decides whether this brief is safe or
  // silently undercharges somebody's health contribution. Asserted against a payload at v25, the version
  // every real install is on today — not against the current schema, which could pass by construction.
  it('the cass-ladder-answers step leaves a real v25 payload UNANSWERED: unknown, never „nu am avut”', () => {
    // A ladder year exactly as a v25 build stores it: five amounts typed, one category left blank. The
    // blank one is the whole test. It could mean "this person has no such income" or "nobody asked them",
    // and v25 has no way to tell — which is precisely why the ladder refused.
    const v25Profile = {
      ...seedData.profile,
      cassLadderYears: [
        {
          fiscalYear: 2026,
          proprietateIntelectuala: lei(30_000),
          asocierePersoanaJuridica: lei(0),
          cedareaFolosinteiBunurilor: lei(0),
          cedareaSursa: 'patrimoniu_personal',
          activitatiAgricole: lei(0),
          investitii: lei(0),
          // `alteSurse` deliberately absent: unanswered, not zero.
        },
      ],
    };
    const payload = prePhase7Payload({
      version: DATA_VERSION_PRIOR_YEAR_LOSSES,
      profile: v25Profile,
    });
    const outcome = migratePersistedData(payload as never);
    expect(outcome.toVersion).toBe(DATA_VERSION_LADDER_ANSWERS);
    expect(outcome.stepsApplied).toEqual(['cass-ladder-answers']);

    const year = outcome.data.profile!.cassLadderYears![0];
    // Every amount the person typed survives untouched — the step retires nothing and rewrites nothing.
    expect(year.proprietateIntelectuala).toBe(lei(30_000));
    expect(year.investitii).toBe(lei(0));

    // THE LINE THIS BRIEF IS JUDGED ON. The new field is absent, and absence resolves to `unknown`. A step
    // that wrote `none` here — the obvious-looking "they had the section and left it blank" default — would
    // put a sentence in the taxpayer's mouth they never said, and would then compute a CASS base out of it.
    expect('ladderAnswers' in year).toBe(false);
    const facts = cassLadderFactsForYear(year);
    expect(facts.filter((f) => f.state === 'none')).toHaveLength(0);
    expect(cassLadderMissingCategories(year)).toEqual(['alte_surse']);

    // And the engine still refuses, naming the category — the refusal narrowed, it did not leave.
    const ladderRes = calculatorRegistry['calc-cass-ladder'](cassRule, {
      cassLadder: {
        amounts: {
          proprietate_intelectuala: year.proprietateIntelectuala,
          asociere_persoana_juridica: year.asocierePersoanaJuridica,
          cedarea_folosintei_bunurilor: year.cedareaFolosinteiBunurilor,
          activitati_agricole: year.activitatiAgricole,
          investitii: year.investitii,
          alte_surse: year.alteSurse,
        },
        answers: year.ladderAnswers,
        cedareaSursa: year.cedareaSursa,
      },
    });
    if (!('reviewRequired' in ladderRes)) {
      throw new Error(
        `a v25 payload that has never seen the six questions computed CASS ${ladderRes.value} lei`,
      );
    }
    expect(ladderRes.reason).toContain(CASS_LADDER_CATEGORY_NAMES.alte_surse);
  });

  it('the cass-ladder-answers step is idempotent and leaves a payload that already answers untouched', () => {
    const answered = {
      ...seedData.profile,
      cassLadderYears: [
        {
          fiscalYear: 2026,
          investitii: lei(10_000),
          ladderAnswers: { alte_surse: 'none', investitii: 'amount' },
        },
      ],
    };
    const once = migratePersistedData(
      prePhase7Payload({ version: DATA_VERSION_PRIOR_YEAR_LOSSES, profile: answered }) as never,
    );
    expect(once.data.profile!.cassLadderYears![0].ladderAnswers).toEqual({
      alte_surse: 'none',
      investitii: 'amount',
    });
    const again = migratePersistedData(once.data as never);
    expect(again.stepsApplied).toEqual([]);
    expect(again.data.profile!.cassLadderYears![0].ladderAnswers).toEqual({
      alte_surse: 'none',
      investitii: 'amount',
    });
  });

  // Brief 76 named the trap and brief 78 has to answer it: **zod strips undeclared keys**. A tri-state the
  // load gate does not declare would be erased by the next save-and-load, and the erasure would read as a
  // passing test — the person's „nu am avut” quietly becoming „nimeni nu a întrebat”. The gate is widened
  // BEFORE the step that reads the field, and this is the pin that says so.
  it('a declared „nu am avut” survives a real save-and-load instead of being stripped by the gate', () => {
    const payload = prePhase7Payload({
      version: CURRENT_DATA_VERSION,
      profile: {
        ...seedData.profile,
        cassLadderYears: [
          {
            fiscalYear: 2026,
            ladderAnswers: {
              proprietate_intelectuala: 'none',
              asociere_persoana_juridica: 'none',
              cedarea_folosintei_bunurilor: 'none',
              activitati_agricole: 'none',
              investitii: 'none',
              alte_surse: 'none',
            },
          },
        ],
      },
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    load();
    const year = storeRef!.profile!.cassLadderYears![0];
    expect(year.ladderAnswers).toEqual({
      proprietate_intelectuala: 'none',
      asociere_persoana_juridica: 'none',
      cedarea_folosintei_bunurilor: 'none',
      activitati_agricole: 'none',
      investitii: 'none',
      alte_surse: 'none',
    });
    // Six declared absences, zero unanswered — the state the ladder proceeds on.
    expect(cassLadderMissingCategories(year)).toEqual([]);
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
      'record-currency',
      'annual-filing',
      'activity-family',
      'accommodation-facts',
      'occupancy-sheet',
      'vehicle-facts',
      'other-income-ladder',
      'fixed-assets',
      'input-vat-registration',
    'vat-returns',
    // B-105 — the lease-facts step, appended after v19.
    'lease-facts',
    // PG-11 — appended after v20; it opens no collection and fills nothing in.
    'document-blob-ref',
    // B-140 (D-EFACT-1) — appended after v21; it retires the e-Factura sending preference and fills nothing in.
    'efactura-deadline',
    'expense-asset-link',
    'fixed-asset-disposal-proceeds',
    // B-145 — appended after v24; it opens a profile field and fills nothing in.
    'prior-year-fiscal-losses',
    // D-DPI-2 (B-152) — appended after v25; it opens a profile field and fills nothing in.
    'cass-ladder-answers',
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
    expect(outcome.stepsApplied).toEqual(['expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['expense-category', 'tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(withAmount.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['tax-reserve', 'pension-facts', 'rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
    expect(outcome.stepsApplied).toEqual(['rule-set-digest', 'record-currency', 'annual-filing', 'activity-family', 'accommodation-facts', 'occupancy-sheet', 'vehicle-facts', 'other-income-ladder', 'fixed-assets', 'input-vat-registration', 'vat-returns', 'lease-facts', // PG-11 — appended after v20; the step fills nothing in.
      'document-blob-ref', 'efactura-deadline', 'expense-asset-link', 'fixed-asset-disposal-proceeds', 'prior-year-fiscal-losses', 'cass-ladder-answers']);
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
        socialInsuranceStatus: p.socialInsuranceStatus,
        // PG-6f (B-30) — the registration state joins the policy inputs in place of the retired boolean.
        // The migration does not backfill it, so both sides are absent and this still asserts the real
        // thing: whatever registration fact the snapshot carried, the chain did not move it.
        vatRegistration: p.vatRegistration ?? null,
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
    // PG-5b: the monthly row does not survive the chain. It is dropped by `annual-filing`, and no annual
    // filing is minted from it — dropping a record and inventing one are two things this step must not do,
    // and it is only allowed the first.
    expect('legacyDeclarations' in storeRef!).toBe(false);
    expect(storeRef!.filings).toEqual([]);
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
        'record-currency',
        'annual-filing',
        'activity-family',
        'accommodation-facts',
        'occupancy-sheet',
        'vehicle-facts',
        'other-income-ladder',
        'fixed-assets',
        'input-vat-registration',
      'vat-returns',
      // B-105 — the lease-facts step, appended after v19.
      'lease-facts',
      // PG-11 — appended after v20; it opens no collection and fills nothing in.
      'document-blob-ref',
      'efactura-deadline',
      'expense-asset-link',
      'fixed-asset-disposal-proceeds',
      'prior-year-fiscal-losses',
      // D-DPI-2 (B-152) — appended after v25; it opens a profile field and fills nothing in.
      'cass-ladder-answers',
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
    // Phase 11: a quarantined payload falls back to an EMPTY dataset, not to the demo fixture.
    expect(storeRef!.revenues).toEqual([]);
    const preserved = JSON.parse(localStorage.getItem(QUARANTINE_STORAGE_KEY)!) as {
      reason: string;
      raw: string;
    };
    expect(preserved.reason).toBe('unsupported-version');
    // Written from the CURRENT build forward, so it tracks the version constant instead of a literal.
    expect(preserved.raw).toContain(`"version":${CURRENT_DATA_VERSION + 1}`);
  });
});
