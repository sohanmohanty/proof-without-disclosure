/** Bit-field math for the hero lattice.
 *
 * The hero visualizes real SHA-256 output: the digest of whatever the
 * visitor types is expanded — deterministically, by hash-chaining with the
 * same sha256Hex the Hash lab uses — into enough bits to fill the whole
 * field. Pure data, no three.js, so it is unit-testable in node.
 */

import { sha256Hex } from "../crypto/hash";
import { hexToBytes } from "../crypto/hex";

/** Big-endian bit array of a hex string (64 hex chars → 256 bits). */
export function bitsFromHex(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bits.length; i++) {
    bits[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  }
  return bits;
}

/** Fill `count` bits: the digest's own 256 bits come first — the lattice
 * literally begins with the fingerprint it claims to show — and the rest
 * is deterministic hash-chaining, block i = SHA-256(`digest:i`). */
export async function expandDigestBits(
  digestHex: string,
  count: number,
): Promise<Uint8Array> {
  const out = new Uint8Array(count);
  let bits = bitsFromHex(digestHex);
  let offset = 0;
  let block = 0;
  for (;;) {
    const take = Math.min(bits.length, count - offset);
    out.set(bits.subarray(0, take), offset);
    offset += take;
    if (offset >= count) return out;
    bits = bitsFromHex(await sha256Hex(`${digestHex}:${block}`));
    block += 1;
  }
}

/** Ripple delay in seconds for a grid cell, radiating from the center. */
export function rippleDelay(
  col: number,
  row: number,
  cols: number,
  rows: number,
  secondsPerCell = 0.012,
): number {
  const dx = col - (cols - 1) / 2;
  const dy = row - (rows - 1) / 2;
  return Math.hypot(dx, dy) * secondsPerCell;
}
