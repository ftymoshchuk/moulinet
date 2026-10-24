// The ink work that makes a figure look drawn: the folds of cloth, the shadow
// under a hem, the wrinkles of a stocking, the strokes on the floor. Each is a
// handful of brush strokes placed by rule from the bones of a pose, in
// centimetres, and given back as path data. Nothing here is random: the same
// pose always draws the same strokes, so they move with the body and never
// flicker.
import { add, brush, dist, lerp, mul, perp, unit } from "./ink.js";
import { JERSEY_HEM as HEM } from "./parts.js";

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
const INK = 1.0;

// A stroke in a frame along a bone, from [t0, c0] to [t1, c1] (see `along`), bowed `bow` across it in the middle.
function inFrame(W, f, [t0, c0], [t1, c1], width, bow = 0, swell = 0.45) {
  return stroke(W, [f.at(t0, c0), f.at((t0 + t1) / 2, (c0 + c1) / 2 + bow), f.at(t1, c1)], width, swell);
}

/**
 * The folds of a baggy thigh, from the hip toward the knee: a fan of long
 * strokes from the crotch that runs out across the thigh as it goes down, and
 * shorter strokes of shade along the inside of the thigh, where it faces the
 * other leg. `inner` is the side the crotch is on: 1 for the side that faces
 * `ref`, -1 for the other.
 */
export function thighFolds(W, hip, knee, ref, seed = 1, inner = 1, loose = false) {
  const f = along(hip, knee, ref);
  const r = wobble(seed);
  const j = () => (r() - 0.5) * 0.06;
  const at = ([t, c]) => [t, c * inner];
  let d = "";
  // The fan from the crotch. Loose trousers hang in fewer, softer folds.
  const fan = [
    [[0.16, 9.0], [0.62, 2.0], 0.85],
    [[0.24, 6.2], [0.78, -1.2], 0.75],
    [[0.12, 3.2], [0.52, -4.6], 0.65],
  ];
  for (const [a, b, w] of loose ? fan.slice(0, 2) : fan) {
    d += inFrame(W, f, at([a[0] + j(), a[1]]), at([b[0] + j(), b[1]]), w + r() * 0.2, inner * (r() - 0.3), 0.35 + r() * 0.15);
  }
  // Shade along the inside of the thigh, short strokes that follow it.
  const shade = [
    [[0.4, 9.8], [0.84, 7.4]],
    [[0.5, 8.4], [0.9, 6.6]],
    [[0.62, 7.0], [0.92, 5.6]],
  ];
  for (const [a, b] of loose ? shade.slice(0, 1) : shade) {
    d += inFrame(W, f, at([a[0] + j(), a[1]]), at([b[0] + j(), b[1]]), 0.55 + r() * 0.15, 0, 0.5);
  }
  // A short fold at the top of the outside, where the cloth comes off the hip.
  d += inFrame(W, f, at([0.04, -10.2]), at([0.26 + j(), -7.6]), 0.6, 0, 0.4);
  return d;
}

/**
 * The folds the stance pulls up from the crotch into the front of the trousers:
 * a fan of strokes from the crotch `c` toward the hips and the waist, with `up`
 * and `fwd` the way up the body and forward on the piste.
 */
export function crotchFan(W, c, up, fwd, seed = 14, count = 4) {
  const r = wobble(seed);
  const at = (u, v) => add(add(c, mul(up, u)), mul(fwd, v));
  let d = "";
  for (const [[u0, v0], [u1, v1], w] of [
    [[2.2, 1.4], [10.6, 9.0], 0.85],
    [[3.0, -0.4], [12.6, 2.2], 0.7],
    [[2.0, -2.0], [9.4, -7.2], 0.75],
    [[1.2, 3.2], [4.8, 12.6], 0.6],
  ].slice(0, count)) {
    const a = at(u0, v0);
    const b = at(u1 + (r() - 0.5) * 1.4, v1 + (r() - 0.5) * 1.4);
    d += stroke(W, [a, add(lerp(a, b, 0.5), mul(fwd, (r() - 0.5) * 1.2)), b], w, 0.3 + r() * 0.15);
  }
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
    d += stroke(W, [f.at(t0, c0), mid, f.at(t1, c1)], 0.6 + r() * 0.2, 0.4);
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
    d += stroke(W, [a, f.at((s + 0.7) / 20, c * 0.7 + (r() - 0.5)), b], 0.6, 0.45);
  });
  return d;
}

/**
 * The pouch of cloth that hangs over the band below the knee: two folds that
 * sweep across it, and under it, where it overhangs the band, a row of short
 * strokes of shade.
 */
