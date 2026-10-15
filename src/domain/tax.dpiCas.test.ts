/**
 * B-112 STAGE 2 — the CAS cumulation of CF art. 148 alin. (3), end to end through `computeTaxEstimate`.
 *
 * **The defect this closes.** ANAF DGRFP București's Exemplul 3 („Noutăți privind Declarația Unică 2026 –
 * exemple") takes a PFA with 68.000 lei of activitate independentă net and 50.000 lei of DPI net, cumulates
 * 118.000 lei, reads that as over 24 SMN (24 × 4.050 = 97.200), and charges CAS of 24.300 lei. The engine
 * charged 12.150 lei. The tier function was right all along — 12.150 = 25 % × 48.600 is the correct CAS for
 * 68.000 lei alone — and the reason the two disagreed is that `cumulateContributionBase` summed only the
 * art. 155 alin. (1) **lit. b)** legs, while art. 148 alin. (3) cumulates art. 137 alin. (1) **lit. b) și
 * b^1)**. *Drepturi de proprietate intelectuală* is lit. b^1). The app could not put it into the cumul
 * because it could not represent it at all.
 *
 * **The asymmetry that must not be tidied away.** The two ceiling tests are not one test:
 *
 * | | what it cumulates | what the cumulated amount does |
 * |---|---|---|
 * | CAS, art. 148 alin. (3) | art. 68, 68³, 69 net + art. 68¹ sports gross + **art. 72/72¹/73 DPI net** | **selects** the 12 / 24-SMN floor |
 * | CASS, art. 170 alin. (1) | art. 155 alin. (1) lit. b) only | **is** the base, floored at 6 SM, capped at 72 SM |
 *
 * So the same declared DPI amount belongs inside the CAS threshold test and outside the CASS base. A single
 * shared "cumulated income" variable would be wrong in both directions at once, which is why `tax.ts` now
 * carries two quantities and two lines.
 *
 * **Why the amounts below are not ANAF's.** 50.000 lei of DPI makes the art. 118 alin. (2^2) proration
 * fractional (24.300 × 68/118 is not a whole number of bani) and the engine refuses rather than rounding a
 * deduction — see `regimeSplit.test.ts`, which stays a finding for exactly that reason. The figures here
 * use a sistem-real net of 72.000 lei and DPI of 28.000 lei, where the ratio is 72.000 ÷ 100.000 = 0,72 and
 * the proration lands whole, so the composition can be observed end to end. The refusal case is asserted
 * too, at the bottom — and it is wider than it looks: any ratio that is not a terminating decimal trips the
 * same guard, so the guard is not an edge case of ANAF's numbers.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate } from './tax';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, PfaProfile } from './models';
import type { AppData, Revenue } from '../data/types';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { selectEstimateOperands } from './estimateBasis';
import { selectRuleSet } from './fiscal';
import { addBani, lei, money, type Bani } from './money';

// A sistem-real year of the same shape as ANAF's — brut minus cheltuieli deductibile. The brut is derived
// from `AI_NET + EXPENSES` at the call site, so the net is the fact under test and the brut is scaffolding.
const EXPENSES = lei(32_000);
const AI_NET = lei(72_000);

// 72.000 lei alone sits in the 12–24 SMN band (over 48.600, under 97.200) and selects the 12-SMN floor.
// With 28.000 lei of DPI the cumulation is 100.000 lei, over 24 SMN (97.200), and the floor is 97.200.
// The ratio 72.000 ÷ 100.000 = 0,72 is exact, so 0,72 × 24.300 = 17.496 lei is a whole number of bani and
// the proration guard does not fire — which is what lets the rest of the composition be observed.
const DPI_NET = lei(28_000);

function ladder(dpi: Bani): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      // Every one of the six categories is answered, because `calcCassLadder` refuses a cumulation with a
      // hole in it: art. 170 alin. (2)-(4) sums over all six, so an unanswered category makes the sum
      // unknown rather than smaller. A DPI net of zero is therefore DECLARED zero here — the state in which
      // the person was asked and said they have none.
      proprietateIntelectuala: dpi,
      asocierePersoanaJuridica: lei(0),
      cedareaFolosinteiBunurilor: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
    },
  ];
}

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-dpi-cas',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    ...over,
  } as PfaProfile;
}

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
    cassLadderYears: [],
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' as const },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-dpi-cas:2026',
    ...over,
  };
}

function engine(over: { dpi?: Bani; aiNet?: Bani; ladderYears?: CassLadderYear[]; inputs?: Partial<TaxInputsReference> } = {}) {
  const ladderYears = over.ladderYears ?? ladder(over.dpi ?? lei(0));
  // The sistem-real net is parameterised because the discriminating proration cases in research/49 are
  // stated as (net, cumulated) pairs, and the pair decides both the CAS tier and the ratio.
  const aiNet = over.aiNet ?? AI_NET;
  return computeTaxEstimate({
    inputs: inputs({ cassLadderYears: ladderYears, ...over.inputs }),
    profile: profile({ cassLadderYears: ladderYears }),
    revenues: addBani(aiNet, EXPENSES),
    expenses: EXPENSES,
    revenuesNet: addBani(aiNet, EXPENSES),
    expensesNet: EXPENSES,
    expenseBase: { netFirst: EXPENSES, grossFirst: EXPENSES, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix))?.value;

describe('B-112 — DPI net enters the CAS ceiling test of art. 148 alin. (3)', () => {
  it('without DPI the year selects the 12-SMN floor, exactly as it always did', async () => {
    const res = await engine();
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // 72.000 lei is over 12 SMN (48.600) and under 24 SMN (97.200) → floor 48.600 → 25 % = 12.150.
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    // No CAS-specific cumulation line: with one source and no DPI the two cumulations are the same number,
    // and the engine does not print a line for a quantity it has not summed.
    expect(res.lines.some((l) => l.label.startsWith('Venit cumulat pentru CAS'))).toBe(false);
  });

  it('with DPI net the same year crosses 24 SMN and CAS becomes 24.300 lei', async () => {
    const res = await engine({ dpi: DPI_NET });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // 100.000 lei cumulated ≥ 97.200 → art. 148 alin. (2) lit. b) → floor 97.200 → 25 % = 24.300.
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(lei(100_000));
  });

  it('the CASS base of art. 170 alin. (1) does NOT take the DPI amount', async () => {
    // The other half of the asymmetry, and the half that a shared "cumulated income" variable would break.
    // art. 170 alin. (1) cumulates art. 155 alin. (1) lit. b) only, so the CASS base stays the 68.000 lei
    // net and the contribution stays 6.800 lei.
    const without = await engine();
    const withDpi = await engine({ dpi: DPI_NET });
    if (without.status !== 'computed' || withDpi.status !== 'computed') throw new Error('engine refused');
    expect(line(withDpi, 'CASS (10%)')).toBe(line(without, 'CASS (10%)'));
    expect(withDpi.bases.venitulNetDinActivitate).toBe(AI_NET);
    // Two lines, two quantities — printed precisely because they now differ.
    expect(line(withDpi, 'Venit cumulat pentru CAS')).toBe(lei(100_000));
    expect(line(withDpi, 'Venit cumulat pentru CASS')).toBe(AI_NET);
  });

  it('the DPI amount still runs its own CASS ladder, on its own rung', async () => {
    // art. 155 alin. (1) lit. c) → art. 170 alin. (2)-(4): 28.000 lei is at or above 6 SMN (24.300) and
    // below 12 SMN (48.600) → rung 6 SMN → base 24.300 → 10 % = 2.430. The CAS test and this one read the
    // same amount and answer different questions; neither result feeds the other.
    const res = await engine({ dpi: DPI_NET });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(line(res, 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)')).toBe(lei(2_430));
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(24_300));
  });

  it('the art. 118 alin. (2^2) CAS deduction is prorated by the DPI-widened denominator', async () => {
    // research/48 §5: „The denominator is the art. 148 alin. (3) cumulated total, so adding a DPI path
    // changes the income-tax result too, not just CAS." 0,72 × 24.300 = 17.496 deductible, against the
    // full 12.150 the single-source year deducted. The art. 118 alin. (2^3) CASS ratio keeps the lit. b)
    // denominator, so it stays 1 and the CASS deduction is not prorated at all.
    const res = await engine({ dpi: DPI_NET });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(line(res, 'CAS deductibilă')).toBe(lei(17_496));
    expect(line(res, 'CASS deductibilă')).toBe(lei(7_200));
  });
});

describe('B-112 — the art. 150 exemptions are asymmetric, and the DPI path must not blur them', () => {
  it('a pensioner owes no CAS at all, with DPI in the cumul or without it (art. 150 alin. (1))', async () => {
    // alin. (1) reaches both art. 137 alin. (1) lit. b) and lit. b^1), so widening the cumul cannot make a
    // pensioner owe. The exemption keys on the STATUS, not on the amount.
    const res = await engine({ dpi: DPI_NET, inputs: { pensionerStatus: 'da' } });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(line(res, 'CAS (25%)')).toBe(lei(0));
    // And the cumulation line is still printed, because the exemption is not the same as having no income.
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(lei(100_000));
  });

  it('a salariat still owes full CAS on the art. 67 income (art. 150 alin. (2) reaches lit. b^1) only)', async () => {
    // THE asymmetry, pinned. art. 150 alin. (2) exempts salaried persons for art. 137 alin. (1) lit. b^1)
    // income and NOT for lit. b), so a salaried PFA owner owes CAS on the independent-activity income at
    // the tier the whole cumulation selects. `salaryStatus` is deliberately never handed to `calcCas`;
    // handing it over would zero this line and the exemption does not say that.
    const res = await engine({ dpi: DPI_NET, inputs: { salaryStatus: 'da', salaryIncomeLei: lei(60_000) } });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    // Same money, same DPI, one fact changed: CAS does not move. That is the asymmetry, not an accident.
    const notSalaried = await engine({ dpi: DPI_NET });
    if (notSalaried.status !== 'computed') throw new Error('engine refused');
    expect(line(res, 'CAS (25%)')).toBe(line(notSalaried, 'CAS (25%)'));
  });

  it('the same salary fact still moves CASS, because art. 174 alin. (7) lit. a) is a different rule', async () => {
    // The counter-assertion that keeps the previous test from being read as "status facts do nothing".
    // Below the 6-SMN floor the salariat exception waives the art. 174 alin. (6) difference; nothing here
    // waives CAS. Two contributions, two exemption tables, two keys.
    const small = await computeTaxEstimate({
      inputs: inputs({ cassLadderYears: ladder(lei(0)), salaryStatus: 'da', salaryIncomeLei: lei(30_000) }),
      profile: profile(),
      revenues: lei(20_000),
      expenses: lei(0),
      revenuesNet: lei(20_000),
      expensesNet: lei(0),
      expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false },
      flatRatioGross: null,
      flatRatioMethod: null,
      ruleRelease: PFA_2026_RELEASE,
      rules: PFA_2026_SYSTEM_REAL_PACKAGE,
    });
    if (small.status !== 'computed') throw new Error(`engine refused: ${small.reason}`);
    // 20.000 lei net is positive and under 6 SMN (24.300): the alin. (6) difference would top CASS up to
    // 2.430, and the salary over 6 SMN waives exactly that — leaving 10 % × 20.000 = 2.000.
    expect(line(small, 'CASS (10%)')).toBe(lei(2_000));
    // And CAS is untouched by the same fact: 20.000 lei is under 12 SMN, so nothing is due — but the
    // reason is the threshold, not the salary.
    expect(line(small, 'CAS (25%)')).toBe(lei(0));
  });
});

describe('B-112 — the B-116 double count cannot reach the CAS cumul through the register', () => {
  /** A register holding a recorded DPI document, plus the hand-typed ladder net for the same year. */
  function bothRepresentations(): AppData {
    const rev: Revenue = {
      id: 'dpi-rec',
      tip: 'factura',
      nr: 'DPI-1',
      date: '2026-03-10',
      client: 'Client',
      cui: '12345678',
      valoareFaraTva: money(lei(40_000), 'RON'),
      tva: money(lei(0), 'RON'),
      status: 'inregistrata',
      incomeCategory: 'drepturi_de_proprietate_intelectuala',
    };
    return {
      reservedAmount: null,
      profile: {
        id: 'p-both', pfaStartYear: 2026, fiscalYear: 2026, regime: 'impozit_pe_venit', caen: '6201',
        salaryStatus: 'nu', pensionerStatus: 'nu', socialInsuranceStatus: 'obligatoriu',
        vatRegistration: { status: 'scutit_art310' as const }, cashFloorLei: lei(0),
        cassLadderYears: ladder(DPI_NET),
        identity: { nume: 'x' } as never,
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as PfaProfile,
      revenues: [rev], expenses: [], clients: [], filings: [], vatReturns: [], documents: [],
      occupancySheets: [], vehicles: [], fixedAssets: [],
      companyDocs: { im: [], cs: [], tva: [], facturi: [] }, statements: [], snapshots: [],
      settings: {
        cotaTva: 0.19, company: { denumire: 'x', cui: '', numarRegComert: '', adresa: '', caen: [] },
        personal: { nume: 'x', cnp: '', adresa: '', telefon: '', email: '' },
        bankAccounts: [], eFactura: { trimitere: 'manual', dateContact: '' },
      },
    } as AppData;
  }

  it('the CAS cumul carries the DPI amount once, because the recorded document never reaches the engine', async () => {
    // Stage 1 scoped recorded DPI receipts out of `selectEstimateOperands`, so the ladder amount is the
    // only DPI quantity the engine can see. That is structural, not a check added at the cumul — and this
    // test is what makes it a check: a later stage that routes recorded DPI into the engine has to break
    // it deliberately rather by accident.
    const data = bothRepresentations();
    const asOf = '2026-10-31';
    const rules = [...(selectRuleSet(2026, asOf)?.rules ?? [])];
    const ops = selectEstimateOperands(data, asOf, rules);
    if (ops.kind !== 'run') throw new Error('assembler refused');
    // The recorded 40.000 lei of DPI is not in the operands at all.
    expect(ops.amounts.revenuesNet).toBe(lei(0));

    const res = await engine({ dpi: DPI_NET });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
    // And the cumul is 72.000 + 28.000, not 72.000 + 28.000 + 40.000. Had the register fed the CAS path
    // too, the year would clear a higher tier on money counted twice.
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(lei(100_000));
    expect(line(res, 'Venit cumulat pentru CAS')).not.toBe(lei(140_000));
  });
});

