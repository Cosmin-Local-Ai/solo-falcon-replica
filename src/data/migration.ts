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
/** The version this build writes. */
export const CURRENT_DATA_VERSION = DATA_VERSION_DATES;

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
    cashFloorLei: 0,
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
