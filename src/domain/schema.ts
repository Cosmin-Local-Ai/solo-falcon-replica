/**
 * Zod schema for the PFA profile.
 *
 * Pure data validation — no business logic. Used by the persistence layer
 * (store load cycle) to validate the `profile` collection and by the profile
 * service. The canonical type lives in `./models`; this schema is annotated
 * to that type so validation and typing cannot drift apart.
 */
import { z } from 'zod';
import type { PfaProfile } from './models';
import { PFA_REGIME_VALUES } from './regimes';

/**
 * One CAEN code + description. `cod` is required non-empty because an entry
 * without a code carries no meaning; `descriere` stays a plain string so a
 * legacy entry with an empty description is never a data-loss event.
 */
export const caenCodeSchema = z.object({
  cod: z.string().min(1),
  descriere: z.string(),
});

export const pfaIdentitySchema = z.object({
  nume: z.string(),
  cnp: z.string(),
  adresa: z.string(),
  telefon: z.string(),
  email: z.string(),
  denumire: z.string(),
  cui: z.string(),
  formaJuridica: z.string(),
  numarRegComert: z.string(),
  adresaSocietate: z.string(),
  telefonSocietate: z.string(),
  emailSocietate: z.string(),
  contBancar: z.string(),
  banca: z.string(),
  // Phase 7 (D-1) additions, OPTIONAL on purpose — same data-loss rule Phase 6
  // followed for pfaStartDate/salaryIncomeLei (see the note on pfaProfileSchema).
  // pfaIdentitySchema also validates the embedded profile of every stored
  // calculation snapshot, so a required field here would wipe every pre-Phase-7
  // payload. Proven by src/data/store.migration.chain.test.tsx.
  // Format validation (CUI check digit, CNP, RO-IBAN, CAEN shape) is
  // deliberately NOT added here: it would reject legacy values that were
  // accepted before, i.e. it would itself be a data-loss event. Input-level
  // validation belongs to the form, not to the persisted-data gate.
  codTvaIntra: z.string().optional(),
  caen: z.array(caenCodeSchema).optional(),
  mentiuniFactura: z.string().optional(),
});

export const pfaProfileSchema: z.ZodType<PfaProfile> = z.object({
  id: z.string().min(1),
  pfaStartYear: z.number().int().min(1990).max(2100),
  // Phase 6 additions are OPTIONAL on purpose. `pfaProfileSchema` validates the persisted
  // profile (data/schema.ts:129 -> parsePfaProfile) and an invalid payload makes store.tsx
  // reset the ENTIRE dataset to seed with no message — so a REQUIRED new field would
  // destroy every existing `pfa-app-data-v2` payload. Proven by
  // src/data/store.profileBackfill.test.tsx. Phase 7 owns the version field + migration.
  pfaStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pfaStartDate must be ISO YYYY-MM-DD').optional(),
  fiscalYear: z.number().int().min(1990).max(2100),
  regime: z.enum(PFA_REGIME_VALUES),
  // Deprecated (Phase 7 / D-1): the CAEN model is `identity.caen`. Kept optional
  // rather than removed so pre-Phase-7 profiles and stored snapshots still
  // parse; migration step v0→v1 folds it into `identity.caen`.
  caen: z.string().optional(),
  salaryStatus: z.enum(['da', 'nu']),
  // CASS only — CF art. 174 alin. (7) lit. a). Optional: absent means "unknown", which
  // calcCass reports as REVIEW_REQUIRED rather than guessing in either direction.
  salaryIncomeLei: z.number().min(0).finite().optional(),
  pensionStatus: z.enum(['da', 'nu']),
  otherIncome: z.array(z.enum(['imobiliare', 'autovehicule', 'dividende', 'concesiune', 'alte'])),
  socialInsuranceStatus: z.enum(['obligatoriu', 'exempt', 'neplata']),
  vatExempt: z.boolean(),
  cashFloorLei: z.number().min(0),
  identity: pfaIdentitySchema,
  updatedAt: z.string().min(1),
});

/**
 * Validate an unknown value (e.g. parsed from localStorage) as a PfaProfile.
 * Returns null when the value is missing or invalid.
 */
export function parsePfaProfile(value: unknown): PfaProfile | null {
  const result = pfaProfileSchema.safeParse(value);
  return result.success ? result.data : null;
}
