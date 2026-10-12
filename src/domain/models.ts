import type { Bani } from './money';
// PG-6b — the activity family is the classifier's own vocabulary (`fiscal/deductibility.ts`), and the
// profile stores a value of it. Type-only import: no runtime coupling between the profile model and the
// rule layer, and one declaration of the two families instead of two.
import type { ActivityFamily } from './fiscal/deductibility';

/**
 * PFA/profile domain model — the single source of truth for the PFA profile.
 *
 * The profile owns: profile ID, PFA start year, current tax year, tax regime,
 * main activity (CAEN), salary/pension status, other income flags, social
 * insurance status, VAT/cash thresholds, and the identity/contact data used
 * by the application.
 *
 * Computed tax values (taxable base, CASS, tax due) are NOT stored here —
 * they are derived by the fiscal engine from these inputs.
 */

/**
 * Tax regime recorded on the profile.
 *
 * Phase 6 decision (see `docs/ai/phases/06_fiscal_profile.md` §3): this union is
 * what the app can *read*, not what it can *offer*. Only `impozit_pe_venit` is a
 * regime a PFA can hold and the engine can compute in 2026.
 *
 * - `impozit_pe_venit` — CF art. 123 alin. (1) + art. 118, Titlul IV sistem real.
 *   The only computable regime (see `domain/regimes.ts`).
 * - `impozit_pe_cit` — **not selectable, never offered in the UI.** A PFA cannot be
 *   a Titlul II (impozit pe profit) taxpayer in 2026: CF art. 13 alin. (1), art. 14
 *   and art. 15 each confine Titlul II to persoane juridice, and the option vehicle
 *   (CF art. 120) is Abrogat (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff.
 *   01.01.2025). Kept in the union only so a legacy or foreign payload still parses
 *   and can be refused as a data-integrity failure instead of silently discarded.
 * - `norma_venit` — **boundary only, not selectable, not computable.** The 2026 rule
 *   package contains no norm-of-income rule and the app holds no norm values; the
 *   engine refuses it as REVIEW_REQUIRED. No norm value is invented anywhere.
 */
export type PfaRegime = 'impozit_pe_venit' | 'impozit_pe_cit' | 'norma_venit';
/** Whether the PFA holder has a concurrent salary (impozit pe venit thresholds depend on it). */
export type PfaSalaryStatus = 'da' | 'nu';

/**
 * Whether the PFA holder holds *calitatea de pensionar*.
 *
 * TASK 5 narrowed what this may decide. It is the correct key for exactly two things:
 * - **CAS** — CF art. 150 alin. (1): a pensioner owes no social insurance contribution on
 *   art. 137 alin. (1) lit. b)/b^1) income;
 * - **CASS on pension income** — CF art. 154 alin. (1) lit. h^2), and from 1 ianuarie 2028
 *   art. 220^8 alin. (4).
 *
 * It is NOT the key for CASS on independent-activity income. CF art. 174 alin. (7) lit. c) keys on
 * pension sums *received in the fiscal year* (see `PensionReceiptYear`), and the only status-based
 * extension of alin. (7) is alin. (8), whose list — art. 154 alin. (1) lit. a), b), e), f) — excludes
 * pensioners. See `docs/ai/research/25_pension_cass_exception_2026.md`.
 */
export type PfaPensionStatus = 'da' | 'nu';

/**
 * A recorded yes/no answer. The third state is the ABSENCE of the record, never a stored `nu`:
 * writing `nu` asserts that the fact was checked and found not to hold.
 */
export type PfaYesNo = 'da' | 'nu';

/**
 * The three states a legal fact can be read in: recorded true, recorded false, or not resolvable from
 * what the profile holds. `unknown` is not a soft `nu` — where a rule turns on the fact, the app
 * withholds the conclusion instead of silently picking a side.
 */
export type FactState = 'da' | 'nu' | 'unknown';

/**
 * TASK 5 — CF art. 174 alin. (7) lit. c): the FACT the relief keys on, attributed to one fiscal year.
 *
 * The chapeau reads „în anul fiscal pentru care se depune declarația prevăzută la art. 122, persoana
 * fizică a realizat venituri: … c) venituri din pensii, definite conform art. 99”, and art. 99 alin. (1)
 * defines those as „sume primite ca pensii”. So the test is receipt of at least one pension sum in that
 * year — not *calitatea de pensionar*.
 *
 * There is NO amount qualifier on lit. c). lit. a) and lit. b) each carry „la un nivel cel puțin egal cu
 * 6 salarii minime brute pe țară”; applying one here would be an invented rule (research 25, “What the
 * app must not do” item 4). Quantum belongs to a different computation — the 3.000 lei/month pension
 * CASS line under art. 154 alin. (1) lit. h^2) — and is deliberately not modelled here.
 */
export interface PensionReceiptYear {
  /** The fiscal year the receipt is attributed to: alin. (7) is year-scoped, not a permanent flag. */
  fiscalYear: number;
  /** At least one sum was received as a pension during that year. Any quantum satisfies it. */
  received: PfaYesNo;
}

/**
 * TASK 5 — a recorded pension suspension, stored as a FACT ONLY.
 *
 * Whether a suspended month defeats art. 174 alin. (7) lit. c) is UNVERIFIED: research 25 gap 1 found no
 * Cod fiscal, HG 1/2016 or OPANAF 2.736/2025 provision addressing suspension in connection with art. 174
 * alin. (7). Nothing in this app may derive a legal consequence from these months; they are recorded so
 * that a future verified rule has something to read.
 */
