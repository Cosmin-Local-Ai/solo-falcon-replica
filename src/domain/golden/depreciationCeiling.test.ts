/**
 * PHASE 31 FIXTURE 7 — the 1.500 lei/lună amortisation ceiling, art. 28 alin. (14).
 *
 * **THE GRADE OF THIS FILE IS NOT UNIFORM, AND THAT IS THE POINT.**
 *
 * `docs/ai/research/47_published_worked_examples_fy2026.md` §8C records a direct, unresolved conflict:
 *
 * - **contapp.ro** (a PFA specialist, updated August 2026): the ceiling „se aplică tuturor autoturismelor
 *   din categoria M1, indiferent cât de mult le folosești în activitate. De el scapă doar vehiculele din
 *   cele patru categorii de excepție prevăzute la art. 28 alin. (14)."
 * - **contabilitatedigitala.ro**: „Această limitare se aplică **doar societăților plătitoare de impozit pe
 *   profit**."
 *
 * **These cannot both be right, and no published worked example exists of the ceiling binding on a PFA în
 * sistem real** (§10.1). Every example where the ceiling binds is an SRL plătitoare de impozit pe profit.
 *
 * So this file is split, and the split is in the test names:
 *
 * - the **arithmetic** of the ceiling — 1.841,67 → 1.500 → 341,67 — is **CORROBORATED**, because two
 *   independent practitioner sources print it. It is SRL arithmetic.
 * - **that the ceiling reaches a PFA at all** is **INFERENCE**. The statutory route is art. 68 alin. (4)
 *   lit. d), which requires PFA expenses „să respecte regulile privind amortizarea, prevăzute în titlul II",
 *   and the engine applies it. **Those assertions are regression guards, not authorities.** If the dissent
 *   turns out to be the law, the correct response is to change the rule and then change this file — not to
 *   have quietly asserted the safe thing here.
 * - the **contapp.ro PFA case**, where the ceiling is never engaged, is **FACT** and is a genuine PFA worked
 *   example. It is the only published PFA depreciation figure in the research.
 */
import { describe, expect, it } from 'vitest';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { depreciationSchedule, FISCAL_DEPRECIATION_RULE_ID, type FixedAssetFacts } from '../fiscal/depreciation';
import { lei } from '../money';

const depRule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === FISCAL_DEPRECIATION_RULE_ID)!;

function schedule(asset: FixedAssetFacts) {
  const out = depreciationSchedule(depRule, asset);
  if (out.status !== 'computed') throw new Error(`the schedule refused: ${out.gap} — ${out.reason}`);
  return out.years;
}

/** The M1 the sources describe: 110.500 lei at entry, 60 months, linear, put in function Ianuarie 2026. */
const M1_110500: FixedAssetFacts = {
  label: 'Autoturism M1', entryDate: '2026-01-10', putInFunctionDate: '2026-01-10',
  fiscalValue: lei(110_500), normalLifeMonths: 60, isM1Vehicle: true, method: 'liniar',
};

