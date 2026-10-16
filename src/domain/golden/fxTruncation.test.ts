/**
 * PHASE 31 FIXTURE 3 — the FX rounding fixture. **RELABELED 2026-10-15 (brief 69 / D-ROUND-2).**
 *
 * **WHAT THIS FILE IS: a FACT about what one ANAF leaflet published, from a document that is internally
 * inconsistent on rounding. It is NOT a specification, and it must not be read as an oracle.**
 *
 * The header of this file used to assert „ANAF applies art. 66 to each step”. That is **refuted** — see
 * `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md`. The earlier reading across this file's three
 * `it.fails` treated the published chain as a correct answer the engine was missing. It is not.
 *
 * **SOURCE** — ANAF DGFP București / Admin. Sector 4, „Declarația unică … cedarea folosinței bunurilor",
 * item 18, `https://static.anaf.ro/static/10/Bucuresti/Dec_Unica_PF_Cedare_Fol.pdf`.
 * **FISCAL YEAR OF THE SOURCE — 2024. SMN THE SOURCE USED — 3.300 lei.**
 * Recorded in `docs/ai/research/47_published_worked_examples_fy2026.md` §3B; **corrected in reading** by
 * `docs/ai/research/53_anaf_sector4_rounding_inconsistency.md`, which is the file to cite from now on.
 *
 * ── The document contains TWO complete chains for the same rent ───────────────────────────────────────
 *
 * It prices 500 EUR de chirie la două cursuri diferite — daily 4,977 pe 1 iulie 2024, și media anuală BNR
 * 4,974 — and prints a full chain for each. Two agents read across the boundary between them and each got a
 * different answer. Both chains are reproduced below, in full, because the inconsistency is the evidence.
 *
 * **Chain 1 — daily rate 4,977 (payment date)**
 * | Step | Exact | ANAF prints |
 * |---|---|---|
 * | 500 EUR × 4,977 | 2.488,50 | **2.488** |
 * | × 6 months | 14.928 | **14.928** |
 * | forfetar 20 % | 2.985,60 | **2.986** |
 * | net | 11.942,40 (as 80 %) | **11.942** |
 * | impozit 10 % | 1.194,20 | **1.194** |
 *
 * **Chain 2 — BNR annual average 4,974**
 * | Step | Exact | ANAF prints |
 * |---|---|---|
 * | 500 EUR × 4,974 | 2.487,00 | **2.487** |
 * | × 6 months | 14.922 | **14.922** |
 * | forfetar 20 % | 2.984,40 | **2.984** |
 * | net | 11.937,60 | **11.938** |
 * | impozit 10 % | 1.193,80 | **1.193** |
 *
 * The chain-2 impozit row is ANAF's own basis: 10 % **of its already-rounded net** 11.938. The engine takes
 * 10 % of the unrounded 11.937,60, which is 1.193,76. The two chains do not share an exact tax — four bani
 * apart, because one rounded an intermediate and the other did not. That is part of the inconsistency.
 *
 * ── The finding: three cases separate art. 66 from a plain floor, and they point opposite ways ───────
 *
 * A case separates the two rules only when the leu fraction **exceeds 50 bani**. Across both chains there
 * are exactly three such cases:
 *
 * | # | Step | Exact | ANAF | art. 66 | floor | ANAF followed |
 * |---|---|---|---|---|---|---|
 * | 1 | chain 1 forfetar | 2.985,**60** | 2.986 | 2.986 | 2.985 | **art. 66** |
 * | 2 | chain 2 net | 11.937,**60** | 11.938 | 11.938 | 11.937 | **art. 66** |
 * | 3 | chain 2 impozit | 1.193,**80** | 1.193 | 1.194 | 1.193 | **floor** |
 *
 * **Two favour art. 66, one favours a floor. The document contradicts itself on its face.** The conversion
 * line — the actual B-113 question — separates **neither** way: 2.488,50 sits exactly on art. 66's inclusive
 * 50-bani boundary, and 2.487,00 has no fraction at all. So no example in this document, or in any reachable
 * official material, decides which rule rounds a converted amount.
 *
 * ── What the app therefore does, and what it does not claim ───────────────────────────────────────────
 *
 * D-ROUND-2 rounds the conversion product to a whole leu with `roundArt66`, because that is what ANAF
 * **presents** (2.488, not 2.488,50) and because the whole-leu figure is what the leaflet then multiplies
 * by 6. It is a reasoned choice, not a cited rule; `fx/convert.ts` `ROUNDING_CHOICE` carries the contrary
 * arguments. **Nothing in this file asserts that art. 66 governs currency conversion.**
 *
 * The app does **not** round every intermediate sum. The forfetar and net findings below stay red on
 * purpose: matching them would mean adopting per-step rounding, which this same document does inconsistently
 * (case 3). They are kept as `it.fails` so the gap is visible, and they are named as a **deliberate**
 * non-match rather than as a defect.
 */
