// The parts of a fencer that are drawn by hand rather than worked out from the
// bones: the head, with its face and hair. Each is a handful of points in a frame
// of its own, in centimetres, facing +x with +y up, which figure.js then sets on
// the body and turns for the camera.

// The head from the side, from the top of the forehead round the face, under the
// chin and up the back of the skull. Origin is the middle of the head: the
// crown is 12.4 above it and the chin 11.8 below.
const SKULL = [
  [2.0, 12.6],
  [6.2, 10.6],
  [7.8, 7.4],
  [8.0, 5.4],
  [9.0, 3.0], // brow
  [8.0, 1.4], // where the nose begins
  [8.8, -0.2],
  [11.4, -3.8], // tip of the nose
  [9.8, -5.0],
  [9.3, -6.2], // upper lip
  [9.6, -7.3], // lips
  [9.0, -8.3],
  [8.4, -9.4],
  [9.0, -11.2], // chin
  [6.8, -12.8],
  [1.5, -11.6], // under the jaw
  [-3.4, -9.2], // angle of the jaw
  [-6.2, -8.6],
  [-9.4, -4.8],
  [-10.6, 1.4],
  [-9.6, 7.4],
  [-5.4, 12.0],
];

// Dark hair, short and brushed back: full over the forehead, the top and back
// of the head down to a ragged edge at the nape, round the ear, a sideburn, and
// a hairline that steps back at the temple.
const HAIR_YOUNG = [
  [8.0, 7.6],
  [7.6, 10.4],
  [4.6, 12.8],
  [0.0, 13.8],
  [-4.8, 13.2],
  [-8.8, 10.0],
  [-11.0, 4.0],
  [-11.0, -1.8],
  [-9.6, -5.8],
  [-7.8, -7.8], // the nape
  [-6.6, -7.0],
  [-5.6, -7.6],
  [-5.2, -4.6], // behind the ear
  [-5.0, -1.2],
  [-4.4, 1.6], // over the ear
  [-2.4, 2.8],
  [0.0, 2.6],
  [1.8, 1.8],
  [2.6, 0.4], // the sideburn
  [3.6, 0.6],
  [4.2, 3.8], // the hairline at the temple
  [5.8, 5.4],
  [6.8, 7.2],
];

// An older man's: bare on top, a ring of hair from above the ear round the back.
const HAIR_OLD = [
  [-3.8, 4.6],
  [-4.8, 9.0],
  [-6.8, 11.3],
  [-9.4, 8.5],
  [-10.8, 2.4],
  [-10.6, -3.0],
  [-8.6, -6.8],
  [-7.0, -6.8],
  [-6.6, -4.4],
  [-8.0, -0.4],
  [-8.2, 4.4],
  [-6.6, 7.8],
  [-4.6, 6.2],
];

// The way the hair lies, as strokes of paper left in it: along each, from the
// forehead back over the crown and down the back of the head.
const STREAKS_YOUNG = [
  [[6.4, 10.4], [2.6, 12.2], [-2.4, 12.0]],
  [[5.6, 8.4], [1.0, 10.2], [-4.4, 9.8]],
  [[3.6, 6.4], [-1.0, 7.8], [-6.4, 7.0]],
  [[-0.4, 4.4], [-4.6, 4.8], [-8.6, 2.6]],
  [[-6.6, 1.0], [-8.8, -1.4], [-9.0, -4.0]],
];
const STREAKS_OLD = [];

// The ear: an outer curve and the fold inside it.
const EAR = [
  [-2.3, 1.2],
  [-0.7, 0.2],
  [-0.5, -1.9],
  [-1.7, -4.1],
  [-3.3, -3.6],
  [-4.0, -1.4],
  [-3.4, 0.7],
];
const EAR_FOLD = [
  [-2.2, -0.4],
  [-1.5, -1.4],
  [-1.7, -2.7],
];

