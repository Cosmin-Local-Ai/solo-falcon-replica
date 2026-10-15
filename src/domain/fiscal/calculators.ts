import type { FiscalRule, FiscalParameter } from './rules';
import { depreciationSchedule, type FixedAssetFacts } from './depreciation';
import type { CassLadderCategory, FactState, PfaYesNo } from '../models';
import { CASS_LADDER_CATEGORIES, CASS_LADDER_CATEGORY_NAMES } from '../models';
import { applyRateDecimal, lei, leiText, roundArt66, subBani, sumBani, type Bani } from '../money';

export type ReviewRequired = { reviewRequired: true; reason: string };

export type CalculatorResult =
  | {
      /** The amount this rule computes as DUE, in integer bani. For the three sums art. 66
       * governs (income tax, CAS, CASS) this is already rounded exactly once, by `roundArt66` — no caller may
       * round it again, and no caller may round a base to get here. */
      value: Bani;
      breakdown: string[];
      /** Part of `value` that CF art. 118 alin. (2) lit. b) does NOT allow into the income-tax base.
       * Today exactly one contribution has such a part: the CF art. 174 alin. (6) CASS difference
       * (defect B-13). Art. 118 alin. (2) lit. b) verbatim: „venitul net anual impozabil care se
       * determină prin însumarea tuturor veniturilor nete anuale, recalculate, prevăzute la lit. a),
       * din care se deduc contribuția de asigurări sociale și contribuția de asigurări sociale de
       * sănătate datorate potrivit prevederilor titlului V, cu excepția diferenței de contribuție de
       * asigurări sociale de sănătate prevăzută la art. 174 alin. (6).” (modified by OUG 128/2024 pct.
       * 10 Art. I, MO 1125/11.11.2024, eff. 01-01-2025). Art. 118 alin. (2^3) then prorates the
       * deductible CASS over „contribuția … calculată potrivit art. 174 alin. (1)”, which is the 10% on
       * the art. 68 net income — not the top-up to the 6 SM floor. Absent or 0 = fully deductible. */
      nonDeductible?: Bani;
      /**
       * PG-6h-1 — the net income this rule DETERMINED as its own intermediate legal quantity, when it
       * determines one. Today exactly one rule does: CF art. 68^3 alin. (2), where the net is 70 % of
       * gross by statute rather than by subtracting recorded expenses.
       *
       * It is reported rather than left for the caller to re-subtract, for the reason this codebase has
       * already been burned by twice: a quantity recomputed at the surface is a quantity that can
       * disagree with the figure it sits beside. The composition layer needs the 68^3 net to feed the
       * CAS threshold test (art. 148 alin. (3)) and the CASS base (art. 170 alin. (1)); taking it from
       * here is the only way those three numbers are guaranteed to be about the same money.
       */
      determinedNet?: Bani;
      /**
       * PG-6d — the two readings of CF art. 174 alin. (7) lit. b) do not agree on this fact set, and this
       * is the case where the app must not pick one.
       *
       * The provision exempts the art. 174 alin. (6) difference where the person had art. 155 alin. (1)
       * lit. c)-h) income „pentru care datorează contribuția de asigurări sociale de sănătate la un nivel
       * cel puțin egal cu 6 salarii minime brute”. **Reading A** asks whether the *income* reaches 6 SM;
       * **Reading B** asks whether the *calculation base* is at least 6 SM. `docs/ai/research/41_other_income_flags_and_cass_ladder.md`
       * §7.6 records that **no official interpretation resolving A against B exists**. Where the two
       * readings converge the ladder computes with B; where they diverge it reports the divergence here and
       * the caller refuses rather than choosing. They diverge in exactly three situations — neimpozabile
       * income, an art. 154 alin. (1) exemption, and CASS withheld at source.
       */
      readingDivergence?: string;
      /**
       * B-112 STAGE 4 — the part of `value` a PLĂTITOR DE VENIT reține la sursă, for CAS under CF art. 151
       * alin. (5)-(11) and for the art. 155 alin. (1) lit. c)-h) CASS under art. 174¹ alin. (3)-(9).
       *
       * **Why this is a separate quantity and not a footnote.** For these incomes the payer withholds at the
       * moment of payment, so the contribution the law PRODUCES and the contribution the taxpayer still has
       * to hand over are two different numbers. ANAF's own Exemplul 3 prints both: *„Avem CASS reținută de
       * plătitorul de venit din drepturi de proprietate intelectuală = 4.860 lei • Rezultă o diferență de
       * plată = 9.720 – 4.860 = 4.860 lei."* A single combined figure is the defect this stage closes.
       *
       * **Absent is not zero.** `undefined` means the app cannot establish that any payer withheld — it has
       * no payment register, and for CAS no field exists for the *informare* of art. 151 alin. (11). A
       * `lei(0)` here is a different statement: the state machine says nobody had a duty to withhold
       * (art. 151 alin. (10) / art. 174¹ alin. (8)), or an exemption removed it (art. 150 alin. (1),
       * art. 154 alin. (1) lit. h¹)).
       */
      retinutLaSursa?: Bani;
      /**
       * B-112 stage 4 — `value − retinutLaSursa`: what the taxpayer still pays themselves through the
       * Declarația Unică. CF art. 151 alin. (9) and art. 174¹ alin. (6) both say the withheld contribution
       * *„este luată în calcul"*; the D212 rows are Subsecțiunea a 3-a rd. 4/rd. 5 for CAS and
       * Subsecțiunea a 2-a rd. 6 for CASS. Present exactly when `retinutLaSursa` is present.
       */
      dePlatit?: Bani;
    }
  | ReviewRequired;

export type CalculatorInput = {
  /** Realized net income for the tax year. For CAS it only SELECTS the applicable
   * statutory floor — it is never itself the CAS base (see `calcCas`). For CASS it
   * IS the base (venitul net anual, art. 68 sistem real), before deducting CAS —
   * see `calcCass`. */
  base?: Bani;
  /**
   * CAS — CF art. 150 alin. (1): a natural person earning independent-activity income who is a pensioner
   * or is insured in their own social insurance system owes NO CAS for art. 137 alin. (1) lit. b) and
   * b^1) income. Automatic, independent of the income amount, not optional.
   *
   * TASK 5 renamed this from `pensionStatus` and narrowed what it may decide. In `calcCass` it is read
   * for ONE purpose only — noticing that the receipt fact is missing — and it must NEVER switch anything
   * off there. `calcCass` relieves on `pensionSumsReceived`, because CF art. 174 alin. (7) lit. c) keys
   * on pension sums received in the fiscal year, not on *calitatea de pensionar*.
   */
  pensionerStatus?: FactState;
  /**
   * CASS — CF art. 174 alin. (7) lit. c): the art. 174 alin. (6) top-up is not owed where the person
   * REALISED pension income in that fiscal year. CF art. 99 alin. (1) defines it as „sume primite ca
   * pensii”, so the test is receipt in the year, at ANY amount.
   *
   * No amount threshold may be applied here: lit. a) and lit. b) carry „la un nivel cel puțin egal cu 6
   * salarii minime brute pe țară” and lit. c) deliberately does not.
   */
  pensionSumsReceived?: FactState;
  /**
   * CASS — CF art. 174 alin. (8) lit. a): alin. (7) also reaches a person who in the PREVIOUS year was
   * in art. 154 alin. (1) lit. a), b), e) or f). That list excludes pensioners, so this is never derived
   * from `pensionerStatus`.
   */
  previousYearExceptedCategory?: FactState;
  /** CASS — CF art. 174 alin. (8) lit. b): an art. 180 alin. (1) option exercised in the previous year. */
  previousYearArt180Option?: FactState;
  /**
   * CASS — CF art. 153 alin. (2): sickness/maternity insurance in another EU/SEE/Elvețian or
   * bilateral-agreement state, whose validity has been proved. Such a person „nu au calitatea de
   * contribuabil la sistemul de asigurări sociale de sănătate”, so NO CASS arises at all. This is the
   * only total CASS exclusion on this path, and it is unrelated to pensions.
   */
  foreignSicknessInsuranceProved?: FactState;
  /**
   * CASS — months of the year in which a pension was suspended. Recorded and reported, never acted on:
   * research 25 gap 1 leaves the effect of a suspension on art. 174 alin. (7) UNVERIFIED.
   */
  pensionSuspensionMonths?: number[];
  /**
   * CASS only — CF art. 174 alin. (7) lit. a): the art. 174 alin. (6) top-up is not
   * owed where salary and assimilated income realised in that fiscal year is "cel puțin
   * egal cu 6 salarii minime brute".
   *
   * Phase 6 supplies the amount through `salaryIncomeLei`, so both branches now
   * COMPUTE: amount >= 6 SM -> the top-up is not owed (CASS stays 10% x VNA, fully
   * deductible); amount < 6 SM -> the top-up is owed and stays non-deductible per
   * art. 118 alin. (2) lit. b). When the flag is 'da' but the amount is absent (a
   * payload written before Phase 6), `calcCass` still returns `reviewRequired` rather
   * than guessing in either direction.
   *
   * MUST NEVER REACH CAS: CF art. 150 alin. (2) exempts salary earners only for
   * art. 137 alin. (1) lit. b^1) (drepturi de proprietate intelectuală), NOT lit. b).
   * A PFA owner who is also an employee still owes full CAS on independent-activity
   * income, so `salaryStatus` must never map into `calcCas`.
   */
  salaryStatus?: 'da' | 'nu';
  /**
   * CASS only — salary and assimilated income (CF art. 155 alin. (1) lit. a)) actually
   * realised in the fiscal year, in lei. This is the figure CF art. 174 alin. (7) lit. a)
   * compares against the 6 SM floor. Absent means "not known", which is reported, not
   * assumed. Never an input to CAS (art. 150 alin. (2) covers only lit. b^1)).
   */
  salaryIncomeLei?: Bani;
  /**
   * PG-6h-1 — CF art. 68^3 alin. (2): the GROSS of an accommodation register, cash basis („încasate în
   * cursul anului fiscal”), already converted to lei per alin. (4).
   *
   * Deliberately a separate field and NOT `base`. In `calcCas` and `calcCass`, `base` means the NET the
   * contributions are measured on; in `calcAccommodationFlatRatio` and in `calcShortTermRoomsFlatRatio`
   * (B-88) the input is the GROSS the flat ratio is applied to. One variable meaning gross in one
   * calculator and net in another is precisely the mistake that would turn the 68^3 net into the CAS base,
   * which art. 148 alin. (2) does not allow. The two flat-ratio calculators share this field because both
   * inputs really are a gross; they do NOT share a rule, a calculator id or a citation, because art. 68^3
   * and art. 85 measure that gross differently (art. 85 alin. (2)-(3) is cash basis with the retained
   * commission outside the gross) and send its net to different contribution basins.
   */
  gross?: Bani;
  /**
   * CASS — CF art. 174 alin. (7) lit. b): the base the person's OWN art. 155 alin. (1) lit. c)-h) CASS is
   * owed on, as determined by `calcCassLadder`. This is what makes that litera evaluable for the first
   * time: it used to be fed a boolean flag, and `calcCass` correctly reported that a flag cannot be
   * compared to 6 SM („nu a putut fi evaluat — nu a fost nici predat”).
   *
   * `undefined` means the ladder was never evaluated — the person has not been asked, or the answer set is
   * incomplete — and the branch stays reported rather than assumed. A `lei(0)` here is NOT absence: it is
   * the ladder having computed that the cumulated amount is below 6 SM, so no CASS is owed on it and the
   * lit. b) test fails on its merits.
   */
  ladderBase?: Bani;
  /**
   * CASS — the divergence between the two readings of art. 174 alin. (7) lit. b), reported by
   * `calcCassLadder` as `readingDivergence`. Present means the alin. (6) difference cannot be decided
   * without choosing a reading, and this calculator refuses instead of choosing.
   */
  ladderReadingDivergence?: string;
  /**
   * PG-6d — the input for `calcCassLadder`, the art. 155 alin. (1) lit. c)-h) track. Deliberately its own
   * field and never folded into `base`: `base` on this calculator is the art. 170 alin. (1) amount, i.e.
   * the cumulated **lit. b)** net capped at 72 SM, and the ladder is a different basins with a different
   * ceiling (art. 170 alin. (3), no 72-SM cap). One variable carrying both is how the two tracks would get
   * merged.
   */
  cassLadder?: CassLadderInput;
  /**
   * CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil". An
   * explicitly chosen base is honoured, but never below the applicable statutory
   * floor. Wired to no persisted field and no UI input; when the election is
   * implemented it must be its own persisted field, never an override of realized
   * income. Absent means "no election made", so the statutory minimum (the floor
   * itself) is the headline figure.
   */
  chosenBase?: Bani;
  /**
   * B-112 STAGE 4 — the net of the ONE income source whose payer withholds CAS, i.e. the art. 137 alin. (1)
   * lit. b^1) (*drepturi de proprietate intelectuală*) amount measured by itself, not the cumulated amount.
   *
   * It has to be its own field because art. 151 alin. (6) and art. 148 alin. (2) measure different things:
   * `base` is the art. 148 alin. (3) CUMULATION, which selects the floor the CONTRIBUTION is owed on, while
   * the payer's withholding is computed on the base that SOURCE alone selects. Passing the cumulation to
   * both is how the withheld figure would silently become the whole contribution and the difference vanish.
   *
   * `undefined` means the app does not hold that amount (the year was never answered), which is reported as
   * an unknown, never as a zero. A declared `lei(0)` means the person answered and has no such income, so
   * no payer had a duty to withhold.
   */
  casWithholdingSourceNet?: Bani;
  /**
   * PG-6e — the declared facts of the one fixed asset whose depreciation is being asked about.
   *
   * It is a `FixedAssetFacts`, not a stored `FixedAsset`: the depreciation vocabulary lives in
   * `./depreciation.ts` (the layer that reads it, the same reason `VehicleYearFacts` lives in
   * `./deductibility.ts`), and `data/types.ts` builds the stored record on top of it by adding an `id`.
   * Absent means no asset was supplied, and the calculator refuses rather than applying a rate to nothing.
   */
  fixedAsset?: FixedAssetFacts;
  /** PG-6e — which fiscal year's line of the schedule is being asked for. */
  fiscalYear?: number;
};

/**
 * PG-6d (D-OTH-1, B-41) — what the art. 155 alin. (1) lit. c)-h) CASS ladder is measured on.
 *
 * The amounts are the ones CF art. 170 alin. (4) measures **per category, by that category's own rule** —
 * net for lit. c), d), e) and g); **venitul brut** for lit. h) and for lit. h) only; dividends as
 * „dividendele plătite, diminuate cu impozitul reținut”; agricultural as „venitul net **sau** norma de
 * venit, după caz”, which survives only there. The caller assembles them from the declared per-year facts;
 * this calculator does not know what a profile is.
 *
 * **A missing key is not a zero.** art. 170 alin. (4) sums across **all** of lit. c)-h), so one missing
 * category makes the sum unknown and the ladder must refuse. A declared `lei(0)` is a different input and
 * is added as zero.
 */
