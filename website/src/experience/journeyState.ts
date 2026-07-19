/** Mutable per-frame state shared between the scrolling DOM and the R3F
 * scenes. Scenes read it inside useFrame; the DOM writes it from event
 * listeners. Nothing here triggers React renders; that is the point:
 * scroll choreography runs at frame rate without going through React.
 */

import { TOTAL_VH } from "./timeline";

export type Quality = "high" | "low";

export interface HeroFieldState {
  /** Hex digest currently visualized by the hero bit-field. */
  digestHex: string;
  /** Expanded bit targets, length = hero grid cell count (or null early). */
  bits: Uint8Array | null;
  /** performance.now() timestamp when the current ripple started. */
  rippleAt: number;
  /** Source text the digest came from (displayed by the caption). */
  source: string;
}

export interface JourneyState {
  /** Raw scroll offset into the journey, in vh units (set by the DOM). */
  targetVh: number;
  /** Smoothed offset: what the scenes should read. */
  offsetVh: number;
  /** Pointer position in [-1, 1], viewport-normalized. */
  pointerX: number;
  pointerY: number;
  quality: Quality;
  hero: HeroFieldState;
}

export const journey: JourneyState = {
  targetVh: 0,
  offsetVh: 0,
  pointerX: 0,
  pointerY: 0,
  quality: "high",
  hero: { digestHex: "", bits: null, rippleAt: 0, source: "" },
};

/** Exponential smoothing with meaningful units: after `halfLife` seconds,
 * half of the remaining distance is covered, framerate-independent. */
export function smoothTowards(
  current: number,
  target: number,
  dt: number,
  halfLife: number,
): number {
  if (halfLife <= 0) return target;
  if (dt <= 0) return current;
  return target + (current - target) * Math.pow(2, -dt / halfLife);
}

/** Hero bit-field dimensions per quality tier. */
export function heroGrid(quality: Quality): { cols: number; rows: number } {
  return quality === "high" ? { cols: 72, rows: 40 } : { cols: 48, rows: 27 };
}

/** Wire scroll + pointer events to the journey store. Returns cleanup. */
export function bindJourney(wrapper: HTMLElement): () => void {
  const onScroll = () => {
    const rect = wrapper.getBoundingClientRect();
    // the caption sections are sized in CSS vh, so derive the same unit
    // from the wrapper's rendered height (= TOTAL_VH vh) instead of
    // window.innerHeight, which drifts from CSS vh on mobile browsers with
    // dynamic toolbars; the drift would desync scenes from captions
    const vhPx = rect.height / TOTAL_VH;
    journey.targetVh = vhPx > 0 ? Math.max(0, -rect.top / vhPx) : 0;
  };
  const onPointer = (e: PointerEvent) => {
    journey.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    journey.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  };
  onScroll();
  journey.offsetVh = journey.targetVh; // no catch-up animation on load
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("pointermove", onPointer, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    window.removeEventListener("pointermove", onPointer);
  };
}

export function detectQuality(): Quality {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = window.innerWidth < 700;
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return coarse || small || (memory !== undefined && memory < 4)
    ? "low"
    : "high";
}
