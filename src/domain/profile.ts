/**
 * Profile service — domain logic for the PFA profile.
 *
 * Thin, pure helpers: default profile factory, active-profile lookup by
 * fiscal year, and the additive identity read path (the profile is the
 * source of truth for identity/contact data).
 */
import type { PfaIdentity, PfaProfile } from './models';
import { lei } from './money';
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
  codTvaIntra: '',
  caen: [],
  mentiuniFactura: '',
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
    // Phase 7 (D-1): CAEN lives in `identity.caen`; the deprecated `caen` string
    // is not written for new profiles.
    salaryStatus: 'nu',
    // TASK 5: `pensionerStatus` is the STATUS fact only (CF art. 150 alin. (1) — CAS). The receipt facts
    // that CF art. 174 alin. (7) lit. c) keys on are NOT defaulted here: a fresh profile has not recorded
    // them, and defaulting one would state a fact the user never entered.
    pensionerStatus: 'nu',
    // PG-6d (D-LEG-1, B-41): the other-income flag list is gone, and nothing replaces it here. What
    // replaces it is a per-year AMOUNT for each art. 155 alin. (1) lit. c)-h) category, and a fresh
    // profile has answered none of them. Writing an empty array would say „asked, and none”; absence
    // says „not asked yet”, and only the second one is true.
    socialInsuranceStatus: 'neplata',
    vatExempt: false,
    // Phase 10: money is integer bani. `lei(0)` rather than a bare `0` keeps the unit explicit at the
    // factory — a cash floor of 0 is a deliberate value, not an absent one.
    cashFloorLei: lei(0),
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

/**
 * The name to greet the person by, derived from `identity.nume`.
 *
 * `nume` is free text and this dataset stores it surname-first ('Popescu Andrei'),
 * so the given name is taken as the LAST token rather than assuming a Western
 * first-name-first order. A single token is used as-is; an empty name yields ''
 * so the caller can drop the greeting instead of rendering "Bună,".
 *
 * Deliberately NOT the full name: the topbar already renders `identity.nume`,
 * and duplicating it in the page body makes the name ambiguous for text-based
 * queries (testing-library and Playwright strict mode both fail on two matches).
 */
export function identityGreeting(identity: PfaIdentity): string {
  const parts = identity.nume.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}
