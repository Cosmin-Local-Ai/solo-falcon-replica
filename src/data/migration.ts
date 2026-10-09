/**
 * The persisted-data version chain (decision D-2).
 *
 * Contract
 * --------
 * - The storage key never changes: everything lives under `pfa-app-data-v2`
 *   (`store.tsx`). Versioning is a field inside the payload, not a new key, so
 *   an old install is upgraded in place instead of orphaned.
 * - `version` is OPTIONAL in `persistedAppDataSchema`. A payload with no
 *   `version` key is the BASE of the chain (`DATA_VERSION_BASE`): that is
 *   exactly what every payload written before Phase 7 looks like. Absence is
 *   therefore meaningful data, not a missing default — which is why the schema
 *   has no `.default()`.
 * - A payload whose `version` is HIGHER than `CURRENT_DATA_VERSION` is rejected
 *   as unreadable rather than down-migrated or guessed at. That happens when a
 *   newer build wrote the payload and this build opened it; silently dropping
 *   fields the newer build added would be data loss.
 * - Steps run in order, each `from → to`, and the chain is applied to the whole
 *   dataset at once. A step must be idempotent-safe: it may inspect what is
 *   already present and leave it alone.
 *
 * Every step and every field it backfills is documented inline and in
 * `docs/ai/phases/07_identity.md`.
 */
import type { CaenCode, PfaIdentity, PfaProfile } from '../domain/models';
import { computeInputsHashSync } from '../domain/snapshots/hashSync';
import type { TaxCalculationSnapshot } from '../domain/snapshots/types';
import { baniFromLei, lei, type Bani } from '../domain/money';
import type { Declaration, Expense, Revenue } from './types';
import { localYear, now, toInstantISO } from '../domain/date';
import type { SettingsState } from './types';
import type { PersistedAppData } from './schema';

/** A payload with no `version` key: written before Phase 7 introduced versioning. */
export const DATA_VERSION_BASE = 0;
/** Phase 7 step 1: the `profile` collection is materialized from `settings` (the Phase 6 backfill, made explicit). */
export const DATA_VERSION_PROFILE = 1;
/** Phase 7 step 2: `profile.identity` becomes the one identity store (D-1). */
export const DATA_VERSION_IDENTITY = 2;
/**
 * Phase 9 step 3: records may carry a **collected** date (`Revenue`) / **paid** date (`Expense`)
 * — CF art. 68 alin. (2) lit. a) „sumele încasate" / art. 68 alin. (4) lit. b) „anului în cursul
 * căruia au fost plătite". See `migratePaymentDatesV3` and `docs/ai/phases/09_payment_dates.md`.
 */
export const DATA_VERSION_DATES = 3;
/**
 * Pre-Phase-10 step 4: the profile may carry the date the VAT turnover ceiling was exceeded
 * (`PfaProfile.vatExceedanceDate`). That is the input `VAT_REGISTRATION_DEADLINE_2026` has been
 * missing since Phase 9b — the rule was correct, cited and rule-driven, but no field existed to
 * feed it, so it could only ever resolve `not_applicable`. See `migrateVatExceedanceDateV4`.
 */
export const DATA_VERSION_VAT_DATE = 4;
/**
 * Phase 10 step 5: money stops being a float number of lei and becomes an integer number of **bani**.
 * See `docs/ai/phases/10_money_precision.md` §2.2 — this is the step that touches the user's money, so it
 * is the one step in the chain that must never change a value by accident.
 */
export const DATA_VERSION_MONEY_BANI = 5;
/**
 * TASK 2b step 6: an expense may carry a deductibility **category** (`Expense.category`), the token the
 * CF art. 68 classifier reads. See `migrateExpenseCategoryV6` and `docs/ai/phases/14_expense_deductibility_wiring.md`.
 *
 * This is the third pure schema-widening step in the chain (after `payment-dates` and
 * `vat-exceedance-date`): it backfills NOTHING. An uncategorised expense is legal input — it classifies
 * as `undetermined` and is excluded from the deductible total — so leaving the field absent is both the
 * honest state and the safe one for the user's money.
 */