import { describe, expect, it } from 'vitest';
import { convertToRon } from '../fx/convert';
import { fixtureRateProvider } from '../fx/provider';
import type { FxRateRecord } from '../fx/rates';
import { calculatorRegistry } from '../fiscal/calculators';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from '../fiscal/package2026';
import { money, majorToMinor, lei, formatBani, roundArt66, type Bani } from '../money';

const art84Rule = PFA_2026_SYSTEM_REAL_PACKAGE.find((r) => r.ruleId === 'CEDARE_ART84_2026')!;

/** The two BNR numbers ANAF uses for one contract: the rate on 1 iulie 2024, and the 2024 annual average. */
const RATE_1_IULIE_2024: FxRateRecord = {
  currency: 'EUR', rate: '4.9770', rateKind: 'daily_reference', rateDate: '2024-07-01',
  seriesCode: 'CURSZ_EUR', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2025-01-15T00:00:00Z',
  provisional: false, entryMode: 'fetched',
};
const ANNUAL_AVERAGE_2024: FxRateRecord = {
  currency: 'EUR', rate: '4.9740', rateKind: 'annual_average', rateYear: 2024,
  seriesCode: 'CURSA_EURM', sourceUrl: 'https://www.bnr.ro', fetchedAt: '2025-01-15T00:00:00Z',
  provisional: false, entryMode: 'manual',
};

function eurMajor(major: number) {
  return money(majorToMinor(major, 'EUR'), 'EUR');
}

/** Convert an arbitrary euro amount at a named rate. The granularity is the caller's, which is the point. */
function convertEurAt(rate: FxRateRecord, major: number, onDate: string): Bani {
  const res = convertToRon(eurMajor(major), { basis: 'payment_date_daily', onDate }, fixtureRateProvider([rate]));
  if (!res.ok) throw new Error(`the conversion refused: ${JSON.stringify(res)}`);
  return res.ron.amount;
}

function monthlyRent() {
  return eurMajor(500);
}

function convertDaily(rate: FxRateRecord, onDate: string): Bani {
  const res = convertToRon(monthlyRent(), { basis: 'payment_date_daily', onDate }, fixtureRateProvider([rate]));
  if (!res.ok) throw new Error(`the conversion refused: ${JSON.stringify(res)}`);
  return res.ron.amount;
}

function convertAnnualAverage(rate: FxRateRecord, year: number): Bani {
  const res = convertToRon(monthlyRent(), { basis: 'income_realisation_year_annual_average', incomeRealisationYear: year }, fixtureRateProvider([rate]));
  if (!res.ok) throw new Error(`the conversion refused: ${JSON.stringify(res)}`);
  return res.ron.amount;
}

function determine(gross: Bani): { net: Bani; tax: Bani; forfetar: Bani } {
  const res = calculatorRegistry['calc-cedare-art84-flat-ratio'](art84Rule, { gross });
  if ('reviewRequired' in res) throw new Error(res.reason);
  if (typeof res.determinedNet !== 'number') throw new Error('the rule reported no determined net');
  return {
    net: res.determinedNet as Bani,
    tax: res.value as Bani,
    forfetar: (gross - res.determinedNet) as Bani,
  };
}

