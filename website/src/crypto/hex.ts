/** Byte/hex/UTF-8 helpers shared by every crypto module. */

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("invalid hex string");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(2 * i, 2 * i + 2), 16);
  }
  return bytes;
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Bits that differ between two equal-length hex digests (avalanche demos). */
export function hammingDistanceHex(a: string, b: string): number {
  const ba = hexToBytes(a);
  const bb = hexToBytes(b);
  if (ba.length !== bb.length) throw new Error("length mismatch");
  let bits = 0;
  for (let i = 0; i < ba.length; i++) {
    let x = ba[i] ^ bb[i];
    while (x) {
      bits += x & 1;
      x >>= 1;
    }
  }
  return bits;
}
