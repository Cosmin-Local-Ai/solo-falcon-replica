/**
 * PG-6e (B-31, D-FA-1) — fiscal depreciation for a PFA în sistem real, and the two vehicle ceilings
 * that belong to it.
 *
 * ## Why this module exists at all
 *
 * `docs/ai/research/36_fixed_assets_and_depreciation_2026.md` §1.1 puts the borrowing rule in one
 * sentence: CF art. 68 alin. (4) lit. d) requires a Titlul IV expense „să respecte regulile privind
 * amortizarea, prevăzute în titlul II, după caz". The Titlul IV norms then make depreciation deductible
 * by name — pct. 7 alin. (5) lit. n): „cheltuielile cu amortizarea, în conformitate cu prevederile art.
 * 28 din Codul fiscal, după caz" — and pct. 7 alin. (7) expressly takes depreciation OUT of the 50 %
 * vehicle haircut and re-points it at art. 28: „cu excepția cheltuielilor privind amortizarea pentru care
 * se aplică regulile privind amortizarea prevăzute la art. 28 titlul II".
 *
 * So the arithmetic lives here, and the classification rules in `./deductibility2026.ts` stay exactly as
 * they are. `depreciable_asset_purchase` (art. 68 alin. (7) lit. h)) keeps a capital purchase out of the
 * direct-expense side, and `depreciation_business_asset` (art. 68 alin. (4) lit. d)) stays the only route
 * by which a capital asset reaches the expense side. **No fourth classification rule was added** — the
 * missing thing was the arithmetic and the register, not another treatment.
 *
 * ## What is a rule and what is a reading
 *
 * Every fiscal figure this module uses is a parameter on `FISCAL_DEPRECIATION_2026` in `./package2026.ts`,
 * with its citation. Nothing here is a hard-coded lei amount, a Catalog duration, or a coefficient.
 *
 * Two pieces of the arithmetic are **this application's construction**, and `research/36` §12.2 is a
 * documented negative about them: the 624-page Partea I contains no daily formula, no monthly table and
 * no first-year fraction anywhere. They are encoded because a schedule cannot be built without them, and
 * they are labelled as constructions in the breakdown, in the UI copy and in the phase doc:
 *
 *  1. **The degresiv switch.** pct. 25's worked example (350.000 lei, 10 ani, 10 % × 2,0 = 20 %) runs the
 *     degresive rate for years 1–5 and then, from year 6, „114.688/5 ani" = 22.937,6 per year. That is
 *     the only worked example in the norms, and the switch is read off it.
 *  2. **The first-year pro-rating.** art. 28 alin. (12) lit. a) says depreciation starts „începând cu luna
 *     următoare celei în care mijlocul fix amortizabil se pune în funcțiune". It gives no fraction. The
 *     1/12-per-month reading of the months from that month through Decembrie is ours.
 *
 * Acceptance for this phase pins the reading against pct. 25's numbers. If that test fails, the reading
 * is wrong — not the example.
 *
 * ## The two vehicle lists, kept apart on purpose
 *
 * `research/36` §12.7 and `docs/ai/research/40_vehicle_one_car_limit.md` §4 record that the two vehicle
 * exception lists in the code are **different provisions** and must never be merged:
 *
 * - **CF art. 28 alin. (14)** — the 1.500 lei/lună depreciation ceiling — has **four** exception
 *   categories, and its second one names „test drive și … demonstrații".
 * - **CF art. 68 alin. (7) lit. k)** — the 50 % running-cost rule, spelled in `./deductibility.ts` as
 *   `VehicleExceptionCategory` — has **five**, has **no** test-drive wording, adds „vehiculele utilizate
 *   ca mărfuri în scop comercial", and closes: „Cheltuielile care intră sub incidența acestor prevederi
 *   **nu includ cheltuielile privind amortizarea**."
 *
 * `M1ExceptionCategory` below is the alin. (14) list. It is a separate type with a separate name, and
 * `VehicleCapStatus` from PG-6c is **not** reused here: depreciation is expressly per vehicle with no
 * one-car limit („pentru fiecare"), while running costs are capped at one car per person. Merging the two
 * would merge two provisions the law deliberately keeps apart.
 */
import Decimal from 'decimal.js-light';
import { applyRateDecimal, lei, subBani, toBaniNearest, type Bani } from '../money';
import type { FiscalRule } from './rules';

/** The rule id this module reads its fiscal figures from. */
export const FISCAL_DEPRECIATION_RULE_ID = 'FISCAL_DEPRECIATION_2026';

// ── The declared facts ──────────────────────────────────────────────────────

/**
 * The two methods art. 28 alin. (5) makes available to a PFA. alin. (5) lit. a) forces liniară for
 * constructions; lit. b) allows liniară / degresivă / accelerată for equipment, machines, tools,
 * installations and computers with their peripherals; lit. c) allows liniară or degresivă for anything
 * else. **accelerată and the 2026 super-accelerated alin. (8¹) method are not modelled** — see the note on
 * `method` in `data/types.ts` for why (the 65 % method is gated on Catalog subgrupa 2.1 / 2.4, and
 * `research/36` §8.6 shows office IT sits in subgrupa 2.2, so encoding it would need a Catalog lookup,
 * which D-FA-1 puts out of scope).
 */
export type DepreciationMethod = 'liniar' | 'degresiv';

export const DEPRECIATION_METHODS: readonly DepreciationMethod[] = ['liniar', 'degresiv'];

