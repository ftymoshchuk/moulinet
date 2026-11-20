// Scenes the practice library no longer lists. It keeps only what was learned live, so these five, which had no
// source, event or link because there was no real bout behind them, were taken out of the page. They stay here as test
// data: they are the longest runs of poses there are to try the timeline, the figures and the rig on, a scene that
// plays on through steps it passes, parries that meet in three dimensions, and the one scene whose blade goes right
// round the arm. The Creator can still make scenes like them, and the tests still hold the page to what they ask of it.
//
// Each is as the library had it, in the same shape as an entry of PRESETS: an `id`, a `section` and a `phrase`.
//
// A sword arm lies in a plane of its own, about 12 cm to one side of the line between the fencers, so two blades that
// cross in the side view can still pass each other in depth. At a parry the step turns each blade toward that line
// (`yaw`) until they touch where they cross. B's parry 5 turns less than the pose does: its 70° would have them meet out
// near the points, not on B's forte.
//
// In the moulinet the blade goes round outside the sword arm, turned out from it as it passes under and behind (yaw),
// and the elbow gives a little so the hand rises as the blade goes behind: the wrist bends no further than parry 5 asks
// of it, and the blade passes behind the shoulder and the head, not through them. The hand stays in the third, so the
// edge leads all the way round.

// The older man's own guard, as the library has it: 3 cm higher, in a shallower bend, the sword arm bent and tucked in.
const OLDER_GUARD = { hipY: 80, arm: -42, fore: 10, blade: 38 };
const olderGuard = (x) => ({ pose: "guard", x, adj: { ...OLDER_GUARD } });

export const RETIRED = [
  {
    id: "advance-lunge-head-cut",
    section: "live",
    phrase: {
      name: "Advance, lunge, head cut",
      note: "A advances, raises the blade, then lunges and cuts to the head while B holds the guard. Watch the order: the arm moves before the legs.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: -30 }, B: olderGuard(310) },
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
    section: "live",
    phrase: {
      name: "Lunge to the chest, parry 3, riposte",
      note: "A lunges to the chest and B takes parry 3, then ripostes to the head before both recover.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
        { label: "A lunges to the chest, B takes parry 3", ms: 280, hold: 600, ease: "snap", A: { pose: "lungeChest", x: 0, adj: { yaw: 18 } }, B: { pose: "parry3", x: 310, adj: { yaw: 24 } } },
        { label: "B ripostes to the head", ms: 220, hold: 700, ease: "snap", A: { pose: "lungeChest", x: 0, adj: { arm: 2, blade: 18 } }, B: { pose: "riposte", x: 310 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
      ],
    },
  },
  {
    id: "head-attack-parry-5",
    section: "live",
    phrase: {
      name: "Head attack, parry 5, riposte to head",
      note: "A raises the blade and lunges at the head; B takes parry 5 and ripostes to the head, then both recover.",
      camera: 28,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
        { label: "A raises the blade", ms: 220, hold: 40, A: { pose: "prep", x: 0 } },
        { label: "A lunges to the head, B takes parry 5", ms: 260, hold: 500, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 28, fore: 24, blade: 42, yaw: 10 } }, B: { pose: "parry5", x: 310, adj: { yaw: 24 } } },
        { label: "B ripostes to the head", ms: 200, hold: 700, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 26, fore: 20, blade: 52 } }, B: { pose: "riposte", x: 310 } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
      ],
    },
  },
  {
    id: "outside-face-cut-face-protection",
    section: "live",
    phrase: {
      name: "Outside face cut, face protection",
      note: "A extends the arm and lunges with a cut at the outside of B's face. B takes face protection: the hand low in front, the front foot drawn back, and the blade slanting forward, so the cut lands on the forte, well in front of the face. Then both recover.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(306) },
        { label: "A extends the arm", ms: 220, hold: 60, A: { pose: "extend", x: 0 } },
        { label: "A cuts at the face, B takes face protection", ms: 260, hold: 700, ease: "snap", A: { pose: "lungeHead", x: 0, adj: { arm: 8, fore: 10, blade: 22, yaw: 12 } }, B: { pose: "faceParry", x: 306, adj: { yaw: 28 } } },
        { label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: olderGuard(306) },
      ],
    },
  },
  {
    id: "moulinet-to-head",
    section: "live",
    phrase: {
      name: "Moulinet to the head",
      note: "One fencer alone. The blade drops forward past the arm, swings up behind and comes down over the top: the circular cut this page is named after.",
      camera: 25,
      solo: true,
      steps: [
        { label: "En garde", hold: 500, A: { pose: "guard", x: 90 } },
        { label: "Arm extends", ms: 260, hold: 80, A: { pose: "extend", x: 90 } },
        { label: "Blade drops forward", ms: 170, A: { pose: "extend", x: 90, adj: { blade: -77, yaw: -20 } } },
        { label: "Passes down beside the arm", ms: 150, A: { pose: "extend", x: 90, adj: { arm: 4, fore: 8, blade: -121, yaw: -78 } } },
        { label: "Rises behind", ms: 150, A: { pose: "extend", x: 90, adj: { arm: 16, fore: 40, blade: 147, yaw: -71 } } },
        { label: "Cut comes over the top", ms: 170, hold: 450, ease: "snap", A: { pose: "extend", x: 90, adj: { blade: 15, yaw: 0 } } },
        { label: "Back to guard", ms: 350, hold: 400, A: { pose: "guard", x: 90 } },
      ],
    },
  },
];
