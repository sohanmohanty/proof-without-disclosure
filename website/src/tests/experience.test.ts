/** Unit tests for the 3D journey's pure logic: scroll timeline, digest
 * bit-field expansion, easing, smoothing, and feature gates. The WebGL
 * scenes themselves are verified in the browser — everything they are
 * driven by is tested here. */

import { describe, expect, it } from "vitest";
import { sha256Hex } from "../crypto/hash";
import { wantsClassic } from "../experience/capabilities";
import {
  bitsFromHex,
  expandDigestBits,
  rippleDelay,
} from "../experience/field";
import { smoothTowards } from "../experience/journeyState";
import {
  bump,
  clamp01,
  easeOutCubic,
  lerp,
  phase,
  smoothstep,
} from "../experience/shared/easing";
import {
  activeChapterIndex,
  CHAPTERS,
  chapterRange,
  localProgress,
  TOTAL_VH,
} from "../experience/timeline";

describe("journey timeline", () => {
  it("totals the chapter heights", () => {
    expect(TOTAL_VH).toBe(CHAPTERS.reduce((s, c) => s + c.heightVh, 0));
  });

  it("gives consecutive chapters a brief 50vh handoff, never a long co-presence", () => {
    for (let i = 1; i < CHAPTERS.length; i++) {
      const prev = chapterRange(CHAPTERS[i - 1].id);
      const next = chapterRange(CHAPTERS[i].id);
      expect(prev.exitVh - next.enterVh).toBe(50);
    }
  });

  it("starts the hero at offset zero (no negative enter)", () => {
    expect(chapterRange("hero").enterVh).toBe(0);
  });

  it("maps local progress to 0 at enter and 1 at exit", () => {
    for (const c of CHAPTERS) {
      const { enterVh, exitVh } = chapterRange(c.id);
      expect(localProgress(enterVh, c.id)).toBe(0);
      expect(localProgress(exitVh, c.id)).toBe(1);
      expect(localProgress(enterVh - 10, c.id)).toBeLessThan(0);
      expect(localProgress(exitVh + 10, c.id)).toBeGreaterThan(1);
    }
  });

  it("tracks the dominant chapter for the progress dots", () => {
    expect(activeChapterIndex(0)).toBe(0);
    // the hash section starts at 170vh; the switch happens 50vh early
    expect(activeChapterIndex(119)).toBe(0);
    expect(activeChapterIndex(120)).toBe(1);
    expect(activeChapterIndex(TOTAL_VH)).toBe(CHAPTERS.length - 1);
  });
});

describe("hero bit field", () => {
  it("unpacks hex into big-endian bits", () => {
    expect(Array.from(bitsFromHex("80"))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(bitsFromHex("ff"))).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(Array.from(bitsFromHex("01"))).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("expands a digest deterministically by hash-chaining", async () => {
    const digest = await sha256Hex("proof without disclosure");
    const a = await expandDigestBits(digest, 1000);
    const b = await expandDigestBits(digest, 1000);
    expect(a).toEqual(b);
    expect(a.length).toBe(1000);
    // the field leads with the digest itself — the fingerprint the hero
    // claims to show — then continues with SHA-256(digest + ":0"), ...
    expect(Array.from(a.subarray(0, 256))).toEqual(
      Array.from(bitsFromHex(digest)),
    );
    const block0 = bitsFromHex(await sha256Hex(`${digest}:0`));
    expect(Array.from(a.subarray(256, 512))).toEqual(Array.from(block0));
    // sanity: an expanded field is not degenerate
    const ones = a.reduce((s, bit) => s + bit, 0);
    expect(ones).toBeGreaterThan(300);
    expect(ones).toBeLessThan(700);
  });

  it("ripples out from the grid center", () => {
    expect(rippleDelay(2, 2, 5, 5)).toBe(0);
    const edge = rippleDelay(0, 2, 5, 5);
    const corner = rippleDelay(0, 0, 5, 5);
    expect(corner).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(0);
  });
});

describe("smoothing and easing", () => {
  it("covers half the distance after one half-life", () => {
    expect(smoothTowards(0, 1, 0.09, 0.09)).toBeCloseTo(0.5, 9);
    expect(smoothTowards(0, 1, 0.18, 0.09)).toBeCloseTo(0.75, 9);
  });

  it("is inert with no elapsed time and instant with no half-life", () => {
    expect(smoothTowards(0.3, 1, 0, 0.09)).toBe(0.3);
    expect(smoothTowards(0.3, 1, 0.016, 0)).toBe(1);
  });

  it("easing primitives hit their endpoints", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(phase(5, 0, 10)).toBe(0.5);
    expect(phase(-5, 0, 10)).toBe(0);
    expect(phase(15, 0, 10)).toBe(1);
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(easeOutCubic(1)).toBe(1);
    expect(bump(0.5)).toBeCloseTo(1, 12);
    expect(bump(0)).toBe(0);
    expect(bump(1)).toBeCloseTo(0, 12);
  });
});

describe("capability gates", () => {
  it("honors the ?classic escape hatch", () => {
    expect(wantsClassic("?classic=1")).toBe(true);
    expect(wantsClassic("?classic")).toBe(true);
    expect(wantsClassic("")).toBe(false);
    expect(wantsClassic("?foo=1")).toBe(false);
  });
});
