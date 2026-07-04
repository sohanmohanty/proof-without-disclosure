/** Per-chapter plumbing between the journey store and a scene. */

import { journey } from "../journeyState";
import { localProgress, type ChapterId } from "../timeline";

export interface ChapterFrame {
  /** Local progress: 0 at enter, 1 at exit, unclamped outside. */
  local: number;
  /** Whether the chapter should render at all (small margin, no popping). */
  on: boolean;
}

/** Call once at the top of a chapter's useFrame. Everything a scene does
 * must be a function of (local, elapsed time) — chapters are unmounted and
 * remounted as the visitor scrolls, so no state may depend on history. */
export function chapterFrame(id: ChapterId): ChapterFrame {
  const local = localProgress(journey.offsetVh, id);
  return { local, on: local > -0.03 && local < 1.03 };
}
