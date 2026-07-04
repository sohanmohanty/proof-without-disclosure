/** The single <Canvas> behind the whole journey: camera rig, lights, and
 * windowed mounting of chapter scenes (active chapter ± 1 only — scenes are
 * unmounted once they are more than a viewport away). `flat` disables tone
 * mapping so palette colors render exactly as their CSS hex values.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, type ComponentType } from "react";
import { journey, smoothTowards } from "./journeyState";
import { activeChapterIndex, CHAPTERS, type ChapterId } from "./timeline";
import HeroField from "./chapters/HeroField";
import HashChapter from "./chapters/HashChapter";
import CommitmentChapter from "./chapters/CommitmentChapter";
import MerkleChapter from "./chapters/MerkleChapter";
import SignatureChapter from "./chapters/SignatureChapter";
import ZKChapter from "./chapters/ZKChapter";
import SchnorrChapter from "./chapters/SchnorrChapter";
import OutroChapter from "./chapters/OutroChapter";

const SCENES: Record<ChapterId, ComponentType> = {
  hero: HeroField,
  hash: HashChapter,
  commit: CommitmentChapter,
  merkle: MerkleChapter,
  signature: SignatureChapter,
  zk: ZKChapter,
  schnorr: SchnorrChapter,
  outro: OutroChapter,
};

/** Each chapter's focal composition sits left or right of center (the DOM
 * caption takes the other side) — on narrow viewports the captions become
 * centered cards instead, so the camera pans to the focal point. */
const FOCAL_X: Record<ChapterId, number> = {
  hero: 0,
  hash: -1.1,
  commit: 2.2,
  merkle: -2.2,
  signature: 1.9,
  zk: -2.1,
  schnorr: 2.4,
  outro: 0,
};

/** Advances the smoothed scroll offset (the one place that happens),
 * applies gentle pointer parallax, and adapts to narrow viewports:
 * chapter compositions assume ~12 world units of width, so on portrait
 * aspect ratios the camera pulls back and pans toward the focal point. */
function CameraRig() {
  const focalNow = useRef(0);
  useFrame(({ camera, size }, dt) => {
    // teleport across big jumps (progress dots, keyboard End): chasing a
    // 1000vh gap would sweep the smoothed offset through every chapter,
    // transiently mounting and unmounting all of them
    const gap = journey.targetVh - journey.offsetVh;
    journey.offsetVh =
      Math.abs(gap) > 250
        ? journey.targetVh
        : smoothTowards(journey.offsetVh, journey.targetVh, dt, 0.09);
    const aspect = size.width / Math.max(size.height, 1);
    const fit = Math.min(1.9, Math.max(1, 1.15 / Math.max(aspect, 0.1)));
    const narrow = Math.min(1, Math.max(0, (1.15 - aspect) / 0.6));
    const active = CHAPTERS[activeChapterIndex(journey.offsetVh)].id;
    const k = 1 - Math.pow(2, -dt / 0.3);
    focalNow.current += (FOCAL_X[active] * narrow - focalNow.current) * k;
    // on narrow viewports the caption card owns the top half of the screen —
    // raise the view so the scene reads in the lower half
    const lookY = narrow * 2.2;
    camera.position.x +=
      (journey.pointerX * 0.45 + focalNow.current - camera.position.x) * k;
    camera.position.y +=
      (-journey.pointerY * 0.28 + lookY - camera.position.y) * k;
    camera.position.z += (14 * fit - camera.position.z) * k;
    camera.lookAt(focalNow.current, lookY, 0);
  });
  return null;
}

/** Mounts only the scenes that could be on screen. */
function ChapterWindow() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  useFrame(() => {
    const idx = activeChapterIndex(journey.offsetVh);
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActive(idx);
    }
  });
  return (
    <>
      {CHAPTERS.map((c, i) => {
        if (Math.abs(i - active) > 1) return null;
        const Scene = SCENES[c.id];
        return <Scene key={c.id} />;
      })}
    </>
  );
}

export default function JourneyCanvas({ running }: { running: boolean }) {
  return (
    <Canvas
      flat
      frameloop={running ? "always" : "never"}
      dpr={journey.quality === "high" ? [1, 1.75] : [1, 1.25]}
      camera={{ fov: 38, position: [0, 0, 14], near: 0.1, far: 80 }}
      gl={{
        antialias: journey.quality === "high",
        alpha: true,
        powerPreference: "high-performance",
      }}
    >
      <CameraRig />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 7, 9]} intensity={1.15} />
      <directionalLight position={[-6, -3, -7]} intensity={0.35} />
      <ChapterWindow />
    </Canvas>
  );
}
