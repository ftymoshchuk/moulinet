// The poses, the built-in phrases, and the joints the sliders move.
//
// A pose is a handful of numbers for one fencer, seen side on, facing the
// opponent, with the back foot at 0. Lengths are centimetres and angles are
// degrees, where 0 points at the opponent and 90 straight up:
//   hipX, hipY    the middle of the hips, forward of the back foot, and its height
//   footF         front foot reach; liftF and liftB lift a foot off the floor
//   lean          torso lean, forward positive
//   turn          how far the shoulders are turned toward the camera, 0 side on
//   arm, fore     sword arm: upper arm and forearm
//   blade         the sabre; yaw turns it toward the camera
//   rArm, rFore   rear arm, hand on the hip
// A pose fills in whatever it leaves out from the guard.
//
// The stance is the plates': upright and not deep, the knees a little bent. In
// the guard each knee is over its own foot. Each leg starts from a hip of its
// own, the front one 6 cm forward of the middle of the hips and the back one 6 cm
// behind it. The front shin stands upright, a thigh being 44 cm and the knee 54
// cm up: with the hips at 83, the front knee is where the thigh reaches, 33 cm on
// from its hip, over the front foot. The knee of the leg behind is turned out
// toward the camera over its foot, which points that way, so side on that leg is
// seen nearly straight, as the plates draw it. The poses that move the weight
// from there keep the knees over the feet to within a few centimetres. In the
// lunges the leg behind is straight from its hip to its foot, and the body stays
// nearly upright over the front leg.
export const POSES = {
  guard: { hipX: 34, hipY: 83, footF: 73, liftF: 0, liftB: 0, lean: 0, turn: 58, arm: -36, fore: 8, blade: 34, yaw: 0, rArm: -124, rFore: -28 },
  advLift: { hipX: 37, hipY: 84, footF: 92, liftF: 4 },
  advLand: { hipX: 45, hipY: 82, footF: 103 },
  prep: { hipX: 36, lean: 1, arm: 15, fore: 30, blade: 85 },
  lungeFly: { hipX: 60, hipY: 70, footF: 124, liftF: 5, lean: 6, arm: 16, fore: 16, blade: 30 },
  lungeHead: { hipX: 83.1, hipY: 54.6, footF: 133, lean: 6, arm: 18, fore: 16, blade: 20 },
  lungeChest: { hipX: 83.1, hipY: 54.6, footF: 133, lean: 15, arm: 2, fore: 2, blade: 10 },
  parry3: { hipX: 32, hipY: 82, lean: -3, arm: -110, fore: -4, blade: 95 },
  parry5: { hipX: 32, hipY: 82, lean: -4, arm: 20, fore: 112, blade: 6, yaw: 70 },
  riposte: { hipX: 43, hipY: 82, footF: 90, lean: 8, arm: 0, fore: 0, blade: -6 },
  extend: { hipX: 35, lean: 1, arm: 4, fore: 4, blade: 14 },
};

export const POSE_NAMES = {
  guard: "Guard (tierce)",
  advLift: "Advance, lift",
  advLand: "Advance, land",
  prep: "Blade up",
  lungeFly: "Lunge, flight",
  lungeHead: "Lunge, head cut",
  lungeChest: "Lunge, chest cut",
  parry3: "Parry 3",
  parry5: "Parry 5",
  riposte: "Riposte, head",
  extend: "Arm extended",
};

