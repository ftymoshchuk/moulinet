// The body of a fencer, part by part, as pen-and-ink path data. Every builder is
// given the joints of a pose (in centimetres, from skeleton() in figure.js) and
// `W`, which sets a point on the piste and turns it for the camera, and gives
// back `{ g, d, k }`: the shapes that make the silhouette, the thin lines, and
// the brush strokes.
import { crotchFolds, cuffGathers, kneeFolds, kneePuckers, sleeveFolds, sockWrinkles, thighFolds, torsoFolds, waistband } from "./folds.js";
import { add, blob, brush, dist, lerp, line, mul, perp, pt, ribbon, rotate, solid, sub, unit } from "./ink.js";
import { headParts, shoeAcrossParts, shoeParts, torsoParts } from "./parts.js";

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

// A list of shapes as the shapes themselves, `g`, and the line of ink round them, `o`.
function drawn(list, thin, thick) {
  return { g: list.map((points) => blob(points)).join(""), o: list.map((points) => ribbon(points, thin, thick)).join("") };
}

/** A point of a frame: `o` plus `x` along `axis` and `y` to its left. */
export function place(o, axis, x, y) {
  const n = perp(axis);
  return [o[0] + axis[0] * x + n[0] * y, o[1] + axis[1] * x + n[1] * y];
}

// ---------- The trunk ----------

const RAD = Math.PI / 180;

/**
 * The jersey as the camera sees it. Each slice of `rows` is an ellipse across the
 * body, with the chest facing along `f` and the shoulders along `l`, in three
 * dimensions: the camera sees as far to the front and back as the ellipse
 * reaches along its way of looking. Returns `slice(up)`, the front-most and
 * back-most points of the slice `up` cm above the hips, as points of the page.
 */
function torsoSlices(J, W, rows) {
  const lean = J.lean * RAD;
  const turn = J.turn * RAD;
  const look = W.camera * RAD;
  const f = [Math.cos(turn) * Math.cos(lean), -Math.cos(turn) * Math.sin(lean), Math.sin(turn)];
  const l = [-Math.sin(turn) * Math.cos(lean), Math.sin(turn) * Math.sin(lean), Math.cos(turn)];
  const ce = Math.cos(look);
  const se = Math.sin(look);
  const fe = f[0] * ce + f[2] * se;
  const le = l[0] * ce + l[2] * se;
  // The shape of the slice at any height, between the rows or beyond them.
  const shape = (up) => {
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] < up) i++;
    const [a0, ...p0] = rows[i];
    const [a1, ...p1] = rows[i + 1];
    const k = (up - a0) / (a1 - a0);
    return p0.map((v, j) => v + (p1[j] - v) * k);
  };
  return (up) => {
    const [mid, depth, width] = shape(up);
    const u = J.hip[0] * ce + (J.u[0] * up + f[0] * mid) * ce + f[2] * mid * se;
    const y = J.hip[1] + J.u[1] * up + f[1] * mid;
    const A = depth * fe;
    const B = width * le;
    const reach = Math.hypot(A, B);
    const at = Math.atan2(B, A);
    // The lean tips the slice, so its extremes are not at quite the same height.
    const tip = depth * Math.cos(at) * f[1] + width * Math.sin(at) * l[1];
    return { front: W.flat([u + reach, y + tip]), back: W.flat([u - reach, y - tip]) };
  };
}

/**
 * The jersey's shape as the camera sees it: its slices, and `across(up, v)`, a
 * point on it `up` cm above the hips and across from the back, -1, to the front, 1.
 */
export function torsoFrame(J, W, older) {
  const rows = torsoParts(older);
  const slice = torsoSlices(J, W, rows);
  const across = (up, v) => {
    const { front, back } = slice(up);
    return lerp(back, front, (v + 1) / 2);
  };
  return { rows, slice, across };
}

/**
 * The jersey, the neck and the roll collar. `T(a, b)` is a point of the torso's
 * frame, `older` gives a heavier man.
 */
