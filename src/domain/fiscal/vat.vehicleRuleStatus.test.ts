/**
 * B-94 — the 50 % vehicle VAT cut, its EU authorisation, and the flag that says what is open.
 *
 * The premise this suite exists to hold in place is the one the research reversed: B-94 asked what
 * happens to the app's 50 % when CID (EU) 2024/1641 lapses on 31 December 2026, assuming the rule rests
 * on the derogation. It does not — the 50 % is art. 298 alin. (1) Cod fiscal, free-standing, with no date
 * and no reference to the derogation (`docs/ai/research/45_cid_2024_1641_vehicle_vat_2027.md` §4). So the
 * suite is weighted accordingly:
 *
 *  1. **the fraction does not change for FY2027** — the acceptance criterion that matters most, and the
 *     one an implementation is most tempted to break by "handling the expiry";
 *  2. **nothing in the rule set carries an end date for it** — no `effectiveTo`, no 100 % successor;
 *  3. **the flag carries its own as-of date**, because "not adopted" is an absence finding and an
 *     undated absence finding is a guess;
 *  4. **the flag says NOT ADOPTED, not REJECTED** — only one of those is supported;
 *  5. **the tail risk is recorded, not computed** — no deemed-supply machinery exists, and the three
 *     citation errors already fixed in the corpus stay fixed.
 */
import { describe, expect, it } from 'vitest';
import {
  VAT_VEHICLE_ART298_STATUS,
  decideInputVat,
  type InputVatExpenseRecord,
  type InputVatInput,
  type VatRegistration,
} from './vat';
import { PFA_2026_SYSTEM_REAL_PACKAGE } from './package2026';
import { PFA_2026_RELEASE } from './release2026';
import { vatReturn as vatReturnCopy } from '../../ui/copy/records';
import { lei } from '../money';

const REGISTERED: VatRegistration = { status: 'inregistrat_art316', effectiveFrom: '2026-01-01' };

/** A line that clears every other switch, so the only fact moving is the vehicle's and the year. */
function carLine(year: number): InputVatExpenseRecord {
  return {
    id: `ev-${year}`,
    date: `${year}-03-10`,
    paid: `${year}-03-20`,
    supplierCui: 'RO12345678',
    tip: 'factura',
    tva: { amount: lei(1000), currency: 'RON' },
    vatFacts: {
      destination: 'taxabila',
      supplierRegime: 'inregistrat',
      documentKind: 'factura',
      eFactura: 'da',
    },
    vehicleId: 'car',
  };
}

function decideYear(fiscalYear: number) {
  const input: InputVatInput = {
    expenses: [carLine(fiscalYear)],
    vehicles: [
      { id: 'car', years: [{ fiscalYear, use: 'mixed' }] },
    ],
    registration: REGISTERED,
    fiscalYear,
    asOfDate: `${fiscalYear}-10-31`,
  };
  return decideInputVat(input);
}

const outcomeOf = (d: ReturnType<typeof decideInputVat>) => d.lines[0]!.outcome;

describe('B-94 acceptance 1 — the 50 % is still 50 % for FY2027', () => {
  it('a restricted vehicle line in 2027 computes at 0.5 on the same art. 298 citation', () => {
    const d = decideYear(2027);
    expect(outcomeOf(d)).toMatchObject({
      kind: 'claimable',
      fraction: 0.5,
      rule: 'art. 298 alin. (1); Norme pct. 68 alin. (4)',
    });
    // Half of 1.000,00 lei of VAT, in FY2027 exactly as in FY2026.
    expect(d.claimableTotal).toBe(lei(500));
  });

  it('2026, 2027 and 2028 give the same outcome for the same facts', () => {
    const byYear = [2026, 2027, 2028].map((y) => {
      const o = outcomeOf(decideYear(y));
      return o.kind === 'claimable' ? { fraction: o.fraction, rule: o.rule } : o;
    });
    expect(byYear[1]).toEqual(byYear[0]);
    expect(byYear[2]).toEqual(byYear[0]);
  });

  it('the fraction the decision applies is the fraction the flag carries', () => {
    const o = outcomeOf(decideYear(2027));
    expect(o.kind === 'claimable' && o.fraction).toBe(VAT_VEHICLE_ART298_STATUS.fraction);
  });
});

describe('B-94 acceptance 4 — nothing gives the domestic rule an end date', () => {
  it('the anchor has no end date and is not flagged as derogation-dependent', () => {
    expect(VAT_VEHICLE_ART298_STATUS.anchor).toBe('art. 298 alin. (1) Cod fiscal');
    expect(VAT_VEHICLE_ART298_STATUS.anchorEndsOn).toBeNull();
    expect(VAT_VEHICLE_ART298_STATUS.anchorDependsOnDerogation).toBe(false);
  });

  it('no rule in the frozen package ends on 31.12.2026, and the release window stays open', () => {
    const endingAtLapse = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r) => r.effectiveTo === '2026-12-31',
    );
    expect(endingAtLapse).toEqual([]);
    expect(PFA_2026_RELEASE.effectiveTo ?? null).toBeNull();
  });

  it('no rule in the package switches a vehicle line to 100 % from 1 January 2027', () => {
    const successors = PFA_2026_SYSTEM_REAL_PACKAGE.filter(
      (r) => r.effectiveFrom >= '2027-01-01' || r.taxYear >= 2027,
    );
    expect(successors).toEqual([]);
  });
});

