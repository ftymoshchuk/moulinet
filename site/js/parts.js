// The parts of a fencer that are drawn by hand rather than worked out from the
// bones: the head, with its face and hair, the hands, the shoes, the slices of the
// jersey, and the sabre's hilt with the fist round it. Each is a handful of points
// in a frame of its own, in centimetres, facing +x with +y up (the hilt's frame is
// on the blade, and says so), which figure.js and body.js then set on the body and
// turn for the camera.
import { inside } from "./ink.js";

// The head from the side, as the plates draw it: a long skull and a short, square
// face. From the top of the forehead round the face, under the chin and up the
// back of the head, whose top and back are the outer edge of the hair. Origin is
// the middle of the head: the top of the hair is 12.3 above it and the chin 10.9
// below, and the back of the head 11.2 behind it and the tip of the nose 12.2 in
// front.
const SKULL = [
  [4.2, 11.8],
  [6.9, 10.2],
  [8.6, 7.6], // the hairline
  [10.0, 4.6],
  [10.8, 1.5], // brow
  [10.1, -0.2], // where the nose begins
  [11.0, -1.9],
  [12.2, -3.9], // tip of the nose
  [10.8, -4.6],
  [9.8, -4.9], // under the nose
  [10.2, -5.9], // upper lip
  [9.5, -6.5], // where the lips meet
  [10.0, -7.3], // lower lip
  [9.3, -8.0],
  [10.2, -9.1], // chin
  [8.8, -10.5],
  [4.2, -10.9], // under the jaw
  [0.7, -10.1],
  [-2.2, -7.7], // angle of the jaw
  [-4.8, -6.9],
  [-9.4, -6.5], // the nape
  [-11.0, -3.4],
  [-11.2, 0.6], // the back of the head
  [-10.2, 6.1],
  [-7.2, 10.3],
  [-2.3, 12.3],
];

// Where the hair grows, a little outside the edge of the head, so the strokes of
// it break that edge. A young man's: full over the forehead, over the top and
// down the back of the head to the nape, round the ear, a sideburn in front of
// it, and a hairline that steps back at the temple.
const HAIR_YOUNG = [
  [8.4, 7.8],
  [8.6, 9.4], // the hair lifts off the forehead
  [7.0, 11.4],
  [4.2, 12.7],
  [-1.6, 13.4],
  [-7.0, 11.2],
  [-10.6, 6.6],
  [-11.8, 0.8],
  [-11.6, -3.6],
  [-10.0, -6.8],
  [-8.6, -7.4], // the nape
  [-7.6, -5.8],
  [-6.9, -3.6], // behind the ear
  [-6.9, -0.6],
  [-6.4, 1.9], // over the ear
  [-4.6, 2.9],
  [-2.6, 2.7],
  [-1.7, 1.4],
  [-1.4, -2.2], // the sideburn
  [0.0, -2.0],
  [0.4, 1.0],
  [1.8, 3.6], // the temple
  [3.4, 5.0],
  [5.6, 5.9],
  [7.2, 6.8],
];

// An older man's: bare on top, a ring of hair from above the ear round the back.
const HAIR_OLD = [
  [-5.8, 6.4],
  [-7.6, 9.6],
  [-10.0, 7.6],
  [-11.6, 3.0],
  [-11.8, -2.0],
  [-10.6, -5.6],
  [-8.8, -7.2],
  [-7.6, -5.8],
  [-7.0, -3.4],
  [-6.9, -0.4],
  [-6.4, 2.0],
  [-4.4, 3.2], // over the ear
  [-2.6, 3.0],
  [-1.6, 1.4],
  [-1.4, -1.6], // a short sideburn
  [-0.2, -1.4],
  [0.0, 2.6],
  [-1.4, 4.6],
  [-3.6, 5.6],
];

// The hair is combed round this point of the head: up off the forehead, back over
// the top, and down the back of the head to the nape.
const CROWN = [-1.4, 1.0];