export type CassLadderInput = {
  amounts?: Partial<Record<CassLadderCategory, Bani>>;
  /** CF art. 170 alin. (5): art. 93 / art. 105 neimpozabile income — recorded, never cumulated. */
  neimpozabil?: Bani;
  /** CF art. 174¹ alin. (3)-(6): CASS already reținută la sursă — a credit, not a second charge. */
  cassRetinutLaSursa?: Bani;
  /** D-OTH-2 — whether the declared „alte surse” amount is art. 114 income at all. */
  alteSurseArt114?: PfaYesNo;
  /** D-OTH-2 — whether letting receipts come from the PFA's own activity or from personal patrimony. */
  cedareaSursa?: 'activitate_proprie_a_pfa' | 'patrimoniu_personal';
  /**
   * B-112 stage 3 — CF art. 154 alin. (1) lit. h¹): a natural person who **realises** salary and assimilated
   * salary income **and/or** pension income is exempt from CASS *for income from intellectual property
   * rights*. research/48 §11.3 quotes it and records that Legea 141/2025 art. II pct. 17 extended it to
   * pensioners with effect from 1 Aug 2025.
   *
   * **The letter is not settled and is not asserted as settled.** Consolidations disagree on whether this
   * exemption sits at lit. h) or lit. h¹); the operative content is the same either way (research/48, open
   * question 3: „Verify against Monitorul Oficial before hard-coding the letter”). The breakdown therefore
   * cites the reading this app uses and says the letter is unverified.
   *
   * Three states, because the exemption keys on income REALISED in the year, not on a status flag — the same
   * discipline art. 174 alin. (7) lit. c) is held to in this file. `'unknown'` neither grants the exemption
   * nor refuses the year: the amount is cumulated and the withheld exemption is stated.
   */
  dpiExemptArt154?: FactState;
};

export type CalculatorFunction = (
  rule: FiscalRule,
  input?: CalculatorInput,
) => CalculatorResult;

function paramValue(rule: FiscalRule, id: string): number | string | undefined {
  return rule.parameters.find((p) => p.id === id)?.value;
}

