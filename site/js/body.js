// The body of a fencer, part by part, as pen-and-ink path data. Every builder is
// given the joints of a pose (in centimetres, from skeleton() in figure.js) and
// `W`, which sets a point on the piste and turns it for the camera, and gives
// back `{ g, d, k }`: the shapes that make the silhouette, the thin lines, and
// the brush strokes.
import { chestHatch, hemShadow, kneeFolds, sleeveFolds, sockWrinkles, thighFolds } from "./folds.js";
import { add, blob, brush, dist, line, mul, perp, pt, rotate, sub, unit } from "./ink.js";
import { headParts, shoeParts } from "./parts.js";

/**
 * A limb segment from `a` to `b`, as the points of a smooth shape: rounded at
 * both ends, and as far from the bone as `hi` says on the side that faces `ref`
 * and `lo` says on the other, sampled evenly along it.
 */
export function segment(a, b, hi, lo, ref = [1, 0], caps = [1, 1]) {
  const u = unit(a, b);
  let n = perp(u);
  if (n[0] * ref[0] + n[1] * ref[1] < 0) n = mul(n, -1);
  const length = dist(a, b);
  const last = hi.length - 1;
  const at = (t) => add(a, mul(u, length * t));
  const end = (p, dir, h, l, cap) => {
    const r = (h + l) / 2;
    const lift = (h - l) / 2;
    return [
      add(add(p, mul(dir, r * 0.78 * cap)), mul(n, h * 0.8)),
      add(add(p, mul(dir, r * cap)), mul(n, lift * 0.3)),
      add(add(p, mul(dir, r * 0.78 * cap)), mul(n, -l * 0.8)),
    ];
  };
  const points = [];
  for (let i = 0; i <= last; i++) points.push(add(at(i / last), mul(n, hi[i])));
  points.push(...end(b, u, hi[last], lo[last], caps[1]));
  for (let i = last; i >= 0; i--) points.push(add(at(i / last), mul(n, -lo[i])));
  points.push(...end(a, mul(u, -1), hi[0], lo[0], caps[0]).reverse());
  return points;
}

/** A point of a frame: `o` plus `x` along `axis` and `y` to its left. */
export function place(o, axis, x, y) {
  const n = perp(axis);
  return [o[0] + axis[0] * x + n[0] * y, o[1] + axis[1] * x + n[1] * y];
}

// ---------- The trunk ----------

// The jersey from the side, in the torso's frame: [along the spine from the
// hips, forward], from the hem up the front and down the back.
const JERSEY = [
  [9, 14.8],
  [21, 16.0],
  [33, 17.0],
  [44, 16.6],
  [52.5, 13.6],
  [58.5, 6.6],
  [60.5, -3.8],
  [56.5, -11.4],
  [49, -16.4],
  [38, -17.8],
  [24, -17.6],
  [11, -16.2],
  [7.6, -7.4],
  [7.4, 3.6],
];

/**
 * The jersey, the neck and the roll collar. `T(a, b)` is a point of the torso's
 * frame, `older` gives a heavier man.
 */
export function trunk(J, W, older) {
  const T = (a, b) => W(J.T(a, b));
  const belly = older ? 1.8 : 0;
  const shape = JERSEY.map(([a, b]) => T(a, a < 40 && b > 0 ? b + belly : b));
  const neck = segment(J.T(60, 0.2), J.T(71, 1.4), [4.8, 4.4], [5.6, 5.2], J.f);
  const collar = segment(J.T(57.5, 0.3), J.T(65.5, 0.9), [5.9, 5.6, 5.2], [6.9, 6.4, 6.0], J.f, [0.3, 0.3]);
  const g = blob(shape) + blob(neck.map(W)) + blob(collar.map(W));
  // The seams of the collar, and a fold of cloth where it meets the shoulder.
  const d =
    line([T(66.4, 2.4), T(63.0, 1.2), T(60.4, 0.6)]) +
    line([T(66.0, -1.2), T(62.6, -0.6), T(60.2, -0.4)]) +
    line([T(58.2, -6.6), T(57.6, -0.4), T(58.4, 5.4)]) +
    line([T(64.6, -5.8), T(64.2, 0.2), T(65, 5.0)]) +
    line([T(11.2, 14.8), T(10.4, 6), T(10, -4), T(10.8, -14.4)]);
  // The shadow the jaw throws on the neck.
  const jaw = brush([T(66.6, 4.2), T(65.2, 0.6), T(64.4, -3.6)].map(W), 1.5, 0.5);
  return { g, d, k: hemShadow(W, J.T) + chestHatch(W, J.T) + jaw };
}

// ---------- Arms ----------

/**
 * The sword arm: a long sleeve, the cuff of a gauntlet, and the fist round the
 * grip. `fist` are the fist's points in the frame of the forearm.
 */
