/** Scroll timeline for the 3D journey landing page.
 *
 * The journey is a stack of full-width sections, one per chapter, scrolling
 * over a sticky full-viewport canvas. All choreography is driven by a single
 * number: the scroll offset into the journey measured in vh units. This
 * module is pure math — no DOM, no three.js — so it is unit-testable.
 *
 * A chapter's scene is "live" from shortly after its section top enters the
 * viewport (start − 75vh) until shortly before its section scrolls away
 * (start + height − 25vh). Adjacent ranges therefore overlap by exactly
 * 50vh — a brief handoff where the outgoing scene's exit fade crosses the
 * incoming scene's entrance, so one scene is always clearly dominant.
 */

export type ChapterId =
  | "hero"
  | "hash"
  | "commit"
  | "merkle"
  | "signature"
  | "zk"
  | "schnorr"
  | "outro";

export interface ChapterDef {
  id: ChapterId;
  /** Height of this chapter's scroll section, in vh. */
  heightVh: number;
  /** Short label for the progress dots / aria. */
  title: string;
}

export const CHAPTERS: ChapterDef[] = [
  { id: "hero", heightVh: 170, title: "Welcome" },
  { id: "hash", heightVh: 150, title: "Hash functions" },
  { id: "commit", heightVh: 150, title: "Commitments" },
  { id: "merkle", heightVh: 160, title: "Merkle trees" },
  { id: "signature", heightVh: 150, title: "Digital signatures" },
  { id: "zk", heightVh: 170, title: "Zero-knowledge" },
  { id: "schnorr", heightVh: 190, title: "Schnorr protocol" },
  { id: "outro", heightVh: 130, title: "Try to cheat" },
];

export const TOTAL_VH = CHAPTERS.reduce((sum, c) => sum + c.heightVh, 0);

const startByChapter = new Map<ChapterId, number>();
{
  let cum = 0;
  for (const c of CHAPTERS) {
    startByChapter.set(c.id, cum);
    cum += c.heightVh;
  }
}

export interface ChapterRange {
  enterVh: number;
  exitVh: number;
}

export function chapterRange(id: ChapterId): ChapterRange {
  const start = startByChapter.get(id);
  const def = CHAPTERS.find((c) => c.id === id);
  if (start === undefined || !def) throw new Error(`unknown chapter: ${id}`);
  return {
    enterVh: Math.max(0, start - 75),
    exitVh: start + def.heightVh - 25,
  };
}

/** Local progress of a chapter at a given journey offset. 0 at enter, 1 at
 * exit, *unclamped* outside — scenes use the margin to hide themselves. */
export function localProgress(offsetVh: number, id: ChapterId): number {
  const { enterVh, exitVh } = chapterRange(id);
  return (offsetVh - enterVh) / (exitVh - enterVh);
}

/** Index of the chapter whose section currently dominates the viewport —
 * used for progress dots and for mounting only active ± 1 scenes. */
export function activeChapterIndex(offsetVh: number): number {
  let active = 0;
  let cum = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (offsetVh + 50 >= cum) active = i;
    cum += CHAPTERS[i].heightVh;
  }
  return active;
}