export interface PensionSuspensionYear {
  /** The year the suspension belongs to. */
  fiscalYear: number;
  /** Calendar months (1-12) of that year in which no pension sum was paid. */
  months: number[];
}

/**
 * TASK 5 — the CF art. 174 alin. (8) route to the same relief: alin. (7) also reaches a person who
 * „în anul precedent” was in an art. 154 alin. (1) excepted category, or had opted under art. 180 alin. (1).
 *
 * The category list in alin. (8) lit. a) is art. 154 alin. (1) lit. a), b), e) și f) — a closed list that
 * does NOT include pensioners (those sit in lit. h^2)). This fact can therefore never be inferred from
 * pensioner status, and it is scoped to the PREVIOUS year, not to the income year.
 */
export interface CassPreviousYearContext {
  /** alin. (8) says „în anul precedent”, so a reader only honours this when it is `fiscalYear` − 1. */
  previousFiscalYear: number;
  /** art. 154 alin. (1) lit. a), b), e) sau f). Absent = not recorded. */
  inExceptedCategory?: PfaYesNo;
  /** Opted for CASS under art. 180 alin. (1). Absent = not recorded. */
  optedUnderArt180Alin1?: PfaYesNo;
}

/**
 * TASK 5 — CF art. 153 alin. (2): the one ground in Titlul V that DOES remove CASS taxpayer quality
 * outright — „nu au calitatea de contribuabil la sistemul de asigurări sociale de sănătate”. It is
 * unrelated to pensions and must not be conflated with the art. 174 alin. (7) reliefs, which reach only
 * the art. 174 alin. (6) difference.
 *
 * Both halves are modelled separately because the article requires both: the insurance must exist AND the
 * taxpayer must „facă dovada valabilității asigurării” under a joint ANAF/CNAS procedure. Holding it
 * without proving it does nothing.
 */
export interface ForeignSicknessInsurance {
  /** The year the insurance and its proof are asserted for. */
  fiscalYear: number;
  /** Holds sickness and maternity insurance in another EU/SEE/Confederația Elvețiană or bilateral-agreement state. */
  held?: PfaYesNo;
  /** The validity of that insurance has actually been proved under the joint procedure. */
  proved?: PfaYesNo;
}

/**
 * PG-6h-2 (B-82, B-84) — the number of short-term-let rooms the person **declared** for ONE fiscal year.
 *
 * It is year-attributed for the reason the statute itself gives: CF art. 83 alin. (4) moves the taxpayer
 * into independent activity **„începând cu anul fiscal în care numărul camerelor … este de peste 7”**, so
 * the count is not a permanent attribute and the consequence follows the year. It is stored the way
 * `PensionReceiptYear` and `ForeignSicknessInsurance` are — one record per `fiscalYear`, optional, never
 * defaulted — because a single scalar on the profile would assert one count across every year the app
 * can be asked about.
 *
 * **This is a category switch, not a quantity.** The count decides *which title the income belongs to*
 * (see `AccommodationIncomeTitle`); it never feeds an arithmetic expression anywhere in this app, and no
 * calculator reads it.
 */
export interface AccommodationRoomCountYear {
  /** The fiscal year the count is declared for. art. 83 alin. (4) speaks per fiscal year. */
  fiscalYear: number;
  /** Rooms let pe termen scurt in that year. A count, not an amount, and not a rate. */
  rooms: number;
}

/**
 * The income title the room count places the accommodation receipts in.
 *
 * Two different titles, not two tax rates:
 *
 * - `cedarea_folosintei` — 1–7 rooms inclusive: CF art. 83 alin. (2) puts a „proprietar, uzufructuar sau
 *   alt deținător legal” who lets 1–7 rooms in a personal dwelling under *cedarea folosinței bunurilor*,
 *   and art. 85 alin. (1) confirms that taxpayer as a category of its own.
 * - `activitate_independenta_68x3` — more than 7 rooms: art. 83 alin. (4) turns the same receipts into
 *   a activitate independentă from the fiscal year the count crosses 7, and art. 68^3 alin. (12) is the
 *   route by which that activity is measured on the flat ratio.
 *
 * Getting this wrong does not shift a figure — it moves the income into a different title, under rules
 * that belong to somebody else. `null` (absence of a recorded count) is therefore a real third state and
 * is reported as one; it is never resolved by guessing.
 */
export type AccommodationIncomeTitle = 'cedarea_folosintei' | 'activitate_independenta_68x3';

/**
 * The statutory fiscal boundary in art. 83 alin. (4): „peste 7 camere”.
 *
 * **Do not confuse this number with the 7 in the tourism norms.** Ordin ANT 65/2013 alin. (12), as
 * amended, caps a natural person's right to *request tourism classification* at „7 camere/14 locuri”.
 * That is a classification ceiling in tourism law. This constant is the fiscal boundary in the Codul
 * fiscal, and the two rules have different authors, different purposes and different consequences.
 * `docs/ai/research/39_caen_tourism_and_detection.md` §3 is the source for the distinction.
 *
 * It lives here rather than in the rule store because PG-6h-2 is forbidden from touching anything under
 * `domain/fiscal/`, and because this number is not an arithmetic input: it selects a title.
 */
export const ACCOMMODATION_ROOM_COUNT_BOUNDARY = 7;

