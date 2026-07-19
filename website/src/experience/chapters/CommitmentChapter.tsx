/** Chapter 2: commitments. Seal a secret now, open it later.
 *
 * The secret is a torus-knot glowing inside a glass sphere. To commit, the
 * shell frosts opaque and a stamp ring screws tight around its equator;
 * tick heights are the nibbles of a REAL commitment, SHA-256(salt:secret)
 * from crypto/commitments.ts. Published stamp, hidden secret: while sealed
 * the knot is genuinely invisible (hiding), and the engraved ring cannot be
 * re-cut to fit a different secret (binding). On reveal the shell clears and
 * verifyReveal() recomputes the hash; the knot and ticks flash green only
 * because the real check passed. Hide → bind → open → check.
 *
 * Follows the exemplar's discipline: chapterFrame() gate, everything a pure
 * function of (local, elapsed time), instancing, zero per-frame allocations.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { commit, verifyReveal } from "../../crypto/commitments";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { bump, lerp, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

const SECRET = "attack at dawn";
const RING_R = 2.15;
const RING_LOOSE_R = 3.0;

// module-scope temps: useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const tickBase = new THREE.Color();

interface Proof {
  hex: string; // the real commitment digest, engraved on the stamp ring
  ok: boolean; // real verifyReveal() result; gates the "verified" flash
}

export default function CommitmentChapter() {
  const low = journey.quality === "low";
  const tickCount = low ? 24 : 48;
  const dustCount = low ? 150 : 300;
  const palette = usePalette();

  const group = useRef<THREE.Group>(null!);
  const knot = useRef<THREE.Mesh>(null!);
  const knotMat = useRef<THREE.MeshBasicMaterial>(null!);
  const shell = useRef<THREE.Mesh>(null!);
  const shellMat = useRef<THREE.MeshStandardMaterial>(null!);
  const ringGroup = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ticks = useRef<THREE.InstancedMesh>(null!);
  const ticksMat = useRef<THREE.MeshBasicMaterial>(null!);
  const dust = useRef<THREE.InstancedMesh>(null!);
  const dustMat = useRef<THREE.MeshBasicMaterial>(null!);

  // one-time crypto: commit to the secret, then honestly verify the reveal
  const [proof, setProof] = useState<Proof | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const c = await commit(SECRET);
      const ok = await verifyReveal(c.commitment, c.secret, c.salt);
      if (alive) setProof({ hex: c.commitment, ok });
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Tick bar heights from the commitment's hex nibbles (uniform until the
   * digest arrives; the crypto resolves within a frame or two). */
  const tickAmp = useMemo(() => {
    const amps = new Float32Array(tickCount);
    for (let i = 0; i < tickCount; i++) {
      const nibble = proof
        ? parseInt(proof.hex.charAt(((i * proof.hex.length) / tickCount) | 0), 16)
        : 8;
      amps[i] = 0.55 + (nibble / 15) * 0.9;
    }
    return amps;
  }, [proof, tickCount]);

  const motes = useMemo(() => {
    const pos = new Float32Array(dustCount * 3);
    const seed = new Float32Array(dustCount);
    const speed = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.4 + Math.random() * 2.6;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.7;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.5; // stay in z ∈ [-3, 3]
      seed[i] = Math.random() * Math.PI * 2;
      speed[i] = 0.2 + Math.random() * 0.5;
    }
    return { pos, seed, speed };
  }, [dustCount]);

  useFrame((state) => {
    const { local, on } = chapterFrame("commit");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;

    // presence: empty at enter/exit, full only inside 0.14..0.80
    const appear = smoothstep(phase(local, 0.02, 0.14));
    const exit = smoothstep(phase(local, 0.8, 0.96));
    const fade = appear * (1 - exit);

    // beats: seal 0.15..0.40, hold 0.40..0.60, reveal + verify 0.60..0.80
    const tighten = phase(local, 0.15, 0.38);
    const sealT = smoothstep(phase(local, 0.18, 0.4));
    const open = smoothstep(phase(local, 0.6, 0.7));
    const sealed = sealT * (1 - open);
    const sealingActive = bump(phase(local, 0.15, 0.42));
    const verifyFlash = bump(phase(local, 0.66, 0.84)) * (proof?.ok ? 1 : 0);

    // group: focal right of the caption card, bob gently, sink on exit
    group.current.position.set(2.2, Math.sin(t * 0.4) * 0.08 - exit * 4.2, -exit * 2);
    group.current.scale.setScalar(Math.max(appear * (1 - 0.25 * exit), 1e-4));

    // the secret: tumbling, truly invisible while sealed (hiding), flashing
    // good when the real check passes
    knot.current.rotation.set(t * 0.31, t * 0.23, t * 0.11);
    knotMat.current.color.copy(palette.accent).lerp(palette.good, verifyFlash);
    knotMat.current.opacity = fade * (1 - sealed);

    // the shell: glassy → frosted, with a heartbeat while it holds the seal
    shell.current.scale.setScalar(1 + Math.sin(t * 3.6) * 0.015 * sealed);
    shellMat.current.color.copy(palette.bgRaised).lerp(palette.bgInset, sealed);
    shellMat.current.opacity = lerp(0.16, 0.97, sealed) * fade;

    // the stamp ring: loose while glassy, screwed tight once committed
    ringGroup.current.rotation.x = 1.08 + Math.sin(t * 0.17) * 0.05;
    ring.current.scale.setScalar(
      lerp(RING_LOOSE_R, RING_R, smoothstep(tighten)) / RING_R,
    );
    tickBase
      .copy(palette.line)
      .lerp(palette.accent, sealingActive)
      .lerp(palette.good, verifyFlash);
    ringMat.current.color.copy(tickBase);
    ringMat.current.opacity = fade * (0.35 + 0.55 * smoothstep(tighten));

    // ticks: the commitment hex, sweeping inward one nibble after another
    const spin = t * 0.12 + smoothstep(tighten) * 1.3;
    const m = ticks.current;
    for (let i = 0; i < tickCount; i++) {
      const k = i / tickCount;
      const a = k * Math.PI * 2 + spin;
      const tri = smoothstep(phase(tighten, k * 0.4, k * 0.4 + 0.6));
      const r = lerp(RING_LOOSE_R, RING_R, tri);
      tmpObject.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      tmpObject.rotation.set(0, 0, a - Math.PI / 2);
      tmpObject.scale.set(1, tickAmp[i], 1);
      tmpObject.updateMatrix();
      m.setMatrixAt(i, tmpObject.matrix);
      m.setColorAt(i, tmpColor.copy(tickBase).lerp(palette.accent, bump(tri) * 0.7));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    ticksMat.current.opacity = fade;

    // dust: slow drift around the sphere for depth
    tmpObject.rotation.set(0, 0, 0);
    tmpObject.scale.setScalar(1);
    const d = dust.current;
    for (let i = 0; i < dustCount; i++) {
      const w = t * motes.speed[i] + motes.seed[i];
      tmpObject.position.set(
        motes.pos[i * 3] + Math.sin(w) * 0.3,
        motes.pos[i * 3 + 1] + Math.sin(w * 0.7 + motes.seed[i]) * 0.45,
        motes.pos[i * 3 + 2] + Math.cos(w * 0.5) * 0.3,
      );
      tmpObject.updateMatrix();
      d.setMatrixAt(i, tmpObject.matrix);
    }
    d.instanceMatrix.needsUpdate = true;
    dustMat.current.color.copy(palette.inkFaint);
    dustMat.current.opacity = fade * 0.5;
  });

  return (
    <group ref={group}>
      <instancedMesh
        ref={dust}
        args={[undefined, undefined, dustCount]}
        frustumCulled={false}
        renderOrder={0}
      >
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshBasicMaterial ref={dustMat} transparent depthWrite={false} />
      </instancedMesh>
      <mesh ref={knot} renderOrder={1}>
        <torusKnotGeometry args={low ? [0.62, 0.2, 64, 10] : [0.62, 0.2, 128, 16]} />
        <meshBasicMaterial ref={knotMat} transparent depthWrite={false} />
      </mesh>
      <mesh ref={shell} renderOrder={2}>
        <sphereGeometry args={low ? [1.8, 32, 20] : [1.8, 48, 32]} />
        <meshStandardMaterial
          ref={shellMat}
          transparent
          roughness={0.35}
          metalness={0}
          depthWrite={false}
        />
      </mesh>
      <group ref={ringGroup}>
        <mesh ref={ring} renderOrder={3}>
          <torusGeometry args={low ? [RING_R, 0.018, 6, 64] : [RING_R, 0.018, 8, 128]} />
          <meshBasicMaterial ref={ringMat} transparent depthWrite={false} />
        </mesh>
        <instancedMesh
          ref={ticks}
          args={[undefined, undefined, tickCount]}
          frustumCulled={false}
          renderOrder={4}
        >
          <boxGeometry args={[0.05, 0.26, 0.05]} />
          <meshBasicMaterial ref={ticksMat} transparent />
        </instancedMesh>
      </group>
    </group>
  );
}
