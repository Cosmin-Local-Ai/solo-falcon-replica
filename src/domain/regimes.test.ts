import { describe, expect, it } from 'vitest';
import {
  PFA_REGIME_DESCRIPTORS,
  PFA_REGIME_VALUES,
  isComputableRegime,
  isSelectableRegime,
  regimeRefusalReason,
  selectableRegimes,
} from './regimes';
import type { PfaRegime } from './models';

/**
 * Phase 6 regime model (docs/ai/phases/06_fiscal_profile.md §3).
 *
 * The rules of record for 2026 support exactly ONE regime for a PFA. Everything else must be
 * refused with a reason, never silently coerced into a number — and never dropped from the
 * payload either (that would be the data-loss failure mode Phase 6 had to avoid).
 */
describe('regime model — one computable regime, no invented alternatives', () => {
  it('the union carries exactly the three regimes the app can meet in a payload', () => {
    expect([...PFA_REGIME_VALUES].sort()).toEqual(
      ['impozit_pe_cit', 'impozit_pe_venit', 'norma_venit'].sort(),
    );
  });

  it('every regime in the union has a descriptor, so none can fall through undefined', () => {
    for (const regime of PFA_REGIME_VALUES) {
      expect(PFA_REGIME_DESCRIPTORS[regime]).toBeDefined();
      expect(PFA_REGIME_DESCRIPTORS[regime].value).toBe(regime);
    }
  });

  it('only impozit_pe_venit is computable', () => {
    expect(isComputableRegime('impozit_pe_venit')).toBe(true);
    expect(isComputableRegime('impozit_pe_cit')).toBe(false);
    expect(isComputableRegime('norma_venit')).toBe(false);
  });

  it('the UI may offer exactly one regime — impozit_pe_cit is never offered (B-9)', () => {
    const offered = selectableRegimes().map(r => r.value);
    expect(offered).toEqual(['impozit_pe_venit']);
    expect(offered).not.toContain('impozit_pe_cit');
    expect(offered).not.toContain('norma_venit');
    // Selectable is never wider than computable: no option the engine would then refuse.
    for (const r of selectableRegimes()) {
      expect(isComputableRegime(r.value)).toBe(true);
      expect(isSelectableRegime(r.value)).toBe(true);
    }
  });

  it('a computable regime produces no refusal', () => {
    expect(regimeRefusalReason('impozit_pe_venit')).toBeNull();
  });

  it('impozit_pe_cit is refused as a data-integrity failure, quoting the provisions (B-14)', () => {
    const reason = regimeRefusalReason('impozit_pe_cit');
    expect(reason).not.toBeNull();
    expect(reason!).toContain('impozit_pe_cit');
    expect(reason!).toContain('nu poate aparține unui PFA');
    expect(reason!).toContain('art. 13 alin. (1)');
    expect(reason!).toContain('art. 14');
    expect(reason!).toContain('art. 15');
    expect(reason!).toContain('art. 120');
    expect(reason!).toContain('abrogată');
    expect(reason!).toContain('OUG 128/2024');
  });

  it('norma_venit is refused as a boundary, with no invented norm values', () => {
    const reason = regimeRefusalReason('norma_venit');
    expect(reason).not.toBeNull();
    expect(reason!).toContain('norma_venit');
    expect(reason!).toContain('nu poate fi calculat');
    expect(reason!).toContain('art. 68 alin. (1)');
    expect(reason!).toContain('art. 118 alin. (6)');
    expect(reason!).toContain('nu inventăm valori');
    // A refusal must not smuggle in a number that looks like a norm value.
    expect(reason!).not.toMatch(/\d+\s*lei/);
  });

  it('every refusal cites at least one legal provision', () => {
    for (const regime of PFA_REGIME_VALUES) {
      const reason = regimeRefusalReason(regime);
      if (reason === null) continue;
      expect(reason).toContain('art.');
    }
  });

  it('descriptors carry the wording the UI shows, so labels are not duplicated in components', () => {
    for (const regime of PFA_REGIME_VALUES) {
      expect(PFA_REGIME_DESCRIPTORS[regime].label.length).toBeGreaterThan(0);
      expect(PFA_REGIME_DESCRIPTORS[regime].note).toContain('art.');
    }
  });

  it('an unknown regime string is refused rather than accepted', () => {
    // The schema rejects unknown strings, but the engine gate must not trust its input.
    expect(isComputableRegime('microizator' as PfaRegime)).toBe(false);
    expect(isSelectableRegime('microizator' as PfaRegime)).toBe(false);
    expect(regimeRefusalReason('microizator' as PfaRegime)).toContain(
      'nu este unul dintre regimurile cunoscute',
    );
    expect(regimeRefusalReason('microizator' as PfaRegime)).toContain('art. 123 alin. (1)');
  });
});