export function kneeFolds(W, knee, shin, ref, seed = 2) {
  const f = along(knee, add(knee, mul(shin, 20)), ref);
  const r = wobble(seed);
  // Centimetres down the shin from the knee, and out from it.
  const at = (s, c) => [s / 20, c];
  let d = "";
  d += inFrame(W, f, at(0.6, 9.4), at(4.6, -6.4), 0.75 + r() * 0.2, 1.2, 0.4);
  d += inFrame(W, f, at(4.4, 9.8), at(7.4, -2.6), 0.65 + r() * 0.2, 1.0, 0.45);
  for (const c of [8.6, 6.0, 3.4, 0.8, -1.8, -4.4, -6.8]) {
    const s = 8.6 + r() * 0.8 - Math.abs(c) * 0.06;
    d += inFrame(W, f, at(s, c), at(11.2, c * 0.96), 0.55 + r() * 0.15, 0, 0.5);
  }
  return d;
}

/**
 * The stocking: strokes of shade down the inside of the calf, the side that
 * faces the other leg (`inner`, as for the thigh), and wrinkles where it
 * gathers over the shoe.
 */
export function sockWrinkles(W, from, ankle, ref, seed = 3, inner = 1) {
  const f = along(from, ankle, ref);
  const r = wobble(seed);
  let d = "";
  for (const [c, t1] of [[4.6, 0.72], [3.4, 0.6], [2.2, 0.44], [1.0, 0.3]]) {
    d += inFrame(W, f, [0.03 + r() * 0.04, c * inner], [t1 + r() * 0.06, c * inner * 0.8], 0.6 + r() * 0.15, 0, 0.4);
  }
  for (let i = 0; i < 3; i++) {
    const t = 0.7 + i * 0.09 + r() * 0.03;
    d += stroke(W, [f.at(t, 3.6 - r()), f.at(t + 0.02, 0.4), f.at(t + 0.045, -3.6 + r())], 0.5 + r() * 0.2, 0.5);
  }
  return d;
}

/** Loose trousers gathered at the ankle: short curved strokes above the cuff, and two long folds down the shin. */
export function cuffGathers(W, ankle, su, ref, seed = 3) {
  const f = along(add(ankle, mul(su, -30)), ankle, ref);
  const r = wobble(seed);
  let d = "";
  for (let i = 0; i < 4; i++) {
    const t = 0.66 + i * 0.075 + r() * 0.02;
    d += stroke(W, [f.at(t, 5.8 - r()), f.at(t + 0.018, 0.6), f.at(t + 0.034, -5.6 + r())], 0.55 + r() * 0.2, 0.5);
  }
  d += stroke(W, [f.at(0.2, 3.6), f.at(0.45, 4.2), f.at(0.62, 3.4)], 0.6, 0.5);
  d += stroke(W, [f.at(0.14, -4.4), f.at(0.42, -4.8), f.at(0.6, -4.0)], 0.6, 0.5);
  return d;
}

/**
 * The creases of a jersey, each a stroke laid on its surface: a fan from each
 * armpit, where the sleeve pulls the cloth; a fold across the chest; and the
 * cloth bloused over the belt, gathered in short strokes above it. `at(up, v)`
 * is a point of the jersey: `up` cm above the hips, and `v` across from the
 * back, -1, to the front, 1. An older man has the folds of a belly.
 */
export function torsoFolds(at, seed = 4, older = false) {
  const r = wobble(seed);
  const page = (q) => q;
  // A stroke through points given as [up, v], bowed a little to one side.
  const crease = (points, width = 0.5, bow = 0.5) => {
    const [a, b] = [points[0], points[points.length - 1]];
    const mid = points.length > 2 ? points[1] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bow * 0.08];
    return stroke(page, [at(...a), at(...mid), at(...b)], width + r() * 0.15, 0.35 + r() * 0.2);
  };
  let d = "";
  // From the armpit of the sword arm, at the front, down into the chest.
  for (const [u1, v1] of [[35.0, 0.74], [37.4, 0.62], [39.6, 0.56]]) d += crease([[42.6, 0.95], [u1, v1]], 0.6, 0.4);
  // From the armpit of the arm nearer the camera, at the back.
  for (const [u1, v1] of [[35.6, -0.36], [38.2, -0.26]]) d += crease([[42.0, -0.6], [u1, v1]], 0.55, -0.4);
  // The cloth bloused over the belt.
  for (const v of [-0.72, -0.44, -0.16, 0.12, 0.4, 0.66]) {
    const top = HEM + 6.4 + r() * 3.2;
    d += crease([[top, v + (r() - 0.5) * 0.08], [HEM + 1.8, v * 1.03]], 0.55, (r() - 0.5) * 2);
  }
  if (older) {
    // The weight of a belly: folds that hang across it, and the shadow below.
    d += crease([[HEM + 4.4, -0.1], [HEM + 3.4, 0.5], [HEM + 4.6, 0.96]], 0.8);
    d += crease([[HEM + 8.2, 0.2], [HEM + 7.2, 0.62], [HEM + 8.6, 0.94]], 0.6);
  }
  return d;
}