export const DATA_VERSION_EXPENSE_CATEGORY = 6;
/**
 * TASK 3 step 7: the dataset may carry a recorded tax reserve (`AppData.reservedAmount`, integer bani,
 * `null` = no reserve recorded). See `migrateReservedAmountV7` and
 * `docs/ai/phases/17_tax_reserve_persistence.md`.
 *
 * The fourth pure schema-widening step in the chain (after `payment-dates`, `vat-exceedance-date` and
 * `expense-category`): it backfills NOTHING. A reserve is a fact about money the user has physically
 * set aside, and no legacy field records it — inventing `0` would assert that the user recorded they
 * had set aside nothing, which is a different fact from never having recorded anything, and it would
 * silently clear the „Rezervă fiscală sub țintă” warning the task exists to make clearable.
 */
export const DATA_VERSION_TAX_RESERVE = 7;
/** The version this build writes. */
export const CURRENT_DATA_VERSION = DATA_VERSION_TAX_RESERVE;

export interface MigrationStep {
  readonly from: number;
  readonly to: number;
  /** Stable identifier, recorded in logs/tests. Never reused. */
  readonly name: string;
  /** One-line human description; shown in the "your data was upgraded" state. */
  readonly summary: string;
  apply: (data: PersistedAppData) => PersistedAppData;
}

export interface MigrationOutcome {
  /** The dataset at `CURRENT_DATA_VERSION`, ready for the load path. */
  data: PersistedAppData;
  fromVersion: number;
  toVersion: number;
  migrated: boolean;
  /** Names of the steps that actually ran, in order. */
  stepsApplied: string[];
}

/**
 * A payload written by a NEWER build than this one. The load path treats this as
 * an unreadable payload and quarantines it (D-3) instead of loading a partial,
 * silently-shrunken version of the user's data.
 */
export class UnsupportedDataVersionError extends Error {
  readonly found: number;
  readonly current: number;
  constructor(found: number, current: number) {
    super(`stored data version ${found} is newer than this build understands (${current})`);
    this.name = 'UnsupportedDataVersionError';
    this.found = found;
    this.current = current;
  }
}

/**
 * Backfill a profile for data saved before the `profile` collection existed.
 *
 * This is a migration, not a load-time default: it belongs to step v0→v1 and is
 * the only place legacy `settings.company` / `settings.personal` values are read
 * (acceptance criterion 6 — nothing outside the migration path reads them).
 *
 * `instant` is injectable so tests get a deterministic `pfaStartYear` /
 * `fiscalYear` / `updatedAt`.
 */
export function legacyProfileFromSettings(s: SettingsState, instant: Date = now()): PfaProfile {
  const c = s.company;
  const p = s.personal;
  return {
    id: 'profile-1',
    pfaStartYear: localYear(instant),
    fiscalYear: localYear(instant),
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'neplata',
    vatExempt: false,
    cashFloorLei: lei(0),
    identity: absorbCompanyIdentity(
      {
        nume: p.nume,
        cnp: p.cnp,
        adresa: p.adresa,
        telefon: p.telefon,
        email: p.email,
        denumire: c.denumire,
        cui: c.cui,
        formaJuridica: c.formaJuridica ?? '',
        numarRegComert: c.numarRegComert,
        adresaSocietate: c.adresa,
        telefonSocietate: c.telefon ?? '',
        emailSocietate: c.email ?? '',
        contBancar: c.contBancar ?? '',
        banca: c.banca ?? '',
      },
      s,
    ),
    updatedAt: toInstantISO(instant),
  };
}