export function trunk(J, W, older, frame = torsoFrame(J, W, older)) {
  const T = (a, b) => W(J.T(a, b));
  const { rows, slice, across } = frame;
  // Up the front, down the back, with corners at the hem.
  const front = rows.map(([up]) => slice(up).front);
  const back = rows.map(([up]) => slice(up).back).reverse();
  front[0] = [...front[0], 1];
  back[back.length - 1] = [...back[back.length - 1], 1];
  const [headUp, headForward] = older ? OLDER_HEAD : YOUNGER_HEAD;
  const neck = older
    ? segment(J.T(58, 0.2), J.T(headUp - 2.6, headForward - 0.2), [6.0, 5.6], [6.8, 6.4], J.f)
    : segment(J.T(58, 0.2), J.T(headUp - 2.6, headForward - 0.2), [5.4, 5.0], [6.2, 5.8], J.f);
  const collar = segment(J.T(54.5, 0.3), J.T(62.6, 1.0), [6.1, 5.8, 5.5], [7.0, 6.6, 6.3], J.f, [0.3, 0.3]);
  // The hem is not ruled across: it hangs a little lower in the middle, as the belt goes round the body.
  const hem = lerp(front[0], back[back.length - 1], 0.5);
  const jersey = [...front, ...back, [hem[0], hem[1] + 1.3]];
  const body = drawn([jersey]);
  const throat = drawn([neck.map(W), collar.map(W)], 0.16, 0.4);
  const shapes = { g: body.g + throat.g, o: body.o + throat.o };
  // The roll of the collar: the line where it turns over.
  const d = line([T(59.4, -5.4), T(59.9, 0.1), T(59.0, 5.3)]);
  // The shadow the jaw throws on the neck.
  const jaw = brush([T(headUp - 8.8, headForward + 2.2), T(headUp - 10, headForward - 1.6), T(headUp - 10.8, headForward - 5.8)].map(W), 1.5, 0.5);
  return { ...shapes, d, k: torsoFolds(across, 4, older) + waistband(across) + jaw };
}

// ---------- Arms ----------

/**
 * The sword arm: a long sleeve, the cuff of a gauntlet, and the fist round the
 * grip. `fist` are the fist's points in the frame of the forearm.
 */
export function swordArm(J, W, fist) {
  // The arm lies in a plane, at its shoulder's distance from the camera.
  const Wa = (q) => W([q[0], q[1], J.sh[2]]);
  const fu = unit(J.el, J.hn);
  const wrist = sub(J.hn, mul(fu, 12.5));
  const up = [0, 1];
  // The sleeve is full above the elbow and at the forearm's top, and tapers to the wrist.
  const upper = segment(J.sh, J.el, [5.8, 6.2, 6.2, 5.6], [5.4, 5.8, 5.9, 5.3], up, [0.55, 1]);
  const fore = segment(J.el, wrist, [5.9, 5.1, 4.3, 3.8], [5.5, 4.8, 4.1, 3.7], up);
  // The gauntlet, flaring a little from the wrist, with its seam where it meets the fist.
  const cuff = segment(sub(J.hn, mul(fu, 17.0)), sub(J.hn, mul(fu, 10.6)), [5.2, 5.7, 6.2], [5.2, 5.7, 6.2], up, [0.2, 0.2]);
  const hand = fist.shape.map(([x, y]) => Wa(place(J.hn, fu, x, y)));
  const shapes = drawn([...[upper, fore, cuff].map((s) => s.map(Wa)), hand]);
  const d = fist.lines.map((l) => line(l.map(([x, y]) => Wa(place(J.hn, fu, x, y))))).join("");
  return { ...shapes, d, k: sleeveFolds(Wa, J.sh, J.el, sub(J.hn, mul(fu, 17.0)), 6) };
}

/**
 * The rear arm, bent, with the hand on the hip. The sleeve begins on the jersey,
 * at the top of the shoulder, so the shoulder is the jersey's own and not a
 * tube set on it.
 */