function paramNumber(rule: FiscalRule, id: string): number {
  const v = paramValue(rule, id);
  if (typeof v !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  return v;
}

/**
 * Phase 10: the unit-aware funnel. `FiscalParameter.value` is `number | string` shared by lei, percent,
 * date, count, days and text, so the type alone cannot say which unit a number is in — `unit` is the only
 * machine-readable marker in the rule store. This is the one place that question gets answered: a `lei`
 * parameter is read as integer **bani** (the rule package stores it that way), and reading a percent,
 * date or count through here is a hard error rather than a silently mis-scaled amount.
 *
 * Rates deliberately do NOT come through here: they stay unscaled integer percents (25, 10) and are
 * applied by `applyRateDecimal`, so a rate never inherits a money scale by accident.
 */
function paramBani(rule: FiscalRule, id: string): Bani {
  const p = rule.parameters.find((x: FiscalParameter) => x.id === id);
  if (!p || typeof p.value !== 'number') {
    throw new Error(`Missing numeric parameter '${id}' for rule ${rule.ruleId}`);
  }
  if (p.unit !== 'lei') {
    throw new Error(
      `Parameter '${id}' of rule ${rule.ruleId} has unit '${p.unit}', not 'lei' — refusing to read it as money`,
    );
  }
  if (!Number.isInteger(p.value)) {
    throw new Error(
      `Parameter '${id}' of rule ${rule.ruleId} is not an integer number of bani (${p.value})`,
    );
  }
  return p.value as Bani;
}

function calcWageReference(rule: FiscalRule): CalculatorResult {
  const has = rule.parameters.some((p) => p.id === 'reference' || p.id === 'monthly');
  if (!has) {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no numeric 'reference' or 'monthly' parameter`,
    };
  }
  const value = paramBani(rule, rule.parameters.some((p) => p.id === 'reference') ? 'reference' : 'monthly');
  return { value, breakdown: [`value: ${leiText(value)} lei`] };
}

/**
 * B-112 STAGE 4 — the rung a PLĂTITOR DE VENIT applies to ONE source of its own.
 *
 * This is not the ladder that selects the taxpayer's own base. It is the same ladder read over ONE source,
 * which is what art. 151 alin. (6)-(7) and art. 174¹ alin. (3)-(4) make the payer's duty depend on: the
 * payer withholds when *its own* estimated amount reaches the trigger, and where there are several sources
 * the taxpayer designates by contract the one payer whose income alone clears it. `undefined` is the answer
 * when the source does not reach the first rung — and the articles do not leave that as an open question:
 * art. 151 alin. (10) and art. 174¹ alin. (8) say there is NO withholding in that case and the taxpayer
 * files the declaration, so the withheld amount is a known 0 lei, not an unknown.
 */
function payerRung(amount: Bani, rungs: readonly Bani[]): Bani | undefined {
  let chosen: Bani | undefined;
  for (const rung of rungs) if (amount >= rung) chosen = rung;
  return chosen;
}

type WithholdingOutcome = {
  /** The amount the payer's obligation produces — never a recorded payment. */
  retinut: Bani;
  /** The base that withheld amount was computed on, absent when no withholding duty arises at all. */
  bazaRetinuta?: Bani;
  note: string;
};

/**
 * B-112 stage 4 — what the taxpayer still owes once the withheld contribution is „luată în calcul”.
 *
 * `due − withheld` is the whole rule (art. 151 alin. (9), art. 174¹ alin. (6); D212 Subsecțiunea a 3-a
 * rd. 5 „Diferența stabilită în plus”). A negative result is not a negative payment: it means more was
 * withheld than is due, which the app reports instead of silently clamping or inventing a refund.
 *
 * **B-125 — what happens to the excess is now known, and it is not a refund.** The wording written before
 * `docs/ai/research/52_dividends_losses_withholding_fy2026.md` said only that recovery was „nu este modelată
 * de aplicație”. That sentence implied a route exists and the app had simply not implemented it. It does not
 * exist, and the note now says what actually happens to the money. `kind` distinguishes the two
 * contributions, because the evidence differs:
 *
 * - **CAS** — art. 151 alin. (4) is the only restitution text in all of Titlul V and it is a **denial**:
 *   „contribuția plătită nu se restituie, aceasta fiind valorificată la stabilirea elementelor necesare
 *   determinării dreptului de pensie”. D212 Subsecțiunea 1 stops at rd.5 „Diferența stabilită în plus” —
 *   **there is no CAS minus row** — and in the Sumar no CAS amount can reach „Diferență de restituit”.
 * - **CASS** — art. 174 alin. (12) is the only compensate/restitute route in Titlul V and it reaches only
 *   art. 68¹ (sport). Art. 174¹ alin. (12) reads „Prevederile art. 174 alin. **(14)-(18)** se aplică în mod
 *   corespunzător”, **deliberately excluding alin. (12)** — so for DPI, arendă and asocieri there is none
 *   either. Where a CASS over-retention does arise on art. 68¹ income, the minus row becomes **a tax**, not
 *   a refund (OPANAF 2736/2025 Subsecțiunea 2.1 rd.8 note).
 *
 * The CPF route (Legea 207/2015 art. 167-168) returns sums „plătite sau încasate fără a fi datorate”, but no
 * Titlul V provision creates such a claim for a correctly reported CAS/CASS retention. **No refund path is
 * built here, because there is none to build.**
 */
function payableAfterWithholding(
  due: Bani,
  withheld: Bani,
  kind: 'cas' | 'cass',
): { dePlatit: Bani; note?: string } {
  if (withheld > due) {
    const excess = subBani(withheld, due);
    return {
      dePlatit: lei(0),
      note:
        kind === 'cas'
          ? `Contribuția reținută la sursă (${leiText(withheld)} lei) este mai mare decât contribuția `
            + `datorată (${leiText(due)} lei), cu ${leiText(excess)} lei în plus. Suma de plătit este 0 lei. `
            + 'Excesul NU se restituie și nu este o sumă de recuperat: art. 151 alin. (4) spune în mod expres '
            + 'că „contribuția plătită nu se restituie, aceasta fiind valorificată la stabilirea elementelor '
            + 'necesare determinării dreptului de pensie, potrivit legii”. Banii rămân la stat și se pun în '
            + 'seama stagiului de cotizare — aceasta este explicația, nu o cale de întoarcere pe care '
            + 'aplicația să fi lăsat-o deoparte. Formularul confirmă: Subsecțiunea 1 (CAS) se oprește la '
            + 'rd.5 „Diferența stabilită în plus (rd.3 − rd.4)”, nu există rând de minus pentru CAS, iar în '
            + 'Sumar nicio sumă de CAS nu poate ajunge la „Diferență de restituit” (rd.7). '
            + 'research/52 §Q4 a scanat tot Titlul V (art. 135 → 220⁸, 320.745 caractere): singurul text de '
            + 'restituire pentru CAS este acest refuz.'
          : `Contribuția reținută la sursă (${leiText(withheld)} lei) este mai mare decât contribuția `
            + `datorată (${leiText(due)} lei), cu ${leiText(excess)} lei în plus. Suma de plătit este 0 lei. `
            + 'Excesul NU se restituie: art. 174 alin. (12) este singura cale de compensare/restituire din '
            + 'Titlul V și acoperă numai veniturile din art. 68¹ (contracte de activitate sportivă), iar '
            + 'art. 174¹ alin. (12) trimite expres la „art. 174 alin. (14)-(18)”, exclinzând în mod '
            + 'deliberat alin. (12). Pentru drepturi de proprietate intelectuală, arendă și asocieri cu '
            + 'persoane juridice nu există deci nicio cale de restituire. Iar unde diferența în plus chiar '
            + 'apare pe art. 68¹, OPANAF 2736/2025 (Subsecțiunea 2.1, rd.8) o transformă în IMPUZIT pe '
            + 'venit, nu în rambursare. research/52 §Q4.' 
            + 'Aplicația nu construiește o cale de restituire pentru că nu există una.',
    };
  }
  return { dePlatit: subBani(due, withheld) };
}

/**
 * B-112 stage 4 — CAS reținută la sursă: art. 151 alin. (6) and art. 151 alin. (10).
 *
 * Returns `undefined` when the app does not hold the source amount at all. That is reported as an unknown,
 * never as 0 lei: "nobody withheld" and "the app cannot tell whether anybody withheld" are different
 * statements, and the second one is what a payload with an unanswered year means.
 */
function casWithheldFromSource(
  sourceNet: Bani | undefined,
  tier1Base: Bani,
  tier2Base: Bani,
  ratePercent: number,
): WithholdingOutcome | undefined {
  if (sourceNet === undefined) return undefined;
  const rung = payerRung(sourceNet, [tier1Base, tier2Base]);
  if (rung === undefined) {
    return {
      retinut: lei(0),
      note:
        `art. 151 alin. (10): venitul net al sursei al cărei plătitor ar reține contribuția este ` +
        `${leiText(sourceNet)} lei, sub pragul de 12 salarii minime brute (${leiText(tier1Base)} lei), deci ` +
        'plătitorul NU are obligația reținerii; contribuția se stabilește și se plătește de contribuabil ' +
        'potrivit Declarației Unice.',
    };
  }
  return {
    retinut: roundArt66(applyRateDecimal(rung, ratePercent)),
    bazaRetinuta: rung,
    note:
      `art. 151 alin. (6): un plătitor de venit din art. 137 alin. (1) lit. b^1) cu un venit net estimat de ` +
      `cel puțin 12 salarii minime brute (${leiText(tier1Base)} lei) calculează, reține și virează ` +
      `contribuția; baza reținerii este „venitul ales” din contract, care nu poate coborî sub pragul pe ` +
      `care valoarea acestei singure surse îl alege, adică ${leiText(rung)} lei. art. 151 alin. (7): la mai ` +
      'multe surse, contribuabilul desemnează prin contract plătitorul a cărui sursă depășește singură ' +
      'pragul; art. 151 alin. (8): același plătitor depune D112 (art. 147 alin. (1)) până la data de 25 a ' +
      'lunii următoare.',
  };
}

/**
 * B-112 stage 4 — CASS reținută la sursă pe veniturile din art. 155 alin. (1) lit. c)-h):
 * art. 174¹ alin. (3)-(4) și alin. (8), în numerotarea valabilă de la 1 ianuarie 2025 (OUG 128/2024,
 * MO 1125/11.11.2024 — art. 174¹ a trecut de la 21 la 12 alineate; `research/50` arată textul).
 *
 * A declared amount — the *informare* the payer must issue under art. 174¹ alin. (7) — wins over the derived
 * one, because it is a fact about money the payer actually retained while the derivation is only what the
 * rule would have required. Where the two disagree the disagreement is reported, not repaired: the app did
 * not write either figure and the taxpayer's DUE amount does not depend on which of them is right.
 */
function cassWithheldFromSource(
  declared: Bani | undefined,
  sourceNet: Bani | undefined,
  sourceExempt: boolean,
  rungs: readonly Bani[],
  ratePercent: number,
): WithholdingOutcome | undefined {
  if (sourceExempt) {
    return {
      retinut: lei(0),
      note:
        'art. 154 alin. (1) lit. h¹): persoana realizează venituri din salarii și asimilate salariilor ' +
        'și/sau din pensii, deci nu datorează CASS pentru veniturile din drepturi de proprietate ' +
        'intelectuală; plătitorul de venit nu are ce reține pentru această categorie.',
    };
  }
  const rung = sourceNet === undefined ? undefined : payerRung(sourceNet, rungs);
  const derived =
    sourceNet === undefined
      ? undefined
      : rung === undefined
        ? lei(0)
        : roundArt66(applyRateDecimal(rung, ratePercent));
  if (declared !== undefined && declared > 0) {
    return {
      retinut: declared,
      ...(rung === undefined ? {} : { bazaRetinuta: rung }),
      note:
        `art. 174¹ alin. (7): plătitorul de venit are obligația să emită „o informare cu privire la nivelul ` +
        `contribuției … reținute”, iar aplicația folosește suma consemnată din acea informare: ` +
        `${leiText(declared)} lei.` +
        (derived !== undefined && derived !== declared
          ? ` Regula ar fi produs ${leiText(derived)} lei pe baza aleasă de această sursă ` +
            '(art. 174¹ alin. (3)); cele două cifre nu cad de acord, aplicația nu repară niciuna și nu ' +
            'alege între ele — contribuția DATORATĂ nu depinde de care este corectă.'
          : ''),
    };
  }
  if (derived === undefined) return undefined;
  if (rung === undefined) {
    return {
      retinut: lei(0),
      note:
        `art. 174¹ alin. (8): venitului net al fiecărei surse în parte este sub 6 salarii minime brute ` +
        `(${leiText(rungs[0])} lei) — aici ${leiText(sourceNet as Bani)} lei — deci plătitorul NU reține ` +
        'CASS; contribuabilul depune Declarația Unică.',
    };
  }
  return {
    retinut: derived,
    bazaRetinuta: rung,
    note:
      `art. 174¹ alin. (3): un singur plătitor de venit, cu un venit net estimat de cel puțin 6 salarii ` +
      `minime brute (${leiText(rungs[0])} lei), calculează contribuția aplicând cota de la art. 156 asupra ` +
      `bazei de la art. 170 alin. (3) alese de această sursă, o reține și o virează; art. 174¹ alin. (4): la ` +
      'mai multe surse, contribuabilul desemnează prin contract plătitorul a cărui sursă depășește singură ' +
      '6 salarii minime brute; art. 174¹ alin. (5): același plătitor depune D112 (art. 147 alin. (1)) până ' +
      'la data de 25 a lunii următoare.',
  };
}

// CF art. 148 alin. (2): the CAS base is "venitul ales de contribuabil, care nu
// poate fi mai mic decât" 12 SM (income between 12 SM and 24 SM) or 24 SM (income
// at or above 24 SM). That is a LADDER OF FLOORS, not a clamp: realized income only
// selects which floor applies, and there is NO upper cap. Contrast CASS
// art. 170 alin. (1), which says "nu poate fi mai mare decât" — that one is a cap.
// CF art. 148 alin. (1): below 12 SM the obligation never arises, so CAS is 0 —
// NOT the 12 SM figure.
function calcCas(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const ratePercent = paramNumber(rule, 'rate'); // unscaled integer percent — never a money amount
  const tier1Base = paramBani(rule, 'min_base'); // 12 SM floor
  const tier2Base = paramBani(rule, 'tier2_base'); // 24 SM floor
  const tier1Cas = paramBani(rule, 'tier1_cas');
  const tier2Cas = paramBani(rule, 'tier2_cas');
  const realized = input?.base ?? lei(0);
  // B-112 STAGE 4 — `datorată`, `reținută` and `de plătit`, computed apart. The withheld figure is DERIVED
  // from the source amount, because the profile holds no payment register and no field for the payer's
  // *informare* of art. 151 alin. (11); adding one is a chain step and was refused for this stage. What the
  // profile does hold is the art. 137 alin. (1) lit. b^1) amount, and art. 151 alin. (6) makes the payer's
  // duty a function of exactly that amount.
  const withheld = casWithheldFromSource(input?.casWithholdingSourceNet, tier1Base, tier2Base, ratePercent);

  if (input?.pensionerStatus === 'da') {
    return {
      value: lei(0),
      retinutLaSursa: lei(0),
      dePlatit: lei(0),
      breakdown: [
        'pensionar sau asigurat in propriul sistem de asigurari sociale — exceptie CF art. 150 alin. (1)',
        `venit realizat: ${leiText(realized)} lei`,
        'CAS = 0 lei (exceptia nu depinde de cuantumul venitului si nu este optionala)',
        'art. 150 alin. (1) atinge și veniturile din art. 137 alin. (1) lit. b^1), nu doar pe cele din lit. b): plătitorul de venit din drepturi de proprietate intelectuală nu are ce reține, deci CAS reținută = 0 lei și CAS de plătit = 0 lei.',
      ],
    };
  }

  if (realized < tier1Base) {
    // B-125: the over-withheld note used to be thrown away here. This branch is the MOST likely place for a
    // CAS over-retention — the person owes nothing under art. 148 alin. (1) while a payer withheld at a rung
    // — and it was exactly the place where the app said nothing about the money. The note is now carried.
    const zeroPayable = withheld === undefined
      ? undefined
      : payableAfterWithholding(lei(0), withheld.retinut, 'cas');
    return {
      value: lei(0),
      ...(withheld === undefined || zeroPayable === undefined
        ? {}
        : { retinutLaSursa: withheld.retinut, dePlatit: zeroPayable.dePlatit }),
      breakdown: [
        `venit realizat: ${leiText(realized)} lei`,
        `sub 12 SM anual (${leiText(tier1Base)} lei) — conditia din CF art. 148 alin. (1) nu este indeplinita`,
        `CAS = 0 lei (CF art. 148 alin. (4) permite optiunea voluntara la o baza >= ${leiText(tier1Base)} lei; neimplementata in aceasta faza)`,
        ...(withheld === undefined
          ? ['NOTĂ (REȚINERE NESTABILITĂ): aplicația nu deține cuantumul sursei al cărei plătitor ar reține CAS (art. 137 alin. (1) lit. b^1)), deci nu raportează nicio sumă reținută și nici nu susține că nu a reținut nimeni nimic.']
          : [withheld.note]),
        ...(zeroPayable?.note ? [zeroPayable.note] : []),
      ],
    };
  }

  const inTier2 = realized >= tier2Base;
  const floor = inTier2 ? tier2Base : tier1Base;
  const floorCas = inTier2 ? tier2Cas : tier1Cas;
  const chosen = input?.chosenBase;
  // Not Math.max: that returns a plain `number` and would drop the Bani brand. Same comparison, kept typed.
  const base = chosen === undefined ? floor : chosen > floor ? chosen : floor;
  // CF art. 66 — EXTENDED to CAS by this app's policy (Titlul V states no rounding rule). The base
  // stays exact integer bani; only the contribution owed is rounded, and it is rounded here, once.
  const cas = roundArt66(applyRateDecimal(base, ratePercent));
  const breakdown = [
    `venit realizat: ${leiText(realized)} lei`,
    `prag aplicabil (CF art. 148 alin. (2) lit. ${inTier2 ? 'b' : 'a'}): ${leiText(floor)} lei`,
    `baza de calcul = venitul ales: ${leiText(base)} lei`,
    `CAS = ${leiText(base)} x ${ratePercent / 100} = ${leiText(cas)} lei`,
    `OPTIUNE INFORMATIONALA: minimul legal in acest prag este ${leiText(floorCas)} lei (baza ${leiText(floor)} lei); CF art. 148 alin. (2) nu prevede nicio plafonare superioara, deci o baza mai mare poate fi aleasa voluntar doar pentru o pensie mai mare`,
    `CAS la pragul de 12 SM = ${leiText(tier1Cas)} lei; la pragul de 24 SM = ${leiText(tier2Cas)} lei; fara plafon superior`,
  ];
  if (chosen !== undefined && chosen < floor) {
    breakdown.push(
      `baza aleasa ${leiText(chosen)} lei este sub pragul legal de ${leiText(floor)} lei si a fost ridicata la acest prag — CF art. 148 alin. (2) prevede un MINIM, nu o plafonare`,
    );
  }

  // ── B-112 stage 4 — the CAS triple ────────────────────────────────────────────────────────
  if (withheld === undefined) {
    breakdown.push(
      'NOTĂ (REȚINERE NESTABILITĂ): aplicația nu deține cuantumul sursei al cărei plătitor ar reține CAS (art. 137 alin. (1) lit. b^1)), deci nu raportează nicio sumă reținută și nici nu susține că nu a reținut nimeni nimic. CAS datorată rămâne cifra de mai sus.',
    );
    return { value: cas, breakdown };
  }
  const payable = payableAfterWithholding(cas, withheld.retinut, 'cas');
  breakdown.push(withheld.note);
  if (withheld.bazaRetinuta !== undefined && withheld.bazaRetinuta < base) {
    breakdown.push(
      `art. 151 alin. (9): contribuția a fost reținută pe o bază de ${leiText(withheld.bazaRetinuta)} lei, ` +
        `iar baza anuală de calcul a întregii persoane este ${leiText(base)} lei; contribuția reținută „este ` +
        'luată în calcul”, iar diferența în plus se stabilește prin Declarația Unică — Subsecțiunea a 3-a, ' +
        'rd. 4 „CAS reținută de plătitorul de venit conform art. 151 alin. (9)” și rd. 5 „Diferența stabilită în plus”.',
    );
  }
  breakdown.push(
    `CAS: datorată ${leiText(cas)} lei • reținută la sursă ${leiText(withheld.retinut)} lei • de plătit ${leiText(payable.dePlatit)} lei`,
  );
  if (payable.note) breakdown.push(payable.note);
  breakdown.push(
    'NOTĂ (LIMITARE, NU CONCLUZIE): aplicația nu ține un registru al plăților și nu are niciun câmp pentru informarea plătitorului de la art. 151 alin. (11). Suma reținută este derivată din cuantumul declarat al sursei, potrivit obligației plătitorului din art. 151 alin. (6), nu dintr-o dovadă a virării; ea nu este o plată consemnată de persoană.',
  );
  return { value: cas, retinutLaSursa: withheld.retinut, dePlatit: payable.dePlatit, breakdown };
}

// CASS — CF Titlul V Cap. III. The base is the annual NET income (art. 68 sistem real,
// before deducting CAS). The floor and the ceiling come from DIFFERENT articles:
//   CF art. 170 alin. (1)  ceiling — the base "nu poate fi mai mare decât" 72 SM. This
//                          article also excludes art. 118 fiscal losses from the base.
//   CF art. 174 alin. (6)  the 6-SM floor for art. 155 alin. (1) lit. b) income, owed as
//                          "o diferență de contribuție … până la nivelul celei corespunzătoare
//                          bazei de calcul egale cu 6 salarii minime brute". It is a TOP-UP, not
//                          a substitution — proven by CF art. 118 alin. (2) lit. b), which makes
//                          CASS deductible from the income-tax base "cu excepția diferenței de
//                          contribuție … prevăzută la art. 174 alin. (6)". NOT art. 170 alin.
//                          (2)-(3): those rungs reach only art. 155 alin. (1) lit. c)-h), and
//                          art. 68 income is lit. b) — a different door.
//   CF art. 174 alin. (2)  zero net income / fiscal loss → "nu datorează contribuția" at all.
//                          The 6-SM floor is NOT self-executing there; they may opt in under
//                          art. 180 alin. (1) (elective, deadline-bound — not modelled).
//   CF art. 174 alin. (7)  the top-up is not owed where the person REALISED, in that fiscal
//     lit. a)/c)             year, (a) salary ≥ 6 SM or (c) pension income per art. 99.
//                          lit. c) has no monetary threshold and removes ONLY the top-up:
//                          10% × net still stands. A pensioner with art. 68 net income is NOT
//                          CASS-free — unlike CAS art. 150 alin. (1), which exempts entirely.
// Every figure below is read from parameters; the CASS amounts at the floor and the ceiling
// are DERIVED as rate × base, never declared as separate parameters (one legal figure, one
// source of truth).
function calcCass(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const ratePercent = paramNumber(rule, 'rate'); // unscaled integer percent
  const floorBase = paramBani(rule, 'min_base'); // 6 SM — CF art. 174 alin. (6) top-up floor
  const maxBase = paramBani(rule, 'max_annual_base'); // 72 SM — CF art. 170 alin. (1) ceiling
  const vna = input?.base ?? lei(0);
  // TASK 5: an absent fact and an explicitly-unknown fact are the same state, and the withheld-conclusion
  // notes below must fire for both. Normalising once here keeps every branch honest about that.
  const pensionSumsReceived: FactState = input?.pensionSumsReceived ?? 'unknown';
  const pensionerStatus: FactState = input?.pensionerStatus ?? 'unknown';
  // Derived, never declared as separate parameters (one legal figure, one source of truth) — and rounded
  // by the same single art. 66 call as every other sum due, so the floor figure and the computed figure
  // cannot disagree about how rounding works.
  const floorCass = roundArt66(applyRateDecimal(floorBase, ratePercent)); // 2,430 lei for 2026
  const ceilingCass = roundArt66(applyRateDecimal(maxBase, ratePercent)); // 29,160 lei for 2026

  // CF art. 153 alin. (2): holding sickness/maternity insurance in another EU/SEE/Elvețian or
  // bilateral-agreement state AND proving it leaves the person outside the CASS taxpayer circle
  // altogether — „nu au calitatea de contribuabil la sistemul de asigurări sociale de sănătate”. This is
  // the one total exclusion on this path, and it is checked first because it removes the taxpayer
  // quality the rest of this function computes for. It is NOT a pension rule: art. 154 alin. (2) still
  // preserves CASS on the other art. 155 alin. (1) incomes for everyone inside the excepted categories.
  if (input?.foreignSicknessInsuranceProved === 'da') {
    return {
      value: lei(0),
      breakdown: [
        `venit net anual (VNA): ${leiText(vna)} lei`,
        'asigurare de sanatate (boala si maternitate) intr-un alt stat membru UE/SEE/Elvetian sau intr-un stat cu acord bilateral, cu dovada valabilitatii facuta — CF art. 153 alin. (2)',
        'persoana NU are calitatea de contribuabil la sistemul de asigurari sociale de sanatate: nu se datoreaza CASS pentru acest an (art. 153 alin. (2))',
        'NU este o exceptie pentru pensionari: art. 154 alin. (2) pastreaza CASS pentru celelalte venituri din art. 155 alin. (1) ale persoanelor din categoriile exceptate',
        'CASS = 0 lei',
      ],
    };
  }

  // CF art. 174 alin. (2): a fiscal loss or a net income equal to zero owes NO CASS.
  if (vna <= 0) {
    return {
      value: lei(0),
      breakdown: [
        `venit net anual (VNA): ${leiText(vna)} lei`,
        'VNA egal cu zero sau pierdere fiscala — nu se datoreaza CASS: CF art. 174 alin. (2); pierderile fiscale nu intra nici in baza de calcul (art. 170 alin. (1))',
        `OPTIUNE NEMODELATA: aceeasi persoana poate opta pentru plata CASS potrivit CF art. 180 alin. (1) — optiune cu termen, iar baza din art. 180 alin. (2) nu este verificata`,
        // TASK 5: this used to read "pragul de 6 SM din art. 174 alin. (6) NU se aplica automat aici",
        // which stated as law a question the code does not answer. alin. (2) says the contribution
        // "potrivit art. 170 alin. (1)" is not owed; alin. (6) speaks of a base "corespunzătoare
        // veniturilor realizate" below 6 SM. Whether the 6-SM DIFFERENCE survives a zero/loss year is
        // research 25 gap 2 — UNVERIFIED, and explicitly not to be resolved by inference. The 0 lei
        // below is the contribution under art. 170 alin. (1); the difference is left undecided and the
        // CASS_MIN_BASE threshold row reports it as `unknown`.
        'NOTA DE INTERPRETARE (NEVERIFICATA): art. 174 alin. (2) spune ca nu se datoreaza contributia potrivit art. 170 alin. (1); art. 174 alin. (6) vorbeste despre o diferenta de contributie pentru o baza sub 6 SM. Codul nu spune daca diferenta supravietuieste unui an cu venit zero sau pierdere fiscala — research 25, gap 2. Aplicația calculeaza 0 lei pentru contributia de 10% si NU prezinta rezultatul ca pe o regula verificata privind diferenta.',
      ],
    };
  }

  if (vna < floorBase) {
    // Checked BEFORE the salary relief: art. 174 alin. (7) lit. c) has no monetary
    // threshold, so it is certain in exactly the case where lit. a) cannot be evaluated.
    //
    // TASK 5: the key is `pensionSumsReceived`, NOT pensioner status. The chapeau of alin. (7) asks
    // whether the person „a realizat venituri … din pensii, definite conform art. 99” in the fiscal
    // year, and art. 99 alin. (1) defines those as „sume primite ca pensii”. A pensioner who received
    // no pension sums that year does not qualify; someone who was not a pensioner all year but
    // received some does. No amount is compared — lit. c) carries no 6-SM qualifier.
    if (pensionSumsReceived === 'da') {
      const cass = roundArt66(applyRateDecimal(vna, ratePercent));
      return {
        value: cass,
        breakdown: [
          `venit net anual (VNA): ${leiText(vna)} lei`,
          `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
          'exceptie: sume primite ca pensii (art. 99 alin. (1)) REALIZATE in anul fiscal — CF art. 174 alin. (7) lit. c); fara prag valoric, nu este un simplu statut de pensionar',
          'lit. c) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 170 alin. (1)); pensia NU scuteste de CASS, spre deosebire de CAS unde art. 150 alin. (1) scuteste integral',
          `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei`,
          ...(input?.pensionSuspensionMonths && input.pensionSuspensionMonths.length > 0
            ? [`NOTA (FAPTA, NU CONCLUZIE): pensia a fost suspendata in lunile ${input.pensionSuspensionMonths.join(',')}; efectul suspendarii asupra art. 174 alin. (7) lit. c) nu este verificat (research 25, gap 1) — aplicatia nu trage nicio concluzie din ea`]
            : []),
        ],
      };
    }
    // CF art. 174 alin. (8): alin. (7) also reaches a person who in the PREVIOUS year was in art. 154
    // alin. (1) lit. a), b), e) or f), or had opted under art. 180 alin. (1). That category list
    // EXCLUDES pensioners (they sit in lit. h^2)), so this branch can never be reached from
    // `pensionerStatus` — it needs its own recorded fact.
    if (input?.previousYearExceptedCategory === 'da' || input?.previousYearArt180Option === 'da') {
      const cass = roundArt66(applyRateDecimal(vna, ratePercent));
      return {
        value: cass,
        breakdown: [
          `venit net anual (VNA): ${leiText(vna)} lei`,
          `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
          `exceptie: in anul precedent persoana s-a incadrat in art. 154 alin. (1) lit. a), b), e) sau f) (${input.previousYearExceptedCategory === 'da' ? 'da' : 'nu'}) sau a optat pentru CASS potrivit art. 180 alin. (1) (${input.previousYearArt180Option === 'da' ? 'da' : 'nu'}) — CF art. 174 alin. (8)`,
          'alin. (8) lit. a) nu include pensionarii: lista art. 154 alin. (1) lit. a), b), e), f) este inchisa, iar pensionarii sunt la lit. h^2) — aceasta exceptie nu se deduce din calitatea de pensionar',
          'alin. (8) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 170 alin. (1))',
          `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei`,
        ],
      };
    }
    // CF art. 174 alin. (7) lit. a): the top-up is not owed if salary and assimilated
    // income REALISED in that fiscal year is at least 6 SM. Phase 6 supplies the amount
    // (`salaryIncomeLei`), so the branch now computes instead of halting.
    // Note what the relief does and does not do: alin. (7) removes only the alin. (6)
    // DIFFERENCE. The art. 174 alin. (1) / art. 170 alin. (1) contribution of 10% x VNA
    // is still owed, and unlike the top-up it IS deductible under art. 118 alin. (2) lit. b)
    // (which carves out only „diferența … prevăzută la art. 174 alin. (6)”).
    if (input?.salaryStatus === 'da') {
      const salary = input.salaryIncomeLei;
      if (salary === undefined) {
        return {
          reviewRequired: true,
          reason:
            `VNA ${leiText(vna)} lei este sub pragul de 6 SM (${leiText(floorBase)} lei), dar diferenta de contributie din CF art. 174 alin. (6) nu se datoreaza daca veniturile din salarii si asimilate ale anului fiscal sunt cel putin egale cu 6 salarii minime brute (art. 174 alin. (7) lit. a)). Profilul are salaryStatus = da dar nu contine cuantumul salarial — nu se poate stabili.`,
        };
      }
      if (salary >= floorBase) {
        const cass = roundArt66(applyRateDecimal(vna, ratePercent));
        return {
          value: cass,
          breakdown: [
            `venit net anual (VNA): ${leiText(vna)} lei`,
            `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
            `exceptie: venituri din salarii si asimilate realizate in anul fiscal = ${leiText(salary)} lei, cel putin egal cu 6 salarii minime brute (${leiText(floorBase)} lei) — CF art. 174 alin. (7) lit. a)`,
            'lit. a) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 174 alin. (1), art. 170 alin. (1))',
            `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei (fara diferenta de contributie; intreaga contributie este deductibila per art. 118 alin. (2) lit. b))`,
          ],
        };
      }
      // salary < 6 SM: the condition in alin. (7) lit. a) is not met, so the top-up stands.
      // Falls through to the art. 174 alin. (6) branch below.
    }
    // CF art. 174 alin. (7) lit. b): the top-up is likewise not owed where the person realised art. 155
    // alin. (1) lit. c)-h) income „pentru care datorează contribuția de asigurări sociale de sănătate la un
    // nivel cel puțin egal cu 6 salarii minime brute”. Until PG-6d this litera could not be evaluated at
    // all — the profile carried flags, and a flag has no level to compare with 6 SM, which is what the
    // note at the bottom of this branch used to say. `calcCassLadder` now supplies the base, so the test
    // runs.
    //
    // It runs on **Reading B** (the calculation base), which is the reading the words support: a 10 %
    // contribution can never itself equal 6 SM, so „nivel” must denote the base. That is safe only where
    // Reading A would decide the same way. Where the two part, the ladder reports `readingDivergence` and
    // this calculator refuses rather than picking — see the note on `CalculatorResult.readingDivergence`
    // and `docs/ai/research/41_other_income_flags_and_cass_ladder.md` §7.6, which records that no official
    // interpretation of this litera exists.
    //
    // Checked AFTER lit. c), alin. (8) and lit. a) on purpose: those grant the relief on their own facts,
    // so once one of them holds the lit. b) question decides nothing and refusing would be over-refusal.
    if (input?.ladderReadingDivergence) {
      return { reviewRequired: true, reason: input.ladderReadingDivergence };
    }
    if (input?.ladderBase !== undefined && input.ladderBase >= floorBase) {
      const cass = roundArt66(applyRateDecimal(vna, ratePercent));
      return {
        value: cass,
        breakdown: [
          `venit net anual (VNA): ${leiText(vna)} lei`,
          `VNA sub pragul de 6 SM (${leiText(floorBase)} lei): art. 174 alin. (6) ar cere o diferenta de contributie pana la ${leiText(floorCass)} lei`,
          `exceptie: persoana datoreaza CASS pe veniturile din art. 155 alin. (1) lit. c)-h) la o baza de ${leiText(input.ladderBase)} lei, cel putin egala cu 6 salarii minime brute (${leiText(floorBase)} lei) — CF art. 174 alin. (7) lit. b)`,
          'testul se face la nivelul BAZEI de calcul (Citește B), nu la nivelul venitului realizat: o contributie de 10 % nu poate egala niciodată 6 salarii minime, deci „nivel” semneifică baza. Citește A ar număra și veniturile neimpozabile excluse de art. 170 alin. (5); acolo unde cele două lecturi nu cad la fel, calculatorul refuză în loc să aleagă.',
          'lit. b) elimina DOAR diferenta de la art. 174 alin. (6) — contributia de 10% pe VNA ramane datorata (art. 174 alin. (1), art. 170 alin. (1))',
          `CASS = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(cass)} lei (fara diferenta de contributie; intreaga contributie este deductibila per art. 118 alin. (2) lit. b))`,
        ],
      };
    }
    // B-13: the top-up is OWED but NOT DEDUCTIBLE. art. 174 alin. (6) creates a „diferență de
    // contribuție” up to a 6 SM base when the art. 68 net income is positive but smaller than 6 SM; the
    // art. 174 alin. (1) / art. 170 alin. (1) contribution itself stays 10% × net income. Art. 118 alin.
    // (2) lit. b) deducts the contributions „datorate potrivit prevederilor titlului V” but expressly
    // „cu excepția diferenței de contribuție de asigurări sociale de sănătate prevăzută la art. 174 alin.
    // (6)”, and alin. (2^3) prorates over the contribution „calculată potrivit art. 174 alin. (1)”.
    // So the deductible part is `due`, while the whole `floorCass` stays payable. Reported as
    // `nonDeductible` so the income-tax base composes correctly instead of absorbing the difference.
    const due = roundArt66(applyRateDecimal(vna, ratePercent)); // art. 174 alin. (1) / art. 170 alin. (1): 10% x VNA
    // Derived by subtraction from the already-rounded total, so `value - nonDeductible === due` holds
    // exactly. Rounding the two parts independently could have left them one ban apart.
    const difference = subBani(floorCass, due); // art. 174 alin. (6): differenta de contributie — neimputabila
    return {
      value: floorCass,
      nonDeductible: difference,
      breakdown: [
        `venit net anual (VNA): ${leiText(vna)} lei`,
        `baza de calcul = pragul de 6 SM: ${leiText(floorBase)} lei — CF art. 174 alin. (6) (NU art. 170 alin. (2)-(3), care vizeaza doar art. 155 alin. (1) lit. c)-h))`,
        `CASS = ${leiText(floorBase)} x ${ratePercent / 100} = ${leiText(floorCass)} lei — o diferenta de contributie pana la baza de 6 SM, nu inlocuirea bazei`,
        'CF art. 118 alin. (2) lit. b): diferenta de la art. 174 alin. (6) NU se scade din baza impozabila (reparație de coerență, nu de calcul)',
        `CASS deductibila din baza impozabila = ${leiText(vna)} x ${ratePercent / 100} = ${leiText(due)} lei (art. 174 alin. (1)); diferenta neimputabila = ${leiText(difference)} lei (art. 174 alin. (6), exclusa expres de art. 118 alin. (2) lit. b))`,
        ...(input?.salaryStatus === 'da'
          ? [
              `conditia din art. 174 alin. (7) lit. a) nu este indeplinita: venituri din salarii ${leiText(input.salaryIncomeLei!)} lei < 6 salarii minime brute (${leiText(floorBase)} lei), deci diferenta ramane datorata`,
            ]
          : []),
        // TASK 5 — the withheld conclusions travel here so a reader sees WHY no relief was granted.
        // Neither line changes the amount: the app declines to grant an exception it cannot establish,
        // and says so instead of pretending the fact was checked.
        ...(pensionerStatus === 'da' && pensionSumsReceived === 'unknown'
          ? ['NOTA (EXCEPTIE NESTABILITA): profilul consemneaza calitatea de pensionar, dar nu consemneaza ca in acest an fiscal au fost primite sume ca pensii. art. 174 alin. (7) lit. c) se decide pe incasarea din an (art. 99 alin. (1)), nu pe statut, iar alin. (8) nu extinde exceptia la pensionari — diferenta NU se acorda automat, dar nici nu se refuza pe baza statutului. randul CASS_MIN_BASE raporteaza `unknown`.']
          : []),
        ...(pensionSumsReceived === 'unknown' && pensionerStatus !== 'da'
          ? ['NOTA: fapta „sume primite ca pensii in acest an fiscal” nu este inregistrata in profil; absenta ei nu este o dovada contrara (research 25, "What fact the input model must actually hold").']
          : []),
        ...(input?.pensionSuspensionMonths && input.pensionSuspensionMonths.length > 0
          ? [`NOTA (FAPTA, NU CONCLUZIE): pensia a fost suspendata in lunile ${input.pensionSuspensionMonths.join(',')}; efectul asupra art. 174 alin. (7) lit. c) nu este verificat (research 25, gap 1)`]
          : []),
        ...(input?.ladderBase !== undefined
          ? [
              `conditia din art. 174 alin. (7) lit. b) nu este indeplinita: baza de calcul a CASS pe veniturile din art. 155 alin. (1) lit. c)-h) este ${leiText(input.ladderBase)} lei, sub 6 salarii minime brute (${leiText(floorBase)} lei), deci persoana nu „datorează contribuția la un nivel cel puțin egal cu 6 salarii minime brute” — diferenta ramane datorata`,
            ]
          : [
              'NOTA (CONDITIE NEVALUATA): persoana nu a fost intrebanda despre veniturile din art. 155 alin. (1) lit. c)-h), sau raspunsurile sunt incomplete, deci art. 174 alin. (7) lit. b) nu a putut fi evaluat — nu a fost nici presupus indeplinit, nici presupus neindeplinit.',
            ]),
      ],
    };
  }

  // Not Math.min: it returns a plain `number` and would drop the Bani brand.
  const base = vna < maxBase ? vna : maxBase;
  const cass = roundArt66(applyRateDecimal(base, ratePercent));
  const breakdown = [
    `venit net anual (VNA): ${leiText(vna)} lei`,
    `baza de calcul: ${leiText(base)} lei`,
    `CASS = ${leiText(base)} x ${ratePercent / 100} = ${leiText(cass)} lei`,
  ];
  if (vna > maxBase) {
    breakdown.push(
      `VNA depaseste plafonul de 72 SM (${leiText(maxBase)} lei) — baza se plafoneaza: CF art. 170 alin. (1) "nu poate fi mai mare decât"`,
      `CASS la plafon = ${leiText(ceilingCass)} lei, derivata din ${leiText(maxBase)} x ${ratePercent / 100} (nu exista un parametru separat pentru acest numar)`,
    );
  }
  return { value: cass, breakdown };
}