describe('FIXTURE 3, chain 1 — what ANAF published at the payment-date rate 4,977 (FACT about the leaflet, not a specification)', () => {
  it('the conversion line: ANAF prints 2.488 lei, and since D-ROUND-2 the engine produces 2.488 lei too', () => {
    // ANAF, verbatim: „500 euro x 4977 lei = 2488 lei lunar". The exact product is 2.488,50 lei.
    //
    // This assertion used to be `it.fails`, with the published value held up as the answer the engine
    // missed. It is now a passing assertion, and the reason it passes is **not** that the leaflet settled
    // anything — it is that the app chose to round the product. The leaflet cannot distinguish this from a
    // floor: 2.488,50 sits exactly on art. 66's inclusive-50 boundary, where both rules agree.
    expect(convertDaily(RATE_1_IULIE_2024, '2024-07-01')).toBe(lei(2_488));
  });

  it('the exact product was 2.488,50 lei; the half-leu is what the rounding removed, not what ANAF omitted', () => {
    // 500 EUR × 4,9770 = 248.850 bani before rounding. Kept as a literal so the size of what rounding
    // absorbs is always one line away from the rounded figure.
    const exactProduct: Bani = 248_850 as Bani;
    expect(exactProduct).toBe(248_850);
    expect(roundArt66(248_850)).toBe(lei(2_488));
    expect(convertDaily(RATE_1_IULIE_2024, '2024-07-01')).toBe(roundArt66(248_850));
  });

  it('where the product is already a whole leu, rounding changes nothing: 500 EUR × 4,974 = 2.487 lei', () => {
    // ANAF's own definitive figure at the BNR annual average: „2.487". The engine reproduces it exactly,
    // because 500 × 4,974 = 2.487,00 has nothing to round. The control case: it shows the movement in the
    // chain-1 line is about the fraction, not about the rate or the basis.
    expect(convertAnnualAverage(ANNUAL_AVERAGE_2024, 2024)).toBe(lei(2_487));
  });

  it('the six-month gross: ANAF 14.928, and the engine now reaches 14.928 — by summing six rounded months', () => {
    // ANAF: „2.488 × 6 = 14.928". The engine's month is now 2.488 lei, so six of them are 14.928 lei.
    // Before D-ROUND-2 the engine's month was 2.488,50 and six of them were 14.931 lei — 3 lei apart.
    //
    // **This is the §7 ordering finding, and it is not free.** The engine reaches ANAF's gross because it
    // converts **per record** and sums afterwards, not because it sums and then rounds. See the ordering
    // block at the end of this file for the case where the same rent gives a different gross.
    const anafGross = lei(2_488) * 6;
    const engineGross = convertDaily(RATE_1_IULIE_2024, '2024-07-01') * 6;
    expect(anafGross).toBe(lei(14_928));
    expect(engineGross).toBe(lei(14_928));
  });

  it.fails("NOT A SPECIFICATION — ANAF's chain-1 forfetar is 2.986 lei; the engine keeps 2.985,60, on purpose", () => {
    // ANAF, on gross 14.928: forfetar 2.986, net 11.942, impozit 1.194 lei.
    //
    // This stays red, and it stays red **deliberately**. Matching it would mean rounding every intermediate
    // sum to a whole leu, and this same document does that inconsistently: chain 2's impozit of 1.193,80 is
    // published as 1.193, which is a floor, not art. 66. Adopting per-step rounding to satisfy this line
    // would break the other line, and no primary text says which one the legislator meant.
    //
    // D-ROUND-2 rounds the **conversion product**. It does not extend art. 66 to deduction lines, and this
    // red test is the visible record of that boundary.
    expect(determine(lei(14_928)).forfetar).toBe(lei(2_986)); // ANAF's figure, not a target.
  });

  it.fails("NOT A SPECIFICATION — ANAF's chain-1 net is 11.942 lei; the engine keeps 11.942,40, on purpose", () => {
    // Same reasoning as the forfetar above: this is the boundary of D-ROUND-2, not an unfixed defect.
    expect(determine(lei(14_928)).net).toBe(lei(11_942));
  });

  it("the chain-1 figure where both conventions land together: impozit 1.194 lei", () => {
    // ANAF: „impozit 1.194 lei". The engine also says 1.194 lei — the tax is a sum actually due, which is
    // the one step art. 66 is confirmed to govern, and the calculators already round it.
    expect(determine(lei(14_928)).tax).toBe(lei(1_194));
  });

  it('chain 1 as the engine actually computes it, pinned beside the published one', () => {
    const { forfetar, net, tax } = determine(lei(14_928));
    expect(forfetar).toBe(lei(2_985) + 60); // 2.985,60 lei — the engine's
    expect(net).toBe(lei(11_942) + 40); // 11.942,40 lei — the engine's
    expect(tax).toBe(lei(1_194)); // where the two land together
  });

  it('the FY2024 threshold in this example is NOT a FY2026 threshold, and nothing here may be read as one', () => {
    // ANAF: „nu datorează CASS, întrucât venitul net anual este sub plafonul minim de 6 salarii minime …
    // Salariul minim brut pe țară pentru anul 2024 a fost în sumă de 3300 lei/lună." That floor is
    // 6 × 3.300 = 19.800 lei. The FY2026 floor the rule package holds is 6 × 4.050 = 24.300 lei.
    const anafFy2024Floor = lei(19_800);
    expect(anafFy2024Floor).not.toBe(lei(24_300));
    const fy2026Floor = art84Rule.parameters.find((p) => p.id === 'min_base');
    // art. 84 carries no CASS parameter of its own — the rungs live on CASS_2026 — and that is deliberate:
    // one legal figure, one source. Asserted so this file cannot be read as holding a second floor.
    expect(fy2026Floor).toBeUndefined();
  });
});

