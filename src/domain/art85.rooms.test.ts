/**
 * B-88 — art. 85: închirierea pe termen scurt a 1–7 camere în locuința proprietate personală.
 *
 * The rule (docs/ai/research/44_art85_short_term_rooms_1_7.md, written for this task) is NOT a second copy
 * of art. 68^3. Three of its quantities differ, and each difference is a test below rather than a comment:
 *
 *   venitul brut = încasările din anul fiscal, „încasate în cursul anului fiscal"  — alin. (1), cash basis
 *   venitul net  = venitul brut − 30 % × venitul brut = 70 % × venitul brut        — alin. (2)
 *   impozitul    = 10 % × venitul net, „impozitul fiind final"                     — alin. (4)
 *
 * and the two that decide whether the number is right at all:
 *
 *   the 30 % belongs to THIS income only. art. 84 alin. (3) and art. 84^1 alin. (3) keep 20 % for every
 *     other *cedarea folosinței bunurilor*, and ANAF Cluj states the split in terms. Applying 30 % to rent
 *     income generally would have created a new defect, so the rule is keyed to a method of its own
 *     (`short-term-rooms-flat-ratio`) and nothing else reads its ratio.
 *   the CASS route is the art. 170 alin. (2)-(4) LADDER, not the art. 170 alin. (1) base. *Cedarea
 *     folosinței* is art. 155 alin. (1) lit. e), not lit. b), so the letting net selects a 6/12/24-SM rung
 *     and is never itself the base. The PFA's own art. 68^3 net — if the same person had one — would sit in
 *     the other basin under art. 170 alin. (1). The two ladders must not merge, and one test per direction
 *     says so.
 *
 * Every expected figure was derived BY HAND from those lines and from the FY2026 anchor: SM = 4.050 lei on
 * 1 ianuarie 2026 (HG 1.506/2024, fixed for art. 148/151/170/174 by CF art. 135^1 alin. (3)).
 * 6 SM = 24.300 · 12 SM = 48.600 · 24 SM = 97.200 · 72 SM = 291.600 lei.
 *
 * WHAT THIS FILE DOES NOT PIN: the gross. art. 85 alin. (3) excludes the platform commission from gross,
 * which is settled, but the room-count boundary in the same sentence is broken (research/44 Gaps-1) and
 * whether a PFA may hold this income at all is inference rather than statute (Gaps-3). Both travel as open
 * questions on the rule, so the gross stays an INPUT here — never derived, never defaulted.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate, cumulateContributionBase, type ContributionLeg } from './tax';
import type { TaxInputsReference } from './derived';
import type { PfaProfile, CassLadderYear } from './models';
import type { FiscalRule } from './fiscal/rules';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { lei, type Bani } from './money';
import { selectIncomeDeterminationMethod } from './estimateBasis';
import { computeDeadlines } from './deadlines';
import { accommodationIncomeTitleForYear } from './models';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';

const SM6 = lei(24_300);
const SM12 = lei(48_600);
const SM24 = lei(97_200);

/**
 * The five ladder categories the app cannot compute, declared as zeros.
 *
 * A declared zero is a fact the person gave; an empty box is not, and art. 170 alin. (4) sums across all
 * six litera — that is the B-41 rule, and `calcCassLadder` enforces it. The sixth category,
 * `cedareaFolosinteiBunurilor`, is deliberately left out of every fixture below: it is the one the app now
 * computes from the register, and whether a declared amount and a computed one may meet is its own test.
 */
function ladder(over: Partial<CassLadderYear> = {}): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
      ...over,
    },
  ];
}

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-art85',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    ...over,
  } as PfaProfile;
}

/**
 * `salaryStatus: 'nu'`, no pension receipts and no `cassRetinutLaSursa`: the state of a taxpayer whose only
 * income is the letting. None of the three art. 174 alin. (7) reliefs can fire on those facts, and none is
 * granted here.
 */
function inputs(over: Partial<TaxInputsReference> = {}): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    salaryIncomeLei: null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: ladder(),
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'inregistrat_art316' as const },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-art85:2026',
    ...over,
  };
}

