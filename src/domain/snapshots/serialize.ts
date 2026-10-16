/**
 * Deterministic canonical serialization for hashing (Step 12).
 *
 * The serialization is stable across object key orderings: object keys are
 * sorted lexicographically before serialization, so two structurally equal
 * inputs always produce the same string — and therefore the same hash.
 */

export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.isFinite(value) ? String(value) : 'null';
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`;
      }
      const entries = Object.keys(value).sort().map(k =>
        `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`
      );
      return `{${entries.join(',')}}`;
    }
    default:
      return 'null';
  }
}
