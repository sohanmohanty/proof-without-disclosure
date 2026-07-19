/** Tiny animation-math kit shared by every chapter scene. */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Remap `x` from [a, b] to [0, 1], clamped. The beat primitive: every
 * chapter carves its local progress into phases with this. */
export function phase(x: number, a: number, b: number): number {
  return clamp01((x - a) / (b - a));
}

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const smoothstep = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number): number =>
  1 - Math.pow(1 - clamp01(t), 3);

export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Rises 0 → 1 → 0 (peak at t = 0.5). For pulses and pops. */
export const bump = (t: number): number => Math.sin(Math.PI * clamp01(t));
