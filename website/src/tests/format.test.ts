import { describe, expect, it } from "vitest";
import { commit } from "../crypto/commitments";
import { buildTree, generateProof, hashLeaf, rootOf } from "../crypto/merkle";
import { bytesToHex } from "../crypto/hex";
import { parseDoc, verifyDoc } from "../crypto/format";

function envelope(type: string, fields: Record<string, unknown>) {
  return JSON.stringify({ format: "prooflab", version: 1, type, ...fields });
}

describe("prooflab document parsing + verification", () => {
  it("rejects non-prooflab JSON", () => {
    expect(() => parseDoc("not json")).toThrow();
    expect(() => parseDoc("{}")).toThrow(/format/);
    expect(() => parseDoc('{"format":"prooflab","version":99,"type":"x"}')).toThrow(
      /version/,
    );
  });

  it("verifies a merkle_proof document end to end", async () => {
    const items = ["a", "b", "c", "d", "e"];
    const tree = await buildTree(items);
    const doc = parseDoc(
      envelope("merkle_proof", {
        hash_function: "sha256",
        item: "d",
        leaf_hash: bytesToHex(await hashLeaf("d")),
        root: rootOf(tree),
        path: generateProof(tree, 3),
      }),
    );
    expect((await verifyDoc(doc)).verdict).toBe("valid");

    const tampered = parseDoc(
      envelope("merkle_proof", {
        item: "z",
        root: rootOf(tree),
        path: generateProof(tree, 3),
      }),
    );
    expect((await verifyDoc(tampered)).verdict).toBe("invalid");
  });

  it("pairs commitment + reveal documents", async () => {
    const c = await commit("prediction: blue");
    const commitmentDoc = parseDoc(
      envelope("commitment", { commitment: c.commitment }),
    );
    const revealDoc = parseDoc(
      envelope("commitment_reveal", { secret: c.secret, salt: c.salt }),
    );
    expect((await verifyDoc(commitmentDoc)).verdict).toBe("info");
    expect((await verifyDoc(commitmentDoc, [revealDoc])).verdict).toBe("valid");
    const wrongReveal = parseDoc(
      envelope("commitment_reveal", { secret: "prediction: red", salt: c.salt }),
    );
    expect((await verifyDoc(commitmentDoc, [wrongReveal])).verdict).toBe(
      "invalid",
    );
  });
});
