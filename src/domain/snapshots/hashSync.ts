/**
 * Synchronous SHA-256 hex digest, byte-for-byte identical to
 * `computeInputsHash` (`./hash`, which uses `crypto.subtle`).
 *
 * Why this exists
 * ---------------
 * A persisted-data migration has to run on the load path, and the load path is
 * synchronous (`useState(() => loadInitial())` in `data/store.tsx`). Phase 7
 * step v0→v1 backfills identity fields into the `inputSnapshot.profile` embedded
 * in every stored calculation snapshot, and `canonicalize` (`./serialize`)
 * serializes every key — so the digest of a rewritten snapshot necessarily
 * changes and must be re-derived *during* the migration. It cannot be deferred:
 * snapshots are append-only by design (`addSnapshot` is the only write path;
 * `store.snapshots.test.tsx` asserts no update/delete path exists), so there is
 * no later moment at which a snapshot's digest may be corrected.
 *
 * `crypto.subtle.digest` is async-only, hence this implementation. It is used
 * for content-addressing/provenance, never for security.
 *
 * Correctness is not asserted by comment: `hashSync.test.ts` compares this
 * against `computeInputsHash` (platform SHA-256) over single-block, multi-block,
 * UTF-8 and real snapshot inputs, and pins that the two agree exactly.
 */
import type { CalculationInput } from './types';
import { canonicalize } from './serialize';

/**
 * Round constants K[i] = floor(frac(cbrt(prime(i))) * 2^32) and initial hash
 * values H[i] = floor(frac(sqrt(prime(i))) * 2^32), for the first 64 primes.
 * Generated from the specification (not transcribed), and pinned by
 * `hashSync.test.ts` against the platform digest.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 of a UTF-8 string, as lowercase hex. */
export function sha256Hex(text: string): string {
  const bytes = [...new TextEncoder().encode(text)];
  const bitLength = BigInt(bytes.length) * 8n;

  // Padding: 0x80, then zeros until length ≡ 56 (mod 64), then the 64-bit big-endian bit length.
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(Number((bitLength >> (8n * BigInt(i))) & 0xffn));

  const h = [...H0];
  const w = new Uint32Array(64);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return h.map(x => x.toString(16).padStart(8, '0')).join('');
}

/**
 * Synchronous twin of `computeInputsHash`. Same canonical serialization, same
 * digest — see `hashSync.test.ts`.
 */
export function computeInputsHashSync(input: CalculationInput): string {
  return sha256Hex(canonicalize(input));
}