/**
 * How the asset entered the business patrimony. This is not bookkeeping: it decides whether the
 * depreciation can be deducted at all.
 *
 * `aport` is the contested case. `research/36` §10 records it as unresolved: art. 68 alin. (7) lit. k¹)
 * sits under „Nu sunt cheltuieli deductibile:" and excludes „cheltuielile cu amortizarea bunurilor din
 * patrimoniul personal afectate exercitării activității, potrivit legii" without excepting contributed
 * assets, while CF art. 7 pct. 44 lit. c) defines a fiscal value for „mijloace fixe dobândite cu titlu
 * gratuit ori constituite ca aport … utilizată pentru calculul amortizării fiscale". The norms' only
 * contributed-asset depreciation base is confined to assets „care trec în patrimoniul **altei afaceri**"
 * (§10.2), i.e. business→business. **The app refuses and names both texts.** It does not pick.
 */
export type AssetAcquisition = 'cumparare' | 'aport' | 'productie';

export const ASSET_ACQUISITIONS: readonly AssetAcquisition[] = ['cumparare', 'aport', 'productie'];

/**
 * Whether the price has been paid. Recorded because the collision between payment and *punerea în
 * funcțiune* is the one place the cash basis of art. 68 alin. (4) lit. b) meets a non-cash expense.
 *
 * `research/36` §4.3 and §11.1 are a **documented negative**: no Titlul IV norm and no REF provision says
 * depreciation is deductible regardless of payment, and none conditions it on payment. The operational
 * answer the app implements — an asset put in function in 2026 but paid in 2027 starts depreciating in
 * 2026 — is a reading (§4.6, §11.3), corroborated by four independent practitioner sources and endorsed by
 * none of them being ANAF. Where the facts make the reading **matter** — unpaid, or paid in instalments,
 * or paid in a later year than the one depreciation starts in — this module refuses and names both sides.
 */
export type AssetPaymentState = 'achitat' | 'in_rate' | 'neachitat';

export const ASSET_PAYMENT_STATES: readonly AssetPaymentState[] = ['achitat', 'in_rate', 'neachitat'];

/**
 * The art. 28 alin. (21) election for an asset **below** the 5.000-lei threshold, and the only two
 * branches Titlul II norm pct. 31 leaves open.
 *
 * pct. 31 is the provision that fixes WHEN the choice is made — „opţiunea se efectuează **la data
 * intrării** imobilizării corporale în patrimoniul contribuabilului" — and that the two branches are
 * alternatives, so the flag is per asset and cannot be flipped after the fact. It also says even the
 * full-expensing branch is timed at *punerea în funcțiune*, not at payment.
 *
 * Absence is a real state and is not defaulted: an asset below the threshold whose owner never recorded
 * the election has an unknown treatment, and `unknown` is not the same fact as either branch.
 */
export type SubThresholdElection = 'intreg_la_punere_in_functiune' | 'amortizare';

export const SUB_THRESHOLD_ELECTIONS: readonly SubThresholdElection[] = [
  'intreg_la_punere_in_functiune',
  'amortizare',
];

/**
 * The **four** exception categories of CF art. 28 alin. (14) — the provision that caps M1 depreciation at
 * 1.500 lei/lună. This is NOT the art. 68 alin. (7) lit. k) list in `./deductibility.ts`, which has five,
 * has no test-drive wording, and expressly excludes amortisation. See the module header.
 *
 * `research/36` §12.6 is a documented negative about these four: `M1` occurs exactly once in the whole
 * 624-page Partea I (in pct. 27), and the norms say nothing about how any of the four is evidenced. The
 * only evidencing requirement in the Titlul IV norms is the *foaie de parcurs* for the 50 % running-cost
 * rule. So a category here is **claimed by the taxpayer**, and a logbook is not evidence of it.
 */
export type M1ExceptionCategory =
  | 'urgenta_paza_curierat'
  | 'vanzari_achizitii_test_drive_demonstratii'
  | 'transport_persoane_cu_plata_inclusiv_taxi'
  | 'servicii_inchiriere_leasing_opercional_scoli_soferi';

export const M1_EXCEPTION_CATEGORIES: readonly M1ExceptionCategory[] = [
  'urgenta_paza_curierat',
  'vanzari_achizitii_test_drive_demonstratii',
  'transport_persoane_cu_plata_inclusiv_taxi',
  'servicii_inchiriere_leasing_opercional_scoli_soferi',
];

/**
 * How the asset left the register. The distinction is pct. 29's, and it is not a formality:
 * „Prin casarea unui mijloc fix se înţelege operaţia de scoatere din funcţiune a activului respectiv,
 * **urmată de dezmembrarea acestuia și valorificarea părților componente** rezultate, prin vânzare sau
 * prin folosirea în activitatea curentă." A bare decommissioning is a *scoatere din funcțiune*, not a
 * *casare*. pct. 30 makes the residual value of unfinished investments written off a **cheltuială
 * nedeductibilă** unless valorified by sale or casare.
 */
export type AssetDisposalKind = 'vanzare' | 'casare' | 'scoatere_din_gestiune';

export const ASSET_DISPOSAL_KINDS: readonly AssetDisposalKind[] = [
  'vanzare',
  'casare',
  'scoatere_din_gestiune',
];

/**
 * The declared facts about one fixed asset, per asset.
 *
 * They live in the layer that reads them — the same reason `VehicleYearFacts` lives in `./deductibility.ts`
 * and not in `data/types.ts`: a vocabulary spelled twice drifts. `data/types.ts` builds the stored
 * `FixedAsset` record on top of this shape by adding an `id`.
 *
 * **Nothing here has a default.** Every field the taxpayer has not answered stays unanswered, and an
 * unanswered field makes the schedule refuse rather than assume.
 */