/**
 * Copy the identity fields that only `settings.company` used to carry into
 * `PfaIdentity`, without overwriting anything already present there.
 *
 * Rule for the whole chain: **backfill only from a real source, never invent a
 * value.** A field with no legacy source stays absent — the schema makes every
 * Phase 7 field optional precisely so "unknown" is representable instead of
 * guessed. (Same principle Phase 6 applied to `pfaStartDate` /
 * `salaryIncomeLei` — see `store.profileBackfill.test.tsx`
 * "leaves the new optional profile fields absent rather than inventing values".)
 */
export function absorbCompanyIdentity(identity: PfaIdentity, settings: SettingsState): PfaIdentity {
  const c = settings.company;
  const next: PfaIdentity = { ...identity };
  if (next.codTvaIntra === undefined && c.codTvaIntra !== undefined) next.codTvaIntra = c.codTvaIntra;
  if (next.mentiuniFactura === undefined && c.mentiuniFactura !== undefined) {
    next.mentiuniFactura = c.mentiuniFactura;
  }
  if (next.caen === undefined || next.caen.length === 0) {
    if (c.caen && c.caen.length > 0) {
      next.caen = c.caen.map((entry): CaenCode => ({ cod: entry.cod, descriere: entry.descriere }));
    } else {
      // `settings.company.codCAEN` is the older scalar alias for the main CAEN code.
      // It is a real legacy source, so it is a legitimate fallback — and dropping it
      // would lose the only CAEN code some payloads carry.
      const alias = c.codCAEN?.trim();
      if (alias) next.caen = [{ cod: alias, descriere: '' }];
    }
  }
  return next;
}

/** Fold the deprecated `PfaProfile.caen` string into `identity.caen`. */
function foldLegacyCaen(identity: PfaIdentity, legacyCaen: string | undefined): PfaIdentity {
  const code = legacyCaen?.trim();
  if (!code) return identity;
  if (identity.caen && identity.caen.length > 0) return identity; // real CAEN entries win
  return { ...identity, caen: [{ cod: code, descriere: '' }] };
}

/**
 * Step v0→v1 — materialize the `profile` collection.
 *
 * This is today's implicit load-time backfill (`profile: parsed.profile ??
 * legacyProfileFromSettings(parsed.settings)`) turned into an explicit chain
 * step, which is what B-12 asked for: the Phase 6 rule stops being a special
 * case hidden in the load path and becomes the first link of a versioned chain.
 *
 * It invents nothing beyond what the pre-Phase-6 rule already invented
 * (`pfaStartYear`/`fiscalYear` from the current year, the default regime) and it
 * deliberately leaves `pfaStartDate` / `salaryIncomeLei` ABSENT — the Phase 6
 * data-loss rule (`phases/06_fiscal_profile.md` §4) is "no default for a field
 * the user never entered".
 */
export function materializeProfileV1(data: PersistedAppData): PersistedAppData {
  if (data.profile) return { ...data, version: DATA_VERSION_PROFILE };
  return { ...data, version: DATA_VERSION_PROFILE, profile: legacyProfileFromSettings(data.settings) };
}

/**
 * Step v1→v2 — identity absorption (D-1).
 *
 * Backfills, on the LIVE profile:
 *   `identity.codTvaIntra`     ← `settings.company.codTvaIntra`
 *   `identity.mentiuniFactura` ← `settings.company.mentiuniFactura`
 *   `identity.caen[]`          ← `settings.company.caen[]`, else the
 *                               `settings.company.codCAEN` alias, else the
 *                               deprecated `profile.caen` string as
 *                               `{cod, descriere: ''}`
 * and removes the deprecated `profile.caen` from the live profile once folded.
 *
 * Backfills, inside every STORED snapshot's embedded profile (F-1):
 *   `identity.caen[]`          ← that snapshot's own embedded `profile.caen` string
 * Only from the snapshot's own bytes: a snapshot is an audit record of a past
 * calculation, so today's `settings.company` must not be written into it.
 * `codTvaIntra` / `mentiuniFactura` have no source inside the snapshot and are
 * left absent rather than invented.
 *
 * Because `canonicalize` serializes every key, adding a key to an embedded
 * profile changes its digest. The step therefore re-derives `inputsHash` and
 * preserves the digest that was recorded at calculation time in
 * `preMigrationInputsHash`. See `docs/ai/phases/07_identity.md` for why this is
 * the only option that keeps the snapshot provenance invariant true.
 */
