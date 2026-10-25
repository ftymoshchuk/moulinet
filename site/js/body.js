// The body of a fencer, part by part, as pen-and-ink path data. Every builder is
// given the joints of a pose (in centimetres, from skeleton() in figure.js) and
// `W`, which sets a point on the piste and turns it for the camera, and gives
// back `{ g, d, k }`: the shapes that make the silhouette, the thin lines, and
// the brush strokes.
import { crotchFan, crotchFolds, cuffGathers, kneeFolds, kneePuckers, sleeveFolds, sockWrinkles, thighFolds, torsoFolds, waistband } from "./folds.js";
import { add, area, blob, brush, dist, inside, lerp, line, mul, perp, pt, ribbon, rotate, simplify, solid, sub, unit } from "./ink.js";
import { headParts, hiltParts, shoeAcrossParts, shoeParts, torsoParts } from "./parts.js";

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
  // The neck runs up from the collar to under the head, which it carries.
  const [headUp, headForward] = older ? OLDER_HEAD : YOUNGER_HEAD;
  const neck = older
    ? segment(J.T(56.5, 2.2), J.N(headUp - 3, headForward - 1.5), [7.0, 6.6], [7.0, 6.4], J.nf)
    : segment(J.T(56.5, 2.2), J.N(headUp - 3, headForward - 1.5), [6.6, 6.2], [6.6, 6.0], J.nf);
  const [collarFrom, collarTo] = [J.T(53, 1.6), J.T(58.6, 3.2)];
  const collar = segment(collarFrom, collarTo, [7.4, 7.2, 7.0], [7.6, 7.4, 7.2], J.f, [0.3, 0.3]);
  // The hem is not ruled across: it hangs a little lower in the middle, as the belt goes round the body.
  const hem = lerp(front[0], back[back.length - 1], 0.5);
  const jersey = [...front, ...back, [hem[0], hem[1] + 1.3]];
  const body = drawn([jersey]);
  const throat = drawn([neck.map(W), collar.map(W)], 0.16, 0.4);
  const shapes = { g: body.g + throat.g, o: body.o + throat.o };
  // The rim of the collar, round the neck: the near half of it, dipping across the front of the neck.
  const ca = unit(collarFrom, collarTo);
  const rim = (along, out) => W(place(collarTo, ca, along, out));
  const d = line([rim(1.2, -7.0), rim(-0.6, -1.0), rim(-0.9, 3.4), rim(0.2, 7.2)]);
  // The shadow the jaw throws on the neck, and the cord of the neck from behind the ear down to the front of the collar,
  // set on the page with the head.
  const H = headFrame(J, W, older);
  const jaw = brush([H([2.2, -8.8]), H([-1.6, -10]), H([-5.8, -10.8])], 1.5, 0.5);
  const cord = brush([H([-3.8, -5.6]), H([-2.6, -9.6]), H([-1.0, -12.6])], 0.8, 0.4);
  return { ...shapes, d, k: torsoFolds(across, 4, older) + waistband(across) + jaw + cord };
}

// ---------- Arms ----------

/**
 * The sword arm: a long loose sleeve and the cuff of a gauntlet, up to the wrist;
 * the hand is drawn with the sabre it holds (bladePart). The arm is on the far
 * side of the body, so the sleeve comes out from behind the jersey: its top runs
 * on from the line of the shoulder, and its underside from the armpit.
 */
