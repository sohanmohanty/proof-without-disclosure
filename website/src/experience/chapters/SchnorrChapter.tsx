/** Chapter 6 — the Schnorr protocol, and the moment the verifier vanishes.
 *
 * An eleven-hour clock: the subgroup of quadratic residues mod 23 generated
 * by g = 4, each element pinned at angle value/23 around the ring. Placing
 * by VALUE scatters consecutive powers of g all over the dial — raising to
 * an exponent looks like jumping, which is the point. The faint chord
 * spiral threading the markers in exponent order is the path only the
 * prover can walk.
 *
 * The loop replays a real transcript (x = 7, nonce r = 5 → y = 8, R = 12,
 * with c and s straight from the Fiat–Shamir hash in crypto/schnorr):
 * commit, challenge, respond — then two tracers race the ring to g^s and
 * to R·y^c and land on the SAME marker. That collision is the whole
 * verification equation. In the finale the verifier orb dissolves and a
 * small dark slab — the hash compressor from chapter 1 — takes its place:
 * the dialogue became a hash, and the loop keeps running without anyone
 * on the other end.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  fiatShamirChallenge,
  keygen,
  modPow,
  prove,
  TOY_GROUP,
} from "../../crypto/schnorr";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import {
  bump,
  easeInOutCubic,
  lerp,
  phase,
  smoothstep,
} from "../shared/easing";
import { usePalette } from "../shared/palette";

const RADIUS = 2.9;
const PERIOD = 7; // seconds per protocol round
const TAU = Math.PI * 2;
const P = Number(TOY_GROUP.p); // 23
const ORDER = Number(TOY_GROUP.q); // 11 — subgroup size

// fixed toy transcript: x = 7, r = 5  →  y = g^x = 8, R = g^r = 12
const SECRET_X = 7n;
const NONCE = 5n;
const PUB_Y = 8n;
const COMMIT_R = 12n;
const MESSAGE = "hello";

const PROVER = { x: -2.8, y: -2.5, z: 0.45 };
const VERIFIER = { x: 2.6, y: 2.6, z: 0.45 };

const angleOf = (v: number): number => (v / P) * TAU;

// module-scope temps — useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();

interface Transcript {
  c: number;
  s: number;
}

export default function SchnorrChapter() {
  const palette = usePalette();
  const low = journey.quality === "low";
  const group = useRef<THREE.Group>(null!);
  const markers = useRef<THREE.InstancedMesh>(null!);
  const markerMat = useRef<THREE.MeshStandardMaterial>(null!);
  const chords = useRef<THREE.InstancedMesh>(null!);
  const chordMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ringMat = useRef<THREE.LineBasicMaterial>(null!);
  const tracers = useRef<THREE.InstancedMesh>(null!);
  const tracerMat = useRef<THREE.MeshBasicMaterial>(null!);
  const prover = useRef<THREE.Mesh>(null!);
  const proverMat = useRef<THREE.MeshStandardMaterial>(null!);
  const verifier = useRef<THREE.Mesh>(null!);
  const verifierMat = useRef<THREE.MeshStandardMaterial>(null!);
  const cube = useRef<THREE.Mesh>(null!);
  const cubeMat = useRef<THREE.MeshBasicMaterial>(null!);
  const slab = useRef<THREE.Mesh>(null!);
  const slabMat = useRef<THREE.MeshStandardMaterial>(null!);

  // real crypto, computed once — the ring renders immediately, protocol
  // beats start when c and s arrive
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const proof = await prove(keygen(TOY_GROUP, SECRET_X), MESSAGE, NONCE);
      const c = await fiatShamirChallenge(TOY_GROUP, PUB_Y, COMMIT_R, MESSAGE);
      if (!cancelled) setTranscript({ c: Number(c), s: Number(proof.s) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ring = useMemo(() => {
    // markers in EXPONENT order: values[i] = g^i mod p
    const values = new Array<number>(ORDER);
    for (let i = 0; i < ORDER; i++) {
      values[i] = Number(modPow(TOY_GROUP.g, BigInt(i), TOY_GROUP.p));
    }
    const mx = new Float32Array(ORDER);
    const my = new Float32Array(ORDER);
    for (let i = 0; i < ORDER; i++) {
      const a = angleOf(values[i]);
      mx[i] = Math.cos(a) * RADIUS;
      my[i] = Math.sin(a) * RADIUS;
    }
    // chord i connects marker i → i+1 (mod ORDER); grows from its start
    const sx = new Float32Array(ORDER);
    const sy = new Float32Array(ORDER);
    const nx = new Float32Array(ORDER);
    const ny = new Float32Array(ORDER);
    const len = new Float32Array(ORDER);
    const rot = new Float32Array(ORDER);
    for (let i = 0; i < ORDER; i++) {
      const j = (i + 1) % ORDER;
      const ex = mx[j] - mx[i];
      const ey = my[j] - my[i];
      const l = Math.hypot(ex, ey);
      sx[i] = mx[i];
      sy[i] = my[i];
      nx[i] = ex / l;
      ny[i] = ey / l;
      len[i] = l;
      rot[i] = Math.atan2(ey, ex);
    }
    return {
      values,
      mx,
      my,
      sx,
      sy,
      nx,
      ny,
      len,
      rot,
      idxY: values.indexOf(Number(PUB_Y)),
      idxR: values.indexOf(Number(COMMIT_R)),
    };
  }, []);

  // faint dial behind the markers (vertex count halved on low quality —
  // marker/chord counts are data, fixed at 11 by the group order)
  const dial = useMemo(() => {
    const n = low ? 64 : 128;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      positions[i * 3] = Math.cos(a) * RADIUS;
      positions[i * 3 + 1] = Math.sin(a) * RADIUS;
      positions[i * 3 + 2] = -0.12;
    }
    return positions;
  }, [low]);

  // verification sweep geometry: g^s from the identity going CCW, R·y^c
  // from R going CW — both arcs end on the same marker (g^s = R·y^c)
  const sweep = useMemo(() => {
    if (!transcript) return null;
    const left = Number(modPow(TOY_GROUP.g, BigInt(transcript.s), TOY_GROUP.p));
    const right = Number(
      (COMMIT_R * modPow(PUB_Y, BigInt(transcript.c), TOY_GROUP.p)) %
        TOY_GROUP.p,
    );
    const start1 = angleOf(1);
    const start2 = angleOf(Number(COMMIT_R));
    let d1 = (((angleOf(left) - start1) % TAU) + TAU) % TAU;
    if (d1 < 0.8) d1 += TAU; // always a visible sweep, never a hop
    let d2 = (((start2 - angleOf(right)) % TAU) + TAU) % TAU;
    if (d2 < 0.8) d2 += TAU;
    return { start1, d1, start2, d2, idxTarget: ring.values.indexOf(left) };
  }, [transcript, ring]);

  useFrame((state) => {
    const { local, on } = chapterFrame("schnorr");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const exitFade = 1 - smoothstep(phase(local, 0.88, 0.955));
    const contract = 1 - 0.92 * smoothstep(phase(local, 0.88, 0.99));
    group.current.scale.setScalar(
      (0.9 + 0.1 * smoothstep(phase(local, 0, 0.12))) * contract,
    );

    const appear = smoothstep(phase(local, 0.09, 0.16));
    // protocol beats need the real c/s; the loop keeps running through the
    // finale — after Fiat–Shamir the challenge just comes from the slab
    const gate =
      (transcript ? 1 : 0) * smoothstep(phase(local, 0.15, 0.2)) * exitFade;

    const lp = (t % PERIOD) / PERIOD;
    const pulseR = bump(phase(lp, 0, 0.24)) * gate; // A: R announces itself
    const flash = bump(phase(lp, 0.88, 1)) * gate; // D: equation holds

    // --- ring markers ----------------------------------------------------
    const m = markers.current;
    for (let i = 0; i < ORDER; i++) {
      const popStart = 0.012 + i * 0.0095; // pop in exponent order
      const pop = smoothstep(phase(local, popStart, popStart + 0.045));
      let sc = pop * (1 + 0.4 * bump(pop));
      if (i === ring.idxY) sc *= 1.22; // the public key stands out
      if (i === ring.idxR) sc *= 1 + 0.55 * pulseR;
      if (sweep && i === sweep.idxTarget) sc *= 1 + 0.45 * flash;
      tmpObject.position.set(
        ring.mx[i],
        ring.my[i],
        Math.sin(t * 0.7 + i * 1.7) * 0.06,
      );
      tmpObject.rotation.set(0, 0, 0);
      tmpObject.scale.setScalar(Math.max(sc, 1e-4));
      tmpObject.updateMatrix();
      m.setMatrixAt(i, tmpObject.matrix);
      tmpColor.copy(i === ring.idxY ? palette.accent : palette.inkSoft);
      if (i === ring.idxR) tmpColor.lerp(palette.accent, pulseR);
      tmpColor.lerp(palette.good, 0.85 * flash);
      m.setColorAt(i, tmpColor);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    markerMat.current.opacity = exitFade;

    // --- the hidden path: chords in exponent order -----------------------
    const ch = chords.current;
    for (let i = 0; i < ORDER; i++) {
      const growStart = 0.03 + i * 0.0095;
      const gl =
        ring.len[i] * smoothstep(phase(local, growStart, growStart + 0.05));
      tmpObject.position.set(
        ring.sx[i] + ring.nx[i] * gl * 0.5,
        ring.sy[i] + ring.ny[i] * gl * 0.5,
        -0.08,
      );
      tmpObject.rotation.set(0, 0, ring.rot[i]);
      tmpObject.scale.set(Math.max(gl, 1e-4), 1, 1);
      tmpObject.updateMatrix();
      ch.setMatrixAt(i, tmpObject.matrix);
    }
    ch.instanceMatrix.needsUpdate = true;

    // finale: the spiral pulses accent → good, once
    const fin = phase(local, 0.72, 0.88);
    const pAcc = bump(phase(fin, 0.05, 0.55));
    const pGood = bump(phase(fin, 0.35, 0.95));
    tmpColor
      .copy(palette.line)
      .lerp(palette.accent, pAcc)
      .lerp(palette.good, pGood);
    chordMat.current.color.copy(tmpColor);
    chordMat.current.opacity =
      (0.32 + 0.45 * Math.max(pAcc, pGood)) * exitFade;

    ringMat.current.color.copy(palette.inkFaint);
    ringMat.current.opacity =
      0.5 * smoothstep(phase(local, 0.02, 0.12)) * exitFade;

    // --- actors -----------------------------------------------------------
    prover.current.position.set(
      PROVER.x,
      PROVER.y + Math.sin(t * 1.1) * 0.06,
      PROVER.z,
    );
    prover.current.scale.setScalar(
      Math.max(appear * (1 + Math.sin(t * 1.6) * 0.04), 1e-4),
    );
    proverMat.current.color.copy(palette.accent);
    proverMat.current.opacity = exitFade;

    // verifier dissolves during the finale — a shiver, then gone
    const dissolve = smoothstep(phase(local, 0.72, 0.8));
    const shake = bump(phase(local, 0.72, 0.8)) * 0.07;
    const hoverY = VERIFIER.y + Math.sin(t * 0.9) * 0.07;
    verifier.current.position.set(
      VERIFIER.x + Math.sin(t * 47) * shake,
      hoverY + Math.cos(t * 39) * shake,
      VERIFIER.z,
    );
    verifier.current.scale.setScalar(Math.max(appear * (1 - dissolve), 1e-4));
    verifierMat.current.color.copy(palette.inkSoft);
    verifierMat.current.opacity = exitFade;

    // the hash slab fades in exactly where the verifier hovered
    const slabIn = smoothstep(phase(local, 0.76, 0.86));
    slab.current.visible = slabIn > 0.001;
    slab.current.position.set(VERIFIER.x, hoverY, VERIFIER.z);
    slab.current.rotation.y = 0.45 + Math.sin(t * 0.45) * 0.07;
    slab.current.scale.setScalar(0.7 + 0.3 * slabIn);
    slabMat.current.color.copy(palette.bgInset);
    slabMat.current.opacity = slabIn * exitFade;

    // --- protocol messages -------------------------------------------------
    // B: the challenge — a warn cube, verifier → prover
    const pB = phase(lp, 0.22, 0.39);
    const eB = easeInOutCubic(pB);
    cube.current.position.set(
      lerp(VERIFIER.x, PROVER.x, eB),
      lerp(hoverY, PROVER.y, eB),
      lerp(VERIFIER.z, PROVER.z, eB) + Math.sin(Math.PI * pB) * 0.5,
    );
    cube.current.rotation.set(t * 4.2, t * 3.4, 0);
    cube.current.scale.setScalar(
      Math.max(Math.sin(Math.PI * pB) * gate, 1e-4),
    );
    cubeMat.current.color.copy(palette.warn);
    cubeMat.current.opacity = exitFade;

    const tr = tracers.current;
    tmpObject.rotation.set(0, 0, 0);

    // A: commit — prover sends R to the ring
    const pA = phase(lp, 0.02, 0.19);
    const eA = easeInOutCubic(pA);
    tmpObject.position.set(
      lerp(PROVER.x, ring.mx[ring.idxR], eA),
      lerp(PROVER.y, ring.my[ring.idxR], eA),
      lerp(PROVER.z, 0.2, eA) + Math.sin(Math.PI * pA) * 0.55,
    );
    tmpObject.scale.setScalar(Math.max(Math.sin(Math.PI * pA) * gate, 1e-4));
    tmpObject.updateMatrix();
    tr.setMatrixAt(0, tmpObject.matrix);
    tr.setColorAt(0, tmpColor.copy(palette.accent));

    // C: respond — s travels prover → verifier
    const pC = phase(lp, 0.42, 0.59);
    const eC = easeInOutCubic(pC);
    tmpObject.position.set(
      lerp(PROVER.x, VERIFIER.x, eC),
      lerp(PROVER.y, hoverY, eC),
      lerp(PROVER.z, VERIFIER.z, eC) + Math.sin(Math.PI * pC) * 0.55,
    );
    tmpObject.scale.setScalar(Math.max(Math.sin(Math.PI * pC) * gate, 1e-4));
    tmpObject.updateMatrix();
    tr.setMatrixAt(1, tmpObject.matrix);
    tr.setColorAt(1, tmpColor.copy(palette.accent));

    // D: verify — g^s and R·y^c sweep the dial and collide on one marker
    const pD = easeInOutCubic(phase(lp, 0.62, 0.88));
    const presence =
      smoothstep(phase(lp, 0.62, 0.67)) *
      (1 - smoothstep(phase(lp, 0.93, 0.985))) *
      gate;
    const th1 = sweep ? sweep.start1 + sweep.d1 * pD : 0;
    tmpObject.position.set(
      Math.cos(th1) * RADIUS,
      Math.sin(th1) * RADIUS,
      0.22,
    );
    tmpObject.scale.setScalar(Math.max(presence * (1 + 0.5 * flash), 1e-4));
    tmpObject.updateMatrix();
    tr.setMatrixAt(2, tmpObject.matrix);
    tr.setColorAt(2, tmpColor.copy(palette.accent).lerp(palette.good, flash));

    const th2 = sweep ? sweep.start2 - sweep.d2 * pD : 0;
    tmpObject.position.set(
      Math.cos(th2) * RADIUS,
      Math.sin(th2) * RADIUS,
      0.22,
    );
    tmpObject.updateMatrix();
    tr.setMatrixAt(3, tmpObject.matrix);
    tr.setColorAt(3, tmpColor.copy(palette.warn).lerp(palette.good, flash));

    tr.instanceMatrix.needsUpdate = true;
    if (tr.instanceColor) tr.instanceColor.needsUpdate = true;
    tracerMat.current.opacity = exitFade;
  });

  return (
    <group ref={group} position={[2.2, 0, 0]}>
      <lineLoop frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dial, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={ringMat} transparent depthWrite={false} />
      </lineLoop>
      <instancedMesh
        ref={chords}
        args={[undefined, undefined, ORDER]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 0.03, 0.03]} />
        <meshBasicMaterial ref={chordMat} transparent depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={markers}
        args={[undefined, undefined, ORDER]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.17, low ? 12 : 20, low ? 8 : 14]} />
        <meshStandardMaterial
          ref={markerMat}
          roughness={0.5}
          metalness={0}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        ref={tracers}
        args={[undefined, undefined, 4]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.09, low ? 8 : 12, low ? 6 : 10]} />
        <meshBasicMaterial ref={tracerMat} transparent />
      </instancedMesh>
      <mesh ref={prover}>
        <sphereGeometry args={[0.22, low ? 12 : 24, low ? 8 : 16]} />
        <meshStandardMaterial
          ref={proverMat}
          roughness={0.4}
          metalness={0}
          transparent
        />
      </mesh>
      <mesh ref={verifier}>
        <sphereGeometry args={[0.22, low ? 12 : 24, low ? 8 : 16]} />
        <meshStandardMaterial
          ref={verifierMat}
          roughness={0.4}
          metalness={0}
          transparent
        />
      </mesh>
      <mesh ref={cube}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshBasicMaterial ref={cubeMat} transparent />
      </mesh>
      <mesh ref={slab} visible={false}>
        <boxGeometry args={[0.5, 1.1, 0.3]} />
        <meshStandardMaterial
          ref={slabMat}
          roughness={0.35}
          metalness={0.1}
          transparent
        />
      </mesh>
    </group>
  );
}