/**
 * PG-6d (D-OTH-1, B-41) — the CASS ladder for CF art. 155 alin. (1) lit. c)-h).
 *
 * This is a **separate track** from the `calcCass` branch above, and keeping them apart is the whole
 * discipline of the phase:
 *
 * - `calcCass` runs on art. 170 alin. (1): the cumulated **lit. b)** net, which IS the base, floored at
 *   6 SM by the art. 174 alin. (6) difference and capped at 72 SM.
 * - this calculator runs on art. 170 alin. (2)-(4) + art. 174¹ alin. (1): the amount cumulated across
 *   lit. c)-h), which only SELECTS one of three bases (6 / 12 / 24 SM). There is **no 72-SM cap here** —
 *   that cap belongs to art. 170 alin. (1) and does not reach this basin — and the PFA's own net never
 *   enters the 6/12/24 test, exactly as `research/38` §1.5 keeps art. 68^3 out of it.
 *
 * Three properties the arithmetic must have and the easy way each one gets broken:
 *
 * 1. **A condition precedent, not a rate.** Below 6 SM cumulated there is no CASS at all for these
 *    categories (art. 170 alin. (2): „…datorează contribuția … dacă … valoarea cumulată a acestora este
 *    cel puțin egală cu 6 salarii minime brute”). Returning the 6-SM contribution for a 20.000 lei year is
 *    the `calcCass` art. 174 alin. (6) rule imported into a provision that does not contain it.
 * 2. **A cliff, one base per person.** art. 170 alin. (3) fixes „baza anuală de calcul” for „persoanele”
 *    and art. 174¹ alin. (1) applies the 10 % to that single base, so six categories feed ONE total feeding
 *    ONE base. A marginal-rate implementation understates at 48.599 lei and overstates at 48.600; a
 *    per-category ladder manufactures six contributions where the law states one. Ranges are inclusive at
 *    the lower bound.
 * 3. **An unanswered category is not zero.** art. 170 alin. (4) sums across all six litera, so a partial
 *    answer set makes the sum unknown. Defaulting the gap is defect B-41: depending on the rung it can
 *    invent a liability or erase one.
 *
 * Every figure comes from the CASS rule's parameters — `rate`, `min_base` (rung 1 = 6 SM),
 * `ladder_tier2_base` (12 SM), `ladder_tier3_base` (24 SM) — never from a literal, so a year with no
 * verified minimum wage cannot quietly inherit 2026's.
 */
