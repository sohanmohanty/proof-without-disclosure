/** SHA-256 via the browser's Web Crypto API — the vetted primitive this
 * project builds on but never reimplements. */

import { nextTask } from "./async";
import { bytesToHex, utf8 } from "./hex";

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data as BufferSource,
  );
  return new Uint8Array(digest);
}

export async function sha256Hex(text: string): Promise<string> {
  return bytesToHex(await sha256Bytes(utf8(text)));
}

export async function sha256FileHex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  return bytesToHex(await sha256Bytes(new Uint8Array(buffer)));
}

/**
 * Birthday-paradox playground: hash random inputs until two collide on the
 * first `bits` bits of SHA-256. Returns the colliding pair and attempt count.
 * Expected attempts ≈ 1.2533 * sqrt(2^bits) — the birthday bound.
 */
export async function findTruncatedCollision(
  bits: number,
  onProgress?: (attempts: number) => void,
  maxAttempts = 2_000_000,
): Promise<{ a: string; b: string; digestBits: string; attempts: number } | null> {
  const seen = new Map<string, string>();
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const input = `in-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`;
    const digest = await sha256Bytes(utf8(input));
    let truncated = "";
    for (let i = 0; i < bits; i++) {
      truncated += (digest[i >> 3] >> (7 - (i & 7))) & 1;
    }
    const existing = seen.get(truncated);
    if (existing !== undefined && existing !== input) {
      return { a: existing, b: input, digestBits: truncated, attempts };
    }
    seen.set(truncated, input);
    if (onProgress && attempts % 250 === 0) onProgress(attempts);
    // yield to the UI thread now and then (never-throttled macrotask)
    if (attempts % 1000 === 0) await nextTask();
  }
  return null;
}
