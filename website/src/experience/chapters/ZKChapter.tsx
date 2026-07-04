/** Chapter 5 — zero-knowledge graph coloring.
 *
 * The Petersen graph as a slowly orbiting 3D cage: outer ring, inner
 * pentagram, five spokes — 10 nodes, 15 edges, chromatic number exactly 3.
 * The prover's real witness (PETERSEN.coloring from graphColoring.ts) stays
 * sealed inside neutral envelopes. Each round the verifier points at one
 * edge: its two endpoints swell and reveal their colors — always different —
 * hold, then reseal; every node does a quick shuffle-spin as the three
 * labels pass through a fresh permutation of {1,2,3} before the next round.
 * One inequality per round, nothing else — the reshuffle destroys any memory
 * between rounds. The challenge walks (r·7 mod 15), 7 coprime to 15, so all
 * fifteen edges get their turn: certainty stacks at (1 − 1/15) per round.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PETERSEN } from "../../crypto/graphColoring";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { bump, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

const NODE_COUNT = PETERSEN.nodes; // 10
const EDGE_COUNT = PETERSEN.edges.length; // 15
const COLORING = PETERSEN.coloring; // real witness, colors in {1,2,3}
const ROUND_SECONDS = 2.4;

/** All 6 permutations of the labels {1,2,3}. Round r uses PERMS[r % 6]
 * composed with a cyclic offset from ⌊r/6⌋, so consecutive rounds always
 * relabel differently — a deterministic stand-in for the protocol's uniform
 * shuffle that stays a pure function of elapsed time (remount-safe). */
const PERMS = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 1, 3],
  [2, 3, 1],
  [3, 1, 2],
  [3, 2, 1],
];

// module-scope temps — useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const sealedColor = new THREE.Color();
const edgeBase = new THREE.Color();
const edgeHot = new THREE.Color();
/** revealed color per label: 1 → accent, 2 → warn, 3 → good */
const labelColors = [new THREE.Color(), new THREE.Color(), new THREE.Color()];