describe('B-94 acceptance 2/3 — the flag is data, dated, and says not adopted', () => {
  it('the flag names the CID, its end date and the proposed extension', () => {
    expect(VAT_VEHICLE_ART298_STATUS.derogation.name).toBe('CID (EU) 2024/1641');
    expect(VAT_VEHICLE_ART298_STATUS.derogation.endsOn).toBe('2026-12-31');
    expect(VAT_VEHICLE_ART298_STATUS.derogation.endsBy).toBe('art. 5 (2)');
    expect(VAT_VEHICLE_ART298_STATUS.extension.wouldEndOn).toBe('2029-12-31');
    expect(VAT_VEHICLE_ART298_STATUS.extension.proposedOn).toBe('2026-09-10');
    expect(VAT_VEHICLE_ART298_STATUS.extension.instrument).toBe('COM(2026) 457 final');
    expect(VAT_VEHICLE_ART298_STATUS.extension.file).toBe('2026/0253(NLE)');
    expect(VAT_VEHICLE_ART298_STATUS.extension.councilDocument).toBe('ST 13267/2026');
  });

  it('the absence finding carries its own as-of date, and a trigger to re-check it', () => {
    expect(VAT_VEHICLE_ART298_STATUS.extension.adopted).toBe(false);
    expect(VAT_VEHICLE_ART298_STATUS.asOf).toBe('2026-10-13');
    expect(VAT_VEHICLE_ART298_STATUS.recheckBy).toBe('2026-12-31');
  });

  it('the rendered wording names all four facts, including the as-of date', () => {
    const s = VAT_VEHICLE_ART298_STATUS;
    const text = [
      vatReturnCopy.cidStatusAnchor(s),
      vatReturnCopy.cidStatusDerogation(s),
      vatReturnCopy.cidStatusExtension(s),
      vatReturnCopy.cidStatusRisk(s),
      vatReturnCopy.cidStatusGap(s),
    ].join(' ');
    expect(text).toContain('art. 298 alin. (1) Cod fiscal');
    expect(text).toContain('CID (EU) 2024/1641');
    expect(text).toContain('31.12.2026');
    expect(text).toContain('31.12.2029');
    expect(text).toContain('COM(2026) 457 final');
    expect(text).toContain('13.10.2026');
  });

  it('the wording says not adopted, never rejected', () => {
    const s = VAT_VEHICLE_ART298_STATUS;
    const text = [
      vatReturnCopy.cidStatusExtension(s),
      vatReturnCopy.cidStatusAnchor(s),
      vatReturnCopy.cidStatusRisk(s),
    ].join(' ');
    expect(text).toMatch(/neadoptat|nu fusese adoptat/i);
    // „Respins" would be a claim the record does not support.
    expect(text).not.toMatch(/respins/i);
  });
});

describe('B-94 acceptance 5/6 — the tail risk is recorded, and the citations stay corrected', () => {
  it('the post-lapse scenario is recorded as a gap, not computed', () => {
    expect(VAT_VEHICLE_ART298_STATUS.postLapse.computed).toBe(false);
    expect(VAT_VEHICLE_ART298_STATUS.postLapse.domesticRuleStaysInForce).toBe(true);
    // The direction of the risk, stated: entitlement could widen, not narrow.
    expect(VAT_VEHICLE_ART298_STATUS.postLapse.direction).toBe('entitlement_could_be_broader');
    expect(vatReturnCopy.cidStatusGap(VAT_VEHICLE_ART298_STATUS)).toContain(
      'art. 26 (1) (a) din Directiva 2006/112/CE',
    );
  });

  it('the three citation errors already fixed in the corpus do not reappear', () => {
    const s = VAT_VEHICLE_ART298_STATUS;
    const rendered = JSON.stringify(s) + [
      vatReturnCopy.cidStatusAnchor(s),
      vatReturnCopy.cidStatusDerogation(s),
      vatReturnCopy.cidStatusExtension(s),
      vatReturnCopy.cidStatusRisk(s),
      vatReturnCopy.cidStatusGap(s),
    ].join(' ');
    // A Decision, not a Regulation.
    expect(rendered).not.toContain('32024R1641');
    expect(rendered).toContain('32024D1641');
    // The derogation is from art. 168 and art. 26 (1) (a); art. 169 is untouched.
    expect(rendered).not.toMatch(/168 (și|and) 169/);
    // art. 168a is an immovable-property provision, not the fallback for a flat cut-off.
    expect(rendered).not.toContain('168a');
    // art. 297 is the article art. 298 derogates FROM, not the anchor.
    expect(VAT_VEHICLE_ART298_STATUS.anchor).not.toContain('297');
  });
});

describe('B-94 landmine 4/5 — the two 50 %s stay apart, and so does alin. (4^1)', () => {
  it('the VAT flag says nothing about the income-tax 50 % at art. 68 alin. (7) lit. k)', () => {
    const rendered = JSON.stringify(VAT_VEHICLE_ART298_STATUS);
    expect(rendered).not.toMatch(/68 alin\. \(7\)/);
    expect(rendered).not.toContain('Titlul IV');
  });

  it('art. 298 alin. (4^1) keeps its own, different, derogation-conditional status elsewhere', () => {
    // The buildings rule IS derogation-conditional and still not in force; merging it into this flag
    // would give one status string to two alineate with opposite structures.
    expect(JSON.stringify(VAT_VEHICLE_ART298_STATUS)).not.toContain('4^1');
  });
});