/**
 * Which reading of CF art. 68^3 alin. (3) the person chose for their own gross (D-COM-1, B-80).
 *
 * alin. (3) excludes from gross „comisionul reținut de către entitățile care facilitează închirierea pe
 * termen scurt a camerelor situate în locuințe proprietate personală”, but the words are limited to
 * personal dwellings while alin. (1) puts the article's subject with a tourism-sector operator. No
 * primary source reconciles them (`docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3), and the
 * choice moves gross, therefore tax, the CASS base and the CAS threshold.
 *
 * **This is a choice the person makes, recorded as their choice — not a finding the app reached.** The
 * two ids are the labels the rule itself uses in `ACCOMMODATION_68X3_2026.gross_scope_open_question`
 * („Citește A”, „Citește B”), so the stored answer, the rule text and the screen all name the same
 * reading. There is no default anywhere: absence means the question has not been answered, and the
 * gross stays undetermined.
 */
export type AccommodationCommissionReading = 'reading_a' | 'reading_b';

/**
 * The person's own answer to the CF art. 68^3 alin. (1) gate: whether they are „operatorii economici
 * definiți potrivit legislației specifice domeniului turismului”.
 *
 * That classification is made in tourism law (OG 58/1998 as amended, Ordin 65/2013 as amended, the ONRC
 * authorisation), not in the Codul fiscal, and `docs/ai/research/39_caen_tourism_and_detection.md` §3
 * records that no official mapping from a tourism structure type to a CAEN code exists. **The app asks;
 * it does not decide, and it cannot verify.** The value is the person's statement, and absence is the
 * honest third state.
 */
export type AccommodationTourismEligibility = PfaYesNo;

/** The room count declared for one fiscal year, or `undefined` when that year was never answered. */
export function accommodationRoomCountForYear(
  years: readonly AccommodationRoomCountYear[] | undefined,
  fiscalYear: number,
): number | undefined {
  return years?.find((y) => y.fiscalYear === fiscalYear)?.rooms;
}

/**
 * The title the recorded room count puts this year's accommodation receipts in.
 *
 * `null` means the count is not recorded for that year, and the app therefore does not know which title
 * applies. It is not a default in either direction: a caller that receives `null` must not read it as
 * `cedarea_folosintei` (that would apply art. 85 to a taxpayer art. 83 alin. (4) has already moved) nor
 * as `activitate_independenta_68x3` (that would apply art. 68^3 to a taxpayer art. 83 alin. (2) puts
 * somewhere else). This is the only place the boundary is compared; nothing else may re-derive it.
 */
export function accommodationIncomeTitleForYear(
  years: readonly AccommodationRoomCountYear[] | undefined,
  fiscalYear: number,
): AccommodationIncomeTitle | null {
  const rooms = accommodationRoomCountForYear(years, fiscalYear);
  // Absence is the only "no title" answer. A stored count is an integer by the time it reaches here —
  // `domain/schema.ts` requires `z.number().int()` — so there is no third shape to defend against, and
  // a numeric guard here would imply the schema lets one through.
  if (rooms === undefined) return null;
  return rooms > ACCOMMODATION_ROOM_COUNT_BOUNDARY
    ? 'activitate_independenta_68x3'
    : 'cedarea_folosintei';
}

/**
 * Replace or remove ONE year's room count without disturbing the other years.
 *
 * The Settings form edits the year it is showing; a plain `[{ fiscalYear, rooms }]` would silently drop
 * every other year the profile holds, and `undefined` for the edited year must remove that entry rather
 * than leave a stale count behind. `rooms === undefined` is therefore "this year is unanswered again".
 */
export function withAccommodationRoomCount(
  years: readonly AccommodationRoomCountYear[] | undefined,
  fiscalYear: number,
  rooms: number | undefined,
): AccommodationRoomCountYear[] | undefined {
  const others = (years ?? []).filter((y) => y.fiscalYear !== fiscalYear);
  if (rooms === undefined) return others.length > 0 ? others : undefined;
  return [...others, { fiscalYear, rooms }];
}

/**
 * One CAEN class this app treats as "accommodation-shaped enough to be worth asking about".
 *
 * **This list is the app's own normative choice, not a rule of Romanian law.** HG 656/1997 art. 4 alin.
 * (1) says classification into a CAEN entity „nu presupune crearea de drepturi sau obligații”, and alin.
 * (2) puts the responsibility for using CAEN in public administration squarely on the institution doing
 * it, „care emit norme specifice de încadrare”. `docs/ai/research/39_caen_tourism_and_detection.md` §3
 * records the finding behind this comment: **no official mapping from „tip de structură de primire
 * turistică” to CAEN codes exists in any source retrieved.** So any such list is ours, and it is written
 * down here rather than implied by a `startsWith('55')` somewhere.
 *
 * It is CAEN **Rev. 3** (Ordinul președintelui INS nr. 377/2024, MO I 385/25.04.2024, in force
 * 01.01.2025), whose Division 55 has **five** classes. A list copied from a Rev. 2 source has four and is
 * silently wrong. Two of the five are annotated because each is a false positive if read naively:
 *
 * - **5540 is intermediation, not accommodation** — it is the new booking-platform class, a Division 55
 *   code with no bed.
 * - **5590 is not necessarily tourism** — it covers lets shorter than a year (student and worker
 *   accommodation), i.e. a residential let that can sit next to long-term rental.
 *
 * **What this list may and may not do.** It may *prompt a question*. It may never *answer* one, and it may
 * never be the only trigger: the primary trigger is the declared `activityFamily`, because a natural
 * person letting 1–7 rooms has no registered business activity and therefore no CAEN code at all
 * (D-COM-2, B-83; `research/39` §1). No code in this repository may derive `activityFamily`, a room
 * count, an eligibility answer or a commission reading from these codes.
 */
export interface TourismCaenClass {
  cod: string;
  /** The Rev. 3 official title, as recorded in `research/39` §2. */
  title: string;
  /** Why this class is not a straightforward accommodation signal, when it is not. */
  caveat: string | null;
}

