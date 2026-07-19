/** Chapter 7: the outro, under "Now try to forge a proof."
 *
 * Every chapter scattered evidence across the screen: hashed bits,
 * commitments, Merkle leaves, signature checks, zero-knowledge rounds. Here
 * the loose fragments drift home onto a single quiet ring (claims closing
 * into one verifiable whole) around the site's privacy-dot glyph: the
 * secret at the center, sealed inside proof, visible only as a mark. The
 * assembly just orbits. There is nothing left to inspect and nothing left
 * to leak, which is exactly the invitation to try.
 *
 * Deliberately ambient: it must sit behind the centered DOM text, not
 * compete with it. All placement is deterministic per-index hashing, so a
 * remount at any scroll position reproduces the identical frame.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { lerp, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

/** How far the converged halo tips away from the camera (radians). */
const RING_TILT = -0.55;

// module-scope temps: useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const lineColor = new THREE.Color();
const accentColor = new THREE.Color();

const fract = (x: number): number => x - Math.floor(x);
/** Deterministic per-index randomness, stable across remounts. */
const hash = (i: number, salt: number): number =>
  fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

export default function OutroChapter() {
  const count = journey.quality === "low" ? 250 : 500;
  const palette = usePalette();
  const group = useRef<THREE.Group>(null!);
  const tilt = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Group>(null!);
  const emblem = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const particleMat = useRef<THREE.MeshStandardMaterial>(null!);
  const torusMat = useRef<THREE.MeshBasicMaterial>(null!);
  const dotMat = useRef<THREE.MeshBasicMaterial>(null!);

  const particles = useMemo(() => {
    const scatter = new Float32Array(count * 3);
    const ring = new Float32Array(count * 3);
    const twinkle = new Float32Array(count);
    const speed = new Float32Array(count);
    const mix = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // scattered start: uniform-ish in a 14 x 9 x 5 box
      scatter[i3] = (hash(i, 1) - 0.5) * 14;
      scatter[i3 + 1] = (hash(i, 2) - 0.5) * 9;
      scatter[i3 + 2] = (hash(i, 3) - 0.5) * 5;
      // target: a wide flat ring with slight thickness
      const angle = (i / count) * Math.PI * 2 + (hash(i, 4) - 0.5) * 0.4;
      const radius = 4.6 + (hash(i, 5) - 0.5) * 0.5;
      ring[i3] = Math.cos(angle) * radius;
      ring[i3 + 1] = Math.sin(angle) * radius;
      ring[i3 + 2] = (hash(i, 6) - 0.5) * 0.6;
      twinkle[i] = hash(i, 7) * Math.PI * 2;
      speed[i] = 0.7 + hash(i, 8) * 0.9;
      mix[i] = hash(i, 9);
      size[i] = 0.7 + hash(i, 10) * 0.6;
    }
    return { scatter, ring, twinkle, speed, mix, size };
  }, [count]);

  useFrame((state) => {
    const { local, on } = chapterFrame("outro");
    group.current.visible = on;
    if (!on) return;

    const t = state.clock.elapsedTime;
    const appear = smoothstep(phase(local, 0.05, 0.18));
    const converge = smoothstep(phase(local, 0.05, 0.35));
    // exit: fade fully out by 0.97; the sticky canvas is almost entirely
    // scrolled off-screen by then, so the fade reads as the scene slipping
    // away with the page rather than a visible cut
    const settle = 1 - smoothstep(phase(local, 0.82, 0.97));

    // the assembly tips into a wide halo as it converges, then orbits
    tilt.current.rotation.x = RING_TILT * converge;
    spin.current.rotation.z = t * 0.05;

    lineColor.copy(palette.line);
    accentColor.copy(palette.accent);
    particleMat.current.opacity = appear * settle * 0.9;

    const p = particles;
    const m = mesh.current;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      tmpObject.position.set(
        lerp(p.scatter[i3], p.ring[i3], converge),
        lerp(p.scatter[i3 + 1], p.ring[i3 + 1], converge),
        lerp(p.scatter[i3 + 2], p.ring[i3 + 2], converge),
      );
      // per-particle twinkle: gentle scale bob on a per-index phase
      const s =
        p.size[i] * appear * (1 + 0.3 * Math.sin(t * p.speed[i] + p.twinkle[i]));
      tmpObject.scale.set(s, s, s);
      tmpObject.updateMatrix();
      m.setMatrixAt(i, tmpObject.matrix);
      m.setColorAt(i, tmpColor.lerpColors(lineColor, accentColor, p.mix[i]));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;

    // privacy-dot emblem: arrives as the ring closes, then breathes softly
    const emblemIn = smoothstep(phase(local, 0.18, 0.4));
    emblem.current.scale.setScalar(emblemIn * (1 + 0.03 * Math.sin(t * 1.3)));
    torusMat.current.color.copy(palette.accent);
    dotMat.current.color.copy(palette.accent);
    torusMat.current.opacity =
      emblemIn * settle * (0.6 + 0.25 * Math.sin(t * 1.3));
    dotMat.current.opacity =
      emblemIn * settle * (0.75 + 0.2 * Math.sin(t * 1.3 + 1.1));
  });

  return (
    <group ref={group}>
      <group ref={tilt}>
        <group ref={spin}>
          <instancedMesh
            ref={mesh}
            args={[undefined, undefined, count]}
            frustumCulled={false}
          >
            <sphereGeometry args={[0.04, 6, 5]} />
            <meshStandardMaterial
              ref={particleMat}
              roughness={0.6}
              metalness={0}
              transparent
            />
          </instancedMesh>
        </group>
      </group>
      <group ref={emblem}>
        <mesh>
          <torusGeometry args={[0.5, 0.028, 12, 64]} />
          <meshBasicMaterial ref={torusMat} transparent />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshBasicMaterial ref={dotMat} transparent />
        </mesh>
      </group>
    </group>
  );
}