function run(over: {
  gross?: Bani | null;
  method?: 'short-term-rooms-art85' | 'accommodation-flat-ratio' | null;
  revenuesNet?: Bani;
  expensesNet?: Bani;
  ladderYears?: CassLadderYear[];
  rules?: FiscalRule[];
}) {
  const sistemRealGross = over.revenuesNet ?? lei(0);
  const sistemRealExpenseBase = over.expensesNet ?? lei(0);
  return computeTaxEstimate({
    inputs: inputs({ cassLadderYears: over.ladderYears ?? ladder() }),
    profile: profile(),
    revenues: sistemRealGross,
    expenses: sistemRealExpenseBase,
    revenuesNet: sistemRealGross,
    expensesNet: sistemRealExpenseBase,
    expenseBase: {
      netFirst: sistemRealExpenseBase,
      grossFirst: sistemRealExpenseBase,
      divergent: false,
    },
    flatRatioGross: over.gross ?? null,
    flatRatioMethod: over.method ?? 'short-term-rooms-art85',
    ruleRelease: PFA_2026_RELEASE,
    rules: over.rules ?? PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

function line(res: { lines: { label: string; value: Bani }[] }, prefix: string) {
  return res.lines.find((l) => l.label.startsWith(prefix));
}

describe('art. 85 alin. (2) and (4) — the worked example', () => {
  /**
   * A 1–7 room landlord with 100.000 lei of receipts collected during the year, and nothing else:
   *   net   = 70 % × 100.000 = 70.000 lei                        — alin. (2)
   *   tax   = 10 % × 70.000  =  7.000 lei, final                 — alin. (4)
   *   CAS   = 0                                                  — no art. 155 alin. (1) lit. b) source
   *   CASS  = 10 % × 48.600  =  4.860 lei                        — 12-SM rung, art. 170 alin. (3)
   *   total = 11.860 lei
   *
   * The CASS line is where this taxpayer and an art. 68^3 taxpayer part. The same 70.000 lei net is the
   * CASS BASE under art. 68^3 (10 % × 70.000 = 7.000 lei) and only the SELECTOR of a rung under art. 85
   * (70.000 ≥ 12 SM, < 24 SM → base 12 SM). 4.860, not 7.000 — and not 10 % × 24 SM either.
   */
  it('net is 70 % of gross, the tax is 10 % of that net, and CASS rides the 12-SM rung', async () => {
    const res = await run({ gross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;

    expect(line(res, 'Venit brut art. 85')!.value).toBe(lei(100_000));
    expect(line(res, 'Cheltuieli forfetare 30 % (art. 85 alin. (2))')!.value).toBe(lei(30_000));
    expect(line(res, 'Venit net art. 85')!.value).toBe(lei(70_000));
    expect(line(res, 'Impozit art. 85')!.value).toBe(lei(7_000));

    // The two 10× errors this rule invites, stated as negatives: reading the 30 % as a tax rate gives
    // 30.000; reading the 10 % on gross gives 10.000. Neither is 7.000.
    expect(line(res, 'Impozit art. 85')!.value).not.toBe(lei(30_000));
    expect(line(res, 'Impozit art. 85')!.value).not.toBe(lei(10_000));

    expect(line(res, 'CAS (25%)')!.value).toBe(lei(0));
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(4_860));
    expect(res.output.total).toBe(lei(11_860));
  });

  it('the sistem-real register lines are absent, not zero — this taxpayer was not measured that way', async () => {
    const res = await run({ gross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // A zero "Cheltuieli deductibile" line would present a register the person never kept as a register
    // that produced nothing, and a zero art. 123 line would present a determination method that is not
    // theirs. Both are absent.
    expect(line(res, 'Cheltuieli deductibile')).toBeUndefined();
    expect(line(res, 'Venit net din activitate')).toBeUndefined();
    expect(line(res, 'Impozit pe venit')).toBeUndefined();
    expect(line(res, 'Venit net anual impozabil')).toBeUndefined();
    expect(res.lines.filter((l) => l.label.startsWith('Impozit'))).toHaveLength(1);
  });

  it('every figure is parameter-driven — no fiscal value is hard-coded in the calculator', async () => {
    // The house rule: a new number is a rule entry, not a literal. Mutating the two percentages moves both
    // figures, which is the only proof the calculator reads them rather than contains them. It also proves
    // the art. 85 ratio is its OWN parameter: the art. 68^3 rule is untouched below.
    const patched = PFA_2026_SYSTEM_REAL_PACKAGE.map((r) => {
      if (r.ruleId !== 'ACCOMMODATION_ART85_ROOMS_2026') return r;
      return {
        ...r,
        parameters: r.parameters.map((p) => {
          if (p.id === 'expense_ratio') return { ...p, value: 20 };
          if (p.id === 'tax_rate') return { ...p, value: 11 };
          return p;
        }),
      };
    });
    const res = await run({ gross: lei(100_000), rules: patched });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // net = 80 % × 100.000 = 80.000 · tax = 11 % × 80.000 = 8.800
    expect(line(res, 'Venit net art. 85')!.value).toBe(lei(80_000));
    expect(line(res, 'Impozit art. 85')!.value).toBe(lei(8_800));
  });

  it('the rule cites every value it supplies, and names the neighbours it must not be confused with', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'ACCOMMODATION_ART85_ROOMS_2026');
    expect(rule).toBeDefined();
    expect(rule!.sourceArticle).toContain('art. 85 alin. (2)');
    expect(rule!.sourceArticle).toContain('art. 85 alin. (6)');
    // The 20 % neighbour is cited on the ratio itself, so a reader cannot conclude the 30 % is the rent
    // chapter's rate: art. 84 alin. (3) and art. 84^1 alin. (3) were amended in the same act to carve this
    // case out, and every other *cedarea folosinței* keeps 20 %.
    const ratio = String(rule!.parameters.find((p) => p.id === 'expense_ratio')!.description);
    expect(ratio).toContain('art. 84 alin. (3)');
    expect(ratio).toContain('art. 84^1 alin. (3)');
    expect(ratio).toContain('20 %');
    // Deadlines run on art. 122 alin. (3), never art. 121 alin. (1).
    expect(rule!.sourceArticle).toContain('art. 122 alin. (3)');
    expect(rule!.sourceArticle).not.toContain('art. 121 ');
    expect(rule!.parameters.find((p) => p.id === 'filing_deadline')?.value).toBe('2027-05-25');
    // No SM multiple lives here: the 6/12/24 figures are year-scoped on CASS_2026.
    expect(rule!.parameters.some((p) => p.unit === 'lei')).toBe(false);
    // No silent commission switch. Unlike art. 68^3 alin. (3), where the same words carry two readings and
    // the rule carries an open question (B-80), art. 85 alin. (3) sits in an article whose subject IS the
    // letting of a personal dwelling, so it is stated as settled — but as a citation, never as a flag the
    // calculator could flip or an amount it could subtract.
    const commission = rule!.parameters.find((p) => p.id === 'commission_excluded_from_gross');
    expect(commission).toBeDefined();
    expect(typeof commission!.value).toBe('string');
    expect(rule!.parameters.some((p) => typeof p.value === 'boolean')).toBe(false);
    // The two things the research could not settle travel as questions, not as values.
    const exclusion = String(rule!.parameters.find((p) => p.id === 'eligibility_exclusion')!.description);
    // research/44 Gaps-3: no statutory sentence says a PFA may hold this income.
    expect(exclusion).toContain('INFERENȚ');
    // research/44 Gaps-2: the FY2026 return form does not exist yet, so the section is unknown while the
    // deadline is not.
    expect(rule!.parameters.some((p) => p.id === 'form_section_open_question')).toBe(true);
  });
});

describe('the room count selects the article; it does not feed a formula', () => {
  function cazare(over: Partial<AppData['profile']> = {}): AppData {
    return {
      ...seedData,
      profile: { ...seedData.profile, activityFamily: 'cazare', ...over },
    } as AppData;
  }

  it('1–7 rooms, unanswered tourism question, is art. 85', () => {
    // The lower edge first: art. 85 alin. (1) says „între 1 și 7 camere inclusiv”, so a single room is
    // already this title, and the count is a switch rather than a magnitude.
    expect(
      selectIncomeDeterminationMethod(
        cazare({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 1 }] }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('short-term-rooms-art85');
    expect(
      selectIncomeDeterminationMethod(
        cazare({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }] }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('short-term-rooms-art85');
    // The boundary itself: 7 rooms is still 1–7, and art. 83 alin. (4) moves the taxpayer only „peste 7".
    expect(
      selectIncomeDeterminationMethod(
        cazare({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 7 }] }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('short-term-rooms-art85');
  });

  it('a tourism-operator PFA with 3 rooms is under art. 68^3, because art. 85 alin. (1) excludes it', () => {
    // This is the case the brief names first, and the one a room-count-only rule would get wrong.
    expect(
      selectIncomeDeterminationMethod(
        cazare({
          accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 3 }],
          accommodationTourismEligibility: 'da',
        }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('accommodation-flat-ratio');
  });

  it('8 rooms is art. 68^3, and the switch is by fiscal year, not by the month the eighth room appears', () => {
    expect(
      selectIncomeDeterminationMethod(
        cazare({ accommodationRoomCounts: [{ fiscalYear: 2026, rooms: 8 }] }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('accommodation-flat-ratio');
    // art. 83 alin. (4): „începând cu anul fiscal în care numărul camerelor … este de peste 7 camere”.
    // The title is read per fiscal year, by the one resolver the whole app shares — so a year that had 3
    // rooms keeps the cedarea title even when the following year has 8, and the year that has 8 starts
    // under the independent-activity title on 1 ianuarie, whatever month the eighth room was added.
    const twoYears = [
      { fiscalYear: 2026, rooms: 3 },
      { fiscalYear: 2027, rooms: 8 },
    ];
    expect(accommodationIncomeTitleForYear(twoYears, 2026)).toBe('cedarea_folosintei');
    expect(accommodationIncomeTitleForYear(twoYears, 2027)).toBe('activitate_independenta_68x3');
    expect(
      selectIncomeDeterminationMethod(
        cazare({ fiscalYear: 2026, accommodationRoomCounts: twoYears }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('short-term-rooms-art85');
    // FY2027 has no rule set in this build, so no method is manufactured for it — the year-scoping guard,
    // not a statement that the 2026 percentages apply to 2027 as well.
    expect(
      selectIncomeDeterminationMethod(
        cazare({ fiscalYear: 2027, accommodationRoomCounts: twoYears }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2027-12-31',
      ),
    ).toBe('sistem-real');
  });

  it('no room count for the year asserts no title, and nothing is inferred from the activity alone', () => {
    expect(
      selectIncomeDeterminationMethod(cazare({ accommodationRoomCounts: [] }), PFA_2026_SYSTEM_REAL_PACKAGE, '2026-12-31'),
    ).toBe('accommodation-flat-ratio');
    // A count recorded for another year does not decide this one.
    expect(
      selectIncomeDeterminationMethod(
        cazare({ fiscalYear: 2026, accommodationRoomCounts: [{ fiscalYear: 2027, rooms: 3 }] }),
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('accommodation-flat-ratio');
    // A register that is not a cazare register never reaches either flat article.
    expect(
      selectIncomeDeterminationMethod(
        { ...seedData, profile: { ...seedData.profile, activityFamily: 'other' } } as AppData,
        PFA_2026_SYSTEM_REAL_PACKAGE,
        '2026-12-31',
      ),
    ).toBe('sistem-real');
  });

  it('a fiscal year with no art. 85 rule refuses an art. 85 gross instead of measuring it under art. 68^3', async () => {
    // The year-scoping guard. Falling through to the 68^3 rule would be the worst available failure: the
    // two articles share only a percentage, and the CASS basin would be wrong as well as the citation.
    const res = await run({ gross: lei(100_000), rules: PFA_2026_SYSTEM_REAL_PACKAGE.filter((r) => r.ruleId !== 'ACCOMMODATION_ART85_ROOMS_2026') });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 85');
    expect(line(res, 'Impozit art. 85')).toBeUndefined();
    expect(line(res, 'Impozit art. 68^3')).toBeUndefined();
    expect(res.lines).toHaveLength(0);
  });
});

describe('the two flat methods are separate rules, and one register runs one of them', () => {
  it('the same gross under the two methods gives the same income tax and a different CASS', async () => {
    // Same 100.000 lei of receipts. art. 68^3: the net IS the CASS base (art. 170 alin. (1)) → 7.000 lei.
    // art. 85: the net SELECTS the 12-SM rung (art. 170 alin. (2)-(3)) → 4.860 lei. If these two ever come
    // out equal, one of the two basins has been merged into the other.
    const rooms = await run({ gross: lei(100_000) });
    const operator = await run({ gross: lei(100_000), method: 'accommodation-flat-ratio', ladderYears: [] });
    expect(rooms.status).toBe('computed');
    expect(operator.status).toBe('computed');
    if (rooms.status !== 'computed' || operator.status !== 'computed') return;
    expect(line(rooms, 'Impozit art. 85')!.value).toBe(lei(7_000));
    expect(line(operator, 'Impozit art. 68^3')!.value).toBe(lei(7_000));
    expect(line(rooms, 'CASS pe veniturile')!.value).toBe(lei(4_860));
    // The 68^3 register owes no ladder contribution — its CASS is the art. 170 alin. (1) one on the net.
    expect(line(operator, 'CASS (10%)')!.value).toBe(lei(7_000));
    expect(line(operator, 'CASS pe veniturile')).toBeUndefined();
    // …and the CAS question differs too: a 68^3 net is a lit. b) amount and raises the 12/24-SM test,
    // while a letting net never reaches art. 148 alin. (3) at all.
    expect(line(operator, 'CAS (25%)')!.value).toBe(lei(12_150));
    expect(line(rooms, 'CAS (25%)')!.value).toBe(lei(0));
  });

  it('an art. 85 register supplies no art. 155 alin. (1) lit. b) leg, so the two CASS basins cannot merge', async () => {
    // The acceptance-3 case: sistem-real operands AND an art. 85 gross in the same payload. Before B-88 the
    // engine's leg list was built from the sistem-real difference whenever a flat gross was present at all;
    // the letting net must not join it, because art. 155 alin. (1) puts *cedarea folosinței* at lit. e).
    const res = await run({ gross: lei(100_000), revenuesNet: lei(130_000), expensesNet: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    // The lit. b) cumulation the engine measured CAS and CASS on is ZERO — not the 30.000 sistem-real
    // difference, not the 70.000 letting net, and not the 100.000 the two would make together.
    expect(res.bases.venitulNetDinActivitate).toBe(lei(0));
    expect(res.bases.venitulNetCumulatPentruContributii).toBe(lei(0));
    expect(line(res, 'CAS (25%)')!.value).toBe(lei(0));
    // The ladder ran on the letting net alone: 70.000 → 12 SM rung → 4.860. Had the sistem-real difference
    // been added, the cumulation would have been 100.000 and the rung would still read 12 SM — the same
    // contribution, which is exactly why the contribution is not the proof. The base beside it is.
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(SM12);
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(4_860));
    // And the sistem-real composition never ran: no art. 123 line, no deduction lines.
    expect(line(res, 'Impozit pe venit')).toBeUndefined();
    expect(res.lines.filter((l) => l.label.startsWith('Impozit'))).toHaveLength(1);
  });

  it('a sistem-real register with no flat gross is unmoved by any of this', async () => {
    // The regression guard for the whole change: with `flatRatioGross: null` the engine behaves exactly as
    // it did before B-88, down to the ban.
    const res = await run({ gross: null, method: null, revenuesNet: lei(130_000), expensesNet: lei(100_000), ladderYears: [] });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.venitulNetDinActivitate).toBe(lei(30_000));
    expect(res.bases.venitulNetCumulatPentruContributii).toBeUndefined();
    expect(line(res, 'Impozit art. 85')).toBeUndefined();
    // net 30.000 < 12 SM → CAS 0; CASS 3.000; taxable 27.000 → tax 2.700; total 5.700.
    expect(res.output.total).toBe(lei(5_700));
  });

  it('the leg list an art. 85 register produces is empty, and an empty list cumulates to zero', () => {
    // Stated on the helper the engine calls, so the claim "no lit. b) source" is checkable without reading
    // the composition. A one-element list is the single-source case; the empty list is the new one, and it
    // is what art. 148 alin. (3) and art. 170 alin. (1) are handed for a letting-only register.
    const noLegs: ContributionLeg[] = [];
    const oneLeg: ContributionLeg[] = [{ method: 'accommodation-flat-ratio', net: lei(70_000) }];
    expect(cumulateContributionBase(noLegs)).toBe(lei(0));
    expect(cumulateContributionBase(oneLeg)).toBe(lei(70_000));
  });
});

describe('CASS — the letting net selects a rung; it is never itself the base', () => {
  it('below 6 SM cumulated nothing is owed on this basin, and the 6-SM top-up does not reach it', async () => {
    // gross 30.000 → net 21.000 < 6 SM (24.300) → art. 170 alin. (2) precondition unmet → CASS 0.
    // The art. 174 alin. (6) top-up belongs to the art. 170 alin. (1) route, and this register supplies no
    // lit. b) amount for it to top up: the art. 170 alin. (1) base is 0, and art. 174 alin. (2) settles it.
    const res = await run({ gross: lei(30_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(0));
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(0));
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(0));
    expect(line(res, 'Impozit art. 85')!.value).toBe(lei(2_100));
    expect(res.output.total).toBe(lei(2_100));
  });

  it('the rungs are 6, 12 and 24 SM, inclusive at each lower bound, and the base is the rung', async () => {
    // net 35.000 → ≥ 6 SM, < 12 SM → base 6 SM → 2.430.
    const r6 = await run({ gross: lei(50_000) });
    expect(r6.status).toBe('computed');
    if (r6.status !== 'computed') return;
    expect(r6.bases.bazaDeCalculCassArt155LitCH).toBe(SM6);
    expect(line(r6, 'CASS pe veniturile')!.value).toBe(lei(2_430));

    // net 98.000 → ≥ 24 SM (97.200) → base 24 SM → 9.720.
    const r24 = await run({ gross: lei(140_000) });
    expect(r24.status).toBe('computed');
    if (r24.status !== 'computed') return;
    expect(r24.bases.bazaDeCalculCassArt155LitCH).toBe(SM24);
    expect(line(r24, 'CASS pe veniturile')!.value).toBe(lei(9_720));
    // The two numbers this rung exists to keep apart: 10 % × the net itself would be 9.800, and the 72-SM
    // cap of art. 170 alin. (1) does not reach this basin at all (29.160).
    expect(line(r24, 'CASS pe veniturile')!.value).not.toBe(lei(9_800));
    expect(line(r24, 'CASS pe veniturile')!.value).not.toBe(lei(29_160));
  });

  it('the rung the engine used is the amount the CASS row is measured on', async () => {
    // B-71's discipline on a new row: a threshold row and a figure disagreeing about the same money is the
    // defect, so the base the calculator chose is reported beside the contribution it produced.
    const res = await run({ gross: lei(100_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(48_600));
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(4_860));
  });

  it('the five categories the app cannot compute are asked for, never defaulted', async () => {
    // art. 170 alin. (4) sums across all six litera. The app holds one of them; the other five are the
    // person's to declare. A declared zero is a fact, an invented zero is a debt or a relief that does not
    // exist — B-41, now reached through a figure the engine computed.
    const res = await run({ gross: lei(100_000), ladderYears: [] });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    // RE-PIN (brief 78 / D-DPI-2): the refusal used to count categories without a NUMBER; it now counts
    // categories without an ANSWER. Same refusal, same count, narrowed trigger.
    expect(res.reason).toContain('5 nu au niciun răspuns');
    expect(res.reason).toContain('art. 170 alin. (4)');
    // The gross, the deemed expense and the net are on screen — they are settled. What is NOT on screen is
    // any contribution or tax computed on a guessed base.
    expect(line(res, 'Impozit art. 85')).toBeUndefined();
    expect(line(res, 'CASS pe veniturile')).toBeUndefined();
  });

  it('a declared cedarea amount and the engine-computed one are reported when they disagree', async () => {
    // Two producers for one figure. The engine determined 70.000 from the register under art. 85 alin. (2);
    // the person declared 60.000. Picking either silently would be the app deciding a taxpayer's figure
    // from a preference, so it says which two numbers are in conflict.
    const res = await run({ gross: lei(100_000), ladderYears: ladder({ cedareaFolosinteiBunurilor: lei(60_000) }) });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('doi producători');
    expect(res.reason).toContain('60000');
    expect(res.reason).toContain('70000');
  });

  it('a declared cedarea amount that matches the computed one is not a conflict', async () => {
    const res = await run({ gross: lei(100_000), ladderYears: ladder({ cedareaFolosinteiBunurilor: lei(70_000) }) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(SM12);
  });

  it('a letting declared as the PFA\'s own activity is refused, not reclassified', async () => {
    // art. 83 alin. (1) excludes venituri din activități independente from the cedarea chapter. An art. 85
    // register whose owner also says the income is the PFA's own activity is a contradiction the app reports
    // rather than repairs by overwriting the declaration.
    const res = await run({ gross: lei(100_000), ladderYears: ladder({ cedareaSursa: 'activitate_proprie_a_pfa' }) });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toContain('art. 83 alin. (1)');
  });
});

describe('the gross stays an input, and the rule keeps its questions open', () => {
  it('the engine never derives a gross: with no gross supplied there is no art. 85 figure', async () => {
    // `flatRatioGross: null` is the state of a register whose receipts the assembler could not settle. The
    // engine does not fall back to the sistem-real operands and call the result an art. 85 net.
    const res = await run({ gross: null, method: null, ladderYears: [] });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Venit net art. 85')).toBeUndefined();
    expect(line(res, 'Impozit art. 85')).toBeUndefined();
  });

  it('a gross of zero is a zero, not a refusal', async () => {
    const res = await run({ gross: lei(0) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'Venit net art. 85')!.value).toBe(lei(0));
    expect(line(res, 'Impozit art. 85')!.value).toBe(lei(0));
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(0));
    expect(res.output.total).toBe(lei(0));
  });

  it('the room-count boundary and the PFA question stay questions, not values', () => {
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'ACCOMMODATION_ART85_ROOMS_2026')!;
    // The room numbers are a title switch, not a magnitude in a formula: the rule carries 1 and 7 as
    // counts, and the comparison lives in the one resolver the whole app shares.
    expect(rule!.parameters.find((p) => p.id === 'room_count_min')?.unit).toBe('count');
    expect(rule!.parameters.find((p) => p.id === 'room_count_max')?.unit).toBe('count');
    // research/44 Gaps-4: art. 137 alin. (1) was not retrieved verbatim, so the no-CAS point is carried as
    // a corroborated reading of ANAF's statement, not as a cited statutory sentence.
    const cassRoute = String(rule!.parameters.find((p) => p.id === 'cass_route')!.value);
    expect(cassRoute).toContain('CORROBORATED');
  });
});

describe('the 30 % belongs to this sub-category only — the 20 % of the rest of the chapter is untouched', () => {
  it('the two flat ratios live in four separate rules, and no ratio crosses between the pairs', () => {
    // The scope correction, stated as a fact about the rule set.
    //
    // B-105 changed what this test can assert. It used to prove the boundary by pointing out that no ordinary
    // *cedarea folosinței* rule existed at all, so a 30 % had nowhere to leak to. Now the two ordinary rules
    // exist — art. 84 alin. (3) and art. 84^1 alin. (3), each carrying a 20 % forfetară cotă de cheltuieli —
    // so the boundary has to be proven directly: four rules, four calculators, and no ratio crossing between
    // the accommodation pair and the cedare pair. That is the stronger form of the same claim, and it is the
    // one the comment here always asked for: „If a cedarea rule is ever added, it must carry its own 20 % and
    // its own method; the two ratios may not share a parameter, a calculator or a taxRegime.”
    const byRegime = (regime: string) => PFA_2026_SYSTEM_REAL_PACKAGE.filter((r) => r.taxRegime === regime);
    expect(byRegime('short-term-rooms-flat-ratio')).toHaveLength(1);
    expect(byRegime('accommodation-flat-ratio')).toHaveLength(1);
    expect(byRegime('cedare-art84-flat-ratio')).toHaveLength(1);
    expect(byRegime('cedare-art84x1-withheld')).toHaveLength(1);

    const expenseRatioOf = (ruleId: string): number => {
      const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === ruleId)!;
      const param = rule.parameters.find((p) => p.id === 'expense_ratio' && p.unit === 'percent')!;
      // A percent parameter that stopped being numeric is a rule-shape change, and a test that compared
      // `'20' === 20` would report a passing boundary on a broken rule.
      if (typeof param.value !== 'number') {
        throw new Error(`${ruleId}.expense_ratio is not numeric: ${String(param.value)}`);
      }
      return param.value;
    };
    // The accommodation pair at 30 %, the cedare pair at 20 %.
    expect(expenseRatioOf('ACCOMMODATION_ART85_ROOMS_2026')).toBe(30);
    expect(expenseRatioOf('ACCOMMODATION_68X3_2026')).toBe(30);
    expect(expenseRatioOf('CEDARE_ART84_2026')).toBe(20);
    expect(expenseRatioOf('CEDARE_ART84X1_2026')).toBe(20);

    // No ratio crosses. A 30 % on a cedare rule would understate the net of every landlord with a natural-
    // person or corporate tenant; a 20 % on the rooms rule would overstate the net of every taxpayer under
    // art. 85 alin. (2). Both errors are silent, because all four articles then apply the same 10 %.
    const flatRules = [
      ...byRegime('short-term-rooms-flat-ratio'),
      ...byRegime('accommodation-flat-ratio'),
      ...byRegime('cedare-art84-flat-ratio'),
      ...byRegime('cedare-art84x1-withheld'),
    ];
    const ratios = flatRules.map((r) => expenseRatioOf(r.ruleId));
    expect(ratios.filter((v) => v === 30)).toHaveLength(2);
    expect(ratios.filter((v) => v === 20)).toHaveLength(2);

    // Four calculators, so patching one rule's parameters cannot move another regime's figure. Two rules
    // sharing a calculator would be the B-29 class: invisible in the arithmetic, visible only in the number.
    expect(new Set(flatRules.map((r) => r.calculatorId)).size).toBe(4);
  });

  it('the two flat ratios are read from two rules: patching one leaves the other at 70 %', async () => {
    // The crossing test. Both articles say 30 %, so a shared parameter would be invisible in the arithmetic
    // and visible only in the number — which is the B-29 class. Patching one rule must move one figure.
    const patch = (ruleId: string, ratio: number) =>
      PFA_2026_SYSTEM_REAL_PACKAGE.map((r) =>
        r.ruleId !== ruleId
          ? r
          : { ...r, parameters: r.parameters.map((p) => (p.id === 'expense_ratio' ? { ...p, value: ratio } : p)) },
      );

    const roomsWith68x3Ratio = await run({ gross: lei(100_000), rules: patch('ACCOMMODATION_68X3_2026', 20) });
    expect(roomsWith68x3Ratio.status).toBe('computed');
    if (roomsWith68x3Ratio.status !== 'computed') return;
    // The art. 85 net is unmoved: 70 % of 100.000, not 80 %.
    expect(line(roomsWith68x3Ratio, 'Venit net art. 85')!.value).toBe(lei(70_000));

    const operatorWithArt85Ratio = await run({
      gross: lei(100_000),
      method: 'accommodation-flat-ratio',
      ladderYears: [],
      rules: patch('ACCOMMODATION_ART85_ROOMS_2026', 20),
    });
    expect(operatorWithArt85Ratio.status).toBe('computed');
    if (operatorWithArt85Ratio.status !== 'computed') return;
    expect(line(operatorWithArt85Ratio, 'Venit net art. 68^3')!.value).toBe(lei(70_000));
  });
});

describe('a person with a PFA AND a letting has two parallel CASS computations, not one merged ladder', () => {
  it('art. 170 alin. (1) runs on the lit. b) net while art. 170 alin. (2)-(4) runs on the rung', async () => {
    // The consequence research/44 §7 states as FACT from the text: the alin. (4) ladder cumulates only lit.
    // c)-h), and independent-activity income is not in that list. Here the register is a sistem-real PFA
    // (lit. b)) and the letting is declared as a separate category — the shape this build can actually hold.
    //   lit. b) net 30.000 → CASS 10 % × 30.000 = 3.000 lei          — art. 170 alin. (1)
    //   lit. e) net 70.000 → ≥ 12 SM, < 24 SM → base 48.600 → 4.860  — art. 170 alin. (2)-(3)
    // Neither number contains the other, and the two contributions are two lines.
    const res = await run({
      gross: null,
      method: null,
      revenuesNet: lei(130_000),
      expensesNet: lei(100_000),
      ladderYears: ladder({ cedareaFolosinteiBunurilor: lei(70_000) }),
    });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.venitulNetDinActivitate).toBe(lei(30_000));
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(SM12);
    expect(line(res, 'CASS (10%)')!.value).toBe(lei(3_000));
    expect(line(res, 'CASS pe veniturile')!.value).toBe(lei(4_860));
    // The two basins never merge: the lit. b) base is not 100.000 (30.000 + 70.000), and the ladder base is
    // a rung, not the 70.000 net and not the 100.000 sum.
    expect(res.bases.venitulNetDinActivitate).not.toBe(lei(100_000));
    expect(res.bases.bazaDeCalculCassArt155LitCH).not.toBe(lei(70_000));
  });

  it('the lit. b) net never enters the ladder, and the ladder never enters the 72-SM cap', async () => {
    // One test per direction, because merging them is silent in either.
    // Direction 1: a large independent-activity net beside a small letting. The ladder sees 5.000 lei, which
    // is below the art. 170 alin. (2) condition precedent, so it owes nothing — the 400.000 lei of lit. b)
    // income does not lift it to a rung.
    const smallLetting = await run({
      gross: null,
      method: null,
      revenuesNet: lei(400_000),
      expensesNet: lei(0),
      ladderYears: ladder({ cedareaFolosinteiBunurilor: lei(5_000) }),
    });
    expect(smallLetting.status).toBe('computed');
    if (smallLetting.status !== 'computed') return;
    expect(smallLetting.bases.bazaDeCalculCassArt155LitCH).toBe(lei(0));
    expect(line(smallLetting, 'CASS pe veniturile')!.value).toBe(lei(0));
    // Direction 2: the 72-SM cap belongs to art. 170 alin. (1) only. The same year's lit. b) base is capped
    // at 291.600 lei (CASS 29.160), while a letting that cumulates past 24 SM stops at the 24-SM rung —
    // 9.720, not 10 % × 400.000 and not the capped 29.160.
    const bigLetting = await run({
      gross: null,
      method: null,
      revenuesNet: lei(400_000),
      expensesNet: lei(0),
      ladderYears: ladder({ cedareaFolosinteiBunurilor: lei(400_000) }),
    });
    expect(bigLetting.status).toBe('computed');
    if (bigLetting.status !== 'computed') return;
    expect(bigLetting.bases.bazaDeCalculCassArt155LitCH).toBe(SM24);
    expect(line(bigLetting, 'CASS pe veniturile')!.value).toBe(lei(9_720));
    expect(line(bigLetting, 'CASS (10%)')!.value).toBe(lei(29_160));
  });
});

describe('the DU 212 obligation for this income is the annual one, due 25 May', () => {
  it('the FY2026 calendar carries one d212_filing on 2027-05-25, cited to art. 122 alin. (3)', () => {
    // art. 85 alin. (10) routes to art. 122 alin. (3), the same term the PFA already carries — so this income
    // adds an amount to the return, not a second obligation. The deadline layer is driven by
    // `PFA_DEADLINE_2026`, and the art. 85 rule carries the same date as data beside its own citation.
    const deadlines = computeDeadlines(PFA_2026_SYSTEM_REAL_PACKAGE, { taxYear: 2026, asOfDate: '2026-10-31' });
    const d212 = deadlines.filter((d) => d.eventType === 'd212_filing');
    expect(d212).toHaveLength(1);
    expect(d212[0]!.date).toBe('2027-05-25');
    expect(d212[0]!.legalSource.article).toContain('art. 122 alin. (3)');
    // The rule agrees with the calendar rather than competing with it.
    const rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'ACCOMMODATION_ART85_ROOMS_2026')!;
    expect(rule.parameters.find((p) => p.id === 'filing_deadline')?.value).toBe(d212[0]!.date);
    expect(rule.parameters.find((p) => p.id === 'payment_deadline')?.value).toBe(d212[0]!.date);
    // And „impozitul fiind final” is not a reason to stay silent: art. 122 alin. (6) lit. a) exempts only
    // tax withheld at source, which this is not.
    expect(String(rule.parameters.find((p) => p.id === 'filing_deadline')!.description)).toContain('122 alin. (6)');
  });
});