export interface FixedAssetFacts {
  /** The person's own name for the asset — an identity they recognise, not a code. */
  label: string;
  /**
   * „data intrării în patrimoniul contribuabilului" — art. 28 alin. (2) lit. b) measures the 5.000-lei
   * threshold here, and pct. 31 makes the alin. (21) election here. **Not** the payment date and **not**
   * the invoice date.
   */
  entryDate: string;
  /**
   * *Punerea în funcțiune*. art. 28 alin. (12) lit. a) starts depreciation with the month after this one.
   *
   * `research/36` §12.3 is a documented negative: the term is **never defined** in fiscal law — the only
   * definitional-adjacent hit in the whole Partea I leaves it „potrivit prevederilor legale". The
   * *procesul-verbal de dare în folosință* anchor is practitioner doctrine only. The app asks for the date
   * and cites the doctrine as doctrine; with no date it refuses, because without it there is no start.
   */
  putInFunctionDate?: string;
  /**
   * The depreciable fiscal value at entry. For a PFA that is not a TVA payer this **includes the VAT that
   * became non-deductible** — Titlul II norm pct. 28 lit. b) is affirmative: „în valoarea fiscală a
   * mijloacelor fixe, la data intrării în patrimoniu, se include și taxa pe valoarea adăugată devenită
   * nedeductibilă".
   *
   * That is the depreciable base only. It does **not** reach ordinary expenses, so **B-87 stays open**
   * after this phase.
   */
  fiscalValue: Bani;
  /**
   * How much of `fiscalValue` is non-recoverable VAT, recorded separately so the inclusion is visible
   * rather than implied. Optional: a TVA payer may have none.
   */
  nonDeductibleVatIncluded?: Bani;
  /**
   * *Durata normală de funcționare*, in months, **declared by the taxpayer**.
   *
   * Titlul II norm pct. 27 speaks of „durata normală de funcţionare **stabilită de contribuabil** potrivit
   * Catalogului", and Catalog Cap. I pct. 4 gives a *plajă de ani* to choose inside. **No Catalog is
   * encoded here** — a lookup would be a classification decision, and `research/36` §16.1 records that even
   * a mobile phone's class is a judgement.
   */
  normalLifeMonths?: number;
  method?: DepreciationMethod;
  /** Meaningful only below the 5.000-lei threshold; see `SubThresholdElection`. */
  subThresholdElection?: SubThresholdElection;
  acquisition?: AssetAcquisition;
  paymentState?: AssetPaymentState;
  /** The date the price was actually paid, when it was paid. */
  paidOn?: string;
  /**
   * Whether this asset is a category **M1** passenger vehicle — RNTR 2 / OMMLTL 211/2003: at most 9 seats
   * including the driver. Declared, never inferred from the label or from an expense category.
   */
  isM1Vehicle?: boolean;
  /** Claimed alin. (14) exception. Claimed, not inferred — see `M1ExceptionCategory`. */
  m1ExceptionCategory?: M1ExceptionCategory;
  disposedOn?: string;
  disposalKind?: AssetDisposalKind;
  /**
   * B-65 / brief 76 — „venitul realizat din înstrăinare”: what the asset actually brought in when it left.
   *
   * Titlul II norm pct. 27 caps the unamortised residual of an M1 at 1.500 lei × the months left of the
   * declared duration. Titlul IV norm pct. 7 alin. (5) lit. o) caps **the same residual a second time**,
   * „la nivelul venitului realizat din înstrăinare” — the proceeds. Brief 74 implemented the first cap and
   * deliberately did not post the figure, because nothing in the app held the second one: posting pct. 27's
   * number would over-deduct whenever the asset sold for less than it was still worth, which is the usual
   * case.
   *
   * **Optional, and the v23→v24 step backfills nothing.** A sale price is a fact about a transaction, and no
   * stored field records it; deriving one from the fiscal value, from the residual or from the declared
   * duration would be inventing the number the norm measures against. Absence is not zero: it means the
   * second limit cannot be measured, and the app says so instead of treating the first limit as the answer.
   *
   * **Adding this field does not make the figure postable.** B-153 is still open: the schedule keeps
   * amortising past the month of the *scoatere din gestiune* while `disposalFigure` counts only the months
   * actually used, so the residual is measured off a `monthsUsed` the posted schedule does not match. With
   * both limits known the reported number is the correct ceiling; it is still not a deductible amount, and
   * `complete` on the outcome is what carries that.
   */
  disposalProceeds?: Bani;
}

// ── The outcome ─────────────────────────────────────────────────────────────

/**
 * One calendar year of the schedule. The fiscal year is the unit the register and the fișa are read in,
 * and art. 28 alin. (12) lit. a) is read in calendar years too.
 */
export interface DepreciationYear {
  fiscalYear: number;
  /** Months depreciated in this calendar year. 0 for the year *punerea în funcțiune* falls in when that month is Decembrie. */
  months: number;
  /** The first calendar month of that year which carries amortisation — needed to place the disposal date. */
  startMonthInYear: number;
  /** The fiscal depreciation for this year before the art. 28 alin. (14) ceiling. */
  uncapped: Bani;
  /** What survives the ceiling. */
  deductible: Bani;
  /**
   * `uncapped − deductible`. **Definitively lost.** `research/36` §12.13 records that the excess over
   * 1.500 lei/lună „nu se reportează și nu se recuperează în anii următori" — corroborated secondary, with
   * no statutory text stating it, because the cap is a deduction limit rather than a timing rule. Presenting
   * it as a carry-forward would invent a deduction.
   */
  lost: Bani;
  /** Which branch produced this year's figure. */
  branch: 'liniar' | 'degresiv_anuali' | 'degresiv_linie_dreapta' | 'valoare_intreaga';
  /** True for the calendar year that carries the 1/12 pro-rating — the construction, labelled. */
  proRated: boolean;
}