// A phrase is a list of steps. Each step moves into its poses over `ms`, then
// holds them for `hold`; a fencer a step leaves out keeps the previous spec.
//
// These are the scenes the practice library starts with. A scene may also say
// where it was noted, with an `event` and a `reference` link; these do not,
// because there is no real bout behind them to point to.
export const PRESETS = [
  {
    id: "advance-lunge-head-cut",
    phrase: {
      name: "Advance, lunge, head cut",
      note: "A advances, raises the blade, then lunges and cuts to the head while B holds the guard. Watch the order: the arm moves before the legs.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: -30 }, B: { pose: "guard", x: 310 } },
        { label: "Advance: front foot lifts", ms: 190, A: { pose: "advLift", x: -30 } },
        { label: "Advance: front foot lands", ms: 110, A: { pose: "advLand", x: -30 } },
        { label: "Advance: back foot follows", ms: 200, hold: 160, A: { pose: "guard", x: 0 } },
        { label: "Arm extends, blade rises", ms: 220, hold: 60, A: { pose: "prep", x: 0 } },
        { label: "Lunge", ms: 150, A: { pose: "lungeFly", x: 0 } },
        { label: "Head cut lands", ms: 120, hold: 700, ease: "snap", A: { pose: "lungeHead", x: 0 } },
        { label: "Recover to guard", ms: 380, hold: 500, A: { pose: "guard", x: 0 } },
      ],
    },
  },
  {
    id: "chest-cut-parry-3",
    phrase: {
      name: "Lunge to the chest, parry 3, riposte",
      note: "A lunges to the chest and B takes parry 3, then ripostes to the head before both recover.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 310 } },
        { label: "A lunges to the chest, B takes parry 3", ms: 280, hold: 600, ease: "snap", A: { pose: "lungeChest", x: 0 }, B: { pose: "parry3", x: 310 } },
        { label: "B ripostes to the head", ms: 220, hold: 700, ease: "snap", A: { pose: "lungeChest", x: 0, adj: { arm: 2, blade: 18 } }, B: { pose: "riposte", x: 310 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 310 } },
      ],
    },
  },
  {
    id: "head-attack-parry-5",
    phrase: {
      name: "Head attack, parry 5, riposte to head",
      note: "A raises the blade and lunges at the head; B takes parry 5 and ripostes to the head, then both recover.",
      camera: 28,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 310 } },
        { label: "A raises the blade", ms: 220, hold: 40, A: { pose: "prep", x: 0 } },
        { label: "A lunges to the head, B takes parry 5", ms: 260, hold: 500, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 28, fore: 24, blade: 42 } }, B: { pose: "parry5", x: 310 } },
        { label: "B ripostes to the head", ms: 200, hold: 700, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 26, fore: 20, blade: 52 } }, B: { pose: "riposte", x: 310 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 310 } },
      ],
    },
  },
  {
    id: "moulinet-to-head",
    phrase: {
      name: "Moulinet to the head",
      note: "One fencer alone. The blade drops forward past the arm, swings up behind and comes down over the top: the circular cut this page is named after.",
      camera: 25,
      solo: true,
      steps: [
        { label: "En garde", hold: 500, A: { pose: "guard", x: 90 } },
        { label: "Arm extends", ms: 260, hold: 80, A: { pose: "extend", x: 90 } },
        { label: "Blade drops forward", ms: 170, A: { pose: "extend", x: 90, adj: { blade: -75, yaw: -20 } } },
        { label: "Passes down beside the arm", ms: 150, A: { pose: "extend", x: 90, adj: { blade: -165, yaw: -30 } } },
        { label: "Rises behind", ms: 150, A: { pose: "extend", x: 90, adj: { blade: 105, yaw: -25 } } },
        { label: "Cut comes over the top", ms: 170, hold: 450, ease: "snap", A: { pose: "extend", x: 90, adj: { blade: 15, yaw: 0 } } },
        { label: "Back to guard", ms: 350, hold: 400, A: { pose: "guard", x: 90 } },
      ],
    },
  },
];

// The sliders under "Adjust this moment", in order. `x` is where the fencer
// stands on the piste; every other key overrides a value of the pose.
export const JOINTS = [
  { key: "x", label: "Position on the piste", min: -70, max: 300, unit: " cm" },
  { key: "footF", label: "Front foot reach", min: 30, max: 135, unit: " cm" },
  { key: "liftF", label: "Front foot lift", min: 0, max: 30, unit: " cm" },
  { key: "hipX", label: "Hips forward", min: 5, max: 90, unit: " cm" },
  { key: "hipY", label: "Hip height", min: 48, max: 96, unit: " cm" },
  { key: "lean", label: "Torso lean", min: -25, max: 35, unit: "°" },
  { key: "arm", label: "Upper arm", min: -90, max: 120, unit: "°" },
  { key: "fore", label: "Forearm", min: -100, max: 130, unit: "°" },
  { key: "blade", label: "Blade angle", min: -180, max: 180, unit: "°" },
  { key: "yaw", label: "Blade turn toward camera", min: -85, max: 85, unit: "°" },
];