/**
 * B-122 — the THREE sources art. 174¹ alin. (3) obliges a plătitor to withhold CASS for.
 *
 * Until now this file derived the retained amount from the DPI leg only. A taxpayer whose CASS was withheld
 * by an *arendator* or by the *asociere* saw `reținută = 0` and `de plătit` equal to the whole contribution:
 * the app telling a person they owe the entire amount when somebody had already paid part of it to the state
 * on their behalf. Same article, same alineat — this is wiring, not new law, and the harm is asymmetric in a
 * way a rate error is not.
 *
 * The three are named in the law's own litera order. `cedarea_folosintei_bunurilor` (lit. e), art. 83, is the
 * arendă family this engine models; ordinary arendă outside it stays out of scope for the income regime, and
 * that is said in `ui/copy/settings.ts`, not changed here.
 */
const CASS_WITHHOLDING_SOURCES: readonly CassLadderCategory[] = [
  'proprietate_intelectuala',
  'asociere_persoana_juridica',
  'cedarea_folosintei_bunurilor',
];

/**
 * B-122 — resolve the withheld CASS across those three sources.
 *
 * art. 174¹ alin. (4) keeps the answer a SINGLE figure: with several sources the taxpayer designates by
 * contract the one plătitor whose source alone exceeds 6 SMN. The app does not hold that designation, so
 * where more than one present source would each have produced a retention, the app names the candidates and
 * declines to choose. It does not sum them — nobody paid the sum — and it does not pick one silently.
 *
 * A declared *informare* (art. 174¹ alin. (7)) still wins over every derivation, exactly as before: it is a
 * fact about money a payer actually retained, and it is not attributable to a source on the form.
 */
function cassWithheldForLadder(
  amounts: Partial<Record<CassLadderCategory, Bani>>,
  declared: Bani | undefined,
  dpiExcluded: boolean,
  rungs: readonly Bani[],
  ratePercent: number,
): { outcome?: WithholdingOutcome; notes: string[] } {
  const notes: string[] = [];
  const threeSources = CASS_WITHHOLDING_SOURCES.map((c) => CASS_LADDER_CATEGORY_NAMES[c]).join(', ');
  const perSource = CASS_WITHHOLDING_SOURCES
    // art. 154 alin. (1) lit. h¹) exempts ONE category, DPI, and nothing else — the other two still have a
    // withholding duty, so the exemption must not travel across the three.
    .filter((c) => !(c === 'proprietate_intelectuala' && dpiExcluded))
    .map((c) => ({ category: c, outcome: cassWithheldFromSource(undefined, amounts[c], false, rungs, ratePercent) }))
    .filter((x): x is { category: CassLadderCategory; outcome: WithholdingOutcome } => x.outcome !== undefined);
  const retaining = perSource.filter((x) => x.outcome.retinut > 0);
  const named = (x: { category: CassLadderCategory; outcome: WithholdingOutcome }) =>
    `${CASS_LADDER_CATEGORY_NAMES[x.category]}: ${leiText(x.outcome.retinut)} lei`;

  if (declared !== undefined && declared > 0) {
    const baza = retaining.length === 1 ? retaining[0].outcome.bazaRetinuta : undefined;
    return {
      outcome: {
        retinut: declared,
        ...(baza === undefined ? {} : { bazaRetinuta: baza }),
        note:
          `art. 174¹ alin. (7): plătitorul de venit are obligația să emită „o informare cu privire la nivelul ` +
          `contribuției … reținute”, iar aplicația folosește suma consemnată din acea informare: ` +
          `${leiText(declared)} lei.` +
          (retaining.length === 1
            ? ` Regula ar fi produs ${named(retaining[0])} pe baza aleasă de această sursă (art. 174¹ ` +
              'alin. (3)); cele două cifre nu cad de acord, aplicația nu repară niciuna și nu alege între ' +
              'ele — contribuția DATORATĂ nu depinde de care este corectă.'
            : retaining.length > 1
              ? ` Regula ar fi putut produce mai multe cifre, pentru că art. 174¹ alin. (3) numește trei ` +
                `surse a căror plătitor reține, iar aici mai multe califică: ${retaining.map(named).join('; ')}.`
              : ' Aplicația nu deține cuantumul niciunei surse care ar fi putut genera reținerea, deci nu ' +
                'poate compara cifra consemnată cu cea pe care regula ar fi produs-o.') +
          ` Sursele la care plătitorul are obligația reținerii (art. 174¹ alin. (3)): ${threeSources}.`,
      },
      notes,
    };
  }

  if (retaining.length === 1) {
    const only = retaining[0];
    return {
      outcome: {
        ...only.outcome,
        note: `${only.outcome.note} Sursa care reține este ${CASS_LADDER_CATEGORY_NAMES[only.category]} — art. 174¹ alin. (3) numește trei astfel de surse: ${threeSources}.`,
      },
      notes,
    };
  }

  if (retaining.length > 1) {
    // art. 174¹ alin. (4) designates ONE payer when several sources qualify. But the designation only matters
    // if the candidates disagree: the contribution is a single annual figure (art. 170 alin. (3) speaks of
    // „baza anuală de calcul” a persoanei), and two payers selecting the same rung retain the same lei. Where
    // they agree there is no ambiguity to report and suppressing the credit would be a regression — it is
    // exactly the B-122 harm, wearing the costume of caution.
    const amounts = new Set(retaining.map((x) => x.outcome.retinut));
    if (amounts.size === 1) {
      const first = retaining[0];
      return {
        outcome: {
          ...first.outcome,
          note:
            `${first.outcome.note} Mai multe surse califică pentru reținere (art. 174¹ alin. (3): ` +
            `${retaining.map(named).join('; ')}); art. 174¹ alin. (4) desemnează un singur plătitor, dar ` +
            'alegerea lui nu schimbă cifra — toate selectează aceeași treaptă, deci reținerea este aceeași.',
        },
        notes,
      };
    }
    notes.push(
      `NOTĂ (PLĂTITOR NEDESEMNAT): art. 174¹ alin. (3) obligă plătitorul să calculeze, rețină și vireze CASS ` +
        `pentru trei surse — ${threeSources}. Aici mai multe surse prezente depășesc fiecare singură 6 salarii ` +
        `minime brute și ar fi produs ALTĂ reținere: ${retaining.map(named).join('; ')}. art. 174¹ alin. (4): ` +
        'la mai multe surse contribuabilul desemnează prin contract plătitorul a cărui sursă depășește ' +
        'singură pragul, iar aplicația nu deține desemnarea. Nu adună reținerile — nimeni nu a virat suma — ' +
        'și nu alege una în tăcere, pentru că cele două cifre diferă și diferența se vede în „de plătit”. ' +
        'Cât anume a fost reținut rămâne nedeclarat; contribuția DATORATĂ de mai sus nu se schimbă.',
    );
    return { notes };
  }

  if (perSource.length > 0) {
    // No present source reaches 6 SMN, so no plătitor has anything to retain (alin. (8)) — said once, for
    // all three, rather than once per category.
    return {
      outcome: {
        retinut: lei(0),
        note:
          `art. 174¹ alin. (8): venitul net al fiecărei surse în parte este sub 6 salarii minime brute ` +
          `(${leiText(rungs[0])} lei), deci niciun plătitor nu reține CASS; contribuabilul depune Declarația ` +
          `Unică. Sursele verificate: ${perSource.map((x) => CASS_LADDER_CATEGORY_NAMES[x.category]).join(', ')} — ` +
          'art. 174¹ alin. (3).',
      },
      notes,
    };
  }

  return { notes };
}

