import { describe, expect, it } from 'vitest';
import { CHECK_LABELS, checkLabel, deadlineLabels, deadlineLabelFor } from './dashboard';

/**
 * PG-5 — the two label fallbacks, pinned.
 *
 * Both families used to answer an unknown key with a plausible generic: `deadlineLabelFor` returned
 * 'Termen fiscal' and `completenessLabel` returned 'date'. Both made a brand-new obligation look
 * handled — a rule added next quarter would render as a sentence nobody had written, and the test
 * suite would stay green. The fallback now returns the RAW key: ugly on screen, and loud in here.
 *
 * This file is the loud half. It is deliberately written as a contract over the maps, so the failure
 * lands on the person who adds the key, not on a reader who wonders why a deadline is called
 * "Termen fiscal".
 */

describe('deadlineLabelFor', () => {
  it('names the return and the year for the D212 family', () => {
    // Acceptance 1's exact wording: a term that names only an audience ("PFA") is not actionable.
    expect(deadlineLabelFor('pfa', 2026)).toBe('Declarația unică (D212) pentru 2026');
    expect(deadlineLabelFor('pfa', 2027)).toBe('Declarația unică (D212) pentru 2027');
  });

  it('renders Romanian for every key the rule packages actually use', () => {
    // `applies_to` values come from the registry in `domain/deadlines.ts`. If a rule adds one, this
    // list is where the omission is caught.
    const keys = Object.keys(deadlineLabels);
    for (const key of keys) {
      const rendered = deadlineLabelFor(key, 2026);
      expect(rendered).not.toBe(key);
      expect(rendered).not.toContain('_');
    }
    // Spelled out so a rename in the registry cannot pass by renaming both sides in lockstep without
    // anyone reading the sentence.
    expect(deadlineLabels.new_pfa(2026)).toBe('Declarația unică a unui PFA nou');
    expect(deadlineLabels['vat-registered-pfa'](2026)).toBe('Înregistrare în scop de TVA');
    expect(deadlineLabels.cas_annual(2026)).toBe('Declarație și plată CAS');
    expect(deadlineLabels.cass_annual(2026)).toBe('Declarație și plată CASS');
    expect(deadlineLabels.vat_periodic(2026)).toBe('Declarație periodică de TVA');
  });

  it('renders the RAW key for an unknown one, and never the old generic', () => {
    // The pin the orchestrator asked for: 'Termen fiscal' must not come back as a comfort word.
    expect(deadlineLabelFor('some_new_obligation', 2026)).toBe('some_new_obligation');
    expect(deadlineLabelFor('some_new_obligation', 2026)).not.toBe('Termen fiscal');
    expect(deadlineLabelFor('', 2026)).toBe('');
  });
});

describe('checkLabel', () => {
  it('covers every key completeness.ts emits', () => {
    // The producer's key list, restated here. A check added in `domain/completeness.ts` without a label
    // fails this test rather than rendering as its own identifier.
    const emitted = [
      'profile',
      'income',
      'expenses',
      'clients',
      'documents',
      'companyDocuments',
      'annualFiling',
      'vatFilingPeriod',
      'statements',
    ];
    for (const key of emitted) {
      expect(CHECK_LABELS[key], `no Romanian label for the completeness key '${key}'`).toBeTruthy();
      expect(checkLabel(key)).not.toBe(key);
    }
  });

  it('renders the RAW key for an unknown one, and never the old generic', () => {
    expect(checkLabel('brand_new_check')).toBe('brand_new_check');
    expect(checkLabel('brand_new_check')).not.toBe('date');
  });

  it('no longer labels keys the producer stopped emitting', () => {
    // `declarations` ("any declaration record exists") and `taxEstimate` ("did a calculation run") are
    // gone from `completeness.ts`. Keeping their labels would let a stale key look supported.
    expect(CHECK_LABELS.declarations).toBeUndefined();
    expect(CHECK_LABELS.taxEstimate).toBeUndefined();
  });
});
