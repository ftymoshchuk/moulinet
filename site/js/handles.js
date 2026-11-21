// The parts of a fencer that can be dragged on the stage in the Creator, instead of moving
// sliders: a dot on each, which the person takes hold of and moves where it should be.
//
// Each part is a point of the skeleton, and the few joints of the pose that move it. A drag
// says where on the stage the point should be; `solve` finds the values of those joints that
// put it nearest there, as the camera sees it, so it works from any side of the piste. The
// joints are the ones the sliders have, within the ranges of the sliders, and what a drag
// does not move is left as it is.
import { projector, skeleton } from "./figure.js";
import { JOINTS } from "./library.js";

/**
 * The parts, each with a name for what it is, the point of the skeleton it follows and the
 * joints of the pose that move it. A part that follows an arm's end moves the arm as a
 * whole (the hand has both of its joints, so it goes where it is taken, bending the elbow
 * as it must); one that follows a joint in the middle only turns what is up to it (the
 * elbow turns the upper arm). Joints a drag cannot show, such as how far an arm is turned
 * toward the camera, how the hand is turned about the blade or how the shoulders are
 * turned, stay with the sliders.
 */
export const HANDLES = [
  { id: "backFoot", name: "back foot", at: (J) => J.ankB, params: ["x"] },
  { id: "frontFoot", name: "front foot", at: (J) => J.ankF, params: ["footF", "liftF"] },
  { id: "hips", name: "hips", at: (J) => J.hip, params: ["hipX", "hipY"] },
  { id: "head", name: "head", at: (J) => J.hd, params: ["lean"] },
  { id: "swordElbow", name: "sword elbow", at: (J) => J.el, params: ["arm"] },
  { id: "swordHand", name: "sword hand", at: (J) => J.hn, params: ["arm", "fore"] },
  { id: "bladeTip", name: "blade tip", at: (J) => J.tip, params: ["blade"] },
  { id: "rearElbow", name: "rear elbow", at: (J) => J.re, params: ["rArm"] },
  { id: "rearHand", name: "rear hand", at: (J) => J.rh, params: ["rArm", "rFore"] },
];

const LIMITS = new Map(JOINTS.map(({ key, min, max }) => [key, { min, max }]));
// Joints that go all the way round, so that past one end is the other.
const ROUND = new Set(JOINTS.filter(({ min, max }) => min === -180 && max === 180).map(({ key }) => key));

// Each step of the search takes differences this far (cm or degrees), and settles with this much weight against
// moving a joint at all, so that a joint the camera cannot see move stays where it is. A step moves a joint no
// further than MOST.
const STEP = 0.5;
const DAMPING = 0.02;
const MOST = 40;
const ROUNDS = 14;
// The search stops when the point is this near (cm).
const NEAR = 0.02;

/** Where on the stage a part of a fencer is: the point of the skeleton it follows, placed on the piste and turned for the camera. */
export function placeOf(pose, dir, camera, handle) {
  return projector(pose, dir, camera)(handle.at(skeleton(pose)));
}

// A value held to the range of its slider, or turned round past the end of one that goes all the way round. A value that
// starts outside the range, as one typed into the phrase data can, may stay where it is: `start` widens the range to
// take it in, so taking hold of a part does not move it.
function held(key, value, start) {
  if (ROUND.has(key)) return ((((value + 180) % 360) + 360) % 360) - 180;
  const { min, max } = LIMITS.get(key);
  return Math.min(Math.max(max, start), Math.max(Math.min(min, start), value));
}

// The solution of a linear system of one or two unknowns.
function linear(a, b) {
  if (b.length === 1) return [b[0] / a[0][0]];
  const det = a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return [(b[0] * a[1][1] - a[0][1] * b[1]) / det, (a[0][0] * b[1] - b[0] * a[1][0]) / det];
}

/**
 * The values of a part's joints that put it nearest `target`, a point of the stage in its units (cm), for a fencer
 * in `pose` facing `dir`, seen from `camera`. They are whole numbers within the ranges of the sliders, and start from
 * the pose's own, so a part taken a little further goes a little further. Returns `{ joint: value }` for the part's
 * joints, and leaves `pose` alone.
 */
export function solve(pose, dir, camera, handle, target) {
  const keys = handle.params;
  const start = Object.fromEntries(keys.map((key) => [key, Number(pose[key]) || 0]));
  const values = { ...start };
  const place = (v) => placeOf({ ...pose, ...v }, dir, camera, handle);
  for (let round = 0; round < ROUNDS; round++) {
    const here = place(values);
    const miss = [target[0] - here[0], target[1] - here[1]];
    if (Math.hypot(miss[0], miss[1]) < NEAR) break;
    // How the point moves for a little of each joint.
    const columns = keys.map((key) => {
      const there = place({ ...values, [key]: values[key] + STEP });
      return [(there[0] - here[0]) / STEP, (there[1] - here[1]) / STEP];
    });
    // The least squares, held back a little: (J'J + d I) step = J' miss.
    const a = columns.map((u, i) => columns.map((v, j) => u[0] * v[0] + u[1] * v[1] + (i === j ? DAMPING : 0)));
    const b = columns.map((u) => u[0] * miss[0] + u[1] * miss[1]);
    const step = linear(a, b);
    let moved = 0;
    keys.forEach((key, i) => {
      const by = Math.max(-MOST, Math.min(MOST, step[i]));
      const next = held(key, values[key] + by, start[key]);
      moved = Math.max(moved, Math.abs(next - values[key]));
      values[key] = next;
    });
    if (moved < 1e-4) break;
  }
  return Object.fromEntries(keys.map((key) => [key, held(key, Math.round(values[key]), start[key])]));
}

// ---------- The stage and the page ----------
//
// The stage is shown in a mirror (`.stage__frame` in styles.css), and the dots lie over it, placed by what share of
// the way across and down the stage's box each is, which the mirror turns with the rest. A point of the page is
// turned back the same way to find its place on the stage.

/** What share of the way across and down the stage `point` is, as the stage's box is drawn before the mirror: [0, 1] each way inside it. */
export function shareOf(point, view) {
  return [(point[0] - view[0]) / view[2], (point[1] - view[1]) / view[3]];
}

/**
 * Where on the stage, in its units, a point of the page is: `client` the point as the page gives it, `box` the stage's
 * rectangle on the page (left, top, width and height), `view` what the stage looks at (x, y, width and height) and
 * `mirrored` whether the stage is shown in a mirror.
 */
export function stagePoint(client, box, view, mirrored) {
  const across = (client[0] - box.left) / box.width;
  const down = (client[1] - box.top) / box.height;
  return [view[0] + (mirrored ? 1 - across : across) * view[2], view[1] + down * view[3]];
}