export function migrateIdentityV2(data: PersistedAppData): PersistedAppData {
  const settings = data.settings;
  // Defensive: v0→v1 guarantees a profile, but a payload that entered the chain
  // at v1 without one must not crash the load path.
  const profile = data.profile ?? legacyProfileFromSettings(settings);

  let identity = absorbCompanyIdentity(profile.identity, settings);
  identity = foldLegacyCaen(identity, profile.caen);
  const nextProfile: PfaProfile = { ...profile, identity };
  delete nextProfile.caen; // folded into identity.caen; the live profile is normalized

  const snapshots = (data.snapshots ?? []).map(backfillSnapshotIdentity);

  return { ...data, version: DATA_VERSION_IDENTITY, profile: nextProfile, snapshots };
}

/**
 * Backfill one stored snapshot's embedded profile. Returns the snapshot
 * untouched when there is nothing to add, so a migration never rewrites a digest
 * it did not actually change.
 */
export function backfillSnapshotIdentity(snapshot: TaxCalculationSnapshot): TaxCalculationSnapshot {
  const embedded = snapshot.inputSnapshot.profile;
  const identity = foldLegacyCaen(embedded.identity, embedded.caen);
  if (identity === embedded.identity) return snapshot; // nothing added ⇒ digest stays

  const nextProfile: PfaProfile = { ...embedded, identity };
  // Same normalization as the live profile: after the fold there must be exactly
  // one CAEN representation, otherwise AC7's "both readable" problem survives
  // inside the snapshot. Only done when the step actually changed the profile —
  // a snapshot with nothing to add keeps its original bytes and its digest.
  delete nextProfile.caen;
  const inputSnapshot = { ...snapshot.inputSnapshot, profile: nextProfile };
  return {
    ...snapshot,
    inputSnapshot,
    inputsHash: computeInputsHashSync(inputSnapshot),
    // Keep the digest recorded at calculation time. If a snapshot somehow
    // already carries one, the oldest is the one worth keeping.
    preMigrationInputsHash: snapshot.preMigrationInputsHash ?? snapshot.inputsHash,
  };
}

/**
 * Phase 9 step 3 (`2 → 3`): the record schema now permits an optional **collected** date on
 * `Revenue` and an optional **paid** date on `Expense`.
 *
 * **It backfills nothing, on purpose.** A legacy payload's single `date` is *interpreted* as the
 * fiscal date by the read-side resolver (`domain/aggregation.ts` `revenueFiscalDate` /
 * `expenseFiscalDate`). Copying `date` into `collected`/`paid` would manufacture a collection or
 * payment event that was never recorded, and would make an unrecorded fact indistinguishable from a
 * recorded one — the same class of error as the F-1 `canonicalize` defect, where a normalisation
 * step silently asserted something the source never said. Absence is the honest state, so absence
 * survives the step. This is the single place a future, *evidenced* backfill would live.
 *
 * The step is idempotent-safe and touches no bytes. It cannot change any `inputSnapshot` digest:
 * `buildInputSnapshot` hashes `profile` plus two aggregate numbers, not the record arrays.
 */
export function migratePaymentDatesV3(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_DATES };
}