describe('FIXTURE 7A (CORROBORATED — contabilitatedigitala.ro + firmaromania.com, 2026; SRL arithmetic) — amortizare contabilă 1.841,67 → deductibilă 1.500 → nedeductibilă 341,67 lei/lună', () => {
  it('the one-month year carries all three published monthly figures exactly', () => {
    const years = schedule(M1_110500);
    const oneMonth = years.find((y) => y.months === 1);
    if (!oneMonth) throw new Error('no one-month year in the schedule');
    expect(oneMonth.uncapped).toBe(lei(1_841) + 67); // „amortizare contabilă 1.841,67 lei/lună"
    expect(oneMonth.deductible).toBe(lei(1_500)); // „amortizare deductibilă fiscal 1.500 lei/lună"
    expect(oneMonth.lost).toBe(lei(341) + 67); // „diferență nedeductibilă fiscal 341,67 lei/lună"
  });

  it('a full year: 22.100 lei of amortizare contabilă, 18.000 lei deductibilă, 4.100 lei pierdut', () => {
    // 1.500 lei/lună × 12 = 18.000 lei, and firmaromania.com prints the excess as „circa 4.100 lei pe an".
    // The engine lands on exactly 4.100 lei, because 110.500 / 5 ani = 22.100 lei and 22.100 − 18.000 = 4.100.
    const years = schedule(M1_110500);
    const full = years.find((y) => y.months === 12);
    if (!full) throw new Error('no full year in the schedule');
    expect(full.uncapped).toBe(lei(22_100));
    expect(full.deductible).toBe(lei(18_000));
    expect(full.lost).toBe(lei(4_100)); // „circa 4.100 lei pe an"
  });

  it('the excess is lost, not carried — the schedule has no carry-forward field to put it in', () => {
    // `research/36` §12.13 records the excess over 1.500 lei/lună as „nu se reportează și nu se recuperează
    // în anii următori" — corroborated secondary, no statutory text, because the cap is a deduction limit
    // rather than a timing rule. Asserting the absence is the guard: presenting it as a carry-forward would
    // invent a deduction.
    const years = schedule(M1_110500);
    for (const y of years) {
      expect(y.deductible + y.lost).toBe(y.uncapped);
      expect(y.lost).toBeGreaterThanOrEqual(0);
    }
    const totalLost = years.reduce((acc, y) => acc + y.lost, 0);
    const totalDeductible = years.reduce((acc, y) => acc + y.deductible, 0);
    // Nothing is recovered later: the deductible total is 1.500 lei × 60 months, and no year exceeds it.
    expect(totalDeductible).toBe(lei(1_500) * 60);
    expect(totalLost).toBe(lei(110_500) - totalDeductible);
  });

  it('the ceiling is per vehicle — „pentru fiecare" — with no one-car limit on amortisation', () => {
    // art. 28 alin. (14) says „pentru fiecare", and `research/40` §4 keeps this apart from art. 68 alin. (5)
    // lit. j), where RUNNING costs are limited to a single car. Two M1s therefore each get their own
    // 1.500 lei/lună. Asserted at the schedule level, where it is checkable.
    const a = schedule({ ...M1_110500, label: 'Autoturism M1 unu' }).find((y) => y.months === 12)!;
    const b = schedule({ ...M1_110500, label: 'Autoturism M1 doi' }).find((y) => y.months === 12)!;
    expect(a.deductible).toBe(lei(18_000));
    expect(b.deductible).toBe(lei(18_000));
  });
});

describe('FIXTURE 7B (FACT — contapp.ro, 24 februarie 2026, updated 28 septembrie 2026; a PFA, TVA 21 % neplătitoare) — utilaj 24.000 lei / 48 luni: 500 lei/lună, 4.500 lei în 2026', () => {
  it('the only published PFA depreciation worked example, reproduced to the leu', () => {
    // „24.000 / 48 = 500 lei pe lună"; deductible 2026 (apr–dec, 9 luni) = 4.500; 2027–2029 = 6.000 each;
    // 2030 (ian–mar) = 1.500. Punerea în funcțiune 10 martie 2026, so art. 28 alin. (12) lit. a) starts in
    // Aprilie — nine months in 2026.
    const years = schedule({
      label: 'Utilaj', entryDate: '2026-02-10', putInFunctionDate: '2026-03-10',
      fiscalValue: lei(24_000), normalLifeMonths: 48, method: 'liniar',
    });
    const at = (year: number) => years.find((y) => y.fiscalYear === year);
    expect(at(2026)?.months).toBe(9);
    expect(at(2026)?.uncapped).toBe(lei(4_500));
    expect(at(2027)?.uncapped).toBe(lei(6_000));
    expect(at(2028)?.uncapped).toBe(lei(6_000));
    expect(at(2029)?.uncapped).toBe(lei(6_000));
    expect(at(2030)?.months).toBe(3);
    expect(at(2030)?.uncapped).toBe(lei(1_500));
  });

  it('in that example the ceiling is never engaged, because 500 lei/lună is under 1.500 lei/lună', () => {
    // The example is car-free, so it pins the schedule and NOT the ceiling. Stating that explicitly is what
    // keeps it from being read as authority for the PFA-ceiling question in 7C below.
    const years = schedule({
      label: 'Utilaj', entryDate: '2026-02-10', putInFunctionDate: '2026-03-10',
      fiscalValue: lei(24_000), normalLifeMonths: 48, method: 'liniar',
    });
    for (const y of years) expect(y.lost).toBe(lei(0));
    // And it is not an M1, so art. 28 alin. (14) does not reach it at all.
    expect(years.every((y) => y.deductible === y.uncapped)).toBe(true);
  });
});