function calcCassLadder(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const ladder = input?.cassLadder;
  const ratePercent = paramNumber(rule, 'rate');
  const tier1 = paramBani(rule, 'min_base'); // 6 SM — art. 170 alin. (2) threshold and alin. (3) rung 1
  const tier2 = paramBani(rule, 'ladder_tier2_base'); // 12 SM
  const tier3 = paramBani(rule, 'ladder_tier3_base'); // 24 SM
  const conditionPrecedent = paramValue(rule, 'ladder_condition_precedent');
  const amounts = ladder?.amounts ?? {};

  // ── The refusal that is the whole point of the phase: a partial answer set is an unknown sum ──
  const missing = CASS_LADDER_CATEGORIES.filter((c) => amounts[c] === undefined);
  if (missing.length > 0 && missing.length < CASS_LADDER_CATEGORIES.length) {
    return {
      reviewRequired: true,
      reason:
        `Baza de calcul CASS pentru veniturile din art. 155 alin. (1) lit. c)-h) nu poate fi stabilită: ` +
        `din cele șase categorii prevăzute de art. 170 alin. (4) lipsesc ${missing.length} ` +
        `(${missing.map((c) => CASS_LADDER_CATEGORY_NAMES[c]).join(', ')}). Cumularea se face peste TOATE șase, deci o categorie fără răspuns ` +
        'face suma necunoscută — nu o sumă mai mică. Aplicația nu completează zero: un zero declarat este ' +
        'o faptă înregistrată de persoana fizică, un zero inventat este o datorie sau o scutire care nu ' +
        'există (art. 170 alin. (2)-(4) din Codul fiscal).',
    };
  }
  if (missing.length === CASS_LADDER_CATEGORIES.length) {
    return {
      reviewRequired: true,
      reason:
        'Niciun venit din art. 155 alin. (1) lit. c)-h) nu a fost declarat pentru acest an fiscal, deci ' +
        'aplicația nu are ce cumula. Aceasta nu este o afirmație că persoana nu a avut astfel de venituri.',
    };
  }

  // ── D-OTH-2: the two facts that decide whether an amount belongs in this basin at all ──
  if (amounts.alte_surse !== undefined && amounts.alte_surse > 0 && ladder?.alteSurseArt114 !== 'da') {
    return {
      reviewRequired: true,
      reason:
        'Suma declarată la „alte surse” nu poate fi cumulată: art. 155 alin. (1) lit. h) trimite la art. 114, ' +
        'iar art. 114 alin. (1) cuprinde numai veniturile care NU se încadrează în art. 61 lit. a)-h). ' +
        'Premiile și jocurile de noroc (art. 61 lit. g)) și transferul proprietăților imobiliare (art. 61 ' +
        'lit. h)) nu apar în art. 155 alin. (1) deloc și nu atrag niciodată CASS, deci un „alte” fără ' +
        'calificarea art. 114 ar fabrica o contribuție. Aplicația refuză cumularea până când persoana ' +
        'declară că suma este un venit definit la art. 114.',
    };
  }
  if (
    amounts.cedarea_folosintei_bunurilor !== undefined &&
    amounts.cedarea_folosintei_bunurilor > 0 &&
    ladder?.cedareaSursa === 'activitate_proprie_a_pfa'
  ) {
    return {
      reviewRequired: true,
      reason:
        'Veniturile din închiriere declarate ca provenind din activitatea proprie a PFA nu pot intra în ' +
        'cumularea de la art. 170 alin. (4): art. 83 alin. (1) exclude în mod expres veniturile din ' +
        'activități independente, iar astfel de încasări sunt veniturile art. 67 alin. (1) — art. 155 alin. ' +
        '(1) lit. b), care se impun și se contribuie pe altă cale (art. 170 alin. (1), cu plafon de 72 SM). ' +
        'Nu există nicio categorie „concesiune” în Codul fiscal care să le așeze altundeva.',
    };
  }

  // ── art. 170 alin. (5): neimpozabile income is seen, never added ──
  const neimpozabil = ladder?.neimpozabil ?? lei(0);
  // ── B-112 stage 3 — art. 154 alin. (1) lit. h¹): DPI income seen, never cumulated, for a person with
  // realised salary and/or pension income. The exemption reaches ONE category: the other five still
  // cumulate, and the art. 155 alin. (1) lit. b) basin is untouched by it. Excluding the amount also removes
  // it from the rung test, because income for which no CASS is owed cannot select the base of a CASS.
  const dpiExempt = ladder?.dpiExemptArt154 ?? 'unknown';
  const dpiAmount = amounts.proprietate_intelectuala;
  const dpiExcluded = dpiExempt === 'da' && dpiAmount !== undefined && dpiAmount > 0;
  let cumulated = lei(0);
  for (const category of CASS_LADDER_CATEGORIES) {
    const amount = amounts[category];
    if (amount === undefined) continue; // unreachable: the completeness check above already refused
    if (amount < 0) {
      return {
        reviewRequired: true,
        reason: `Un venit declarat la art. 155 alin. (1) lit. c)-h) este negativ (${leiText(amount)} lei); art. 170 alin. (4) cumulează venituri, nu pierderi.`,
      };
    }
    if (category === 'proprietate_intelectuala' && dpiExcluded) continue;
    cumulated = sumBani([cumulated, amount]);
  }

  // ── The cliff. Inclusive at the lower bound of each rung, exactly as art. 170 alin. (4) words it. ──
  let base: Bani;
  let rung: string;
  if (cumulated < tier1) {
    base = lei(0);
    rung = 'sub 6 salarii minime brute — condiția prealabilă din art. 170 alin. (2) nu este îndeplinită';
  } else if (cumulated < tier2) {
    base = tier1;
    rung = '6 salarii minime brute';
  } else if (cumulated < tier3) {
    base = tier2;
    rung = '12 salarii minime brute';
  } else {
    base = tier3;
    rung = '24 salarii minime brute';
  }
  const value = base === lei(0) ? lei(0) : roundArt66(applyRateDecimal(base, ratePercent));

  // ── The two readings of art. 174 alin. (7) lit. b), and the one case here where they part ──
  // Reading A looks at the income realised; Reading B at the base the contribution is owed on. They agree
  // whenever the measured cumulated amount itself reaches 6 SM, because the first rung triggers there. They
  // part when neimpozabile income (art. 170 alin. (5), excluded from the cumulation) is what carries the
  // gross over 6 SM: Reading A would grant the art. 174 alin. (6) relief, Reading B would not. No primary
  // source settles which is right (research/41 §7.6), so the divergence is reported, not resolved.
  let readingDivergence: string | undefined;
  if (cumulated < tier1 && cumulated + neimpozabil >= tier1) {
    readingDivergence =
      `art. 174 alin. (7) lit. b) nu poate fi evaluat fără să se aleagă între două lecturi. ` +
      `Venitul cumulată măsurat potrivit art. 170 alin. (4) este ${leiText(cumulated)} lei, sub 6 salarii ` +
      `minime brute (${leiText(tier1)} lei), dar cu veniturile neimpozabile de la art. 93 și 105 ` +
      `(${leiText(neimpozabil)} lei, excluse din cumulare de art. 170 alin. (5)) totalul realizat atinge ` +
      '6 salarii minime brute. Citește A: testul se face la nivelul VENITULUI realizat, deci diferența de ' +
      'la art. 174 alin. (6) nu se datorează. Citește B: testul se face la nivelul BAZEI de calcul al ' +
      'contribuției („pentru care datorează contribuția … la un nivel cel puțin egal cu 6 salarii minime ' +
      'brute”), iar o contribuție de 10 % nu poate egala niciodată 6 salarii minime, deci „nivelul” ' +
      'semnifică baza — iar baza aici lipsește, pentru că art. 170 alin. (2) nu se aplică deloc. Nicio ' +
      'interpretare oficială nu hotărăște între cele două (research/41 §7.6).';
  }
  // ── B-112 STAGE 4 — CASS reținută la sursă: art. 174¹ alin. (3)-(9), în numerotarea de după OUG 128/2024 ──
  // The refusal that used to stand here is DELETED, not left dormant — the same standard `exactBani` and
  // `leiFromDecimal` were held to when B-118 closed. It existed because the credit was not modelled: the app
  // could either charge the contribution twice or refuse. Now the triple is computed — `datorată` /
  // `reținută` / `de plătit` — and ANAF's own literal reproduces: „Avem CASS reținută de plătitorul de venit
  // din drepturi de proprietate intelectuală = 4.860 lei • Rezultă o diferență de plată = 9.720 – 4.860 =
  // 4.860 lei.” (research/50, ANAF DGRFP București, Exemplul 3.)
  // ── B-112 STAGE 4 / B-122 — CASS reținută la sursă: art. 174¹ alin. (3)-(9), pe TREI surse ──
  // The refusal that used to stand here is DELETED, not left dormant — the same standard `exactBani` and
  // `leiFromDecimal` were held to when B-118 closed. It existed because the credit was not modelled: the app
  // could either charge the contribution twice or refuse. Now the triple is computed — `datorată` /
  // `reținută` / `de plătit` — and ANAF's own literal reproduces: „Avem CASS reținută de plătitorul de venit
  // din drepturi de proprietate intelectuală = 4.860 lei • Rezultă o diferență de plată = 9.720 – 4.860 =
  // 4.860 lei.” (research/50, ANAF DGRFP București, Exemplul 3.)
  //
  // B-122: the derivation no longer takes the DPI leg alone. art. 174¹ alin. (3) names three sources whose
  // plătitor withholds, and `cassWithheldForLadder` resolves across them.
  const withholding = cassWithheldForLadder(
    amounts,
    ladder?.cassRetinutLaSursa,
    dpiExcluded,
    [tier1, tier2, tier3],
    ratePercent,
  );
  const withheld = withholding.outcome;

  const breakdown = [
    `venit cumulat din art. 155 alin. (1) lit. c)-h), măsurat potrivit art. 170 alin. (4): ${leiText(cumulated)} lei`,
    ...CASS_LADDER_CATEGORIES.map((c) => `${CASS_LADDER_CATEGORY_NAMES[c]}: ${leiText(amounts[c] as Bani)} lei`),
    `treapta aleasă: ${rung} — art. 170 alin. (2)-(4); intervalele sunt inclusive la limita de jos`,
    base === lei(0)
      ? typeof conditionPrecedent === 'string'
        ? `${conditionPrecedent}`
        : 'sub 6 salarii minime brute cumulate nu se datorează deloc CASS pentru aceste categorii — art. 170 alin. (2) este o condiție prealabilă, nu o cotă'
      : `baza anuală de calcul: ${leiText(base)} lei — art. 170 alin. (3); CASS = ${leiText(base)} × ${ratePercent / 100} = ${leiText(value)} lei — art. 174¹ alin. (1)`,
    'o SINGURĂ bază pentru întreaga persoană, nu câte una per categorie: art. 170 alin. (3) vorbește despre „baza anuală de calcul” a „persoanelor”, iar art. 174¹ alin. (1) aplică 10 % la acea bază — la fel cum subsecțiunea 2.2 din Declarația Unică are șase rânduri care alimentează un singur total',
    'plafonul de 72 SM din art. 170 alin. (1) NU se aplică acestui bazin: el mărginește venitul din art. 155 alin. (1) lit. b), nu cumularea de la lit. c)-h)',
    'venitul net al PFA nu intră în acest cumul, iar acest cumul nu intră în plafonul de 72 SM — cele două căi nu se întâlnesc nicăieri',
  ];
  if (dpiExcluded) {
    breakdown.push(
      `venitul din drepturi de proprietate intelectuală de ${leiText(dpiAmount as Bani)} lei este CONSEMNET, dar NU intră în cumularea de la art. 170 alin. (4): persoana realizează venituri din salarii și asimilate salariilor și/sau din pensii, iar art. 154 alin. (1) lit. h¹) o exceptează de la CASS pentru veniturile din drepturi de proprietate intelectuală (research/48 §11.3; extinsă la pensionari prin Legea 141/2025 art. II pct. 17, în vigoare de la 1 aug 2025).`,
      'excepția privește DOAR această categorie: celelalte cinci se cumulează în continuare, iar venitul din activitate independentă (art. 155 alin. (1) lit. b)) nu este atins de ea — cele două căi CASS nu se întâlnesc nicăieri',
      'NOTĂ (LITERA NEVERIFICATĂ): consolidările nu cad de acord dacă această excepție este la art. 154 alin. (1) lit. h) sau lit. h¹); conținutul operativ este același (research/48, întrebarea deschisă 3). Aplicația citește h¹) și nu prezintă litera ca pe un fapt stabilit.',
    );
  }
  if (dpiExempt === 'unknown' && dpiAmount !== undefined && dpiAmount > 0) {
    breakdown.push(
      `NOTĂ (EXCEPȚIE NESTABILITĂ): profilul nu consemnează cu certitudine că persoana a realizat venituri din salarii și asimilate salariilor și/sau din pensii în acest an fiscal, deci excepția de la art. 154 alin. (1) lit. h¹) nu a fost acordată. Venitul din DPI a fost cumulat; absența faptei nu este o dovadă contrară, ci o excepție pe care aplicația nu o poate stabili.`,
    );
  }
  if (neimpozabil > 0) {
    breakdown.push(
      `venituri neimpozabile consemnate (art. 93 și 105): ${leiText(neimpozabil)} lei — art. 170 alin. (5): „La încadrarea în plafonul prevăzut la alin. (4) nu se iau în calcul veniturile neimpozabile, prevăzute la art. 93 și 105.” Consemnate, nu adunate.`,
    );
  }
  if (ladder?.cassRetinutLaSursa !== undefined && ladder.cassRetinutLaSursa > 0) {
    breakdown.push(
      `CASS reținută la sursă (art. 174¹ alin. (3)-(5)): ${leiText(ladder.cassRetinutLaSursa)} lei — se deduce din contribuția datorată (alin. (6), rd. 6 din subsecțiunea 2.2 a Declarației Unice), nu se adaugă.`,
    );
  }

  // ── B-112 stage 4 — the CASS triple, for this limb only ──────────────────────────────────────
  // Limb 1 (art. 170 alin. (1), `calcCass`) is NOT part of this triple and never joins it: art. 174¹ reaches
  // the art. 155 alin. (1) lit. c)-h) basin, and no payer withholds CASS on the PFA's own net. A person with
  // both limbs has two CASS figures, and ANAF's Exemplul 3 prints both (6.800 lei and 9.720 lei).
  if (withheld !== undefined) {
    const payable = payableAfterWithholding(value, withheld.retinut, 'cass');
    breakdown.push(withheld.note);
    if (withheld.bazaRetinuta !== undefined && withheld.bazaRetinuta < base) {
      breakdown.push(
        `art. 174¹ alin. (6): contribuția a fost reținută pe o bază sub cea anuală — ${leiText(withheld.bazaRetinuta)} lei ` +
          `reținut împotriva unei baze de ${leiText(base)} lei; baza mai mare se stabilește prin Declarația ` +
          'Unică, iar „contribuția reținută … este luată în calcul” (rd. 6 din subsecțiunea 2.2).',
      );
    }
    breakdown.push(
      `CASS pe veniturile din art. 155 alin. (1) lit. c)-h): datorată ${leiText(value)} lei • reținută la sursă ${leiText(withheld.retinut)} lei • de plătit ${leiText(payable.dePlatit)} lei`,
    );
    if (payable.note) breakdown.push(payable.note);
    breakdown.push(
      'art. 174¹ alin. (9): pentru celelalte venituri din art. 155 alin. (1) lit. c)-h) se depune Declarația Unică, în afară de cazul în care suma reținută este egală cu cea datorată; art. 174¹ alin. (7): plătitorul emite, la cerere, „o informare cu privire la nivelul contribuției … reținute”. Suma de mai sus este derivată din cuantumul sursei, nu dintr-un registru al plăților — aplicația nu deține unul.',
    );
  } else {
    breakdown.push(
      'NOTĂ (REȚINERE NESTABILITĂ): aplicația nu deține cuantumul niciunei surse al cărei plătitor ar reține CASS, deci nu raportează nicio sumă reținută și nici nu susține că nu a reținut nimeni nimic. CASS datorată rămâne cifra de mai sus.',
    );
  }
  breakdown.push(...withholding.notes);

  return {
    value,
    ...(withheld === undefined
      ? {}
      : {
          retinutLaSursa: withheld.retinut,
          dePlatit: payableAfterWithholding(value, withheld.retinut, 'cass').dePlatit,
        }),
    // The base travels rather than being re-derived by the caller: the art. 174 alin. (7) lit. b) test
    // compares THIS number to 6 SM, and a quantity recomputed at the call site is a quantity that can
    // disagree with the figure it sits beside.
    determinedNet: base,
    ...(readingDivergence ? { readingDivergence } : {}),
    breakdown,
  };
}

function calcIncomeTax(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const baseRatePercent = paramNumber(rule, 'base_rate'); // unscaled integer percent
  const base = input?.base;
  if (typeof base !== 'number') {
    return { reviewRequired: true, reason: 'No base provided for income tax calculation' };
  }
  // CF art. 66 proper — this is the sum the article actually governs. One rounding, here.
  const tax = roundArt66(applyRateDecimal(base, baseRatePercent));
  return {
    value: tax,
    breakdown: [
      `base: ${leiText(base)} lei`,
      `income tax = ${leiText(base)} x ${baseRatePercent / 100} = ${leiText(tax)} lei (10% base rate)`,
      // The 16% "surcharge" note was removed (Phase 5 — the cleanup named in defect B-4's "Fixed in"
      // cell): CF art. 115 alin. (1) lit. b)
      // applies 16% only to art. 114 alin. (2) lit. h)/i) "alte venituri", and art. 114 alin. (1)
      // confines that category to incomes NOT under art. 61 lit. a)-h). PFA sistem real income is
      // art. 61 lit. a) / art. 68, so it is outside art. 114 entirely and takes the flat 10% of
      // art. 123 alin. (1). There is no second rate for this entity type and nothing to review.
      'CF art. 123 alin. (1): cota de 10% se aplica asupra venitului net anual impozabil determinat potrivit art. 118; nu exista cota progresiva pentru venitul din art. 68 (art. 114 alin. (1), art. 115 alin. (1) lit. b))',
    ],
  };
}

/**
 * PG-6h-1 — CF art. 68^3: the flat-ratio determination method for `prestarea de servicii de cazare`,
 * introduced by Legea nr. 239/2025 art. XII pct. 5 and applicable from FY2026 incomes.
 *
 * The arithmetic is two multiplications and nothing else:
 *
 *   venitul net = venitul brut − 30 % × venitul brut = 70 % × venitul brut   — alin. (2)
 *   impozitul   = 10 % × venitul net, „impozitul fiind final"                — alin. (6)
 *
 * **The 30 % is an expense ratio, not a tax rate.** Applying it as a rate to gross would produce a figure
 * roughly ten times too small and is the single most likely way to get this rule wrong. The net is what
 * is left after the deemed expense, and the 10 % runs on the net, which is why the effective burden is
 * 7 % of gross — and why it stays 7 %: „impozitul fiind final" means CAS and CASS are NOT deducted from
 * this base, unlike art. 123 alin. (1) + art. 118 alin. (2) where they are.
 *
 * **What this calculator does NOT do, on purpose.** It takes the gross as an input and returns a net and
 * a tax. It does not decide what the gross contains. art. 68^3 alin. (3) excludes from gross „comisionul
 * reținut de către entitățile care facilitează închirierea pe termen scurt a camerelor situate în
 * locuințe proprietate personală”, but the words are limited to personal dwellings while alin. (1) puts
 * the article's subject in the hands of a tourism-sector operator, and no primary source reconciles them
 * (B-80, `docs/ai/research/38_art68x3_cass_and_occupancy_order.md` §3). The choice moves gross, therefore
 * the tax, the CASS base and the CAS threshold. So the choice is not made here: the gross arrives as an
 * input, and the caller that cannot settle it refuses rather than picking a reading.
 *
 * It also does not prorate anything. art. 68^3 alin. (5) makes a fraction-of-year amount the annual
 * amount, and art. 151 alin. (2) keeps the 12/24-SM and 6/72-SM figures whole for a mid-year taxpayer.
 *
 * Rounding follows the house boundary: art. 66 rounds the sums that are DUE, so the tax is
 * rounded once here; the net is a BASE, and an inexact base is reported, never repaired — the same
 * discipline `exactBani` applies to a prorated deduction in `tax.ts`.
 */
function calcAccommodationFlatRatio(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const expenseRatioPercent = paramNumber(rule, 'expense_ratio'); // unscaled integer percent
  const taxRatePercent = paramNumber(rule, 'tax_rate'); // unscaled integer percent
  const gross = input?.gross;
  if (typeof gross !== 'number') {
    return {
      reviewRequired: true,
      reason:
        'art. 68^3 alin. (2): cota forfetară se aplică asupra venitului brut, iar niciun venit brut nu a fost ' +
        'furnizat. Fără brut nu există bază de calcul — aplicația refuză în loc să presupună unul.',
    };
  }
  if (gross < 0) {
    return {
      reviewRequired: true,
      reason: `art. 68^3: venitul brut nu poate fi negativ; s-a primit ${leiText(gross)} lei.`,
    };
  }

  // One multiplication, not a subtraction of two separately-derived halves: `gross − 30 % × gross` and
  // `70 % × gross` are the same law, but the first form can leave the deemed expense and the net
  // disagreeing by a ban if either side is ever rounded on the way.
  const netDec = applyRateDecimal(gross, 100 - expenseRatioPercent);
  if (!netDec.isInteger()) {
    return {
      reviewRequired: true,
      reason:
        `art. 68^3 alin. (2): venitul net rezultat din ${leiText(gross)} lei × ${(100 - expenseRatioPercent) / 100} ` +
        'nu este un număr întreg de bani. art. 66 rotește sumele datorate, nu bazele, deci ' +
        'aplicația nu rotunjește o bază ca să obțină un număr rotund — raportează în schimb.',
    };
  }
  const net = netDec.toNumber() as Bani;
  // CF art. 66 — the one rounding, on the sum that is due.
  const tax = roundArt66(applyRateDecimal(net, taxRatePercent));

  const filingDeadline = paramValue(rule, 'filing_deadline');
  const paymentDeadline = paramValue(rule, 'payment_deadline');
  const breakdown = [
    `venit brut (art. 68^3 alin. (2), încasate în cursul anului fiscal): ${leiText(gross)} lei`,
    `cheltuieli forfetare = ${expenseRatioPercent}% din venitul brut = ${leiText(subBani(gross, net))} lei — art. 68^3 alin. (2)`,
    `venit net = ${leiText(gross)} × ${(100 - expenseRatioPercent) / 100} = ${leiText(net)} lei`,
    `impozit = ${leiText(net)} × ${taxRatePercent / 100} = ${leiText(tax)} lei — art. 68^3 alin. (6), „impozitul fiind final"`,
    `povara efectivă = ${taxRatePercent * (100 - expenseRatioPercent) / 100}% din venitul brut; CAS și CASS NU se scad din această bază (impozitul fiind final), spre deosebire de art. 123 alin. (1) cu art. 118 alin. (2)`,
    'venitul net de aici alimentează TESTUL de prag din art. 148 alin. (3) (12 / 24 SM) și este CHIAR baza de calcul CASS din art. 170 alin. (1) (prag 6 SM, plafon 72 SM) — art. 170 alin. (2)-(4) nu se aplică, fiind mărginite la art. 155 alin. (1) lit. c)-h)',
    'art. 68^3 alin. (11): impozitul pe venit este delimitat la acest venit; contribuțiile se cumulează cu celelalte venituri din art. 155 alin. (1) lit. b)',
    'art. 68^3 alin. (4): veniturile în valută se convertesc la cursul BNR din ultima zi bancară anterioară fiecărei încasări — nu media anuală, nu cursul de la sfârșitul anului',
    'art. 68^3 alin. (5): o fracțiune de an este considerată venit anual; nimic de aici nu este proratat',
  ];
  if (typeof filingDeadline === 'string') {
    breakdown.push(`depunerea declarației unice: ${filingDeadline} — art. 68^3 alin. (9) cu art. 122 alin. (3), nu art. 121`);
  }
  if (typeof paymentDeadline === 'string') {
    breakdown.push(`plata: ${paymentDeadline} — art. 68^3 alin. (10) cu art. 122 alin. (3), nu art. 121`);
  }
  return { value: tax, determinedNet: net, breakdown };
}

