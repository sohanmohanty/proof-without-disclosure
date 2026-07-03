import { describe, expect, it } from "vitest";
import {
  badEdges,
  cheatSurvivalBound,
  commitPhase,
  K4,
  openEdge,
  PETERSEN,
  PETERSEN_CHEAT_COLORING,
  roundsForConfidence,
} from "../crypto/graphColoring";

describe("zk graph coloring", () => {
  it("the Petersen witness is a valid 3-coloring", () => {
    expect(badEdges(PETERSEN, PETERSEN.coloring)).toEqual([]);
  });

  it("the cheat coloring has exactly one bad edge", () => {
    expect(badEdges(PETERSEN, PETERSEN_CHEAT_COLORING)).toEqual([[3, 4]]);
  });

  it("K4 cannot be 3-colored: its best attempt has a bad edge", () => {
    expect(badEdges(K4, K4.coloring).length).toBeGreaterThan(0);
  });

  it("honest rounds always verify, any edge", async () => {
    for (let round = 0; round < 5; round++) {
      const state = await commitPhase(PETERSEN.coloring);
      for (const edge of PETERSEN.edges) {
        const { accepted, openings } = await openEdge(state, edge);
        expect(accepted).toBe(true);
        expect(openings[0].valid && openings[1].valid).toBe(true);
      }
    }
  });

  it("a cheating prover fails exactly on the bad edge", async () => {
    const state = await commitPhase(PETERSEN_CHEAT_COLORING);
    for (const edge of PETERSEN.edges) {
      const { accepted } = await openEdge(state, edge);
      const isBadEdge = edge[0] === 3 && edge[1] === 4;
      expect(accepted).toBe(!isBadEdge);
    }
  });

  it("permutations hide the witness across rounds", async () => {
    // colors shown for the same node vary between rounds (labels shuffle)
    const seen = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const state = await commitPhase(PETERSEN.coloring);
      seen.add(state.permuted[0]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("soundness math", () => {
    expect(cheatSurvivalBound(15, 100)).toBeCloseTo((14 / 15) ** 100, 12);
    const k = roundsForConfidence(15, 0.01);
    expect(cheatSurvivalBound(15, k)).toBeLessThanOrEqual(0.01);
    expect(cheatSurvivalBound(15, k - 1)).toBeGreaterThan(0.01);
  });
});