export const TOURISM_CAEN_CLASSES: readonly TourismCaenClass[] = [
  { cod: '5510', title: 'Hoteluri și alte facilități de cazare similare', caveat: null },
  {
    cod: '5520',
    title: 'Facilități de cazare pentru vacanțe și perioade de scurtă durată',
    caveat: 'Definită prin ABSENȚA serviciilor de tip hotel; este clasa pensiunii, B&B și a camerei gazduite de o familie.',
  },
  { cod: '5530', title: 'Parcuri pentru rulote, campinguri și tabere', caveat: null },
  {
    cod: '5540',
    title: 'Intermedieri pentru servicii de cazare',
    caveat: 'NU este cazare: este intermediere (clasă nouă în Rev. 3). Un cod din Divizia 55 fără pat.',
  },
  {
    cod: '5590',
    title: 'Alte servicii de cazare',
    caveat: 'Nu este neapărat turism: acoperă închirieri sub un an (cazare pentru studieri și lucrători).',
  },
];

/**
 * Whether the profile carries a CAEN class from `TOURISM_CAEN_CLASSES`.
 *
 * Read as a prompt only. An empty or absent CAEN list is the normal case for the likeliest affected user
 * — the private landlord with 1–7 rooms, who is not in the trade-registry chain at all — and returns
 * `false` without implying anything about what that person does.
 */
export function profileHasTourismCaen(identity: PfaIdentity | undefined): boolean {
  const codes = identity?.caen ?? [];
  const listed = new Set(TOURISM_CAEN_CLASSES.map((c) => c.cod));
  return codes.some((c) => listed.has(c.cod));
}

/**
 * PG-6d (D-OTH-1, B-41) — the six categories of CF art. 155 alin. (1) lit. c)-h) whose incomes cumulate
 * into ONE CASS base under art. 170 alin. (2)-(4).
 *
 * **These are the law's letters, not the app's labels.** `docs/ai/research/41_other_income_flags_and_cass_ladder.md`
 * §5 is the finding that forced this list: the five flags this app used to carry (`imobiliare`,
 * `autovehicule`, `dividende`, `concesiune`, `alte`) are NOT these categories. They omitted three of the
 * six — lit. c) proprietate intelectuală, lit. d) asocierea cu o persoană juridică, lit. f) agricole —
 * and a ladder that sums across all six cannot be computed honestly from three inputs. `concesiune` has
 * **no referent at all** in the Cod fiscal (a whole-code search returns zero matches for „venituri din
 * concesiune”), and `alte` as a free-form catch-all is wider than art. 114: art. 61 lit. g) *premii și
 * jocuri de noroc* and lit. h) *transferul proprietăților imobiliare* never appear in art. 155 alin. (1)
 * and never attract CASS, so a free-form „other” can manufacture a liability. Both are retired under
 * D-OTH-2 and D-LEG-1, not deprecated.
 *
 * The letters are named in the law's own order so a reader can put each one against its litera.
 */
export type CassLadderCategory =
  /** lit. c) venituri din drepturi de proprietate intelectuale, definite conform art. 70. */
  | 'proprietate_intelectuala'
  /** lit. d) venituri din asocierea cu o persoană juridică, art. 125. */
  | 'asociere_persoana_juridica'
  /** lit. e) venituri din cedarea folosinței bunurilor, definite conform art. 83. */
  | 'cedarea_folosintei_bunurilor'
  /** lit. f) venituri din activități agricole, silvicultură și piscicultură, definite conform art. 103. */
  | 'activitati_agricole'
  /** lit. g) venituri din investiții, definite conform art. 91 — dividends reach CASS only through here. */
  | 'investitii'
  /** lit. h) venituri din alte surse, definite conform art. 114. */
  | 'alte_surse';

/** The six categories, in the order art. 155 alin. (1) lists them and DU 212 subsecțiunea 2.2 numbers them. */
export const CASS_LADDER_CATEGORIES: readonly CassLadderCategory[] = [
  'proprietate_intelectuala',
  'asociere_persoana_juridica',
  'cedarea_folosintei_bunurilor',
  'activitati_agricole',
  'investitii',
  'alte_surse',
];

/**
 * What each ladder category is called **on screen**, keyed by the same identifier the engine sums.
 *
 * The refusal in `calcCassLadder` has to name the categories that are missing, and an identifier printed on
 * a screen is an enum value posing as a sentence — the rule TASK 7 wrote the copy guard for. The names live
 * here rather than in the copy layer because the refusing string is itself domain output: one list, so the
 * engine's refusal and the form's labels cannot drift into two vocabularies.
 */
export const CASS_LADDER_CATEGORY_NAMES: Record<CassLadderCategory, string> = {
  proprietate_intelectuala: 'proprietate intelectuală (art. 155 alin. (1) lit. c))',
  asociere_persoana_juridica: 'asocierea cu o persoană juridică (lit. d))',
  cedarea_folosintei_bunurilor: 'cedarea folosinței bunurilor (lit. e))',
  activitati_agricole: 'activități agricole, silvicultură și piscicultură (lit. f))',
  investitii: 'investiții (lit. g))',
  alte_surse: 'alte surse (lit. h))',
};

