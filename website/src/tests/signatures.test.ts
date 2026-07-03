import { describe, expect, it } from "vitest";
import * as signatures from "../crypto/signatures";
import { utf8 } from "../crypto/hex";

describe("signatures (ECDSA P-256, Web Crypto)", () => {
  it("sign/verify roundtrip with interop formats", async () => {
    const pair = await signatures.generateKeyPair();
    const pub = await signatures.exportPublicKeyHex(pair.publicKey);
    expect(pub.startsWith("04")).toBe(true);
    expect(pub).toHaveLength(130); // 65 bytes uncompressed point

    const sig = await signatures.sign(pair.privateKey, utf8("launch at dawn"));
    expect(sig).toHaveLength(128); // 64 bytes raw r||s
    expect(await signatures.verify(pub, utf8("launch at dawn"), sig)).toBe(true);
  });

  it("rejects a tampered message", async () => {
    const pair = await signatures.generateKeyPair();
    const pub = await signatures.exportPublicKeyHex(pair.publicKey);
    const sig = await signatures.sign(pair.privateKey, utf8("launch at dawn"));
    expect(await signatures.verify(pub, utf8("launch at dusk"), sig)).toBe(false);
  });

  it("rejects the wrong key", async () => {
    const pair = await signatures.generateKeyPair();
    const other = await signatures.generateKeyPair();
    const otherPub = await signatures.exportPublicKeyHex(other.publicKey);
    const sig = await signatures.sign(pair.privateKey, utf8("msg"));
    expect(await signatures.verify(otherPub, utf8("msg"), sig)).toBe(false);
  });

  it("rejects garbage without crashing", async () => {
    const pair = await signatures.generateKeyPair();
    const pub = await signatures.exportPublicKeyHex(pair.publicKey);
    expect(await signatures.verify(pub, utf8("msg"), "00".repeat(64))).toBe(false);
    expect(await signatures.verify(pub, utf8("msg"), "zz")).toBe(false);
    expect(await signatures.verify("04" + "00".repeat(64), utf8("m"), "00".repeat(64))).toBe(false);
  });
});
