/** Chapter 4 — digital signatures.
 *
 * The textbook curve y² = x³ − 3x + 3 over the reals — the P-256 equation
 * family — draws itself on, then the chord-and-tangent group law runs live:
 * pick P and Q, the chord through them meets the curve a third time, drop
 * to the mirror point and that is P + Q. Every coordinate here is exact
 * real arithmetic (λ, x₃, y₃), never staged. The dance only runs one way —
 * adding points is easy, un-adding them is infeasible — which is why a
 * private scalar can stamp a document: the seal descends and leaves an
 * imprint of ticks keyed to a real 64-byte r||s ECDSA P-256 signature
 * produced by Web Crypto (crypto/signatures.ts) — one tick per byte, or
 * every other byte on low quality.
 *
 * Follows the exemplar contract in HeroField.tsx: chapterFrame() gate,
 * choreography as a pure function of (local, elapsed), instancing,
 * module-scope temps, palette colors copied every frame.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { hexToBytes, utf8 } from "../../crypto/hex";
import { generateKeyPair, sign } from "../../crypto/signatures";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { bump, easeOutCubic, lerp, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

const LOOP_SECONDS = 4.5;
const DASHES = 5;
const BAR_WIDTHS = [1.55, 1.28, 1.62, 1.02, 1.46, 1.24, 0.7];
const BARS = BAR_WIDTHS.length;
/** Imprint center on the document, doc-local (lower right of the page). */
const IMPRINT_X = 0.48;
const IMPRINT_Y = -0.82;

// module-scope temps — useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();
const tmpMid = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const UNIT_Y = new THREE.Vector3(0, 1, 0);

interface AdditionPair {
  P: THREE.Vector3;
  Q: THREE.Vector3;
  /** P + Q — the reflected point, on the lower branch for these pairs. */
  R: THREE.Vector3;
  /** Third intersection of the chord with the curve (mirror of R). */
  Rp: THREE.Vector3;
  /** Chord extremes; growth starts at e0 (always P or Q, never Rp). */
  e0: THREE.Vector3;
  e1: THREE.Vector3;
  /** Fraction along e0→e1 where the chord passes through Rp. */
  tR: number;
  dropLen: number;
}

