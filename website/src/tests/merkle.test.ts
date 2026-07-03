import { describe, expect, it } from "vitest";
import {
  buildTree,
  generateProof,
  hashLeaf,
  rootOf,
  verifyProof,
} from "../crypto/merkle";
import { bytesToHex } from "../crypto/hex";

const ITEMS4 = [
  "alice@example.com",
  "bob@example.com",
  "carol@example.com",
  "dana@example.com",
];

describe("merkle", () => {
  it("every item proves for sizes 1..9 (incl. odd promotion)", async () => {
    for (let n = 1; n <= 9; n++) {
      const items = Array.from({ length: n }, (_, i) => `item-${i}`);
      const tree = await buildTree(items);
      for (let i = 0; i < n; i++) {
        const path = generateProof(tree, i);
        expect(await verifyProof(items[i], path, rootOf(tree))).toBe(true);
      }
    }
  });

  it("rejects absent items", async () => {
    const tree = await buildTree(ITEMS4);
    const path = generateProof(tree, 1);
    expect(await verifyProof("mallory@example.com", path, rootOf(tree))).toBe(
      false,
    );
  });

  it("tampering with a leaf changes the root", async () => {
    const before = rootOf(await buildTree(ITEMS4));
    const tampered = [...ITEMS4];
    tampered[2] = "eve@example.com";
    expect(rootOf(await buildTree(tampered))).not.toBe(before);
  });

  it("domain separation: a leaf never hashes like plain data", async () => {
    const leaf = bytesToHex(await hashLeaf("same bytes"));
    const { sha256Hex } = await import("../crypto/hash");
    expect(leaf).not.toBe(await sha256Hex("same bytes"));
  });

  it("promotion differs from Bitcoin-style duplication (CVE-2012-2459)", async () => {
    const promoted = rootOf(await buildTree(["a", "b", "c"]));
    const duplicated = rootOf(await buildTree(["a", "b", "c", "c"]));
    expect(promoted).not.toBe(duplicated);
  });
});
