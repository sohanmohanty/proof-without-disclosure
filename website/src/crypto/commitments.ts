/** Hash commitments: commit = SHA-256(salt_hex + ":" + secret).
 * Byte-identical to the Python implementation — see docs/format-spec.md. */

import { sha256Hex } from "./hash";
import { bytesToHex, randomBytes } from "./hex";

export const SALT_BYTES = 16;

export interface Commitment {
  commitment: string; // safe to publish
  salt: string;       // keep private until reveal
  secret: string;     // keep private until reveal
}

export async function computeCommitment(
  secret: string,
  saltHex: string,
): Promise<string> {
  return sha256Hex(`${saltHex}:${secret}`);
}

export async function commit(secret: string): Promise<Commitment> {
  const salt = bytesToHex(randomBytes(SALT_BYTES));
  return { commitment: await computeCommitment(secret, salt), salt, secret };
}

export async function verifyReveal(
  commitment: string,
  secret: string,
  saltHex: string,
): Promise<boolean> {
  const computed = await computeCommitment(secret, saltHex);
  return computed === commitment.trim().toLowerCase();
}
