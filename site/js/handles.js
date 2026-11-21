// The parts of a fencer that can be dragged on the stage in the Creator, instead of moving
// sliders: a dot on each, which the person takes hold of and moves where it should be.
//
// Each part is a point of the skeleton, and the few joints of the pose that move it. A drag
// says where on the stage the point should be; `solve` finds the values of those joints that
// put it nearest there, as the camera sees it, so it works from any side of the piste. The
// joints are the ones the sliders have, within the ranges of the sliders, and what a drag
// does not move is left as it is.
//
// The stage shows a fencer from the side, which has height and length but no depth. Beside it
// the plan shows the same fencer from above, which has length and depth but no height, and
// that is where the joints that turn a part toward or away from the camera are dragged: the
// shoulders, the arm and forearm across the chest, the blade across the body, the back knee
// and the back foot. A part is a dot in one view or the other or both, each with the joints
// that move it there.
import { SHOE, footDirections, projector, skeleton, topProjector } from "./figure.js";
import { JOINTS } from "./library.js";

/**
 * The parts, each with a name for what it is, the point of the skeleton it follows and, for each view of it that has the
 * part (`side`, the stage, and `plan`, from above), the joints of the pose that move it there. A part that follows an
 * arm's end moves the arm as a whole (the hand has both of its joints, so it goes where it is taken, bending the elbow
 * as it must); one that follows a joint in the middle only turns what is up to it (the elbow turns the upper arm). A
 * part has no dot in a view that cannot move it: the feet and the hips go along the piste, which the stage shows and
 * the plan only repeats, and the knee is turned out of the stage's plane, so it is dragged from above. Joints a drag
 * cannot show, such as how the hand is turned about the blade, stay with the sliders.
 *
 * From above, a joint that is also on the stage is still one of its part's: the part goes where it is taken along the
 * piste with the joints of the stage, as it does there, and across it with the ones the stage cannot show.
 */
export const HANDLES = [
  { id: "backFoot", name: "back foot", at: (J) => J.ankB, side: ["x"] },
  { id: "frontFoot", name: "front foot", at: (J) => J.ankF, side: ["footF", "liftF"] },
  { id: "hips", name: "hips", at: (J) => J.hip, side: ["hipX", "hipY"] },
  { id: "head", name: "head", at: (J) => J.hd, side: ["lean"] },
  { id: "swordShoulder", name: "sword shoulder", at: (J) => J.sh, plan: ["turn"] },
  { id: "swordElbow", name: "sword elbow", at: (J) => J.el, side: ["arm"], plan: ["arm", "armYaw"] },
  { id: "swordHand", name: "sword hand", at: (J) => J.hn, side: ["arm", "fore"], plan: ["arm", "fore", "armYaw", "foreYaw"] },
  { id: "bladeTip", name: "blade tip", at: (J) => J.tip, side: ["blade"], plan: ["blade", "yaw"] },
  { id: "rearElbow", name: "rear elbow", at: (J) => J.re, side: ["rArm"] },
  { id: "rearHand", name: "rear hand", at: (J) => J.rh, side: ["rArm", "rFore"] },
  { id: "backKnee", name: "back knee", at: (J) => J.kB, plan: ["kneeOut"] },
  { id: "backToe", name: "back toe", at: (J) => backToe(J), plan: ["toeBack"] },
];

// The toe of the back foot, which points across the piste, turned back by the pose's `toeBack`.
function backToe(J) {
  const along = footDirections(J).back;
  return [J.ankB[0] + along[0] * SHOE.toe, J.ankB[1], along[1] * SHOE.toe];
}

/** The joints that move a part in a view of it, "side" or "plan": none if the view has no dot for it. */
export function jointsOf(handle, view = "side") {
  return handle[view] ?? [];
}

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

/**
 * Where on the stage a part of a fencer is: the point of the skeleton it follows, placed on the piste and turned for the
 * camera; or, in the plan (`view` "plan"), seen from above, along the piste the same way and down the page toward the camera.
 */
export function placeOf(pose, dir, camera, handle, view = "side") {
  const project = view === "plan" ? topProjector : projector;
  return project(pose, dir, camera)(handle.at(skeleton(pose)));
}

// A value held to the range of its slider, or turned round past the end of one that goes all the way round. A value that
// starts outside the range, as one typed into the phrase data can, may stay where it is: `start` widens the range to
// take it in, so taking hold of a part does not move it.
function held(key, value, start) {
  if (ROUND.has(key)) return ((((value + 180) % 360) + 360) % 360) - 180;
  const { min, max } = LIMITS.get(key);
  return Math.min(Math.max(max, start), Math.max(Math.min(min, start), value));
}

// The solution of a linear system of any number of unknowns, by elimination from the largest of each column. The systems
// here are held back (see DAMPING), which makes each of their columns count for something, so none is singular.
function linear(a, b) {
  const n = b.length;
  const rows = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let r = col + 1; r < n; r++) {
      const k = rows[r][col] / rows[col][col];
      for (let c = col; c <= n; c++) rows[r][c] -= k * rows[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = rows[r][n];
    for (let c = r + 1; c < n; c++) sum -= rows[r][c] * x[c];
    x[r] = sum / rows[r][r];
  }
  return x;
}

/**
 * The values of a part's joints that put it nearest `target`, a point of the stage in its units (cm), for a fencer
 * in `pose` facing `dir`, seen from `camera`; or, with `view` "plan", a point of the plan, seen from above. They are
 * within the ranges of the sliders, in whole numbers or, with a finer `unit`, in multiples of it, for a view so close that
 * a whole degree is a long step; and they start from the pose's own, so a part taken a little further goes a little
 * further. Returns `{ joint: value }` for the part's joints in that view, and leaves `pose` alone.
 */
export function solve(pose, dir, camera, handle, target, unit = 1, view = "side") {
  const keys = jointsOf(handle, view);
  const start = Object.fromEntries(keys.map((key) => [key, Number(pose[key]) || 0]));
  const values = { ...start };
  const place = (v) => placeOf({ ...pose, ...v }, dir, camera, handle, view);
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
  // In multiples of the unit, with none of the arithmetic's own dust on them.
  const whole = (v) => Number((Math.round(v / unit) * unit).toFixed(6));
  return Object.fromEntries(keys.map((key) => [key, held(key, whole(values[key]), start[key])]));
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