export function rearArm(J, W, hand, frame = torsoFrame(J, W, false)) {
  const Wa = (q) => W([q[0], q[1], J.rs[2]]);
  const qu = unit(J.re, J.rh);
  const up = [0, 1];
  const hi = [5.9, 6.4, 6.5, 6.0];
  const lo = [5.3, 5.8, 6.0, 5.5];
  const tube = segment(J.rs, J.re, hi, lo, up, [0, 1]);
  const n = hi.length;
  // Down the outer side of the arm, round the elbow, and back up the inner side...
  const outline = tube.slice(1, 2 * n + 3).map(Wa);
  // ...to where the sleeve is sewn to the jersey, up the armhole to the top of the shoulder.
  const { across } = frame;
  // Along the jersey's own edge the sleeve has no line, and nor has its seam.
  const on = (p) => [p[0], p[1], 0, 0];
  const seam = (p) => [p[0], p[1], 0, 0];
  const sleeve = [on(across(54.2, -0.97)), on(across(52.4, -1)), on(across(50.4, -1)), ...outline.slice(1), seam(across(43, -0.62)), seam(across(47, -0.86))];
  const fore = segment(J.re, J.rh, [6.2, 5.2, 4.3, 3.6], [5.8, 4.9, 4.1, 3.5], up);
  const palm = hand.shape.map(([x, y]) => Wa(place(J.rh, qu, x, y)));
  // The point of the elbow, rounded, on the outside of the bend.
  const e = Wa(J.re);
  const toward = add(unit(e, Wa(J.rs)), unit(e, Wa(J.rh)));
  const outward = Math.hypot(...toward) < 0.2 ? perp(unit(e, Wa(J.rs))) : mul(unit([0, 0], toward), -1);
  const side = perp(outward);
  const elbow = [add(add(e, mul(outward, 2.2)), mul(side, 5.2)), add(e, mul(outward, 6.0)), add(add(e, mul(outward, 2.2)), mul(side, -5.2)), add(e, mul(outward, -2))];
  const shapes = drawn([sleeve, fore.map(Wa), palm, elbow]);
  const d = hand.lines.map((l) => line(l.map(([x, y]) => Wa(place(J.rh, qu, x, y))))).join("");
  return { ...shapes, d, k: sleeveFolds(Wa, J.rs, J.re, J.rh, 8) };
}

// ---------- Legs ----------

/**
 * A shoe seen from the side, set on the ankle `ank` and turned up at the toe by
 * `tilt` degrees (a foot lifted from the floor lands on its heel). The points of
 * the shape, the thin lines on it, in centimetres.
 */
export function shoe(ank, tilt, parts) {
  // A point that keeps only part of its line (a fourth item) keeps that on the way.
  const set = ([x, y, corner, weight]) => {
    const r = rotate([x, y], tilt);
    const q = [ank[0] + r[0], ank[1] + r[1]];
    return weight === undefined ? q : [q[0], q[1], corner, weight];
  };
  return {
    shape: parts.shape.map(set),
    lines: [parts.sole, parts.cap, ...parts.laces].map((l) => l.map(set)),
    ink: parts.ink.map((shape) => shape.map(set)),
    hatch: parts.hatch.map((stroke) => stroke.map(set)),
  };
}

// How closely the shoe follows the highest of its domes where they meet: the higher, the closer.
const BLEND = 8;
// How many stretches the outline over the top of the shoe is made of.
const OUTLINE = 14;
// How high above the floor the cloth of loose trousers comes down over the shoe: an ankle's height, less a centimetre.
const HEM = 7;

/**
 * The shoe of the foot behind, which is turned across the piste with its toe at
 * the camera, as it is seen on the page. The way it is turned from straight at
 * the camera is `turn` in parts.js, and the camera turns it on from there.
 *
 * Each dome of the shoe is a superellipsoid standing on the floor. A level
 * camera sees one as half a superellipse of the same squareness: as high as the
 * dome, and as wide as its footprint reaches across the page, which is the
 * support of the footprint, `(|wide a|^q + |half b|^q)^(1/q)` for the dual
 * exponent `q` of its squareness, where `a` and `b` are how far across the page
 * a step across the foot and a step along it go. The shoe is the soft union of
 * those, on a sole a little wider than it.
 *
 * Returns, in page units, the shapes, the thin lines on them and the strokes of
 * shade: the same as the shoe seen from the side, once it is set on the page.
 * An older man's loose trousers hang over the top of the shoe, so its collar and
 * the laces that lie under the cloth are left out.
 */
