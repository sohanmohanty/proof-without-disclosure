import { useMemo, useState } from "react";
import { nextTask } from "../crypto/async";
import CodeBlock from "../components/CodeBlock";
import ConfidenceMeter from "../components/ConfidenceMeter";
import GraphSVG from "../components/GraphSVG";
import Guarantees from "../components/Guarantees";
import MathAside from "../components/MathAside";
import { LabPage, Section } from "../components/LabPage";
import {
  badEdges,
  commitPhase,
  K4,
  openEdge,
  PETERSEN,
  PETERSEN_CHEAT_COLORING,
  roundsForConfidence,
  type Edge,
  type RoundState,
} from "../crypto/graphColoring";

type Mode = "honest" | "cheat" | "impossible";

const MODES: Record<Mode, { label: string; graph: typeof PETERSEN; coloring: number[]; blurb: string }> = {
  honest: {
    label: "Honest prover",
    graph: PETERSEN,
    coloring: PETERSEN.coloring,
    blurb: "The prover really knows a valid 3-coloring of the Petersen graph. It lives in this tab's memory and is never drawn on screen.",
  },
  cheat: {
    label: "Cheating prover",
    graph: PETERSEN,
    coloring: PETERSEN_CHEAT_COLORING,
    blurb: "The prover's coloring has exactly one bad edge hidden among 15. Each round they survive with probability 14/15. Catch them.",
  },
  impossible: {
    label: "Impossible claim (K₄)",
    graph: K4,
    coloring: K4.coloring,
    blurb: "K₄ connects all four nodes to each other, so no 3-coloring can ever work. The prover's claim is a lie by definition.",
  },
};