/**
 * Pre-Phase-10 step 4 (`3 → 4`): the profile may now carry `vatExceedanceDate`, the date the VAT
 * turnover ceiling (CF art. 310 alin. (1)) was exceeded — the input the VAT registration deadline
 * rule (art. 316 alin. (1) lit. b), already wired and cited since Phase 9b) was still missing.
 *
 * **It backfills nothing, on purpose, for the same reason `migratePaymentDatesV3` backfills
 * nothing.** There is no legacy field to read the exceedance date from: `vatExempt` is a boolean
 * regime flag, not an event, and `pfaStartDate` is the registration start, not a ceiling crossing.
 * Deriving a date from any of them would manufacture a fiscal event the user never recorded — and
 * this one has teeth: `VAT_REGISTRATION_DEADLINE_2026` puts a filing obligation on the exact
 * exceedance date (`offset_days = 0`), so an invented date would invent a deadline. Absence stays
 * absence, and the rule keeps emitting nothing until the user supplies the date.
 *
 * The step touches no bytes and cannot change any `inputSnapshot` digest: `buildInputSnapshot`
 * hashes `profile` plus two aggregate numbers — so a profile that gains this field later does
 * change the digest, which is correct: it is a different input to the engine.
 */
export function migrateVatExceedanceDateV4(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_VAT_DATE };
}

/**
 * One stored money value whose move to integer bani was not a lossless unit change.
 *
 * The brief's rule is that such a value must **surface, not vanish**. Throwing is the wrong instrument
 * here: a throwing step quarantines the whole payload and the save effect then overwrites the main key
 * with seed data, so the user's money becomes *less* reachable, not more. The conversion therefore
 * completes and records what it had to decide.
 */
export interface MoneyPrecisionNotice {
  collection: 'revenues' | 'expenses' | 'declarations' | 'profile' | 'snapshot';
  /** The record's own id; for a snapshot, its `calculationId`; for the profile, `'profile'`.
   * A record with no id is reported as `'<no id>'` rather than skipped — a missing id is itself a fact. */
  id: string;
  field: string;
  /**
   * The value exactly as it was stored, in lei, as **text**. Kept verbatim so the user can see what changed.
   *
   * It is a string rather than a number on purpose: a non-finite value is the case this field exists to
   * report, and `JSON.stringify` turns `NaN`/`Infinity` into `null`. A numeric `original` would therefore
   * fail `persistedAppDataSchema` on the next load and quarantine the whole payload — the report about a
   * bad value destroying the good data next to it. Text survives the round-trip and stays verbatim.
   */
  original: string;
  /** The bani it became. **Omitted** when the value could not be represented at all — never `0`. */
  converted?: Bani;
  reason: 'sub-ban-precision' | 'non-finite';
}

/**
 * The v4→v5 unit conversion: every stored money field goes from float lei to integer bani.
 *
 * Two things this deliberately is NOT:
 * - It is **not** CF art. 66 rounding. Art. 66 rounds to a whole leu, so applying it here would turn a
 *   stored revenue of `85.5` lei into `86` lei — a silent change to the user's money. Only
 *   `roundArt66` in `domain/money.ts` is allowed to change a *value*, and only at the three tax lines.
 * - It is **not** `Math.round(x * 100)`, the function this phase exists to remove. `baniFromLei` scales
 *   through `Decimal`, so `71.4` becomes exactly `7140` instead of `7140.000000000001`.
 *
 * A value with sub-ban precision (`674.504` lei → `67 450,4` bani) is taken to the nearest ban with
 * **half-DOWN** ties — the same direction art. 66 takes („până la 50 de bani inclusiv”), so migration and
 * domain never disagree — and it is reported. A non-finite value is carried through **unchanged** and
 * reported; it is never replaced by `0`, because a fabricated zero is the failure the previous phase's
 * invariants forbid.
 */