export function shoeAcross(ank, W, older = false, parts = shoeAcrossParts()) {
  const { domes, left, right, at, page, side, faces, ce } = acrossFrame(ank, W, parts);
  const { height, edge, bow } = parts.sole;
  const middle = (left + right) / 2;
  // Over the top of the shoe, sampled closely where it turns down at either end.
  const over = (x) => domes.reduce((sum, d) => sum + d.seen(x) ** BLEND, 0) ** (1 / BLEND);
  const outline = [[left, 0, 0, 0.5]];
  for (let i = 1; i < OUTLINE; i++) {
    const x = middle - ((right - left) / 2) * Math.cos((Math.PI * i) / OUTLINE);
    outline.push([x, over(x)]);
  }
  // The toe is nearer than the heel, so the underside of the sole bows down.
  outline.push([right, 0, 0, 0.5], [middle, -bow, 0, 0.5]);
  // The sole is a slab a little wider than the shoe, with its corners rounded.
  const [from, to] = [left - edge, right + edge];
  const slab = [
    [from + 0.5, -bow / 2, 0, 0.5],
    [middle, -bow, 0, 0.5],
    [to - 0.5, -bow / 2, 0, 0.5],
    [to, 0.4],
    [to, height - 0.2],
    [to - 0.3, height],
    [from + 0.3, height],
    [from, height - 0.2],
    [from, 0.4],
  ];

  // The edge of the sole, across the front of the shoe.
  const welt = page([[left + 0.4, height], [middle, height - bow / 2], [right - 0.4, height]]);
  // The edge of the shoe where the stocking goes into it, as wide as the stocking looks. An older man's trousers hang over it.
  const { wide, ends, middle: dip } = parts.collar;
  const collar = older ? [] : [page([[-wide * ce, ends], [0, dip], [wide * ce, ends]])];
  // The laces cross the instep where it is highest along the middle of the foot, and those under the cloth are not seen.
  const ridge = (along) => domes.reduce((sum, d) => sum + d.along(along) ** BLEND, 0) ** (1 / BLEND);
  const laces = parts.laces.flatMap((along) => {
    const top = ridge(along) - 0.6;
    return older && top > HEM ? [] : [[[-1.9, along, top], [0, along, top + 0.7], [1.9, along, top]].map((q) => at(...q))];
  });
  // The seam of the toe cap goes over the toe box, and is lost where the box turns away.
  const toe = parts.domes[2];
  const seen = visibleRun(archOver(toe, parts.seam, 9).map(([a, h]) => [a, h, faces(toe, a, parts.seam)]));
  const seam = seen.length > 1 ? [seen.map(([a, h]) => at(a, parts.seam, h))] : [];
  // The shade falls on the side of the shoe that is away from the light, which is the right of the page.
  const hatch = parts.hatch.flatMap(([which, across, along, length]) => {
    const dome = parts.domes[which];
    const a = side * across;
    const top = skin(dome, a, along) - 0.5;
    return top > length && faces(dome, a, along) ? [[at(a, along, top), at(a, along, top - length)]] : [];
  });
  return { shapes: [page(outline), page(slab)], lines: [...collar, welt, ...seam, ...laces], ink: [], hatch };
}

/**
 * How far either side of the foot behind, on the piste, its sole reaches from
 * the ankle: so the strokes on the floor go all round it, however the camera
 * turns it.
 */
export function footSpan(W, parts = shoeAcrossParts()) {
  const { left, right } = acrossFrame([0, 8], W, parts);
  // (The camera does not turn beyond 60°, but a span must not run away if it did.)
  const squeeze = Math.max(0.25, Math.cos(W.camera * RAD));
  return [(left - parts.sole.edge) / squeeze, (right + parts.sole.edge) / squeeze];
}

// How high the skin of a dome is above a place on the floor: how far across and along the foot.
function skin([mid, half, wide, high, square], across, along) {
  return high * Math.max(0, 1 - Math.abs(across / wide) ** square - Math.abs((along - mid) / half) ** square) ** (1 / square);
}

