/**
 * Presentation-only display labels for the 9 known completeness check keys
 * (Step 31). The data layer emits raw keys (e.g. 'profile'); the UI maps
 * them to plain-language labels. Unknown keys fall back to the raw key —
 * no check is ever dropped. No domain logic lives here.
 */

const CHECK_LABELS: Record<string, string> = {
  profile: 'Profil',
  income: 'Venituri înregistrate',
  expenses: 'Cheltuieli înregistrate',
  clients: 'Clienți',
  documents: 'Documente',
  companyDocuments: 'Documente de firmă',
  declarations: 'Declarații',
  statements: 'Declarații fiscale',
  taxEstimate: 'Estimare impozit',
};

/** Plain-language Romanian label for a completeness check key (falls back to the raw key). */
export function checkLabel(key: string): string {
  return CHECK_LABELS[key] ?? key;
}
