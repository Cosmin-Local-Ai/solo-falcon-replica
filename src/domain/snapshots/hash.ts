import type { CalculationInput } from './types';
import { canonicalize } from './serialize';

/**
 * Browser-safe SHA-256 hex digest of the canonical serialization of a
 * calculation input. Deterministic: the same input always yields the same
 * hash, independent of object key order.
 */
export async function computeInputsHash(input: CalculationInput): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(input));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
