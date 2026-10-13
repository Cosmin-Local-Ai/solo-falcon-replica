/**
 * PG-6g (D-VAT-1, B-35 residual) — CF art. 322: which fiscal period a registered person files on.
 *
 * ## Why this is a derivation and not a dropdown
 *
 * Art. 322 does not offer a choice. It states a default, an exception, two registration-year tests, one
 * automatic test for the following year and one event-driven flip. A dropdown labelled „Perioada fiscală"
 * would let the app record an answer to a question the taxpayer is not entitled to answer, which is what
 * the old monthly D300 cadence did. So this module takes the facts the law names and returns either a
 * derived periodicity with the arithmetic shown, or the exact question that is still missing.
 *
 * ## The trap this file exists not to fall into (research/33 §8)
 *
 * **alin. (3) and alin. (4 are not the same test.** They differ in BOTH halves:
 *
 * | | figure | comparator |
 * |---|---|---|
 * | alin. (3) | „cifra de afaceri pe care **preconizează** să o realizeze în perioada rămasă" — a **forecast for the stub** | the cap **recalculat corespunzător numărului de luni rămase** — pro-rated |
 * | alin. (4) | „cifra de afaceri **obținută**, recalculată în baza activității corespunzătoare unui an calendaristic întreg" — an **annualised actual** | the **full** cap, **no pro-rating** |
 *
 * Swapping the comparators is what flips a new PFA between monthly and quarterly, so the two branches are
 * separate functions here and `vatPeriodicity.test.ts` runs the same numbers through both and asserts they
 * come out on opposite sides.
 *
 * ## Who is „întreprindere mică" for alin. (4)
 *
 * art. 266 alin. (1) pct. 16 (as amended by OG 22/2025 art. I pct. 1, MO 806/29.08.2025, in force
 * 01.09.2025): „întreprindere mică reprezintă persoana impozabilă care aplică regimul special de scutire
 * prevăzut la art. 310 …". A PFA that was neplătitoare de TVA sub plafon and then registers is inside it,
 * so **alin. (4) is the branch that fits the likeliest user of this screen** — and which branch applies is
 * itself a fact the app asks, never one it infers from a turnover figure.
 *
 * ## What is deliberately NOT modelled
 *
 * - **Norme pct. 103 alin. (4)-(5)** — the alternative periods (semestrul / anul), requested by *cerere*
 *   until 25 February of the option year under art. 322 alin. (9). Not encoded; see the phase doc.
 * - **Norme pct. 103 alin. (3)** — the exclusion of operations made with no VAT code from „cifrei de
 *   afaceri". research/33 §8 records this as an **unresolved tension** with alin. (4)'s „cifra de afaceri
 *   obținută, recalculată": the norm speaks of the alin. (2) turnover, and whether it also prunes the
 *   alin. (4) figure changes the mid-year answer materially. The app therefore **asks which turnover the
 *   figure covers** rather than silently pruning pre-registration receipts.
 * - **Any rounding of the pro-rated cap.** research/33 §8 records this as a **negative finding**: there is
 *   no rounding rule for the alin. (3) pro-rated cap in the law or in the norms („numărului de luni rămase"
 *   occurs once in the whole CF consolidation, in alin. (3) itself). Where pro-rating produces a fraction
 *   of a ban this module keeps the Decimal and says so; it never rounds into an answer.
 * - **No periodicity is inferred from turnover already in the app.** alin. (2) asks for the *preceding*
 *   calendar year and alin. (3) asks for a *forecast*; the register holds neither. Every figure here is a
 *   declared fact.
 */
import { Decimal } from 'decimal.js-light';
import type { Bani } from '../money';
import { capMoney, capCeilingAtPaymentDate, type CapRateEvidence } from '../fx/capCeiling';
import type { FxRateProvider } from '../fx/provider';
import type { VatRegistration } from './vat';
import { isISOCalendarDate } from '../date';

// ── 1. The periodicity itself ────────────────────────────────────────────────────

export type VatPeriodicity = 'month' | 'quarter';

export const VAT_PERIODICITY_VALUES: readonly VatPeriodicity[] = ['month', 'quarter'];

export function isVatPeriodicity(value: unknown): value is VatPeriodicity {
  return typeof value === 'string' && (VAT_PERIODICITY_VALUES as readonly string[]).includes(value);
}

/**
 * B-101 — a periodicity that changes **inside** the year.
 *
 * Art. 322 alin. (7) does not say the fiscal period is the month for the year. It says the period „devine
 * luna calendaristică **începând cu**" a point the article fixes — the first month of the quarter, the third
 * month of it, or the first month of the NEXT quarter. Before that point the same article describes the
 * person as one „care utilizează trimestrul calendaristic ca perioadă fiscală", so the year carries two
 * regimes and a year-level label is not enough: a bare `month` makes the obligation builder emit monthly
 * deconturi for quarters that were never monthly. That over-reporting is B-101.
 *
 * `fromMonth` is the first month of the year at which `after` applies, inclusive. `13` is a legal value: an
 * exigibility in the third month of the fourth quarter pushes the month into the FOLLOWING year (alin. (7)
 * lit. c)), which leaves that year entirely quarterly.
 *
 * Absent means one regime for the whole year — the ordinary case, and the one every other alineat gives.
 */
export interface PeriodicitySegment {
  before: VatPeriodicity;
  after: VatPeriodicity;
  fromMonth: number;
}

/**
 * Where art. 322 alin. (7) puts the start of the month, for a given month of exigibility.
 *
 * The three litera are arithmetic on the position of the month inside its own quarter:
 * - lit. a) first month of the quarter → the month begins **in that month**;
 * - lit. b) second month → it begins at the **third** month, the first two becoming a distinct period;
 * - lit. c) third month → it begins at the first month of the **next** quarter.
 *
 * `aicFlipForQuarter` in `fiscal/vatReturn.ts` stays the authority for **which periods replace the quarter**;
 * this is the authority for **when the month begins**, which is a derivation fact rather than a calendar
 * fact. Two readings of one litera can drift, so all twelve months are pinned against `aicFlipForQuarter`
 * in `vatReturn.test.ts` — an unlinked pair is how a calendar starts disagreeing with the article it is
 * supposed to implement.
 */
export function alin7MonthStart(monthOfExigibility: number | undefined): number | null {
  if (monthOfExigibility === undefined) return null;
  if (!Number.isInteger(monthOfExigibility) || monthOfExigibility < 1 || monthOfExigibility > 12) return null;
  const offsetInQuarter = (monthOfExigibility - 1) % 3;
  return monthOfExigibility + (offsetInQuarter === 0 ? 0 : 1);
}