export default function SignatureChapter() {
  const low = journey.quality === "low";
  const TUBULAR = low ? 120 : 240;
  const RADIAL = low ? 6 : 8;
  const TICKS = low ? 32 : 64;
  const BOX_COUNT = BARS + TICKS + 2; // text bars + signature ticks + ✓

  const palette = usePalette();
  const group = useRef<THREE.Group>(null!);
  const tubeMesh = useRef<THREE.Mesh>(null!);
  const tubeMat = useRef<THREE.MeshStandardMaterial>(null!);
  const dots = useRef<THREE.InstancedMesh>(null!);
  const dotsMat = useRef<THREE.MeshStandardMaterial>(null!);
  const rods = useRef<THREE.InstancedMesh>(null!);
  const rodsMat = useRef<THREE.MeshStandardMaterial>(null!);
  const docGroup = useRef<THREE.Group>(null!);
  const pageMat = useRef<THREE.MeshStandardMaterial>(null!);
  const boxes = useRef<THREE.InstancedMesh>(null!);
  const boxesMat = useRef<THREE.MeshStandardMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const stamp = useRef<THREE.Mesh>(null!);
  const stampMat = useRef<THREE.MeshStandardMaterial>(null!);

  /** Real 64-byte r||s signature — drives the imprint's tick lengths. */
  const [sig, setSig] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const keys = await generateKeyPair();
      const hex = await sign(
        keys.privateKey,
        utf8("proof without disclosure — chapter 4"),
      );
      if (alive) setSig(hexToBytes(hex));
    })().catch(() => {
      /* scene degrades gracefully: imprint ring without ticks */
    });
    return () => {
      alive = false;
    };
  }, []);

  const scene = useMemo(() => {
    const f = (x: number) => x * x * x - 3 * x + 3;

    // the curve's single real root (≈ −2.1038), found by bisection
    let lo = -3;
    let hi = -2;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    const root = (lo + hi) / 2;
    const X_MAX = 2.6;
    // scale so the curve stands ~5.2 world units tall, centered near x = +0.6
    const s = 5.2 / (2 * Math.sqrt(f(X_MAX)));
    const xMid = (root + X_MAX) / 2;
    const wx = (x: number) => (x - xMid) * s + 0.6;
    const wy = (y: number) => y * s;

    // polyline: lower branch reversed + nose + upper branch, sampled with
    // t² spacing so the vertical-tangent nose at the root stays smooth
    const M = 80;
    const sx = (i: number) => root + (X_MAX - root) * (i / M) * (i / M);
    const pts: THREE.Vector3[] = [];
    for (let i = M; i >= 1; i--) {
      const x = sx(i);
      pts.push(new THREE.Vector3(wx(x), wy(-Math.sqrt(Math.max(f(x), 0))), 0));
    }
    pts.push(new THREE.Vector3(wx(root), 0, 0));
    for (let i = 1; i <= M; i++) {
      const x = sx(i);
      pts.push(new THREE.Vector3(wx(x), wy(Math.sqrt(Math.max(f(x), 0))), 0));
    }
    const path = new THREE.CatmullRomCurve3(pts);

    // exact group law: λ = (yQ−yP)/(xQ−xP), x₃ = λ²−xP−xQ, y₃ = λ(xP−x₃)−yP
    const mk = (xP: number, xQ: number): AdditionPair => {
      const yP = Math.sqrt(f(xP));
      const yQ = Math.sqrt(f(xQ));
      const lam = (yQ - yP) / (xQ - xP);
      const x3 = lam * lam - xP - xQ;
      const y3 = lam * (xP - x3) - yP;
      const P = new THREE.Vector3(wx(xP), wy(yP), 0);
      const Q = new THREE.Vector3(wx(xQ), wy(yQ), 0);
      const R = new THREE.Vector3(wx(x3), wy(y3), 0);
      const Rp = new THREE.Vector3(wx(x3), wy(-y3), 0);
      // chord spans the outermost of {P, Q, Rp}; grow from a P/Q extreme
      const byX = [P, Q, Rp].sort((a, b) => a.x - b.x);
      let e0 = byX[0];
      let e1 = byX[2];
      if (e0 === Rp) {
        e0 = byX[2];
        e1 = byX[0];
      }
      const tR = (Rp.x - e0.x) / (e1.x - e0.x);
      return { P, Q, R, Rp, e0, e1, tR, dropLen: Rp.y - R.y };
    };
    const pairs = [mk(-1.2, 0.4), mk(-1.9, 1.3), mk(-0.4, 1.8)];
    return { path, pairs };
  }, []);

  useFrame((state) => {
    const { local, on } = chapterFrame("signature");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const enter = smoothstep(phase(local, 0.02, 0.12));
    const exit = 1 - smoothstep(phase(local, 0.86, 0.96));
    const fade = enter * exit;

    // group choreography: rise in, gentle ambient float, sink away on exit
    group.current.position.set(
      0,
      -0.7 * (1 - smoothstep(phase(local, 0.02, 0.14))) -
        3.2 * smoothstep(phase(local, 0.85, 1)) +
        Math.sin(t * 0.5) * 0.05,
      0,
    );

    // (a) the curve draws itself on
    const drawT = easeOutCubic(phase(local, 0.03, 0.16));
    const fullIndexCount = TUBULAR * RADIAL * 6;
    tubeMesh.current.geometry.setDrawRange(
      0,
      Math.floor((fullIndexCount * drawT) / 3) * 3,
    );
    tubeMat.current.color.copy(palette.inkSoft);
    tubeMat.current.opacity = fade;

    // (b) the chord-and-tangent loop — a pure function of elapsed time
    const cycle = Math.floor(t / LOOP_SECONDS);
    const u = t / LOOP_SECONDS - cycle;
    const pair = scene.pairs[cycle % scene.pairs.length];
    const pqIn = smoothstep(phase(local, 0.14, 0.2));
    const act =
      smoothstep(phase(local, 0.16, 0.22)) *
      (1 - smoothstep(phase(local, 0.55, 0.65)));
    const endFade = 1 - smoothstep(phase(u, 0.9, 0.985)); // loop reset

    const d = dots.current;
    // P and Q, on the curve
    tmpObject.quaternion.set(0, 0, 0, 1);
    tmpObject.position.copy(pair.P);
    tmpObject.scale.setScalar(
      Math.max(pqIn * (1 + 0.05 * Math.sin(t * 2.1)), 1e-4),
    );
    tmpObject.updateMatrix();
    d.setMatrixAt(0, tmpObject.matrix);
    d.setColorAt(0, tmpColor.copy(palette.accent));
    tmpObject.position.copy(pair.Q);
    tmpObject.scale.setScalar(
      Math.max(pqIn * (1 + 0.05 * Math.sin(t * 2.1 + 1.7)), 1e-4),
    );
    tmpObject.updateMatrix();
    d.setMatrixAt(1, tmpObject.matrix);
    d.setColorAt(1, tmpColor.copy(palette.accent));
    // R = P + Q lands after the drop, then pulses
    const rIn =
      smoothstep(phase(u, 0.55, 0.62)) * (1 + 0.6 * bump(phase(u, 0.6, 0.78)));
    tmpObject.position.copy(pair.R);
    tmpObject.scale.setScalar(Math.max(rIn * act * endFade, 1e-4));
    tmpObject.updateMatrix();
    d.setMatrixAt(2, tmpObject.matrix);
    d.setColorAt(2, tmpColor.copy(palette.good));
    // spark where the chord strikes the third point Rp
    const sparkAt = 0.06 + pair.tR * 0.3;
    const spark = bump(phase(u, sparkAt - 0.03, sparkAt + 0.09));
    tmpObject.position.copy(pair.Rp);
    tmpObject.scale.setScalar(Math.max(spark * 2.2 * act * endFade, 1e-4));
    tmpObject.updateMatrix();
    d.setMatrixAt(3, tmpObject.matrix);
    d.setColorAt(3, tmpColor.copy(palette.warn));
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    dotsMat.current.opacity = fade;

    // chord (rod 0) grows across the curve; dashes (rods 1..) drop Rp → R
    const rd = rods.current;
    tmpColor.copy(palette.warn);
    const grow = smoothstep(phase(u, 0.06, 0.36));
    tmpVec.lerpVectors(pair.e0, pair.e1, grow); // growing tip
    tmpDir.subVectors(tmpVec, pair.e0);
    const chordLen = tmpDir.length();
    tmpMid.addVectors(pair.e0, tmpVec).multiplyScalar(0.5);
    tmpObject.position.copy(tmpMid);
    if (chordLen > 1e-4) {
      tmpDir.divideScalar(chordLen);
      tmpObject.quaternion.setFromUnitVectors(UNIT_Y, tmpDir);
    } else {
      tmpObject.quaternion.set(0, 0, 0, 1);
    }
    const chordR = 0.024 * act * endFade;
    tmpObject.scale.set(
      Math.max(chordR, 1e-4),
      Math.max(chordLen, 1e-4),
      Math.max(chordR, 1e-4),
    );
    tmpObject.updateMatrix();
    rd.setMatrixAt(0, tmpObject.matrix);
    rd.setColorAt(0, tmpColor);
    const dropT = smoothstep(phase(u, 0.42, 0.58));
    const dashLen = (pair.dropLen * 0.55) / DASHES;
    tmpObject.quaternion.set(0, 0, 0, 1);
    for (let i = 0; i < DASHES; i++) {
      const fi = (i + 0.5) / DASHES;
      const onT = smoothstep(phase(dropT, fi * 0.8, fi * 0.8 + 0.15));
      tmpVec.lerpVectors(pair.Rp, pair.R, fi);
      tmpObject.position.copy(tmpVec);
      const dashR = 0.017 * onT * act * endFade;
      tmpObject.scale.set(
        Math.max(dashR, 1e-4),
        Math.max(dashLen * onT, 1e-4),
        Math.max(dashR, 1e-4),
      );
      tmpObject.updateMatrix();
      rd.setMatrixAt(1 + i, tmpObject.matrix);
      rd.setColorAt(1 + i, tmpColor);
    }
    rd.instanceMatrix.needsUpdate = true;
    if (rd.instanceColor) rd.instanceColor.needsUpdate = true;
    rodsMat.current.opacity = fade * 0.95;

    // (c) the document slides in and settles
    const docFade = smoothstep(phase(local, 0.06, 0.18));
    docGroup.current.position.x = 4.3 + (1 - docFade) * 0.7;
    pageMat.current.color.copy(palette.bgRaised);
    pageMat.current.opacity = docFade * fade;
    boxesMat.current.opacity = docFade * fade;

    const bx = boxes.current;
    tmpObject.quaternion.set(0, 0, 0, 1);
    tmpColor.copy(palette.inkFaint);
    for (let i = 0; i < BARS; i++) {
      const w = BAR_WIDTHS[i];
      tmpObject.position.set(-0.85 + w / 2, 1.05 - i * 0.24, 0.015);
      tmpObject.scale.set(w, 0.085, 0.012);
      tmpObject.updateMatrix();
      bx.setMatrixAt(i, tmpObject.matrix);
      bx.setColorAt(i, tmpColor);
    }

    // (d) the stamp: seal descends, imprint stays for the rest of the chapter
    const descend = phase(local, 0.5, 0.585);
    const liftT = smoothstep(phase(local, 0.63, 0.72));
    stamp.current.position.set(
      IMPRINT_X,
      IMPRINT_Y,
      lerp(2.8, 0.26, descend * descend) + liftT * 1.6,
    );
    const impact = bump(phase(local, 0.575, 0.615));
    stamp.current.scale.set(
      1 + 0.12 * impact,
      1 - 0.18 * impact,
      1 + 0.12 * impact,
    );
    const stampOp = smoothstep(phase(local, 0.46, 0.5)) * (1 - liftT) * fade;
    stampMat.current.color.copy(palette.inkSoft);
    stampMat.current.opacity = stampOp;
    stamp.current.visible = stampOp > 0.002;

    const imprint = easeOutCubic(phase(local, 0.585, 0.65));
    ring.current.scale.setScalar(Math.max(imprint, 1e-4));
    ringMat.current.color.copy(palette.accent);
    ringMat.current.opacity =
      imprint * (0.75 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.4))) * fade;

    // 64 ticks around the seal — the real r||s bytes, one tick per byte
    tmpColor.copy(palette.accent);
    const stride = 64 / TICKS;
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * Math.PI * 2;
      const byte = sig ? sig[i * stride] : 0;
      const len = 0.05 + (byte / 255) * 0.13;
      const gate = sig
        ? smoothstep(
            phase(local, 0.585 + 0.08 * (i / TICKS), 0.625 + 0.08 * (i / TICKS)),
          )
        : 0;
      tmpObject.position.set(
        IMPRINT_X + Math.cos(a) * (0.38 + len / 2),
        IMPRINT_Y + Math.sin(a) * (0.38 + len / 2),
        0.02,
      );
      tmpObject.rotation.set(0, 0, a);
      tmpObject.scale.set(
        Math.max(len * gate, 1e-4),
        Math.max(0.045 * gate, 1e-4),
        0.012,
      );
      tmpObject.updateMatrix();
      bx.setMatrixAt(BARS + i, tmpObject.matrix);
      bx.setColorAt(BARS + i, tmpColor);
    }

    // the good tick: two strokes flash a ✓ over the fresh imprint
    const checkT = phase(local, 0.6, 0.72);
    const check =
      easeOutCubic(phase(checkT, 0, 0.35)) *
      (1 - smoothstep(phase(checkT, 0.6, 1)));
    tmpColor.copy(palette.good);
    tmpObject.position.set(IMPRINT_X - 0.11, IMPRINT_Y - 0.05, 0.16);
    tmpObject.rotation.set(0, 0, -0.78);
    tmpObject.scale.set(
      Math.max(0.2 * check, 1e-4),
      Math.max(0.05 * check, 1e-4),
      0.012,
    );
    tmpObject.updateMatrix();
    bx.setMatrixAt(BARS + TICKS, tmpObject.matrix);
    bx.setColorAt(BARS + TICKS, tmpColor);
    tmpObject.position.set(IMPRINT_X + 0.06, IMPRINT_Y + 0.01, 0.16);
    tmpObject.rotation.set(0, 0, 0.92);
    tmpObject.scale.set(
      Math.max(0.34 * check, 1e-4),
      Math.max(0.05 * check, 1e-4),
      0.012,
    );
    tmpObject.updateMatrix();
    bx.setMatrixAt(BARS + TICKS + 1, tmpObject.matrix);
    bx.setColorAt(BARS + TICKS + 1, tmpColor);
    bx.instanceMatrix.needsUpdate = true;
    if (bx.instanceColor) bx.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <mesh ref={tubeMesh} frustumCulled={false}>
        <tubeGeometry args={[scene.path, TUBULAR, 0.045, RADIAL, false]} />
        <meshStandardMaterial
          ref={tubeMat}
          roughness={0.5}
          metalness={0}
          transparent
        />
      </mesh>
      {/* P, Q (accent), R (good), spark at Rp (warn) */}
      <instancedMesh ref={dots} args={[undefined, undefined, 4]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 20, 14]} />
        <meshStandardMaterial
          ref={dotsMat}
          roughness={0.35}
          metalness={0}
          transparent
        />
      </instancedMesh>
      {/* chord + the dashed vertical drop, all one unit-cylinder mesh */}
      <instancedMesh
        ref={rods}
        args={[undefined, undefined, 1 + DASHES]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial
          ref={rodsMat}
          roughness={0.5}
          metalness={0}
          transparent
        />
      </instancedMesh>
      <group ref={docGroup} position={[4.3, -0.4, 0]} rotation={[0, -0.25, 0]}>
        <mesh>
          <planeGeometry args={[2.1, 2.8]} />
          <meshStandardMaterial
            ref={pageMat}
            roughness={0.85}
            metalness={0}
            transparent
          />
        </mesh>
        {/* text bars + signature-byte ticks + ✓ strokes, one unit-box mesh */}
        <instancedMesh
          ref={boxes}
          args={[undefined, undefined, BOX_COUNT]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            ref={boxesMat}
            roughness={0.6}
            metalness={0}
            transparent
          />
        </instancedMesh>
        <mesh ref={ring} position={[IMPRINT_X, IMPRINT_Y, 0.03]}>
          <torusGeometry args={[0.3, 0.035, 10, 40]} />
          <meshBasicMaterial ref={ringMat} transparent />
        </mesh>
        <mesh ref={stamp} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.5, 24]} />
          <meshStandardMaterial
            ref={stampMat}
            roughness={0.4}
            metalness={0.1}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}
