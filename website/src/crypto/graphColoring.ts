/** Zero-knowledge graph 3-coloring, structured so the UI can drive each
 * protocol move separately. Reuses the commitment scheme from
 * commitments.ts — the module-2 primitive powering the module-6 protocol. */

import { commit, verifyReveal, type Commitment } from "./commitments";

export type Edge = [number, number];

export interface Graph {
  name: string;
  displayName: string;
  nodes: number;
  edges: Edge[];
  /** Prover's witness (or best attempt), colors in {1,2,3}. */
  coloring: number[];
  /** Unit-square layout for SVG rendering, [x, y] per node. */
  layout: [number, number][];
}

function ring(count: number, radius: number, offset = -Math.PI / 2): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (2 * Math.PI * i) / count;
    return [0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)];
  });
}

/** Petersen graph: 10 nodes, 15 edges, chromatic number exactly 3. */
export const PETERSEN: Graph = {
  name: "petersen",
  displayName: "Petersen graph",
  nodes: 10,
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],  // outer cycle
    [5, 7], [7, 9], [9, 6], [6, 8], [8, 5],  // inner pentagram
    [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],  // spokes
  ],
  coloring: [1, 2, 1, 2, 3, 2, 3, 3, 1, 1],
  layout: [...ring(5, 0.46), ...ring(5, 0.24)],
};

/** Same graph, but the witness has exactly one bad edge: (3, 4). A cheater
 * this good is caught with probability only 1/15 per round — soundness has
 * to be earned by repetition. */
export const PETERSEN_CHEAT_COLORING = [1, 2, 1, 2, 2, 2, 3, 3, 1, 1];

/** K4: every pair of its 4 nodes is connected — it needs 4 colors, so NO
 * valid 3-coloring exists. The best possible fake has one bad edge. */
export const K4: Graph = {
  name: "k4",
  displayName: "K₄ (complete graph, not 3-colorable)",
  nodes: 4,
  edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  coloring: [1, 2, 3, 1], // forced bad edge: (0, 3)
  layout: [[0.5, 0.06], [0.06, 0.94], [0.94, 0.94], [0.5, 0.585]],
};

export function badEdges(graph: Graph, coloring: number[]): Edge[] {
  return graph.edges.filter(([u, v]) => coloring[u] === coloring[v]);
}

export interface RoundState {
  permuted: number[];          // colors after this round's label shuffle
  commitments: Commitment[];   // one per node; only commitment field is shown
}

/** Uniform integer in [0, n) via rejection sampling — same discipline as
 * schnorr.ts's randBelow. A plain `uint32 % n` would carry (negligible but
 * real) modulo bias. */
function randInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const v = crypto.getRandomValues(new Uint32Array(1))[0];
    if (v < limit) return v % n;
  }
}

/** Uniform Fisher-Yates shuffle. (The zero-knowledge argument needs the
 * label permutation to be uniform — the popular `sort(() => Math.random()
 * - 0.5)` trick is biased, so it has no place here.) */
function shuffledLabels(): number[] {
  const labels = [1, 2, 3];
  for (let i = labels.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }
  return labels;
}

/** Round setup: shuffle the three labels, commit to every node's color. */
export async function commitPhase(coloring: number[]): Promise<RoundState> {
  const labels = shuffledLabels();
  const permuted = coloring.map((c) => labels[c - 1]);
  const commitments = await Promise.all(permuted.map((c) => commit(String(c))));
  return { permuted, commitments };
}

export interface Opening {
  node: number;
  color: number;
  salt: string;
  commitment: string;
  valid: boolean;
}

/** Challenge response: open exactly the two endpoint commitments. */
export async function openEdge(
  state: RoundState,
  edge: Edge,
): Promise<{ openings: [Opening, Opening]; accepted: boolean }> {
  const openings = (await Promise.all(
    edge.map(async (node) => {
      const c = state.commitments[node];
      return {
        node,
        color: state.permuted[node],
        salt: c.salt,
        commitment: c.commitment,
        valid: await verifyReveal(c.commitment, String(state.permuted[node]), c.salt),
      };
    }),
  )) as [Opening, Opening];
  const accepted =
    openings[0].valid &&
    openings[1].valid &&
    openings[0].color !== openings[1].color;
  return { openings, accepted };
}

/** Survival bound for a prover whose coloring has >= 1 bad edge. */
export function cheatSurvivalBound(edgeCount: number, rounds: number): number {
  return (1 - 1 / edgeCount) ** rounds;
}

/** Rounds needed to push a cheater's survival odds below `target`. */
export function roundsForConfidence(edgeCount: number, target: number): number {
  return Math.ceil(Math.log(target) / Math.log(1 - 1 / edgeCount));
}