export function swordArm(J, W, frame = torsoFrame(J, W, false)) {
  // The arm lies in a plane, at its shoulder's distance from the camera.
  const Wa = (q) => W([q[0], q[1], J.sh[2]]);
  const fu = unit(J.el, J.hn);
  const up = [0, 1];
  // The sleeve is full over the upper arm and the elbow, and narrows down the forearm into the gauntlet.
  const hi = [7.2, 7.4, 7.2, 6.8];
  const lo = [6.8, 7.0, 7.0, 6.6];
  const upper = segment(J.sh, J.el, hi, lo, up, [0, 1]);
  const n = hi.length;
  const { across } = frame;
  // Behind the jersey, where none of it shows: from the top of the shoulder, along the arm and back to the armpit.
  const hidden = (p) => [p[0], p[1], 0, 0];
  const sleeve = [hidden(across(56.5, 0.55)), across(54.5, 0.9), ...upper.slice(1, 2 * n + 3).map(Wa), hidden(across(41, 0.8))];
  const fore = segment(J.el, sub(J.hn, mul(fu, 15)), [6.8, 6.2, 5.6, 5.0], [6.6, 5.9, 5.2, 4.6], up);
  // The gauntlet, flaring from the forearm to where it meets the fist.
  const cuff = segment(sub(J.hn, mul(fu, 20.5)), sub(J.hn, mul(fu, 10.4)), [5.6, 6.3, 6.9], [5.6, 6.3, 6.9], up, [0.2, 0.15]);
  const shapes = drawn([sleeve, ...[fore, cuff].map((s) => s.map(Wa))]);
  const atHand = ([x, y]) => Wa(place(J.hn, fu, x, y));
  // The rim of the gauntlet, where the sleeve goes into it.
  const d = line([[-20.2, 5.5], [-19.0, 0.4], [-20.2, -5.5]].map(atHand));
  return { ...shapes, d, k: sleeveFolds(Wa, J.sh, J.el, sub(J.hn, mul(fu, 20.5)), 6) };
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
  const hi = [7.0, 7.2, 7.0, 6.6];
  const lo = [6.6, 6.8, 6.8, 6.4];
  const tube = segment(J.rs, J.re, hi, lo, up, [0, 1]);
  const n = hi.length;
  // Down the outer side of the arm, round the elbow, and back up the inner side...
  const outline = tube.slice(1, 2 * n + 3).map(Wa);
  // ...to where the sleeve is sewn to the jersey, up the armhole to the top of the shoulder.
  const { across } = frame;
  // Along the jersey's own edge the sleeve has no line, and nor has its seam.
  const on = (p) => [p[0], p[1], 0, 0];
  const seam = (p) => [p[0], p[1], 0, 0];
  const sleeve = [on(across(58.6, -0.6)), on(across(57.6, -0.84)), on(across(55.6, -0.97)), on(across(53, -1)), ...outline.slice(1), seam(across(42, -0.6)), seam(across(50, -0.8))];
  const fore = segment(J.re, J.rh, [6.8, 6.0, 5.2, 4.6], [6.6, 5.6, 4.9, 4.3], up);
  const palm = hand.shape.map(([x, y]) => Wa(place(J.rh, qu, x, y)));
  // The point of the elbow, rounded, on the outside of the bend.
  const e = Wa(J.re);
  const toward = add(unit(e, Wa(J.rs)), unit(e, Wa(J.rh)));
  const outward = Math.hypot(...toward) < 0.2 ? perp(unit(e, Wa(J.rs))) : mul(unit([0, 0], toward), -1);
  const side = perp(outward);
  const elbow = [add(add(e, mul(outward, 2.8)), mul(side, 6.3)), add(e, mul(outward, 7.3)), add(add(e, mul(outward, 2.8)), mul(side, -6.3)), add(e, mul(outward, -2))];
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
 * the camera, as it is seen on the page. `toeBack` is how far it is turned back
 * from straight at the camera, in degrees: the pose's, and the camera turns it
 * on from there.
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
export function shoeAcross(ank, W, toeBack, older = false, parts = shoeAcrossParts()) {
  const { domes, left, right, at, page, side, faces, ce } = acrossFrame(ank, W, toeBack, parts);
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
export function footSpan(W, toeBack, parts = shoeAcrossParts()) {
  const { left, right } = acrossFrame([0, 8], W, toeBack, parts);
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
function acrossFrame(ank, W, toeBack, parts) {
  const look = W.camera * RAD;
  const ce = Math.cos(look);
  const se = Math.sin(look);
  const turn = toeBack * RAD;
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
 * over the band below the knee, and the long stocking with its calf. The thigh
 * is cut square at the hip joint. `seat` also gives the leg the front of the
 * trousers between the hips, for the leg further from the camera, and `near`
 * leaves the line off the top of the thigh of the leg drawn over it, so the two
 * legs part only below the crotch. Returns the silhouette's points and the lines
 * drawn inside it, as point lists of the piste.
 */
function legShapes(J, flat, ank, kn, { front, seat, near, older }) {
  const hip = flat(front ? J.hipF : J.hipB);
  const f = [1, 0];
  const su = unit(kn, ank);
  const k = (t) => add(kn, mul(su, t));
  const shapes = [];
  const lines = [];
  const thigh = older ? (front ? LOOSE_FRONT : LOOSE_BACK) : front ? THIGH_FRONT : THIGH_BACK;
  const upper = segment(hip, kn, thigh.hi, thigh.lo, f, [0, 1]);
  if (near) {
    // The leg drawn over the other parts from it at the crotch: the line up the inside of the thigh starts there, where it
    // meets the line up the inside of the other thigh, and the square top (the last three points) lies over the front of the
    // trousers with its line just inside it, so none of it shows.
    const inner = front ? 2 * thigh.hi.length + 2 : 0;
    const c = crotch(J, flat, older, upper[inner]);
    // The line comes to a point at the crotch, as a pen stroke ends, and is full a little below it.
    const below = add(c, mul(sub(upper[front ? inner - 1 : 1], c), 2.5 / Math.max(2.5, dist(c, upper[front ? inner - 1 : 1]))));
    upper.splice(inner, 1, ...(front ? [below, [...c, 1, -0.3]] : [[...c, 1, -0.3], below]));
    upper.splice(-3, 3, ...upper.slice(-3).map(([x, y]) => [x, y, 0, -0.6]));
  }
  shapes.push(upper);
  if (older) {
    // Loose trousers, one cloth from the hip to the ankle: full at the thigh, narrowing down the shin, and bloused over the shoe in a soft S.
    const hi = [12.4, 11.2, 10.0, 9.0, 8.3, 7.9, 7.8, 9.4, 7.4];
    const lo = [11.6, 10.6, 9.5, 8.6, 8.0, 7.7, 7.6, 9.0, 7.0];
    shapes.push(segment(kn, add(ank, mul(su, 1)), hi, lo, f, [0, 0.5]));
    // The hem, where the cloth is gathered over the shoe, from one edge of the leg to the other.
    const at = 1 - 1.2 / (dist(kn, ank) + 1);
    lines.push(across(add(ank, mul(su, -1.2)), su, edge(hi, at) - 0.2, edge(lo, at) - 0.2, 0.7));
  } else {
    // (It starts square at the knee, inside the round end of the thigh, so the two make one knee.)
    shapes.push(segment(kn, k(12), [8.8, 9.0, 8.5, 7.7], [8.4, 8.6, 7.8, 7.0], f, [0, 1]));
    shapes.push(segment(k(10.5), add(ank, mul(su, 2)), [6.4, 6.4, 5.7, 4.9, 4.4], [6.4, 6.7, 5.9, 4.9, 4.3], f, [0.2, 0.4]));
    // The lower edge of the cloth over the band, and the band itself, each curved round the leg.
    lines.push(across(k(11.6), su, 7.2, 6.8, 3.0));
    lines.push(across(k(14.2), su, 6.3, 6.3, 2.6));
  }
  if (seat) shapes.push(trouserFront(J, flat, older));
  return { shapes, lines };
}

// The thighs' half-widths from the hip joint to the knee: `hi` on the side that
// faces forward, which is the top of the thigh in front and the inside of the
// thigh behind, and `lo` on the other. Full at the top, where the cloth of the
// hips comes down into them, and narrowing to the knee, where the knickerbockers
// go into the pouch below it.
const THIGH_FRONT = { hi: [16.0, 13.8, 11.6, 9.8], lo: [11.0, 10.4, 9.6, 8.8] };
const THIGH_BACK = { hi: [16.0, 13.0, 10.8, 9.6], lo: [12.5, 11.6, 10.4, 9.2] };
const LOOSE_FRONT = { hi: [15.0, 13.4, 13.0, 12.4], lo: [10.6, 11.6, 12.0, 11.6] };
const LOOSE_BACK = { hi: [15.0, 13.0, 12.4, 12.0], lo: [12.0, 12.2, 12.2, 11.6] };

// Where a thigh's square top meets its sides, on the side that faces forward (`hi`) and on the other, and the way down the thigh.
function thighTop(hip, kn, widths) {
  const u = unit(hip, kn);
  let n = perp(u);
  if (n[0] < 0) n = mul(n, -1);
  return { hi: add(hip, mul(n, widths.hi[0])), lo: add(hip, mul(n, -widths.lo[0])), u };
}

// The crotch: where the lines up the insides of the two thighs meet, which is the inside of the thigh in front on its
// lower side and of the thigh behind on the side that faces forward. Where they meet above the top of the thigh behind,
// or not near the top of it at all, the crotch is `fallback`, or else the inner corner of that thigh's top, and the front
// of the trousers fills the gap between the thighs.
export function crotch(J, flat, older, fallback) {
  const front = thighTop(flat(J.hipF), flat(J.kF), older ? LOOSE_FRONT : THIGH_FRONT);
  const back = thighTop(flat(J.hipB), flat(J.kB), older ? LOOSE_BACK : THIGH_BACK);
  const [p, u, q, v] = [back.hi, back.u, front.lo, front.u];
  const cross = u[0] * v[1] - u[1] * v[0];
  const otherwise = fallback ? fallback.slice(0, 2) : p;
  if (Math.abs(cross) < 0.05) return otherwise;
  // How far down the inside of the thigh behind the two lines meet.
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / cross;
  return t >= 0 && t < 14 ? add(p, mul(u, t)) : otherwise;
}

/**
 * The front of the trousers between the hips: round the tops of both thighs and
 * up under the jersey, as the smallest shape with no hollow in it that holds the
 * corners of both thighs' tops. Where it reaches over a thigh, the thigh is drawn
 * on it, so it has no line of its own but the trousers' back and front above the
 * thighs, and the crotch where they part. Taken round its corners in order, it
 * would fold over itself where the thighs' tops cross, and the fold would cut a
 * hole in the silhouette.
 */
function trouserFront(J, flat, older) {
  const front = thighTop(flat(J.hipF), flat(J.kF), older ? LOOSE_FRONT : THIGH_FRONT);
  const back = thighTop(flat(J.hipB), flat(J.kB), older ? LOOSE_BACK : THIGH_BACK);
  // Up under the jersey, drawn in toward the middle of the hips so that, however the thighs are set, it stays under it.
  const under = (corner, k) => add(lerp(corner, J.hip, k), mul(J.u, 14));
  // Between the thighs it runs straight from one thigh's corner to the other's.
  const between = new Set([front.lo, back.hi]);
  return hull([back.lo, under(back.lo, 0.3), under(front.hi, 0.5), front.hi, front.lo, back.hi]).map((p) => (between.has(p) ? [...p, 1] : p));
}

/** The smallest shape with no hollow in it round points: the points of it, in order round it. */
export function hull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.slice().reverse())];
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
 * that the two feet make an L, and its knee, a point with a depth, is turned out
 * toward the camera over it.
 */
export function legPart(J, W, ank, knee, { front, seat, near = false, older }) {
  // A joint that is nearer the camera is across the page as far as the camera turns that depth into: on the piste, that much further along.
  const flat = (q) => (q.length > 2 ? [q[0] + q[2] * Math.tan(W.camera * RAD), q[1]] : q);
  const kn = flat(knee);
  const hip = flat(front ? J.hipF : J.hipB);
  const made = legShapes(J, flat, ank, kn, { front, seat, near, older });
  // The leg's points are on the piste; what follows them says whether a point is a corner and how much of its line it
  // keeps, and is carried over.
  const set = (points) =>
    points.map((q) => {
      const o = W([q[0], q[1]]);
      return q.length > 2 ? [o[0], o[1], ...q.slice(2)] : o;
    });
  const foot = front ? shoeInFront(ank, set) : shoeAcross(ank, W, J.toeBack, older);
  const su = unit(kn, ank);
  const seed = front ? 11 : 21;
  const ref = [1, 0];
  const stocking = add(kn, mul(su, 8.5));
  // The inside of each leg is the side that faces the other: the back of the leg in front, the front of the leg behind.
  const inner = front ? -1 : 1;
  const legFolds = older
    ? crotchFolds(W, hip, kn, ref, seed) + kneePuckers(W, kn, su, ref, seed + 1) + cuffGathers(W, ank, su, ref, seed + 2)
    : sockWrinkles(W, stocking, ank, ref, seed + 2, inner) + kneeFolds(W, kn, su, ref, seed + 1);
  // The leg drawn over the other carries the folds that run up from the crotch into the front of the trousers, as far as
  // the crotch is below the middle of the hips.
  let fan = "";
  if (near) {
    const c = crotch(J, flat, older);
    fan = crotchFan(W, c, J.u, J.f, seed + 3, older ? 2 : 4, (J.hip[0] - c[0]) * J.u[0] + (J.hip[1] - c[1]) * J.u[1]);
  }
  const folds = thighFolds(W, hip, kn, ref, seed, inner, older) + legFolds + fan;
  // The leather is dark where the sole and heel are, and hatched where the shoe turns away from the light.
  const leather = foot.ink.map((shape) => solid(shape)).join("") + foot.hatch.map((stroke) => brush(stroke, 0.6, 0.4)).join("");
  return {
    ...drawn([...made.shapes.map(set), ...foot.shapes]),
    d: [...made.lines.map(set), ...foot.lines].map((l) => line(l)).join(""),
    k: folds + leather,
  };
}

// ---------- Head and sabre ----------

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

// Where the middle of the head is in the neck's frame, up the neck from its base and forward of it. An older man carries
// his head lower and thrust further forward.
const YOUNGER_HEAD = [15.5, 6.5];
const OLDER_HEAD = [14.2, 8.1];
// How much of the body's lean the head nods with: little, so the eyes stay level.
const NOD = 0.15;

/**
 * Where the head is on the page: `H(q)` sets a point of the head's own frame, in parts.js, on the page. The head is
 * carried on the neck and nods only a little with the body. A head is nearly as wide as it is long, so it narrows
 * only a little as the camera turns from side on, where a profile set on the piste would narrow to a sliver.
 */
export function headFrame(J, W, older) {
  const centre = J.N(...(older ? OLDER_HEAD : YOUNGER_HEAD));
  // An older man's head is a little larger for his height.
  const size = older ? 1.07 : 1;
  const nod = J.lean * NOD * RAD;
  const hf = [Math.cos(nod), -Math.sin(nod)];
  const hu = [Math.sin(nod), Math.cos(nod)];
  const c = W(centre);
  const look = (W.camera ?? 0) * RAD;
  // The way across the page the head faces, and how much of its length the camera sees across it.
  const facing = Math.sign(W([centre[0] + 1, centre[1]])[0] - c[0]) || 1;
  const narrow = facing * Math.hypot(Math.cos(look), 0.75 * Math.sin(look));
  return (q) => [c[0] + size * narrow * (hf[0] * q[0] + hu[0] * q[1]), c[1] - size * (hf[1] * q[0] + hu[1] * q[1])];
}

/**
 * The head in profile: the face, the hair drawn in strokes of the pen, the ear
 * and the marks of the features. Where the hair grows the head has hardly any
 * line round it, so the strokes of the hair make its edge.
 */
export function headPart(J, W, older) {
  const parts = headParts(older);
  const H = headFrame(J, W, older);
  const Hs = (list) =>
    list.map((q) => {
      const o = H(q);
      return q.length > 2 ? [o[0], o[1], ...q.slice(2)] : o;
    });
  const mark = (m) => brush(m.slice(0, 3).map(H), m[3], 0.5);
  const skull = parts.skull.map((q) => (inside(parts.hair, q) ? [q[0], q[1], 0, 0.45] : q));
  return {
    ...drawn([Hs(skull)], 0.18, 0.6),
    hair: parts.comb.map(([points, width]) => brush(points.map(H), width, 0.45)).join(""),
    d: line(Hs(parts.ear)) + line(Hs(parts.earFold)),
    // The older man's grey hair is drawn with finer strokes than a young man's dark hair.
    k: Object.values(parts.face).map(mark).join("") + parts.tufts.map((tuft) => brush(tuft.map(H), 0.45, 0.35)).join(""),
  };
}

// ---------- The sabre in the hand ----------

// Points and steps in depth, for the hand and the sabre, which are worked out in three dimensions before they are set on
// the page.
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, t) => add3(a, mul3(sub3(b, a), t));
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function unit3(a) {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// How far the wrist, where the forearm ends and the hand begins, is behind the hand's point on the blade, along the
// forearm (cm): just inside the mouth of the gauntlet.
const WRIST = 10;

/**
 * The frame of the hand on the blade, which the hilt and the fist are worked out in (parts.js): `a` along the blade
 * toward its point, `e` the way the edge faces and `s` the way the palm faces, each a step in the body's frame.
 * `point(q)` sets a point q = [x, y, z] of that frame, x cm along the blade, y toward the edge and z toward the palm, in
 * the body's frame; `step(v)` does the same for a step.
 *
 * In the third position the edge faces the way the blade turns as it cuts in the plane of the arm: down from a blade
 * held forward, forward from one held up. The pose's `hand` turns it about the blade from there, toward the camera's
 * side of the piste as it grows, which is the inside of the sword arm as both fencers are drawn: the second position,
 * at -90, has the palm down and the edge out; the fourth, at 90, the palm up and the edge in; and the first, at -180,
 * the thumb down and the edge up.
 */
export function gripFrame(J, W) {
  const a = unit3(sub3(J.at(1), J.at(0)));
  const third = [Math.sin(J.bp), -Math.cos(J.bp), 0];
  const inward = mul3(cross3(third, a), W.dir ?? 1);
  const t = (J.hand ?? 0) * RAD;
  const e = add3(mul3(third, Math.cos(t)), mul3(inward, Math.sin(t)));
  const s = add3(mul3(third, -Math.sin(t)), mul3(inward, Math.cos(t)));
  const step = ([x, y, z]) => add3(add3(mul3(a, x), mul3(e, y)), mul3(s, z));
  return { a, e, s, step, point: (q) => add3(J.hn, step(q)) };
}

// A point `t` of the way along a smooth curve through `stations`, each a list of numbers, as a list of numbers.
function through(stations, t) {
  const last = stations.length - 1;
  const at = Math.max(0, Math.min(last, t * last));
  const i = Math.min(last - 1, Math.floor(at));
  const f = at - i;
  const [p0, p1, p2, p3] = [stations[Math.max(0, i - 1)], stations[i], stations[i + 1], stations[Math.min(last, i + 2)]];
  return p1.map((b, k) => {
    const [a, c, d] = [p0[k], p2[k], p3[k]];
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  });
}

/**
 * The guard's sheet of steel: `rows[i][j]` is a point of the hilt's frame `i / n` of the way along its curve, from the
 * lip over the thumb to the pommel, and `j / m` of the way across it, and `normals[i][j]` the way its outside faces
 * there, away from the hand.
 */
function guardSheet(guard, n = 26, m = 8) {
  const rows = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const [x, y, wide] = through(guard.stations, u);
    const [x0, y0] = through(guard.stations, Math.max(0, u - 0.01));
    const [x1, y1] = through(guard.stations, Math.min(1, u + 0.01));
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    // Toward the hand, square to the curve, and how far the edges of the sheet are bent that way.
    const inward = [-(y1 - y0) / l, (x1 - x0) / l];
    const sag = (wide * wide) / (2 * guard.bowl);
    const row = [];
    for (let j = 0; j <= m; j++) {
      const v = -1 + (2 * j) / m;
      row.push([x + v * v * sag * inward[0], y + v * v * sag * inward[1], v * wide]);
    }
    rows.push(row);
  }
  const normals = rows.map((row, i) =>
    row.map((_, j) => unit3(cross3(sub3(rows[Math.min(n, i + 1)][j], rows[Math.max(0, i - 1)][j]), sub3(row[Math.min(m, j + 1)], row[Math.max(0, j - 1)])))),
  );
  return { rows, normals, n, m };
}

/**
 * The parts of the guard's sheet the camera sees from one side: the outside, where `facing` is above 0, or the inside,
 * where it is below. On each row across the sheet that side is one run, from one edge to where the sheet turns away
 * (it never turns twice across a row); a run of rows that each have some of it makes one shape, closed at either end
 * along the row, which follows the bend of the sheet across. Returns the shapes, as lists of [i, v]: how far along the
 * sheet, by row, and how far across it, from -1 to 1.
 */
function sheetSide(facing, m, sign) {
  const shapes = [];
  let runs = [];
  // Across row `i` from `from` to `to`, through the points of the row between them.
  const across = (i, from, to) => {
    const points = [[i, from]];
    const step = to > from ? 1 : -1;
    for (let j = 0; j <= m; j++) {
      const v = -1 + (2 * (step > 0 ? j : m - j)) / m;
      if ((v - from) * step > 1e-6 && (to - v) * step > 1e-6) points.push([i, v]);
    }
    points.push([i, to]);
    return points;
  };
  const close = () => {
    if (runs.length > 1) {
      const [first, last] = [runs[0], runs[runs.length - 1]];
      shapes.push([
        ...across(first.i, first.hi, first.lo),
        ...runs.slice(1, -1).map(({ i, lo }) => [i, lo]),
        ...across(last.i, last.lo, last.hi),
        ...runs.slice(1, -1).reverse().map(({ i, hi }) => [i, hi]),
      ]);
    }
    runs = [];
  };
  facing.forEach((row, i) => {
    const f = row.map((v) => v * sign);
    const seen = f.map((v) => v > 0);
    const first = seen.indexOf(true);
    if (first < 0) return close();
    const last = seen.lastIndexOf(true);
    // Where the facing passes 0 between point j and the next, from -1 to 1 across the row.
    const cross = (j) => -1 + (2 * (j + f[j] / (f[j] - f[j + 1]))) / m;
    runs.push({ i, lo: first === 0 ? -1 : cross(first - 1), hi: last === m ? 1 : cross(last) });
  });
  close();
  return shapes;
}

// A circle in depth round `c`, `r` cm round, square to the step `axis`, as `n` points of the body's frame.
function ring3(c, axis, r, n = 16) {
  const a = unit3(axis);
  const u = unit3(cross3(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const v = cross3(a, u);
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return add3(c, add3(mul3(u, r * Math.cos(t)), mul3(v, r * Math.sin(t))));
  });
}

// A circle on the page round `c`, as `n` points.
function circle(c, r, n = 14) {
  return Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);
}