export default function ZKColoringLab() {
  const [mode, setMode] = useState<Mode>("honest");
  const { graph, coloring, blurb } = MODES[mode];

  const [round, setRound] = useState<RoundState | null>(null);
  const [revealed, setRevealed] = useState<Map<number, number>>(new Map());
  const [challenged, setChallenged] = useState<Edge | null>(null);
  const [lastVerdict, setLastVerdict] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState(0);
  const [total, setTotal] = useState(0);
  const [caughtAt, setCaughtAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  const knownBadEdge = useMemo(() => {
    const bad = badEdges(graph, coloring);
    return bad.length > 0 ? bad[0] : null;
  }, [graph, coloring]);

  function resetAll(newMode: Mode) {
    setMode(newMode);
    setRound(null);
    setRevealed(new Map());
    setChallenged(null);
    setLastVerdict(null);
    setAccepted(0);
    setTotal(0);
    setCaughtAt(null);
  }

  async function newRound() {
    setRound(await commitPhase(coloring));
    setRevealed(new Map());
    setChallenged(null);
    setLastVerdict(null);
  }

  async function challenge(edge: Edge, state?: RoundState) {
    const current = state ?? round;
    if (!current) return;
    const { openings, accepted: ok } = await openEdge(current, edge);
    setChallenged(edge);
    setRevealed(new Map(openings.map((o) => [o.node, o.color])));
    setLastVerdict(ok);
    setTotal((t) => t + 1);
    if (ok) {
      setAccepted((a) => a + 1);
    } else {
      setCaughtAt((c) => c ?? total + 1);
    }
    setRound(null); // this round's commitments are spent
  }

  async function randomChallenge() {
    const state = round ?? (await commitPhase(coloring));
    if (!round) setRound(state);
    const edge = graph.edges[Math.floor(Math.random() * graph.edges.length)];
    await challenge(edge, state);
  }

  async function runRounds(n: number) {
    setRunning(true);
    let localAccepted = 0;
    let caught: number | null = null;
    let lastState: {
      edge: Edge; reveal: Map<number, number>; ok: boolean;
    } | null = null;
    for (let i = 0; i < n; i++) {
      const state = await commitPhase(coloring);
      const edge = graph.edges[Math.floor(Math.random() * graph.edges.length)];
      const { openings, accepted: ok } = await openEdge(state, edge);
      lastState = { edge, reveal: new Map(openings.map((o) => [o.node, o.color])), ok };
      if (ok) localAccepted++;
      else {
        caught = i + 1;
        break;
      }
      if (i % 10 === 9) await nextTask();
    }
    if (lastState) {
      setChallenged(lastState.edge);
      setRevealed(lastState.reveal);
      setLastVerdict(lastState.ok);
    }
    setAccepted((a) => a + localAccepted);
    setTotal((t) => t + localAccepted + (caught !== null ? 1 : 0));
    if (caught !== null) setCaughtAt((c) => c ?? total + caught);
    setRound(null);
    setRunning(false);
  }

  const committedCount = round ? round.commitments.length : 0;

  return (
    <LabPage
      kicker="Module 05"
      title="Zero-Knowledge Proofs"
      question="How can you prove you know a solution, without showing it?"
      intro={
        <p>
          The prover claims: <em>"I can color this graph with 3 colors so that
          no connected nodes match."</em> You, the verifier, never get to see
          the coloring. Instead, each round the prover shuffles the color
          labels, locks every node's color in a commitment (module 02!), and
          lets you open <strong>one edge of your choice</strong>. Different
          colors: they survive. Same color: caught. Repeat until you believe.
        </p>
      }
    >
      <Section title="Choose your prover">
        <div className="controls">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              className={m === mode ? "primary" : "ghost"}
              onClick={() => resetAll(m)}
              disabled={running}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>
        <p className="footnote">{blurb}</p>
      </Section>

      <Section title="The protocol, one round at a time">
        <div className="split">
          <div>
            <div className="controls">
              <button
                className="primary"
                onClick={() => void newRound()}
                disabled={running || !!round}
              >
                1. Commit to a shuffled coloring
              </button>
              <button
                className="ghost"
                onClick={() => void randomChallenge()}
                disabled={running}
              >
                {round ? "2. Random challenge" : "Commit + random challenge"}
              </button>
            </div>
            {round && (
              <p className="footnote">
                {committedCount} commitments locked (one per node). Now click
                any edge in the graph to challenge it.
              </p>
            )}
            {round && (
              <CodeBlock
                label={`this round's commitments (${committedCount} nodes)`}
                code={round.commitments
                  .slice(0, 4)
                  .map((c, i) => `node ${i}: ${c.commitment.slice(0, 40)}…`)
                  .join("\n") + (committedCount > 4 ? `\n… ${committedCount - 4} more` : "")}
              />
            )}
            {lastVerdict !== null && challenged && (
              <div className={`banner ${lastVerdict ? "valid" : "invalid"}`}>
                <strong>
                  {lastVerdict
                    ? `✓ Edge (${challenged[0]}, ${challenged[1]}) opened: colors differ`
                    : `✗ Edge (${challenged[0]}, ${challenged[1]}) opened: SAME color. Prover caught!`}
                </strong>
                <ul>
                  <li>
                    Both commitment openings checked out
                    {lastVerdict
                      ? ", and the endpoints show different colors. This edge is fine, but you learned nothing about the rest."
                      : ", so the prover couldn't hide it: this edge is monochrome. The claim is false."}
                  </li>
                </ul>
              </div>
            )}
            <div className="controls">
              <button className="ghost" onClick={() => void runRounds(10)} disabled={running}>
                Auto-run 10 rounds
              </button>
              <button className="ghost" onClick={() => void runRounds(100)} disabled={running}>
                Auto-run 100 rounds
              </button>
              {running && <span className="footnote">running…</span>}
            </div>
          </div>
          <div>
            <GraphSVG
              graph={graph}
              revealed={revealed}
              challengedEdge={challenged}
              badEdge={lastVerdict === false ? challenged : null}
              onChallengeEdge={round && !running ? (e) => void challenge(e) : undefined}
            />
            <p className="footnote">
              Covered nodes hold committed colors. Only a challenged edge's two
              endpoints are ever opened, and labels are re-shuffled before the
              next round, so reveals never add up to the real coloring.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Confidence: soundness you can measure">
        <ConfidenceMeter edgeCount={graph.edges.length} acceptedRounds={accepted} />
        <div className="stat-row">
          <div className="stat">Rounds total <b>{total}</b></div>
          <div className="stat">
            Rounds for 99.9% confidence{" "}
            <b>{roundsForConfidence(graph.edges.length, 0.001)}</b>
          </div>
          {caughtAt !== null && (
            <div className="stat">
              Caught at round <b>{caughtAt}</b>
            </div>
          )}
        </div>
        {caughtAt !== null && knownBadEdge && (
          <div className="banner invalid">
            <strong>✗ This prover was caught cheating.</strong>
            <ul>
              <li>
                The bad edge was ({knownBadEdge[0]}, {knownBadEdge[1]}). With{" "}
                {graph.edges.length} edges, a cheater expects to survive about{" "}
                {graph.edges.length} rounds; soundness is a statistical noose
                that tightens every round.
              </li>
            </ul>
          </div>
        )}
        {mode === "honest" && accepted >= 20 && (
          <div className="banner valid">
            <strong>✓ Notice what just happened.</strong>
            <ul>
              <li>
                You are {((1 - (1 - 1 / graph.edges.length) ** accepted) * 100).toFixed(2)}%
                sure the prover knows a valid coloring, and you could not
                reconstruct even three nodes of it. That is zero-knowledge.
              </li>
            </ul>
          </div>
        )}
      </Section>

      <Section title="Why the shuffle matters, and what this proves">
        <CodeBlock
          label="one round"
          code={`
prover:   π = random permutation of {1,2,3}     # fresh EVERY round
          for each node v: publish commit(π(color[v]))
verifier: pick any edge (u, v)                  # your free choice
prover:   open commitments for u and v only
verifier: openings valid AND colors differ  ->  accept round`}
        />
        <p>
          Without the shuffle, reveals would accumulate: challenge (0,1) then
          (1,2) and you would learn three nodes of the true coloring. With a
          fresh relabeling each round, "node 3 is teal" this round and "node 3
          is rose" the next are both meaningless; each round leaks exactly one
          bit: <em>this edge is properly colored under some naming</em>.
        </p>
        <Guarantees
          does={[
            "Completeness: an honest prover survives every round",
            "Soundness: a false claim dies exponentially fast in rounds",
            "Zero-knowledge: the verifier learns nothing but the claim itself",
            "The verifier's random choices are what make it trustworthy",
          ]}
          doesnt={[
            "One round proves almost nothing (14/15 survival); repetition is the proof",
            "This toy protocol needs interaction (module 06 removes that)",
            "Not a production ZK system: real ones prove statements non-interactively",
          ]}
          world={[
            "ZK proofs let you prove you're over 18 without showing your birthdate",
            "Private credentials: prove membership without identifying yourself",
            "zk-rollups verify thousands of transactions with one succinct proof",
            "Graph 3-coloring is NP-complete, so this game generalizes to ALL of NP",
          ]}
        />
        <MathAside>
          <p>
            <strong>Soundness.</strong> A false claim means every possible
            coloring has ≥ 1 bad edge, so a uniformly random challenge catches
            the prover with probability ≥ 1/|E| per round; surviving k rounds
            happens with probability ≤ (1 − 1/|E|)ᵏ → 0 exponentially.{" "}
            <strong>Zero-knowledge.</strong> A simulator that knows nothing can
            fake convincing transcripts: pick the edge first, color its two
            endpoints differently at random, commit garbage everywhere else.
            The distribution matches real transcripts, so transcripts carry no
            knowledge. <strong>Generality.</strong> 3-coloring is NP-complete
            (Karp, 1972), so any NP statement ("I know a password", "this
            transaction is valid") can be encoded as a graph and proven this
            way (Goldreich–Micali–Wigderson, 1986). Toy protocol, universal
            idea.
          </p>
        </MathAside>
      </Section>
    </LabPage>
  );
}