describe('FIXTURE 7C (INFERENCE — NOT an authority; regression guard) — the engine applies the 1.500 lei/lună ceiling to a PFA, and no published example proves it may', () => {
  /**
   * **Why this is INFERENCE grade.** Every published example in which the ceiling binds is an SRL plătitoare
   * de impozit pe profit, and the two best practitioner sources disagree about whether art. 28 alin. (14)
   * reaches a PFA at all (`research/47` §8C, §10.1, §11.2). The statutory route the app relies on is art. 68
   * alin. (4) lit. d) — PFA expenses must „să respecte regulile privind amortizarea, prevăzute în titlul II"
   * — and the FY2026 package encodes the ceiling in `FISCAL_DEPRECIATION_2026`, which the Titlul IV expense
   * engine reads. That is a reading, not a published worked result.
   *
   * **These assertions are guards against the app changing its mind silently.** They are not evidence that
   * the ceiling is right for a PFA, and they must not be cited as such.
   */
  it('INFERENCE — the same M1 schedule is capped for a PFA register: 1.500 lei/lună deductible, 341,67 lei/lună lost', () => {
    // The `depreciationSchedule` module has no entity-type parameter at all: it is the Titlul II amortisation
    // rule, and the Titlul IV engine reads it through art. 68 alin. (4) lit. d). The absence of a PFA branch
    // IS the app's reading, and this test is what makes changing it a deliberate act.
    const years = schedule(M1_110500);
    const oneMonth = years.find((y) => y.months === 1)!;
    expect(oneMonth.deductible).toBe(lei(1_500));
    expect(oneMonth.lost).toBe(lei(341) + 67);
  });

  it('INFERENCE — the ceiling parameter is 1.500 lei/lună on the FY2026 package, with art. 28 alin. (14) as its citation', () => {
    const cap = depRule.parameters.find((p) => p.id === 'm1_monthly_cap')!;
    expect(cap.value).toBe(lei(1_500));
    expect(depRule.sourceArticle ?? '').toContain('art. 28 alin. (14)');
  });

  it('INFERENCE — the dissent is recorded as a dissent, not resolved: contabilitatedigitala.ro says SRL-only', () => {
    // Asserted so that if someone decides the dissent is the law, they must edit this test and say why.
    // The app's position: art. 68 alin. (4) lit. d) flows the Titlul II amortisation rules into Titlul IV,
    // and art. 28 alin. (14) contains no entity-type qualifier.
    const cap = depRule.parameters.find((p) => p.id === 'm1_monthly_cap')!;
    expect(String(cap.description)).toContain('art. 28 alin. (14)');
    expect(String(cap.description)).not.toContain('doar societăților');
  });

  it('INFERENCE — a claimed art. 28 alin. (14) exception category lifts the ceiling; it is declared, never inferred', () => {
    // The four exception categories are the only escape the article states. `research/36` §12.6 records that
    // the Norme never say how any of them is justified. The app asks; it does not read it off a label.
    const years = schedule({ ...M1_110500, m1ExceptionCategory: 'transport_persoane_cu_plata_inclusiv_taxi' });
    const oneMonth = years.find((y) => y.months === 1)!;
    expect(oneMonth.deductible).toBe(lei(1_841) + 67); // uncapped
    expect(oneMonth.lost).toBe(lei(0));
  });
});
