/** ECDSA P-256 via Web Crypto: real signatures from a vetted API, never
 * hand-rolled curve math. Interop formats match the Python side:
 * 65-byte uncompressed public key, 64-byte raw r||s signature (see
 * docs/format-spec.md). */

import { bytesToHex, hexToBytes } from "./hex";

export const ALGORITHM = "ecdsa-p256-sha256";

const KEY_PARAMS: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_PARAMS: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(KEY_PARAMS, true, ["sign", "verify"]);
}

export async function exportPublicKeyHex(key: CryptoKey): Promise<string> {
  // "raw" EC export is the uncompressed SEC1 point: 0x04 || X || Y
  return bytesToHex(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function exportPrivateKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function importPublicKeyHex(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(hex) as BufferSource,
    KEY_PARAMS,
    true,
    ["verify"],
  );
}

/** Sign message bytes; Web Crypto's ECDSA output is already raw r||s. */
export async function sign(
  privateKey: CryptoKey,
  message: Uint8Array,
): Promise<string> {
  const sig = await crypto.subtle.sign(
    SIGN_PARAMS,
    privateKey,
    message as BufferSource,
  );
  return bytesToHex(new Uint8Array(sig));
}

export async function verify(
  publicKeyHex: string,
  message: Uint8Array,
  signatureHex: string,
): Promise<boolean> {
  try {
    const key = await importPublicKeyHex(publicKeyHex);
    const sig = hexToBytes(signatureHex);
    if (sig.length !== 64) return false;
    return await crypto.subtle.verify(
      SIGN_PARAMS,
      key,
      sig as BufferSource,
      message as BufferSource,
    );
  } catch {
    return false;
  }
}