/**
 * PG-6d (D-OTH-1) — the amounts the person **declared** for ONE fiscal year, one per ladder category.
 *
 * This is the shape DU 212 subsecțiunea 2.2 has: six per-category lines feeding one cumulated total
 * feeding one base. It is one record per fiscal year, optional and never defaulted, for the reason every
 * other per-year fact on this profile gives — `PensionReceiptYear`, `AccommodationRoomCountYear`,
 * `VehicleYearFacts` — a ladder rung is chosen per year, and a scalar on the profile would assert one
 * answer across every year the app can be asked about.
 *
 * **Each field holds the amount art. 170 alin. (4) actually measures, not gross receipts.** That article
 * measures per category, by that category's own rule: net for lit. c), d), e) and g); **venitul brut**
 * for lit. h) and for lit. h) only; dividends as „dividendele plătite, diminuate cu impozitul reținut”;
 * agricultural as „venitul net **sau** norma de venit, după caz” — the normă survives only there, having
 * been deleted for rentals from 2026 by Legea 239/2025 art. XII pct. 19. Applying one measurement to all
 * six is the easy wrong answer, which is why each field says which figure belongs in it.
 *
 * **Absence is not zero.** A field that is absent was never answered, and art. 170 alin. (4) sums across
 * **all** of lit. c)-h): with one category unanswered the sum is unknown, so the ladder must refuse.
 * Zero is a *declared* amount and is stored as `lei(0)`, which is a different fact and is honoured. That
 * distinction is defect B-41 — defaulting a category manufactures or erases a liability depending on the
 * rung the missing amount would have moved the person to.
 */
export const CASS_AGRI_BAZA_VALUES = ['venit_net', 'norma_de_venit'] as const;
export type CassAgriBaza = (typeof CASS_AGRI_BAZA_VALUES)[number];
export const CASS_INVEST_BAZA_VALUES = [
  'castig_net',
  'dividende_platite_diminuate_cu_impozitul_retinut',
] as const;
export type CassInvestBaza = (typeof CASS_INVEST_BAZA_VALUES)[number];
export const CASS_CEDARE_SURSA_VALUES = ['activitate_proprie_a_pfa', 'patrimoniu_personal'] as const;
export type CassCedareSursa = (typeof CASS_CEDARE_SURSA_VALUES)[number];

export interface CassLadderYear {
  /** The fiscal year these amounts were realised in — art. 170 alin. (2) speaks of „anul fiscal”. */
  fiscalYear: number;
  /** lit. c) venitul net after the art. 72 / 72¹ forfetar, or net per art. 73. */
  proprietateIntelectuala?: Bani;
  /** lit. d) venitul net distribuit din asocieri cu persoane juridice — art. 125 alin. (8)-(9). */
  asocierePersoanaJuridica?: Bani;
  /**
   * lit. e) venitul net din cedarea folosinței bunurilor — brut minus cheltuiala forfetară de 20 %
   * (art. 84 alin. (3)), or 30 % for the short-term 1–7 rooms of art. 85 alin. (2). **No normă de venit
   * for rentals from 2026**: the words „sau norma de venit, după caz” were deleted by Legea 239/2025
   * art. XII pct. 19.
   */
  cedareaFolosinteiBunurilor?: Bani;
  /**
   * lit. e) — the fact that decides whether letting income is lit. e) at all (D-OTH-2).
   *
   * art. 83 alin. (1) expressly excludes income from an independent activity, so receipts from letting a
   * good **from personal patrimony** are lit. e) and join the ladder, while letting that *is* the PFA's
   * own activity is art. 67 alin. (1) income — lit. b), which never joins the ladder. The app asks; it
   * does not read a CAEN code, and it does not store `concesiune` as a category, because that word has no
   * referent in the Cod fiscal and the contract type does not decide the letter either.
   */
  cedareaSursa?: CassCedareSursa;
  /** lit. f) venitul net **sau** norma de venit, după caz — art. 104-106. The normă survives only here. */
  activitatiAgricole?: Bani;
  /** Which of the two art. 170 alin. (4) lit. e) measurements the declared agricol figure is. */
  activitatiAgricoleBaza?: CassAgriBaza;
  /**
   * lit. g) venitul și/sau câștigul/câștigul net per art. 94-97. For dividends this is **not** the gross
   * distribution: art. 170 alin. (4) lit. d) takes „dividendele plătite, diminuate cu impozitul reținut”.
   */
  investitii?: Bani;
  /** Which of the two art. 94-97 measurements the declared investitii figure is. */
  investitiiBaza?: CassInvestBaza;
  /**
   * lit. h) **venitul brut**, câștigul și/sau venitul impozabil din alte surse, stabilit potrivit
   * art. 114-116. Gross — and gross only for this category.
   */
  alteSurse?: Bani;
  /**
   * D-OTH-2 — is the declared „alte surse” amount income defined at art. 114? Required before the amount
   * is cumulated. A free-form other can sweep in art. 61 lit. g) *premii și jocuri de noroc* or lit. h)
   * *transferul proprietăților imobiliare*, neither of which appears in art. 155 alin. (1) and neither of
   * which ever attracts CASS, so an unqualified „other” manufactures a liability.
   */
  alteSurseArt114?: PfaYesNo;
  /**
   * CF art. 170 alin. (5): „La încadrarea în plafonul prevăzut la alin. (4) nu se iau în calcul
   * veniturile neimpozabile, prevăzute la art. 93 și 105.” Stored so the app can *see* the amount it must
   * not add, and so the two readings of art. 174 alin. (7) lit. b) can be told apart — see
   * `calcCassLadder`.
   */
  neimpozabil?: Bani;
  /**
   * CF art. 174¹ alin. (3)-(6): CASS already reținută la sursă on these same incomes. It is a **credit**
   * against the contribution due (DU 212 subsecțiunea 2.2 rd. 6), not a second charge. This app does not
   * model the credit, so a recorded amount makes the ladder refuse rather than double-charge.
   */
  cassRetinutLaSursa?: Bani;
}

