/** Chapter 3: the Merkle tree.
 *
 * Five student records are hashed into leaves (RFC 6962 domain separation,
 * merkle.ts), paired upward until one root vouches for the whole set; odd
 * nodes promote unchanged, so the right spine is the same hash climbing.
 * Every node is tinted by the first byte of its REAL digest: the data
 * literally colors the tree. Then a proof for student_2 lights up: the
 * parent chain glows accent, the three siblings handed to the verifier glow
 * warn, and every leaf the proof never mentions goes dark. That darkness is
 * the point: membership shown, nothing else disclosed.
 *
 * Follows the exemplar contract (HeroField.tsx): chapterFrame gate, pure
 * function of (local, elapsed time), instanced meshes, module-scope temps,
 * palette copied per frame.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { bytesToHex } from "../../crypto/hex";
import {
  buildTree,
  generateProof,
  type MerkleTree,
  type ProofStep,
} from "../../crypto/merkle";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { bump, easeOutCubic, lerp, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

const MEMBERS = [
  "student_1",
  "student_2",
  "student_3",
  "student_4",
  "student_5",
];
const PROVEN_LEAF = 1; // student_2

const LEAF_Y = -2.7;
const ROOT_Y = 2.9;
const LEAF_SPREAD = 1.35;

// node roles: 0 = plain (dims during PROVE), then the two proof roles
const ROLE_PATH = 1; // leaf 1 and its parent chain up to the root
const ROLE_SIBLING = 2; // the hashes the proof actually ships

// module-scope temps: useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const lineCol = new THREE.Color();
const accentCol = new THREE.Color();
const goodCol = new THREE.Color();
const warnCol = new THREE.Color();
const bgCol = new THREE.Color();

interface TreeData {
  tree: MerkleTree;
  proof: ProofStep[];
}

export default function MerkleChapter() {
  const palette = usePalette();
  const group = useRef<THREE.Group>(null!);
  const nodeMesh = useRef<THREE.InstancedMesh>(null!);
  const edgeMesh = useRef<THREE.InstancedMesh>(null!);
  const moteMesh = useRef<THREE.InstancedMesh>(null!);
  const nodeMaterial = useRef<THREE.MeshStandardMaterial>(null!);
  const edgeMaterial = useRef<THREE.MeshBasicMaterial>(null!);
  const moteMaterial = useRef<THREE.MeshBasicMaterial>(null!);
  const rootHalo = useRef<THREE.Mesh>(null!);
  const rootHaloMaterial = useRef<THREE.MeshBasicMaterial>(null!);

  const [data, setData] = useState<TreeData | null>(null);

  // one-time crypto: real SHA-256 tree over the roster + a real proof
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tree = await buildTree(MEMBERS);
      const proof = generateProof(tree, PROVEN_LEAF);
      if (!cancelled) setData({ tree, proof });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // geometry of the tree, derived once from the real hashes
  const layout = useMemo(() => {
    if (!data) return null;
    const { tree, proof } = data;
    const levels = tree.levels;
    const numLevels = levels.length; // 4: sizes 5, 3, 2, 1
    const offsets: number[] = [];
    let nodeCount = 0;
    for (const lvl of levels) {
      offsets.push(nodeCount);
      nodeCount += lvl.length;
    }
    const x = new Float32Array(nodeCount);
    const y = new Float32Array(nodeCount);
    const level = new Int16Array(nodeCount);
    const index = new Int16Array(nodeCount);
    const mix = new Float32Array(nodeCount); // hash byte -> tint amount
    const role = new Uint8Array(nodeCount);
    const bob = new Float32Array(nodeCount);
    const stepY = (ROOT_Y - LEAF_Y) / (numLevels - 1);

    for (let i = 0; i < levels[0].length; i++) {
      x[i] = (i - (levels[0].length - 1) / 2) * LEAF_SPREAD;
      y[i] = LEAF_Y;
    }
    for (let L = 1; L < numLevels; L++) {
      for (let p = 0; p < levels[L].length; p++) {
        const c0 = offsets[L - 1] + 2 * p;
        // promoted nodes have one child and sit directly above it
        const c1 = 2 * p + 1 < levels[L - 1].length ? c0 + 1 : c0;
        x[offsets[L] + p] = (x[c0] + x[c1]) / 2;
        y[offsets[L] + p] = LEAF_Y + L * stepY;
      }
    }
    for (let L = 0; L < numLevels; L++) {
      for (let i = 0; i < levels[L].length; i++) {
        const n = offsets[L] + i;
        level[n] = L;
        index[n] = i;
        mix[n] = (levels[L][i][0] / 255) * 0.3;
        bob[n] = Math.random() * Math.PI * 2;
      }
    }

    // parent chain of the proven leaf: level0[1] -> level1[0] -> level2[0] -> root
    let chain = PROVEN_LEAF;
    for (let L = 0; L < numLevels; L++) {
      role[offsets[L] + chain] = ROLE_PATH;
      chain = Math.floor(chain / 2);
    }
    // siblings located by matching the REAL proof hashes against the levels
    // (note: proof[2] IS the promoted leaf level0[4]'s hash, found at level 2)
    for (let L = 0; L < proof.length; L++) {
      for (let i = 0; i < levels[L].length; i++) {
        if (bytesToHex(levels[L][i]) === proof[L].hash) {
          role[offsets[L] + i] = ROLE_SIBLING;
        }
      }
    }

    const edgeChild: number[] = [];
    const edgeParent: number[] = [];
    for (let L = 1; L < numLevels; L++) {
      for (let p = 0; p < levels[L].length; p++) {
        edgeChild.push(offsets[L - 1] + 2 * p);
        edgeParent.push(offsets[L] + p);
        if (2 * p + 1 < levels[L - 1].length) {
          edgeChild.push(offsets[L - 1] + 2 * p + 1);
          edgeParent.push(offsets[L] + p);
        }
      }
    }

    return {
      nodeCount,
      numLevels,
      x,
      y,
      level,
      index,
      mix,
      role,
      bob,
      edgeCount: edgeChild.length,
      edgeChild: Int16Array.from(edgeChild),
      edgeParent: Int16Array.from(edgeParent),
      yNow: new Float32Array(nodeCount), // scratch: post-choreography y
      rootX: x[nodeCount - 1],
      rootY: y[nodeCount - 1],
    };
  }, [data]);

  // ambient motes drifting across the full stage width
  const motes = useMemo(() => {
    const count = journey.quality === "low" ? 40 : 84;
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    return {
      count,
      x: Float32Array.from({ length: count }, () => rand(-4.3, 8.7)),
      y: Float32Array.from({ length: count }, () => rand(-4.2, 4.2)),
      z: Float32Array.from({ length: count }, () => rand(-2.6, 1.2)),
      s: Float32Array.from({ length: count }, () => rand(0.5, 1.4)),
      seedA: Float32Array.from({ length: count }, () => rand(0, Math.PI * 2)),
      seedB: Float32Array.from({ length: count }, () => rand(0, Math.PI * 2)),
    };
  }, []);

  useFrame((state) => {
    const { local, on } = chapterFrame("merkle");
    group.current.visible = on;
    if (!on) return;
    const lay = layout;
    if (!lay || !nodeMesh.current) return; // crypto still hashing

    const t = state.clock.elapsedTime;
    const lastLevel = lay.numLevels - 1;

    // presence + beats
    const fade =
      smoothstep(phase(local, 0.02, 0.12)) *
      (1 - smoothstep(phase(local, 0.85, 0.96)));
    const proveIn = smoothstep(phase(local, 0.24, 0.32));
    const rootBeat = smoothstep(phase(local, 0.44, 0.53));
    // everything outside the proof: ~15% presence during PROVE, ~6% at ROOT
    const dim = proveIn * lerp(0.85, 0.94, rootBeat);

    group.current.position.set(-2.2, 0, 0);
    nodeMaterial.current.opacity = fade;
    edgeMaterial.current.opacity = fade * 0.85;
    moteMaterial.current.opacity = fade * (0.3 - 0.18 * proveIn);
    moteMaterial.current.color.copy(palette.inkFaint);

    lineCol.copy(palette.line);
    accentCol.copy(palette.accent);
    goodCol.copy(palette.good);
    warnCol.copy(palette.warn);
    bgCol.copy(palette.bg);

    // ---- nodes -------------------------------------------------------
    const nm = nodeMesh.current;
    for (let n = 0; n < lay.nodeCount; n++) {
      const L = lay.level[n];
      const i = lay.index[n];
      // ASSEMBLE: level L pops in, staggered within the level (kept quick so
      // the tree is fully built before the glow starts traveling up)
      const a0 = 0.05 + L * 0.05 + i * 0.012;
      const ap = phase(local, a0, a0 + 0.08);
      // EXIT: levels sink in reverse order (root first) and shrink away
      const e0 = 0.8 + (lastLevel - L) * 0.03;
      const sink = smoothstep(phase(local, e0, e0 + 0.1));
      let s = easeOutCubic(ap) * (1 + bump(ap) * 0.28) * (1 - sink);
      const yy =
        lay.y[n] + Math.sin(t * 0.7 + lay.bob[n]) * 0.045 - sink * 1.4;

      // the hash's first byte tints line -> accent: data colors the tree
      tmpColor.lerpColors(lineCol, accentCol, lay.mix[n]);
      const role = lay.role[n];
      if (role === ROLE_PATH) {
        // PROVE: glow travels up the parent chain, one level at a time
        const hi = smoothstep(phase(local, 0.24 + L * 0.045, 0.33 + L * 0.045));
        tmpColor.lerp(accentCol, hi);
        if (L === 0) s *= 1 + hi * 0.3; // the proven leaf steps forward
        if (n === lay.nodeCount - 1) {
          // ROOT: the one hash that vouches for everything pulses good
          tmpColor.lerp(goodCol, rootBeat);
          s *= 1 + rootBeat * (0.25 + Math.sin(t * 5) * 0.04);
        }
      } else if (role === ROLE_SIBLING) {
        const hi = smoothstep(
          phase(local, 0.26 + L * 0.045, 0.35 + L * 0.045),
        );
        tmpColor.lerp(warnCol, hi);
      } else {
        tmpColor.lerp(bgCol, dim); // undisclosed leaves stay dark
        s *= 1 - dim * 0.12;
      }

      lay.yNow[n] = yy;
      tmpObject.position.set(lay.x[n], yy, 0);
      tmpObject.rotation.set(0, 0, 0);
      tmpObject.scale.set(s, s, s);
      tmpObject.updateMatrix();
      nm.setMatrixAt(n, tmpObject.matrix);
      nm.setColorAt(n, tmpColor);
    }
    nm.instanceMatrix.needsUpdate = true;
    if (nm.instanceColor) nm.instanceColor.needsUpdate = true;

    // ---- edges (child -> parent, grow once both ends exist) -----------
    const em = edgeMesh.current;
    for (let e = 0; e < lay.edgeCount; e++) {
      const c = lay.edgeChild[e];
      const p = lay.edgeParent[e];
      const Lp = lay.level[p];
      const Lc = lay.level[c];
      const g0 = 0.08 + Lp * 0.05 + lay.index[p] * 0.012;
      let grow = easeOutCubic(phase(local, g0, g0 + 0.1));
      const e0 = 0.8 + (lastLevel - Lp) * 0.03;
      grow *= 1 - smoothstep(phase(local, e0, e0 + 0.1));

      const x1 = lay.x[c];
      const y1 = lay.yNow[c];
      tmpVec.set(lay.x[p] - x1, lay.yNow[p] - y1, 0);
      const len = tmpVec.length();
      if (len > 1e-4) tmpVec.divideScalar(len);
      tmpQuat.setFromUnitVectors(UP, tmpVec);

      tmpColor.copy(lineCol);
      let w = 1;
      const roleC = lay.role[c];
      if (roleC === ROLE_PATH) {
        const hi = smoothstep(
          phase(local, 0.27 + Lc * 0.045, 0.36 + Lc * 0.045),
        );
        tmpColor.lerp(accentCol, hi);
        w = 1 + hi * 0.9;
      } else if (roleC === ROLE_SIBLING) {
        const hi = smoothstep(
          phase(local, 0.28 + Lc * 0.045, 0.37 + Lc * 0.045),
        );
        tmpColor.lerp(warnCol, hi * 0.9);
      } else {
        tmpColor.lerp(bgCol, dim);
      }

      const gl = len * grow; // anchored at the child, grows toward parent
      tmpObject.position.set(
        x1 + tmpVec.x * gl * 0.5,
        y1 + tmpVec.y * gl * 0.5,
        -0.08,
      );
      tmpObject.quaternion.copy(tmpQuat);
      tmpObject.scale.set(w, Math.max(gl, 1e-4), w);
      tmpObject.updateMatrix();
      em.setMatrixAt(e, tmpObject.matrix);
      em.setColorAt(e, tmpColor);
    }
    em.instanceMatrix.needsUpdate = true;
    if (em.instanceColor) em.instanceColor.needsUpdate = true;

    // ---- ambient motes ------------------------------------------------
    const mm = moteMesh.current;
    for (let m = 0; m < motes.count; m++) {
      tmpObject.position.set(
        motes.x[m] + Math.sin(t * 0.35 + motes.seedA[m]) * 0.4,
        motes.y[m] + Math.sin(t * 0.28 + motes.seedB[m]) * 0.35,
        motes.z[m],
      );
      tmpObject.rotation.set(0, 0, 0);
      tmpObject.scale.set(motes.s[m], motes.s[m], motes.s[m]);
      tmpObject.updateMatrix();
      mm.setMatrixAt(m, tmpObject.matrix);
    }
    mm.instanceMatrix.needsUpdate = true;

    // the root announcing itself: a basic-material halo rather than a
    // pointLight: mounting/unmounting a scene light changes the light count
    // and forces every standard material in the canvas to recompile its
    // shader, a visible hitch right as the chapter scrolls in
    rootHalo.current.scale.setScalar(Math.max(1e-4, 1 + rootBeat * 0.6));
    rootHaloMaterial.current.color.copy(goodCol);
    rootHaloMaterial.current.opacity = rootBeat * fade * 0.35;
  });

  // empty group until the tree is hashed; keeps the chapterFrame gate valid
  return (
    <group ref={group}>
      {layout && (
        <>
          <instancedMesh
            ref={edgeMesh}
            args={[undefined, undefined, layout.edgeCount]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.05, 1, 0.05]} />
            <meshBasicMaterial ref={edgeMaterial} transparent />
          </instancedMesh>
          <instancedMesh
            ref={nodeMesh}
            args={[undefined, undefined, layout.nodeCount]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.72, 0.44, 0.2]} />
            <meshStandardMaterial
              ref={nodeMaterial}
              roughness={0.5}
              metalness={0}
              transparent
            />
          </instancedMesh>
          <instancedMesh
            ref={moteMesh}
            args={[undefined, undefined, motes.count]}
            frustumCulled={false}
          >
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshBasicMaterial ref={moteMaterial} transparent />
          </instancedMesh>
          <mesh ref={rootHalo} position={[layout.rootX, layout.rootY, -0.3]}>
            <sphereGeometry args={[0.85, 20, 16]} />
            <meshBasicMaterial
              ref={rootHaloMaterial}
              transparent
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
