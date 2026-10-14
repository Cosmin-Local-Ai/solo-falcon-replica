/**
 * PG-6d (D-OTH-1, landmine 5) — the two CASS tracks stay two tracks, end to end.
 *
 * CF art. 170 states two different contribution paths for the same person, and the phase's whole risk is
 * that they merge:
 *
 *   art. 170 alin. (1)  — the PFA's own net (art. 155 alin. (1) lit. b)): the cumulated net IS the base,
 *                         floored at 6 SM by art. 174 alin. (6) and capped at 72 SM.
 *   art. 170 alin. (2)-(4) — lit. c)-h): the cumulated amount only SELECTS one of three bases (6/12/24 SM),
 *                         with no floor and no cap.
 *
 * A single merged "cumulated income" variable feeding one CASS calculation is the defect. These tests run
 * the real composition (`computeTaxEstimate`, not the calculator) and assert the two directions of the
 * separation independently: adding ladder income must not move the lit. b) figures, and moving the lit. b)
 * figures must not move the ladder.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate } from './tax';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, PfaProfile } from './models';
import { PFA_2026_RELEASE } from './fiscal/release2026';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './fiscal/package2026';
import { lei, type Bani } from './money';

const RECEIPTS = lei(130_000);
// art. 68^3 alin. (2): net = 70 % × 130.000 = 91.000.
const FLAT_NET = lei(91_000);

function profile(over: Partial<PfaProfile> = {}): PfaProfile {
  return {
    id: 'p-6d',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    activityFamily: 'cazare',
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
    vatRegistration: { status: 'inregistrat_art316' as const },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-6d:2026',
    ...over,
  };
}

/**
 * Six categories summing to `total`, with the two D-OTH-2 facts answered so the amounts may be cumulated.
 * `alte_surse` stays a declared zero: a positive amount there would need the art. 114 answer, and these
 * tests are about which basin a figure belongs to, not about that gate.
 */
function ladderYear(total: Bani): CassLadderYear {
  const half = Math.floor(total / 2) as Bani;
  return {
    fiscalYear: 2026,
    proprietateIntelectuala: half,
    investitii: (total - half) as Bani,
    asocierePersoanaJuridica: lei(0),
    cedareaFolosinteiBunurilor: lei(0),
    activitatiAgricole: lei(0),
    alteSurse: lei(0),
    cedareaSursa: 'patrimoniu_personal',
  };
}

function engine(over: { revenues?: Bani; ladderYears?: CassLadderYear[] } = {}) {
  return computeTaxEstimate({
    inputs: inputs({ cassLadderYears: over.ladderYears ?? [] }),
    profile: profile({ cassLadderYears: over.ladderYears ?? [] }),
    revenues: over.revenues ?? RECEIPTS,
    expenses: lei(0),
    revenuesNet: over.revenues ?? RECEIPTS,
    expensesNet: lei(0),
    // PG-6f — a zero expense base cannot diverge: no line is both half-count-limited and carrying
    // non-recoverable VAT, so the two candidate bases coincide.
    expenseBase: { netFirst: lei(0), grossFirst: lei(0), divergent: false },
    flatRatioGross: over.revenues ?? RECEIPTS,
    ruleRelease: PFA_2026_RELEASE,
    rules: PFA_2026_SYSTEM_REAL_PACKAGE,
  });
}

const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix))?.value;

const LADDER_LINE = 'CASS pe veniturile din art. 155 alin. (1) lit. c)-h)';

