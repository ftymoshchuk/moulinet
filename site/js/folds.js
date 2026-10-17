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
const INK = 1.05;

/**
 * Long dry strokes down a baggy thigh from the hip toward the knee, spreading at
 * the top and drawing together at the bottom, where the cloth is gathered.
 */
export function thighFolds(W, hip, knee, ref, seed = 1) {
  const f = along(hip, knee, ref);
  const r = wobble(seed);
  let d = "";
  [7.4, 3.0, -1.2, -5.2].forEach((c, i) => {
    const t0 = 0.06 + r() * 0.2;
    const t1 = 0.56 + r() * 0.36;
    const a = f.at(t0, c + (r() - 0.5) * 2);
    const b = f.at(t1, c * (0.35 + r() * 0.3));
    const mid = f.at((t0 + t1) / 2, c * 0.75 + (r() - 0.5) * 4);
    d += stroke(W, [a, mid, b], 0.45 + r() * 0.4, 0.3 + r() * 0.2);
  });
  return d;
}

/**
 * The folds loose trousers pull from the crotch: long diagonal strokes from the
 * top of the thigh, on the inside, down toward the front of the knee.
 */
export function crotchFolds(W, hip, knee, ref, seed = 12) {
  const f = along(hip, knee, ref);
  const r = wobble(seed);
  let d = "";
  // A fan from the crotch: each stroke starts on the inside, near the top, and ends further out and lower.
  [[-6.5, 2.0], [-3.2, 5.2], [0.4, 7.6]].forEach(([c0, c1], i) => {
    const t0 = 0.05 + i * 0.05;
    const t1 = 0.4 + i * 0.07 + r() * 0.04;
    const mid = f.at((t0 + t1) / 2, (c0 + c1) / 2 + (r() - 0.5));
    d += stroke(W, [f.at(t0, c0), mid, f.at(t1, c1)], 0.5 + r() * 0.2, 0.4);
  });
  return d;
}

/** Puckers at the bend of a knee in loose trousers: two short strokes across the front of it. */
export function kneePuckers(W, knee, shin, ref, seed = 13) {
  const f = along(knee, add(knee, mul(shin, 20)), ref);
  const r = wobble(seed);
  let d = "";
  [[-0.4, 9.2], [1.8, 8.6]].forEach(([s, c]) => {
    const a = f.at(s / 20, c);
    const b = f.at((s + 1.2) / 20, c * 0.2);
    d += stroke(W, [a, f.at((s + 0.7) / 20, c * 0.7 + (r() - 0.5)), b], 0.5, 0.45);
  });
  return d;
}

/** Long folds sweeping across the pouch of cloth at the knee, and the shadow where it gathers into the band. */
export function kneeFolds(W, knee, shin, ref, seed = 2) {
  const f = along(knee, add(knee, mul(shin, 20)), ref);
  const r = wobble(seed);
  let d = "";
  [[-0.6, 8.8], [3.6, 8.8], [7.4, 7.6]].forEach(([s, c], i) => {
    const a = f.at(s / 20, c);
    const b = f.at((s + 1.7) / 20, -c * 0.7);
    const mid = f.at((s + 1.4 + r()) / 20, c * 0.1);
    d += stroke(W, [a, mid, b], 0.5 + r() * 0.3, 0.4 + i * 0.05);
  });
  // The cloth bunched above the band: short strokes low on the back of the leg.
  for (let i = 0; i < 2; i++) {
    const t = (9.8 + i * 1.1) / 20;
    d += stroke(W, [f.at(t, -6.6 + i * 0.4), f.at(t + 0.1, -2.4 + r() * 1.5)], 0.7, 0.45);
  }
  return d;
}

/** The wrinkles of a stocking, round the calf and gathered over the shoe. */
export function sockWrinkles(W, from, ankle, ref, seed = 3) {
  const f = along(from, ankle, ref);
  const r = wobble(seed);
  let d = "";
  for (let i = 0; i < 3; i++) {
    const t = 0.64 + i * 0.11 + r() * 0.03;
    d += stroke(W, [f.at(t, 3.8 - r()), f.at(t + 0.02, 0.4), f.at(t + 0.045, -3.8 + r())], 0.45 + r() * 0.2, 0.5);
  }
  // A long soft line down the back of the calf.
  d += stroke(W, [f.at(0.14, -4.6), f.at(0.4, -5.2), f.at(0.68, -3.6)], 0.5, 0.5);
  return d;
}

