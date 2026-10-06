/**
 * The PFA fiscal-regime model — one source of truth for what a PFA may hold, what the
 * UI may offer, and what the engine may compute (Phase 6, `docs/ai/phases/06_fiscal_profile.md` §3).
 *
 * The regime is NOT a neutral selector. For the 2026 income year a PFA can only be a
 * Titlul IV (impozit pe venit) taxpayer in sistem real:
 *  - CF art. 13 alin. (1), art. 14 and art. 15 each confine impozitul pe profit (Titlul II)
 *    to persoane juridice;
 *  - the vehicle that once let a persoană fizică opt into Titlul II — CF art. 120 — is
 *    „Abrogat" (OUG 128/2024 pct. 11 Art. I, MO 1125/11.11.2024, eff. 01.01.2025);
 *  - CF art. 68 alin. (1) has a closed exception list (art. 68^1, 68^3, 69) — Titlul II is
 *    not among it.
 * Sources of record: `docs/ai/research/08_art118_income_tax_2026.md` (Q-REGIME, HIGH) and
 * `docs/ai/research/09_u8_amendment_scan_and_optare.md` §6.
 */
import type { PfaRegime } from './models';

/** Every regime value the app accepts on READ. Wider than what it offers on WRITE. */
export const PFA_REGIME_VALUES: [PfaRegime, ...PfaRegime[]] = ['impozit_pe_venit', 'impozit_pe_cit', 'norma_venit'];

export interface PfaRegimeDescriptor {
  value: PfaRegime;
  /** Romanian label for the UI. */
  label: string;
  /** Offered by the profile editor. Only true for regimes a PFA can actually hold. */
  selectable: boolean;
  /** The engine can produce a number for it. */
  computable: boolean;
  /**
   * Why it is not selectable and/or not computable, with the provision that says so.
   * Empty for the computable regime. No invented figures anywhere.
   */
  note: string;
}

export const PFA_REGIME_DESCRIPTORS: Record<PfaRegime, PfaRegimeDescriptor> = {
  impozit_pe_venit: {
    value: 'impozit_pe_venit',
    label: 'Impozit pe venit — sistem real (Titlul IV)',
    selectable: true,
    computable: true,
    note: 'CF art. 123 alin. (1) cota 10% asupra venitului net anual impozabil determinat potrivit art. 118.',
  },
  impozit_pe_cit: {
    value: 'impozit_pe_cit',
    label: 'Impozit pe profit (Titlul II) — imposibil pentru PFA',
    selectable: false,
    computable: false,
    note:
      'Titlul II se datorează doar de persoanele juridice — CF art. 13 alin. (1), art. 14 și art. 15 — ' +
      'iar opțiunea de a datora impozit pe profit (fostul art. 120 CF) a fost abrogată prin ' +
      'OUG 128/2024 pct. 11 Art. I (MO 1125/11.11.2024), de la 01.01.2025.',
  },
  norma_venit: {
    value: 'norma_venit',
    label: 'Normă de venit — nu se poate calcula în acest pachet de reguli',
    selectable: false,
    computable: false,
    note:
      'Pachetul de reguli 2026 nu conține nicio regulă de normă de venit, iar aplicația nu deține ' +
      'nicio valoare de normă — nu inventăm valori. CF art. 68 alin. (1) lasă deschise doar ' +
      'excepțiile art. 68^1, 68^3 și 69, iar art. 118 alin. (6) exclude din regulile de la alin. (1)-(5) ' +
      'veniturile agricole pentru care sunt stabilite norme de venit.',
  },
};

export function isComputableRegime(regime: PfaRegime): boolean {
  return PFA_REGIME_DESCRIPTORS[regime]?.computable === true;
}

export function isSelectableRegime(regime: PfaRegime): boolean {
  return PFA_REGIME_DESCRIPTORS[regime]?.selectable === true;
}

/** Regimes the profile editor may offer. Derived, never a second literal list. */
export function selectableRegimes(): PfaRegimeDescriptor[] {
  return PFA_REGIME_VALUES.filter(isSelectableRegime).map((r) => PFA_REGIME_DESCRIPTORS[r]);
}

/**
 * The engine's refusal for a regime it cannot compute, or null when the regime is fine.
 * `impozit_pe_cit` is framed as a DATA-INTEGRITY failure (wrong regime recorded, or the
 * entity is not a PFA) — not as "a different base applies" (defect B-14).
 */
export function regimeRefusalReason(regime: PfaRegime): string | null {
  const d = PFA_REGIME_DESCRIPTORS[regime];
  if (!d) {
    // Defensive: the schema rejects unknown strings, but the engine gate must not trust
    // its input. An unrecognised regime is never computed — it is reviewed by a human.
    return (
      `Regimul fiscal înregistrat („${String(regime)}") nu este unul dintre regimurile cunoscute ` +
      'de acest pachet de reguli 2026 (CF art. 123 alin. (1): impozit pe venit în sistem real). ' +
      'Este necesară verificarea manuală a regimului aplicabil.'
    );
  }
  if (d.computable) return null;
  if (regime === 'impozit_pe_cit') {
    return (
      `Regimul fiscal înregistrat („${regime}") nu poate aparține unui PFA în 2026: ` +
      `${d.note} Verifică regimul din profil sau natura entității.`
    );
  }
  return (
    `Regimul fiscal înregistrat („${regime}") nu poate fi calculat de acest pachet de reguli: ${d.note} ` +
    'Este necesară verificarea manuală a regimului aplicabil.'
  );
}