/**
 * A heavier line along the hem, where the jersey meets the waistband, and below
 * it the trousers gathered into the band: short strokes hanging from it.
 */
export function waistband(at) {
  const page = (q) => q;
  let d = stroke(page, [at(HEM + 1.4, -0.96), at(HEM + 0.4, 0.0), at(HEM + 1.6, 0.96)], 1.1, 0.5);
  for (const [v, length] of [[-0.62, 4.4], [-0.34, 5.6], [-0.06, 4.0], [0.22, 5.2], [0.5, 3.8]]) {
    d += stroke(page, [at(HEM - 0.6, v), at(HEM - 0.6 - length * 0.5, v * 1.02), at(HEM - 0.6 - length, v * 0.98)], 0.6, 0.4);
  }
  return d;
}

/**
 * Folds in a sleeve: a fan drawn in toward the inside of the bend at the elbow
 * from along both arms, strokes of shade along the underside of the upper arm
 * near the armpit, and the heavier line along the underside of the forearm.
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
    const c = side * (3.6 - i * 0.7);
    const a = fore.at(0.3 + i * 0.12, c * 1.4);
    const b = lerp(elbow, a, 0.16);
    d += stroke(W, [a, add(lerp(a, b, 0.5), mul(fore.n, side * 0.8)), b], 0.6 + r() * 0.3, 0.45);
  }
  for (let i = 0; i < 2; i++) {
    const a = up.at(0.62 + i * 0.12, side * (3.8 - i * 0.8));
    d += stroke(W, [a, lerp(a, elbow, 0.5), lerp(elbow, a, 0.14)], 0.6, 0.45);
  }
  // Shade under the upper arm, near the armpit.
  for (const [t0, t1, c] of [[0.12, 0.46, -5.4], [0.16, 0.38, -4.2]]) {
    d += stroke(W, [up.at(t0, c), up.at((t0 + t1) / 2, c - 0.3), up.at(t1, c + 0.2)], 0.65, 0.45);
  }
  // The heavier line under the forearm.
  d += stroke(W, [fore.at(0.18, -5.4), fore.at(0.55, -5.0), fore.at(0.94, -4.2)], 1.2, 0.5);
  return d;
}

/**
 * The strokes on the floor under a foot: long, light, and shorter on the far
 * side. A foot turned across, `span` being how far either side of the ankle it
 * reaches, has them all round it instead.
 */
export function groundStrokes(W, ankle, front, seed = 7, k = 1, span) {
  const r = wobble(seed);
  const x = ankle[0];
  if (span) {
    const middle = x + (span[0] + span[1]) / 2;
    const half = (span[1] - span[0]) / 2;
    const [a, b, c] = [9 + r() * 3, 4, -1 - r() * 3].map((margin) => (half + margin) * k);
    return [
      stroke(W, [[middle - a, -1.3], [middle + a * 0.1, -1.6], [middle + a + 3 + r() * 4, -1.1]], 1.0, 0.4),
      stroke(W, [[middle - b, -3.0], [middle, -3.2], [middle + b, -2.9]], 0.8, 0.45),
      stroke(W, [[middle - c, -4.5], [middle + c * 0.1, -4.6], [middle + c - 2, -4.3]], 0.6, 0.5),
    ].join("");
  }
  const reach = (front ? 24 : 15) * k;
  return [
    stroke(W, [[x - 17 - r() * 3, -1.3], [x + reach * 0.6, -1.6], [x + reach + 6 + r() * 4, -1.1]], 1.0, 0.4),
    stroke(W, [[x - 11, -3.0], [x + reach * 0.5, -3.2], [x + reach + 2, -2.9]], 0.8, 0.45),
    stroke(W, [[x - 6 - r() * 3, -4.5], [x + reach * 0.3, -4.6], [x + reach - 3, -4.3]], 0.6, 0.5),
  ].join("");
}