export function swordArm(J, W, fist) {
  const fu = unit(J.el, J.hn);
  const wrist = sub(J.hn, mul(fu, 11.5));
  const up = [0, 1];
  const upper = segment(J.sh, J.el, [7.4, 6.9, 6.2], [7.4, 6.9, 6.2], up);
  const fore = segment(J.el, wrist, [6.0, 5.4, 4.9, 4.5], [6.0, 5.4, 4.9, 4.5], up);
  // The gauntlet, flaring a little from the wrist, with its seam where it meets the fist.
  const cuff = segment(sub(J.hn, mul(fu, 15.5)), sub(J.hn, mul(fu, 9.8)), [5.0, 5.3, 5.6], [5.0, 5.3, 5.6], up, [0.2, 0.2]);
  const hand = fist.shape.map(([x, y]) => W(place(J.hn, fu, x, y)));
  const g = [upper, fore, cuff].map((s) => blob(s.map(W))).join("") + blob(hand);
  const d = fist.lines.map((l) => line(l.map(([x, y]) => W(place(J.hn, fu, x, y))))).join("");
  return { g, d, k: sleeveFolds(W, J.sh, J.el, sub(J.hn, mul(fu, 15.5)), 6) };
}

/** The rear arm, bent, with the hand on the hip. */
export function rearArm(J, W, hand) {
  const qu = unit(J.re, J.rh);
  const up = [0, 1];
  const upper = segment(J.rs, J.re, [6.6, 6.2, 5.8], [6.6, 6.2, 5.8], up);
  const fore = segment(J.re, J.rh, [5.6, 5.0, 4.4], [5.6, 5.0, 4.4], up);
  const palm = hand.shape.map(([x, y]) => W(place(J.rh, qu, x, y)));
  const g = [upper, fore].map((s) => blob(s.map(W))).join("") + blob(palm);
  const d = hand.lines.map((l) => line(l.map(([x, y]) => W(place(J.rh, qu, x, y))))).join("");
  return { g, d, k: sleeveFolds(W, J.rs, J.re, J.rh, 8) };
}

// ---------- Legs ----------

/**
 * A shoe set on the ankle `ank`: turned up at the toe by `tilt` degrees (a foot
 * lifted from the floor lands on its heel), and `length` of the way to its full
 * length forward, since a foot turned across is seen short. The points of the
 * shape, the thin lines on it, in centimetres.
 */
export function shoe(ank, tilt, length, parts) {
  const set = ([x, y]) => {
    const r = rotate([x > 0 ? x * length : x, y], tilt);
    return [ank[0] + r[0], ank[1] + r[1]];
  };
  return {
    shape: parts.shape.map(set),
    lines: [parts.sole, parts.heel, parts.cap, ...parts.laces].map((l) => l.map(set)),
  };
}

/**
 * One leg in knickerbockers: the baggy thigh, the pouch of cloth that hangs
 * over the band below the knee, the long stocking with its calf, and the shoe.
 * `seat` also gives the leg the hips and seat, for the leg nearer the camera.
 * Returns the silhouette's points and the lines drawn inside it, as point lists
 * of the piste.
 */
function legShapes(J, ank, kn, { seat, tilt, length, parts, older }) {
  const f = [1, 0];
  const tu = unit(J.hip, kn);
  const su = unit(kn, ank);
  const k = (t) => add(kn, mul(su, t));
  const top = add(J.hip, mul(tu, -1));
  const shapes = [];
  const lines = [];
  if (older) {
    // Loose trousers, gathered at the ankle in a cuff.
    shapes.push(segment(top, kn, [13.2, 13.4, 11.8, 9.6], [12.6, 12.4, 10.8, 9.2], f));
    shapes.push(segment(kn, add(ank, mul(su, -5)), [9.4, 8.8, 7.8, 6.8], [8.8, 8.2, 7.4, 6.4], f));
    shapes.push(segment(add(ank, mul(su, -7)), add(ank, mul(su, 1)), [7.4, 6.4, 6.6], [7.4, 6.4, 6.6], f, [0.2, 0.5]));
    lines.push(across(add(ank, mul(su, -7.4)), su, 7.4, 7.2, 0.8));
  } else {
    shapes.push(segment(top, kn, [14.8, 15.4, 14.2, 11.6], [14.2, 14.4, 12.6, 10.2], f));
    shapes.push(segment(kn, k(12), [12.0, 11.8, 10.4, 8.0], [9.6, 9.0, 8.0, 7.0], f));
    shapes.push(segment(k(10.5), add(ank, mul(su, 2)), [6.8, 6.8, 5.6, 4.4, 3.8], [6.6, 7.4, 5.8, 4.2, 3.7], f, [0.2, 0.4]));
    // The lower edge of the cloth over the band, and the band itself.
    lines.push(across(k(11.6), su, 9.4, 7.6, 1.8));
    lines.push(across(k(14.2), su, 6.8, 6.8, 0.6));
  }
  if (seat) shapes.push(seatShape(J));
  const foot = shoe(ank, tilt, length, parts);
  return { shapes, foot, lines };
}

