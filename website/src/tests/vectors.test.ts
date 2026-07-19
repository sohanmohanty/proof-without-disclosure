/** The interop pin: every vector in vectors/test-vectors.json (generated
 * by the Python implementation) must verify identically here. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { computeCommitment, verifyReveal } from "../crypto/commitments";
import { sha256Hex } from "../crypto/hash";
import { bytesToHex, utf8 } from "../crypto/hex";
import * as merkle from "../crypto/merkle";
import * as schnorr from "../crypto/schnorr";
import * as signatures from "../crypto/signatures";

const vectors = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../vectors/test-vectors.json", import.meta.url)),
    "utf-8",
  ),
);

describe("shared test vectors (Python ↔ TypeScript)", () => {
  it("sha256", async () => {
    for (const c of vectors.sha256) {
      expect(await sha256Hex(c.text)).toBe(c.sha256);
    }
  });

  it("commitments", async () => {
    for (const c of vectors.commitments) {
      expect(await computeCommitment(c.secret, c.salt)).toBe(c.commitment);
      expect(await verifyReveal(c.commitment, c.secret, c.salt)).toBe(true);
    }
  });

  it("merkle roots and proofs", async () => {
    for (const c of vectors.merkle) {
      const tree = await merkle.buildTree(c.items);
      expect(merkle.rootOf(tree)).toBe(c.root);
      expect(bytesToHex(await merkle.hashLeaf(c.proof.item))).toBe(
        c.proof.leaf_hash,
      );
      expect(merkle.generateProof(tree, c.proof.index)).toEqual(c.proof.path);
      expect(await merkle.verifyProof(c.proof.item, c.proof.path, c.root)).toBe(
        true,
      );
    }
  });

  it("schnorr transcripts", async () => {
    for (const c of vectors.schnorr) {
      const group = schnorr.GROUPS[c.group];
      expect(group).toBeDefined();
      const key = schnorr.keygen(group, BigInt("0x" + c.x));
      expect(schnorr.toHex(group, key.y)).toBe(c.y);
      const proof = await schnorr.prove(key, c.message, BigInt("0x" + c.r));
      expect(schnorr.toHex(group, proof.R)).toBe(c.R);
      expect(schnorr.toHex(group, proof.s)).toBe(c.s);
      const challenge = await schnorr.fiatShamirChallenge(
        group,
        proof.y,
        proof.R,
        c.message,
      );
      expect(schnorr.toHex(group, challenge)).toBe(c.challenge);
      expect(await schnorr.verify(proof)).toBe(true);
    }
  });

  it("verifies a signature produced by the Python implementation", async () => {
    const c = vectors.signature;
    expect(c).toBeTruthy();
    expect(
      await signatures.verify(c.public_key, utf8(c.message), c.signature),
    ).toBe(true);
  });
});