describe('B-112 stage 5 — art. 118 alin. (2⁴): widening the CAS base with DPI does not make the deduction cap reachable', () => {
  /**
   * The cap itself — „Nivelul contribuției de asigurări sociale și al contribuției de asigurări sociale de
   * sănătate deductibile … nu poate depăși nivelul venitului net anual recalculat” — is already pinned in
   * `tax.test.ts`, which proves the mechanism by raising the CAS rate to 100 %. What that test does not
   * cover is the question B-112 raises: **DPI enlarges the amount that selects the CAS tier without ever
   * enlarging the net the cap is measured against**, so a reader could reasonably expect the cap to start
   * binding. It does not, and the reason is arithmetic rather than lucky:
   *
   *   CAS deductibilă = CAS × net ÷ cumulat, and the tier base never exceeds the cumulation that selected
   *   it, so CAS ≤ 0,25 × cumulat and therefore CAS deductibilă ≤ 0,25 × net.
   *   CASS deductibilă ≤ 0,10 × net (the art. 174 alin. (6) difference is excluded by art. 118 alin. (2)
   *   lit. b) anyway).
   *
   * So the two together stay under 0,35 × net, and alin. (2⁴) cannot bind at the real 2026 rates whatever
   * the DPI amount is. That is worth stating, because a structural guard that nobody can reach is also a
   * guard nobody will ever see fire — and this test is what keeps that claim checked rather than assumed.
   */
  it('a DPI-heavy year leaves the cap line absent, and the deductions under a third of the net', async () => {
    // The most lopsided year the model can hold: 13.000 lei of sistem-real net beside 91.000 lei of DPI.
    // The cumulation of 104.000 lei selects the 24-SMN tier, so the CAS is 24.300 lei on a net of 13.000 —
    // nearly twice the net. The proration is what keeps the DEDUCTION inside the cap: 3.037 lei.
    const res = await engine({ aiNet: lei(13_000), dpi: lei(91_000) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300)); // larger than the net itself
    expect(line(res, 'CAS deductibilă')).toBe(lei(3_037));
    expect(line(res, 'CASS deductibilă')).toBe(lei(1_300));
    // No cap line: nothing was blocked.
    expect(res.lines.some((l) => l.label.startsWith('Deduceri blocate de plafonul'))).toBe(false);
    // And the structural bound, asserted rather than argued.
    const deduceri = addBani(line(res, 'CAS deductibilă') as Bani, line(res, 'CASS deductibilă') as Bani);
    expect(deduceri).toBeLessThan(lei(4_550)); // 0,35 × 13.000 lei
    expect(deduceri).toBeLessThan(lei(13_000));
  });
});