describe('the lit. c)-h) ladder is a second track, not a second input to the first', () => {
  it('ladder income adds its own line and its own base, and moves nothing on the lit. b) path', async () => {
    const without = await engine();
    const withLadder = await engine({ ladderYears: [ladderYear(lei(60_000))] });
    expect(without.status).toBe('computed');
    expect(withLadder.status).toBe('computed');
    if (without.status !== 'computed' || withLadder.status !== 'computed') return;

    // No ladder line at all when nothing was declared — not a zero line.
    expect(without.lines.some((l) => l.label.startsWith(LADDER_LINE))).toBe(false);

    // 60.000 lei cumulated → at least 12 SM (48.600), below 24 SM (97.200) → base 12 SM → 4.860 lei.
    expect(line(withLadder, LADDER_LINE)).toBe(lei(4_860));
    expect(withLadder.bases.bazaDeCalculCassArt155LitCH).toBe(lei(48_600));

    // The lit. b) CASS figures are untouched by the second basin: same net, same CASS on the activity.
    expect(withLadder.bases.venitulNetDinActivitate).toBe(FLAT_NET);
    expect(line(withLadder, 'CASS (10%)')).toBe(line(without, 'CASS (10%)'));
    // B-112 STAGE 2 — but CAS DOES move, and that is the defect being fixed, not a regression. CF
    // art. 148 alin. (3) cumulates art. 137 alin. (1) **lit. b) and lit. b^1)** into ONE ceiling test,
    // while art. 170 alin. (1) cumulates lit. b) only. So the same declared DPI amount is inside the CAS
    // threshold test and outside the CASS base, and a test that asserted "CAS does not move" was pinning
    // B-112 in place. 91.000 lei of lit. b) net alone selects the 12-SMN floor (48.600 → 12.150 lei);
    // with 30.000 lei of DPI the cumulation is 121.000 lei, over 24 SMN (97.200), so the floor is 97.200
    // and CAS is 24.300 lei.
    expect(line(without, 'CAS (25%)')).toBe(lei(12_150));
    expect(line(withLadder, 'CAS (25%)')).toBe(lei(24_300));
    // And the CASS ladder's own base is a separate quantity, never written over the activity net.
    expect(withLadder.bases.bazaDeCalculCassArt155LitCH).not.toBe(withLadder.bases.venitulNetDinActivitate);
  });

  it('the PFA’s own net never enters the 6/12/24 SM test', async () => {
    // Doubling the register doubles the lit. b) net (91.000 → 182.000, which crosses 24 SM and moves CAS).
    // The ladder sees none of it: same declared amounts, same rung, same contribution.
    const small = await engine({ ladderYears: [ladderYear(lei(60_000))] });
    const large = await engine({ revenues: lei(260_000), ladderYears: [ladderYear(lei(60_000))] });
    expect(small.status).toBe('computed');
    expect(large.status).toBe('computed');
    if (small.status !== 'computed' || large.status !== 'computed') return;

    expect(large.bases.venitulNetDinActivitate).toBe(lei(182_000));
    // B-112 stage 2 sharpened the assertion rather than weakening it. The CAS cumulation now carries the
    // DPI 30.000 lei as well, so the two years cumulate to 121.000 and 212.000 lei — both above the 24-SMN
    // rung (97.200), so CAS is 24.300 lei in both and the old `not.toBe` no longer holds. What still
    // separates them is the cumulation itself, and what must NOT move is the ladder: the PFA's own net
    // never enters the 6/12/24 SM test, whichever direction the CAS rung happens to move.
    expect(line(large, 'Venit cumulat pentru CAS')).toBe(lei(212_000));
    expect(line(small, 'Venit cumulat pentru CAS')).toBe(lei(121_000));
    expect(line(large, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(small, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(large, LADDER_LINE)).toBe(line(small, LADDER_LINE));
    expect(large.bases.bazaDeCalculCassArt155LitCH).toBe(small.bases.bazaDeCalculCassArt155LitCH);
  });

  it('the ladder never reaches the 72 SM cap of art. 170 alin. (1)', async () => {
    // 300.000 lei of lit. c)-h) income is above 72 SM (291.600). The cap belongs to the lit. b) path; the
    // ladder's ceiling is its top rung, 24 SM.
    const res = await engine({ ladderYears: [ladderYear(lei(300_000))] });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBe(lei(97_200));
    expect(line(res, LADDER_LINE)).toBe(lei(9_720));
    // The lit. b) base is still measured on its own net, uncapped and unraised by the ladder.
    expect(res.bases.venitulNetDinActivitate).toBe(FLAT_NET);
  });

  it('a declared ladder that cannot be summed stops the composition instead of computing a partial sum', async () => {
    const partial: CassLadderYear = {
      fiscalYear: 2026,
      proprietateIntelectuala: lei(120_000),
      investitii: lei(50_000),
      // four categories unanswered — not zero
    };
    const res = await engine({ ladderYears: [partial] });
    expect(res.status).toBe('review_required');
    if (res.status !== 'review_required') return;
    expect(res.reason).toMatch(/art\. 170 alin\. \(4\)/);
    expect(res.reason).toMatch(/nu completează zero/);
  });

  it('a ladder year for another fiscal year is not read into this one', async () => {
    const otherYear: CassLadderYear = { ...ladderYear(lei(60_000)), fiscalYear: 2027 };
    const res = await engine({ ladderYears: [otherYear] });
    expect(res.status).toBe('computed');
    if (res.status !== 'computed') return;
    expect(res.lines.some((l) => l.label.startsWith(LADDER_LINE))).toBe(false);
    expect(res.bases.bazaDeCalculCassArt155LitCH).toBeUndefined();
  });
});
