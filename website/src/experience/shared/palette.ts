/** Theme-aware colors for the 3D scenes: reads the site's CSS custom
 * properties so the WebGL world obeys the same light/dark theme as the rest
 * of the page. The returned object is stable and its Colors are mutated in
 * place when the theme flips; scenes should `.copy()` / `.lerpColors()`
 * from these inside useFrame (cheap) so a theme change propagates
 * mid-animation without a React re-render.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface ScenePalette {
  bg: THREE.Color;
  bgRaised: THREE.Color;
  bgInset: THREE.Color;
  ink: THREE.Color;
  inkSoft: THREE.Color;
  inkFaint: THREE.Color;
  line: THREE.Color;
  accent: THREE.Color;
  good: THREE.Color;
  bad: THREE.Color;
  warn: THREE.Color;
  dark: boolean;
}

const CSS_VARS = {
  bg: "--bg",
  bgRaised: "--bg-raised",
  bgInset: "--bg-inset",
  ink: "--ink",
  inkSoft: "--ink-soft",
  inkFaint: "--ink-faint",
  line: "--line",
  accent: "--accent",
  good: "--good",
  bad: "--bad",
  warn: "--warn",
} as const;

type ColorKey = keyof typeof CSS_VARS;

function refresh(palette: ScenePalette): void {
  const style = getComputedStyle(document.documentElement);
  for (const key of Object.keys(CSS_VARS) as ColorKey[]) {
    const value = style.getPropertyValue(CSS_VARS[key]).trim();
    if (value) palette[key].set(value);
  }
  palette.dark = document.documentElement.dataset.theme === "dark";
}

export function createPalette(): ScenePalette {
  const palette: ScenePalette = {
    bg: new THREE.Color(),
    bgRaised: new THREE.Color(),
    bgInset: new THREE.Color(),
    ink: new THREE.Color(),
    inkSoft: new THREE.Color(),
    inkFaint: new THREE.Color(),
    line: new THREE.Color(),
    accent: new THREE.Color(),
    good: new THREE.Color(),
    bad: new THREE.Color(),
    warn: new THREE.Color(),
    dark: false,
  };
  refresh(palette);
  return palette;
}

/** Stable palette whose Colors update in place when data-theme changes. */
export function usePalette(): ScenePalette {
  const ref = useRef<ScenePalette | null>(null);
  ref.current ??= createPalette();
  useEffect(() => {
    const palette = ref.current;
    if (!palette) return;
    const observer = new MutationObserver(() => refresh(palette));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return ref.current;
}
