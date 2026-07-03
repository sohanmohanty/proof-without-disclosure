import { describe, expect, it } from "vitest";
import { sha256Hex } from "../crypto/hash";
import { hammingDistanceHex } from "../crypto/hex";

describe("sha256", () => {
  it("matches the NIST FIPS 180-2 vectors", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("avalanches: one character flips ~half the output bits", async () => {
    const a = await sha256Hex("hello");
    const b = await sha256Hex("Hello");
    expect(hammingDistanceHex(a, b)).toBeGreaterThan(256 / 3);
  });
});