/** The ladder amounts declared for one fiscal year, or `undefined` when that year was never answered. */
export function cassLadderForYear(
  years: readonly CassLadderYear[] | undefined,
  fiscalYear: number,
): CassLadderYear | undefined {
  return years?.find((y) => y.fiscalYear === fiscalYear);
}

/**
 * Which of the six ladder categories this year has NOT answered.
 *
 * The ladder sums across all six (art. 170 alin. (4)), so a partial answer set is not a smaller sum — it
 * is an unknown sum. This function is what lets the refusal name the missing litera instead of defaulting
 * them, and it is deliberately a list rather than a boolean: „three of six missing” and „one of six
 * missing” need different fixes.
 *
 * A category counts as answered only when an amount is stored. `lei(0)` answers it — a declared zero is a
 * fact; absence is not.
 */
export function cassLadderMissingCategories(
  year: CassLadderYear | undefined,
): CassLadderCategory[] {
  if (!year) return [...CASS_LADDER_CATEGORIES];
  return CASS_LADDER_CATEGORIES.filter((c) => ladderAmountFor(year, c) === undefined);
}

/** The declared amount for one ladder category, or `undefined` when that category was never answered. */
export function ladderAmountFor(year: CassLadderYear | undefined, category: CassLadderCategory): Bani | undefined {
  if (!year) return undefined;
  switch (category) {
    case 'proprietate_intelectuala':
      return year.proprietateIntelectuala;
    case 'asociere_persoana_juridica':
      return year.asocierePersoanaJuridica;
    case 'cedarea_folosintei_bunurilor':
      return year.cedareaFolosinteiBunurilor;
    case 'activitati_agricole':
      return year.activitatiAgricole;
    case 'investitii':
      return year.investitii;
    case 'alte_surse':
      return year.alteSurse;
  }
}

/**
 * Replace or remove ONE year's ladder amounts without disturbing the other years — the same discipline as
 * `withAccommodationRoomCount`. `amounts === undefined` makes that year unanswered again; it does not
 * write six zeros, because six zeros is a declaration that the person had no income in any category.
 */
export function withCassLadderYear(
  years: readonly CassLadderYear[] | undefined,
  year: CassLadderYear | undefined,
): CassLadderYear[] | undefined {
  const others = (years ?? []).filter((y) => y.fiscalYear !== year?.fiscalYear);
  if (year === undefined) return others.length > 0 ? others : undefined;
  return [...others, year];
}

/**
 * CASS status for the profile. The three stored strings are PERSISTED DATA — renaming a value would
 * be a data migration this brief does not authorise, so only the vocabulary AROUND them changes (B-19).
 *
 * `exempt` is the app's flag for the CF art. 154 alin. (1) categories „exceptate de la plata
 * contribuției de asigurări sociale de sănătate" — a CLOSED list, and none of its live letters
 * covers a persoană fizică cu activitate independentă. A CASS zero that comes from this flag is
 * therefore marked `reviewRequired` by the engine and never presented as an established exemption.
 * Titlul V says „exceptat" for that status and „nu se datorează" for a conditional non-due (art.
 * 174 alin. (7) reaches only the art. 174 alin. (6) difference); the words „scutit"/„scutire" occur
 * nowhere in Titlul V, so they must not label a CASS result anywhere in this app.
 */
export type PfaSocialInsuranceStatus = 'obligatoriu' | 'exempt' | 'neplata';

/**
 * One CAEN classification code with its description.
 *
 * Phase 7 (D-1) makes this the single CAEN model. It replaces the two older
 * shapes: `PfaProfile.caen: string` (code only, no description) and
 * `SettingsState.company.caen: CompanyCaen[]` (a duplicate store no UI wrote).
 * The domain owns the type so `data/types.ts` does not become a source of
 * domain models.
 */
export interface CaenCode {
  /** CAEN code, e.g. '6201'. */
  cod: string;
  /** Human-readable classification, e.g. 'Activități de programare computerizate'. */
  descriere: string;
}

/**
 * Identity/contact data owned by the profile.
 *
 * Phase 7 (D-1) makes this the ONE canonical identity store: the fields that
 * previously lived only in `SettingsState.company` / `SettingsState.personal`
 * are absorbed here, and those settings blocks retire from the UI and from all
 * writes while staying parseable (frozen legacy data, read only by the
 * migration chain).
 *
 * The Phase 7 additions are OPTIONAL on purpose. `pfaIdentitySchema` gates the
 * live profile *and* the embedded profile of every stored calculation snapshot
 * (`data/schema.ts` `taxCalculationSnapshotSchema.inputSnapshot.profile`), so a
 * REQUIRED new identity field would invalidate every payload written before
 * Phase 7 — see the data-loss note on `pfaProfileSchema` and
 * `docs/ai/phases/07_identity.md`.
 */
export interface PfaIdentity {
  // personal
  nume: string;
  cnp: string;
  adresa: string;
  telefon: string;
  email: string;
  // company
  denumire: string;
  cui: string;
  formaJuridica: string;
  numarRegComert: string;
  adresaSocietate: string;
  telefonSocietate: string;
  emailSocietate: string;
  contBancar: string;
  banca: string;
  /**
   * VAT registration code in intra-community trade (cod TVA intracomunitar).
   * Absorbed from `settings.company.codTvaIntra` by migration step v0→v1.
   */
  codTvaIntra?: string;
  /**
   * Activity classifications (CAEN). Absorbed from `settings.company.caen` by
   * migration step v0→v1, which also folds the old `PfaProfile.caen` string in.
   * The engine reads CAEN nowhere today — no CAEN-keyed rule is citable, so this
   * is descriptive data, not a fiscal input (and it is deliberately NOT part of
   * `inputsKey`, see `docs/ai/phases/07_identity.md`).
   */
  caen?: CaenCode[];
  /** Free text printed on invoices (menițiuni pe factură). Absorbed from `settings.company.mentiuniFactura`. */
  mentiuniFactura?: string;
}

