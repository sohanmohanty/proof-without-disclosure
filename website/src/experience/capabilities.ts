/** Feature gates for the 3D landing. The journey must never load for
 * visitors who can't run it (no WebGL) or shouldn't be made to sit through
 * it (prefers-reduced-motion) — they get the classic page instead. And
 * ?classic=1 is an always-available escape hatch, machine problems or not.
 *
 * This module is imported eagerly by the router, so it must never import
 * three.js — the whole point is deciding *whether* to download that chunk.
 */

export interface Capabilities {
  webgl: boolean;
  reducedMotion: boolean;
}

/** True when the query string explicitly asks for the classic page. */
export function wantsClassic(search: string): boolean {
  return new URLSearchParams(search).has("classic");
}

export function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

export function detectCapabilities(): Capabilities {
  return { webgl: hasWebGL(), reducedMotion: prefersReducedMotion() };
}
