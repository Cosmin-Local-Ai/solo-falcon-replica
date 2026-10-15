/**
 * B-121 — a fiscal loss reported in an EARLIER year can now be carried into the year being computed.
 *
 * **The defect.** `computeTaxEstimate` produced a `lossCarryForward` for the year it was given and had no
 * input for a loss from a year already filed. `tax.ts` carried `pierderiReportate = lei(0)` as a hardcoded
 * constant, so a person who reported a loss last year could not tell the app about it and every later year's
 * tax was overstated by the amount they had already lost and declared.
 *
 * **The rule, as corrected by `docs/ai/research/52_dividends_losses_withholding_fy2026.md` §Q1/§Q3.** The
 * register had this wrong on three counts and the correction is carried here, not appended to it:
 *
 * - the carry-forward is **art. 118 alin. (4)**, not alin. (3). Alin. (3) is the fracțiune-de-an rule
 *   („Veniturile din categoriile prevăzute la art. 61 lit. a), a¹), c) și f), ce se realizează într-o fracțiune
 *   de an … se consideră venit anual”) and has nothing to do with losses.
 * - the period is **5 ani fiscali consecutivi**, not 6 and not 7. It was 7 until OUG 115/2023 (MO
 *   1139/15.12.2023) pct. 70 art. LIII, from 2024 incomes.
 * - compensation is capped at **70 % of the net income of the SAME source**, is **per source**, runs
 *   **chronologically by age of loss** (alin. (5) lit. a)), and is **not elective** — „se reportează **și** se
 *   compensează”.
 *
 * **The ordering, which the brief calls a trap, is settled by the text and is not chosen here.** art. 118
 * alin. (2^4) caps the CAS/CASS deductions against „venitul anual impozabil **recalculat**”, and alin. (2)
 * lit. a) defines that word as the net AFTER the carried-in loss. So the loss goes first and the cap is
 * measured against what survives it. The apparent circularity dissolves because the two figures are capped by
 * different quantities: **rd.6 by 70 % of rd.3 — the PRE-loss net — and the deductions by the POST-loss net.**
 * Confirmed three independent ways in research/52 §Q3: the D212 rd.7 label itself („rd.3 − rd.6”), ANAF Iași
 * („Venit net anual impozabil = Venit net anual recalculat − cas − cass”), and ANAF Galați's worked example
 * (15.000 − 1.000 = 14.000; (14.000 − 1.500) × 10 % = 1.250). The test that pins this is the one named
 * `alin. (2^4) measures its ceiling against the POST-loss net`, below: it is the only case in this file where
 * the two orders produce different money.
 *
 * **Every expected figure is hand-derived** against the FY2026 anchor SM = 4.050 lei (CF art. 135¹ alin. (3)):
 * 12 SM = 48.600, 24 SM = 97.200, 72 SM = 291.600. For a net of 100.000 lei with no carried-in loss:
 * CAS = 25 % × 97.200 = 24.300 lei; CASS = 10 % × 100.000 = 10.000 lei; deductions 34.300 lei; base
 * 65.700 lei; tax 6.570 lei; total 40.870 lei.
 *
 * **Direction check, because the brief asks for one.** Every fix in this phase must make the person's
 * position no worse. A carried-in loss can only ever reduce the tax here: the totals below move DOWN
 * (40.870 → 38.870 → 34.300 lei). If a future change makes a loss increase a total, this file should fail.
 */
import { describe, expect, it } from 'vitest';
import { computeTaxEstimate, type PriorYearFiscalLoss } from './tax';
import type { TaxInputsReference } from './derived';
import type { CassLadderYear, PfaProfile } from './models';
import { selectRuleSet } from './fiscal';
import { addBani, lei, type Bani } from './money';

const NET = lei(100_000);
const EXPENSES = lei(0);

function ladderYear(): CassLadderYear[] {
  return [
    {
      fiscalYear: 2026,
      proprietateIntelectuala: lei(0),
      asocierePersoanaJuridica: lei(0),
      cedareaFolosinteiBunurilor: lei(0),
      activitatiAgricole: lei(0),
      investitii: lei(0),
      alteSurse: lei(0),
      cedareaSursa: 'patrimoniu_personal',
    },
  ];
}

