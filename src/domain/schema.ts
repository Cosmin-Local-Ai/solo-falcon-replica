/**
 * Zod schema for the PFA profile.
 *
 * Pure data validation — no business logic. Used by the persistence layer
 * (store load cycle) to validate the `profile` collection and by the profile
 * service. The canonical type lives in `./models`; this schema is annotated
 * to that type so validation and typing cannot drift apart.
 */
import { z } from 'zod';
import type { Bani } from './money';
import type { PfaProfile } from './models';
import { PFA_REGIME_VALUES } from './regimes';
// PG-6b — one spelling of the activity families. The classifier owns the vocabulary; the persisted
// profile reads its value list instead of restating the pair.
import { ACTIVITY_FAMILY_VALUES } from './fiscal/deductibility';
// PG-6f (B-30) — the persisted token space and the fiscal layer must be one spelling, the same reason
// `ACTIVITY_FAMILY_VALUES` is imported above rather than restated. The registration states and the
// `da`/`nu` answers come from `fiscal/vat.ts`; nothing here invents a seventh state.
import { VAT_REGISTRATION_VALUES, VAT_YES_NO_VALUES } from './fiscal/vat';
// PG-6g (D-VAT-1) — same rule as the two lines above: the persisted token space and the art. 322
// derivation must be ONE spelling. Nothing here restates a route, a branch or a `da`/`nu`/`nedeclarat`
// answer, so a value the derivation cannot read can never reach storage.
import {
  ART322_BRANCH_VALUES,
  VAT_PERIODICITY_VALUES,
  VAT_REGISTRATION_ROUTE_VALUES,
  VAT_YES_NO_UNDECLARED_VALUES,
} from './fiscal/vatPeriodicity';
import { ISO_CALENDAR_DATE } from './date';

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
  pfaStartDate: z.string().regex(ISO_CALENDAR_DATE, 'pfaStartDate must be ISO YYYY-MM-DD').optional(),
  fiscalYear: z.number().int().min(1990).max(2100),
  regime: z.enum(PFA_REGIME_VALUES),
  // Deprecated (Phase 7 / D-1): the CAEN model is `identity.caen`. Kept optional
  // rather than removed so pre-Phase-7 profiles and stored snapshots still
  // parse; migration step v0→v1 folds it into `identity.caen`.
  caen: z.string().optional(),
  salaryStatus: z.enum(['da', 'nu']),
  // CASS only — CF art. 174 alin. (7) lit. a). Optional: absent means "unknown", which
  // calcCass reports as REVIEW_REQUIRED rather than guessing in either direction.
  // Phase 10: **integer bani**, but the gate stays permissive about integrality because parse runs
  // before the v4→v5 migration. Absence must stay absence — never default this to 0 bani.
  salaryIncomeLei: z
    .number()
    .min(0)
    .finite()
    .transform((n) => n as Bani)
    .optional(),
  // @deprecated TASK 5: renamed to `pensionerStatus`. OPTIONAL now (it was required) so a payload that
  // has already been migrated — which no longer carries this key at all — still parses. The migration
  // step reads the raw key before zod ever sees it, so widening this is what keeps old payloads alive.
  pensionStatus: z.enum(['da', 'nu']).optional(),
  // TASK 5 — the pension facts art. 174 alin. (7)/(8) and art. 153 alin. (2) actually test. All
  // OPTIONAL: this is the persisted gate, and a required field here resets every existing payload to
  // seed (see the note above and `store.profileBackfill.test.tsx`). Absence is the honest third state,
  // so none of these may gain a `.default()` — a default would manufacture a legal fact.
  pensionerStatus: z.enum(['da', 'nu']).optional(),
  // Year-attributed on purpose: alin. (7) asks about the income year, alin. (8) about the year before.
  pensionReceiptYears: z
    .array(z.object({ fiscalYear: z.number().int().min(1990).max(2100), received: z.enum(['da', 'nu']) }))
    .optional(),
  // A recorded fact with no legal consequence attached (research 25 gap 1, UNVERIFIED).
  pensionSuspensionYears: z
    .array(
      z.object({
        fiscalYear: z.number().int().min(1990).max(2100),
        months: z.array(z.number().int().min(1).max(12)),
      }),
    )
    .optional(),
  cassPreviousYearContext: z
    .object({
      previousFiscalYear: z.number().int().min(1990).max(2100),
      inExceptedCategory: z.enum(['da', 'nu']).optional(),
      optedUnderArt180Alin1: z.enum(['da', 'nu']).optional(),
    })
    .optional(),
  // art. 153 alin. (2) requires the insurance AND the proof, so both halves stay separate.
  foreignSicknessInsurance: z
    .object({
      fiscalYear: z.number().int().min(1990).max(2100),
      held: z.enum(['da', 'nu']).optional(),
      proved: z.enum(['da', 'nu']).optional(),
    })
    .optional(),
  // PG-6d (D-OTH-2, D-LEG-1, B-41): the `otherIncome` flag array is REMOVED, not deprecated — see the note
  // on `PfaProfile.cassLadderYears` and `docs/ai/research/41_other_income_flags_and_cass_ladder.md` §5.
  // Migration step v15→v16 drops the stored key. Nothing tolerates it any more: D-LEG-1 is a standing
  // decision that there is no stored data to protect, so a retired shape is deleted rather than carried.
  cassLadderYears: z
    .array(
      z.object({
        fiscalYear: z.number().int().min(1990).max(2100),
        // Every amount is OPTIONAL and none has a `.default()`. This is the persisted gate: a required
        // field here would reset every existing payload to seed, and a default would mint a declared
        // amount the person never gave — which for a ladder that sums across all six litera is the
        // difference between an unknown sum and a wrong one (B-41).
        proprietateIntelectuala: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        asocierePersoanaJuridica: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        cedareaFolosinteiBunurilor: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        cedareaSursa: z.enum(['activitate_proprie_a_pfa', 'patrimoniu_personal']).optional(),
        activitatiAgricole: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        activitatiAgricoleBaza: z.enum(['venit_net', 'norma_de_venit']).optional(),
        investitii: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        investitiiBaza: z
          .enum(['castig_net', 'dividende_platite_diminuate_cu_impozitul_retinut'])
          .optional(),
        alteSurse: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        alteSurseArt114: z.enum(['da', 'nu']).optional(),
        neimpozabil: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        cassRetinutLaSursa: z.number().min(0).finite().transform((n) => n as Bani).optional(),
      }),
    )
    .optional(),
  // PG-6b (B-29) — the declared activity family. OPTIONAL, and deliberately without `.default()`:
  // absence means the person was never asked, and defaulting it to `'other'` would assert that the
  // ordinary sistem real rules apply to somebody who has not said so. The values come from
  // `fiscal/deductibility.ts ACTIVITY_FAMILY_VALUES` — the same pair the classifier matches on — so the
  // persisted shape and the rule condition cannot drift into two vocabularies.
  activityFamily: z.enum(ACTIVITY_FAMILY_VALUES).optional(),
  // PG-6h-2 (B-82, B-84) — the accommodation facts. All three OPTIONAL and none with `.default()`, for
  // the reason every addition above gives: this is the persisted gate, and a required field here resets
  // every existing payload to seed. Absence is also the honest state — a room count invented by a schema
  // default would invent a tax category (art. 83 alin. (2) vs art. 83 alin. (4)), and a commission
  // default would choose between the two readings of art. 68^3 alin. (3) that no primary source settles.
  // Year-attributed like the pension facts above, because art. 83 alin. (4) speaks per fiscal year.
  accommodationRoomCounts: z
    .array(z.object({ fiscalYear: z.number().int().min(1990).max(2100), rooms: z.number().int().min(0) }))
    .optional(),
  accommodationCommissionReading: z.enum(['reading_a', 'reading_b']).optional(),
  accommodationTourismEligibility: z.enum(['da', 'nu']).optional(),
  // B-105 — the ordinary *cedarea folosinței bunurilor* facts. All optional, none with `.default()`, for
  // the reason every addition above gives: this is the persisted gate, and a required field here resets
  // every payload written before it. Absence is also the honest state — a tenant nature invented by a
  // default would decide whether a Declarația Unică is owed for the income at all (art. 122 alin. (6)
  // lit. a) exempts where the tax is withheld and final; alin. (7) still requires one for the
  // contributions), and a contract date invented by a default would mint a 30-day registration term under
  // art. 83 alin. (5) that nobody owes. Year-attributed because art. 84 alin. (1) speaks per fiscal year.
  leaseFactsYears: z
    .array(
      z.object({
        fiscalYear: z.number().int().min(1990).max(2100),
        tenantNature: z.enum(['persoana_fizica', 'entitate_cu_evidenta_contabila']).optional(),
        contractRentAnnual: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        ownerCostsPaidByTenant: z.number().min(0).finite().transform((n) => n as Bani).optional(),
        rentPaidExclusivelyInKind: z.enum(['da', 'nu']).optional(),
        guaranteeAppliedToRent: z.enum(['da', 'nu']).optional(),
        contractDate: z
          .string()
          .regex(ISO_CALENDAR_DATE, 'leaseFactsYears.contractDate must be ISO YYYY-MM-DD')
          .optional(),
        contractRegistered: z.enum(['da', 'nu']).optional(),
      }),
    )
    .optional(),
  socialInsuranceStatus: z.enum(['obligatoriu', 'exempt', 'neplata']),
  // PG-6f (B-30, D-LEG-1) — `vatExempt: z.boolean()` is **removed**, not widened. D-LEG-1 is standing
  // („we do not need legacy data. we have no users yet”): a retired shape is deleted from the type, the
  // schema, the fixtures, the copy and the migration's tolerance for it, rather than carried as a shim.
  // The v17→v18 chain step drops the stored key; the chain itself and its numbering are untouched.
  //
  // The replacement is OPTIONAL with no `.default()`, and that is load-bearing rather than tidy: the two
  // plausible defaults move the money measure of every record in the register in opposite directions.
  // `effectiveFrom` is optional too — a person may know the state and not the date, and the app then
  // names the missing date instead of choosing one under art. 316 alin. (1¹).
  vatRegistration: z
    .object({
      status: z.enum(VAT_REGISTRATION_VALUES),
      effectiveFrom: z.string().regex(ISO_CALENDAR_DATE, 'vatRegistration.effectiveFrom must be ISO YYYY-MM-DD').optional(),
      // TVA la încasare is an orthogonal scheme, not a registration state — see `fiscal/vat.ts`.
      cashAccounting: z.enum(VAT_YES_NO_VALUES).optional(),
    })
    .optional(),
  // PG-6f — the declared art. 300 pro rata, per fiscal year. Year-attributed like the pension and
  // accommodation facts above, because the pro rata is an annual figure (art. 300 alin. (9), (14)).
  vatProRataYears: z
    .array(
      z.object({
        fiscalYear: z.number().int().min(1990).max(2100),
        percent: z.number().min(0).max(100),
      }),
    )
    .optional(),
  /**
   * PG-6g (D-VAT-1, B-35 residual) — the CF art. 322 facts, per calendar year. Every field is optional and
   * **no field has a `.default()`**, which is the whole design: art. 322 alin. (3) asks for a figure the
   * taxpayer `preconizează`, and alin. (4) turns on whether they came from the art. 310 exemption. A
   * default for either would be the app answering its own question, and the two plausible defaults move a
   * new PFA between monthly and quarterly filing.
   *
   * `userChoice` is the only place a periodicity is ever stored, and it requires `confirmedBy: 'user'` —
   * the literal, not an enum with an app-side value. There is no way to write down "the app decided".
   *
   * Money fields are **integer bani**, like every other stored amount since Phase 10: the cap comparison in
   * art. 322 is done in bani against a lei equivalent derived through `domain/fx/capCeiling.ts`.
   */
  vatPeriodicityYears: z
    .array(
      z.object({
        year: z.number().int().min(1990).max(2100),
        registrationEffectiveFrom: z
          .string()
          .regex(ISO_CALENDAR_DATE, 'vatPeriodicityYears.registrationEffectiveFrom must be ISO YYYY-MM-DD')
          .optional(),
        registrationRoute: z.enum(VAT_REGISTRATION_ROUTE_VALUES).optional(),
        inArt310BeforeRegistration: z.enum(VAT_YES_NO_UNDECLARED_VALUES).optional(),
        precedingYearTurnover: z.number().int().min(0).transform((n) => n as Bani).optional(),
        precedingYearAicGoods: z.enum(VAT_YES_NO_UNDECLARED_VALUES).optional(),
        forecastStubTurnover: z.number().int().min(0).transform((n) => n as Bani).optional(),
        actualTurnover: z.number().int().min(0).transform((n) => n as Bani).optional(),
        actualActivityMonths: z.number().int().min(0).max(12).optional(),
        actualTurnoverScope: z
          .enum(['doar_cu_cod_de_tva', 'include_ante_inregistrare', 'nedeclarat'])
          .optional(),
        aicGoodsBeforeRegistration: z.enum(VAT_YES_NO_UNDECLARED_VALUES).optional(),
        aicGoodsWhileQuarterly: z.enum(VAT_YES_NO_UNDECLARED_VALUES).optional(),
        // art. 322 alin. (7) answers differently per month of the quarter, so the month is a separate fact
        // from the yes/no. Bounded to 1-12: a value outside that range cannot name a month, and the
        // derivation must not guess one.
        aicGoodsExigibilityMonth: z.number().int().min(1).max(12).optional(),
        art310ReturnRequested: z.enum(VAT_YES_NO_UNDECLARED_VALUES).optional(),
        userChoice: z
          .object({
            periodicity: z.enum(VAT_PERIODICITY_VALUES),
            branch: z.enum(ART322_BRANCH_VALUES),
            // The literal, not a vocabulary: the app cannot record that IT chose.
            confirmedBy: z.literal('user'),
            confirmedOn: z.string().regex(ISO_CALENDAR_DATE, 'userChoice.confirmedOn must be ISO YYYY-MM-DD'),
          })
          .optional(),
      }),
    )
    .optional(),
  // The one input `VAT_REGISTRATION_DEADLINE_2026` was still missing (P-PROFILE-VAT-DATE).
  // OPTIONAL for the same data-loss reason as every addition above: this is the persisted gate,
  // and a required field here would reset every pre-existing payload to seed. The shape check is
  // safe because no legacy payload can contain the field at all — there is nothing legacy to
  // reject, unlike the CUI/CNP shape checks deliberately left out of `pfaIdentitySchema` above.
  vatExceedanceDate: z.string().regex(ISO_CALENDAR_DATE, 'vatExceedanceDate must be ISO YYYY-MM-DD').optional(),
  // Phase 10: **integer bani** (key name kept — see the caveat on `PfaProfile.cashFloorLei`). Required:
  // a payload without it is corrupt, and defaulting it would fabricate a cash floor of 0.
  cashFloorLei: z.number().min(0).transform((n) => n as Bani),
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