/** Which litera of art. 322 alin. (7) an exigibility month falls under; null when there is no month. */
export function alin7Litera(monthOfExigibility: number | undefined): 'a' | 'b' | 'c' | null {
  if (monthOfExigibility === undefined) return null;
  if (!Number.isInteger(monthOfExigibility) || monthOfExigibility < 1 || monthOfExigibility > 12) return null;
  const offsetInQuarter = (monthOfExigibility - 1) % 3;
  return offsetInQuarter === 0 ? 'a' : offsetInQuarter === 1 ? 'b' : 'c';
}

/**
 * The art. 322 / Norme pct. 103 branch that decides, or would decide.
 *
 * `pct103_alin1` is a Norme branch, not an alineat of the code: for a person registered **din oficiu**
 * under art. 316 alin. (10), „perioada fiscală utilizată în anul înregistrării în scopuri de TVA este
 * luna calendaristică" — no estimate is asked for at all.
 */
export type Art322Branch =
  | 'alin1'
  | 'alin2'
  | 'alin3'
  | 'alin4'
  | 'alin5'
  | 'alin7'
  | 'pct103_alin1';

export const ART322_BRANCH_VALUES: readonly Art322Branch[] = [
  'alin1', 'alin2', 'alin3', 'alin4', 'alin5', 'alin7', 'pct103_alin1',
];

/**
 * The plain-Romanian statement of each branch, next to the branch.
 *
 * These are the sentences the screen shows when it asks the taxpayer to confirm (D-VAT-1 point 3: „state
 * the rule in plain words and ask the user to confirm monthly or quarterly, labelled as *their* answer").
 * They live here rather than in `ui/copy` because each one is a paraphrase of a specific alineat and must
 * not be able to drift from the branch it explains — the same reason `TITLUL_II_VAT_ORDERING_RULE` in
 * `fiscal/vat.ts` carries its own text.
 */
export const ART322_RULE_TEXT: Record<Art322Branch, { citation: string; rule: string }> = {
  alin1: {
    citation: 'CF art. 322 alin. (1)',
    rule: 'Perioada fiscală este luna calendaristică. „Luna" este regula generală, nu o opțiune.',
  },
  alin2: {
    citation: 'CF art. 322 alin. (2)',
    rule:
      'Trimestrul se aplică persoanei care în ANUL CALENDARISTIC PRECEDENT a realizat o cifră de afaceri '
      + 'din operațiuni taxabile și/sau scutite cu drept de deducere și/sau neimpozabile în România conform '
      + 'art. 275 și 278, dar care dau drept de deducere conform art. 297 alin. (4) lit. b), care nu a '
      + 'depășit plafonul de 100.000 euro — cu excepția situației în care a efectuat în cursul acelui an '
      + 'precedent una sau mai multe achiziții intracomunitare de BUNURI.',
  },
  alin3: {
    citation: 'CF art. 322 alin. (3)',
    rule:
      'Dacă te-ai înregistrat în cursul anului, declari cu ocazia înregistrării cifra de afaceri pe care '
      + 'PRECONIZEZI să o realizezi în perioada rămasă până la sfârșitul anului. Dacă această estimare nu '
      + 'depășește plafonul de 100.000 euro RECALCULAT corespunzător numărului de luni rămase până la '
      + 'sfârșitul anului, depui deconturi trimestriale în anul înregistrării.',
  },
  alin4: {
    citation: 'CF art. 322 alin. (4)',
    rule:
      'Întreprinderile mici (art. 266 alin. (1) pct. 16 — deci persoanele care aplicau scutirea de la '
      + 'art. 310) care se înregistrează în cursul anului declară cifra de afaceri OBȚINUTĂ, RECALCULATĂ '
      + 'în baza activității corespunzătoare unui an calendaristic întreg. Dacă această cifră depășește '
      + 'plafonul de 100.000 euro — fără nicio recalculare a plafonului — perioada fiscală este luna. '
      + 'Dacă nu-l depășește, perioada este trimestrul, cu excepția achizițiilor intracomunitare de '
      + 'BUNURI efectuate în anul respectiv ÎNAINTE de înregistrare.',
  },
  alin5: {
    citation: 'CF art. 322 alin. (5)',
    rule:
      'Dacă cifra de afaceri EFECTIV obținută în anul înregistrării, recalculată în baza activității '
      + 'corespunzătoare unui an calendaristic întreg, depășește plafonul de 100.000 euro, în ANUL URMĂTOR '
      + 'perioada fiscală devine luna calendaristică. Aceasta se schimbă automat, fără nicio cerere.',
  },
  alin7: {
    citation: 'CF art. 322 alin. (7) și (8)',
    rule:
      'O persoană cu perioadă fiscală trimestrială care efectuează o achiziție intracomunitară de bunuri '
      + 'taxabilă în România trece la luna calendaristică, iar primele două luni ale trimestrului devin o '
      + 'PERIOADĂ FISCALĂ DISTINCTĂ, cu decont propriu conform art. 323 alin. (1). Declarația de mențiuni '
      + 'se depune în maximum 5 zile lucrătoare de la finele lunii în care a intervenit exigibilitatea.',
  },
  pct103_alin1: {
    citation: 'Normele metodologice HG 1/2016, pct. 103 alin. (1)',
    rule:
      'Pentru persoana înregistrată DIN OFICIU conform art. 316 alin. (10), perioada fiscală utilizată în '
      + 'anul înregistrării este luna calendaristică. Nu se cere nicio estimare de cifră de afaceri.',
  },
};

// ── 2. The cap ───────────────────────────────────────────────────────────────────

/**
 * The periodicity cap, in the currency the law states it in.
 *
 * **This is not the registration threshold.** CF art. 310 alin. (1) sets 395.000 LEI for whether a person
 * may apply the exemption at all; art. 322 alin. (2) sets 100.000 EURO for whether the fiscal period is a
 * month or a quarter. research/33 §12 calls conflating them „the most likely way 18B goes wrong". Two
 * numbers, two jobs, two conversion rules.
 */
export const VAT_PERIODICITY_CAP_EUR_MAJOR = 100_000;

/**
 * The lei equivalent, derived — never a literal.
 *
 * Norme pct. 103 alin. (2) fixes the date the rate is taken from: „cursul de schimb comunicat de Banca
 * Națională a României **valabil pentru data de 31 decembrie a anului precedent**, în orice situație".
 * So the anchor for FY2026 is 31.12.2025, and the rate is the one **valabil pentru** that day, not the one
 * **publicat la** it — research/33 §8 flags that distinction as a trap (5,0963 vs 5,0985).
 *
 * **Boundary note (B-60, still open).** `domain/fx/convert.ts` offers exactly three `ConversionBasis`
 * values and none of them is „cursul valabil pentru 31 decembrie a anului precedent"; `domain/fx/*` was
 * off-limits to this phase, so no fourth basis was added. What the app does instead is call the fx layer's
 * daily-rate lookup **anchored to 31 December of the preceding year** — the only lookup in the layer that
 * answers „the rate valid for that date", including carrying back to the last banking day. The *legal*
 * reason for that date is Norme pct. 103 alin. (2), and `basisLabel` below says so explicitly so the
 * mechanism's own citation (art. 9 alin. (3) lit. b)) is never presented as the reason for the cap.
 */