describe('B-118 closed — the proration carries the exact ratio and rounds once at the product, and the discriminating cases are pinned', () => {
  /**
   * **Why these three cases and no others.** research/49 enumerates five worked examples with a
   * non-terminating ratio, and they do not agree with each other. The two ANAF leaflets that carry the ratio
   * at 2 decimals of a percent (Galați, Cluj) are the ones that discriminate, and Galați is the case where
   * **our chosen rule and a published ANAF figure disagree by 1 leu.** Pinning it is the point: the
   * repository states the difference instead of hiding it, and a future change cannot drift back to the
   * coarse ratio without breaking a test that says out loud which ANAF leaflet it is disagreeing with.
   *
   * The rule, as decided 2026-10-14: **exact ratio, rounded once at the final product by CF art. 66** —
   * „Sumele sunt calculate prin rotunjire la un leu, prin neglijarea fracțiunilor de până la 50 de bani
   * inclusiv și majorarea la leu a fracțiunilor ce depășesc 50 de bani." (Pct. 29, art. I din Legea 296/2020
   * — **art. 66 has no alineate**; the pre-2020 article of that number dealt with *deducerea personală* and
   * rounded to 10 lei.)
   */

  it('ANAF Galați: we compute 6.542 lei and knowingly differ from the leaflet\'s 6.543 lei', async () => {
    // SOURCE — ANAF Galați, „activ-indep.pdf": net 35.000 / cumulat 65.000, CAS datorată 12.150, ratio
    // printed as 53,85 %, CAS deductibilă published as **6.543 lei**.
    // OURS — exact ratio 35.000 ÷ 65.000 = 0,538461538…; 12.150 × that = 6.542,30769 lei; the fraction is
    // 30 bani, under 50, so art. 66 neglects it → **6.542 lei**.
    // **We knowingly differ from an ANAF leaflet on this one line.** The leaflet rounded the ratio to 4
    // decimals before multiplying (0,5385 × 12.150 = 6.542,775 → 6.543), and that rule has no citable
    // authority: it is minified code in ANAF's own bundle, which contradicts itself by using the exact ratio
    // in Subsecțiunea 5.1 — the DPI CAS deductibilă path this repository builds.
    const res = await engine({ aiNet: lei(35_000), dpi: lei(30_000) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, 'Venit cumulat pentru CAS')).toBe(lei(65_000));
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(line(res, 'CAS deductibilă')).toBe(lei(6_542));
    expect(line(res, 'CAS deductibilă')).not.toBe(lei(6_543)); // Galați's figure, asserted absent by name.
  });

  it('ANAF Cluj: 42.000 ÷ 87.000 gives 5.866 lei, and here the exact route and the leaflet agree', async () => {
    // SOURCE — ANAF Cluj, 22 Apr 2026: net 42.000 / cumulat 87.000, CAS 12.150, ratio 48,28 %, CAS
    // deductibilă **5.866 lei**. Exact: 12.150 × 0,482758620… = 5.865,5172 lei; the fraction is 51,72 bani,
    // over 50, so art. 66 majors to the leu → 5.866 lei. Recorded because an agreement is evidence too: the
    // chosen rule is not merely the one that flatters our own fixtures.
    const res = await engine({ aiNet: lei(42_000), dpi: lei(45_000) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, 'CAS (25%)')).toBe(lei(12_150));
    expect(line(res, 'CAS deductibilă')).toBe(lei(5_866));
  });

  it('the 50-bani tie goes DOWN, because art. 66 says „până la 50 de bani inclusiv”', async () => {
    // THE EDGE NO SOURCE TESTS. Art. 66 neglects fracțiuni **până la 50 de bani inclusiv** — half-DOWN at a
    // true tie. ANAF's web application uses `Math.round`, which is half-UP, so the two diverge at exactly
    // 0,50 bani and nothing published settles it. Our choice is the statute's own wording, and it is pinned
    // here on the proration path rather than only on `roundArt66` in isolation, because this is the path
    // where a fractional product actually arises.
    //
    // Constructed to land on the tie exactly: net 13.000 / cumulat 104.000 gives a ratio of exactly 1/8, and
    // the cumulation clears 24 SMN so the CAS is 24.300 lei. 24.300 × 1/8 = **3.037,50 lei** — a fraction of
    // exactly 50 bani.
    const res = await engine({ aiNet: lei(13_000), dpi: lei(91_000) });
    if (res.status !== 'computed') throw new Error(`engine refused: ${res.status} — ${res.reason}`);
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(res, 'CAS deductibilă')).toBe(lei(3_037)); // art. 66: neglected, down.
    expect(line(res, 'CAS deductibilă')).not.toBe(lei(3_038)); // what Math.round (ANAF's app) would give.
  });

  it('the refusal that used to stand here is gone, not dormant: a non-terminating ratio computes', async () => {
    // The case that motivated B-118's refusal — 72.000 ÷ 102.000 = 70,5882… %, a ratio that does not
    // terminate and never did. It used to return `review_required`; it now returns a number, and the whole
    // year composes. Asserted as `computed` rather than as an amount, because the point is that no refusal
    // path survives on this input.
    const res = await engine({ dpi: lei(30_000) });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(line(res, 'CAS deductibilă')).toBeDefined();
    expect(res.lines.some((l) => l.label.startsWith('Impozit'))).toBe(true);
  });
});
