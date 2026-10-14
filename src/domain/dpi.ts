/**
 * B-112 STAGE 1 — the *drepturi de proprietate intelectuală* income category: the vocabulary, and the
 * one flag the Cod fiscal states once but that carries two consequences.
 *
 * **Why a category has to be an input at all.** A `Revenue` record used to carry no income category: its
 * `tip` is `'factura' | 'notafactura'`, a **document type**. That is why the app could not represent DPI
 * income and silently omitted an entire income category from the CAS cumulation — the B-112 defect. The
 * fix is a category on the record, not an inference.
 *
 * **And why it must stay an input.** Whether a receipt is DPI or activitate independentă turns on the
 * **object of the contract** under Legea 8/1996, not on who received it:
 *
 * - a *cesiune / licență* of patrimonial copyright (art. 40 Legea 8/1996) → **DPI** (CF art. 70);
 * - a *contract de comandă / antrepriză* (art. 47 Legea 8/1996; art. 185¹ C. civ.), where the author is
 *   paid to **produce and deliver** without transferring rights → **activități independente** (art. 67).
 *
 * ÎCCJ, secția de contencios administrativ și fiscal, decizia nr. 1793 din 23 martie 2021 refused DPI
 * characterisation for contracts labelled „cesiune de drepturi de autor" that in fact covered cold-calling
 * work. So the label on the paper is not the test, and **the taxpayer having a PFA is not the test either**
 * — neither art. 70 nor art. 72 contains any carve-out for PFA holders, and ANAF's own Exemplul 3 is a
 * single taxpayer holding both categories in different D212 subsecțiuni. The app therefore records the
 * classification and never derives it. `docs/ai/research/48_dpi_income_rules_fy2026.md` §7.
 *
 * **What is deliberately NOT here:** any rate, any quota percentage, any lei figure. The 40 % and the 10 %
 * are parameters on `DPI_ART72_2026` in `./fiscal/dpi2026.ts`, because a fiscal figure that lives in code
 * is a fiscal figure a year cannot change. This module holds words, not numbers.
 */
import type { Bani } from './money';

/**
 * The income category a receipt belongs to.
 *
 * `activitate_independenta` is CF art. 67 income — art. 137 alin. (1) lit. b) for CAS, art. 155 alin. (1)
 * lit. b) for CASS. `drepturi_de_proprietate_intelectuala` is art. 70 income, and it is **a different limb
 * for each contribution**: art. 137 alin. (1) **lit. b¹)** for CAS and art. 155 alin. (1) **lit. c)** for
 * CASS. Same income, two different letters — the asymmetry `research/48` §1 and §5 record, and the reason a
 * single "is this PFA income" boolean could never have been enough.
 */
export const INCOME_CATEGORIES = ['activitate_independenta', 'drepturi_de_proprietate_intelectuala'] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

/**
 * What a record with no `incomeCategory` means.
 *
 * It means *activitate independentă*, and that is a statement about history rather than a guess about the
 * record: every payload written before B-112 could only ever hold activitate-independentă receipts, because
 * no other category was representable. The migration chain inventes nothing, so the key stays absent on
 * those records — and this is the one reading that does not require a backfill. A record the person meant
 * as DPI is not silently reclassified by it either: the field is offered on the form, and the person sets it.
 */
export const DEFAULT_INCOME_CATEGORY: IncomeCategory = 'activitate_independenta';

/**
 * The object of the contract, as the person declares it.
 *
 * This is the fact the classification rests on, so it is recorded beside the category rather than inferred
 * from it — and the pair is checkable: a receipt declared DPI under a *contract de comandă* is a
 * contradiction the app reports, not a tie it breaks. See `dpiRecordConflict`.
 */
export const DPI_CONTRACT_TYPES = ['cesiune_licenta', 'contract_de_comanda'] as const;
export type DpiContractType = (typeof DPI_CONTRACT_TYPES)[number];

/**
 * The art. 72 alin. (3) / art. 72¹ alin. (2) exclusion set — **one flag, two consequences.**
 *
 * The same three sums are named in both places, and the Cod fiscal states them once:
 *
 * 1. **no flat quota** — art. 72 alin. (2) / art. 72¹ alin. (1) fix the net by deducting a 40 % forfetară
 *    quota *from the gross*, and alin. (3) of each article takes these sums out of that mechanism;
 * 2. **excluded from CAS** — art. 137 alin. (1) lit. b¹) reads *„venituri din drepturi de proprietate
 *    intelectuală, definite la art. 70, **cu excepția veniturilor prevăzute la art. 72 alin. (3)**"*.
 *
 * So this is modelled as ONE predicate, `isDpiArt72Alin3Excluded`, and both consequences read it. Two
 * predicates would be two chances to get one legal fact wrong, which is the defect class this house has
 * been correcting all the way through (B-70, B-85, B-93).
 */
export const DPI_EXCLUDED_KINDS = ['mostenitori', 'drept_de_suita', 'remuneratie_copia_privata'] as const;
export type DpiExcludedKind = (typeof DPI_EXCLUDED_KINDS)[number];