// A line across a leg at `c`, from `hi` out on the side that faces forward to
// `lo` on the other, bowed down along `su` by `bow`.
function across(c, su, hi, lo, bow) {
  let n = perp(su);
  if (n[0] < 0) n = mul(n, -1);
  const front = add(c, mul(n, hi));
  const back = add(c, mul(n, -lo));
  const mid = add(lerp2(front, back), mul(su, bow));
  return [front, mid, back];
}

function lerp2(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// The hips and seat, as a shape in the torso's frame: no wider than the hem at
// the top, fuller below it.
function seatShape(J) {
  return [
    [9, 13.8],
    [3, 15.6],
    [-5, 14.2],
    [-11.5, 6],
    [-11.5, -4],
    [-5, -12.8],
    [2, -16.8],
    [9, -15.6],
  ].map(([a, b]) => J.T(a, b));
}

/**
 * A leg, ready to draw: its silhouette, the thin lines on it, and the brush
 * strokes of its folds. A foot lifted from the floor is turned up at the toe, as
 * one lands on its heel, and the foot behind is turned across, so it is seen
 * short.
 */
export function legPart(J, W, ank, kn, { front, seat, older }) {
  const tilt = front ? Math.min(30, Math.max(0, (ank[1] - 8) * 2.1)) : 0;
  const made = legShapes(J, ank, kn, { seat, tilt, length: front ? 1 : 0.62, parts: shoeParts(), older });
  const set = (points) => points.map(W);
  const su = unit(kn, ank);
  const seed = front ? 11 : 21;
  const ref = [1, 0];
  const stocking = add(kn, mul(su, 8.5));
  const folds =
    thighFolds(W, J.hip, kn, ref, seed) + sockWrinkles(W, stocking, ank, ref, seed + 2) + (older ? "" : kneeFolds(W, kn, su, ref, seed + 1));
  return {
    g: made.shapes.map((shape) => blob(set(shape))).join("") + blob(set(made.foot.shape)),
    d: [...made.lines, ...made.foot.lines].map((l) => line(set(l))).join(""),
    k: folds,
  };
}

// ---------- Head and sabre ----------

/** The head in profile: the face, the hair, the ear and the marks of the features. */
export function headPart(J, W, older) {
  const lean = (J.lean * 0.35 * Math.PI) / 180;
  const hf = [Math.cos(lean), -Math.sin(lean)];
  const hu = [Math.sin(lean), Math.cos(lean)];
  const parts = headParts(older);
  // A point in the head's own frame, set on the body and turned for the camera.
  const H = (q) => W([J.hd[0] + hf[0] * q[0] + hu[0] * q[1], J.hd[1] + hf[1] * q[0] + hu[1] * q[1]]);
  const Hs = (list) =>
    list.map((q) => {
      const o = H(q);
      return q.length > 2 ? [o[0], o[1], q[2]] : o;
    });
  const mark = (m) => brush(m.slice(0, 3).map(H), m[3], 0.5);
  const face = parts.face;
  return {
    g: blob(Hs(parts.skull)),
    hair: blob(Hs(parts.hair)),
    s: parts.streaks.map((streak) => brush(streak.map(H), 0.7, 0.5)).join(""),
    d: line(Hs(parts.ear)) + line(Hs(parts.earFold)) + line(Hs(face.cheek.slice(0, 3))),
    k: [face.brow, face.eye, face.lid, face.nostril, face.mouth].map(mark).join("") + parts.tufts.map((tuft) => brush(tuft.map(H), 0.9, 0.35)).join(""),
  };
}

/**
 * The sabre: a tapered blade, a small bell guard in dark steel, and the knuckle
 * bow from the cup back under the fist. They are worked out after projection, so
 * the guard stays an oval across the blade.
 */
export function bladePart(J, W) {
  const b0 = W(J.at(5));
  const b1 = W(J.tip);
  const cc = W(J.at(3));
  const along = unit(b0, b1);
  const across = perp(along);
  const taper = (a, b, w0, w1) => {
    const n = perp(unit(a, b));
    return `M${[add(a, mul(n, w0)), add(b, mul(n, w1)), sub(b, mul(n, w1)), sub(a, mul(n, w0))].map(pt).join("L")}Z`;
  };
  const cup = Array.from({ length: 14 }, (_, i) => {
    const t = (i / 14) * Math.PI * 2;
    return add(cc, add(mul(along, 2.3 * Math.cos(t)), mul(across, 5.8 * Math.sin(t))));
  });
  // The bow, in the frame of the forearm, which is how the fist is set.
  const forearm = unit(J.el, J.hn);
  const bow = [[0.4, -5.2], [-3.6, -6.8], [-8.6, -6.4], [-11.4, -4.4]].map(([x, y]) => W(place(J.hn, forearm, x, y)));
  return { k: taper(b0, b1, 0.75, 0.2), g: `M${cup.map(pt).join("L")}Z`, d: line(bow) };
}
