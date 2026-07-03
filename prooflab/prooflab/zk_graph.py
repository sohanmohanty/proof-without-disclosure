"""Zero-knowledge graph 3-coloring: the classic toy interactive proof.

The prover claims to know a 3-coloring of a public graph. One round:

  1. prover secretly shuffles the three color labels (a random permutation);
  2. prover commits to every node's shuffled color (hash commitments,
     reusing prooflab.commitments — the module-2 primitive powering the
     module-6 protocol);
  3. verifier picks one edge at random;
  4. prover opens the two endpoint commitments, nothing else;
  5. verifier checks both openings and that the two colors differ.

Soundness: if the coloring has a bad (same-colored) edge, a random challenge
lands on it with probability >= 1/|E|, so a cheater survives k rounds with
probability at most (1 - 1/|E|)^k.

Zero-knowledge: each round exposes only "two random-looking different labels
on one edge". Because labels are re-shuffled every round, observations never
accumulate into the actual coloring.

Everything here is an educational simulation run inside one process — real
deployments use non-interactive proof systems, not this protocol.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from .commitments import commit, verify_reveal

Edge = tuple[int, int]


@dataclass(frozen=True)
class Graph:
    name: str
    nodes: int
    edges: list[Edge]
    coloring: list[int]  # prover's witness; colors in {1, 2, 3}


def bad_edges(graph: Graph, coloring: list[int]) -> list[Edge]:
    return [(u, v) for u, v in graph.edges if coloring[u] == coloring[v]]


# The Petersen graph: 10 nodes, 15 edges, chromatic number exactly 3.
# Outer 5-cycle (0-4), inner pentagram (5-9), spokes i <-> i+5.
PETERSEN = Graph(
    name="petersen",
    nodes=10,
    edges=[
        (0, 1), (1, 2), (2, 3), (3, 4), (4, 0),          # outer cycle
        (5, 7), (7, 9), (9, 6), (6, 8), (8, 5),          # inner pentagram
        (0, 5), (1, 6), (2, 7), (3, 8), (4, 9),          # spokes
    ],
    coloring=[1, 2, 1, 2, 3, 2, 3, 3, 1, 1],
)

# Same graph, but the prover's "witness" has exactly one bad edge (3, 4).
# This is the interesting cheater: caught with probability only 1/15 per
# round, so soundness has to be earned through repetition.
PETERSEN_CHEAT_COLORING = [1, 2, 1, 2, 2, 2, 3, 3, 1, 1]


@dataclass
class Round:
    challenged_edge: Edge
    colors_shown: tuple[int, int]   # permuted colors of the two endpoints
    openings_valid: bool
    colors_differ: bool

    @property
    def accepted(self) -> bool:
        return self.openings_valid and self.colors_differ


@dataclass
class Transcript:
    graph: Graph
    rounds: list[Round] = field(default_factory=list)

    @property
    def accepted_rounds(self) -> int:
        return sum(1 for r in self.rounds if r.accepted)

    @property
    def caught(self) -> bool:
        return any(not r.accepted for r in self.rounds)

    def cheat_survival_bound(self) -> float:
        """Max probability a one-bad-edge cheater survives this many rounds."""
        return (1 - 1 / len(self.graph.edges)) ** len(self.rounds)


def run_round(graph: Graph, coloring: list[int], rng: random.Random) -> Round:
    """One full commit/challenge/reveal/verify round, verifier honest."""
    labels = [1, 2, 3]
    rng.shuffle(labels)
    permuted = [labels[color - 1] for color in coloring]

    committed = [commit(str(color)) for color in permuted]

    u, v = graph.edges[rng.randrange(len(graph.edges))]

    openings_valid = all(
        verify_reveal(committed[node].commitment, str(permuted[node]),
                      committed[node].salt)
        for node in (u, v)
    )
    return Round(
        challenged_edge=(u, v),
        colors_shown=(permuted[u], permuted[v]),
        openings_valid=openings_valid,
        colors_differ=permuted[u] != permuted[v],
    )


def simulate(graph: Graph, coloring: list[int], rounds: int,
             seed: int | None = None) -> Transcript:
    rng = random.Random(seed)
    transcript = Transcript(graph)
    for _ in range(rounds):
        transcript.rounds.append(run_round(graph, coloring, rng))
    return transcript