/**
 * The PFA profile. Persisted as the `profile` collection of AppData behind
 * the existing load/save cycle on the localStorage key `pfa-app-data-v2`.
 */
export interface PfaProfile {
  /** Stable profile ID. */
  id: string;
  /** Year the PFA activity started. */
  pfaStartYear: number;
  /**
   * Exact PFA start date (ISO `YYYY-MM-DD`), optional so payloads written before
   * Phase 6 keep validating. Read by the engine only to surface CF art. 118 alin.
   * (3) — „Veniturile din categoriile prevăzute la art. 61 lit. a) … ce se realizează
   * într-o fracțiune de an … se consideră venit anual.” Deadline/date semantics
   * remain Phase 9.
   */
  pfaStartDate?: string;
  /** Current tax year the profile is active for (Romanian fiscal year = calendar year). */
  fiscalYear: number;
  /** Tax regime. */
  regime: PfaRegime;
  /**
   * @deprecated Phase 7 (D-1): the CAEN model is `identity.caen: CaenCode[]`.
   * This field is kept OPTIONAL so payloads written before Phase 7 keep
   * validating (a required-or-removed field would invalidate every stored
   * snapshot's embedded profile too); migration step v0→v1 folds its value into
   * `identity.caen`. No application code reads or writes it any more — the only
   * remaining readers are the migration and its tests.
   */
  caen?: string;
  /** Concurrent salary status. */
  salaryStatus: PfaSalaryStatus;
  /**
   * Salary and assimilated income actually realised in `fiscalYear`, in lei (CF art.
   * 155 alin. (1) lit. a) / art. 76). Optional so payloads written before Phase 6 keep
   * validating — see the data-loss note in `docs/ai/phases/06_fiscal_profile.md` §2.
   *
   * This is the input CF art. 174 alin. (7) lit. a) needs: the art. 174 alin. (6)
   * top-up to 6 SM „nu se datorează” when salary income in that fiscal year is „cel
   * puțin egal cu 6 salarii minime brute”. Without it the CASS branch for a salaried
   * PFA cannot be decided and `calcCass` returns REVIEW_REQUIRED.
   *
   * CASS ONLY. It must never reach `calcCas`: CF art. 150 alin. (2) exempts salary
   * earners only for art. 137 alin. (1) lit. b^1), not lit. b).
   */
  /**
   * Salary income for the fiscal year, **integer bani** (Phase 10).
   *
   * The key keeps the historical `…Lei` suffix. Renaming a persisted key is not a type change: `safeParse`
   * runs before the migration chain and zod strips unknown keys, so a schema requiring a new key would
   * reject every v4 payload and quarantine it rather than convert it. The key is carried unchanged through
   * v4→v5 and only the unit changes; the `Bani` brand is what stops the stale name being exploited, and the
   * hazard is recorded in `docs/ai/phases/10_money_precision.md`.
   */
  salaryIncomeLei?: Bani;
  /**
   * @deprecated TASK 5: renamed to `pensionerStatus`. The old name is what let one boolean answer three
   * different legal questions at once (CAS art. 150 alin. (1), the CASS art. 174 alin. (7) lit. c) relief,
   * and pension-income CASS) — the defect that task removes.
   *
   * Kept OPTIONAL rather than deleted for the reason Phase 7 kept `caen`: this type also describes the
   * profile embedded in every stored calculation snapshot, and dropping a persisted key would make old
   * payloads unreadable. Migration step v7→v8 folds its value into `pensionerStatus` and removes it from
   * the live profile. No application code reads it any more — the only remaining readers are the migration
   * and its tests, and `pensionFacts.test.ts` fails if a new reader appears.
   */
  pensionStatus?: PfaPensionStatus;
  /**
   * TASK 5 — *calitatea de pensionar*, recorded as its own fact and read as exactly one thing: the CF
   * art. 150 alin. (1) CAS exemption (plus pension-income CASS, which this app does not compute).
   *
   * OPTIONAL, and absence is the honest third state: no legacy field ever recorded whether pension sums
   * were received in a given year, and a status does not record it either.
   */
  pensionerStatus?: PfaPensionStatus;
  /**
   * TASK 5 — the CF art. 174 alin. (7) lit. c) facts, one per fiscal year. This is what the art. 174
   * alin. (6) top-up relief actually turns on: pension sums received in the year, at any amount.
   */
  pensionReceiptYears?: PensionReceiptYear[];
  /**
   * TASK 5 — recorded pension suspensions. A fact with NO legal consequence attached: research 25 marks
   * the suspension question UNVERIFIED, so the app stores it and draws nothing from it.
   */
  pensionSuspensionYears?: PensionSuspensionYear[];
  /** TASK 5 — the CF art. 174 alin. (8) previous-year route to the same relief. */
  cassPreviousYearContext?: CassPreviousYearContext;
  /**
   * TASK 5 — CF art. 153 alin. (2). The only fact in this group that removes CASS taxpayer quality
   * entirely, and the only one whose proof is recorded as a separate half.
   */
  foreignSicknessInsurance?: ForeignSicknessInsurance;
  /**
   * PG-6d (D-OTH-2, D-LEG-1, B-41) — the amounts declared per fiscal year for the six CF art. 155 alin.
   * (1) lit. c)-h) categories, which cumulate into ONE CASS base under art. 170 alin. (2)-(4).
   *
   * What replaced the old `otherIncome` flag list is **amounts, plus the facts that decide the letter**
   * (`cedareaSursa`, `alteSurseArt114`). A flag could not be used by the engine at all: art. 174 alin.
   * (7) lit. b) and art. 170 alin. (4) both compare amounts to 6 / 12 / 24 SM, and `calcCass` said so in
   * its own words — „nu a putut fi evaluat — nu a fost nici predat”. The flag vocabulary itself is gone,
   * not deprecated: `concesiune` has no referent in the Cod fiscal and `alte` is wider than art. 114.
   *
   * OPTIONAL, with no `.default()` and no backfill anywhere. Absence of the whole array means the question
   * was never asked; absence of one category inside a year that was asked means the sum is unknown and the
   * ladder refuses. Neither is read as zero.
   */
  cassLadderYears?: CassLadderYear[];
  /**
   * PG-6b (B-29) — the activity family the person **declared**. `cazare` is `prestarea de servicii de
   * cazare`, which from FY2026 is taxed under CF art. 68^3 on a flat 30 % expense ratio and has no
   * expense engine at all; `other` is the sistem real the rest of this app computes.
   *
   * Three facts about this field, all load-bearing:
   *
   * - **It is asked, never inferred.** `research/30` §3 records that OMFP 925/2017 art. 2 alin. (4) keys
   *   the determination method to the activity description „independent de codurile CAEN menționate cu
   *   titlu exemplificativ”, so a CAEN code is not evidence about how the law taxes this person. No code
   *   in this repository may derive this value from `identity.caen`.
   * - **Optional means unanswered, not `other`.** Absence is the third state; it is reported as a missing
   *   profile fact (`scenarios.ts activity-family-undeclared` → PG-1's `fact_missing` coverage row), not
   *   treated as a pass. Migration step v11→v12 backfills nothing for the same reason.
   * - **It is a fact, not a conclusion.** The rule layer (`EXPENSE_ENGINE_CAZARE_2026`) decides what the
   *   family means for a calculation; this field only records what the person said.
   */
  activityFamily?: ActivityFamily;
  /**
   * PG-6h-2 (B-82, B-84) — the number of short-term-let rooms declared, **one record per fiscal year**.
   *
   * Three properties, each copied from the `activityFamily` rail directly above it:
   *
   * - **Asked, never inferred.** Nothing may derive it from `identity.caen`, from a revenue amount, from
   *   the expense categories or from a seed value. `research/39` §1 is the reason the question has to be
   *   asked rather than detected: the likeliest affected taxpayer — a natural person letting 1–7 rooms —
   *   has no registered business activity and so no CAEN code to be found.
   * - **Absence is the third state.** No `.default()`, no backfill, and migration step v12→v13 writes
   *   nothing. A migration that invents a room count invents a tax category, because the count decides
   *   the title (see `AccommodationIncomeTitle`), not a figure.
   * - **Per year, deliberately.** art. 83 alin. (4) speaks „începând cu anul fiscal în care…”, so two
   *   years may carry two different counts and two different titles.
   */
  accommodationRoomCounts?: AccommodationRoomCountYear[];
  /**
   * PG-6h-2 (D-COM-1, B-80) — which reading of art. 68^3 alin. (3) **the person chose** for their gross.
   * Optional with no default on purpose: an unanswered commission question leaves the gross undetermined,
   * and either default would move gross, tax, the CASS base and the CAS threshold.
   */
  accommodationCommissionReading?: AccommodationCommissionReading;
  /**
   * PG-6h-2 — the person's own answer to the art. 68^3 alin. (1) tourism-operator gate. The app records
   * the statement; the classification itself belongs to tourism law and the ONRC authorisation, not here.
   */
  accommodationTourismEligibility?: AccommodationTourismEligibility;
  /** CASS status. */
  socialInsuranceStatus: PfaSocialInsuranceStatus;
  /** VAT-exempt (scutire de TVA). */
  vatExempt: boolean;
  /**
   * The date the VAT turnover ceiling (CF art. 310 alin. (1)) was actually exceeded, ISO
   * `YYYY-MM-DD`. Optional on purpose — see the data-loss note on `pfaProfileSchema`: a
   * required field here would invalidate every payload written before this phase.
   *
   * This is the missing input for `VAT_REGISTRATION_DEADLINE_2026`. The rule has been correct,
   * cited and rule-driven since Phase 9b (`domain/deadlines.ts` `EVENT_DATE.vat_exceedance`,
   * `offset_days = 0`), but nothing in the app ever recorded the exceedance date, so the rule
   * resolved to `date: null, status: 'not_applicable'` and the deadline never appeared. The
   * silence when this field is absent is CORRECT — the engine has no source for the date and
   * must not invent one — so this field is what turns a structural silence into an answer.
   *
   * It is the exceedance date, not the registration date and not the month: Phase 9b split
   * `pfaStartDate` / `vatExceedanceMonth` deliberately and that split stands.
   */
  vatExceedanceDate?: string;
  /** Cash payment floor threshold (limitele de casă). Default 0. **Integer bani** — same key-name caveat as `salaryIncomeLei`. */
  cashFloorLei: Bani;
  /** Identity/contact data used by the application. */
  identity: PfaIdentity;
  /** Last update timestamp (ISO 8601). */
  updatedAt: string;
}