// The longest run of points the camera can see, of points that say so as their third item.
function visibleRun(points) {
  let best = [];
  let run = [];
  for (const point of points) {
    run = point[2] ? [...run, point] : [];
    if (run.length > best.length) best = run;
  }
  return best;
}

// The arc over the top of a dome, from one side to the other, where a plane across the foot cuts it: points of [across, up].
function archOver([mid, half, wide, high, square], along, n) {
  const scale = Math.max(0, 1 - Math.abs((along - mid) / half) ** square) ** (1 / square);
  return Array.from({ length: n }, (_, i) => {
    const t = 0.28 + (i / (n - 1)) * (Math.PI - 0.56);
    return [wide * scale * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** (2 / square), high * scale * Math.abs(Math.sin(t)) ** (2 / square)];
  });
}

// The foot behind as the camera sees it, which its shoe and the strokes on the floor round it are set from.
function acrossFrame(ank, W, parts) {
  const look = W.camera * RAD;
  const ce = Math.cos(look);
  const se = Math.sin(look);
  const turn = parts.turn * RAD;
  // How far across the page a step across the foot goes, and a step along it toward the toe.
  const sideways = Math.cos(turn) * ce + Math.sin(turn) * se;
  const lengthways = -Math.sin(turn) * ce + Math.cos(turn) * se;
  const floor = ank[1] - 8;
  const domes = parts.domes.map(([mid, half, wide, high, square]) => {
    const dual = square / (square - 1);
    const centre = mid * lengthways;
    const reach = (Math.abs(wide * sideways) ** dual + Math.abs(half * lengthways) ** dual) ** (1 / dual);
    const rise = (u) => high * Math.max(0, 1 - Math.abs(u) ** square) ** (1 / square);
    return { from: centre - reach, to: centre + reach, seen: (x) => rise((x - centre) / reach), along: (l) => rise((l - mid) / half) };
  });
  // Across the page from the ankle, as far as the camera sees along the piste.
  const set = (x, h) => W.flat([ank[0] * ce + x, floor + h]);
  return {
    domes,
    // Whether the camera sees the skin of a dome at a place across it and along it: the way the skin leans there against the way the camera looks.
    faces: ([mid, half, wide, , square], a, l) => {
      const lean = (u, size) => (Math.sign(u) * Math.abs(u / size) ** (square - 1)) / size;
      return lean(a, wide) * -lengthways + lean(l - mid, half) * sideways > 0;
    },
    left: Math.min(...domes.map((d) => d.from)),
    right: Math.max(...domes.map((d) => d.to)),
    // A point of the shoe as [across, along, up from the floor], on the page.
    at: (a, l, h) => set(a * sideways + l * lengthways, h),
    // Points across the page and up from the floor, as points of the page, keeping what a point says of its line.
    page: (shape) => shape.map(([x, h, ...rest]) => [...set(x, h), ...rest]),
    // The right of the page, where the shade falls, as the way across the foot: +1 for a fencer facing right, -1 for one facing left.
    side: Math.sign(W([1, 0])[0] - W([0, 0])[0]),
    ce,
  };
}

/**
 * One leg in knickerbockers: the baggy thigh, the pouch of cloth that hangs
 * over the band below the knee, and the long stocking with its calf. `seat`
 * also gives the leg the hips and seat, for the leg nearer the camera. Returns
 * the silhouette's points and the lines drawn inside it, as point lists of the
 * piste.
 */
