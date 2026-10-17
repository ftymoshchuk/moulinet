// The parts of a fencer that are drawn by hand rather than worked out from the
// bones: the head, with its face and hair. Each is a handful of points in a frame
// of its own, in centimetres, facing +x with +y up, which figure.js then sets on
// the body and turns for the camera.

// The head from the side, from the top of the forehead round the face, under the
// chin and up the back of the skull. Origin is the middle of the head: the
// crown is 12.4 above it and the chin 11.8 below.
const SKULL = [
  [2.0, 12.4],
  [6.0, 10.4],
  [7.6, 7.2],
  [7.7, 5.6],
  [8.7, 3.0], // brow
  [7.7, 1.5], // where the nose begins
  [8.3, 0.2],
  [11.0, -3.6], // tip of the nose
  [9.5, -4.8],
  [9.1, -6.2], // upper lip
  [9.4, -7.3], // lips
  [8.8, -8.3],
  [8.1, -9.5],
  [8.6, -11.2], // chin
  [6.4, -12.6],
  [1.5, -11.4], // under the jaw
  [-3.0, -9.0], // angle of the jaw
  [-5.6, -8.2],
  [-8.6, -4.6],
  [-9.7, 1.4],
  [-8.8, 7.2],
  [-5.0, 11.7],
];

// Dark hair, short and brushed back: the top and back of the head down to the
// nape, a hairline over the temple, and a sideburn in front of the ear.
const HAIR_YOUNG = [
  [7.5, 7.3],
  [6.2, 10.5],
  [2.0, 12.8],
  [-3.8, 12.4],
  [-8.2, 9.0],
  [-9.9, 3.2],
  [-9.8, -2.4],
  [-8.2, -6.4],
  [-6.4, -7.8],
  [-4.6, -5.8],
  [-3.4, -3.0], // behind the ear
  [-3.0, 0.6],
  [-1.8, 2.8], // above the ear
  [0.8, 2.6],
  [2.6, 1.8],
  [3.6, 1.2], // the sideburn
  [4.0, 4.2],
  [5.4, 6.4],
];

// An older man's: bare on top, a ring of hair from above the ear round the back.
const HAIR_OLD = [
  [-2.4, 4.6],
  [-3.6, 9.0],
  [-5.8, 11.3],
  [-8.4, 8.5],
  [-9.8, 2.4],
  [-9.6, -3.0],
  [-7.6, -6.8],
  [-6.0, -6.8],
  [-5.8, -4.4],
  [-7.2, -0.4],
  [-7.4, 4.4],
  [-5.6, 7.8],
  [-3.4, 6.2],
];

// The way the hair lies, as strokes of paper left in it: along each, from the
// parting back over the crown.
const STREAKS_YOUNG = [
  [[5.4, 9.4], [2.0, 11.2], [-2.8, 10.8]],
  [[4.2, 7.4], [0.4, 8.8], [-4.8, 8.0]],
  [[-1.6, 4.6], [-5.0, 5.2], [-8.4, 2.4]],
];
const STREAKS_OLD = [];

// The ear: an outer curve and the fold inside it.
const EAR = [
  [-0.8, 1.7],
  [0.8, 0.7],
  [1.0, -1.4],
  [-0.2, -3.6],
  [-1.8, -3.1],
  [-2.5, -0.9],
  [-1.9, 1.2],
];
const EAR_FOLD = [
  [-0.7, 0.1],
  [0.0, -0.9],
  [-0.2, -2.2],
];

// Marks on the face: [where a stroke starts, where it ends, how thick]. The eye
// and brow are heavier than the nostril and the line of the mouth.
const FACE = {
  brow: [[4.2, 2.7], [6.2, 3.1], [8.1, 2.8], 1.2],
  eye: [[5.2, 1.0], [6.1, 1.35], [7.0, 1.0], 0.95],
  lid: [[5.0, 1.9], [6.0, 2.1], [7.1, 1.9], 0.25],
  nostril: [[8.6, -4.2], [9.1, -4.2], [9.6, -4.5], 0.7],
  mouth: [[7.2, -7.2], [8.3, -7.3], [9.3, -7.0], 0.35],
};