function profile(): PfaProfile {
  return {
    id: 'p-loss-carry-in',
    regime: 'impozit_pe_venit',
    fiscalYear: 2026,
    socialInsuranceStatus: 'obligatoriu',
    cassLadderYears: ladderYear(),
  } as PfaProfile;
}

function inputs(): TaxInputsReference {
  return {
    regime: 'impozit_pe_venit',
    salaryStatus: 'nu',
    salaryIncomeLei: null,
    pensionerStatus: 'nu',
    pensionReceiptYears: [],
    pensionSuspensionYears: [],
    cassPreviousYearContext: null,
    foreignSicknessInsurance: null,
    cassLadderYears: ladderYear(),
    socialInsuranceStatus: 'obligatoriu',
    vatRegistration: { status: 'scutit_art310' as const },
    cashFloorLei: lei(0),
    fiscalYear: 2026,
    pfaStartDate: null,
    inputsKey: 'p-loss-carry-in:2026',
  };
}

async function engine(losses?: readonly PriorYearFiscalLoss[]) {
  const entry = selectRuleSet(2026, '2026-01-01');
  if (!entry) throw new Error('no FY2026 rule set is registered');
  return computeTaxEstimate({
    inputs: inputs(),
    profile: profile(),
    revenues: addBani(NET, EXPENSES),
    expenses: EXPENSES,
    revenuesNet: addBani(NET, EXPENSES),
    expensesNet: EXPENSES,
    expenseBase: { netFirst: EXPENSES, grossFirst: EXPENSES, divergent: false },
    flatRatioGross: null,
    flatRatioMethod: null,
    ruleRelease: entry.release,
    rules: [...entry.rules],
    ...(losses === undefined ? {} : { priorYearLosses: losses }),
  });
}

function ok(res: Awaited<ReturnType<typeof engine>>) {
  if (res.status !== 'computed') throw new Error(`engine refused: ${res.reason}`);
  return res;
}

const line = (res: { lines: { label: string; value: Bani }[] }, prefix: string) =>
  res.lines.find((l) => l.label.startsWith(prefix))?.value;

const RD5 = 'Pierderi fiscale reportate din anii precedenți';
const RD6 = 'Pierdere fiscală compensată în anul de raportare';
const RD7 = 'Venit net anual recalculat';
const CAP = 'Deduceri blocate de plafonul art. 118 alin. (2^4)';
const DEFINITIVE = 'Pierdere definitivă';