/** The gaps this module refuses rather than resolves. Each one is a silence in the law, not a missing input. */
export type DepreciationGap =
  /** §12.3 — *punerea în funcțiune* is undefined in fiscal law and no date was recorded. */
  | 'punere_in_functiune_absenta'
  /** §10 — aport of a personally-owned depreciable asset: k¹) against art. 7 pct. 44 lit. c). */
  | 'aport_contra_k1'
  /** §4.3 / §11.1 — payment against *punerea în funcțiune*, where the facts make the reading matter. */
  | 'plata_vs_punere_in_functiune'
  /** art. 28 alin. (21) + pct. 31 — the sub-threshold election was never made at entry. */
  | 'optiune_alin_21_lipsa'
  /** pct. 27 — the duration is „stabilită de contribuabil"; without it there is no schedule and no disposal cap. */
  | 'durata_lipsa'
  /** art. 28 alin. (7) gives coefficients for 2–5, 6–10 and over 10 ani. A duration under 2 ani has none. */
  | 'coeficient_degresiv_indefinit';

export type DepreciationOutcome =
  | {
      status: 'computed';
      years: DepreciationYear[];
      /** The labelled readings and constructions this schedule rests on. */
      notes: string[];
      /** The disposal figure under pct. 27, when the asset has left the register. */
      disposal?: {
        unamortised: Bani;
        remainingMonths: number;
        /** Titlul II pct. 27 — 1.500 lei × the months left of the declared duration. */
        cap: Bani;
        /**
         * Titlul IV pct. 7 alin. (5) lit. o) — „nivelul venitului realizat din înstrăinare”. `null` when the
         * proceeds were never recorded, which means this second limit exists and cannot be measured.
         */
        proceedsCap: Bani | null;
        /** The declared proceeds themselves, or `null`. Kept beside the cap so the screen can name its source. */
        proceeds: Bani | null;
        /**
         * `unamortised` after whichever limit binds. **Only a deductible amount when `complete` is true** —
         * with no proceeds recorded this is the pct. 27 ceiling alone, and the norm's second limit is still
         * unapplied.
         */
        deductible: Bani;
        lost: Bani;
        capped: boolean;
        /** Which limit bound: pct. 27, the proceeds, or neither. */
        bound: 'pct-27' | 'proceeds' | 'none';
        /**
         * False while the proceeds are missing. Named so no caller can read `deductible` as postable without
         * deciding whether the second cap was ever measured.
         */
        complete: boolean;
      };
    }
  | { status: 'review_required'; gap: DepreciationGap; reason: string };

// ── Reading the rule ────────────────────────────────────────────────────────