// Loose ends of hair at the edge of the hairline, and the short hair that is
// left on an older man's crown: strokes of ink, each from where it starts to
// where it ends.
const TUFTS_YOUNG = [
  [[7.2, 7.8], [8.1, 8.6]],
  [[6.0, 9.8], [6.9, 10.7]],
  [[3.6, 1.6], [3.0, -0.8]],
];
const TUFTS_OLD = [
  [[-4.0, 9.2], [-6.6, 8.8], [-8.0, 6.2]],
  [[-7.6, 5.0], [-8.6, 2.2], [-8.8, -0.6]],
  [[-8.4, -1.8], [-8.4, -4.2], [-7.4, -6.0]],
  [[-6.4, 9.8], [-8.0, 8.2]],
  [[-8.8, 3.4], [-9.2, 0.6]],
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

// The fist of the sword hand in its glove, in the frame of the forearm, with
// the grip at the origin and x along the forearm toward the blade: the shape,
// and the lines of the fingers and the thumb.
const FIST = {
  shape: [
    [-1.2, 4.6],
    [0.6, 5.6],
    [2.6, 6.0],
    [5.0, 5.4],
    [7.4, 3.8],
    [8.6, 1.2],
    [8.0, -2.2],
    [6.2, -4.6],
    [3.2, -5.2],
    [0.0, -4.8],
  ],
  lines: [
    [[-1.2, 4.6], [-1.3, 0], [-1.2, -4.6]],
    [[2.6, 4.8], [5.4, 4.6], [7.4, 3.6]],
    [[4.8, 2.8], [7.0, 1.6], [7.8, -0.2]],
    [[4.4, 0.4], [6.8, -0.6], [7.4, -2.2]],
    [[4.0, -2.0], [6.0, -2.8], [6.4, -4.0]],
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

// A hand shape moved `dx` along its x axis.
function shifted(hand, dx, scale = 1) {
  const move = ([x, y]) => [x * scale + dx, y * scale];
  return { shape: hand.shape.map(move), lines: hand.lines.map((l) => l.map(move)) };
}

// The sword hand is a big gauntlet glove, a fifth larger than drawn above.
const GLOVE = 1.2;

// The fist sits behind the guard, which is at the front of the grip: its front
// is at the origin, so it reaches back from there.
export function handParts() {
  return { fist: shifted(FIST, -9.4 * GLOVE, GLOVE), hip: HIP_HAND };
}

// A lace-up leather shoe seen from the side, in a frame with the ankle at the
// origin and x toward the toe: the outline from the heel round the toe, the dark
// sole and heel, the hatching on the heel and the toe cap, the laces and the
// seams. The floor is 8 below the origin.
const SHOE = {
  shape: [
    [-6.4, -8.0],
    [-7.0, -5.4],
    [-6.4, -1.8],
    [-5.0, 1.2],
    [-2.4, 2.0],
    [0.8, 0.6],
    [4.8, -1.4],
    [9.6, -3.0],
    [14.4, -4.0],
    [18.4, -4.0],
    [21.0, -5.4],
    [21.4, -7.0],
    [19.6, -8.0],
    [8.0, -8.3],
  ],
  ink: [
    [[-2.8, -7.4], [8.0, -7.5], [18.0, -7.3], [21.3, -7.6], [20.2, -8.2], [8.0, -8.5], [-2.6, -8.4]],
    [[-7.0, -8.1], [-7.2, -6.0], [-2.8, -6.0], [-2.4, -8.2]],
  ],
  hatch: [
    [[-6.6, -2.2], [-5.2, -4.4]],
    [[-6.2, -0.6], [-4.6, -3.0]],
    [[-5.4, 0.7], [-3.8, -1.6]],
    [[13.4, -3.6], [14.0, -5.8]],
    [[15.0, -3.5], [15.6, -5.7]],
    [[16.6, -3.7], [17.2, -5.6]],
    [[18.2, -4.2], [18.7, -5.6]],
    [[9.6, -4.4], [10.4, -6.0]],
    [[11.2, -4.6], [11.9, -6.0]],
  ],
  laces: [
    [[0.6, 0.4], [2.0, -2.0]],
    [[2.6, -0.2], [4.0, -2.6]],
    [[4.6, -1.0], [6.0, -3.2]],
    [[6.6, -1.8], [8.0, -3.8]],
  ],
  sole: [[-2.8, -7.3], [6.0, -7.4], [20.9, -7.2]],
  heel: [[-2.7, -7.8], [-2.8, -6.3]],
  cap: [[11.6, -3.4], [12.6, -5.0], [12.2, -6.2]],
};

export function shoeParts() {
  return SHOE;
}

// The jersey as slices across the body, from the hem to the base of the neck.
// Each is an ellipse: how far up the spine it is (cm above the hips), how far
// forward of the spine its middle lies, and its half-depth and half-width. With
// the shoulders turned toward the camera the slices make the broad shoulders
// that taper to the waist, and the camera swings them round as it swings.
const TORSO = [
  [8, 0.4, 11.8, 12.6],
  [17, 0.4, 11.4, 12.0],
  [27, 0.8, 12.4, 14.4],
  [37, 1.4, 13.4, 18.0],
  [45, 1.4, 12.8, 19.4],
  [51, 0.6, 10.6, 19.6],
  [55, -0.2, 7.4, 14.6],
  [58, -0.4, 5.6, 8.6],
];

/** The slices of the jersey; an older man carries more at the waist and has rounder shoulders. */
export function torsoParts(older = false) {
  if (!older) return TORSO;
  return TORSO.map(([up, mid, depth, width]) => {
    const belly = Math.max(0, Math.min(1, (40 - up) / 30));
    const shoulders = Math.max(0, Math.min(1, (up - 36) / 12));
    return [up, mid + 2.2 * belly, depth + 2.0 * belly, width - 1.8 * shoulders - 0.4 * belly];
  });
}
