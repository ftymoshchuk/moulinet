// A fencer's skeleton, worked out from a pose's numbers, and the camera that
// looks at it: where the stage looks, the motion ghosts, the blade paths and the
// marks on the floor. The figures themselves are drawn in 3D (stage3d.js), on
// this skeleton.
//
// The body is worked out in centimetres, y up, facing +x with the back foot at
// 0; a projector then places it on the piste and turns it for the camera,
// which swings around a point on the piste. Out come SVG units, y down.
import { poseAt } from "./phrase.js";

// The camera turns around this point on the piste (cm).
export const PIVOT = 115;

const RAD = Math.PI / 180;
// Thigh and shin, hip to ankle (cm).
const THIGH = 44;
const SHIN = 46;
// The sword arm: shoulder to elbow, and elbow to the grip (the forearm and the hand round it).
const UPPER_ARM = 32;
const FOREARM = 37;
// Half the width between the shoulder joints (cm).
const SHOULDER = 22;
// Half the width between the hip joints (cm), and how much of the shoulders' turn toward the camera the hips take.
const PELVIS = 8;
const HIPS = 0.85;
// How far the knee of the leg behind is turned out toward the camera from bending straight back (degrees), over the
// back foot, which points at the camera: the first with its hip as far forward of that foot as the guard has it, where
// the plates draw the knee bent back over the foot, and the second with the hip right over the foot, where the weight
// sits back and the knee turns out over the toes. Between the two, it turns out as far as the hip is back. The first
// is the guard's `kneeOut`, and a pose's own `kneeOut` scales both, so 0 is a flat knee however far back the hip is.
const KNEE_OUT = [40, 80];
// How far forward of the back foot the hip of the leg behind is in the guard (cm).
const HIPS_FORWARD = 35;
// How much of the body's lean the neck takes. The rest it takes back, so the head is held up and the eyes stay level, as in the plates.
const NECK = 0.3;
// The sabre, from the hand to the point (cm).
const BLADE = 88;