/**
 * B-88 — CF art. 85: the 1–7 room short-term letting of rooms in a personal dwelling.
 *
 * This is a SEPARATE calculator from `calcAccommodationFlatRatio`, and the reason is not style. The two
 * articles happen to state the same 30 % and the same 10 %, and that coincidence is exactly what makes
 * reusing one calculator the tempting wrong answer: what differs is everything around the arithmetic.
 *
 *   - **The gross is measured differently.** art. 85 alin. (2) takes „sumele … încasate în cursul anului
 *     fiscal” — cash basis — while ordinary rent takes the contract rent „indiferent de momentul
 *     încasării” (art. 84 alin. (1)-(2)). art. 85 alin. (3) puts the retained platform commission outside
 *     the gross, which is a reduction of the gross, not a cost deducted after the 30 %: netting it after
 *     the ratio produces a different number, and this calculator has no commission parameter for exactly
 *     that reason.
 *   - **The net goes to a different basin.** art. 68^3 income is art. 155 alin. (1) lit. b) and is measured
 *     under art. 170 alin. (1) (capped at 72 SM). art. 85 income is lit. e) and feeds the cumul at art. 170
 *     alin. (4) lit. c), where the base is the RUNG (6 / 12 / 24 SM, alin. (3)), not the net. No CAS.
 *   - **The citations differ, and a shared calculator would have to print the wrong ones.**
 *
 * It does not prorate anything: art. 85 alin. (5) makes a fraction-of-year amount the annual amount.
 *
 * Rounding follows the house boundary: art. 66 rounds the sums that are DUE, so the tax is
 * rounded once here; the net is a BASE, and an inexact base is reported, never repaired.
 */
function calcShortTermRoomsFlatRatio(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const expenseRatioPercent = paramNumber(rule, 'expense_ratio'); // unscaled integer percent
  const taxRatePercent = paramNumber(rule, 'tax_rate'); // unscaled integer percent
  const gross = input?.gross;
  if (typeof gross !== 'number') {
    return {
      reviewRequired: true,
      reason:
        'art. 85 alin. (2): cota forfetară de 30 % se aplică asupra venitului brut, iar niciun venit brut ' +
        'nu a fost furnizat. Fără brut nu există bază de calcul — aplicația refuză în loc să presupună unul.',
    };
  }
  if (gross < 0) {
    return {
      reviewRequired: true,
      reason: `art. 85: venitul brut nu poate fi negativ; s-a primit ${leiText(gross)} lei.`,
    };
  }

  // One multiplication, not a subtraction of two separately-derived halves — the same discipline as the
  // 68^3 calculator, for the same reason: the deemed expense and the net must not be able to disagree by
  // a ban.
  const netDec = applyRateDecimal(gross, 100 - expenseRatioPercent);
  if (!netDec.isInteger()) {
    return {
      reviewRequired: true,
      reason:
        `art. 85 alin. (2): venitul net rezultat din ${leiText(gross)} lei × ${(100 - expenseRatioPercent) / 100} ` +
        'nu este un număr întreg de bani. art. 66 rotește sumele datorate, nu bazele, deci ' +
        'aplicația nu rotunjește o bază ca să obțină un număr rotund — raportează în schimb.',
    };
  }
  const net = netDec.toNumber() as Bani;
  // CF art. 66 — the one rounding, on the sum that is due.
  const tax = roundArt66(applyRateDecimal(net, taxRatePercent));

  const filingDeadline = paramValue(rule, 'filing_deadline');
  const paymentDeadline = paramValue(rule, 'payment_deadline');
  const breakdown = [
    `venit brut (art. 85 alin. (2): sumele încasate în cursul anului fiscal): ${leiText(gross)} lei`,
    'venitul brut este pe ÎNCASĂRI, nu pe contract: art. 84 alin. (1)-(2) („indiferent de momentul încasării”) guvernează închirierea obișnuită, nu aceasta',
    `cheltuieli forfetare = ${expenseRatioPercent}% din venitul brut = ${leiText(subBani(gross, net))} lei — art. 85 alin. (2). Pentru celelalte venituri din cedarea folosinței bunurilor cota rămâne 20 % (art. 84 alin. (3))`,
    `venit net = ${leiText(gross)} × ${(100 - expenseRatioPercent) / 100} = ${leiText(net)} lei`,
    `impozit = ${leiText(net)} × ${taxRatePercent / 100} = ${leiText(tax)} lei — art. 85 alin. (6), „impozitul fiind final”`,
    'comisionul reținut de platformă nu intră în venitul brut deloc (art. 85 alin. (3)) — este o reducere a brutului, nu o cheltuială dedusă după forfetar; dacă ar fi scăzut după cota de 30 %, cifra ar fi alta',
    'art. 85 alin. (4): sumele în valută se convertesc la cursul BNR din ultima zi bancară anterioară încasării',
    'art. 85 alin. (5): o fracțiune de an este considerată venit anual; nimic de aici nu este proratat',
    'venitul net de aici alimentează CUMULAREA din art. 170 alin. (4) lit. c) (cedarea folosinței bunurilor, art. 155 alin. (1) lit. e)), iar baza pe care o alege este TREAPTA de 6 / 12 / 24 SM — art. 170 alin. (3). Nu este baza de la art. 170 alin. (1), care mărginește la 72 SM venitul din art. 155 alin. (1) lit. b); CAS nu se datorează pe acest venit',
    'un PFA cu venituri din activitate independentă și închiriere de 1–7 camere are două calcule CASS paralele, nu o singură scară: alin. (1) pe lit. b) și alin. (2)-(4) pe lit. c)-h)',
  ];
  if (typeof filingDeadline === 'string') {
    breakdown.push(
      `depunerea declarației unice: ${filingDeadline} — art. 85 alin. (10) cu art. 122 alin. (3). Faptul că impozitul este final nu scutește de declarație: art. 122 alin. (6) lit. a) scutește numai impozitul reținut la sursă, iar aici impozitul este stabilit de contribuabil`,
    );
  }
  if (typeof paymentDeadline === 'string') {
    breakdown.push(
      `plata: ${paymentDeadline} — art. 85 alin. (11) cu art. 123 alin. (7) și art. 122 alin. (3), integral la bugetul de stat`,
    );
  }
  return { value: tax, determinedNet: net, breakdown };
}

/**
 * B-105 — CF art. 84: ordinary *cedarea folosinței bunurilor*, self-assessed.
 *
 * A separate calculator from `calcShortTermRoomsFlatRatio`, for the same reason that one is separate from
 * `calcAccommodationFlatRatio`: the percentages overlap and nothing else does. Here the ratio is **20 %**
 * (alin. (3)), not 30 %, and the rate is 10 % of the net under **art. 123 alin. (2)** — a different article
 * from the one that sets the ratio. The tax is NOT final: the taxpayer establishes it through the
 * Declarația Unică (art. 122 alin. (3)) and pays it by the same date (art. 123 alin. (7)).
 *
 * What the caller hands in is the **accrual** gross — the rent the contract stipulates for the fiscal year,
 * „indiferent de momentul încasării” (alin. (1)-(2)), already increased by the costs legally the owner's
 * that the tenant paid (alin. (1) last sentence) and already converted at the *curs mediu anual* of the
 * realisation year (alin. (3^1)). This calculator does not choose any of that; it applies the ratio to the
 * gross it is given, and the gross rule is what separates this from art. 84^1 and art. 85.
 *
 * Rounding follows the house boundary: art. 66 rounds the sums that are DUE, so the tax is
 * rounded once here; the net is a BASE, and an inexact base is reported, never repaired.
 */
function calcCedareArt84FlatRatio(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const expenseRatioPercent = paramNumber(rule, 'expense_ratio'); // unscaled integer percent
  const taxRatePercent = paramNumber(rule, 'tax_rate'); // unscaled integer percent
  const gross = input?.gross;
  if (typeof gross !== 'number') {
    return {
      reviewRequired: true,
      reason:
        'art. 84 alin. (3): cota forfetară de 20 % se aplică asupra venitului brut, iar niciun venit brut nu a ' +
        'furnizat. Pentru acest regim brutul este chiria prevăzută în contract pentru anul fiscal — nu sumele ' +
        'încasate — deci aplicația refuză în loc să pună la loc încasările registrului.',
    };
  }
  if (gross < 0) {
    return {
      reviewRequired: true,
      reason: `art. 84: venitul brut nu poate fi negativ; s-a primit ${leiText(gross)} lei.`,
    };
  }

  const netDec = applyRateDecimal(gross, 100 - expenseRatioPercent);
  if (!netDec.isInteger()) {
    return {
      reviewRequired: true,
      reason:
        `art. 84 alin. (3): venitul net rezultat din ${leiText(gross)} lei × ${(100 - expenseRatioPercent) / 100} ` +
        'nu este un număr întreg de bani. art. 66 rotește sumele datorate, nu bazele, deci ' +
        'aplicația nu rotunjește o bază ca să obțină un număr rotund — raportează în schimb.',
    };
  }
  const net = netDec.toNumber() as Bani;
  const tax = roundArt66(applyRateDecimal(net, taxRatePercent));

  const filingDeadline = paramValue(rule, 'filing_deadline');
  const paymentDeadline = paramValue(rule, 'payment_deadline');
  const breakdown = [
    `venit brut (art. 84 alin. (1)-(2): chiria stabilită potrivit contractului pentru anul fiscal, indiferent de momentul încasării): ${leiText(gross)} lei`,
    'brutul include majorarea din art. 84 alin. (1) ultima propoziție — cheltuielile care cad în sarcina proprietarului dar sunt efectuate de cealaltă parte contractantă. Se adaugă ÎNAINTE de cota forfetară: cota este procent din brut, deci ordinea schimbă netul',
    `cheltuieli forfetare = ${expenseRatioPercent}% din venitul brut = ${leiText(subBani(gross, net))} lei — art. 84 alin. (3). Aceasta este cota pentru închirierea obișnuită; 30 % aparține exclusiv închirierii pe termen scurt de 1–7 camere (art. 85 alin. (2))`,
    `venit net = ${leiText(gross)} × ${(100 - expenseRatioPercent) / 100} = ${leiText(net)} lei`,
    `impozit = ${leiText(net)} × ${taxRatePercent / 100} = ${leiText(tax)} lei — art. 123 alin. (2). Cota stă în alt articol decât cota forfetară, și impozitul NU este final: contribuabilul și-l stabilește singur`,
    'art. 84 alin. (3^1): chiria în valută se evaluează la cursul de schimb MEDIU ANUAL comunicat de BNR din anul de realizare a venitului — nu ultima zi bancară (art. 85 alin. (4)), nu ziua precedentă plății (art. 84^1 alin. (2))',
    'venitul net alimentează CUMULAREA din art. 170 alin. (4) lit. c) — textul FY2026 spune „stabilite potrivit art. 84-85”, plajă care acoperă art. 84, art. 84^1 și art. 85 — iar baza este TREAPTA de 6 / 12 / 24 SM (art. 170 alin. (3)). Nu este baza de la art. 170 alin. (1), care mărginește la 72 SM venitul din lit. b); CAS nu se datorează pe acest venit',
    'art. 84 alin. (10): fără Registrul de evidență fiscală și fără evidență contabilă — nicio obligație de evidență nu se generează pentru acest regim',
  ];
  if (typeof filingDeadline === 'string') {
    breakdown.push(
      `depunerea declarației unice: ${filingDeadline} — art. 122 alin. (3). Spre deosebire de art. 84^1, aici impozitul nu este reținut la sursă, deci scutirea de la art. 122 alin. (6) lit. a) nu se aplică`,
    );
  }
  if (typeof paymentDeadline === 'string') {
    breakdown.push(`plata: ${paymentDeadline} — art. 123 alin. (7), același termen cu depunerea`);
  }
  return { value: tax, determinedNet: net, breakdown };
}

/**
 * B-105 — CF art. 84^1: the same 20 % and the same 10 %, in the regime where the tax never reaches the
 * landlord's hands.
 *
 * The arithmetic looks identical to art. 84 and is not the same quantity: alin. (3) fixes the net „la
 * fiecare plată, de către plătitorii de venit”, not once for the fiscal year. art. 84^1 alin. (1) omits the
 * „pentru fiecare an fiscal, indiferent de momentul încasării” clause art. 84 alin. (1) carries, and that
 * omission is the regime. The ratio is linear, so the sum of the per-payment nets equals the ratio applied
 * to the sum of the payments — but only while each payment's own net is a whole number of bani. Where it
 * is not, this calculator reports rather than inventing a per-payment rounding rule the article does not
 * state.
 *
 * What this calculator does NOT do is decide whether the landlord owes a Declarația Unică. alin. (5)-(6)
 * make the withheld tax final and alin. (4) puts the calculation, the withholding, the declaration and the
 * remittance on the payer — but art. 122 alin. (6) lit. a) exempts the return only for the income tax, and
 * art. 122 alin. (7) still requires one where CAS or CASS is owed, and CASS on ordinary rent is not
 * withheld (art. 174^1 alin. (3) covers only DPI, arendă and asocieri). That split is the caller's, and it
 * is the part most implementations miss.
 */
