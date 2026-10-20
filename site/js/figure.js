// Fencers drawn in pen and ink, as SVG path data.
//
// The body is worked out in centimetres, y up, facing +x with the back foot at
// 0; a projector then places it on the piste and turns it for the camera,
// which swings around a point on the piste. Out come SVG units, y down.
import { bladePart, footSpan, headPart, legPart, rearArm, swordArm, torsoFrame, trunk } from "./body.js";
import { groundStrokes } from "./folds.js";
import { handParts } from "./parts.js";
import { poseAt } from "./phrase.js";

// The camera turns around this point on the piste (cm).
export const PIVOT = 115;

const RAD = Math.PI / 180;
// Thigh and shin, hip to ankle (cm).
const THIGH = 44;
const SHIN = 46;
// The sword arm: shoulder to elbow, and elbow to the grip (the forearm and the hand round it).
const UPPER_ARM = 31;
const FOREARM = 31;
// Half the width between the shoulder joints (cm).
const SHOULDER = 19;
// How far the knee of the leg behind is turned from bending straight back toward the camera (degrees): over the back foot, which points at the camera.
const KNEE_OUT = 40;

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
 * The knee of the leg behind, as [x, y, z] with z toward the camera. It bends
 * back, and is turned out toward the camera about the line from hip to ankle,
 * over the foot, which points that way: seen side on, the leg is shorter and the
 * knee a little forward and low, as in the plates, though thigh and shin are the
 * same lengths. A leg that is straight has nowhere to turn.
 */
export function kneeBehind(hx, hy, ax, ay) {
  const [kx, ky] = knee(hx, hy, ax, ay, -1);
  const d = Math.hypot(ax - hx, ay - hy);
  if (d < 1) return [kx, ky, 0];
  const [ux, uy] = [(ax - hx) / d, (ay - hy) / d];
  // Where the knee is on the line from hip to ankle, and how far it is off it.
  const along = (kx - hx) * ux + (ky - hy) * uy;
  const [ox, oy] = [kx - hx - along * ux, ky - hy - along * uy];
  const turn = KNEE_OUT * RAD;
  return [hx + along * ux + ox * Math.cos(turn), hy + along * uy + oy * Math.cos(turn), Math.hypot(ox, oy) * Math.sin(turn)];
}

/** Every joint of a pose, plus `at(k)`: the point k cm along the blade from the hand. */
export function skeleton(p) {
  const hip = [p.hipX, p.hipY];
  const ankB = [0, 8 + Math.max(0, p.liftB)];
  const ankF = [p.footF, 8 + Math.max(0, p.liftF)];
  const kB = kneeBehind(hip[0], hip[1], ankB[0], ankB[1]);
  const kF = knee(hip[0], hip[1], ankF[0], ankF[1]);
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
  const nk = T(58, 0);
  // The head is thrust forward of the shoulders on a neck, as the plates have it.
  const hd = T(73.6, 3);
  const el = [sh[0] + UPPER_ARM * Math.cos(p.arm * RAD), sh[1] + UPPER_ARM * Math.sin(p.arm * RAD), sh[2]];
  const hn = [el[0] + FOREARM * Math.cos(p.fore * RAD), el[1] + FOREARM * Math.sin(p.fore * RAD), sh[2]];
  const bp = p.blade * RAD;
  const by = p.yaw * RAD;
  const bd = [Math.cos(bp) * Math.cos(by), Math.sin(bp) * Math.cos(by), Math.sin(by)];
  const at = (k) => [hn[0] + k * bd[0], hn[1] + k * bd[1], hn[2] + k * bd[2]];
  const ra = (p.rArm - p.lean) * RAD;
  const rf = (p.rFore - p.lean) * RAD;
  const rs = [...T(48, -back), across];
  const re = [rs[0] + 28 * Math.cos(ra), rs[1] + 28 * Math.sin(ra), rs[2]];
  const rh = [re[0] + 25 * Math.cos(rf), re[1] + 25 * Math.sin(rf), rs[2]];
  return { hip, ankB, ankF, kB, kF, u, f, T, sh, nk, hd, el, hn, bp, at, tip: at(88), rs, re, rh, lean: p.lean, turn: p.turn };
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
  W.camera = camera;
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
      `M${S(J.hip)}L${S(J.kB)}L${S(J.ankB)}M${S(J.hip)}L${S(J.kF)}L${S(J.ankF)}` +
      `M${S(J.hip)}L${S(J.nk)}M${S(J.sh)}L${S(J.el)}L${S(J.hn)}` +
      `M${S(J.rs)}L${S(J.re)}L${S(J.rh)}` +
      `M${(h[0] - 10).toFixed(1)} ${h[1].toFixed(1)}a10 10 0 1 0 20 0a10 10 0 1 0 -20 0`,
    blade: `M${S(J.at(-7))}L${S(J.tip)}`,
  };
}

