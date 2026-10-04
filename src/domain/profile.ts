/**
 * Profile service — domain logic for the PFA profile.
 *
 * Thin, pure helpers: default profile factory, active-profile lookup by
 * fiscal year, and the additive identity read path (the profile is the
 * source of truth for identity/contact data).
 */
import type { PfaIdentity, PfaProfile } from './models';
import { localYear, now, toInstantISO } from './date';

const EMPTY_IDENTITY: PfaIdentity = {
  nume: '',
  cnp: '',
  adresa: '',
  telefon: '',
  email: '',
  denumire: '',
  cui: '',
  formaJuridica: '',
  numarRegComert: '',
  adresaSocietate: '',
  telefonSocietate: '',
  emailSocietate: '',
  contBancar: '',
  banca: '',
};

/**
 * Create a profile with safe defaults (cashFloorLei 0, no other income,
 * non-exempt VAT, no salary/pension). `overrides` fills in the rest.
 */
export function createDefaultProfile(
  overrides: Partial<PfaProfile> = {},
  instant: Date = now(),
): PfaProfile {
  return {
    id: 'profile-1',
    pfaStartYear: localYear(instant),
    fiscalYear: localYear(instant),
    regime: 'impozit_pe_venit',
    caen: '',
    salaryStatus: 'nu',
    pensionStatus: 'nu',
    otherIncome: [],
    socialInsuranceStatus: 'neplata',
    vatExempt: false,
    cashFloorLei: 0,
    identity: { ...EMPTY_IDENTITY },
    updatedAt: toInstantISO(instant),
    ...overrides,
  };
}

/**
 * Return the active profile for the given fiscal year.
 *
 * The app keeps a single profile (one source of truth); it is "active" for
 * the fiscal year it declares. Returns null when there is no profile or the
 * profile belongs to a different fiscal year.
 */
export function getActiveProfile(profile: PfaProfile | null, fiscalYear: number): PfaProfile | null {
  if (!profile) return null;
  return profile.fiscalYear === fiscalYear ? profile : null;
}

/**
 * Additive identity read path: identity/contact data is read from the
 * profile, the single source of truth for identity.
 */
export function profileIdentity(profile: PfaProfile): PfaIdentity {
  return profile.identity;
}