export interface PeriodicityCap {
  year: number;
  /** The ISO date the rate must be valid for — 31 December of the year before `year`. */
  rateDate: string;
  capBani: Bani;
  /** The rate actually used, with its provenance, straight from the fx layer. */
  evidence: CapRateEvidence;
  /** The legal basis for taking the rate from THIS date. Not the fx layer's own basis citation. */
  basisLabel: string;
}

export interface PeriodicityCapFailure {
  ok: false;
  year: number;
  rateDate: string;
  detail: string;
}

export function periodicityCapForYear(
  year: number,
  provider: FxRateProvider,
): PeriodicityCap | PeriodicityCapFailure {
  const rateDate = `${year - 1}-12-31`;
  const attempt = capCeilingAtPaymentDate(
    capMoney('EUR', VAT_PERIODICITY_CAP_EUR_MAJOR),
    rateDate,
    provider,
  );
  if (!attempt.ok) {
    return {
      ok: false,
      year,
      rateDate,
      detail:
        `plafonul de 100.000 euro nu poate fi exprimat în lei pentru anul ${year}: `
        + `${attempt.detail}. Normele pct. 103 alin. (2) cer cursul BNR „valabil pentru data de 31 decembrie `
        + `a anului precedent", adică ${rateDate}; aplicația nu calculează și nu presupune niciun curs.`,
    };
  }
  return {
    year,
    rateDate,
    capBani: attempt.ceiling,
    evidence: attempt.evidence,
    basisLabel:
      'Normele metodologice HG 1/2016, pct. 103 alin. (2) — cursul BNR valabil pentru 31 decembrie a '
      + 'anului precedent. Căutarea prin stratul valutar este doar mecanismul de căutare a acelui curs; '
      + 'temeiul legal al datei este pct. 103 alin. (2), nu art. 9 alin. (3) lit. b) CF.',
  };
}

/**
 * The alin. (3) comparator: the cap **recalculat corespunzător numărului de luni rămase**.
 *
 * Returned as a `Decimal`, not as `Bani`, because there is **no rounding rule** for this figure anywhere
 * in the law or in the norms (research/33 §8, a documented negative). Rounding it would be inventing one.
 * `exact` says whether the pro-rated figure happens to be a whole number of bani; when it is not, the
 * surface must show the fraction and say the rule is silent.
 */
export interface ProRatedCap {
  monthsRemaining: number;
  proRated: Decimal;
  /** True when `proRated` is a whole number of bani, i.e. no rounding decision was needed. */
  exact: boolean;
  note: string;
}

export function proRateCap(capBani: Bani, monthsRemaining: number): ProRatedCap {
  const months = Math.max(0, Math.min(12, Math.trunc(monthsRemaining)));
  const proRated = new Decimal(capBani).mul(months).div(12);
  const exact = proRated.isInteger();
  return {
    monthsRemaining: months,
    proRated,
    exact,
    note: exact
      ? 'Plafonul pro-rata rezultă un număr întreg de bani, deci nu a fost nevoie de nicio rotunjire.'
      : 'Legea și normele nu dau NICIO regulă de rotunjire pentru plafonul pro-rata (art. 322 alin. (3) '
        + '„recalculat corespunzător numărului de luni rămase"; expresia apare o singură dată în tot Codul '
        + 'fiscal). Aplicația afișează fracțiunea și nu o rotunjește.',
  };
}

// ── 3. The declared facts ────────────────────────────────────────────────────────

/** How the registration came about — art. 316 alin. (1) litera, plus the din oficiu case. */
export const VAT_REGISTRATION_ROUTE_VALUES = ['a', 'b', 'c', 'd', 'din_oficiu'] as const;
export type VatRegistrationRoute = (typeof VAT_REGISTRATION_ROUTE_VALUES)[number];

export function isVatRegistrationRoute(value: unknown): value is VatRegistrationRoute {
  return typeof value === 'string' && (VAT_REGISTRATION_ROUTE_VALUES as readonly string[]).includes(value);
}

export const VAT_ROUTE_LABELS: Record<VatRegistrationRoute, { label: string; rule: string }> = {
  a: { label: 'Înainte de operațiuni — declar că voi depăși plafonul (art. 316 alin. (1) lit. a) pct. 1)', rule: 'art. 316 alin. (1) lit. a) pct. 1' },
  b: { label: 'Am depășit plafonul de 395.000 lei în cursul anului (art. 316 alin. (1) lit. b))', rule: 'art. 316 alin. (1) lit. b)' },
  c: { label: 'Optez pentru regimul normal de taxă (art. 316 alin. (1) lit. c))', rule: 'art. 316 alin. (1) lit. c)' },
  d: { label: 'Optez pentru taxarea operațiunilor scutite (art. 316 alin. (1) lit. d))', rule: 'art. 316 alin. (1) lit. d)' },
  din_oficiu: { label: 'Înregistrare din oficiu (art. 316 alin. (10))', rule: 'art. 316 alin. (10); Norme pct. 103 alin. (1)' },
};

/** The three-valued answer the app uses for a fact only the taxpayer holds. `nedeclarat` is absence. */
export const VAT_YES_NO_UNDECLARED_VALUES = ['da', 'nu', 'nedeclarat'] as const;
export type VatYesNoUndeclared = (typeof VAT_YES_NO_UNDECLARED_VALUES)[number];

/**
 * The user's own confirmed periodicity, when the app could not derive one.
 *
 * D-VAT-1 point 3: where the facts do not decide it, the app states the rule in plain words and asks the
 * user to confirm monthly or quarterly, **labelled as their answer, never as the app's conclusion**. That
 * labelling is what this record is: `confirmedBy: 'user'` is the only value it can hold, and the surface
 * renders it as „alegerea dumneavoastră".
 */
export interface VatPeriodicityChoice {
  periodicity: VatPeriodicity;
  /** The branch whose rule text was put in front of the user when they answered. */
  branch: Art322Branch;
  confirmedBy: 'user';
  /** The date the answer was recorded — an answer given in 2026 does not silently decide 2028. */
  confirmedOn: string;
}

/**
 * Everything art. 322 asks for, as declared facts. Every field is optional and **absence is the third
 * state**: no default, no backfill, and an unanswered branch produces a question rather than a figure.
 */
