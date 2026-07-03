import { bytesToHex } from "../crypto/hex";
import type { MerkleTree } from "../crypto/merkle";

/** Renders the tree with leaves at the bottom, root on top. Highlights the
 * proof path (accent) and the sibling hashes a verifier needs (outline). */
export default function MerkleTreeSVG(props: {
  tree: MerkleTree;
  selectedLeaf: number | null;
  onSelectLeaf: (index: number) => void;
  tamperedLeaf?: number | null;
}) {
  const { tree, selectedLeaf, onSelectLeaf, tamperedLeaf } = props;
  const levels = tree.levels;
  const width = 900;
  const rowGap = 88;
  const height = levels.length * rowGap + 30;

  // node centers per level (leaves at bottom row)
  const centers: [number, number][][] = levels.map((level, li) => {
    const y = height - 40 - li * rowGap;
    return level.map((_, i) => {
      const x = ((i + 0.5) / level.length) * width;
      return [x, y];
    });
  });

  // proof path: indices per level + sibling indices, mirroring generateProof
  const pathNodes = new Set<string>();
  const siblingNodes = new Set<string>();
  if (selectedLeaf !== null) {
    let index = selectedLeaf;
    for (let li = 0; li < levels.length; li++) {
      pathNodes.add(`${li}:${index}`);
      const sibling = index ^ 1;
      if (li < levels.length - 1 && sibling < levels[li].length) {
        siblingNodes.add(`${li}:${sibling}`);
      }
      index = Math.floor(index / 2);
    }
  }

  const edges: { x1: number; y1: number; x2: number; y2: number; onPath: boolean }[] = [];
  for (let li = 0; li < levels.length - 1; li++) {
    for (let i = 0; i < levels[li].length; i++) {
      const parent = Math.floor(i / 2);
      // a promoted odd node connects straight up only if it is the promoted one
      const isPromoted = i === levels[li].length - 1 && levels[li].length % 2 === 1;
      const parentIdx = isPromoted ? levels[li + 1].length - 1 : parent;
      const [x1, y1] = centers[li][i];
      const [x2, y2] = centers[li + 1][parentIdx];
      edges.push({
        x1, y1, x2, y2,
        onPath: pathNodes.has(`${li}:${i}`) && pathNodes.has(`${li + 1}:${parentIdx}`),
      });
    }
  }

  return (
    <div className="viz-frame">
      <svg viewBox={`0 0 ${width} ${height}`} aria-label="Merkle tree">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.onPath ? "var(--accent)" : "var(--line)"}
            strokeWidth={e.onPath ? 3 : 1.5}
          />
        ))}
        {levels.map((level, li) =>
          level.map((hash, i) => {
            const [x, y] = centers[li][i];
            const key = `${li}:${i}`;
            const isLeaf = li === 0;
            const isRoot = li === levels.length - 1;
            const onPath = pathNodes.has(key);
            const isSibling = siblingNodes.has(key);
            const isTampered = isLeaf && tamperedLeaf === i;
            const fill = isTampered
              ? "var(--bad)"
              : onPath
                ? "var(--accent)"
                : "var(--bg-raised)";
            const radius = isRoot ? 26 : 20;
            return (
              <g
                key={key}
                onClick={isLeaf ? () => onSelectLeaf(i) : undefined}
                style={isLeaf ? { cursor: "pointer" } : undefined}
              >
                <circle
                  cx={x} cy={y} r={radius}
                  fill={fill}
                  stroke={isSibling ? "var(--warn)" : isTampered ? "var(--bad)" : "var(--line)"}
                  strokeWidth={isSibling ? 3.5 : 2}
                  strokeDasharray={isSibling ? "5 3" : undefined}
                />
                <text
                  x={x} y={y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--mono)"
                  fill={onPath || isTampered ? "var(--bg-raised)" : "var(--ink-soft)"}
                >
                  {bytesToHex(hash).slice(0, 6)}
                </text>
                {isRoot && (
                  <text x={x} y={y - 34} textAnchor="middle" fontSize="12"
                        fontWeight="700" fill="var(--ink)">
                    root
                  </text>
                )}
                {isLeaf && (
                  <text x={x} y={y + 38} textAnchor="middle" fontSize="11"
                        fill="var(--ink-faint)">
                    {tree.items[i].length > 14
                      ? tree.items[i].slice(0, 12) + "…"
                      : tree.items[i]}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