/**
 * Chain 2 was **absent from this file until 2026-10-15**, and its absence is why two agents read the
 * leaflet differently and both believed it was consistent. Every figure below is ANAF's own, published for
 * the same 500 EUR of rent at the BNR annual average.
 */
describe('FIXTURE 3, chain 2 — the same rent at the BNR annual average 4,974, where ANAF contradicts art. 66', () => {
  it('the conversion line again gives no separation: 2.487,00 lei is already whole', () => {
    expect(convertAnnualAverage(ANNUAL_AVERAGE_2024, 2024)).toBe(lei(2_487));
    expect(lei(2_487) * 6).toBe(lei(14_922)); // ANAF's published chain-2 gross, reproduced exactly.
  });

  it('forfetar: ANAF prints 2.984 lei on an exact 2.984,40 — art. 66 and a floor agree here', () => {
    // 14.922 lei × 20 % = 2.984,40 lei. Fraction 40 bani: art. 66 neglects it, and so does a floor. This is
    // NOT a separating case, which is why it is pinned as agreement rather than as a finding.
    const gross = lei(14_922);
    expect(determine(gross).forfetar).toBe(lei(2_984) + 40); // the engine's 2.984,40
    expect(roundArt66(determine(gross).forfetar)).toBe(lei(2_984)); // what art. 66 would give = ANAF's figure
  });

  it('net: ANAF prints 11.938 lei on an exact 11.937,60 — this one DOES separate, and ANAF followed art. 66', () => {
    // 11.937,60 lei: fraction 60 bani exceeds 50, so art. 66 raises it to 11.938 and a floor leaves 11.937.
    // ANAF printed 11.938 → art. 66. Separating case #2.
    const netExact = determine(lei(14_922)).net;
    expect(netExact).toBe(lei(11_937) + 60);
    expect(roundArt66(netExact)).toBe(lei(11_938)); // ANAF's figure
    expect(lei(11_937)).not.toBe(lei(11_938)); // the floor would have given a different leu
  });

  it('impozit: ANAF prints 1.193 lei, the engine reports 1.194 — separating case #3, and the chains do not share an exact value', () => {
    // The engine: net 11.937,60 lei × 10 % = 1.193,76 lei, and the calculators already round the sum
    // actually due with art. 66 — fraction 76 bani exceeds 50, so 1.194 lei.
    const engineNet = determine(lei(14_922)).net;
    const engineTaxExact = 119_376 as Bani; // 10 % of 11.937,60
    expect(engineNet).toBe(lei(11_937) + 60);
    expect(roundArt66(engineTaxExact)).toBe(lei(1_194));
    expect(determine(lei(14_922)).tax).toBe(lei(1_194));

    // ANAF: it had already rounded the net to 11.938, so its tax base is 1.193,80 — and it printed 1.193,
    // which is a floor on that value. Art. 66 on the same value gives 1.194. Separating case #3, and it
    // points the opposite way from cases #1 and #2.
    const anafTaxExact = 119_380 as Bani; // 10 % of ANAF's own rounded 11.938
    expect(roundArt66(anafTaxExact)).toBe(lei(1_194));
    expect(lei(1_193)).not.toBe(lei(1_194)); // ANAF's published figure is the floor's answer

    // The two chains do not even agree on the exact tax: 1.193,76 against 1.193,80, because one rounded the
    // net before multiplying and the other did not. That is the inconsistency, stated as four bani.
    expect(anafTaxExact - engineTaxExact).toBe(4);
  });

  it('the three separating cases, asserted as the table research/53 §3 records them', () => {
    // Two favour art. 66, one favours a floor. Pinned as data so a later reader cannot quietly pick the
    // convenient two and forget the third.
    const cases = [
      { step: 'chain 1 forfetar', exact: lei(2_985) + 60, anaf: lei(2_986), art66: roundArt66(lei(2_985) + 60), floor: lei(2_985) },
      { step: 'chain 2 net', exact: lei(11_937) + 60, anaf: lei(11_938), art66: roundArt66(lei(11_937) + 60), floor: lei(11_937) },
      { step: 'chain 2 impozit', exact: lei(1_193) + 80, anaf: lei(1_193), art66: roundArt66(lei(1_193) + 80), floor: lei(1_193) },
    ];
    const verdicts = cases.map(c => (c.anaf === c.art66 ? 'art66' : c.anaf === c.floor ? 'floor' : 'neither'));
    expect(verdicts).toEqual(['art66', 'art66', 'floor']);
    // Every one of them is a genuine separator: the fraction exceeds 50 bani in all three.
    for (const c of cases) expect(c.exact % 100).toBeGreaterThan(50);
  });
});

