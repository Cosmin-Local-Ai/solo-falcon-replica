/**
 * Pure presentation formatters (Step 22).
 *
 * No data access, no domain logic — format numbers for display only.
 */
const lei = new Intl.NumberFormat('ro-RO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a number as a Romanian-lei currency string, e.g. `1 234,56 lei`.
 * Non-finite values render as an em dash (no invented value).
 */
export function formatLei(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${lei.format(value)} lei`;
}