/** Loose trousers gathered at the ankle: short curved strokes above the cuff, and two long folds down the shin. */
export function cuffGathers(W, ankle, su, ref, seed = 3) {
  const f = along(add(ankle, mul(su, -30)), ankle, ref);
  const r = wobble(seed);
  let d = "";
  for (let i = 0; i < 4; i++) {
    const t = 0.66 + i * 0.075 + r() * 0.02;
    d += stroke(W, [f.at(t, 5.8 - r()), f.at(t + 0.018, 0.6), f.at(t + 0.034, -5.6 + r())], 0.5 + r() * 0.2, 0.5);
  }
  d += stroke(W, [f.at(0.2, 3.6), f.at(0.45, 4.2), f.at(0.62, 3.4)], 0.5, 0.5);
  d += stroke(W, [f.at(0.14, -4.4), f.at(0.42, -4.8), f.at(0.6, -4.0)], 0.5, 0.5);
  return d;
}

/**
 * The creases of a jersey, each a thin stroke laid on its surface: under the
 * sleeve, radiating from the armpit; across the chest; at the waist, where the
 * body bends; and two long folds down the front, where the body turns away.
 * `at(up, v)` is a point of the jersey: `up` cm above the hips, and `v` across
 * from the back, -1, to the front, 1. An older man has the folds of a belly.
 */
export function torsoFolds(at, seed = 4, older = false) {
  const r = wobble(seed);
  const page = (q) => q;
  // A stroke through points given as [up, v], bowed a little to one side.
  const crease = (points, width = 0.5, bow = 0.5) => {
    const [a, b] = [points[0], points[points.length - 1]];
    const mid = points.length > 2 ? points[1] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bow * 0.08];
    return stroke(page, [at(...a), at(...mid), at(...b)], width + r() * 0.15, 0.4 + r() * 0.2);
  };
  let d = "";
  // Under the sleeve, radiating from the armpit.
  [[40.6, -0.5, 38.0, -0.18], [42.0, -0.46, 40.2, -0.04]].forEach(([u0, v0, u1, v1]) => {
    d += crease([[u0, v0], [u1, v1]], 0.5);
  });
  // Across the chest, the line under it.
  d += crease([[39.4, 0.1], [38.4, 0.4], [39.8, 0.74]], 0.55);
  // At the waist, where the jersey is gathered.
  [[18.4, -0.5, 16.6, 0.6], [14.8, -0.62, 13.2, 0.72], [21.6, -0.3, 20.6, 0.5]].forEach(([u0, v0, u1, v1]) => {
    d += crease([[u0, v0], [(u0 + u1) / 2 - 0.5, (v0 + v1) / 2], [u1, v1]], 0.5);
  });
  // Down the front, where the body turns away: two long folds, not a row of ticks.
  d += crease([[44.0, 0.72], [36.0, 0.84], [28.0, 0.8]], 0.6);
  d += crease([[24.0, 0.8], [19.0, 0.88], [14.0, 0.82]], 0.6);
  if (older) {
    // The weight of a belly: folds that hang across it, and the shadow below.
    d += crease([[12.4, -0.1], [11.4, 0.5], [12.6, 0.96]], 0.8);
    d += crease([[16.2, 0.2], [15.2, 0.62], [16.6, 0.94]], 0.6);
  }
  return d;
}

/** A heavier line along the hem, where the jersey meets the waistband, and the wrinkles it drags in the cloth below. */
export function waistband(at, seed = 5) {
  const r = wobble(seed);
  const page = (q) => q;
  let d = stroke(page, [at(9.6, -0.94), at(8.6, 0.0), at(9.8, 0.96)], 1.0, 0.5);
  for (let v = -0.7; v < 0.9; v += 0.42 + r() * 0.2) {
    d += stroke(page, [at(8.4, v), at(6.2 - r() * 1.2, v + 0.04)], 0.5, 0.35);
  }
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
  for (let i = 0; i < 2; i++) {
    const c = side * (3.2 - i * 0.6);
    const a = fore.at(0.36 + i * 0.14, c * 1.5);
    const b = lerp(elbow, a, 0.18);
    d += stroke(W, [a, add(lerp(a, b, 0.5), mul(fore.n, side * 0.8)), b], 0.5 + r() * 0.3, 0.45);
  }
  {
    const a = up.at(0.68, side * 3.4);
    d += stroke(W, [a, lerp(a, elbow, 0.5), lerp(elbow, a, 0.12)], 0.5, 0.45);
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
    stroke(W, [[x - 19 - r() * 3, -0.5], [x + reach * 0.6, -0.8], [x + reach + 8 + r() * 4, -0.3]], 1.2, 0.4),
    stroke(W, [[x - 12, -2.4], [x + reach * 0.5, -2.6], [x + reach + 3, -2.3]], 0.9, 0.45),
    stroke(W, [[x - 7 - r() * 3, -4.0], [x + reach * 0.3, -4.1], [x + reach - 3, -3.8]], 0.7, 0.5),
  ].join("");
}