/**
 * The fist round the grip, in the frame of the hand on the blade: each finger as its three bones, curled round the grip
 * as `hilt.fingers` says; the thumb along its back, from the ball of the thumb by the wrist to its tip; and the hand
 * behind them, from the knuckles to the wrist, which is where the forearm ends, so the hand bends at the wrist to meet
 * the forearm however the blade is held. Returns the fingers and the thumb as chains of joints, points of the body's
 * frame, with how thick each is at each joint; and the hand as balls, [where, how thick].
 */
function fistBones(J, G, hilt) {
  // The middle of the grip beside a point of the body's frame.
  const onGrip = (q) => G.point([dot3(sub3(q, J.hn), G.a), 0, 0]);
  const fingers = hilt.fingers.map(({ x, r, joints }) => ({
    at: joints.map(([round, out]) => G.point([x, out * Math.cos(round * RAD), out * Math.sin(round * RAD)])),
    r: joints.map((_, k) => r * (1 - 0.06 * k)),
  }));
  // The wrist is on the forearm, and its sides are toward the thumb and away from it, square to the forearm.
  const fu = unit3(sub3(J.hn, J.el));
  const wrist = sub3(J.hn, mul3(fu, WRIST));
  const radial = unit3(sub3(mul3(G.e, -1), mul3(fu, -dot3(G.e, fu))));
  const { wrist: half, wristR, heel, ball } = hilt.palm;
  const [thumbSide, littleSide] = [add3(wrist, mul3(radial, half)), sub3(wrist, mul3(radial, half))];
  const joints = hilt.thumb.joints.map(G.point);
  // Its line runs back from the knuckle into the ball of the thumb, leaning a little toward the wrist.
  const back = add3(joints[0], mul3(unit3(sub3(joints[0], joints[1])), 2.2));
  const thumb = { at: [lerp3(back, thumbSide, 0.25), ...joints], r: [hilt.thumb.r[0] * 1.15, ...hilt.thumb.r] };
  // The knuckles of the hand stand a little proud of the fingers' first joints, and the back of the hand is rounded.
  const knuckles = fingers.map(({ r, at }) => [add3(at[0], mul3(unit3(sub3(at[0], onGrip(at[0]))), 0.25)), r[0] + 0.25]);
  const across = lerp3(knuckles[1][0], knuckles[2][0], 0.5);
  const palm = [
    ...knuckles,
    [add3(lerp3(across, wrist, 0.5), mul3(G.s, -0.6)), 2.3],
    [joints[0], hilt.thumb.r[0] + 0.1],
    [lerp3(fingers[3].at[0], littleSide, 0.5), heel],
    [lerp3(joints[0], thumbSide, 0.55), ball],
    [thumbSide, wristR],
    [littleSide, wristR],
  ];
  return { fingers, thumb, palm, onGrip };
}

