/** Chapter 1: hash functions.
 *
 * Any input in, exactly 256 bits out. A stream of bytes pours in from
 * off-screen along an S-curve and is swallowed by a compressor slab; to its
 * right stands a 16×16 lattice, one tile per digest bit. The two digests
 * it alternates between are real: SHA-256("hello") and SHA-256("hellp").
 * One flipped letter, and every ~3.5 s a wave sweeps the lattice left to
 * right as roughly half the bits flip: the avalanche effect, on a
 * metronome.
 *
 * Same discipline as HeroField, the exemplar: chapterFrame() gate at the
 * top of useFrame, all choreography a pure function of (local, elapsed) so
 * the scene survives being mounted mid-chapter, instanced meshes,
 * module-scope temps, zero per-frame allocations, palette colors copied
 * every frame so theme flips propagate mid-animation.
 */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sha256Hex } from "../../crypto/hash";
import { bitsFromHex } from "../field";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import {
  bump,
  clamp01,
  easeOutCubic,
  lerp,
  phase,
  smoothstep,
} from "../shared/easing";
import { usePalette } from "../shared/palette";

const SAMPLE_COUNT = 256; // curve samples for the input stream
const STREAM_SPEED = 0.125; // full curve trips per second
const EPOCH_SECONDS = 3.5; // how often the digest target alternates
const FLIP_SECONDS = 0.28;
const COL_WAVE = 0.05; // ripple: seconds per lattice column
const PULSE_SECONDS = 0.5;
const COLS = 16;
const ROWS = 16;
const TILE_COUNT = COLS * ROWS;
const TILE_SPACING = 0.26;
const LATTICE_X = 0.8;
const SLAB_X = -3.2;

// module-scope temps: useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const streamCold = new THREE.Color();
const streamWarm = new THREE.Color();
const swallowColor = new THREE.Color();
const offColor = new THREE.Color();
const onColor = new THREE.Color();

