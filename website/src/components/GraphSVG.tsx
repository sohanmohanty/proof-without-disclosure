import type { Edge, Graph } from "../crypto/graphColoring";

const COLOR_FILLS: Record<number, string> = {
  1: "#e11d48", // rose
  2: "#0d9488", // teal
  3: "#f59e0b", // amber
};

/** The ZK stage: committed nodes are covered ("?"), the challenged edge's
 * endpoints are revealed with their permuted colors. */
export default function GraphSVG(props: {
  graph: Graph;
  revealed: Map<number, number>; // node -> shown color (this round only)
  challengedEdge: Edge | null;
  badEdge?: Edge | null; // a rejected edge, drawn red
  onChallengeEdge?: (edge: Edge) => void;
}) {
  const { graph, revealed, challengedEdge, badEdge, onChallengeEdge } = props;
  const size = 460;
  const pad = 42;
  const pos = (n: number): [number, number] => [
    pad + graph.layout[n][0] * (size - 2 * pad),
    pad + graph.layout[n][1] * (size - 2 * pad),
  ];
  const sameEdge = (a: Edge | null | undefined, b: Edge) =>
    !!a && a[0] === b[0] && a[1] === b[1];

  return (
    <div className="viz-frame">
      <svg viewBox={`0 0 ${size} ${size}`} aria-label={graph.displayName}>
        {graph.edges.map((edge) => {
          const [u, v] = edge;
          const [x1, y1] = pos(u);
          const [x2, y2] = pos(v);
          const cls = sameEdge(badEdge, edge)
            ? "edge-visible bad"
            : sameEdge(challengedEdge, edge)
              ? "edge-visible challenged"
              : "edge-visible";
          return (
            <g key={`${u}-${v}`}>
              <line className={cls} x1={x1} y1={y1} x2={x2} y2={y2} />
              {onChallengeEdge && (
                <line
                  className="edge-line clickable"
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  onClick={() => onChallengeEdge(edge)}
                >
                  <title>Challenge edge ({u}, {v})</title>
                </line>
              )}
            </g>
          );
        })}
        {graph.layout.map((_, n) => {
          const [x, y] = pos(n);
          const color = revealed.get(n);
          const isRevealed = color !== undefined;
          return (
            <g key={n}>
              <circle
                className="node-circle"
                cx={x} cy={y} r={19}
                fill={isRevealed ? COLOR_FILLS[color] : "var(--bg-inset)"}
                stroke={isRevealed ? "var(--ink)" : "var(--line)"}
              />
              <text
                x={x} y={y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill={isRevealed ? "#ffffff" : "var(--ink-faint)"}
              >
                {isRevealed ? color : "?"}
              </text>
              <text x={x + 24} y={y - 14} fontSize="10" fill="var(--ink-faint)">
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