function paramNumber(rule: FiscalRule, id: string): number {
  const p = rule.parameters.find((x) => x.id === id);
  if (!p || typeof p.value !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  return p.value;
}

/** The unit-guarded money reader — the same rule `paramBani` in ./calculators.ts enforces. */
function paramLei(rule: FiscalRule, id: string): Bani {
  const p = rule.parameters.find((x) => x.id === id);
  if (!p || typeof p.value !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  if (p.unit !== 'lei') {
    throw new Error(`Parameter '${id}' of rule ${rule.ruleId} has unit '${p.unit}', not 'lei'`);
  }
  return p.value as Bani;
}

/** The degresivity coefficient for a declared duration, from the three parameters art. 28 alin. (7) gives. */
function degresiveCoefficient(rule: FiscalRule, durationYears: number): number | null {
  if (durationYears < 2) return null; // no coefficient is defined below 2 ani — the law is silent.
  if (durationYears <= 5) return paramNumber(rule, 'degresive_coefficient_2_5');
  if (durationYears <= 10) return paramNumber(rule, 'degresive_coefficient_6_10');
  return paramNumber(rule, 'degresive_coefficient_over_10');
}

// ── Dates ───────────────────────────────────────────────────────────────────

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const yearOf = (iso: string): number => Number(iso.slice(0, 4));
const monthOf = (iso: string): number => Number(iso.slice(5, 7));

// ── The schedule ────────────────────────────────────────────────────────────

/**
 * Build the fiscal depreciation schedule for one asset.
 *
 * Pure: it reads the declared facts and the rule's parameters and returns either a schedule or a named
 * refusal. It never mutates the asset, never reads an `Expense`, and never infers a fact that was not
 * declared — an asset with no *punerea în funcțiune* date refuses rather than falling back to the entry
 * date or to the invoice date, because those are exactly the substitutions the research says the law does
 * not license.
 */
export function depreciationSchedule(rule: FiscalRule, asset: FixedAssetFacts): DepreciationOutcome {
  const threshold = paramLei(rule, 'expensing_threshold');
  const monthlyCap = paramLei(rule, 'm1_monthly_cap');

  if (!isIsoDate(asset.entryDate)) {
    return {
      status: 'review_required',
      gap: 'durata_lipsa',
      reason:
        'art. 28 alin. (2) lit. b) măsoară pragul de 5.000 lei „la data intrării în patrimoniul ' +
        'contribuabilului". Fără această dată nu se poate stabili nici pragul, nici opțiunea din alin. (21).',
    };
  }

  // Silence 3 — punerea în funcțiune. §12.3: the term is undefined in fiscal law, and the
  // procesul-verbal anchor is practitioner doctrine. Without a date there is no first month, so the
  // schedule cannot start; the app asks rather than substituting the entry date or the invoice date.
  if (!asset.putInFunctionDate || !isIsoDate(asset.putInFunctionDate)) {
    return {
      status: 'review_required',
      gap: 'punere_in_functiune_absenta',
      reason:
        'art. 28 alin. (12) lit. a): amortizarea începe „cu luna următoare celei în care mijlocul fix ' +
        'amortizabil se pune în funcțiune". Data punerii în funcțiune nu este înregistrată. Expresia nu ' +
        'este definită nicăieri în legea fiscală — ancorarea în procesul-verbal de dare în folosință este ' +
        'doctrină de practician, nu text. Aplicația nu substituie data facturii, data intrării în ' +
        'patrimoniu sau data plății.',
    };
  }

  // Silence 2 — aport. §10 is contested and the app names both texts instead of choosing.
  if (asset.acquisition === 'aport') {
    return {
      status: 'review_required',
      gap: 'aport_contra_k1',
      reason:
        'Mijlocul fix a intrat în patrimoniul activității ca aport din patrimoniul personal. art. 68 alin. ' +
        '(7) lit. k¹) — sub cuprinsul „Nu sunt cheltuieli deductibile:" — exclude „cheltuielile cu ' +
        'amortizarea bunurilor din patrimoniul personal afectate exercitării activității, potrivit legii", ' +
        'fără nicio excepție pentru bunurile aduse ca aport. În sens contrar, art. 7 pct. 44 lit. c) ' +
        'definește valoarea fiscală a „mijloacelor fixe dobândite cu titlu gratuit ori constituite ca ' +
        'aport … utilizată pentru calculul amortizării fiscale". Normele pct. 7 dau o bază de amortizare ' +
        'pentru bunurile „care trec în patrimoniul altei afaceri", adică doar afacerie→afacerie, și nu ' +
        'acoperă persoana fizică→PFA. Nicio sursă ANAF nu rezolvă conflictul; aplicația refuză și numește ' +
        'ambele texte, în loc să aleagă unul.',
    };
  }

  const belowThreshold = asset.fiscalValue < threshold;
  if (belowThreshold && asset.subThresholdElection === undefined) {
    return {
      status: 'review_required',
      gap: 'optiune_alin_21_lipsa',
      reason:
        `Valoarea fiscală de intrare este sub pragul de 5.000 lei. art. 28 alin. (21) lasă contribuabilul ` +
        'să „poată" recupera cheltuiala prin deduceri de amortizare, iar normele pct. 31 fixează că ' +
        '„opţiunea se efectuează la data intrării imobilizării corporale în patrimoniul contribuabilului" ' +
        'și că cele două căi sunt alternative. Opțiunea nu a fost înregistrată; absența ei nu este nici ' +
        '„am ales amortizarea", nici „am ales deducerea integrală".',
    };
  }

  if (belowThreshold && asset.subThresholdElection === 'intreg_la_punere_in_functiune') {
    // pct. 31's first branch: „la data punerii în funcţiune prin deducerea întregii valori fiscale de la
    // data intrării în patrimoniu". Timed at punerea în funcțiune, not at payment.
    const year = yearOf(asset.putInFunctionDate);
    return {
      status: 'computed',
      years: [
        {
          fiscalYear: year,
          months: 0,
          startMonthInYear: 1,
          uncapped: asset.fiscalValue,
          deductible: asset.fiscalValue,
          lost: lei(0),
          branch: 'valoare_intreaga',
          proRated: false,
        },
      ],
      notes: [
        'art. 28 alin. (21) cu normele pct. 31: opțiunea exercitată la data intrării în patrimoniu, cu ' +
          'efect la data punerii în funcțiune — nu la data plății.',
        'Plafonul de 1.500 lei/lună din art. 28 alin. (14) guvernează „cheltuielile cu amortizarea". ' +
          'Această ramură nu este amortizare, deci plafonul nu o măsoară.',
      ],
    };
  }

  if (!asset.normalLifeMonths || !Number.isInteger(asset.normalLifeMonths) || asset.normalLifeMonths <= 0) {
    return {
      status: 'review_required',
      gap: 'durata_lipsa',
      reason:
        'Normele pct. 27 vorbesc despre „durata normală de funcţionare stabilită de contribuabil potrivit ' +
        'Catalogului", iar Catalogul Cap. I pct. 4 dă o plajă de ani în interiorul căreia alege ' +
        'contribuabilul. Aplicația nu consultă niciun Catalog și nu alege în locul tău; fără durata ' +
        'declarată nu există nici plan de amortizare, nici plafon de scădere din gestiune.',
    };
  }

  if (!asset.method) {
    return {
      status: 'review_required',
      gap: 'durata_lipsa',
      reason:
        'art. 28 alin. (5): metoda aparține contribuabilului — liniară pentru construcții, liniară / ' +
        'degresivă / accelerată pentru echipamente tehnologice și calculatoare, liniară sau degresivă pentru ' +
        'orice alt mijloc fix. Fără metoda declarată nu se poate calcula cota.',
    };
  }

  // Silence 1 — payment against punerea în funcțiune. The app implements the 2026-start reading and
  // labels it; where the facts make the reading matter, it refuses instead of choosing.
  const startYear = yearOf(asset.putInFunctionDate);
  // The calendar year the first depreciation month actually falls in. art. 28 alin. (12) lit. a) counts
  // from the month AFTER punerea în funcțiune, so a Decembrie punere în funcțiune starts in January of the
  // following year — and against that year, not against the punere year, the payment reading is compared.
  const depreciationStartYear = monthOf(asset.putInFunctionDate) >= 12 ? startYear + 1 : startYear;
  const notes: string[] = [
    'art. 28 alin. (12) lit. a): amortizarea începe cu luna următoare punerii în funcțiune. Plata nu este ' +
      'condiția — normele Titlul IV pct. 7 alin. (5) lit. n) fac amortizarea deductibilă fără nicio ' +
      'condiție de plată. Citește contrară: art. 68 alin. (4) lit. b) cere cheltuieli „plătite" în ' +
      'exercițiu. Nicio sursă ANAF nu susține vreo latură — comportarea de aici este o citire a ' +
      'aplicației, nu o regulă citată.',
  ];
  if (asset.paymentState === 'neachitat' || asset.paymentState === 'in_rate') {
    return {
      status: 'review_required',
      gap: 'plata_vs_punere_in_functiune',
      reason:
        'Mijlocul fix este pus în funcțiune dar nu este integral plătit. art. 28 alin. (12) lit. a) cu ' +
        'normele pct. 7 alin. (5) lit. n) spun că amortizarea începe în anul punerii în funcțiune; art. 68 ' +
        'alin. (4) lit. b) spune că sunt deductibile cheltuielile „plătite" în exercițiul financiar. ' +
        'research/36 §4.3 și §11.1 sunt un negativ documentat: nicio normă Titlul IV și nicio prevedere REF ' +
        'nu rezolvă coliziunea. Aplicația aplică citirea anului punerii în funcțiune când faptele nu o fac ' +
        'relevantă; când o fac, refuză și numește ambele.',
    };
  }
  if (asset.paidOn && isIsoDate(asset.paidOn) && yearOf(asset.paidOn) > depreciationStartYear) {
    return {
      status: 'review_required',
      gap: 'plata_vs_punere_in_functiune',
      reason:
        `Punerea în funcțiune este în ${startYear}, plata în ${yearOf(asset.paidOn)}. Care an deductează ` +
        'amortizarea depinde exact de coliziunea pe care research/36 §4.3 o înregistrează ca negativ ' +
        'documentat: art. 28 alin. (12) lit. a) pornește amortizarea la punerea în funcțiune, art. 68 alin. ' +
        '(4) lit. b) cere plata în exercițiu. Aplicația nu alege.',
    };
  }

  const durationYears = asset.normalLifeMonths / 12;
  const coefficient =
    asset.method === 'degresiv' ? degresiveCoefficient(rule, durationYears) : null;
  if (asset.method === 'degresiv' && coefficient === null) {
      return {
        status: 'review_required',
        gap: 'coeficient_degresiv_indefinit',
        reason:
          'art. 28 alin. (7) dă coeficienții 1,5 (durata între 2 și 5 ani), 2,0 (între 6 și 10 ani) și 2,5 ' +
          '(peste 10 ani). Pentru o durată sub 2 ani legea nu prevede niciun coeficient, iar aplicația nu ' +
          'inventează unul.',
      };
  }

  // The amortisation years are calendar years, because art. 28 alin. (12) lit. a) is read in calendar
  // years: the first one carries the months from the month after punerea în funcțiune through Decembrie.
  // A punere în funcțiune in Decembrie therefore starts the schedule in the following January, with the
  // Decembrie year present but empty — an honest zero, not a shifted date.
  const firstMonth = monthOf(asset.putInFunctionDate) + 1;
  const groups: { fiscalYear: number; months: number; startMonthInYear: number }[] = [];
  let monthsLeft = asset.normalLifeMonths;
  let year = startYear;
  let capacity = firstMonth > 12 ? 0 : 12 - firstMonth + 1;
  let startMonthInYear = firstMonth > 12 ? 1 : firstMonth;
  while (monthsLeft > 0) {
    if (capacity <= 0) {
      year += 1;
      capacity = 12;
      startMonthInYear = 1;
      continue;
    }
    const take = Math.min(capacity, monthsLeft);
    groups.push({ fiscalYear: year, months: take, startMonthInYear });
    monthsLeft -= take;
    capacity -= take;
    if (capacity <= 0 && monthsLeft > 0) {
      year += 1;
      capacity = 12;
      startMonthInYear = 1;
    }
  }

  const linearRate = new Decimal(1).div(durationYears);
  const years: DepreciationYear[] = [];
  let remaining = new Decimal(asset.fiscalValue);
  const m1 = asset.isM1Vehicle === true && asset.m1ExceptionCategory === undefined;

  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]!;
    const isLast = i === groups.length - 1;
    let annualDec: Decimal;
    let branch: DepreciationYear['branch'];

    if (isLast) {
      // The last amortisation year takes the whole remainder, so the schedule sums exactly to the fiscal
      // value and leaves no rounding residue. pct. 25's example ends the same way („114.688/5 ani” over the
      // five remaining years). The figure is annualised back to a per-year rate so the art. 28 alin. (14)
      // monthly ceiling still sees a monthly amount rather than a lump.
      annualDec = remaining.times(12).div(group.months);
      branch = asset.method === 'degresiv' && i + 1 > 5 ? 'degresiv_linie_dreapta' : 'liniar';
    } else if (asset.method === 'degresiv') {
      if (i + 1 <= 5) {
        annualDec = remaining.times(new Decimal(coefficient!).times(linearRate));
        branch = 'degresiv_anuali';
      } else {
        // THE CONSTRUCTION, from pct. 25's „114.688/5 ani": from year 6 the method switches to
        // straight-line on the remainder over the years still left. §12.2 records that no norm states this
        // as a formula — it is read off the only worked example in Partea I.
        const yearsLeft = groups.length - i;
        annualDec = remaining.div(yearsLeft);
        branch = 'degresiv_linie_dreapta';
      }
    } else {
      annualDec = new Decimal(asset.fiscalValue).times(linearRate);
      branch = 'liniar';
    }

    // The 1/12 pro-rating — the second construction. art. 28 alin. (12) lit. a) gives the months, not the
    // fraction; taking each month at 1/12 of the annual amount is ours. The last amortisation year is the
    // exception by necessity: it takes whatever is left, so the schedule sums to the fiscal value exactly
    // rather than leaving a rounding residue behind.
    const proRated = group.months < 12;
    const yearDec = annualDec.times(group.months).div(12);
    const monthlyRate = annualDec.div(12);
    remaining = remaining.minus(yearDec);
    const uncappedBani = toBaniNearest(yearDec);

    let deductible = uncappedBani;
    if (m1) {
      const cappedMonthly = monthlyRate.gt(monthlyCap) ? new Decimal(monthlyCap) : monthlyRate;
      deductible = toBaniNearest(cappedMonthly.times(group.months));
    }
    years.push({
      fiscalYear: group.fiscalYear,
      months: group.months,
      startMonthInYear: group.startMonthInYear,
      uncapped: uncappedBani,
      deductible,
      lost: subBani(uncappedBani, deductible),
      branch,
      proRated,
    });
  }

  if (m1) {
    notes.push(
      'art. 28 alin. (14): pentru M1 (maximum 9 scaune inclusiv conducătorul, RNTR 2 / OMMLTL 211/2003) ' +
        'cheltuielile cu amortizarea sunt deductibile, „pentru fiecare", în limita a 1.500 lei/lună. ' +
        'Plafonul este pe vehicul, fără nicio limită de „un singur autoturism" — mai multe M1 se pot ' +
        'amortiza fiecare, în timp ce cheltuielile de folosință sunt limitate la o singură mașină ' +
        '(research/40 §4).',
      'Excesul peste 1.500 lei/lună este pierdut definitiv: nu se reportează și nu se recuperează în anii ' +
        'următori. research/36 §12.13 marchează aceasta ca coroborare secundară, nu ca text citat — curge ' +
        'din faptul că plafonul este o limită de deducere, nu o regulă de temporizare.',
      'Categorii de excepție de la alin. (14) sunt revendicate de contribuabil, nu deduse. Normele nu spun ' +
        'cum se justifică vreuna dintre cele patru (research/36 §12.6: „M1" apare exact o dată în toată ' +
        'Partea I); singura cerință de justificare din normele Titlul IV este foaia de parcurs pentru ' +
        'regula de 50 % a cheltuielilor de folosință, care nu este amortizare.',
    );
  }

  const disposal =
    asset.disposedOn && isIsoDate(asset.disposedOn)
      ? disposalFigure(rule, asset, years)
      : undefined;
  return { status: 'computed', years, notes, disposal };
}