// Points along a chain of joints, about every `step` cm, each [where, how thick].
function alongChain({ at, r }, step = 0.4) {
  const points = [];
  for (let k = 0; k < at.length - 1; k++) {
    const n = Math.max(1, Math.ceil(dist3(at[k], at[k + 1]) / step));
    for (let s = 0; s < n; s++) points.push([lerp3(at[k], at[k + 1], s / n), r[k] + ((r[k + 1] - r[k]) * s) / n]);
  }
  points.push([at[at.length - 1], r[r.length - 1]]);
  return points;
}

/**
 * The fist as it is seen: all its parts merged into one shape `g` with its line of ink `o`; inside it, the lines `d`
 * where a finger or the thumb lies over another part of the hand, each drawn as one tube round from its knuckle to its
 * tip and back, wherever nothing nearer hides it; and the creases of the middle knuckles that face the camera, `k`.
 */
function fistPart(J, W, G, hilt) {
  const { fingers, thumb, palm, onGrip } = fistBones(J, G, hilt);
  const chains = [...fingers, thumb];
  // Every part as the camera sees it, with how near the camera it is: each bone of each chain, a rounded rod on the
  // page between the circles round its ends, and the hand, the smallest shape round its balls.
  const bones = chains.flatMap((chain, c) =>
    chain.at.slice(1).map((q, k) => {
      const [a, b] = [W(chain.at[k]), W(q)];
      const [ra, rb] = [chain.r[k], chain.r[k + 1]];
      const box = [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb)];
      return { chain: c, a, b, ra, rb, box, depth: W.depth(lerp3(chain.at[k], q, 0.5)) };
    }),
  );
  const hand = hull(palm.flatMap(([c, r]) => circle(W(c), r, 10)));
  const handBox = [Math.min(...hand.map((p) => p[0])), Math.min(...hand.map((p) => p[1])), Math.max(...hand.map((p) => p[0])), Math.max(...hand.map((p) => p[1]))];
  // How far inside a bone a point of the page is: its thickness there, less how far the point is from its line.
  const into = ({ a, b, ra, rb }, p) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return ra + (rb - ra) * t - Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const within = (box, p, m = 0) => p[0] >= box[0] - m && p[0] <= box[2] + m && p[1] >= box[1] - m && p[1] <= box[3] + m;
  // How far inside the hand a point is, or outside it, below 0: the hand is the smallest shape round its balls, so it
  // has no hollow, and that is how far the point is inside the nearest of the lines along its edges.
  const middle = hand.reduce((sum, p) => add(sum, mul(p, 1 / hand.length)), [0, 0]);
  const edges = hand.map((a, i) => {
    const b = hand[(i + 1) % hand.length];
    let n = perp(unit(a, b));
    if (dot(n, sub(middle, a)) < 0) n = mul(n, -1);
    return [a, n];
  });
  const intoHand = (p) => {
    let f = Infinity;
    for (const [a, n] of edges) f = Math.min(f, (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]);
    return f;
  };
  // The balls of the hand as the camera sees them: where, how big, and how near the camera.
  const palmSeen = palm.map(([c, r]) => [W(c), r, W.depth(c)]);

  // The silhouette: the line round everywhere inside some part, traced on a grid.
  const lo = [Math.min(handBox[0], ...bones.map((bn) => bn.box[0])), Math.min(handBox[1], ...bones.map((bn) => bn.box[1]))];
  const hi = [Math.max(handBox[2], ...bones.map((bn) => bn.box[2])), Math.max(handBox[3], ...bones.map((bn) => bn.box[3]))];
  const field = (p) => {
    let f = within(handBox, p, 0.5) ? intoHand(p) : -1;
    for (const bn of bones) if (within(bn.box, p, 0.5)) f = Math.max(f, into(bn, p));
    return f;
  };
  // Its outer edges only: a gap the parts close round, or a speck where two fingers barely part, is part of the fist.
  const loops = contour(field, [lo[0] - 0.6, lo[1] - 0.6, hi[0] + 0.6, hi[1] + 0.6], 0.42)
    .map((loop) => [loop, Math.abs(area(loop))])
    .sort((a, b) => b[1] - a[1]);
  const outline = [];
  for (const [loop, size] of loops) if (size > 1 && !outline.some((outer) => inside(outer, loop[0]))) outline.push(loop);

  // Whether a point of a chain's edge, as near the camera as `depth`, is hidden by another part, and whether it lies
  // over one, so that it is a line inside the fist and not its outline.
  const seen = (p, depth, chain) => {
    let over = false;
    for (const other of bones) {
      if (other.chain === chain || !within(other.box, p, 0.35)) continue;
      // Fingers lie side by side and touch, so a finger's edge against the next one is a line inside the fist.
      const d = into(other, p);
      if (d > 0 && other.depth > depth + 0.3) return false;
      if (d > -0.35) over = true;
    }
    if (within(handBox, p) && intoHand(p) > 0) {
      // The hand is only as near the camera as the balls it is made of, where the point is on one of them.
      for (const [c, r, near] of palmSeen) if (near > depth + 0.3 && dist(c, p) < r) return false;
      over = true;
    }
    return over;
  };
  const lines = [];
  chains.forEach((chain, c) => {
    const points = alongChain(chain, 0.35);
    const page = points.map(([q]) => W(q));
    // Down one side, round the tip and back up the other: the edge of the tube, with how near the camera each point is.
    const left = [];
    const right = [];
    let along = [1, 0];
    page.forEach((p, i) => {
      const step = sub(page[Math.min(page.length - 1, i + 1)], page[Math.max(0, i - 1)]);
      if (Math.hypot(...step) > 0.05) along = unit([0, 0], step);
      const n = perp(along);
      const [q, r] = points[i];
      left.push([add(p, mul(n, r)), W.depth(q)]);
      right.push([sub(p, mul(n, r)), W.depth(q)]);
    });
    const [tip, r] = points[points.length - 1];
    const n = perp(along);
    const cap = Array.from({ length: 5 }, (_, s) => {
      const a = (Math.PI * (s + 1)) / 6;
      return [add(W(tip), add(mul(n, r * Math.cos(a)), mul(along, r * Math.sin(a)))), W.depth(tip)];
    });
    let run = [];
    for (const [p, depth] of [...left, ...cap, ...right.reverse()]) {
      if (seen(p, depth, c)) run.push(p);
      else if (run.length) {
        if (run.length > 1) lines.push(run);
        run = [];
      }
    }
    if (run.length > 1) lines.push(run);
  });
  // The middle knuckles, where they face the camera: a short crease across each finger.
  let k = "";
  for (const finger of fingers) {
    const knuckle = finger.at[1];
    const out = unit3(sub3(knuckle, onGrip(knuckle)));
    if (W.depth(out) < 0.45) continue;
    const c = W(knuckle);
    const across = perp(unit(W(finger.at[0]), W(finger.at[2])));
    const bulge = sub(W(add3(knuckle, out)), c);
    k += brush([add(c, mul(across, finger.r[1] * 0.55)), add(c, mul(bulge, finger.r[1] * 0.2)), sub(c, mul(across, finger.r[1] * 0.55))], 0.32, 0.5);
  }
  // Shade along the edge of the fist where it turns from the light, the lower right of the page: short strokes in from
  // the edge, every centimetre or so.
  const silhouette = outline.map((loop) => simplify(loop, 0.08, true));
  for (const loop of silhouette) {
    const middle = loop.reduce((sum, p) => add(sum, mul(p, 1 / loop.length)), [0, 0]);
    let since = Infinity;
    loop.forEach((p, i) => {
      const next = loop[(i + 1) % loop.length];
      since += dist(loop[(i + loop.length - 1) % loop.length], p);
      let n = perp(unit(p, next));
      if (dot(n, sub(middle, p)) > 0) n = mul(n, -1);
      if (since < 1.1 || dot(n, [0.6, 0.8]) < 0.55) return;
      since = 0;
      const into = sub(mul(n, -1), mul(unit(p, next), 0.35));
      k += brush([add(p, mul(into, 0.15)), add(p, mul(into, 0.75)), add(p, mul(into, 1.35))], 0.3, 0.4);
    });
  }
  return { ...drawn(silhouette, 0.2, 0.55), d: lines.map((l) => line(simplify(l, 0.05))).join(""), k };
}

