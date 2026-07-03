import { cheatSurvivalBound } from "../crypto/graphColoring";

/** Soundness made visible: the ceiling on a cheater's survival probability
 * after k accepted rounds, and the confidence that implies. */
export default function ConfidenceMeter(props: {
  edgeCount: number;
  acceptedRounds: number;
}) {
  const bound = cheatSurvivalBound(props.edgeCount, props.acceptedRounds);
  const confidence = 1 - bound;
  return (
    <div>
      <div className="stat-row">
        <div className="stat">
          Rounds passed <b>{props.acceptedRounds}</b>
        </div>
        <div className="stat">
          Max cheater survival odds{" "}
          <b>
            {bound >= 0.001
              ? (bound * 100).toFixed(2) + "%"
              : bound.toExponential(2)}
          </b>
        </div>
        <div className="stat">
          Verifier confidence <b>{(confidence * 100).toFixed(confidence > 0.999 ? 4 : 2)}%</b>
        </div>
      </div>
      <div className="meter" aria-label="verifier confidence">
        <div style={{ width: `${Math.max(1, confidence * 100)}%` }} />
      </div>
      <p className="footnote" style={{ marginTop: "0.4rem" }}>
        A prover whose coloring has even one bad edge survives each round with
        probability at most 1 − 1/{props.edgeCount}. After k clean rounds:
        (1 − 1/{props.edgeCount})<sup>k</sup>.
      </p>
    </div>
  );
}