// A point `s` cm on along the comb from `p`.
function combed(p, s) {
  const r = Math.hypot(p[0] - CROWN[0], p[1] - CROWN[1]) || 1;
  const a = Math.atan2(p[1] - CROWN[1], p[0] - CROWN[0]) + s / r;
  return [CROWN[0] + r * Math.cos(a), CROWN[1] + r * Math.sin(a)];
}

// A little steady variation, so the strokes of the hair are not ruled.
function steady(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * The hair as strokes of the pen, laid as it is combed: in rows round the crown,
 * `rows` cm apart, each row a run of strokes about `length` long, end to end,
 * drawn out along the comb as far as the hair goes. Fewer where the light falls
 * on the top of the head, so the hair is darkest at the back and round the ear.
 * Each stroke is [three points, how wide].
 */
function comb(region, { rows, length, width, seed }) {
  const r = steady(seed);
  const reachOf = region.map((p) => Math.hypot(p[0] - CROWN[0], p[1] - CROWN[1]));
  const strokes = [];
  for (let radius = 1.5 + r() * rows; radius < Math.max(...reachOf) + 0.5; radius += rows * (0.85 + r() * 0.3)) {
    const round = 2 * Math.PI * radius;
    for (let along = r() * length; along < round; along += length * (0.8 + r() * 0.4)) {
      const a = along / radius;
      const p = [CROWN[0] + radius * Math.cos(a), CROWN[1] + radius * Math.sin(a)];
      const lit = p[1] > 8.5 && p[0] > -6 ? 0.4 : 0.05;
      if (!inside(region, p) || r() < lit) continue;
      const half = (length * (0.75 + r() * 0.4)) / 2;
      // Heavier toward the back of the head, which is in shadow.
      const shade = Math.max(0, Math.min(1, (-2 - p[0]) / 8));
      // As far along the comb each way as the hair goes, in steps of 4 mm.
      const reach = (way) => {
        let step = 0;
        while (step < half && inside(region, combed(p, way * (step + 0.4)))) step += 0.4;
        return step;
      };
      const [back, on] = [reach(-1), reach(1)];
      if (back + on < 2.2) continue;
      strokes.push([[combed(p, -back), combed(p, (on - back) / 2), combed(p, on)], width * (0.8 + r() * 0.4) * (1 + 0.45 * shade)]);
    }
  }
  return strokes;
}

const COMB_YOUNG = comb(HAIR_YOUNG, { rows: 0.62, length: 5.0, width: 0.66, seed: 17 });
// An older man's hair is grey, thin and short: finer strokes, further apart.
const COMB_OLD = comb(HAIR_OLD, { rows: 0.5, length: 3.4, width: 0.6, seed: 23 });

// The ear: an outer curve and the fold inside it, well back of the middle of the head.
const EAR = [
  [-4.4, 2.1],
  [-2.6, 1.0],
  [-2.4, -1.3],
  [-3.7, -3.8],
  [-5.5, -3.2],
  [-6.2, -0.8],
  [-5.6, 1.5],
];
const EAR_FOLD = [
  [-4.2, 0.3],
  [-3.5, -0.8],
  [-3.7, -2.2],
];

// Marks on the face: [where a stroke starts, where it ends, how thick]. The eye
// and brow are heavier than the nostril and the line of the mouth, the shadow
// under the cheekbone runs down toward the jaw, and a short stroke under the lip
// marks the chin.
const FACE = {
  brow: [[6.2, 1.9], [8.2, 2.4], [10.2, 1.8], 1.0],
  eye: [[6.8, 0.5], [7.7, 0.9], [8.6, 0.5], 0.9],
  lid: [[6.6, 1.3], [7.6, 1.6], [8.7, 1.3], 0.25],
  nostril: [[9.8, -3.5], [10.4, -3.6], [11.0, -3.9], 0.7],
  mouth: [[8.2, -6.4], [9.1, -6.5], [9.9, -6.3], 0.4],
  cheek: [[5.0, -2.0], [5.8, -5.0], [7.0, -7.6], 0.5],
  chin: [[7.6, -8.6], [8.4, -8.9], [9.1, -8.6], 0.45],
};

// Loose ends of an older man's hair, at the edge of the fringe and on his crown.
const TUFTS_OLD = [
  [[-6.0, 9.2], [-8.6, 8.8], [-10.0, 6.2]],
  [[-9.6, 5.0], [-10.6, 2.2], [-10.8, -0.6]],
  [[-10.4, -1.8], [-10.4, -4.2], [-9.4, -6.0]],
  [[-8.4, 9.8], [-10.0, 8.2]],
  [[-10.8, 3.4], [-11.2, 0.6]],
];

/**
 * The head as points in its own frame: the skull, where the hair grows and the
 * strokes it is drawn in, the ear, and the marks of the face. `older` swaps the
 * dark hair for a balding man's.
 */
export function headParts(older = false) {
  return {
    skull: SKULL,
    hair: older ? HAIR_OLD : HAIR_YOUNG,
    comb: older ? COMB_OLD : COMB_YOUNG,
    ear: EAR,
    earFold: EAR_FOLD,
    face: FACE,
    tufts: older ? TUFTS_OLD : [],
  };
}

// The sabre's hilt and the fist round it, in a frame of their own on the blade
// (cm): x along the blade toward the point, from where it leaves the grip; y
// toward the edge; and z toward the palm, which faces that way. body.js sets the
// frame on the sword hand, turned about the blade as the pose's hand position says.
//
// The guard is one sheet of steel swept along a curve in the plane of the blade
// and the edge: from a lip over the thumb, forward through the blade and round in
// front of the fingers, then back under them, narrowing into the knuckle bow, to
// the pommel. At each station along the curve: where it is, [x, y], and how far
// the sheet reaches either side of it, across the hand. Across, the sheet is bent
// like a bowl, its edges back toward the hand as far as they would be on a ball
// `bowl` cm round, so that side on it is a crescent, as the plates draw it, thick
// in front of the fingers and thin along the bow, and from the side of the edge a
// shield over the fist.
const GUARD = {
  stations: [
    [0.2, -4.4, 1.6], // the lip over the thumb
    [1.6, -3.0, 3.6],
    [2.6, -1.2, 5.0],
    [3.1, 0.8, 6.0], // the blade comes through here
    [2.9, 2.8, 6.3],
    [1.9, 4.6, 5.8],
    [0.2, 5.8, 4.4],
    [-2.2, 6.1, 2.4], // in front of the middle knuckles
    [-5.0, 5.9, 1.5],
    [-8.0, 5.3, 1.2], // the knuckle bow
    [-10.8, 4.0, 1.0],
    [-12.6, 1.5, 0.8], // into the pommel
  ],
  bowl: 7,
};

// The grip, from the guard back to the pommel, and how thick it is; and the
// pommel, a nut at the end of it.
const GRIP = { from: -0.3, to: -12.2, radius: 1.0 };
const POMMEL = { from: -12.2, to: -13.6, radius: 1.2 };

// The fingers curl round the grip from the knuckles of the hand, behind it, under
// it on the side of the edge, where the middle knuckles are, and up the side the
// palm faces toward the thumb. For each: how far along the grip it is, how thick,
// and its joints from the knuckle to the tip, as [how far round the grip from the
// edge toward the palm (degrees), how far from the middle of the grip]. The
// forefinger curls least, as it holds the grip against the thumb.
const FINGERS = [
  { x: -1.9, r: 0.95, joints: [[-100, 2.9], [8, 2.6], [72, 2.5], [122, 2.2]] },
  { x: -4.0, r: 1.0, joints: [[-97, 2.9], [14, 2.5], [84, 2.3], [138, 2.0]] },
  { x: -6.0, r: 0.95, joints: [[-94, 2.85], [17, 2.45], [86, 2.25], [138, 2.0]] },
  { x: -7.8, r: 0.82, joints: [[-90, 2.7], [22, 2.3], [88, 2.1], [136, 1.9]] },
];

// The thumb lies along the back of the grip, opposite the edge, its tip just
// behind the guard: its joints from the knuckle where it leaves the hand to the
// tip, [x, y, z], and how thick it is at each.
const THUMB = {
  joints: [
    [-6.4, -2.8, -1.0],
    [-3.4, -2.3, -0.3],
    [-0.8, -2.05, 0.1],
  ],
  r: [1.05, 0.95, 0.85],
};

// The hand behind them, from the knuckles back to the wrist, which is where the
// forearm ends: how far either side of its middle the wrist reaches and how thick
// it is, and how thick the heel of the hand and the ball of the thumb are.
const PALM = { wrist: 1.7, wristR: 1.6, heel: 1.6, ball: 1.5 };

/** The hilt and the fist round it, in the frame of the hand on the blade. */
export function hiltParts() {
  return { guard: GUARD, grip: GRIP, pommel: POMMEL, fingers: FINGERS, thumb: THUMB, palm: PALM };
}

// The rear hand, resting on the hip: in the frame of the forearm, with the wrist
// at the origin and the fingers along x.
const HIP_HAND = {
  shape: [
    [-0.5, 4.0],
    [2.5, 4.8],
    [6.0, 4.4],
    [9.5, 3.2],
    [12.0, 1.6],
    [12.4, -0.4],
    [11.0, -1.8],
    [8.0, -3.0],
    [4.5, -4.0],
    [1.0, -4.4],
  ],
  lines: [
    [[6.5, 2.6], [10.5, 1.4], [12.0, 0.6]],
    [[6.4, 0.6], [10.2, -0.2], [11.6, -0.8]],
    [[6.0, -1.4], [9.4, -1.8], [10.8, -2.2]],
    [[2.0, 3.4], [5.0, 3.2], [7.6, 1.8]],
    [[-0.4, 4.0], [-0.6, 0], [-0.4, -4.2]],
  ],
};

// The rear hand. The sword hand is the fist round the hilt (hiltParts), which body.js works out in depth.
export function handParts() {
  return { hip: HIP_HAND };
}

// A lace-up leather shoe seen from the side, in a frame with the ankle at the
// origin and x toward the toe: the outline from the heel round the toe, the dark
// heel block, the hatching on the heel and the toe cap, the laces, the toe cap's
// seam and the welt above the sole. The floor is 8 below the origin.
const SHOE = {
  // The points along the sole, the heavy edge of the line, keep half of it ([x, y, 0, weight]).
  shape: [
    [-7.0, -8.0, 0, 0.5],
    [-7.6, -5.2],
    [-7.0, -1.6],
    [-5.4, 1.4],
    [-2.6, 2.4],
    [0.8, 1.0],
    [5.0, -0.8],
    [10.0, -2.2],
    [15.0, -2.8],
    [19.4, -3.0],
    [22.6, -4.4],
    [23.6, -6.4, 0, 0.7],
    [22.0, -8.0, 0, 0.5],
    [8.0, -8.4, 0, 0.5],
  ],
  ink: [[[-7.2, -8.1], [-7.5, -6.4], [-3.2, -6.4], [-2.8, -8.2]]],
  hatch: [
    [[-7.2, -2.0], [-5.8, -4.4]],
    [[-6.8, -0.4], [-5.2, -3.0]],
    [[-5.8, 1.0], [-4.2, -1.6]],
    [[14.6, -3.4], [15.2, -6.0]],
    [[16.4, -3.4], [17.0, -6.0]],
    [[18.2, -3.6], [18.8, -6.0]],
    [[20.0, -3.8], [20.6, -6.0]],
    [[10.4, -3.0], [11.2, -5.8]],
    [[12.4, -3.2], [13.0, -5.8]],
    [[-1.0, -4.6], [-0.6, -6.8]],
    [[1.2, -4.4], [1.6, -6.8]],
    [[3.4, -4.6], [3.8, -6.8]],
    [[5.6, -4.8], [6.0, -6.8]],
    [[7.8, -5.0], [8.2, -6.8]],
  ],
  laces: [
    [[0.8, 0.8], [2.2, -1.6]],
    [[2.8, 0.0], [4.2, -2.4]],
    [[4.8, -0.6], [6.2, -3.0]],
    [[6.8, -1.2], [8.2, -3.6]],
  ],
  sole: [[-2.6, -7.0], [7.0, -7.2], [22.6, -6.8]],
  cap: [[13.0, -2.6], [14.0, -4.6], [13.6, -6.2]],
};

export function shoeParts() {
  return SHOE;
}

// The shoe of the foot behind, which is turned across the piste so that its toe
// points at the camera: with the foot in front it makes the L of the stance, and
// the pose's `toeBack` says how far it is turned back from straight at the camera.
// It is not an outline but a few domes standing on the floor, which body.js turns
// with the camera and sets on the page, so that the same shoe is seen from the
// front, from a quarter and from the side. A point of it is [across, along, up]:
// how far to the side of the foot's middle line, how far along the foot from the
// ankle toward the toe, and how high above the floor, in centimetres.
const SHOE_ACROSS = {
  // Each dome: where its middle is along the foot, its half-length, its half-width,
  // its height, and how square it is (2 is an ellipse, and more is squarer).
  domes: [
    [-2.6, 5.0, 4.1, 10.4, 3.0], // the heel and the ankle, which the stocking runs into
    [1.0, 8.4, 5.1, 8.8, 1.9], // the instep, where the laces run
    [13.6, 10.0, 5.5, 6.0, 2.3], // the toe box
  ],
  // The sole is a slab under the shoe, a little wider than it, and bowed down at the toe.
  sole: { height: 1.2, edge: 0.4, bow: 0.35 },
  // The edge of the shoe where the stocking goes into it, across the front of the ankle: how wide it is, and how high it is at either end and in the middle.
  collar: { wide: 3.7, ends: 9.9, middle: 9.4 },
  // Where the laces cross: how far along the foot.
  laces: [1.8, 3.4, 5.0, 6.6],
  // The seam of the toe cap, as how far along the foot it crosses the toe box.
  seam: 19.0,
  // Strokes of shade on the side that turns from the light, each hanging from the
  // skin of a dome: which dome, how far across it and how far along the foot it
  // is, and how long.
  hatch: [
    [2, 4.5, 12.4, 2.6],
    [2, 3.5, 15.0, 2.6],
    [2, 2.4, 17.4, 2.2],
    [1, 4.1, 3.8, 2.4],
    [1, 3.6, 5.8, 2.2],
  ],
};

export function shoeAcrossParts() {
  return SHOE_ACROSS;
}

// The jersey as slices across the body, from the hem to the base of the neck.
// Each is an ellipse: how far up the spine it is (cm above the hips), how far
// forward of the spine its middle lies, and its half-depth and half-width. With
// the shoulders turned toward the camera the slices make the broad shoulders
// that taper to the waist, and the camera swings them round as it swings.
const TORSO = [
  [11, 0.4, 12.6, 17.6],
  [18, 0.4, 12.0, 16.6],
  [27, 0.8, 13.0, 18.4],
  [36, 1.4, 14.0, 20.6],
  [44, 1.4, 13.6, 21.8],
  [51, 0.6, 11.0, 22.5],
  [54, 0.4, 9.5, 17.6],
  [56.5, 0.6, 8.2, 13.4],
  [58.5, 1.0, 7.0, 10.0],
  [59.5, 1.2, 6.0, 7.5],
];

// How far above the hips the hem of the jersey is, where it is tucked into the trousers under the belt.
export const JERSEY_HEM = TORSO[0][0];

/** The slices of the jersey; an older man carries more at the waist and has narrower, more sloping shoulders. */
export function torsoParts(older = false) {
  if (!older) return TORSO;
  return TORSO.map(([up, mid, depth, width]) => {
    const belly = Math.max(0, Math.min(1, (40 - up) / 30));
    const shoulders = Math.max(0, Math.min(1, (up - 36) / 15));
    return [up, mid + 2.2 * belly, depth + 2.0 * belly, width - 2.6 * shoulders - 0.4 * belly];
  });
}