export interface VatPeriodicityFacts {
  /** The calendar year whose fiscal period is being established. */
  year: number;
  /** art. 316 alin. (1^1) — the date the registration produces effects. */
  registrationEffectiveFrom?: string;
  registrationRoute?: VatRegistrationRoute;
  /**
   * The branch selector research/33 §13 says the app must ask rather than infer: was this person in the
   * art. 310 exemption immediately before registering? `da` puts them in alin. (4) (they are an
   * „întreprindere mică" per art. 266 alin. (1) pct. 16); `nu` leaves them in alin. (3).
   */
  inArt310BeforeRegistration?: VatYesNoUndeclared;
  /** alin. (2): the PRECEDING calendar year's turnover from the operations that article names. */
  precedingYearTurnover?: Bani;
  precedingYearAicGoods?: VatYesNoUndeclared;
  /** alin. (3): what the taxpayer FORECASTS for the months remaining to year end. */
  forecastStubTurnover?: Bani;
  /** alin. (4) and (5): the turnover actually obtained, and the months of activity it covers. */
  actualTurnover?: Bani;
  actualActivityMonths?: number;
  /**
   * Whether the declared `actualTurnover` already excludes the operations made before the VAT code.
   * Norme pct. 103 alin. (3) excludes them from „cifrei de afaceri"; research/33 §8 records that whether
   * it also prunes alin. (4)'s „cifra de afaceri obținută, recalculată" is unresolved. The app asks which
   * figure was declared instead of choosing.
   */
  actualTurnoverScope?: 'doar_cu_cod_de_tva' | 'include_ante_inregistrare' | 'nedeclarat';
  /** alin. (4) exception: intra-community acquisitions of GOODS before registration, in that year. */
  aicGoodsBeforeRegistration?: VatYesNoUndeclared;
  /** alin. (7)/(8): a taxable intra-community goods acquisition while the period was a quarter. */
  aicGoodsWhileQuarterly?: VatYesNoUndeclared;
  /**
   * The month (1-12) in which the exigibility of that acquisition intervened. Art. 322 alin. (7) gives
   * three different answers depending on which month of the quarter it lands in — lit. a) monthly from
   * month 1, lit. b) months 1-2 become a distinct fiscal period, lit. c) the quarter is untouched and the
   * month starts next quarter — so a bare `da` cannot generate a calendar. Absent means the flip is not
   * applied and the app says so, rather than picking a letter.
   */
  aicGoodsExigibilityMonth?: number;
  /**
   * art. 322 alin. (6) final sentence: the person has asked to be taken off the VAT register under
   * art. 316 in order to apply the art. 310 exemption. That request is the ONLY exception to the 25
   * January mențiuni duty, and it is an act of the taxpayer, not a fact the register can show.
   */
  art310ReturnRequested?: VatYesNoUndeclared;
  /** The user's confirmed answer, when the app asked. */
  userChoice?: VatPeriodicityChoice;
}

// ── 4. The outcome ───────────────────────────────────────────────────────────────

/** One arithmetic step, shown rather than asserted. */
export interface PeriodicityStep {
  label: string;
  value: string;
}

export interface PeriodicityQuestion {
  id: string;
  /** The article or norm that asks for this fact. */
  rule: string;
  /** The question in Romanian. */
  text: string;
  /** A route or control the surface can send the person to — never a bare string with no target. */
  fixTarget: string;
}

/**
 * What the derivation concluded.
 *
 * There is deliberately **no `not_registered` member.** Whether a person is in the VAT register at all is
 * `PfaProfile.vatRegistration`, decided by art. 310 and art. 316 and already answered there; a second
 * place claiming to know it would be a second answer to one question, and the two could disagree. A
 * variant nothing in this module can construct is a false state, so it is not in the union.
 */
export type VatPeriodicityOutcome =
  | {
      kind: 'derived';
      periodicity: VatPeriodicity;
      branch: Art322Branch;
      cap: PeriodicityCap;
      /** The pro-rated comparator, present only for alin. (3). */
      proRated?: ProRatedCap;
      steps: PeriodicityStep[];
      /** B-101 — present only when the year changes regime inside itself (art. 322 alin. (7)). */
      segment?: PeriodicitySegment;
      /** True when the comparison is a tie-break the law does not settle (the „nu depășește" boundary). */
      boundaryNote?: string;
    }
  | {
      kind: 'user_confirmed';
      periodicity: VatPeriodicity;
      branch: Art322Branch;
      choice: VatPeriodicityChoice;
      cap: PeriodicityCap | null;
      steps: PeriodicityStep[];
      /** B-101 — a confirmed answer is a year-level answer; it carries no point inside the year. */
      segment?: PeriodicitySegment;
    }
  | {
      kind: 'ask';
      /** The branch the app believes applies, or null when even the branch is undeclared. */
      branch: Art322Branch | null;
      cap: PeriodicityCap | null;
      questions: PeriodicityQuestion[];
      /** Why the app stopped, in Romanian. Never „nu poate fi stabilită" on its own. */
      detail: string;
      /**
       * What the person owes **while the question is open**: the statutory default, CF art. 322 alin. (1)
       * „perioada fiscală este luna calendaristică".
       *
       * This is not a guess and it is not the app answering its own question. Art. 322 states a default and
       * then states exceptions to it; the quarter at alin. (2), (3) and (4) has to be **established**, and
       * an unestablished exception leaves the default standing. Recording that is what removes the dead end
       * the brief names — „Nu poate fi stabilită" with no next step — without inventing a cadence: the app
       * says the default is monthly, says which fact would open the exception, and asks for it.
       */
      interim: { periodicity: VatPeriodicity; basis: string };
    };

/**
 * Whole months from the month containing `from` through December of that year.
 *
 * A mid-month start counts that month as whole. That is a **reading**, not a quoted rule: art. 322 alin. (3)
 * says „numărului de luni rămase" and nothing in the norms turns months into days. The reading is recorded
 * on the step list so the person sees it, and it is the reading that is *generous to the quarter* — a
 * larger `monthsRemaining` makes the pro-rated cap larger, which makes a quarterly answer more likely.
 */