/**
 * Titlul II norm pct. 27, verbatim: „la momentul scăderii din gestiune a mijloacelor de transport din
 * categoria M1, valoarea rămasă neamortizată este deductibilă în limita a 1.500 lei înmulţită cu numărul
 * de luni rămase de amortizat din durata normală de funcţionare **stabilită de contribuabil**".
 *
 * The duration used is the one the taxpayer declared, never a Catalog default — that is the whole point of
 * the provision's wording, and it is why `normalLifeMonths` is a declared fact here.
 */
function disposalFigure(
  rule: FiscalRule,
  asset: FixedAssetFacts,
  years: DepreciationYear[],
): NonNullable<Extract<DepreciationOutcome, { status: 'computed' }>['disposal']> {
  const monthlyCap = paramLei(rule, 'm1_disposal_monthly_cap');
  // Months amortised up to and including the month of the *scoatere din gestiune*, and the amount taken in
  // those months. pct. 27 counts the months **left** of the duration the taxpayer chose, so neither figure
  // may run past the disposal date.
  const disposalYear = yearOf(asset.disposedOn ?? '');
  const disposalMonth = monthOf(asset.disposedOn ?? '');
  let monthsUsed = 0;
  let depreciated = new Decimal(0);
  for (const y of years) {
    if (y.fiscalYear > disposalYear) break;
    if (y.fiscalYear < disposalYear) {
      monthsUsed += y.months;
      depreciated = depreciated.plus(new Decimal(y.uncapped));
      continue;
    }
    const lastMonthTaken = y.startMonthInYear + y.months - 1;
    const taken = Math.max(0, Math.min(lastMonthTaken, disposalMonth) - y.startMonthInYear + 1);
    monthsUsed += taken;
    depreciated = depreciated.plus(new Decimal(y.uncapped).times(taken).div(y.months || 1));
  }
  const unamortised = toBaniNearest(new Decimal(asset.fiscalValue).minus(depreciated));
  const remainingMonths = Math.max(0, (asset.normalLifeMonths ?? 0) - monthsUsed);
  const cap = applyRateDecimal(monthlyCap, remainingMonths * 100).toNumber() as Bani;
  // Titlul IV norm pct. 7 alin. (5) lit. o) caps the same residual a second time, at the proceeds of the
  // disposal. Where the proceeds are recorded the two limits are applied together and the smaller binds;
  // where they are not, the pct. 27 figure is a ceiling and nothing more — `complete` says which.
  const proceeds = asset.disposalProceeds ?? null;
  const binding: Bani = proceeds === null ? cap : proceeds < cap ? proceeds : cap;
  const deductible: Bani = unamortised < binding ? unamortised : binding;
  const bound: 'pct-27' | 'proceeds' | 'none' =
    unamortised <= binding ? 'none' : proceeds !== null && proceeds < cap ? 'proceeds' : 'pct-27';
  return {
    unamortised,
    remainingMonths,
    cap,
    proceeds,
    proceedsCap: proceeds,
    deductible,
    lost: subBani(unamortised, deductible),
    capped: unamortised > binding,
    bound,
    complete: proceeds !== null,
  };
}