/** The shape this module needs from a revenue record — declared here so the domain does not import the store. */
export interface DpiRecordFacts {
  incomeCategory?: IncomeCategory;
  dpiContractType?: DpiContractType;
  dpiExcludedKind?: DpiExcludedKind;
}

/**
 * The category a record belongs to, read — never decided.
 *
 * Absent means `DEFAULT_INCOME_CATEGORY`, and the reason for that reading is in the constant's own comment.
 */
export function incomeCategoryOf(r: DpiRecordFacts): IncomeCategory {
  return r.incomeCategory ?? DEFAULT_INCOME_CATEGORY;
}

/** Is this receipt DPI income? The single question every DPI branch in the app asks. */
export function isDpiIncome(r: DpiRecordFacts): boolean {
  return incomeCategoryOf(r) === 'drepturi_de_proprietate_intelectuala';
}

/**
 * Consequence one and consequence two of the same flag, behind one predicate.
 *
 * A record carrying any of the three kinds gets **no 40 % flat quota** (art. 72 alin. (3) / art. 72¹ alin.
 * (2)) **and** is **outside CAS** (art. 137 alin. (1) lit. b¹)). Call sites name which consequence they are
 * reading; the test for it lives here once.
 */
export function isDpiArt72Alin3Excluded(kind: DpiExcludedKind | undefined): boolean {
  return kind !== undefined;
}

/**
 * A contradiction between the declared category and the declared object of the contract.
 *
 * Returns the reason, or `null` when the pair is coherent. It never repairs the pair: the app did not write
 * either half, and picking one would be the app deciding a legal question the person answered twice, in
 * two different ways. ÎCCJ 1793/2021 is exactly a case where the paper's label and the contract's object
 * came apart, and where the court — not the parties' vocabulary — decided.
 */
export function dpiRecordConflict(r: DpiRecordFacts): string | null {
  const dpi = isDpiIncome(r);
  if (!dpi) {
    if (r.dpiExcludedKind !== undefined) {
      return (
        'Recordul este clasificat ca venit din activitate independentă (art. 67), dar poartă o categorie din ' +
        'setul de excluzere de la art. 72 alin. (3) / art. 72¹ alin. (2) (moștenitori, drept de suită sau ' +
        'remunerația pentru copia privată). Acel set privește exclusiv veniturile de la art. 70; pe un venit ' +
        'din art. 67 nu are niciun efect. Cele două răspunsuri se contrazic, iar aplicația nu alege între ele.'
      );
    }
    if (r.dpiContractType === 'cesiune_licenta') {
      return (
        'Recordul este clasificat ca venit din activitate independentă (art. 67), dar contractul este ' +
        'declarat ca cesiune / licență de drepturi patrimoniale. Sub Legea 8/1996 art. 40 un astfel de ' +
        'contract produce venit din drepturi de proprietate intelectuală (art. 70 Cod fiscal), nu venit din ' +
        'art. 67. Cele două răspunsuri se contrazic, iar aplicația nu alege între ele.'
      );
    }
    return null;
  }
  if (r.dpiContractType === 'contract_de_comanda') {
    return (
      'Recordul este clasificat ca venit din drepturi de proprietate intelectuală (art. 70), dar contractul ' +
      'este declarat ca contract de comandă / antrepriză (art. 47 din Legea 8/1996, art. 185¹ din Codul ' +
      'civil), adică autorul este plătit să creeze și să predea fără să transfere drepturi patrimoniale — ' +
      'care este definitul de la art. 67 (activități independente), nu cel de la art. 70. ÎCCJ, secția de ' +
      'contencios administrativ și fiscal, decizia nr. 1793 din 23 martie 2021 a refuzat tocmai această ' +
      'calificare pentru contracte intitulate „cesiune de drepturi de autor”. Aplicația nu alege între ' +
      'celest două răspunsuri: nu postează venitul și cere ca persoana să potrivească cele două câmpuri.'
    );
  }
  return null;
}

/**
 * The two ways the same DPI income can reach the app at once, and why that is a finding rather than a tie.
 *
 * - the **recorded** path: DPI receipts in the register, gross → the 40 % quota → net;
 * - the **declared** path: `CassLadderYear.proprietateIntelectuala`, a DPI *net* typed by hand on Settings.
 *
 * Both are producers of one number. `calcCassLadder` cumulates the category once, so a figure counted twice
 * would select a higher rung of the art. 170 alin. (3) ladder and bill CASS on money that was received once.
 * This is the same shape as B-93's `depreciation_conflict`: two routes to one fiscal quantity, where the
 * honest answer is to post neither and tell the person which two inputs disagree.
 */
export function dpiDoubleRepresentation(
  recorded: { hasRecords: boolean; net: Bani | null },
  declaredNet: Bani | undefined,
): { conflict: true; recordedNet: Bani | null; declaredNet: Bani } | null {
  if (!recorded.hasRecords || declaredNet === undefined) return null;
  return { conflict: true, recordedNet: recorded.net, declaredNet };
}
