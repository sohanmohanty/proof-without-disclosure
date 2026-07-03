/** Schnorr identification and Fiat-Shamir proofs over safe-prime groups.
 * Mirrors prooflab/schnorr.py exactly — see that file and the SchnorrLab
 * page for the protocol story. All arithmetic is native BigInt.
 */

import { sha256Hex } from "./hash";
import { randomBytes } from "./hex";

export const DOMAIN = "prooflab-schnorr-v1";

// RFC 3526, group 14 (2048-bit MODP). Same constant as the Python side,
// pinned by vectors/test-vectors.json.
const RFC3526_2048_P = BigInt(
  "0x" +
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74" +
    "020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437" +
    "4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05" +
    "98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB" +
    "9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718" +
    "3995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF",
);

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

export interface Group {
  name: string;
  p: bigint;
  g: bigint;
  q: bigint;       // (p-1)/2, prime
  byteLen: number; // fixed-width encoding length for this group
}

function makeGroup(name: string, p: bigint, g: bigint): Group {
  const q = (p - 1n) / 2n;
  const byteLen = Math.ceil(p.toString(16).length / 2);
  return { name, p, g, q, byteLen };
}

export const TOY_GROUP = makeGroup("toy-23", 23n, 4n);
export const REAL_GROUP = makeGroup("modp-2048", RFC3526_2048_P, 4n);
export const GROUPS: Record<string, Group> = {
  [TOY_GROUP.name]: TOY_GROUP,
  [REAL_GROUP.name]: REAL_GROUP,
};

export function toHex(group: Group, value: bigint): string {
  return value.toString(16).padStart(group.byteLen * 2, "0");
}

/** Uniform random bigint in [0, n) via rejection sampling. */
export function randBelow(n: bigint): bigint {
  const byteLen = Math.ceil(n.toString(16).length / 2);
  for (;;) {
    const bytes = randomBytes(byteLen);
    let value = 0n;
    for (const b of bytes) value = (value << 8n) | BigInt(b);
    // keep only if within the largest multiple of n (avoids modulo bias)
    const limit = (1n << BigInt(8 * byteLen)) / n * n;
    if (value < limit) return value % n;
  }
}

export interface KeyPair {
  group: Group;
  x: bigint; // private
  y: bigint; // public: g^x mod p
}

export interface Proof {
  group: Group;
  y: bigint;
  R: bigint;
  s: bigint;
  message: string;
}

export function keygen(group: Group, x?: bigint): KeyPair {
  const priv = x ?? 1n + randBelow(group.q - 1n);
  if (priv < 1n || priv >= group.q) {
    throw new Error("private key must be in [1, q-1]");
  }
  return { group, x: priv, y: modPow(group.g, priv, group.p) };
}

/** c = SHA-256(domain | group | y | R | message) mod q — same preimage
 * layout as Python, so challenges match across implementations. */
export async function fiatShamirChallenge(
  group: Group,
  y: bigint,
  R: bigint,
  message: string,
): Promise<bigint> {
  const preimage = [
    DOMAIN,
    group.name,
    toHex(group, y),
    toHex(group, R),
    message,
  ].join("|");
  return BigInt("0x" + (await sha256Hex(preimage))) % group.q;
}

export async function prove(
  key: KeyPair,
  message = "",
  fixedNonce?: bigint,
): Promise<Proof> {
  const { group } = key;
  const r = fixedNonce ?? 1n + randBelow(group.q - 1n);
  const R = modPow(group.g, r, group.p);
  const c = await fiatShamirChallenge(group, key.y, R, message);
  const s = (r + c * key.x) % group.q;
  return { group, y: key.y, R, s, message };
}

export async function verify(proof: Proof): Promise<boolean> {
  const { group, y, R, s, message } = proof;
  if (!(y > 1n && y < group.p && R >= 1n && R < group.p)) return false;
  if (!(s >= 0n && s < group.q)) return false;
  const c = await fiatShamirChallenge(group, y, R, message);
  const left = modPow(group.g, s, group.p);
  const right = (R * modPow(y, c, group.p)) % group.p;
  return left === right;
}

// --- Interactive protocol pieces, for the step-by-step lab ---------------

export function commitNonce(group: Group, fixedNonce?: bigint) {
  const r = fixedNonce ?? 1n + randBelow(group.q - 1n);
  return { r, R: modPow(group.g, r, group.p) };
}

export function randomChallenge(group: Group): bigint {
  return randBelow(group.q);
}

export function respond(group: Group, x: bigint, r: bigint, c: bigint): bigint {
  return (r + c * x) % group.q;
}

export function check(
  group: Group,
  y: bigint,
  R: bigint,
  c: bigint,
  s: bigint,
): boolean {
  return modPow(group.g, s, group.p) === (R * modPow(y, c, group.p)) % group.p;
}

/** Cheating prover: guess the challenge c*, pick s at random, and derive
 * R = g^s * y^(-c*). Passes iff the real challenge equals the guess — odds
 * exactly 1/q. Watchable in the toy group (q = 11), hopeless at 2048 bits. */
export function forgeCommitment(group: Group, y: bigint, guessedC: bigint) {
  const s = randBelow(group.q);
  const yInvC = modPow(y, group.q - (guessedC % group.q), group.p);
  const R = (modPow(group.g, s, group.p) * yInvC) % group.p;
  return { s, R };
}

/** Recover x from y by trying every exponent — the attack that group size
 * exists to defeat. Instant when q = 11; unthinkable when q ≈ 2^2046. */
export function bruteForceDlog(
  group: Group,
  y: bigint,
  limit = 1n << 22n,
): bigint | null {
  let accumulator = 1n;
  const max = group.q < limit ? group.q : limit;
  for (let x = 0n; x < max; x++) {
    if (accumulator === y) return x;
    accumulator = (accumulator * group.g) % group.p;
  }
  return null;
}