export function monthsRemainingToYearEnd(from: string): number | null {
  if (!isISOCalendarDate(from)) return null;
  const month = Number(from.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return 13 - month;
}

/** Annualise an actual figure to „un an calendaristic întreg" — art. 322 alin. (4) and (5). */
function annualise(turnover: Bani, months: number): Decimal | null {
  if (months <= 0) return null;
  return new Decimal(turnover).mul(12).div(months);
}

/**
 * „nu depășește" — the cap is inclusive. Exactly 100.000 euro does not exceed it, so the quarter survives.
 * The same inclusive reading the app already applies to the 395.000-lei plafon (research/42 §11.2).
 */
function exceedsCap(actual: Decimal, cap: Decimal): boolean {
  return actual.greaterThan(cap);
}

/**
 * Derive the fiscal period for one calendar year from the declared facts.
 *
 * The order is the order of the article, not a convenience:
 *   1. no registration fact at all → nothing to derive, and the app says which fact is missing;
 *   2. din oficiu → luna, per Norme pct. 103 alin. (1), with no estimate asked for;
 *   3. registered mid-year → alin. (4) if they came from art. 310, alin. (3) if they did not;
 *   4. registered from 1 January or earlier → alin. (2), the standing annual test;
 *   5. the year AFTER a mid-year registration → alin. (5), automatic;
 *   6. an intra-community goods acquisition while quarterly → alin. (7), which flips to luna and splits
 *      the quarter into two distinct fiscal periods.
 *
 * A user's confirmed answer never overrides a derivation. It is consulted only where the derivation
 * stopped for want of a fact — which is exactly the D-VAT-1 shape: derive where the facts give the answer,
 * ask where they do not.
 */
export function deriveVatPeriodicity(
  facts: VatPeriodicityFacts,
  cap: PeriodicityCap | PeriodicityCapFailure,
): VatPeriodicityOutcome {
  const capOrNull = 'ok' in cap && cap.ok === false ? null : (cap as PeriodicityCap);
  const capFailure = 'ok' in cap && cap.ok === false ? cap : null;
  const outcome = deriveBranch(facts, capOrNull, capFailure);
  // D-VAT-1's second half, applied once so it cannot be forgotten on a branch. Where the article asks for a
  // figure the app does not have and the person has answered instead, the answer stands — as theirs, with
  // the rule they were shown, and never rewritten into a derivation the facts do not support.
  const resolved = outcome.kind === 'ask' && facts.userChoice
    ? confirmedOutcome(facts.userChoice, capOrNull, [
        { label: 'De ce nu a putut fi derivat', value: outcome.detail },
      ])
    : outcome;
  // B-101 — the point at which the month begins is a consequence of the alin. (7) FACTS, not of which branch
  // happened to answer, so it is attached here rather than inside one branch. A person who confirmed
  // „monthly" for an alin. (7) year because the registration facts were missing still declared the month of
  // exigibility, and the calendar has to know where the quarter stopped. A person already monthly on another
  // branch never enters this: the fact that gates it is `aicGoodsWhileQuarterly`, which says in its own name
  // that the period was a quarter when the acquisition happened.
  const start = facts.aicGoodsWhileQuarterly === 'da' ? alin7MonthStart(facts.aicGoodsExigibilityMonth) : null;
  if (
    start !== null
    && resolved.kind !== 'ask'
    && resolved.branch === 'alin7'
    && resolved.periodicity === 'month'
  ) {
    return { ...resolved, segment: { before: 'quarter', after: 'month', fromMonth: start } };
  }
  return resolved;
}

function deriveBranch(
  facts: VatPeriodicityFacts,
  capOrNull: PeriodicityCap | null,
  capFailure: PeriodicityCapFailure | null,
): VatPeriodicityOutcome {
  const effectiveFrom = facts.registrationEffectiveFrom;
  const route = facts.registrationRoute;

  if (!effectiveFrom && !route) {
    return {
      kind: 'ask', interim: ART322_DEFAULT,
      branch: null,
      cap: capOrNull,
      questions: [
        {
          id: 'vat-registration-route',
          rule: 'CF art. 316 alin. (1) și alin. (1^1)',
          text: 'Cum ai ajuns înregistrat(ă) în scopuri de TVA — înainte de operațiuni, pentru că ai depășit plafonul, prin optiune, sau din oficiu?',
          fixTarget: '/settings#!/fiscal',
        },
        {
          id: 'vat-registration-effective-from',
          rule: 'CF art. 316 alin. (1^1)',
          text: 'De la ce dată produce efecte înregistrarea ta în scopuri de TVA?',
          fixTarget: '/settings#!/fiscal',
        },
      ],
      detail:
        'Regimul periodic de TVA nu poate fi stabilit încă: lipsește ruta de înregistrare și data de la '
        + 'care înregistrarea produce efecte. Cu aceste două date se stabilește care alineat din art. 322 '
        + 'se aplică.',
    };
  }

  // 2. din oficiu — Norme pct. 103 alin. (1). No estimate is asked for, and none may be invented.
  if (route === 'din_oficiu') {
    if (capOrNull === null) return askForCap(capFailure);
    return {
      kind: 'derived',
      periodicity: 'month',
      branch: 'pct103_alin1',
      cap: capOrNull,
      steps: [
        { label: 'Înregistrare', value: 'din oficiu, conform art. 316 alin. (10)' },
        { label: 'Norme pct. 103 alin. (1)', value: 'în anul înregistrării perioada fiscală este luna calendaristică' },
      ],
    };
  }

  const midYear =
    effectiveFrom !== undefined &&
    isISOCalendarDate(effectiveFrom) &&
    Number(effectiveFrom.slice(0, 4)) === facts.year &&
    effectiveFrom.slice(5, 10) !== '01-01';

  // 6. alin. (7) — the event-driven flip. It overrides everything above it („Prin excepție de la
  //    prevederile alin. (2) - (6)"), so it is checked before the registration-year branches.
  if (facts.aicGoodsWhileQuarterly === 'da') {
    if (capOrNull === null) return askForCap(capFailure);
    const month = facts.aicGoodsExigibilityMonth;
    const litera = alin7Litera(month);
    const start = alin7MonthStart(month);
    const splitStep =
      litera === 'a'
        ? { label: 'CF art. 322 alin. (7) lit. a)', value: 'luna calendaristică începe în prima lună a trimestrului; nicio perioadă fiscală distinctă' }
        : litera === 'b'
        ? { label: 'CF art. 322 alin. (7) lit. b)', value: 'primele două luni ale trimestrului devin perioadă fiscală distinctă, cu decont propriu' }
        : litera === 'c'
        ? { label: 'CF art. 322 alin. (7) lit. c)', value: 'trimestrul în curs rămâne neatins; luna calendaristică începe cu prima lună a trimestrului următor' }
        : { label: 'CF art. 322 alin. (7)', value: 'luna exigibilității nu este declarată, deci aplicația nu poate alege litera și nu fixează punctul de la care începe luna' };
    // B-101 — the fact the obligation builder walks on. Art. 322 alin. (7) moves the period „începând cu" a
    // month, so everything before that month is still the quarter. Naming only the month is what let the
    // calendar emit twelve deconturi for a year that began on quarters.
    const sinceStep =
      start === null
        ? null
        : start > 12
        ? { label: 'CF art. 322 alin. (7) „începând cu"', value: `luna calendaristică începe abia în ${facts.year + 1}; ${facts.year} rămâne în întregime trimestrial` }
        : { label: 'CF art. 322 alin. (7) „începând cu"', value: `luna calendaristică de la ${String(start).padStart(2, '0')}.${facts.year}; până la acea lună perioada fiscală rămâne trimestrul calendaristic` };
    return {
      kind: 'derived',
      periodicity: 'month',
      branch: 'alin7',
      cap: capOrNull,
      steps: [
        { label: 'Eveniment', value: 'achiziție intracomunitară de bunuri taxabilă în România, fiind trimestrial' },
        splitStep,
        ...(sinceStep ? [sinceStep] : []),
        { label: 'CF art. 322 alin. (8)', value: 'declarație de mențiuni în maximum 5 zile lucrătoare de la finele lunii; luna se folosește în anul curent și în cel următor' },
      ],
    };
  }

  // 5. alin. (5) — the year after a MID-YEAR registration, decided automatically by that year's actuals.
  //
  // The mid-year condition is load-bearing. A person registered from 1 January of the previous year was
  // never in a registration year at all, so alin. (5) has nothing to annualise for them and alin. (2) is
  // the article that decides their current year. Dropping the `!== '01-01'` test here would send every
  // long-standing registrant down the alin. (5) path and ask them for „cifra de afaceri a anului
  // înregistrării" of a year in which they were registered the whole time.
  const registeredInPreviousYear =
    effectiveFrom !== undefined
    && isISOCalendarDate(effectiveFrom)
    && Number(effectiveFrom.slice(0, 4)) === facts.year - 1
    && effectiveFrom.slice(5, 10) !== '01-01';
  if (registeredInPreviousYear) {
    if (capOrNull === null) return askForCap(capFailure);
    const months = monthsRemainingToYearEnd(effectiveFrom);
    if (
      facts.actualTurnover === undefined
      || facts.actualActivityMonths === undefined
      || months === null
    ) {
      return {
        kind: 'ask', interim: ART322_DEFAULT,
        branch: 'alin5',
        cap: capOrNull,
        questions: [
          {
            id: 'vat-actual-turnover-registration-year',
            rule: 'CF art. 322 alin. (5)',
            text: `Care a fost cifra de afaceri efectiv obținută în ${facts.year - 1}, și pentru câte luni de activitate?`,
            fixTarget: '/declarations#!/vat',
          },
        ],
        detail:
          `Anul ${facts.year} se decide singur după anul înregistrării, dar cifra de afaceri efectiv `
          + `obținută în ${facts.year - 1} nu este declarată. Art. 322 alin. (5) nu cere nicio cerere — `
          + 'decizia se ia automat din cifrele anului precedent.',
      };
    }
    const annual = annualise(facts.actualTurnover, facts.actualActivityMonths);
    if (annual === null) return askForCap(capFailure, 'Lunile de activitate declarate sunt zero, deci nu există nicio bază de annualizare.');
    const over = exceedsCap(annual, new Decimal(capOrNull.capBani));
    return {
      kind: 'derived',
      periodicity: over ? 'month' : 'quarter',
      branch: 'alin5',
      cap: capOrNull,
      steps: [
        { label: `Cifră de afaceri efectivă ${facts.year - 1}`, value: `${facts.actualTurnover} bani în ${facts.actualActivityMonths} luni` },
        { label: 'Recalculată la un an întreg (alin. (5))', value: annual.toFixed(2) },
        { label: `Plafonul întreg (fără pro-rata) — ${capOrNull.rateDate}`, value: String(capOrNull.capBani) },
        { label: 'Comparare', value: over ? 'depășește plafonul → luna calendaristică' : 'nu depășește plafonul → trimestrul calendaristic' },
      ],
    };
  }

  if (midYear) {
    // 3. The branch selector itself is a fact, not an inference.
    if (facts.inArt310BeforeRegistration !== 'da' && facts.inArt310BeforeRegistration !== 'nu') {
      return {
        kind: 'ask', interim: ART322_DEFAULT,
        branch: null,
        cap: capOrNull,
        questions: [
          {
            id: 'vat-in-art310-before',
            rule: 'CF art. 266 alin. (1) pct. 16; art. 322 alin. (3) și (4)',
            text: 'Chiar înainte de înregistrare aplicai scutirea de TVA de la art. 310 (plafonul de 395.000 lei)? Răspunsul alege între alin. (3) și alin. (4), iar cei doi alineate compară cifre diferite.',
            fixTarget: '/declarations#!/vat',
          },
        ],
        detail:
          'Te-ai înregistrat în cursul anului, dar aplicația nu știe din ce regim veneai. Art. 322 alin. (3) '
          + 'compară o ESTIMARE pentru lunile rămase cu un plafon PRO-RATA; art. 322 alin. (4) compară o '
          + 'CIFRĂ EFECTIVĂ ANUALIZATĂ cu plafonul ÎNTREG. Aceeași cifră poate duce la răspunsuri opuse, '
          + 'deci aplicația nu alege.',
      };
    }
    return facts.inArt310BeforeRegistration === 'da'
      ? deriveAlin4(facts, capOrNull, capFailure)
      : deriveAlin3(facts, capOrNull, capFailure);
  }

  // 4. alin. (2) — the standing annual test for a person registered from the start of the year.
  if (capOrNull === null) return askForCap(capFailure);
  if (facts.precedingYearAicGoods === 'da') {
    return {
      kind: 'derived',
      periodicity: 'month',
      branch: 'alin2',
      cap: capOrNull,
      steps: [
        { label: `Achiziții intracomunitare de bunuri în ${facts.year - 1}`, value: 'cel puțin una' },
        { label: 'CF art. 322 alin. (2), ultima teză', value: 'excepția elimină trimestrul indiferent de cifră de afaceri' },
      ],
    };
  }
  if (facts.precedingYearTurnover === undefined || facts.precedingYearAicGoods !== 'nu') {
    // The person may answer instead of supplying the figure — D-VAT-1's path. The answer is theirs, and the
    // record says so; it is never rewritten into a derivation.
    if (facts.userChoice) {
      return confirmedOutcome(facts.userChoice, capOrNull, [
        { label: 'De ce nu a putut fi derivat', value: `alin. (2) cere cifra de afaceri din ${facts.year - 1}, pe care registrul curent nu o conține` },
      ]);
    }
    const questions: PeriodicityQuestion[] = [];
    if (facts.precedingYearTurnover === undefined) {
      questions.push({
        id: 'vat-preceding-turnover',
        rule: 'CF art. 322 alin. (2)',
        text: `Care a fost în ${facts.year - 1} cifra de afaceri din operațiuni taxabile și/sau scutite cu drept de deducere și/sau neimpozabile în România conform art. 275 și 278, dar care dau drept de deducere conform art. 297 alin. (4) lit. b)?`,
        fixTarget: '/declarations#!/vat',
      });
    }
    if (facts.precedingYearAicGoods !== 'nu') {
      questions.push({
        id: 'vat-preceding-aic-goods',
        rule: 'CF art. 322 alin. (2), ultima teză',
        text: `Ai efectuat în ${facts.year - 1} una sau mai multe achiziții intracomunitare de BUNURI? Un singur astfel de caz elimină trimestrul.`,
        fixTarget: '/declarations#!/vat',
      });
    }
    return {
      kind: 'ask', interim: ART322_DEFAULT,
      branch: 'alin2',
      cap: capOrNull,
      questions,
      detail:
        `Art. 322 alin. (2) se hotărăște după anul calendaristic PRECEDENT, iar aplicația nu are acea cifră: `
        + 'registrul ei curent nu poate înlocui un an încheiat.',
    };
  }
  const over = exceedsCap(new Decimal(facts.precedingYearTurnover), new Decimal(capOrNull.capBani));
  return {
    kind: 'derived',
    periodicity: over ? 'month' : 'quarter',
    branch: 'alin2',
    cap: capOrNull,
    steps: [
      { label: `Cifră de afaceri ${facts.year - 1} (alin. (2))`, value: String(facts.precedingYearTurnover) },
      { label: `Plafonul 100.000 euro în lei — ${capOrNull.rateDate}`, value: String(capOrNull.capBani) },
      { label: 'Comparare („nu depășește" include pragul)', value: over ? 'depășește → luna calendaristică' : 'nu depășește → trimestrul calendaristic' },
    ],
  };
}

const ART322_DEFAULT: { periodicity: VatPeriodicity; basis: string } = {
  periodicity: 'month',
  basis: 'CF art. 322 alin. (1) — „perioada fiscală este luna calendaristică". Trimestrul este excepția și trebuie stabilit; cât timp excepția nu este stabilită, rămâne regula.',
};

function askForCap(cap: PeriodicityCapFailure | null, extra?: string): VatPeriodicityOutcome {
  return {
    kind: 'ask', interim: ART322_DEFAULT,
    branch: null,
    cap: null,
    questions: [
      {
        id: 'vat-cap-rate',
        rule: 'Normele metodologice HG 1/2016, pct. 103 alin. (2)',
        text: 'Cursul BNR valabil pentru 31 decembrie a anului precedent nu este înregistrat în aplicație. Fără el, plafonul de 100.000 euro nu are echivalent în lei.',
        fixTarget: '/settings#!/fx',
      },
    ],
    detail:
      (cap ? cap.detail : 'Plafonul de 100.000 euro nu a putut fi convertit în lei.')
      + (extra ? ` ${extra}` : ''),
  };
}

/**
 * alin. (3) — a **forecast for the stub period** against the **pro-rated** cap.
 *
 * Note what is NOT here: no annualisation of the forecast. Multiplying a stub forecast by 12/months and
 * comparing it to the full cap is alin. (4)'s arithmetic, and doing it here is the landmine.
 */
function deriveAlin3(
  facts: VatPeriodicityFacts,
  cap: PeriodicityCap | null,
  capFailure: PeriodicityCapFailure | null,
): VatPeriodicityOutcome {
  if (cap === null) return askForCap(capFailure);
  const effectiveFrom = facts.registrationEffectiveFrom;
  if (!effectiveFrom || !isISOCalendarDate(effectiveFrom)) {
    return {
      kind: 'ask', interim: ART322_DEFAULT, branch: 'alin3', cap,
      questions: [{
        id: 'vat-registration-effective-from', rule: 'CF art. 316 alin. (1^1)',
        text: 'De la ce dată produce efecte înregistrarea? Lunile rămase până la sfârșitul anului se numără de acolo.',
        fixTarget: '/settings#!/fiscal',
      }],
      detail: 'Art. 322 alin. (3) pro-rează plafonul după numărul de luni rămase, deci are nevoie de data de la care înregistrarea produce efecte.',
    };
  }
  const months = monthsRemainingToYearEnd(effectiveFrom);
  if (months === null) return askForCap(capFailure, 'Data înregistrării nu este o dată calendaristică ISO validă.');
  if (facts.forecastStubTurnover === undefined) {
    const confirmed = facts.userChoice;
    if (confirmed) return confirmedOutcome(confirmed, cap, [
      { label: 'De ce nu a putut fi derivat', value: 'alin. (3) cere o estimare PE CARE NUMAI CONTRIBUIABILUL O FACE — „preconizează"' },
      { label: 'Plafonul pro-rata', value: proRateCap(cap.capBani, months).proRated.toFixed(2) },
    ]);
    return {
      kind: 'ask', interim: ART322_DEFAULT, branch: 'alin3', cap,
      questions: [{
        id: 'vat-forecast-stub-turnover',
        rule: 'CF art. 322 alin. (3)',
        text: `Ce cifră de afaceri preconizezi să realizezi din ${effectiveFrom.slice(8)}.${effectiveFrom.slice(5, 7)}. până la 31.12.${effectiveFrom.slice(0, 4)}? Se compară cu plafonul pro-rata, NU cu plafonul întreg.`,
        fixTarget: '/declarations#!/vat',
      }],
      detail: ART322_RULE_TEXT.alin3.rule,
    };
  }
  const pro = proRateCap(cap.capBani, months);
  const forecast = new Decimal(facts.forecastStubTurnover);
  const over = exceedsCap(forecast, pro.proRated);
  return {
    kind: 'derived',
    periodicity: over ? 'month' : 'quarter',
    branch: 'alin3',
    cap,
    proRated: pro,
    steps: [
      { label: 'Estimarea pentru perioada rămasă (alin. (3))', value: String(facts.forecastStubTurnover) },
      { label: 'Luni rămase până la sfârșitul anului', value: String(months) },
      { label: 'Plafonul pro-rata (fără rotunjire)', value: pro.proRated.toFixed(2) },
      { label: 'Comparare', value: over ? 'estimarea depășește plafonul pro-rata → luna calendaristică' : 'estimarea nu depășește plafonul pro-rata → trimestrul în anul înregistrării' },
    ],
    ...(pro.exact ? {} : { boundaryNote: pro.note }),
  };
}

/**
 * alin. (4) — an **annualised actual** against the **full** cap.
 *
 * No pro-rating anywhere. The exception that overrides the figure is an intra-community acquisition of
 * GOODS made in that year **before** registration.
 */
function deriveAlin4(
  facts: VatPeriodicityFacts,
  cap: PeriodicityCap | null,
  capFailure: PeriodicityCapFailure | null,
): VatPeriodicityOutcome {
  if (cap === null) return askForCap(capFailure);
  if (facts.aicGoodsBeforeRegistration === 'da') {
    return {
      kind: 'derived',
      periodicity: 'month',
      branch: 'alin4',
      cap,
      steps: [
        { label: 'Achiziții intracomunitare de bunuri înainte de înregistrare', value: 'cel puțin una' },
        { label: 'CF art. 322 alin. (4), ultima teză', value: 'excepția elimină trimestrul indiferent de cifră' },
      ],
    };
  }
  if (
    facts.actualTurnover === undefined
    || facts.actualActivityMonths === undefined
    || facts.actualActivityMonths <= 0
    || facts.actualTurnoverScope === undefined
    || facts.actualTurnoverScope === 'nedeclarat'
    || facts.aicGoodsBeforeRegistration !== 'nu'
  ) {
    const questions: PeriodicityQuestion[] = [];
    if (facts.actualTurnover === undefined || facts.actualActivityMonths === undefined) {
      questions.push({
        id: 'vat-actual-turnover-and-months',
        rule: 'CF art. 322 alin. (4)',
        text: 'Care este cifra de afaceri obținută și pentru câte luni de activitate? Se annualizează la un an întreg și se compară cu plafonul ÎNTREG.',
        fixTarget: '/declarations#!/vat',
      });
    }
    if (facts.actualTurnoverScope === undefined || facts.actualTurnoverScope === 'nedeclarat') {
      questions.push({
        id: 'vat-actual-turnover-scope',
        rule: 'Normele pct. 103 alin. (3); CF art. 322 alin. (4)',
        text: 'Cifra declarată include și operațiunile făcute înainte de a avea cod de TVA? Normele pct. 103 alin. (3) le exclud din „cifrei de afaceri", dar nicio sursă primară nu spune dacă taie și cifra de la alin. (4); aplicația nu alege în locul tău.',
        fixTarget: '/declarations#!/vat',
      });
    }
    if (facts.aicGoodsBeforeRegistration !== 'nu') {
      questions.push({
        id: 'vat-aic-before-registration',
        rule: 'CF art. 322 alin. (4), ultima teză',
        text: 'Ai efectuat achiziții intracomunitare de BUNURI înainte de înregistrarea în scopuri de TVA?',
        fixTarget: '/declarations#!/vat',
      });
    }
    const confirmed = facts.userChoice;
    if (confirmed && questions.length === 0) return confirmedOutcome(confirmed, cap, []);
    return {
      kind: 'ask', interim: ART322_DEFAULT, branch: 'alin4', cap, questions,
      detail: ART322_RULE_TEXT.alin4.rule,
    };
  }
  const confirmed = facts.userChoice;
  const annual = annualise(facts.actualTurnover, facts.actualActivityMonths);
  if (annual === null) return askForCap(capFailure, 'Lunile de activitate declarate nu permit nicio annualizare.');
  const over = exceedsCap(annual, new Decimal(cap.capBani));
  if (confirmed && confirmed.branch === 'alin4') {
    return confirmedOutcome(confirmed, cap, [
      { label: 'Cifră de afaceri obținută', value: `${facts.actualTurnover} bani în ${facts.actualActivityMonths} luni` },
      { label: 'Recalculată la un an întreg', value: annual.toFixed(2) },
    ]);
  }
  return {
    kind: 'derived',
    periodicity: over ? 'month' : 'quarter',
    branch: 'alin4',
    cap,
    steps: [
      { label: 'Cifră de afaceri obținută (alin. (4))', value: `${facts.actualTurnover} bani în ${facts.actualActivityMonths} luni` },
      { label: 'Recalculată la un an calendaristic întreg', value: annual.toFixed(2) },
      { label: `Plafonul ÎNTREG, fără pro-rata — ${cap.rateDate}`, value: String(cap.capBani) },
      { label: 'Comparare', value: over ? 'depășește plafonul → luna calendaristică în anul înregistrării' : 'nu depășește plafonul → trimestrul calendaristic' },
    ],
  };
}

/**
 * PG-6g — the art. 322 derivation for one profile, for one calendar year.
 *
 * The profile stores the facts per year (`PfaProfile.vatPeriodicityYears`); this finds the record for
 * `year` and runs the article over it. **A missing record is not an empty one**: it produces the same
 * `ask` outcome an all-absent record produces, because for art. 322 „the person never answered" and „the
 * person answered nothing" are the same state — there is no figure to compare.
 *
 * The cap is struck here rather than at the call site so the rate and its date travel with the answer on
 * every surface that renders one, and so no surface can show a lei threshold it derived itself.
 */
export function vatPeriodicityForYear(
  years: readonly VatPeriodicityFacts[] | undefined,
  year: number,
  provider: FxRateProvider,
  registration?: VatRegistration | null,
): VatPeriodicityOutcome {
  const cap = periodicityCapForYear(year, provider);
  const facts = (years ?? []).find((y) => y.year === year);
  // The registration date is asked ONCE, by PG-6f's `vatRegistration` field (CF art. 316 alin. (1^1)).
  // Requiring the same date again on the art. 322 record would be a second question with one answer, and a
  // person who had already given it would be told the app does not know it. This copies an already
  // declared fact into the facts the article needs; it infers nothing. The registration ROUTE is not
  // copied, because `VatRegistrationStatus` and the art. 316 litera are different questions —
  // `inregistrat_art316` does not say whether the person came from the art. 310 exemption, and that is
  // exactly the fact that decides alin. (3) versus alin. (4).
  const effectiveFrom = facts?.registrationEffectiveFrom ?? registration?.effectiveFrom;
  return deriveVatPeriodicity(
    { year, ...(facts ?? {}), ...(effectiveFrom ? { registrationEffectiveFrom: effectiveFrom } : {}) },
    cap,
  );
}

function confirmedOutcome(
  choice: VatPeriodicityChoice,
  cap: PeriodicityCap | null,
  steps: PeriodicityStep[],
): VatPeriodicityOutcome {
  return {
    kind: 'user_confirmed',
    periodicity: choice.periodicity,
    branch: choice.branch,
    choice,
    cap,
    steps: [
      ...steps,
      { label: 'De ce nu a derivat aplicația', value: 'alineatul cere o cifră pe care contribuabilul o declară, nu una pe care registrul o poate calcula' },
      { label: 'Cine a răspuns', value: 'contribuabilul — răspunsul este al dumneavoastră, nu o concluzie a aplicației' },
    ],
  };
}