// ── B-93: the one year of the schedule that reaches the estimate ─────────────

/**
 * One asset's contribution to one fiscal year, taken from its own schedule.
 *
 * `deductible` is the figure that may be posted, and it is **already the post-ceiling figure**: it is
 * `DepreciationYear.deductible`, the amount that survived art. 28 alin. (14). `uncapped` and `lost` ride
 * beside it so the ceiling is visible rather than implied — a leg posted without `lost` would hide the part
 * of the cost the law refuses, and `research/36` §12.13 records that part as definitively gone.
 */
export interface AssetDepreciationYear {
  assetId: string;
  /** The person's own name for the asset — a refusal that does not name it is a dead end (B-106). */
  label: string;
  fiscalYear: number;
  months: number;
  uncapped: Bani;
  deductible: Bani;
  lost: Bani;
  branch: DepreciationYear['branch'];
}

/** One asset whose schedule refused for this year, with the gap and the schedule's own sentence. */
export interface AssetDepreciationRefusal {
  assetId: string;
  label: string;
  gap: DepreciationGap;
  reason: string;
}

export interface AssetDepreciationForYear {
  fiscalYear: number;
  /** Assets whose schedule produced a figure for this year. */
  posted: AssetDepreciationYear[];
  /** Assets that refused. The refusal is the schedule's, verbatim — nothing is filled in here. */
  refused: AssetDepreciationRefusal[];
  /**
   * B-65 (brief 74) — assets that have left the register, with the Titlul II norm pct. 27 figure beside
   * them. **Computed and reported, never posted.** See `selectAssetDepreciation` in `../estimateBasis.ts`
   * for why the estimate does not take it.
   */
  disposals: AssetDepreciationDisposal[];
}