export function convertMoneyToBani(input: PersistedAppData): {
  data: PersistedAppData;
  notices: MoneyPrecisionNotice[];
} {
  const notices: MoneyPrecisionNotice[] = [];

  // The payload arriving here is a v4 payload: its money fields are typed `Bani` only because the load
  // gate casts, and they still hold lei. The brand describes the post-migration world, not this one.
  const convert = (value: number, collection: MoneyPrecisionNotice['collection'], id: string, field: string): Bani => {
    const { bani, exact } = baniFromLei(value);
    if (bani === null) {
      notices.push({ collection, id, field, original: String(value), reason: 'non-finite' });
      return value as Bani; // preserved verbatim — dropped or zeroed would both be worse
    }
    if (!exact) notices.push({ collection, id, field, original: String(value), converted: bani, reason: 'sub-ban-precision' });
    return bani;
  };

  const convertProfile = (profile: PfaProfile, id: string): PfaProfile => {
    const next: PfaProfile = {
      ...profile,
      cashFloorLei: convert(profile.cashFloorLei as number, 'profile', id, 'cashFloorLei'),
    };
    // Omit, never null: no persisted money field is `.nullable()`, so writing `null` would fail
    // `safeParse` on the next load and quarantine the payload. Absence must stay absence.
    if (profile.salaryIncomeLei !== undefined) {
      next.salaryIncomeLei = convert(profile.salaryIncomeLei as number, 'profile', id, 'salaryIncomeLei');
    }
    return next;
  };

  const convertSnapshot = (snapshot: TaxCalculationSnapshot): TaxCalculationSnapshot => {
    const profile = convertProfile(snapshot.inputSnapshot.profile, snapshot.calculationId);
    const revenues = convert(snapshot.inputSnapshot.revenues as number, 'snapshot', snapshot.calculationId, 'inputSnapshot.revenues');
    const expenses = convert(snapshot.inputSnapshot.expenses as number, 'snapshot', snapshot.calculationId, 'inputSnapshot.expenses');
    const inputSnapshot = { ...snapshot.inputSnapshot, profile, revenues, expenses };

    const calculationLines = snapshot.calculationLines.map((line) => ({
      ...line,
      value: convert(line.value as number, 'snapshot', snapshot.calculationId, 'calculationLines.value'),
    }));
    const output = { total: convert(snapshot.output.total as number, 'snapshot', snapshot.calculationId, 'output.total') };

    // `canonicalize` writes a number as `String(value)`, so the unit is baked into the digest's bytes:
    // `7700` and `770000` hash differently. Re-derive, and keep the digest that was recorded at
    // calculation time — same contract as `backfillSnapshotIdentity` above.
    const untouched =
      inputSnapshot.revenues === snapshot.inputSnapshot.revenues &&
      inputSnapshot.expenses === snapshot.inputSnapshot.expenses &&
      inputSnapshot.profile === snapshot.inputSnapshot.profile;
    if (untouched) {
      return { ...snapshot, calculationLines, output };
    }
    return {
      ...snapshot,
      inputSnapshot,
      calculationLines,
      output,
      inputsHash: computeInputsHashSync(inputSnapshot),
      preMigrationInputsHash: snapshot.preMigrationInputsHash ?? snapshot.inputsHash,
    };
  };

  const data: PersistedAppData = {
    ...input,
    version: DATA_VERSION_MONEY_BANI,
    revenues: input.revenues.map((r: Revenue) => ({
      ...r,
      valoareFaraTva: convert(r.valoareFaraTva as number, 'revenues', r.id ?? '<no id>', 'valoareFaraTva'),
      tva: convert(r.tva as number, 'revenues', r.id ?? '<no id>', 'tva'),
    })),
    ...(input.expenses
      ? {
          expenses: input.expenses.map((e: Expense) => ({
            ...e,
            valoareFaraTva: convert(e.valoareFaraTva as number, 'expenses', e.id ?? '<no id>', 'valoareFaraTva'),
            tva: convert(e.tva as number, 'expenses', e.id ?? '<no id>', 'tva'),
          })),
        }
      : {}),
    ...(input.declarations
      ? {
          declarations: input.declarations.map((d: Declaration) => ({
            ...d,
            venituri: convert(d.venituri as number, 'declarations', d.id ?? '<no id>', 'venituri'),
            cheltuieli: convert(d.cheltuieli as number, 'declarations', d.id ?? '<no id>', 'cheltuieli'),
          })),
        }
      : {}),
    ...(input.profile ? { profile: convertProfile(input.profile, 'profile') } : {}),
    ...(input.snapshots ? { snapshots: input.snapshots.map(convertSnapshot) } : {}),
  };

  return { data, notices };
}