/**
 * The pen-and-ink fencer. Each layer is a merged silhouette (`g`) with its thin
 * lines (`d`) and its brush strokes (`k`); l1 is drawn first and l6 last, with
 * the head between l4 and l6. The blade goes over both fencers.
 *
 * `backView` draws the sword arm on the far side, as the camera sees the
 * fencer facing right; `older` draws an older man, balding, in loose trousers
 * instead of knickerbockers.
 */
export function inkFigure(p, dir, camera, { backView = false, older = false } = {}) {
  // A pose held on a step, or a page left paused, is drawn again and again: the
  // last drawing of each pose object is kept, for the same view. A pose is never
  // changed once made, so the drawing cannot go stale.
  const view = `${dir} ${camera} ${backView} ${older}`;
  const kept = DRAWN.get(p);
  if (kept?.view === view) return kept.figure;
  const figure = draw(p, dir, camera, backView, older);
  DRAWN.set(p, { view, figure });
  return figure;
}

const DRAWN = new WeakMap();

function draw(p, dir, camera, backView, older) {
  const J = skeleton(p);
  const W = projector(p, dir, camera);
  const hands = handParts();
  const frame = torsoFrame(J, W, older);
  const torso = trunk(J, W, older, frame);
  const sword = swordArm(J, W, hands.fist);
  const rear = rearArm(J, W, hands.hip, frame);
  // The hips and seat belong to the leg nearer the camera.
  const legF = legPart(J, W, J.ankF, J.kF, { front: true, seat: !backView, older });
  const legB = legPart(J, W, J.ankB, J.kB, { front: false, seat: backView, older });

  // Strokes on the floor under each planted foot, shorter as it lifts. The foot behind is turned across, so they go all round it.
  const ground = (ank, front) => {
    const lift = ank[1] - 8;
    return lift > 5 ? "" : groundStrokes(W, ank, front, front ? 7 : 9, 1 - lift / 6, front ? undefined : footSpan(W));
  };

  // Draw order: what the camera sees first goes last.
  const order = backView ? [sword, legF, legB, torso, rear] : [rear, legB, legF, torso, sword];
  return {
    l1: order[0],
    l2: order[1],
    l3: order[2],
    l4: order[3],
    head: headPart(J, W, older),
    l6: order[4],
    blade: bladePart(J, W),
    ground: ground(J.ankF, true) + ground(J.ankB, false),
  };
}

// How the stage looks at the piste unless a phrase asks for closer: x, y, width
// and height in the page's units. Every view has this shape.
export const DEFAULT_FRAME = [-80, -236, 420, 254];
const FRAME_SHAPE = DEFAULT_FRAME[2] / DEFAULT_FRAME[3];

/**
 * Where the stage should look so that the fencers fill it: the box round everyone
 * at every moment of the phrase, seen side on, with room round it, in the shape of
 * the default view and no closer than a third of the way in. The camera does not
 * change it, so turning the camera never zooms.
 */
export function frameOf(timeline) {
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
      const body = [[J.hd[0], J.hd[1] + 14], J.hn, J.tip, J.kF, J.kB, J.re, J.rs, [J.hip[0] - 16, J.hip[1]], [J.hip[0] + 16, J.hip[1]]];
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
