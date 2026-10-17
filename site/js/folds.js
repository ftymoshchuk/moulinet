// The ink work that makes a figure look drawn: the folds of cloth, the shadow
// under a hem, the wrinkles of a stocking, the strokes on the floor. Each is a
// handful of brush strokes placed by rule from the bones of a pose, in
// centimetres, and given back as path data. Nothing here is random: the same
// pose always draws the same strokes, so they move with the body and never
// flicker.
import { add, brush, dist, lerp, mul, perp, unit } from "./ink.js";

// A little steady variation, for strokes that should not look ruled.
function wobble(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * A frame along the bone from `a` to `b`: `at(t, c)` is the point `t` of the way
 * along it and `c` out from it, on the side that faces `ref` when `c` is
 * positive.
 */
export function along(a, b, ref) {
  const u = unit(a, b);
  let n = perp(u);
  if (n[0] * ref[0] + n[1] * ref[1] < 0) n = mul(n, -1);
  const length = dist(a, b);
  return { u, n, length, at: (t, c) => add(add(a, mul(u, length * t)), mul(n, c)) };
}

// A stroke through `points`, mapped to the page by `W`.
function stroke(W, points, width, swell) {
  // However heavy a stroke is meant to be, it stays long and slender.
  const length = points.slice(1).reduce((sum, q, i) => sum + dist(points[i], q), 0);
  return brush(points.map(W), Math.min(width * INK, length * 0.1), swell);
}

// How much heavier than first drawn every stroke is.
const INK = 1.45;

/**
 * Long dry strokes down a baggy thigh from the hip toward the knee, spreading at
 * the top and drawing together at the bottom, where the cloth is gathered.
 */
export function thighFolds(W, hip, knee, ref, seed = 1) {
  const f = along(hip, knee, ref);
  const r = wobble(seed);
  let d = "";
  [10, 5.6, 1.6, -3, -7.2].forEach((c, i) => {
    const t0 = 0.08 + r() * 0.2;
    const t1 = 0.55 + r() * 0.35;
    const a = f.at(t0, c + (r() - 0.5) * 2);
    const b = f.at(t1, c * (0.35 + r() * 0.3));
    const mid = f.at((t0 + t1) / 2, c * 0.75 + (r() - 0.5) * 4);
    d += stroke(W, [a, mid, b], 0.55 + r() * 0.5, 0.3 + r() * 0.2);
  });
  return d;
}

/** Long folds sweeping across the pouch of cloth at the knee, and the shadow where it gathers into the band. */
export function kneeFolds(W, knee, shin, ref, seed = 2) {
  const f = along(knee, add(knee, mul(shin, 20)), ref);
  const r = wobble(seed);
  let d = "";
  [[-1, 9.6], [2.4, 9.4], [5.4, 8.6], [8.2, 7.6]].forEach(([s, c], i) => {
    const a = f.at(s / 20, c);
    const b = f.at((s + 1.5) / 20, -c * 0.7);
    const mid = f.at((s + 1.2 + r()) / 20, c * 0.1);
    d += stroke(W, [a, mid, b], 0.5 + r() * 0.3, 0.4 + i * 0.05);
  });
  // The cloth bunched above the band: short strokes low on the back of the leg.
  for (let i = 0; i < 4; i++) {
    const t = (9.4 + i * 0.6) / 20;
    d += stroke(W, [f.at(t, -7 + i * 0.25), f.at(t + 0.09, -2.4 + r() * 1.5)], 0.7, 0.45);
  }
  return d;
}

/** The wrinkles of a stocking, round the calf and gathered over the shoe. */
export function sockWrinkles(W, from, ankle, ref, seed = 3) {
  const f = along(from, ankle, ref);
  const r = wobble(seed);
  let d = "";
  for (let i = 0; i < 4; i++) {
    const t = 0.62 + i * 0.085 + r() * 0.03;
    d += stroke(W, [f.at(t, 3.8 - r()), f.at(t + 0.02, 0.4), f.at(t + 0.045, -3.8 + r())], 0.45 + r() * 0.2, 0.5);
  }
  // A long soft line down the back of the calf.
  d += stroke(W, [f.at(0.14, -4.6), f.at(0.4, -5.2), f.at(0.68, -3.6)], 0.5, 0.5);
  return d;
}

/**
 * The shadow under the hem of a jersey: a heavy band along the hem and a fan of
 * strokes below it, crowded toward the back. `T(a, b)` is a point of the torso's
 * frame.
 */
export function hemShadow(W, T, seed = 4) {
  const r = wobble(seed);
  let d = stroke(W, [T(9.4, -13.5), T(8.4, -2), T(9.2, 11.5)], 1.5, 0.45);
  [[-12.6, 4.6], [-10.9, 3.2], [-8.4, 4.9], [-6.9, 3.4], [-3.8, 4.2], [-0.6, 3.0], [2.9, 4.4], [5.4, 3.0], [8.8, 3.8]].forEach(([b, len]) => {
    const j = (r() - 0.5) * 1.2;
    d += stroke(W, [T(9, b + j), T(9 - len * (0.8 + r() * 0.4), b + j + 1.4 + r())], 0.6 + r() * 0.4, 0.3);
  });
  return d;
}

/** Hatching down the front of the chest and belly, in uneven bunches, and the folds at the waist. */
export function chestHatch(W, T, seed = 5) {
  const r = wobble(seed);
  let d = "";
  [[19.2, 0.8], [22.6, 1.0], [24.2, 0.7], [28.8, 1.1], [30.2, 0.8], [35.0, 0.9], [38.8, 0.6]].forEach(([a, k]) => {
    const j = (r() - 0.5) * 0.8;
    d += stroke(W, [T(a + j, 16.4 - r() * 0.8), T(a + j - 1.2 - r() * 0.8, 16.2 - 5.4 * k - r() * 2)], 0.5 + r() * 0.35, 0.4);
  });
  d += stroke(W, [T(18, 15), T(15, 4), T(15.5, -6)], 0.5, 0.5);
  d += stroke(W, [T(29, -16), T(26, -11), T(27, -6.4)], 0.5, 0.5);
  return d;
}

/**
 * Folds in a sleeve at the elbow: strokes drawn in toward the inside of the bend
 * from along both arms, and the heavier line along the underside of the forearm.
 */
export function sleeveFolds(W, shoulder, elbow, wrist, seed = 6) {
  const r = wobble(seed);
  const up = along(shoulder, elbow, [0, 1]);
  const fore = along(elbow, wrist, [0, 1]);
  // The inside of the bend faces the way the arm turns.
  const bend = (elbow[0] - shoulder[0]) * (wrist[1] - elbow[1]) - (elbow[1] - shoulder[1]) * (wrist[0] - elbow[0]);
  const side = bend > 0 ? -1 : 1;
  let d = "";
  for (let i = 0; i < 3; i++) {
    const c = side * (3.2 - i * 0.5);
    const a = fore.at(0.34 + i * 0.1, c * 1.5);
    const b = lerp(elbow, a, 0.18);
    d += stroke(W, [a, add(lerp(a, b, 0.5), mul(fore.n, side * 0.8)), b], 0.45 + r() * 0.3, 0.45);
  }
  for (let i = 0; i < 2; i++) {
    const a = up.at(0.7 - i * 0.1, side * 3.4);
    d += stroke(W, [a, lerp(a, elbow, 0.5), lerp(elbow, a, 0.12)], 0.45, 0.45);
  }
  // The heavier line under the forearm.
  d += stroke(W, [fore.at(0.2, -5.2), fore.at(0.55, -4.9), fore.at(0.94, -4.1)], 1.1, 0.5);
  return d;
}

/** The strokes on the floor under a foot: long, light, and shorter on the far side. */
export function groundStrokes(W, ankle, front, seed = 7, k = 1) {
  const r = wobble(seed);
  const x = ankle[0];
  const reach = (front ? 24 : 15) * k;
  return [
    stroke(W, [[x - 19 - r() * 3, 0.7], [x + reach * 0.6, 0.3], [x + reach + 8 + r() * 4, 0.9]], 1.4, 0.4),
    stroke(W, [[x - 12, -1.9], [x + reach * 0.5, -2.1], [x + reach + 3, -1.8]], 1.0, 0.45),
    stroke(W, [[x - 7 - r() * 3, -3.6], [x + reach * 0.3, -3.7], [x + reach - 3, -3.4]], 0.7, 0.5),
  ].join("");
}