/**
 * D-ROUND-2 — what the engine now does, and the boundary of what it does.
 *
 * The conversion product is rounded; intermediate deduction sums are not. Both halves are pinned, because a
 * reader who only sees the first will assume the second follows.
 */
describe('D-ROUND-2 — the conversion product is whole-leu, and that is where it stops', () => {
  it('art. 66\'s boundary is the article\'s own: 50 bani or less neglected, more than 50 raised', () => {
    // „neglijarea fracțiunilor de până la 50 de bani **inclusiv** și majorarea la leu a fracțiunilor ce
    // depășesc 50 de bani." The inclusive boundary is what the ANAF example cannot test — 2.488,50 sits
    // exactly on it — so it is pinned here on both sides.
    expect(roundArt66(248_850)).toBe(248_800); // 2.488,50 → 2.488 — exactly 50, neglected
    expect(roundArt66(248_950)).toBe(248_900); // 2.489,50 → 2.490 — exactly 50 again, neglected
    expect(roundArt66(248_951)).toBe(249_000); // 2.489,51 → 2.490 — 51 exceeds 50, raised
    expect(roundArt66(248_849)).toBe(248_800); // 2.488,49 → 2.488
  });

  it('the published chain\'s first two steps, asserted as the engine\'s own behaviour', () => {
    // Acceptance 3 of brief 69: 500 EUR × 4,977 → 2.488 lei, and 2.488 × 6 → 14.928 lei.
    const month = convertDaily(RATE_1_IULIE_2024, '2024-07-01');
    expect(month).toBe(lei(2_488));
    expect(month * 6).toBe(lei(14_928));
    // And the whole-leu property is structural, not a coincidence of this rate: the converted amount has no
    // bani remainder at all.
    expect(month % 100).toBe(0);
  });

  it('the divergence that remains is on the deduction line, and it is stated in money', () => {
    // The conversion line now agrees with ANAF. What still diverges is the forfetar: 0,40 lei on a
    // half-contract-year gross. `formatBani` so a failure message reads as money.
    const anafForfetar = lei(2_986);
    const engineForfetar = determine(lei(14_928)).forfetar;
    expect(`${formatBani(anafForfetar)} / ${formatBani(engineForfetar)}`).toBe('2.986,00 / 2.985,60');
    expect(`${formatBani(lei(2_488))} / ${formatBani(convertDaily(RATE_1_IULIE_2024, '2024-07-01'))}`)
      .toBe('2.488,00 / 2.488,00');
  });

  it('§7 — ORDERING, reported not chosen: six monthly documents give 14.928, one half-year document gives 14.931', () => {
    // ANAF's published gross is the sum of **rounded months**: 2.488 × 6 = 14.928. The app reaches that
    // figure because it converts per record — `fx/ledger.ts` maps each record through `convertField`, and
    // `estimateBasis.ts selectCedareGross` converts each document before `sumBani`.
    //
    // But the same rent recorded as ONE document for the same six months converts 3.000 EUR once:
    // 3.000 × 4,9770 = 14.931,00 lei, already whole, so rounding cannot recover ANAF's 14.928.
    //
    // **This is a finding about where the rounding belongs, and it is reported rather than resolved.**
    // Rounding at conversion makes the total depend on how the taxpayer happened to split their documents.
    // The app does not average months, does not re-split documents, and does not re-round a sum — none of
    // those is licensed by anything in the corpus. Both numbers are pinned so the dependency is visible.
    const sixMonthly = convertEurAt(RATE_1_IULIE_2024, 500, '2024-07-01')
      + convertEurAt(RATE_1_IULIE_2024, 500, '2024-08-01')
      + convertEurAt(RATE_1_IULIE_2024, 500, '2024-09-01')
      + convertEurAt(RATE_1_IULIE_2024, 500, '2024-10-01')
      + convertEurAt(RATE_1_IULIE_2024, 500, '2024-11-01')
      + convertEurAt(RATE_1_IULIE_2024, 500, '2024-12-01');
    const oneHalfYear = convertEurAt(RATE_1_IULIE_2024, 3_000, '2024-07-01');
    expect(sixMonthly).toBe(lei(14_928)); // ANAF's published gross
    expect(oneHalfYear).toBe(lei(14_931)); // the same rent, one document
    expect(oneHalfYear - sixMonthly).toBe(lei(3)); // 3 lei, from record granularity alone
  });

  it('and the never-derive refusal is untouched by any of this: no average is ever computed from dailies', () => {
    // D-ROUND-2 changes what happens to a product. It does not change where a rate may come from. Pinned
    // here so a future reader cannot read "round the conversion" as "derive the average".
    // `fx/annualAverageNeverDerived.test.ts` is the full pin; this is the one-line statement beside the
    // fixture that made the rounding change tempting to over-read.
    const res = convertToRon(
      monthlyRent(),
      { basis: 'income_realisation_year_annual_average', incomeRealisationYear: 2024 },
      // Only the daily row for 2024 is stored. The average of those dailies is 4,977 — a number the store
      // could compute and does not.
      fixtureRateProvider([RATE_1_IULIE_2024]),
    );
    if (res.ok || res.reason !== 'no_rate') throw new Error(`expected a no_rate refusal, got ${JSON.stringify(res)}`);
    expect(res.detail).toContain('nu se calculează din cursurile zilnice');
  });
});