function fmt(point) {
  return `${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
}

/** The knee for a hip and an ankle; it bends forward, and a leg too short to reach goes straight. */
export function knee(hx, hy, ax, ay, side = 1) {
  const dx = ax - hx;
  const dy = ay - hy;
  const d = Math.hypot(dx, dy);
  if (d >= THIGH + SHIN - 0.05 || d < 1) {
    return [hx + (dx * THIGH) / (THIGH + SHIN), hy + (dy * THIGH) / (THIGH + SHIN)];
  }
  const towardAnkle = Math.atan2(dy, dx);
  const bend = Math.acos(Math.max(-1, Math.min(1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d))));
  return [hx + THIGH * Math.cos(towardAnkle + side * bend), hy + THIGH * Math.sin(towardAnkle + side * bend)];
}

/**
 * The knee of a leg from the hip `h` to the ankle `a`, each as [x, y, z] with z
 * toward the camera, keeping thigh and shin their lengths. It bends forward
 * (`side` 1) or back (-1), square to the line from hip to ankle and as near the
 * plane of the piste as it can, and is then turned `out` degrees about that line
 * toward the camera. A leg too short to reach goes straight.
 */
export function knee3(h, a, side = 1, out = 0) {
  const D = [a[0] - h[0], a[1] - h[1], a[2] - h[2]];
  const d = Math.hypot(...D);
  if (d >= THIGH + SHIN - 0.05 || d < 1) return h.map((v, i) => v + (D[i] * THIGH) / (THIGH + SHIN));
  const u = D.map((v) => v / d);
  // Where the knee is along the line from hip to ankle, and how far off it.
  const along = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * d);
  const r = Math.sqrt(Math.max(0, THIGH * THIGH - along * along));
  // The way it bends: a quarter turn from the line, on the piste, and square to the line in depth too.
  const turned = [-u[1] * side, u[0] * side, 0];
  const dot = turned[0] * u[0] + turned[1] * u[1];
  const b = [turned[0] - dot * u[0], turned[1] - dot * u[1], -dot * u[2]];
  const bl = Math.hypot(...b) || 1;
  const bend = b.map((v) => v / bl);
  // Square to both, toward the camera.
  let w = [u[1] * bend[2] - u[2] * bend[1], u[2] * bend[0] - u[0] * bend[2], u[0] * bend[1] - u[1] * bend[0]];
  if (w[2] < 0) w = w.map((v) => -v);
  const c = Math.cos(out * RAD);
  const s = Math.sin(out * RAD);
  return h.map((v, i) => v + u[i] * along + r * (c * bend[i] + s * w[i]));
}

/**
 * The knee of the leg behind, as [x, y, z] with z toward the camera. It bends
 * back, and is turned out toward the camera about the line from hip to ankle,
 * over the foot, which points that way: seen side on, the leg is shorter and the
 * knee a little forward and low, as in the plates, though thigh and shin are the
 * same lengths. A leg that is straight has nowhere to turn. `hz` is how far the
 * hip is toward the camera; the ankle is on the line of the piste. `kneeOut` is
 * the pose's: how far it is turned out with the hip as far forward as in the
 * guard, and further, in proportion, as the hip sits back over the foot, but
 * never past straight at the camera. At 0 the knee is flat.
 */
export function kneeBehind(hx, hy, ax, ay, hz, kneeOut) {
  const forward = Math.max(0, Math.min(1, (hx - ax) / HIPS_FORWARD));
  const out = (kneeOut / KNEE_OUT[0]) * (KNEE_OUT[1] + (KNEE_OUT[0] - KNEE_OUT[1]) * forward);
  return knee3([hx, hy, hz], [ax, ay, 0], -1, Math.max(0, Math.min(90, out)));
}

/** Every joint of a pose, plus `at(k)`: the point k cm along the blade from the hand. */
export function skeleton(p) {
  const hip = [p.hipX, p.hipY];
  // The hips are turned toward the camera with the shoulders, though not as far:
  // the joint of the leg behind is on the near side and back, the other on the
  // far side and forward, each as [x, y, z].
  const pelvis = p.turn * HIPS * RAD;
  const hipF = [hip[0] + PELVIS * Math.sin(pelvis), hip[1], -PELVIS * Math.cos(pelvis)];
  const hipB = [hip[0] - PELVIS * Math.sin(pelvis), hip[1], PELVIS * Math.cos(pelvis)];
  const ankB = [0, 8 + Math.max(0, p.liftB)];
  const ankF = [p.footF, 8 + Math.max(0, p.liftF)];
  const kB = kneeBehind(hipB[0], hipB[1], ankB[0], ankB[1], hipB[2], p.kneeOut);
  // The knee in front bends forward toward its foot, which points at the opponent.
  const kF = knee3(hipF, [ankF[0], ankF[1], 0], 1);
  // Up the torso, and forward across it.
  const u = [Math.sin(p.lean * RAD), Math.cos(p.lean * RAD)];
  const f = [u[1], -u[0]];
  const T = (a, b) => [hip[0] + u[0] * a + f[0] * b, hip[1] + u[1] * a + f[1] * b];
  // The shoulders are turned toward the camera by `turn`: the sword shoulder, on
  // the far side, and the rear one, on the near side, swing apart, and each arm
  // lies in a plane of its own, at its shoulder's distance from the camera.
  const across = SHOULDER * Math.cos(p.turn * RAD);
  const back = SHOULDER * Math.sin(p.turn * RAD);
  // The sword shoulder is the one turned away, at the front of the chest.
  const sh = [...T(50, back * 0.9), -across];
  // The base of the neck is on the torso, and the neck leans only part of the way the torso does.
  const nk = T(57, 2.5);
  const neck = p.lean * NECK * RAD;
  const nu = [Math.sin(neck), Math.cos(neck)];
  const nf = [nu[1], -nu[0]];
  // A point of the neck's frame: `a` up the neck from its base and `b` forward of it.
  const N = (a, b) => [nk[0] + nu[0] * a + nf[0] * b, nk[1] + nu[1] * a + nf[1] * b];
  // The head is carried forward of the shoulders on the neck, as the plates have it.
  const hd = N(15.5, 6.5);
  const el = [sh[0] + UPPER_ARM * Math.cos(p.arm * RAD), sh[1] + UPPER_ARM * Math.sin(p.arm * RAD), sh[2]];
  const hn = [el[0] + FOREARM * Math.cos(p.fore * RAD), el[1] + FOREARM * Math.sin(p.fore * RAD), sh[2]];
  const bp = p.blade * RAD;
  const by = p.yaw * RAD;
  const bd = [Math.cos(bp) * Math.cos(by), Math.sin(bp) * Math.cos(by), Math.sin(by)];
  const at = (k) => [hn[0] + k * bd[0], hn[1] + k * bd[1], hn[2] + k * bd[2]];
  const ra = (p.rArm - p.lean) * RAD;
  const rf = (p.rFore - p.lean) * RAD;
  const rs = [...T(48, -back), across];
  const re = [rs[0] + 30 * Math.cos(ra), rs[1] + 30 * Math.sin(ra), rs[2]];
  const rh = [re[0] + 25 * Math.cos(rf), re[1] + 25 * Math.sin(rf), rs[2]];
  return { hip, hipF, hipB, ankB, ankF, kB, kF, u, f, T, sh, nk, nu, nf, N, hd, el, hn, bp, at, tip: at(BLADE), rs, re, rh, lean: p.lean, turn: p.turn, toeBack: p.toeBack, hand: p.hand };
}

/**
 * Places body points on the piste and turns them for the camera. `dir` is 1
 * for a fencer facing right and -1 for one facing left.
 */
export function projector(p, dir, camera) {
  const c = Math.cos(camera * RAD);
  const s = Math.sin(camera * RAD);
  const W = (q) => [(p.x + dir * q[0] - PIVOT) * c + dir * (q[2] || 0) * s + PIVOT, -q[1]];
  // For a shape worked out as the camera sees it, across the page and up: `u` is
  // forward along the camera's way of looking, that is c * forward + s * toward the camera.
  W.flat = ([u, y]) => [(p.x - PIVOT) * c + PIVOT + dir * u, -y];
  // How far a step `v` in the body's frame goes toward the camera.
  W.depth = (v) => dir * ((v[2] || 0) * c - v[0] * s);
  W.camera = camera;
  W.dir = dir;
  return W;
}

export function bladeTip(p, dir, camera) {
  return fmt(projector(p, dir, camera)(skeleton(p).tip));
}

/** A quick line drawing of a pose: the motion ghosts. */
export function stickFigure(p, dir, camera) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const S = (q) => fmt(W(q));
  const h = W(J.hd);
  return {
    body:
      `M${S(J.hipB)}L${S(J.kB)}L${S(J.ankB)}M${S(J.hipF)}L${S(J.kF)}L${S(J.ankF)}` +
      `M${S(J.hipB)}L${S(J.hipF)}M${S(J.hip)}L${S(J.nk)}M${S(J.sh)}L${S(J.el)}L${S(J.hn)}` +
      `M${S(J.rs)}L${S(J.re)}L${S(J.rh)}` +
      `M${(h[0] - 10).toFixed(1)} ${h[1].toFixed(1)}a10 10 0 1 0 20 0a10 10 0 1 0 -20 0`,
    blade: `M${S(J.at(-7))}L${S(J.tip)}`,
  };
}

// The shoe of each foot, from the ankle, back to the heel and on to the toe, and half as wide (cm).
const SHOE = { heel: 7, toe: 21, half: 5 };

// A stroke of the pen along the floor from x0 to x1, y below it, `width` thick in the middle and tapering to points.
function floorStroke(x0, x1, y, width) {
  const [a, b, m] = [x0.toFixed(1), x1.toFixed(1), ((x0 + x1) / 2).toFixed(1)];
  return `M${a} ${y.toFixed(1)}Q${m} ${(y - width).toFixed(1)} ${b} ${y.toFixed(1)}Q${m} ${(y + width).toFixed(1)} ${a} ${y.toFixed(1)}Z`;
}

/**
 * The marks on the floor under a fencer's planted feet, as the plates draw them: three strokes of the pen under each
 * shoe, as long as the camera sees the shoe reach across the piste and shorter each, which shrink as the foot lifts
 * and are gone once it is clear of the floor.
 */
export function groundPath(p, dir, camera) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const tb = (p.toeBack ?? 0) * RAD;
  let d = "";
  for (const [ankle, along] of [[J.ankF, [1, 0]], [J.ankB, [-Math.sin(tb), Math.cos(tb)]]]) {
    const lift = ankle[1] - 8;
    if (lift > 5) continue;
    // The corners of the sole, on the floor, across the page.
    const xs = [];
    for (const length of [-SHOE.heel, SHOE.toe]) {
      for (const across of [-SHOE.half, SHOE.half]) xs.push(W([ankle[0] + along[0] * length - along[1] * across, 0, along[1] * length + along[0] * across])[0]);
    }
    const shrink = 1 - lift / 6;
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
    const half = ((Math.max(...xs) - Math.min(...xs)) / 2 + 6) * shrink;
    d += floorStroke(middle - half, middle + half + 3, 1.3, 1.0) + floorStroke(middle - half * 0.75, middle + half * 0.8, 3.0, 0.8) + floorStroke(middle - half * 0.45, middle + half * 0.5, 4.5, 0.6);
  }
  return d;
}

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit3(a) {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * The frame of the hand on the blade, in the body's frame: `a` along the blade toward its point, `e` the way the edge
 * faces and `s` the way the palm faces. `point(q)` sets a point q = [x, y, z] of that frame, x cm along the blade, y
 * toward the edge and z toward the palm, in the body's frame; `step(v)` does the same for a step.
 *
 * In the third position the edge faces the way the blade turns as it cuts in the plane of the arm: down from a blade
 * held forward, forward from one held up. The pose's `hand` turns it about the blade from there, toward the inside of
 * the sword arm as it grows: the second position, at -90, has the palm down and the edge out; the fourth, at 90, the
 * palm up and the edge in; and the first, at -180, the thumb down and the edge up.
 */
export function gripFrame(J) {
  const a = unit3(sub3(J.at(1), J.at(0)));
  const third = [Math.sin(J.bp), -Math.cos(J.bp), 0];
  const inward = cross3(third, a);
  const t = (J.hand ?? 0) * RAD;
  const e = add3(mul3(third, Math.cos(t)), mul3(inward, Math.sin(t)));
  const s = add3(mul3(third, -Math.sin(t)), mul3(inward, Math.cos(t)));
  const step = ([x, y, z]) => add3(add3(mul3(a, x), mul3(e, y)), mul3(s, z));
  return { a, e, s, step, point: (q) => add3(J.hn, step(q)) };
}

// How the stage looks at the piste unless a phrase asks for closer: x, y, width
// and height in the page's units. Every view has this shape.
export const DEFAULT_FRAME = [-80, -236, 420, 254];
const FRAME_SHAPE = DEFAULT_FRAME[2] / DEFAULT_FRAME[3];

/**
 * Where the stage should look so that the fencers fill it: the box round everyone
 * at every moment of the phrase, seen side on, with room round it, in the shape of
 * the default view and no closer than a third of the way in. The camera does not
 * change it, so turning the camera never zooms. The box holds the blade as far
 * along as `blade` cm from the hand, all of it unless told less: a blade held up
 * or reaching far then no longer sets the view for the body, and its point may
 * run off the edge.
 */
export function frameOf(timeline, blade = BLADE) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const take = ([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  // At every step, and between them.
  const times = timeline.steps.map((step) => step.holdStart);
  for (let i = 0; i <= 24; i++) times.push((timeline.duration * i) / 24);
  for (const t of times) {
    const at = poseAt(timeline, Math.min(t, timeline.duration));
    for (const [who, dir] of timeline.solo ? [["A", 1]] : [["A", 1], ["B", -1]]) {
      const p = at[who];
      const J = skeleton(p);
      const W = projector(p, dir, 0);
      const feet = [-8, 24].flatMap((reach) => [[J.ankB[0] + reach, 0], [J.ankF[0] + reach, 0]]);
      const body = [[J.hd[0], J.hd[1] + 14], J.hn, J.at(blade), J.kF, J.kB, J.re, J.rs, [J.hipB[0] - 14, J.hip[1]], [J.hipF[0] + 14, J.hip[1]]];
      for (const q of [...feet, ...body]) take(W(q));
    }
  }
  // Room round it, and for the strokes under the floor.
  maxY = Math.max(maxY, 0) + 8;
  const width = Math.max(maxX - minX + 36, (maxY - minY + 24) * FRAME_SHAPE, DEFAULT_FRAME[2] * 0.72);
  const w = Math.min(width, DEFAULT_FRAME[2] * 1.3);
  const h = w / FRAME_SHAPE;
  // Centred across, and set down on the floor.
  const x = (minX + maxX) / 2 - w / 2;
  const y = maxY + 6 - h;
  return [x, y, w, h].map((v) => Math.round(v * 10) / 10);
}

// How wide the close-up of a hand is, in the page's units.
const HAND_VIEW = 54;

/**
 * Where the stage looks for a close-up of a fencer's sword hand: a box in the
 * shape of every view round the hand as the camera sees it, centred between the
 * wrist and the forte of the blade, so the fist, the hilt and the start of the
 * blade are all in it.
 */
export function handFrame(p, dir, camera) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const [fx, fy] = [J.hn[0] - J.el[0], J.hn[1] - J.el[1]];
  const l = Math.hypot(fx, fy) || 1;
  const wrist = W([J.hn[0] - (12 * fx) / l, J.hn[1] - (12 * fy) / l, J.hn[2]]);
  const forte = W(J.at(14));
  const [w, h] = [HAND_VIEW, HAND_VIEW / FRAME_SHAPE];
  const [cx, cy] = [(wrist[0] + forte[0]) / 2, (wrist[1] + forte[1]) / 2];
  return [cx - w / 2, cy - h / 2, w, h].map((v) => Math.round(v * 10) / 10);
}

/** The piste: a floor line with a tick every 50 cm and a longer one at the centre. */
export function floorPath(camera) {
  const c = Math.cos(camera * RAD);
  const X = (x) => ((x - PIVOT) * c + PIVOT).toFixed(1);
  let d = `M${X(-600)} 0 H${X(900)}`;
  for (let x = -550; x <= 850; x += 50) d += ` M${X(x)} 0 V${x === 100 ? 6 : 3}`;
  return d;
}

/**
 * Where each blade tip travels over the whole phrase, sampled about every
 * 10 ms (at most 700 times): the times, and the tip of A and of B at each.
 */
export function bladePaths(timeline, camera) {
  const n = Math.max(2, Math.min(700, Math.ceil(timeline.duration / 10)));
  const times = [];
  const a = [];
  const b = [];
  for (let i = 0; i <= n; i++) {
    const t = (timeline.duration * i) / n;
    const q = poseAt(timeline, t);
    times.push(t);
    a.push(bladeTip(q.A, 1, camera));
    b.push(bladeTip(q.B, -1, camera));
  }
  return { times, a, b };
}