/**
 * B-65 — one disposed asset and the pct. 27 figure the schedule computed for it.
 *
 * The shape is `DepreciationOutcome['disposal']` plus the identity of the asset, because the schedule
 * already refuses to state a disposal figure without a declared duration (pct. 27 measures the remaining
 * months out of „durata normală de funcţionare stabilită de contribuabil”).
 */
export interface AssetDepreciationDisposal {
  assetId: string;
  label: string;
  unamortised: Bani;
  remainingMonths: number;
  /** 1.500 lei × the remaining months — the Titlul II pct. 27 ceiling itself. */
  cap: Bani;
  /**
   * Titlul IV pct. 7 alin. (5) lit. o) — the proceeds, or `null` when they were never recorded and the
   * second limit therefore cannot be measured.
   */
  proceedsCap: Bani | null;
  /** The declared proceeds, or `null`. */
  proceeds: Bani | null;
  deductible: Bani;
  lost: Bani;
  capped: boolean;
  bound: 'pct-27' | 'proceeds' | 'none';
  /** False while the proceeds are missing — see `DepreciationOutcome['disposal']['complete']`. */
  complete: boolean;
}

/**
 * B-93 — read the register for one fiscal year.
 *
 * This is the seam between the schedule and the estimate. It changes no arithmetic: it calls
 * `depreciationSchedule` per asset and takes the year row for `fiscalYear`. Three things it deliberately
 * does not do:
 *
 * - **It does not fill in a missing fact.** An asset whose schedule refuses lands in `refused` with the
 *   schedule's own `gap` and `reason`. No default life, no default method, no default *punere în funcțiune*.
 * - **It does not lift the ceiling.** The figure it hands out is `deductible`, the post-art. 28 alin. (14)
 *   amount, so a caller cannot post an uncapped schedule by accident.
 * - **It does not read the expense register.** Whether a hand-recorded `depreciation_business_asset`
 *   expense already covers this asset is a question about `Expense` rows, and this module has never read
 *   one. That reconciliation lives in `../estimateBasis.ts`, the layer that owns the expense leg.
 *
 * An asset with no year row for `fiscalYear` is in neither list. That is a fact about the schedule — the
 * asset had not been put in function yet, or had already been fully amortised — not a gap to report.
 */
export function depreciationForFiscalYear(
  rule: FiscalRule,
  assets: readonly (FixedAssetFacts & { id: string })[],
  fiscalYear: number,
): AssetDepreciationForYear {
  const posted: AssetDepreciationYear[] = [];
  const refused: AssetDepreciationRefusal[] = [];
  const disposals: AssetDepreciationDisposal[] = [];
  for (const asset of assets) {
    const outcome = depreciationSchedule(rule, asset);
    if (outcome.status === 'review_required') {
      refused.push({ assetId: asset.id, label: asset.label, gap: outcome.gap, reason: outcome.reason });
      continue;
    }
    // B-65 — the pct. 27 figure is carried out of the schedule even for a year in which the asset produced
    // no amortisation row. Before this it was computed, rendered on `pages/Assets.tsx`, and then dropped
    // here, so the only place a disposal figure existed was a screen the estimate never consulted.
    if (outcome.disposal !== undefined) {
      disposals.push({ assetId: asset.id, label: asset.label, ...outcome.disposal });
    }
    const year = outcome.years.find((y) => y.fiscalYear === fiscalYear);
    if (year === undefined) continue;
    posted.push({
      assetId: asset.id,
      label: asset.label,
      fiscalYear,
      months: year.months,
      uncapped: year.uncapped,
      deductible: year.deductible,
      lost: year.lost,
      branch: year.branch,
    });
  }
  return { fiscalYear, posted, refused, disposals };
}

/**
 * The art. 28 alin. (2) lit. b) classification for one asset: is it a depreciable fixed asset at all?
 *
 * alin. (2) is cumulative — held and used in production, delivery, services, letting to third parties or
 * administration; **a fiscal value at entry equal to or greater than 5.000 lei**; and a normal useful life
 * over one year. Measured at „data intrării în patrimoniul contribuabilului", not at payment (§2.2).
 *
 * Below the threshold the asset is not a depreciable fixed asset unless the taxpayer elects to depreciate
 * it under alin. (21) — and `research/36` §2.7 records that a sub-threshold item which is *not* an
 * amortisable asset is not caught by art. 68 alin. (7) lit. h) either, so its cost is deductible at
 * payment as an „obiect de inventar".
 */
export function classifyAgainstThreshold(
  rule: FiscalRule,
  asset: FixedAssetFacts,
): 'depreciable' | 'below_threshold_elected' | 'below_threshold_not_elected' {
  const threshold = paramLei(rule, 'expensing_threshold');
  if (asset.fiscalValue >= threshold) return 'depreciable';
  return asset.subThresholdElection === 'amortizare'
    ? 'below_threshold_elected'
    : 'below_threshold_not_elected';
}