function legShapes(J, ank, kn, { seat, older }) {
  const f = [1, 0];
  const tu = unit(J.hip, kn);
  const su = unit(kn, ank);
  const k = (t) => add(kn, mul(su, t));
  const top = add(J.hip, mul(tu, -1));
  const shapes = [];
  const lines = [];
  // The top of the thigh is round only where the seat is not: a leg without it must not bulge out behind the other.
  const round = seat ? 1 : 0.62;
  if (older) {
    // Loose trousers, one cloth from the hip to the ankle: full at the thigh, narrowing down the shin, and bloused over the shoe in a soft S.
    shapes.push(segment(top, kn, [11.8, 12.6, 13.0, 12.4], [11.4, 12.2, 12.4, 11.6], f, [round, 1]));
    const hi = [12.4, 11.2, 10.0, 9.0, 8.3, 7.9, 7.8, 9.4, 7.4];
    const lo = [11.6, 10.6, 9.5, 8.6, 8.0, 7.7, 7.6, 9.0, 7.0];
    shapes.push(segment(kn, add(ank, mul(su, 1)), hi, lo, f, [0, 0.5]));
    // The hem, where the cloth is gathered over the shoe, from one edge of the leg to the other.
    const at = 1 - 1.2 / (dist(kn, ank) + 1);
    lines.push(across(add(ank, mul(su, -1.2)), su, edge(hi, at) - 0.2, edge(lo, at) - 0.2, 0.7));
  } else {
    // Knickerbockers: close at the hip and full at the knee, where the cloth hangs over the band.
    shapes.push(segment(top, kn, [13.0, 12.8, 12.2, 11.4], [12.6, 12.2, 11.4, 10.6], f, [round, 1]));
    // (It starts square at the knee, inside the round end of the thigh, so the two make one knee.)
    shapes.push(segment(kn, k(12), [11.4, 12.2, 10.6, 8.0], [10.6, 10.6, 8.6, 6.8], f, [0, 1]));
    shapes.push(segment(k(10.5), add(ank, mul(su, 2)), [6.4, 6.9, 5.8, 4.6, 3.9], [6.4, 7.4, 5.8, 4.3, 3.7], f, [0.2, 0.4]));
    // The lower edge of the cloth over the band, and the band itself, each curved round the leg.
    lines.push(across(k(11.6), su, 8.1, 6.7, 3.0));
    lines.push(across(k(14.2), su, 6.3, 6.3, 2.6));
  }
  if (seat) shapes.push(seatShape(J, older));
  return { shapes, lines };
}