// Marks on the face: [where a stroke starts, where it ends, how thick]. The eye
// and brow are heavier than the nostril and the line of the mouth, and the
// shadow under the cheekbone runs down toward the jaw.
const FACE = {
  brow: [[4.4, 2.8], [6.4, 3.3], [8.4, 2.9], 0.9],
  eye: [[5.4, 1.0], [6.3, 1.4], [7.2, 1.0], 0.9],
  lid: [[5.2, 1.9], [6.2, 2.1], [7.3, 1.9], 0.25],
  nostril: [[8.9, -4.4], [9.4, -4.4], [9.9, -4.7], 0.7],
  mouth: [[7.4, -7.3], [8.5, -7.4], [9.5, -7.1], 0.4],
  cheek: [[3.4, -2.6], [4.2, -5.6], [5.6, -8.0], 0.5],
};

// Loose ends of hair at the edge of the hairline and at the nape, and the short
// hair that is left on an older man's crown: strokes of ink, each from where it
// starts to where it ends.
const TUFTS_YOUNG = [
  [[7.6, 8.0], [8.6, 8.9]],
  [[6.4, 10.4], [7.3, 11.4]],
  [[3.4, 1.2], [3.0, -0.8]],
  [[-7.0, -7.4], [-6.6, -8.8]],
  [[-8.6, -6.6], [-8.8, -8.0]],
];
const TUFTS_OLD = [
  [[-5.0, 9.2], [-7.6, 8.8], [-9.0, 6.2]],
  [[-8.6, 5.0], [-9.6, 2.2], [-9.8, -0.6]],
  [[-9.4, -1.8], [-9.4, -4.2], [-8.4, -6.0]],
  [[-7.4, 9.8], [-9.0, 8.2]],
  [[-9.8, 3.4], [-10.2, 0.6]],
];

/**
 * The head as points in its own frame. `older` swaps the dark hair for a
 * balding man's.
 */
export function headParts(older = false) {
  return {
    skull: SKULL,
    hair: older ? HAIR_OLD : HAIR_YOUNG,
    streaks: older ? STREAKS_OLD : STREAKS_YOUNG,
    ear: EAR,
    earFold: EAR_FOLD,
    face: FACE,
    tufts: older ? TUFTS_OLD : TUFTS_YOUNG,
  };
}

// The fist of the sword hand in its glove, seen from the side, in the frame of
// the forearm with the grip at the origin and x along the forearm toward the
// blade: the back of the hand and the knuckles on top, the fingers curled round
// the grip in front and under it, and the heel of the hand below. The shape,
// and the lines of the knuckles, the fingers and the thumb.
const FIST = {
  shape: [
    [-11.4, 4.4],
    [-8.0, 5.2],
    [-4.2, 5.6],
    [-1.6, 4.9],
    [-0.4, 2.8],
    [-0.3, 0.0],
    [-1.0, -2.8],
    [-2.6, -4.6],
    [-5.6, -5.3],
    [-8.8, -4.9],
    [-11.4, -4.2],
  ],
  lines: [
    [[-3.0, 4.8], [-1.4, 3.2], [-1.0, 0.8]],
    [[-4.6, 1.6], [-2.8, 1.5], [-1.0, 1.0]],
    [[-4.8, -0.8], [-2.8, -1.1], [-1.0, -1.4]],
    [[-4.4, -3.0], [-2.8, -3.4], [-1.8, -3.9]],
    [[-8.2, 3.6], [-5.4, 3.0], [-3.2, 3.2]],
  ],
};

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

// A copy of a hand's points, so a drawing cannot change the ones here.
function copied(hand) {
  const copy = ([x, y]) => [x, y];
  return { shape: hand.shape.map(copy), lines: hand.lines.map((l) => l.map(copy)) };
}

// The fist sits behind the guard, which is at the front of the grip: its front
// is at the origin, so it reaches back from there.
export function handParts() {
  return { fist: copied(FIST), hip: HIP_HAND };
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
// points at the camera: with the foot in front it makes the L of the stance. It
// is not an outline but a few domes standing on the floor, which body.js turns
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
  // How far the toe is turned back from pointing straight at the camera.
  turn: 14,
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
  [54.5, 0.4, 9.5, 21.5],
  [57, 0.6, 8.0, 18.0],
  [58.5, 1.0, 7.0, 12.0],
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