export default function HashChapter() {
  const streamCount = journey.quality === "low" ? 90 : 180;
  const palette = usePalette();
  const group = useRef<THREE.Group>(null!);
  const slab = useRef<THREE.Group>(null!);
  const slabMaterial = useRef<THREE.MeshStandardMaterial>(null!);
  const edgeMaterial = useRef<THREE.LineBasicMaterial>(null!);
  const stream = useRef<THREE.InstancedMesh>(null!);
  const streamMaterial = useRef<THREE.MeshStandardMaterial>(null!);
  const lattice = useRef<THREE.InstancedMesh>(null!);
  const latticeMaterial = useRef<THREE.MeshStandardMaterial>(null!);
  const pulse = useRef<THREE.Mesh>(null!);
  const pulseMaterial = useRef<THREE.MeshBasicMaterial>(null!);

  /** Real digest bits, one hex pair; null until Web Crypto answers, so the
   * lattice sits unflipped (all zeros) until then. */
  const [bits, setBits] = useState<{ a: Uint8Array; b: Uint8Array } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    void Promise.all([sha256Hex("hello"), sha256Hex("hellp")]).then(
      ([hello, hellp]) => {
        if (alive) setBits({ a: bitsFromHex(hello), b: bitsFromHex(hellp) });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const streamData = useMemo(() => {
    // gentle S-curve: off-screen upper-left, hooking down into the slab
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.4, 4.7, -0.5),
      new THREE.Vector3(-6.6, 3.9, 0.5),
      new THREE.Vector3(-5.7, 2.5, -0.4),
      new THREE.Vector3(-3.7, 1.9, 0.4),
      new THREE.Vector3(-4.5, 0.9, -0.2),
      new THREE.Vector3(SLAB_X, 0.15, 0),
    ]);
    const samples = new Float32Array(SAMPLE_COUNT * 3);
    const p = new THREE.Vector3();
    for (let s = 0; s < SAMPLE_COUNT; s++) {
      curve.getPoint(s / (SAMPLE_COUNT - 1), p);
      samples[s * 3] = p.x;
      samples[s * 3 + 1] = p.y;
      samples[s * 3 + 2] = p.z;
    }
    return {
      samples,
      jitter: Float32Array.from(
        { length: streamCount * 3 },
        () => (Math.random() - 0.5) * 0.34,
      ),
      /** per-particle inkFaint → inkSoft blend */
      mix: Float32Array.from({ length: streamCount }, () => Math.random()),
      size: Float32Array.from(
        { length: streamCount },
        () => 0.7 + Math.random() * 0.6,
      ),
      wobble: Float32Array.from(
        { length: streamCount },
        () => Math.random() * Math.PI * 2,
      ),
    };
  }, [streamCount]);

  /** ambient z-bob phase per lattice tile */
  const bob = useMemo(
    () =>
      Float32Array.from(
        { length: TILE_COUNT },
        () => Math.random() * Math.PI * 2,
      ),
    [],
  );

  const slabEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(1.42, 3.52, 1.02);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, []);
  useEffect(() => () => slabEdges.dispose(), [slabEdges]);

  useFrame((state) => {
    const { local, on } = chapterFrame("hash");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;

    // beats: slab + stream materialize over 0.05..0.2, lattice just behind
    // (nothing may be visible at local <= 0.05, the mount margin);
    // 0.85..0.96 everything sinks y −3 and fades to nothing
    const enterSlab = easeOutCubic(phase(local, 0.05, 0.18));
    const enterStream = smoothstep(phase(local, 0.07, 0.21));
    const enterLattice = smoothstep(phase(local, 0.09, 0.23));
    const exit = smoothstep(phase(local, 0.85, 0.96));
    const fade = 1 - exit;
    group.current.position.y = -3 * exit;

    // palette: copied every frame so a theme flip propagates mid-animation
    streamCold.copy(palette.inkFaint);
    streamWarm.copy(palette.inkSoft);
    swallowColor.copy(palette.bgInset);
    offColor.copy(palette.line);
    onColor.copy(palette.accent);

    // (b) compressor slab: scale in on enter, slow y-rotation breathing
    slab.current.scale.setScalar(Math.max(1e-4, enterSlab));
    slab.current.rotation.y = Math.sin(t * 0.35) * 0.06;
    slabMaterial.current.color.copy(palette.bgInset);
    slabMaterial.current.opacity = fade;
    edgeMaterial.current.color.copy(palette.line);
    edgeMaterial.current.opacity = 0.8 * fade;

    // (a) input stream: pure index math over the precomputed curve samples
    const sm = stream.current;
    streamMaterial.current.opacity = 0.95 * enterStream * fade;
    const { samples, jitter, mix, size, wobble } = streamData;
    for (let i = 0; i < streamCount; i++) {
      const u = (t * STREAM_SPEED + i / streamCount) % 1;
      let idx = (u * SAMPLE_COUNT) | 0;
      if (idx >= SAMPLE_COUNT) idx = SAMPLE_COUNT - 1;
      const base = idx * 3;
      const swallowed = smoothstep(phase(u, 0.72, 0.96));
      const spread = 1 - swallowed * 0.75; // stream tightens entering the slab
      tmpObject.position.set(
        samples[base] + jitter[i * 3] * spread,
        samples[base + 1] +
          jitter[i * 3 + 1] * spread +
          Math.sin(t * 1.3 + wobble[i]) * 0.05,
        samples[base + 2] + jitter[i * 3 + 2] * spread,
      );
      tmpObject.rotation.set(wobble[i] + t * 0.9, wobble[i] * 1.7 + t * 0.7, 0);
      const s = Math.max(1e-4, size[i] * (1 - swallowed));
      tmpObject.scale.set(s, s, s);
      tmpObject.updateMatrix();
      sm.setMatrixAt(i, tmpObject.matrix);
      sm.setColorAt(
        i,
        tmpColor
          .lerpColors(streamCold, streamWarm, mix[i])
          .lerp(swallowColor, swallowed * 0.85),
      );
    }
    sm.instanceMatrix.needsUpdate = true;
    if (sm.instanceColor) sm.instanceColor.needsUpdate = true;

    // (c) digest lattice: target alternates hello/hellp every EPOCH_SECONDS;
    // the flip wave is derived purely from elapsed time (survives remounts)
    const epoch = Math.floor(t / EPOCH_SECONDS);
    const timeIn = t - epoch * EPOCH_SECONDS;
    const parity = epoch % 2;
    const targetBits = bits ? (parity === 0 ? bits.a : bits.b) : null;
    const prevBits = bits ? (parity === 0 ? bits.b : bits.a) : null;

    const lm = lattice.current;
    latticeMaterial.current.opacity = enterLattice * fade;
    lm.scale.setScalar(0.85 + 0.15 * enterLattice);
    for (let i = 0; i < TILE_COUNT; i++) {
      const col = i % COLS;
      const row = (i / COLS) | 0;
      let value = 0;
      if (targetBits && prevBits) {
        const tb = targetBits[i];
        if (tb === prevBits[i]) {
          value = tb;
        } else {
          // column-keyed ripple sweeping left → right from the switch moment
          const flipT = clamp01((timeIn - col * COL_WAVE) / FLIP_SECONDS);
          value = tb === 1 ? flipT : 1 - flipT;
        }
      }
      tmpObject.position.set(
        LATTICE_X + (col - (COLS - 1) / 2) * TILE_SPACING,
        ((ROWS - 1) / 2 - row) * TILE_SPACING,
        Math.sin(t * 0.6 + bob[i]) * 0.045,
      );
      tmpObject.rotation.set(value * Math.PI, 0, 0);
      const pop = 1 + bump(value) * 0.4;
      tmpObject.scale.set(pop, pop, 1);
      tmpObject.updateMatrix();
      lm.setMatrixAt(i, tmpObject.matrix);
      lm.setColorAt(i, tmpColor.lerpColors(offColor, onColor, smoothstep(value)));
    }
    lm.instanceMatrix.needsUpdate = true;
    if (lm.instanceColor) lm.instanceColor.needsUpdate = true;

    // (d) pulse: slab → lattice at each target switch, dies in ~0.5 s
    const pulseT = timeIn / PULSE_SECONDS;
    const firing = bits !== null && pulseT < 1;
    pulseMaterial.current.color.copy(palette.accent);
    pulseMaterial.current.opacity = firing
      ? bump(pulseT) * enterLattice * fade
      : 0;
    pulse.current.position.set(
      lerp(SLAB_X + 0.7, -1.35, easeOutCubic(pulseT)),
      0,
      0.5,
    );
    pulse.current.scale.setScalar(0.1 + bump(clamp01(pulseT)) * 0.12);
  });

  return (
    <group ref={group}>
      {/* (a) input stream */}
      <instancedMesh
        ref={stream}
        args={[undefined, undefined, streamCount]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.09, 0.09, 0.09]} />
        <meshStandardMaterial
          ref={streamMaterial}
          roughness={0.6}
          metalness={0}
          transparent
        />
      </instancedMesh>

      {/* (b) compressor slab + edge cage */}
      <group ref={slab} position={[SLAB_X, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.3, 3.4, 0.9]} />
          <meshStandardMaterial
            ref={slabMaterial}
            roughness={0.7}
            metalness={0}
            transparent
          />
        </mesh>
        <lineSegments geometry={slabEdges}>
          <lineBasicMaterial ref={edgeMaterial} transparent />
        </lineSegments>
      </group>

      {/* (c) digest lattice: 256 tiles, one per SHA-256 bit */}
      <instancedMesh
        ref={lattice}
        args={[undefined, undefined, TILE_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.19, 0.19, 0.05]} />
        <meshStandardMaterial
          ref={latticeMaterial}
          roughness={0.55}
          metalness={0}
          transparent
        />
      </instancedMesh>

      {/* (d) digest pulse */}
      <mesh ref={pulse}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial ref={pulseMaterial} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