/**
 * Phase 10 step 5 (`4 → 5`): stored money becomes integer bani. See `convertMoneyToBani` and
 * `docs/ai/phases/10_money_precision.md` §2.2.
 *
 * The notices it produces are returned by `convertMoneyToBani`; the chain's signature has no channel for
 * them, so they are carried on the payload under `moneyNotices` (declared in `data/schema.ts`, because
 * zod strips undeclared keys and would erase the report on the next load).
 */
export function migrateMoneyBaniV5(data: PersistedAppData): PersistedAppData {
  const { data: converted, notices } = convertMoneyToBani(data);
  return notices.length ? { ...converted, moneyNotices: notices } : converted;
}

/**
 * TASK 2b step 6 (`5 → 6`): `Expense` may now carry `category`, the token the deductibility classifier
 * reads (`domain/fiscal/deductibility.ts`, CF art. 68).
 *
 * **It backfills nothing, for the third time, and this time the temptation was real.** Every expense in
 * a pre-v6 payload is a real invoice, and it would be easy to guess a category from the supplier name or
 * the amount. That guess would decide the user's tax: an uncategorised expense is EXCLUDED from the
 * deductible total, while a wrongly categorised one enters it. The law supplies no default (research 21,
 * "What the law cannot decide": purpose is a fact about each expense, not a category), so absence is
 * carried forward unchanged and surfaced as a count instead of being repaired.
 *
 * A payload that already carries a category keeps it byte-for-byte — the step neither validates nor
 * rewrites it. Nothing here can quarantine a payload for a missing category: the field is optional in
 * `expenseSchema`, and the load gate runs before the chain.
 *
 * The step touches no bytes and cannot move a stored `inputSnapshot` digest: `buildInputSnapshot` hashes
 * `profile` plus two aggregate numbers, not the expense array.
 */
export function migrateExpenseCategoryV6(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_EXPENSE_CATEGORY };
}

/**
 * TASK 3: the v6→v7 step widens the dataset with `reservedAmount` and NOTHING MORE.
 *
 * It backfills nothing, deliberately. `reservedAmount` is tri-state — `null` means „no reserve
 * recorded”, `0` means the user recorded an explicit zero — and the two are different facts. Writing
 * `0` into an old payload would manufacture a claim about the user's cash that no legacy field ever
 * recorded, and it would do so in the one place a reader cannot argue with: a stored number. Absence
 * is carried forward unchanged and the load path (`store.tsx` `toAppData`) reads it as `null`.
 *
 * The step touches no bytes and cannot move a stored `inputSnapshot` digest: `buildInputSnapshot`
 * hashes `profile` plus two aggregate numbers, not the rest of `AppData`, so a new top-level field
 * never reaches `canonicalize`.
 */
export function migrateReservedAmountV7(data: PersistedAppData): PersistedAppData {
  return { ...data, version: DATA_VERSION_TAX_RESERVE };
}

