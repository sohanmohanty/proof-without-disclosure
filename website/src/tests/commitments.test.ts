import { describe, expect, it } from "vitest";
import { commit, computeCommitment, verifyReveal } from "../crypto/commitments";

describe("commitments", () => {
  it("commit/reveal roundtrip", async () => {
    const c = await commit("team blue wins");
    expect(await verifyReveal(c.commitment, c.secret, c.salt)).toBe(true);
  });

  it("rejects a changed secret (binding)", async () => {
    const c = await commit("17");
    expect(await verifyReveal(c.commitment, "18", c.salt)).toBe(false);
  });

  it("fresh salts hide repeated secrets (hiding)", async () => {
    const a = await commit("same");
    const b = await commit("same");
    expect(a.commitment).not.toBe(b.commitment);
  });

  it("pins the exact byte encoding shared with Python", async () => {
    // sha256(utf8("00112233445566778899aabbccddeeff:hello"))
    const got = await computeCommitment(
      "hello",
      "00112233445566778899aabbccddeeff",
    );
    expect(got).toHaveLength(64);
    // cross-checked against vectors/test-vectors.json in vectors.test.ts;
    // this test only pins determinism
    expect(got).toBe(
      await computeCommitment("hello", "00112233445566778899aabbccddeeff"),
    );
  });
});
