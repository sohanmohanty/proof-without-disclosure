/** Chapter 0 — the hero bit-field.
 *
 * A lattice of tiles, one per bit, expanded from a real SHA-256 digest of
 * whatever the visitor types (field.ts). When the digest changes, tiles
 * flip — a half-turn around X — in a ripple radiating from the center: the
 * avalanche effect, watchable.
 *
 * This is the exemplar chapter: every scene follows the same shape.
 *   1. chapterFrame(id) at the top of useFrame; bail when off.
 *   2. All choreography is a pure function of `local` (and elapsed time
 *      for ambient motion) — chapters get unmounted/remounted freely.
 *   3. Instanced meshes, module-scope temp objects, zero per-frame allocs.
 *   4. Colors are copied from the palette every frame so theme flips
 *      propagate mid-animation.
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { rippleDelay } from "../field";
import { heroGrid, journey } from "../journeyState";
import { chapterFrame } from "../shared/chapter";
import { bump, phase, smoothstep } from "../shared/easing";
import { usePalette } from "../shared/palette";

const SPACING = 0.24;
const FLIP_SECONDS = 0.28;

// module-scope temps — useFrame must not allocate
const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const offColor = new THREE.Color();
const onColor = new THREE.Color();

export default function HeroField() {
  const { cols, rows } = heroGrid(journey.quality);
  const count = cols * rows;
  const palette = usePalette();
  const group = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const material = useRef<THREE.MeshStandardMaterial>(null!);

  const cells = useMemo(
    () => ({
      /** flip progress per cell: 0 (showing "0") … 1 (flipped to "1") */
      current: new Float32Array(count),
      delay: Float32Array.from({ length: count }, (_, i) =>
        rippleDelay(i % cols, Math.floor(i / cols), cols, rows),
      ),
      bob: Float32Array.from(
        { length: count },
        () => Math.random() * Math.PI * 2,
      ),
    }),
    [count, cols, rows],
  );

  useFrame((state, dt) => {
    const { local, on } = chapterFrame("hero");
    group.current.visible = on;
    if (!on) return;

    // group choreography: hold while the title dwells, sink + tilt on exit
    const exit = smoothstep(phase(local, 0.55, 0.95));
    group.current.rotation.x = -0.42 - exit * 0.55;
    group.current.position.set(0, -1.15 - exit * 5.5, -exit * 5);
    material.current.opacity = 1 - phase(local, 0.8, 1);

    offColor.copy(palette.line);
    onColor.copy(palette.accent);

    const t = state.clock.elapsedTime;
    const bits = journey.hero.bits;
    const rippleSeconds = (performance.now() - journey.hero.rippleAt) / 1000;
    const step = dt / FLIP_SECONDS;
    const m = mesh.current;

    for (let i = 0; i < count; i++) {
      let value = cells.current[i];
      const target = bits ? bits[i] : 0;
      if (value !== target && rippleSeconds > cells.delay[i]) {
        value =
          target > value
            ? Math.min(target, value + step)
            : Math.max(target, value - step);
        cells.current[i] = value;
      }
      const col = i % cols;
      const row = (i / cols) | 0;
      tmpObject.position.set(
        (col - (cols - 1) / 2) * SPACING,
        ((rows - 1) / 2 - row) * SPACING,
        Math.sin(t * 0.65 + cells.bob[i]) * 0.055,
      );
      tmpObject.rotation.set(value * Math.PI, 0, 0);
      const pop = 1 + bump(value) * 0.4;
      tmpObject.scale.set(pop, pop, 1);
      tmpObject.updateMatrix();
      m.setMatrixAt(i, tmpObject.matrix);
      m.setColorAt(i, tmpColor.lerpColors(offColor, onColor, smoothstep(value)));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.15, 0.15, 0.05]} />
        <meshStandardMaterial
          ref={material}
          roughness={0.55}
          metalness={0}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