function calcCedareArt84x1Withheld(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const expenseRatioPercent = paramNumber(rule, 'expense_ratio'); // unscaled integer percent
  const taxRatePercent = paramNumber(rule, 'tax_rate'); // unscaled integer percent
  const gross = input?.gross;
  if (typeof gross !== 'number') {
    return {
      reviewRequired: true,
      reason:
        'art. 84^1 alin. (3): venitul net se stabilește la fiecare plată prin deducerea a 20 % din venitul ' +
        'brut, iar niciun venit brut nu a fost furnizat. Aplicația refuză în loc să presupună unul.',
    };
  }
  if (gross < 0) {
    return {
      reviewRequired: true,
      reason: `art. 84^1: venitul brut nu poate fi negativ; s-a primit ${leiText(gross)} lei.`,
    };
  }

  const netDec = applyRateDecimal(gross, 100 - expenseRatioPercent);
  if (!netDec.isInteger()) {
    return {
      reviewRequired: true,
      reason:
        `art. 84^1 alin. (3): venitul net rezultat din ${leiText(gross)} lei × ${(100 - expenseRatioPercent) / 100} ` +
        'nu este un număr întreg de bani. Netul se stabilește la fiecare plată, iar aplicația nu inventează o ' +
        'regulă de rotunjire per plată pe care alineatul nu o scrie — raportează în schimb.',
    };
  }
  const net = netDec.toNumber() as Bani;
  const tax = roundArt66(applyRateDecimal(net, taxRatePercent));

  const remittance = paramValue(rule, 'payer_remittance_deadline');
  const breakdown = [
    `venit brut al plăților din an (art. 84^1 alin. (1): sumele stabilite potrivit contractului, plus majorarea cu cheltuielile proprietarului plătite de cealaltă parte): ${leiText(gross)} lei`,
    'netul se stabilește LA FIECARE PLATĂ, de către plătitorii de venit (alin. (3)) — nu o dată pentru anul fiscal ca la art. 84 alin. (3), și nu pe încasările anului ca la art. 85 alin. (2). Cota fiind liniară, totalul neturilor per plată este egal cu cota aplicată totalului atâta vreme cât fiecare plată dă un număr întreg de bani; când nu dă, aplicația raportează',
    `cheltuieli forfetare = ${expenseRatioPercent}% din venitul brut = ${leiText(subBani(gross, net))} lei — art. 84^1 alin. (3)`,
    `venit net = ${leiText(gross)} × ${(100 - expenseRatioPercent) / 100} = ${leiText(net)} lei`,
    `impozit reținut = ${leiText(net)} × ${taxRatePercent / 100} = ${leiText(tax)} lei — art. 84^1 alin. (5)-(6), reținut la momentul plății, impozit FINAL. Nu se achită de contribuabil și nu se mai recalculează`,
    'art. 84^1 alin. (2): sumele în valută se convertesc la cursul BNR din ZIUA PRECEDENTĂ plății — nu media anuală (art. 84 alin. (3^1)), nu ultima zi bancară anterioară încasării (art. 85 alin. (4))',
    'art. 84^1 alin. (4): plătitorul calculează, reține, declară și virează impozitul, și la cerere emite un document care atestă impozitul reținut și virat — proprietarul are dreptul la acel document',
    'FAPTUL PE CARE MULTE IMPLEMENTĂRI ÎL RATĂZĂ: „reținut și final” nu înseamnă „nu ai nimic de depus”. art. 122 alin. (6) lit. a) scutește declarația numai pentru impozitul pe venit; art. 122 alin. (7) cere declarația unică și celor cu impozit reținut care datorează CAS/CASS, iar pe chiria obișnuită CASS nu se reține la sursă (art. 174^1 alin. (3) acoperă numai DPI, arendă și asocieri). Rămâne deci o declarație pentru contribuții',
    'art. 84^1 alin. (8): dacă venitul brut se plătește exclusiv în natură, sau o garanție contractuală este utilizată pentru plata chiriei, reținerea nu se aplică — proprietarul își determină singur netul, își calculează impozitul și depune Declarația Unică până la termenul din art. 122 alin. (3)',
    'venitul net alimentează cumularea din art. 170 alin. (4) lit. c) („stabilite potrivit art. 84-85”), iar baza este treapta de 6 / 12 / 24 SM — faptul că impozitul pe venit a fost achitat de plătitor nu scoate venitul din cumul',
    'art. 84^1 alin. (7): fără Registrul de evidență fiscală și fără evidență contabilă — nicio obligație de evidență nu se generează pentru acest regim',
  ];
  if (typeof remittance === 'string') {
    breakdown.push(
      `virarea de către plătitor: până la 25 inclusiv a lunii următoare celei în care impozitul a fost reținut (art. 84^1 alin. (6)) — termen al plătitorului, lunar, nu termenul utilizatorului; ${remittance} este un exemplu, nu o dată fixă a acestui regim`,
    );
  }
  return { value: tax, determinedNet: net, breakdown };
}

/**
 * B-112 STAGE 1 — CF art. 72 / art. 72¹: the DPI flat quota, and the final tax on the net it leaves.
 *
 * The arithmetic is the same two multiplications as every other flat-ratio calculator here, and the reason
 * it is a separate calculator with a separate rule is the same as the reason art. 85 is separate from
 * art. 68^3 and art. 84^1 is separate from art. 84: the **percentages are different and nothing about the
 * regime is shared**. Here the quota is **40 %** (art. 72 alin. (2), art. 72¹ alin. (1)) — not the 20 % of
 * art. 84/art. 84¹ and not the 30 % of art. 68^3/art. 85 — and the net it leaves is 0,6 × brut.
 *
 * Three things this calculator states, because each is a place the rule gets silently got wrong:
 *
 * 1. **The quota is automatic, not elective.** The payer applies it. What IS elective is the opposite —
 *    art. 73 lets the taxpayer opt into real expenses instead, binding for 2 consecutive fiscal years and
 *    auto-renewing. That election is a recorded fact the caller reads; this calculator only applies the
 *    quota it was asked to apply, and it carries no `election` flag because deciding whether the election
 *    is in force is not this module's question.
 * 2. **CAS and CASS are inside the 40 %, not beside it.** ANAF DGRFP Cluj, 12 Feb 2026: *„În cheltuielile
 *    forfetare se includ, printre altele: contribuțiile sociale datorate…”*. So the contributions the author
 *    owes are already inside the deemed expense, and deducting them again from this net would take the same
 *    leu twice. The art. 118 alin. (2^2)-(2^3) proration belongs to the sistem-real base, not to this one.
 * 3. **The tax is the payer's to withhold, and it is final.** art. 72 alin. (4)-(5): 10 % of the net,
 *    reținut la sursă la momentul plății, virat până la 25 a lunii următoare, *„impozitul fiind final”*. The
 *    effective burden is 6 % of gross. art. 72 alin. (6) switches the withholding off for asocieri fără
 *    personalitate juridică and for entities keeping their own accounting, and then the taxpayer self-assesses
 *    the same 10 % under art. 123 alin. (2). Which of those two applies is a fact about the payer the caller
 *    holds; this calculator returns the sum and the caller decides whose sum it is — exactly the split
 *    `calcCedareArt84x1Withheld` and `tax.ts` already use for art. 84^1 alin. (8).
 *
 * Rounding follows the house boundary: art. 66 rounds the sums that are DUE, so the tax is rounded
 * once here; the net is a BASE, and an inexact base is reported, never repaired.
 */
function calcDpiFlatQuota(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const expenseRatioPercent = paramNumber(rule, 'expense_ratio'); // unscaled integer percent
  const taxRatePercent = paramNumber(rule, 'tax_rate'); // unscaled integer percent
  const gross = input?.gross;
  if (typeof gross !== 'number') {
    return {
      reviewRequired: true,
      reason:
        'art. 72 alin. (2) / art. 72^1 alin. (1): cota forfetară de 40 % se aplică asupra venitului brut, iar ' +
        'niciun venit brut din drepturi de proprietate intelectuală nu a fost furnizat. Fără brut nu există ' +
        'bază de calcul — aplicația refuză în loc să presupună unul.',
    };
  }
  if (gross < 0) {
    return {
      reviewRequired: true,
      reason: `art. 72: venitul brut din drepturi de proprietate intelectuală nu poate fi negativ; s-a primit ${leiText(gross)} lei.`,
    };
  }

  // One multiplication, not `gross − 40 % × gross`: the deemed expense and the net must not be able to
  // disagree by a ban, and here they would be read as two different legal quantities.
  const netDec = applyRateDecimal(gross, 100 - expenseRatioPercent);
  if (!netDec.isInteger()) {
    return {
      reviewRequired: true,
      reason:
        `art. 72 alin. (2): venitul net rezultat din ${leiText(gross)} lei × ${(100 - expenseRatioPercent) / 100} ` +
        'nu este un număr întreg de bani. art. 66 rotește sumele datorate, nu bazele, deci ' +
        'aplicația nu rotunjește o bază ca să obțină un număr rotund — raportează în schimb.',
    };
  }
  const net = netDec.toNumber() as Bani;
  const tax = roundArt66(applyRateDecimal(net, taxRatePercent));

  const withholdingDeadline = paramValue(rule, 'withholding_deadline');
  const noWithholding = paramValue(rule, 'no_withholding_cases');
  const insideQuota = paramValue(rule, 'contributions_inside_quota');
  const breakdown = [
    `venit brut din DPI (art. 70; sumele datorate autorului de plătitorul de venit): ${leiText(gross)} lei`,
    `cheltuieli forfetare = ${expenseRatioPercent}% din venitul brut = ${leiText(subBani(gross, net))} lei — art. 72 alin. (2) / art. 72^1 alin. (1). Cota este de 40 %, nu de 20 %: 20 % aparține cedării folosinței bunurilor (art. 84 alin. (2) / art. 84^1 alin. (3))`,
    `venit net = ${leiText(gross)} × ${(100 - expenseRatioPercent) / 100} = ${leiText(net)} lei`,
    `impozit = ${leiText(net)} × ${taxRatePercent / 100} = ${leiText(tax)} lei — art. 72 alin. (1) și (4), „impozitul fiind final”`,
    `povara efectivă = ${taxRatePercent * (100 - expenseRatioPercent) / 100}% din venitul brut`,
    'venitul net din DPI intră în testul de plafon de la art. 148 alin. (3) (CAS, art. 137 alin. (1) lit. b^1)) și în cumularea de la art. 170 alin. (4) lit. a) (CASS, art. 155 alin. (1) lit. c)) — două litere diferite pentru același venit, și cele două căi CASS nu se cumulează niciodată între ele',
  ];
  if (typeof insideQuota === 'string') breakdown.push(insideQuota);
  if (typeof withholdingDeadline === 'string') {
    breakdown.push(`virare de către plătitor: ${withholdingDeadline} — art. 72 alin. (5). Este termenul plătitorului, nu al contribuabilului`);
  }
  if (typeof noWithholding === 'string') breakdown.push(noWithholding);
  return { value: tax, determinedNet: net, breakdown };
}

/**
 * PG-6e — the fiscal depreciation of one asset for one fiscal year.
 *
 * It is a thin wrapper over `depreciationSchedule`, and the reason it exists at all is the house rule that
 * a fiscal figure lives in the rule store and nowhere else: every lei amount and every coefficient this
 * arithmetic uses is a parameter on `FISCAL_DEPRECIATION_2026`, read through `depreciationSchedule`'s own
 * unit-guarded reader. The calculator contributes no number of its own.
 *
 * It deliberately does NOT feed `computeTaxEstimate`. A depreciation is not a payment, so it must not enter
 * the cash-basis register as one, and PG-5C's enforcement that the engine runs on recorded actuals is
 * untouched by this phase. See `docs/ai/phases/43_pg6e_fixed_assets.md`.
 */
function calcFiscalDepreciation(rule: FiscalRule, input?: CalculatorInput): CalculatorResult {
  const asset = input?.fixedAsset;
  if (!asset) {
    return {
      reviewRequired: true,
      reason:
        'art. 28 alin. (12) lit. a): amortizarea se calculează pentru un mijloc fix determinat — cu data ' +
        'intrării în patrimoniu, data punerii în funcțiune, valoarea fiscală și durata stabilită de ' +
        'contribuabil. Fără activul declarat nu există cotă aplicată unei baze.',
    };
  }
  const outcome = depreciationSchedule(rule, asset);
  if (outcome.status === 'review_required') {
    return { reviewRequired: true, reason: outcome.reason };
  }
  const year = input?.fiscalYear;
  const line = year === undefined ? undefined : outcome.years.find((y) => y.fiscalYear === year);
  if (year !== undefined && !line) {
    return {
      reviewRequired: true,
      reason: `Planul de amortizare pentru „${asset.label}” nu are nicio amortizare în anul ${year}.`,
    };
  }
  const target = line ?? outcome.years[0]!;
  return {
    value: target.deductible,
    breakdown: [
      `data intrării în patrimoniu: ${asset.entryDate} — art. 28 alin. (2) lit. b) măsoară pragul aici, nu la plată`,
      `punerea în funcțiune: ${asset.putInFunctionDate ?? 'nu este înregistrată'}`,
      `valoare fiscală de intrare: ${leiText(asset.fiscalValue)} lei${
        asset.nonDeductibleVatIncluded === undefined
          ? ''
          : ` (include TVA devenită nedeductibilă: ${leiText(asset.nonDeductibleVatIncluded)} lei — normele Titlul II pct. 28 lit. b)`
      }`,
      `durata normală de funcționare stabilită de contribuabil: ${asset.normalLifeMonths} luni — normele pct. 27`,
      `amortizare ${target.fiscalYear}: ${target.months} luni, deductibil ${leiText(target.deductible)} lei`,
      ...(target.lost > 0
        ? [`exces peste plafonul de 1.500 lei/lună: ${leiText(target.lost)} lei, pierdut definitiv — art. 28 alin. (14)`]
        : []),
      ...outcome.notes,
    ],
  };
}

function calcVatThreshold(rule: FiscalRule): CalculatorResult {
  const threshold = paramBani(rule, 'threshold');
  return { value: threshold, breakdown: [`VAT threshold: ${leiText(threshold)} lei`] };
}

function calcDeadline(rule: FiscalRule): CalculatorResult {
  const deadline = paramValue(rule, 'deadline');
  if (typeof deadline !== 'string') {
    return {
      reviewRequired: true,
      reason: `Rule ${rule.ruleId} has no date parameter 'deadline'`,
    };
  }
  return { value: lei(0), breakdown: [`deadline: ${deadline}`] };
}

export function computeFiscal(
  release: { rules: FiscalRule[] },
  ruleId: string,
  input?: CalculatorInput,
): CalculatorResult {
  const rule = release.rules.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);
  const fn = calculatorRegistry[rule.calculatorId];
  if (!fn) throw new Error(`No calculator registered for rule: ${ruleId}`);
  return fn(rule, input);
}

export const calculatorRegistry: Record<string, CalculatorFunction> = {
  'calc-wage-reference': calcWageReference,
  'calc-cas': calcCas,
  'calc-cass': calcCass,
  'calc-cass-ladder': calcCassLadder,
  'calc-income-tax': calcIncomeTax,
  'calc-accommodation-flat-ratio': calcAccommodationFlatRatio,
  'calc-short-term-rooms-flat-ratio': calcShortTermRoomsFlatRatio,
  'calc-cedare-art84-flat-ratio': calcCedareArt84FlatRatio,
  'calc-cedare-art84x1-withheld': calcCedareArt84x1Withheld,
  // B-112 stage 1 — the DPI flat quota. Registered beside the other flat-ratio calculators, and deliberately
  // not sharing one with any of them: same 10 % rate as three of them, different quota, different gross
  // rule, different payer duty, different contribution basin.
  'calc-dpi-flat-quota': calcDpiFlatQuota,
  'calc-fiscal-depreciation': calcFiscalDepreciation,
  'calc-vat-threshold': calcVatThreshold,
  'calc-deadline': calcDeadline,
};