describe('B-121 — the loss can come in, and it comes in on the article’s own terms', () => {
  it('the baseline the whole file is measured against: no carried-in loss, tax 6.570 lei', async () => {
    const res = ok(await engine());
    expect(line(res, 'CAS (25%)')).toBe(lei(24_300));
    expect(line(res, 'CASS (10%)')).toBe(lei(10_000));
    expect(line(res, 'Venit net anual impozabil')).toBe(lei(65_700));
    expect(line(res, 'Impozit pe venit')).toBe(lei(6_570));
    expect(line(res, 'Total taxe')).toBe(lei(40_870));
    // No loss offered → no loss rows. Absence is reported by silence here, not by a row of zeros.
    expect(line(res, RD5)).toBeUndefined();
  });

  it('a prior-year loss entered: it reduces the base and the total, and the total moves DOWN', async () => {
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(20_000) }]));
    expect(line(res, RD5)).toBe(lei(20_000)); // rd.5
    expect(line(res, RD6)).toBe(lei(20_000)); // rd.6
    expect(line(res, RD7)).toBe(lei(80_000)); // rd.7 = rd.3 − rd.6
    expect(line(res, 'Venit net anual impozabil')).toBe(lei(45_700));
    expect(line(res, 'Impozit pe venit')).toBe(lei(4_570));
    // 2.000 lei less than the baseline: 10 % of the 20.000 lei the person had already lost.
    expect(line(res, 'Total taxe')).toBe(lei(38_870));
    expect((line(res, 'Total taxe') as Bani)).toBeLessThan(lei(40_870));
  });

  it('the 70 % ceiling: a loss larger than 70 % of the net offsets exactly 70 %, and the rest stays reportable', async () => {
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(90_000) }]));
    const report = res.lossCarryIn;
    if (!report) throw new Error('no lossCarryIn report on the result');
    expect(report.plafon).toBe(lei(70_000)); // 70 % × 100.000
    expect(report.compensata).toBe(lei(70_000));
    expect(report.ramase).toEqual([{ lossYear: 2025, amount: lei(20_000) }]);
    expect(line(res, RD6)).toBe(lei(70_000));
    expect(line(res, RD7)).toBe(lei(30_000));
  });

  it('the 70 % ceiling is measured on the PRE-loss net (rd.3), not on the net after the loss', async () => {
    // This is the second half of the anti-circularity. If the ceiling were 70 % of the POST-loss net, the
    // compensation c would have to satisfy c ≤ 0,7 × (100.000 − c), i.e. c ≤ 41.176 lei — a fixed point the
    // article never describes. rd.6 = min(rd.5, 70 % × rd.3) uses rd.3, the net BEFORE the carried-in loss,
    // and the observed 70.000 lei is only reachable on that reading.
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(90_000) }]));
    const report = res.lossCarryIn;
    if (!report) throw new Error('no lossCarryIn report');
    expect(report.plafon).toBe(lei(70_000)); // 70 % × 100.000 lei, the pre-loss net
    expect(report.compensata).toBe(lei(70_000));
    expect(report.compensata).toBeGreaterThan(lei(41_176)); // impossible under the post-loss reading
  });

  it('per source: a loss from another source is seen and named, never applied to this net', async () => {
    // art. 118 alin. (4): „pe fiecare sursă … obținute din aceeași sursă de venit”. A DPI loss cannot offset
    // an independent-activity net, and silently letting it would be the app inventing a deduction.
    const res = ok(await engine([{ source: 'drepturi_proprietate_intelectuala', lossYear: 2025, amount: lei(20_000) }]));
    expect(line(res, 'Venit net anual impozabil')).toBe(lei(65_700));
    expect(line(res, 'Impozit pe venit')).toBe(lei(6_570));
    const report = res.lossCarryIn;
    if (!report) throw new Error('no lossCarryIn report');
    expect(report.compensata).toBe(lei(0));
    expect(report.altaSursa).toEqual([
      { source: 'drepturi_proprietate_intelectuala', lossYear: 2025, amount: lei(20_000) },
    ]);
  });

  it('chronological by age: the older loss is consumed first, whatever order it arrives in', async () => {
    // art. 118 alin. (5) lit. a): „reportul se efectuează cronologic, în funcție de veşimea pierderii”.
    // Ceiling 70.000. Oldest-first uses the whole 2021 loss and 40.000 of the 2025 one, leaving 20.000 of
    // 2025. Newest-first would leave 10.000 of 2021 instead — and 2021 has one year left in its window,
    // while 2025 has four, so the wrong order burns the loss that was about to expire last.
    const losses: PriorYearFiscalLoss[] = [
      { source: 'activitate_independenta', lossYear: 2021, amount: lei(30_000) },
      { source: 'activitate_independenta', lossYear: 2025, amount: lei(60_000) },
    ];
    for (const order of [losses, [...losses].reverse()]) {
      const res = ok(await engine(order));
      const report = res.lossCarryIn;
      if (!report) throw new Error('no lossCarryIn report');
      expect(report.reportate).toBe(lei(90_000));
      expect(report.compensata).toBe(lei(70_000));
      expect(report.ramase).toEqual([{ lossYear: 2025, amount: lei(20_000) }]);
    }
  });

  it('the window is 5 ani fiscali: a sixth year out is a pierdere definitivă, reported not dropped', async () => {
    // art. 118 alin. (4) „următorii 5 ani fiscali consecutivi”; alin. (5) lit. c): the unabsorbed loss
    // „reprezintă pierdere definitivă a contribuabilului”. 2026 − 2021 = 5 → still inside. 2026 − 2020 = 6 →
    // outside, and it must be said out loud rather than quietly ignored.
    const res = ok(await engine([
      { source: 'activitate_independenta', lossYear: 2020, amount: lei(40_000) },
      { source: 'activitate_independenta', lossYear: 2021, amount: lei(30_000) },
    ]));
    const report = res.lossCarryIn;
    if (!report) throw new Error('no lossCarryIn report');
    expect(report.reportate).toBe(lei(30_000)); // only the 2021 loss is inside the window
    expect(report.compensata).toBe(lei(30_000));
    expect(report.expirate).toEqual([{ lossYear: 2020, amount: lei(40_000) }]);
    expect(line(res, DEFINITIVE)).toBe(lei(40_000));
  });

  it('alin. (2^4) measures its ceiling against the POST-loss net — the ordering the trap is about', async () => {
    // Net 100.000, carried-in loss 70.000 → rd.7 = 30.000. The CAS+CASS deductions are 34.300 lei.
    //   order A (loss first, then the cap — the text): ceiling 30.000 → 4.300 lei blocked → base 0.
    //   order B (cap first, then the loss):             ceiling 100.000 → nothing blocked → base −4.300.
    // Order B would drive the base negative and hide a loss behind a negative tax, which is the failure the
    // alineat exists to prevent. The blocked-deduction row is the observable difference, and it is 4.300 lei.
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(70_000) }]));
    expect(line(res, RD7)).toBe(lei(30_000));
    expect(line(res, CAP)).toBe(lei(4_300));
    expect(line(res, 'Venit net anual impozabil')).toBe(lei(0));
    expect(line(res, 'Impozit pe venit')).toBe(lei(0));
  });

  it('the loss never touches the contribution bases: CASS is excluded expressly, CAS by the article’s own order', async () => {
    // art. 170 alin. (1) final sentence: „La determinarea bazei anuale de calcul al contribuției de asigurări
    // sociale de sănătate nu se iau în considerare pierderile fiscale anuale prevăzute la art. 118.” For CAS
    // there is no equivalent exclusion, and research/52 §Q3 records the strong inference that art. 148 alin.
    // (3) measures the venit net struck BEFORE art. 118 offsetting — so a carried-in loss does not reduce the
    // CAS ceiling test either. Pinned as an equality, because "unchanged" is the claim.
    const without = ok(await engine());
    const withLoss = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(90_000) }]));
    expect(line(withLoss, 'CAS (25%)')).toBe(line(without, 'CAS (25%)'));
    expect(line(withLoss, 'CASS (10%)')).toBe(line(without, 'CASS (10%)'));
    expect(withLoss.bases.venitulNetDinActivitate).toBe(without.bases.venitulNetDinActivitate);
    // And the ceiling test itself: the person still owes CAS at the 24-SMN level on 100.000 lei of net even
    // though the year's taxable base has been driven to zero by a loss.
    expect(line(withLoss, 'CAS (25%)')).toBe(lei(24_300));
  });

  it('not elective: where a loss is inside the window and there is net to absorb it, it is applied', async () => {
    // „se reportează **și** se compensează” — the verb is mandatory, and the input has no election field to
    // set. A taxpayer who would rather save the loss for a better year cannot make that choice here, and the
    // engine must not offer one.
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2025, amount: lei(5_000) }]));
    const report = res.lossCarryIn;
    if (!report) throw new Error('no lossCarryIn report');
    expect(report.compensata).toBe(lei(5_000));
    expect(report.ramase).toEqual([]);
    expect(line(res, 'Impozit pe venit')).toBe(lei(6_070));
  });

  it('a loss offered but unusable still reports itself, so silence cannot be read as "there was no loss"', async () => {
    const res = ok(await engine([{ source: 'activitate_independenta', lossYear: 2019, amount: lei(10_000) }]));
    const report = res.lossCarryIn;
    if (!report) throw new Error('the result carries no lossCarryIn even though a loss was offered');
    expect(report.compensata).toBe(lei(0));
    expect(report.expirate).toEqual([{ lossYear: 2019, amount: lei(10_000) }]);
  });

  it('no loss offered: the result is byte-for-byte the pre-B-121 calculation', async () => {
    // The input is optional by construction, so every call site that predates B-121 computes the number it
    // always computed. This is what keeps the 311.200-lei seed pin and every persona hero untouched.
    const res = ok(await engine());
    expect(res.lossCarryIn).toBeUndefined();
    expect(line(res, 'Total taxe')).toBe(lei(40_870));
  });
});