// How far out a shape's edge is `t` of the way along it, for the half-widths given at evenly spaced stations.
function edge(widths, t) {
  const at = t * (widths.length - 1);
  const i = Math.min(widths.length - 2, Math.floor(at));
  return widths[i] + (widths[i + 1] - widths[i]) * (at - i);
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
function seatShape(J, older) {
  // Looser trousers hang straight from the waist, so they leave less of a seat.
  const ease = older ? 0.88 : 1;
  return [
    [9, 12.6],
    [3, 14.0],
    [-5, 13.0],
    [-11, 5.5],
    [-11, -3.5],
    [-5, -10.8],
    [2, -12.6],
    [9, -12.8],
  ].map(([a, b]) => J.T(a, b * ease));
}

// The shoe of the foot in front, seen from the side and set on the page by `set`. A foot lifted from the floor lands on its heel, so the toe is turned up.
function shoeInFront(ank, set) {
  const tilt = Math.min(30, Math.max(0, (ank[1] - 8) * 2.1));
  const profile = shoe(ank, tilt, shoeParts());
  return { shapes: [set(profile.shape)], lines: profile.lines.map(set), ink: profile.ink.map(set), hatch: profile.hatch.map(set) };
}

/**
 * A leg, ready to draw: its silhouette, the thin lines on it, and the brush
 * strokes of its folds. The foot in front points at the opponent, seen from the
 * side, and is turned up at the toe when it is lifted from the floor, as one
 * lands on its heel. The foot behind is turned across, its toe at the camera, so
 * that the two feet make an L.
 */
export function legPart(J, W, ank, kn, { front, seat, older }) {
  const made = legShapes(J, ank, kn, { seat, older });
  const set = (points) =>
    points.map((q) => {
      const o = W(q);
      return q.length > 3 ? [o[0], o[1], q[2], q[3]] : o;
    });
  const foot = front ? shoeInFront(ank, set) : shoeAcross(ank, W, older);
  const su = unit(kn, ank);
  const seed = front ? 11 : 21;
  const ref = [1, 0];
  const stocking = add(kn, mul(su, 8.5));
  const folds = older
    ? thighFolds(W, J.hip, kn, ref, seed, [6.2, 1.4, -3.4]) + crotchFolds(W, J.hip, kn, ref, seed) + kneePuckers(W, kn, su, ref, seed + 1) + cuffGathers(W, ank, su, ref, seed + 2)
    : thighFolds(W, J.hip, kn, ref, seed) + sockWrinkles(W, stocking, ank, ref, seed + 2) + kneeFolds(W, kn, su, ref, seed + 1);
  // The leather is dark where the sole and heel are, and hatched where the shoe turns away from the light.
  const leather = foot.ink.map((shape) => solid(shape)).join("") + foot.hatch.map((stroke) => brush(stroke, 0.5, 0.4)).join("");
  return {
    ...drawn([...made.shapes.map(set), ...foot.shapes]),
    d: [...made.lines.map(set), ...foot.lines].map((l) => line(l)).join(""),
    k: folds + leather,
  };
}

// ---------- Head and sabre ----------

// The head is set a little smaller than the points of parts.js, as in the plates, where it is small for the body.
const HEAD_SIZE = 0.92;
// Where the middle of the head is in the torso's frame, up the spine and forward of it. An older man carries his head lower and thrust further forward.
const YOUNGER_HEAD = [73.6, 3];
const OLDER_HEAD = [72.2, 4.8];

/** The head in profile: the face, the hair, the ear and the marks of the features. */
export function headPart(J, W, older) {
  const lean = (J.lean * 0.35 * Math.PI) / 180;
  const hf = [Math.cos(lean), -Math.sin(lean)];
  const hu = [Math.sin(lean), Math.cos(lean)];
  const parts = headParts(older);
  // An older man's head is a little larger for his height.
  const size = HEAD_SIZE * (older ? 1.07 : 1);
  const centre = J.T(...(older ? OLDER_HEAD : YOUNGER_HEAD));
  // A point in the head's own frame, set on the body and turned for the camera.
  const H = (q) => W([centre[0] + (hf[0] * q[0] + hu[0] * q[1]) * size, centre[1] + (hf[1] * q[0] + hu[1] * q[1]) * size]);
  const Hs = (list) =>
    list.map((q) => {
      const o = H(q);
      return q.length > 2 ? [o[0], o[1], q[2]] : o;
    });
  const mark = (m) => brush(m.slice(0, 3).map(H), m[3], 0.5);
  const face = parts.face;
  return {
    ...drawn([Hs(parts.skull)], 0.18, 0.6),
    hair: blob(Hs(parts.hair)),
    s: parts.streaks.map((streak) => brush(streak.map(H), 0.7, 0.5)).join(""),
    d: line(Hs(parts.ear)) + line(Hs(parts.earFold)),
    // The older man's grey hair is drawn with finer strokes than a young man's dark hair.
    k: [face.brow, face.eye, face.lid, face.nostril, face.mouth].map(mark).join("") + parts.tufts.map((tuft) => brush(tuft.map(H), older ? 0.45 : 0.9, 0.35)).join(""),
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
  // The bell seen from the side is a dark crescent, open toward the hand.
  const at = (x, y) => add(cc, add(mul(along, x), mul(across, y)));
  const arc = (rx, ry, shift, n) =>
    Array.from({ length: n }, (_, i) => {
      const t = -Math.PI / 2 + (i / (n - 1)) * Math.PI;
      return at(rx * Math.cos(t) + shift, ry * Math.sin(t));
    });
  const tip = (p) => [p[0], p[1], 1];
  const outer = arc(2.3, 5.6, 0.3, 7);
  const inner = arc(1.0, 5.6, -0.2, 7).reverse().slice(1, -1);
  const cup = [tip(outer[0]), ...outer.slice(1, -1), tip(outer[outer.length - 1]), ...inner];
  // The bow, in the frame of the forearm, which is how the fist is set.
  const forearm = unit(J.el, J.hn);
  const bow = [[0.4, -5.2], [-3.6, -6.8], [-8.6, -6.4], [-11.4, -4.4]].map(([x, y]) => W(place(J.hn, forearm, x, y)));
  return { k: taper(b0, b1, 0.62, 0.18), g: blob(cup), d: line(bow) };
}