/** The chain, in order. Append new steps at the end; never renumber old ones. */
export const MIGRATION_CHAIN: MigrationStep[] = [
  {
    from: DATA_VERSION_BASE,
    to: DATA_VERSION_PROFILE,
    name: 'profile-materialization',
    summary: 'Profile collection rebuilt from the legacy settings block (the Phase 6 backfill, now explicit).',
    apply: materializeProfileV1,
  },
  {
    from: DATA_VERSION_PROFILE,
    to: DATA_VERSION_IDENTITY,
    name: 'identity-absorption',
    summary:
      'Identity/contact data moved into the profile (company CAEN codes, cod TVA intracomunitar, mentiuni pe factură).',
    apply: migrateIdentityV2,
  },
  {
    from: DATA_VERSION_IDENTITY,
    to: DATA_VERSION_DATES,
    name: 'payment-dates',
    summary:
      'Records may now carry a collected (revenue) / paid (expense) date. Nothing was backfilled: a legacy payload keeps a single date, which is read as the fiscal date.',
    apply: migratePaymentDatesV3,
  },
  {
    from: DATA_VERSION_DATES,
    to: DATA_VERSION_VAT_DATE,
    name: 'vat-exceedance-date',
    summary:
      'Profile may now carry the date the TVA ceiling was exceeded. Nothing was backfilled: no legacy field records that event, and an invented date would invent a filing deadline.',
    apply: migrateVatExceedanceDateV4,
  },
  {
    from: DATA_VERSION_VAT_DATE,
    to: DATA_VERSION_MONEY_BANI,
    name: 'money-bani',
    summary:
      'Banii se stochează acum ca număr întreg de bani (1 leu = 100 de bani), nu ca zecimale de lei. Valorile cu precizie subun ban au fost rotunjite la cel mai apropiat ban (semn +50 în jos) și sunt raportate, nu ascunse.',
    apply: migrateMoneyBaniV5,
  },
  {
    from: DATA_VERSION_MONEY_BANI,
    to: DATA_VERSION_EXPENSE_CATEGORY,
    name: 'expense-category',
    summary:
      'Cheltuielile pot avea acum o categorie de deductibilitate (CF art. 68). Nimic nu a fost completat: o cheltuială fără categorie este exclusă din totalul deductibil și raportată ca neclasificată, nu clasificată prin ghicit.',
    apply: migrateExpenseCategoryV6,
  },
  {
    from: DATA_VERSION_EXPENSE_CATEGORY,
    to: DATA_VERSION_TAX_RESERVE,
    name: 'tax-reserve',
    summary:
      'Datele pot înregistra acum suma pusă deoparte pentru impozit (null = nicio sumă înregistrată). Nimic nu a fost completat: o rezervă de 0 lei este o faptă înregistrată de utilizator, nu o presupunere despre banii lui.',
    apply: migrateReservedAmountV7,
  },
];

/** Version a payload declares, with absence meaning the base of the chain. */
export function readStoredVersion(parsed: PersistedAppData): number {
  return parsed.version ?? DATA_VERSION_BASE;
}

/**
 * Run the chain. Throws `UnsupportedDataVersionError` for a payload from a newer
 * build; the load path turns that into a quarantine (D-3).
 */
export function migratePersistedData(parsed: PersistedAppData): MigrationOutcome {
  const fromVersion = readStoredVersion(parsed);
  if (fromVersion > CURRENT_DATA_VERSION) {
    throw new UnsupportedDataVersionError(fromVersion, CURRENT_DATA_VERSION);
  }

  let data = parsed;
  const stepsApplied: string[] = [];
  for (const step of MIGRATION_CHAIN) {
    if (step.from !== readVersion(data)) continue;
    data = step.apply(data);
    stepsApplied.push(step.name);
    if (readVersion(data) !== step.to) {
      // A step that does not bump the version would silently loop the chain or
      // leave the payload permanently "behind". Fail loudly instead.
      throw new Error(
        `migration step '${step.name}' did not set version ${step.to} (got ${readVersion(data)})`,
      );
    }
  }

  return {
    data,
    fromVersion,
    toVersion: CURRENT_DATA_VERSION,
    migrated: stepsApplied.length > 0,
    stepsApplied,
  };
}

function readVersion(data: PersistedAppData): number {
  return data.version ?? DATA_VERSION_BASE;
}