export default function ZKChapter() {
  const palette = usePalette();
  const low = journey.quality === "low";
  const group = useRef<THREE.Group>(null!);
  const nodeMesh = useRef<THREE.InstancedMesh>(null!);
  const edgeMesh = useRef<THREE.InstancedMesh>(null!);
  const nodeMaterial = useRef<THREE.MeshStandardMaterial>(null!);
  const edgeMaterial = useRef<THREE.MeshStandardMaterial>(null!);

  // 3D Petersen embedding + per-edge transform, computed once. Node i and
  // node i+5 share an angle so the five spokes read as straight rungs.
  const layout = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const angle = Math.PI / 2 + (2 * Math.PI * (i % 5)) / 5;
      const outer = i < 5;
      const radius = outer ? 2.75 : 1.5;
      positions.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          outer ? 0.6 : -0.6,
        ),
      );
    }
    const mids: THREE.Vector3[] = [];
    const quats: THREE.Quaternion[] = [];
    const lengths = new Float32Array(EDGE_COUNT);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    PETERSEN.edges.forEach(([a, b], j) => {
      const pa = positions[a];
      const pb = positions[b];
      mids.push(pa.clone().add(pb).multiplyScalar(0.5));
      dir.subVectors(pb, pa);
      lengths[j] = dir.length();
      quats.push(new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()));
    });
    return { positions, mids, quats, lengths };
  }, []);

  useFrame((state) => {
    const { local, on } = chapterFrame("zk");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;

    // group choreography: focal sits left of the caption card, slow orbit,
    // contracts to its own center and fades on exit
    const exit = smoothstep(phase(local, 0.85, 0.98));
    group.current.position.set(-2.1, 0, 0);
    group.current.rotation.y = t * 0.1;
    group.current.scale.setScalar(Math.max(0.02, 1 - exit));

    const fade =
      smoothstep(phase(local, 0.02, 0.1)) *
      (1 - smoothstep(phase(local, 0.86, 0.96)));
    nodeMaterial.current.opacity = fade;
    edgeMaterial.current.opacity = fade * 0.85;

    sealedColor.copy(palette.line);
    edgeBase.copy(palette.inkFaint);
    edgeHot.copy(palette.good);
    labelColors[0].copy(palette.accent);
    labelColors[1].copy(palette.warn);
    labelColors[2].copy(palette.good);

    // ---- round loop, a pure function of elapsed time ----
    const r = Math.floor(t / ROUND_SECONDS);
    const u = t / ROUND_SECONDS - r;
    const challengedIndex = (r * 7) % EDGE_COUNT; // 7 ⊥ 15: hits every edge
    const challenged = PETERSEN.edges[challengedIndex];
    const permBase = PERMS[r % 6];
    const permOffset = ((r / 6) | 0) % 3;

    // reveals only run while the chapter holds the stage (local 0.15..0.85)
    const loopGate =
      smoothstep(phase(local, 0.12, 0.18)) *
      (1 - smoothstep(phase(local, 0.8, 0.86)));
    // open 0..0.12, hold to 0.62, reseal 0.62..0.78
    const openAmt =
      smoothstep(phase(u, 0, 0.12)) *
      (1 - smoothstep(phase(u, 0.62, 0.78))) *
      loopGate;
    // shuffle beat 0.78..1: a quick squash-spin as the labels re-permute
    const sp = phase(u, 0.78, 0.98);
    const spinAngle = smoothstep(sp) * Math.PI * loopGate;
    const spinBump = bump(sp) * loopGate;

    const nodes = nodeMesh.current;
    for (let i = 0; i < NODE_COUNT; i++) {
      const enter = smoothstep(phase(local, 0.02 + i * 0.005, 0.1 + i * 0.005));
      const reveal = i === challenged[0] || i === challenged[1] ? openAmt : 0;
      const p = layout.positions[i];
      tmpObject.position.set(
        p.x,
        p.y + Math.sin(t * 0.7 + i * 1.7) * 0.06,
        p.z,
      );
      tmpObject.rotation.set(0, 0, spinAngle);
      const k = enter * (1 + bump(enter) * 0.18) * (1 + reveal * 0.4);
      const squash = spinBump * 0.26;
      tmpObject.scale.set(k * (1 + squash * 0.6), k * (1 - squash), k);
      tmpObject.updateMatrix();
      nodes.setMatrixAt(i, tmpObject.matrix);
      // real witness color under this round's label permutation
      const label =
        ((permBase[COLORING[i] - 1] - 1 + permOffset) % 3) + 1;
      nodes.setColorAt(
        i,
        tmpColor.lerpColors(sealedColor, labelColors[label - 1], reveal),
      );
    }
    nodes.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;

    const edges = edgeMesh.current;
    for (let j = 0; j < EDGE_COUNT; j++) {
      const enter = smoothstep(
        phase(local, 0.03 + j * 0.0035, 0.1 + j * 0.0035),
      );
      const hot = j === challengedIndex ? openAmt : 0;
      tmpObject.position.copy(layout.mids[j]);
      tmpObject.quaternion.copy(layout.quats[j]);
      tmpObject.scale.set(1 + hot * 0.9, layout.lengths[j] * enter, 1 + hot * 0.9);
      tmpObject.updateMatrix();
      edges.setMatrixAt(j, tmpObject.matrix);
      edges.setColorAt(j, tmpColor.lerpColors(edgeBase, edgeHot, hot));
    }
    edges.instanceMatrix.needsUpdate = true;
    if (edges.instanceColor) edges.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <instancedMesh
        ref={nodeMesh}
        args={[undefined, undefined, NODE_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.34, low ? 16 : 28, low ? 12 : 20]} />
        <meshStandardMaterial
          ref={nodeMaterial}
          roughness={0.45}
          metalness={0}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        ref={edgeMesh}
        args={[undefined, undefined, EDGE_COUNT]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.04, 0.04, 1, low ? 6 : 10, 1, true]} />
        <meshStandardMaterial
          ref={edgeMaterial}
          roughness={0.6}
          metalness={0}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
