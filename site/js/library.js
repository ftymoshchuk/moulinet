// The poses, the built-in phrases, and the joints the sliders move.
//
// A pose is a handful of numbers for one fencer, seen side on, facing the
// opponent, with the back foot at 0. Lengths are centimetres and angles are
// degrees, where 0 points at the opponent and 90 straight up:
//   hipX, hipY    hips forward of the back foot, and their height
//   footF         front foot reach; liftF and liftB lift a foot off the floor
//   lean          torso lean, forward positive
//   arm, fore     sword arm: upper arm and forearm
//   blade         the sabre; yaw turns it toward the camera
//   rArm, rFore   rear arm, hand on the hip
// A pose fills in whatever it leaves out from the guard.
export const POSES = {
  guard: { hipX: 33, hipY: 84, footF: 68, liftF: 0, liftB: 0, lean: 2, arm: -25, fore: 2, blade: 34, yaw: 0, rArm: -128, rFore: -28 },
  advLift: { hipX: 42, hipY: 85, footF: 94, liftF: 9 },
  advLand: { hipX: 47, hipY: 81, footF: 98 },
  prep: { hipX: 36, lean: 4, arm: 15, fore: 30, blade: 85 },
  lungeFly: { hipX: 56, hipY: 72, footF: 100, liftF: 14, lean: 8, arm: 25, fore: 25, blade: 45 },
  lungeHead: { hipX: 77, hipY: 53, footF: 121, lean: 14, arm: 38, fore: 28, blade: 14 },
  lungeChest: { hipX: 77, hipY: 53, footF: 121, lean: 12, arm: 8, fore: 6, blade: 8 },
  parry3: { hipX: 30, hipY: 83, lean: -3, arm: -70, fore: 15, blade: 95 },
  parry5: { hipX: 30, hipY: 82, lean: -4, arm: 35, fore: 60, blade: 8, yaw: 72 },
  riposte: { hipX: 44, hipY: 80, footF: 82, lean: 12, arm: 0, fore: 0, blade: -6 },
  extend: { hipX: 34, lean: 4, arm: 4, fore: 4, blade: 14 },
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
export const PRESETS = [
  {
    name: "Advance, lunge, head cut",
    phrase: {
      name: "Advance, lunge, head cut",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: -30 }, B: { pose: "guard", x: 245 } },
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
    name: "Chest cut, parry 3",
    phrase: {
      name: "Lunge to the chest, parry 3, riposte",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
        { label: "A lunges to the chest, B takes parry 3", ms: 280, hold: 600, ease: "snap", A: { pose: "lungeChest", x: 0 }, B: { pose: "parry3", x: 245 } },
        { label: "B ripostes to the head", ms: 220, hold: 700, ease: "snap", A: { pose: "lungeChest", x: 0, adj: { arm: 2, blade: 18 } }, B: { pose: "riposte", x: 245 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
      ],
    },
  },
  {
    name: "Parry 5, riposte to head",
    phrase: {
      name: "Head attack, parry 5, riposte to head",
      camera: 28,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
        { label: "A raises the blade", ms: 220, hold: 40, A: { pose: "prep", x: 0 } },
        { label: "A lunges to the head, B takes parry 5", ms: 260, hold: 500, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 50, fore: 40, blade: 30 } }, B: { pose: "parry5", x: 245 } },
        { label: "B ripostes to the head", ms: 200, hold: 700, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { blade: 48, arm: 30 } }, B: { pose: "riposte", x: 245 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
      ],
    },
  },
  {
    name: "Moulinet to head (solo)",
    phrase: {
      name: "Moulinet to the head",
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