/**
 * The line round where `field` is above 0 within `box`, [left, top, right, bottom] on the page, traced on a grid
 * `step` apart (marching squares) with each crossing found between the grid's points: closed loops of points, without
 * points closer than a third of a step.
 */
export function contour(field, [x0, y0, x1, y1], step) {
  const nx = Math.ceil((x1 - x0) / step) + 1;
  const ny = Math.ceil((y1 - y0) / step) + 1;
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = field([x0 + i * step, y0 + j * step]);
  // Where the line crosses each edge of the grid: the edge from point (i, j) to the right is 2(j nx + i), and down
  // 2(j nx + i) + 1; and the two crossings each crossing is joined to, -1 for none yet.
  const size = 2 * nx * ny;
  const xs = new Float64Array(size);
  const ys = new Float64Array(size);
  const links = new Int32Array(2 * size).fill(-1);
  const crossing = (i, j, down) => {
    const id = 2 * (j * nx + i) + (down ? 1 : 0);
    const a = v[j * nx + i];
    const b = down ? v[(j + 1) * nx + i] : v[j * nx + i + 1];
    const f = a / (a - b);
    xs[id] = x0 + (down ? i : i + f) * step;
    ys[id] = y0 + (down ? j + f : j) * step;
    return id;
  };
  const link = (a, b) => {
    links[2 * a + (links[2 * a] < 0 ? 0 : 1)] = b;
    links[2 * b + (links[2 * b] < 0 ? 0 : 1)] = a;
  };
  const sides = [0, 0, 0, 0];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const c0 = v[k] > 0;
      const c1 = v[k + 1] > 0;
      const c2 = v[k + nx + 1] > 0;
      const c3 = v[k + nx] > 0;
      if (c0 === c1 && c1 === c2 && c2 === c3) continue;
      let n = 0;
      if (c0 !== c1) sides[n++] = crossing(i, j, false);
      if (c1 !== c2) sides[n++] = crossing(i + 1, j, true);
      if (c2 !== c3) sides[n++] = crossing(i, j + 1, false);
      if (c3 !== c0) sides[n++] = crossing(i, j, true);
      if (n === 2) link(sides[0], sides[1]);
      else if (n === 4) {
        // A saddle: the middle of the cell decides which corners are joined.
        if (v[k] + v[k + 1] + v[k + nx + 1] + v[k + nx] > 0 === c0) {
          link(sides[0], sides[1]);
          link(sides[2], sides[3]);
        } else {
          link(sides[0], sides[3]);
          link(sides[1], sides[2]);
        }
      }
    }
  }
  const loops = [];
  const done = new Uint8Array(size);
  for (let first = 0; first < size; first++) {
    if (done[first] || links[2 * first] < 0) continue;
    const loop = [];
    let [previous, current] = [-1, first];
    while (current >= 0 && !done[current]) {
      done[current] = 1;
      const p = [xs[current], ys[current]];
      if (!loop.length || dist(loop[loop.length - 1], p) > step / 3) loop.push(p);
      const [a, b] = [links[2 * current], links[2 * current + 1]];
      [previous, current] = [current, a === previous ? b : a];
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

/**
 * The sabre and the hand that holds it, as the plates draw them. The blade is a tapered line of ink. The guard is a
 * sheet of steel, light with a line of ink round it, from a lip over the thumb round the front of the fingers and back
 * under them as the knuckle bow to the pommel (parts.js), worked out in three dimensions in the frame of the hand,
 * which the pose's hand position turns about the blade: from the side of the edge the camera sees the outside of it, a
 * shield over the fist with the blade coming out of it; from the side of the thumb it looks into it, and sees the fist
 * in it; and side on it is a crescent in front of and under the fingers.
 *
 * Returns, back to front: the blade when its root is behind the guard, `back`; the inside of the guard the camera sees,
 * `inside` (its line of ink `o`, its shape `g`, shaded `k`); the grip, a dark rod, `grip`; the pommel, `pommel`, when it
 * is behind the fist; the fist, `fist` (`o`, `g`, its lines `d`, `k`); the pommel again, `butt`, when it is in front of
 * the fist; the outside of the guard the camera sees, its line of ink `o`, its shape `g` and its shading `k`; and the
 * blade, `front`, when its root is in front of the guard.
 */
export function bladePart(J, W, hilt = hiltParts()) {
  const G = gripFrame(J, W);
  const sheet = guardSheet(hilt.guard);
  const facing = sheet.normals.map((row) => row.map((n) => W.depth(G.step(n))));
  // A point of the sheet, `i` rows along it and `v` across it, on the page.
  const sheetAt = (i, v) => {
    const row = sheet.rows[i];
    const at = ((v + 1) / 2) * sheet.m;
    const j = Math.min(sheet.m - 1, Math.floor(at));
    const q = add3(mul3(row[j], 1 - (at - j)), mul3(row[j + 1], at - j));
    return W(G.point(q));
  };
  const [outsideAt, insideAt] = [sheetSide(facing, sheet.m, 1), sheetSide(facing, sheet.m, -1)];
  const [outsideShapes, insideShapes] = [outsideAt, insideAt].map((shapes) => shapes.map((shape) => simplify(shape.map(([i, v]) => sheetAt(i, v)), 0.06, true)));

  // The blade comes out of the sheet where the curve crosses its line, and is drawn in front of the guard if the camera
  // sees the outside of the sheet there.
  const { rows } = sheet;
  const middle = sheet.m / 2;
  let exit = 1;
  while (exit < rows.length - 1 && rows[exit][middle][1] < 0) exit++;
  const [r0, r1] = [rows[exit - 1][middle], rows[exit][middle]];
  const cut = r0[1] / (r0[1] - r1[1]);
  const root = G.point([r0[0] + (r1[0] - r0[0]) * cut, 0, 0]);
  const b0 = W(root);
  const b1 = W(J.tip);
  const n = perp(unit(b0, b1));
  const steel = `M${[add(b0, mul(n, 0.62)), add(b1, mul(n, 0.18)), sub(b1, mul(n, 0.18)), sub(b0, mul(n, 0.62))].map(pt).join("L")}Z`;
  const inFront = facing[exit][middle] > 0;

  // The grip, dark, and the pommel, a nut of steel at its end, flat where it meets the grip and domed at the end, with
  // a ring round it by the flat face; in front of the fist where it is nearer the camera than the heel of the hand.
  const { grip, pommel } = hilt;
  const rod = hull([grip.from, grip.to].flatMap((x) => ring3(G.point([x, 0, 0]), G.a, grip.radius).map(W)));
  const face = G.point([pommel.from, 0, 0]);
  const nut = drawn([hull([...ring3(face, G.a, pommel.radius).map(W), ...circle(W(G.point([pommel.to + pommel.radius * 0.8, 0, 0])), pommel.radius * 0.92)])], 0.2, 0.6);
  // The near half of the ring, which the camera sees.
  const ringAt = ring3(G.point([pommel.from - 0.3, 0, 0]), G.a, pommel.radius * 1.01, 24);
  const centre = G.point([pommel.from - 0.3, 0, 0]);
  const near = ringAt.map((q) => W.depth(sub3(q, centre)) >= -0.05);
  const start = near.findIndex((seen, i) => seen && !near[(i + ringAt.length - 1) % ringAt.length]);
  const ringLine = [];
  if (start >= 0) for (let i = start; near[i % ringAt.length] && ringLine.length < ringAt.length; i++) ringLine.push(W(ringAt[i % ringAt.length]));
  const butt = W.depth(sub3(G.point([pommel.to, 0, 0]), G.point([-8, 0, 0]))) > 2.5;
  const pommelPart = { ...nut, d: ringLine.length > 1 ? line(ringLine) : "" };
  const none = { o: "", g: "", d: "" };

  const fist = fistPart(J, W, G, hilt);

  // Shading along the rim of the sheet, as the plates hatch the steel: long strokes a little in from the edge, on the
  // inside the camera sees, which is in shadow, and on the outside where it turns from the light, the lower right of
  // the page. Each runs along a stretch of rows where the shape's edge is the rim.
  const hatch = (shapes, keep) => {
    let strokes = "";
    for (const shape of shapes) {
      for (const edge of [-1, 1]) {
        const rows = shape.filter(([, v]) => v === edge).map(([i]) => i).sort((a, b) => a - b);
        for (let s = 0; s + 2 < rows.length; s += 3) {
          const [i0, i1, i2] = [rows[s], rows[s + 1], rows[s + 2]];
          if (i2 - i0 !== 2) continue;
          const points = [sheetAt(i0, edge * 0.8), sheetAt(i1, edge * 0.8), sheetAt(i2, edge * 0.8)];
          if (keep(points, sheetAt(i1, edge))) strokes += brush(points, 0.32, 0.5);
        }
      }
    }
    return strokes;
  };
  const shade = hatch(insideAt, () => true);
  // On the outside, only where the steel turns from the light: where the rim is down and to the right of the stroke.
  const k2 = hatch(outsideAt, (points, edge) => dot(sub(edge, points[1]), [0.6, 0.8]) > 0);
  const outer = drawn(outsideShapes, 0.22, 0.75);
  const inner = drawn(insideShapes, 0.2, 0.6);
  return {
    back: inFront ? "" : steel,
    inside: { o: inner.o, g: inner.g, k: shade },
    grip: rod.length > 2 ? blob(rod) : "",
    pommel: butt ? none : pommelPart,
    fist,
    butt: butt ? pommelPart : none,
    o: outer.o,
    g: outer.g,
    k: k2,
    front: inFront ? steel : "",
  };
}
