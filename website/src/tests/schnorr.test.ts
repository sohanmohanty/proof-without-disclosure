import { describe, expect, it } from "vitest";
import * as schnorr from "../crypto/schnorr";

describe("schnorr", () => {
  it("group sanity: g has order q in both groups", () => {
    for (const group of [schnorr.TOY_GROUP, schnorr.REAL_GROUP]) {
      expect(schnorr.modPow(group.g, group.q, group.p)).toBe(1n);
      expect(schnorr.modPow(group.g, 1n, group.p)).not.toBe(1n);
    }
  });

  it("honest proofs verify in both groups", async () => {
    for (const group of [schnorr.TOY_GROUP, schnorr.REAL_GROUP]) {
      const key = schnorr.keygen(group);
      const proof = await schnorr.prove(key, "hello prooflab");
      expect(await schnorr.verify(proof)).toBe(true);
    }
  });

  it("proofs are bound to their message", async () => {
    const key = schnorr.keygen(schnorr.REAL_GROUP);
    const proof = await schnorr.prove(key, "pay alice 5");
    expect(
      await schnorr.verify({ ...proof, message: "pay mallory 500" }),
    ).toBe(false);
  });

  it("interactive protocol: honest prover always passes", () => {
    const group = schnorr.TOY_GROUP;
    const key = schnorr.keygen(group, 7n);
    for (let i = 0; i < 50; i++) {
      const { r, R } = schnorr.commitNonce(group);
      const c = schnorr.randomChallenge(group);
      const s = schnorr.respond(group, key.x, r, c);
      expect(schnorr.check(group, key.y, R, c, s)).toBe(true);
    }
  });

  it("cheater without the key wins at rate ≈ 1/q", () => {
    const group = schnorr.TOY_GROUP; // q = 11
    const key = schnorr.keygen(group, 7n);
    let wins = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const guessed = schnorr.randomChallenge(group);
      const { s, R } = schnorr.forgeCommitment(group, key.y, guessed);
      const actual = schnorr.randomChallenge(group);
      if (schnorr.check(group, key.y, R, actual, s)) {
        wins++;
        expect(actual).toBe(guessed); // guessing right is the only way
      }
    }
    const expected = trials / Number(group.q);
    expect(wins).toBeGreaterThan(expected * 0.4);
    expect(wins).toBeLessThan(expected * 1.6);
  });

  it("two answers for one nonce leak the private key (soundness)", () => {
    const group = schnorr.TOY_GROUP;
    const key = schnorr.keygen(group, 9n);
    const { r } = schnorr.commitNonce(group, 5n);
    const [c1, c2] = [3n, 8n];
    const s1 = schnorr.respond(group, key.x, r, c1);
    const s2 = schnorr.respond(group, key.x, r, c2);
    // x = (s1 - s2) / (c1 - c2) mod q, computed by brute inverse (q is tiny)
    let inv = 0n;
    const diff = (((c1 - c2) % group.q) + group.q) % group.q;
    for (let k = 1n; k < group.q; k++) {
      if ((diff * k) % group.q === 1n) inv = k;
    }
    const extracted =
      ((((s1 - s2) % group.q) + group.q) % group.q * inv) % group.q;
    expect(extracted).toBe(9n);
  });

  it("transcripts can be simulated without the key (zero-knowledge)", () => {
    const group = schnorr.REAL_GROUP;
    const key = schnorr.keygen(group);
    const c = 123456789n;
    const s = 987654321n;
    const yInvC = schnorr.modPow(key.y, group.q - c, group.p);
    const R = (schnorr.modPow(group.g, s, group.p) * yInvC) % group.p;
    expect(schnorr.check(group, key.y, R, c, s)).toBe(true);
  });

  it("brute force cracks the toy group only", () => {
    const toyKey = schnorr.keygen(schnorr.TOY_GROUP, 7n);
    expect(schnorr.bruteForceDlog(schnorr.TOY_GROUP, toyKey.y)).toBe(7n);
    const realKey = schnorr.keygen(schnorr.REAL_GROUP);
    expect(
      schnorr.bruteForceDlog(schnorr.REAL_GROUP, realKey.y, 10_000n),
    ).toBeNull();
  });
});
