// The base postures: each pose in the library, described in words, in the
// order they are learned, and the phrase that shows them one fencer at a time.
import { POSE_NAMES } from "./library.js";

// What each posture is for, in the order the page groups them.
export const BASE_GROUPS = ["Stance", "Footwork", "Attack", "Defence"];

// Where the one fencer stands for every posture (cm), the same for all, so
// moving from one to the next changes the fencer and not the view.
export const BASE_X = 60;
// Turned a little from side on, so a blade held across the body, as in parry 5,
// is not seen end on.
export const BASE_CAMERA = 25;

// `text` says what the posture is and what it is for. `points` are the parts
// worth looking at, as [what, how].
export const BASES = [
  {
    pose: "guard",
    group: "Stance",
    text: "The ready position every action starts from and returns to. The knees are bent and the weight is shared between both legs, so a step, a parry or a lunge can begin without first shifting your weight.",
    points: [
      ["Feet", "The front foot points at the opponent. The back foot sits well behind it, turned across to face you, so that the two feet make an L, about as far apart as a leg is long."],
      ["Legs", "Both knees bent, each over its own foot, so both shins stand upright; the back knee is turned out toward you a little, over the back foot. The torso is upright and the weight shared evenly."],
      ["Sword arm", "Nearly straight, reaching forward, the hand at the height of the chest."],
      ["Blade", "Angled up and forward, in tierce: it covers the high outside line."],
      ["Rear arm", "Bent, the elbow out behind, and the hand resting on the hip at the belt."],
    ],
  },
  {
    pose: "advLift",
    group: "Footwork",
    text: "The first half of an advance. The front foot reaches forward and clears the floor while the back leg stays bent and keeps the body low.",
    points: [
      ["Front foot", "Lifts and reaches forward, the heel leading."],
      ["Back leg", "Stays bent and carries the weight. The back foot has not moved."],
      ["Upper body", "Quiet: the torso stays upright and the arms keep their guard shape."],
    ],
  },
  {
    pose: "advLand",
    group: "Footwork",
    text: "The front foot has landed and the back foot is about to follow. When it does, the guard is back in place one step closer to the opponent.",
    points: [
      ["Front foot", "Lands on the heel, then settles flat."],
      ["Back foot", "Still where it was. It slides forward the same distance the front foot travelled."],
      ["Hips", "A little forward of, and lower than, in the guard."],
    ],
  },
  {
    pose: "extend",
    group: "Attack",
    text: "The sword arm straight out in front. An attack starts with the arm: it extends first and the legs follow. The moulinet on this page starts from here too.",
    points: [
      ["Sword arm", "Straight, at about shoulder height, with no tension in the shoulder."],
      ["Blade", "In line with the arm, pointing forward and a little up."],
      ["Legs", "Still in guard. Nothing below the hips has moved."],
    ],
  },
  {
    pose: "prep",
    group: "Attack",
    text: "The arm lifts and the blade stands almost upright, ready to fall forward onto the head. The built-in head-cut scenes use it just before the lunge.",
    points: [
      ["Sword arm", "The elbow bent and the hand lifted above shoulder height."],
      ["Blade", "Nearly vertical, the point to the ceiling."],
      ["Legs", "Still in guard."],
    ],
  },
  {
    pose: "lungeFly",
    group: "Attack",
    text: "The lunge in the air. The arm has already extended; the back leg springs and drives the body forward while the front foot travels just above the floor.",
    points: [
      ["Back leg", "Straightens and pushes the body forward. The sole stays on the floor."],
      ["Front leg", "Thrown forward, toes up, clear of the floor."],
      ["Sword arm", "Extended ahead of the body. The arm leads and the body follows it."],
      ["Hips", "Dropping as they travel forward."],
    ],
  },
  {
    pose: "lungeHead",
    group: "Attack",
    text: "The lunge finished, landing a cut on the head. The front foot is down, the back leg is straight, and the blade arrives at the opponent's head height.",
    points: [
      ["Front leg", "Bent, the knee over the front foot, the foot flat."],
      ["Back leg", "Straight, the back foot flat."],
      ["Sword arm", "Raised and extended, taking the blade up to head height."],
      ["Torso", "Nearly upright over the front leg, the head up and the rear arm held back."],
    ],
  },
  {
    pose: "lungeChest",
    group: "Attack",
    text: "The same lunge, landing a cut on the chest. The legs are as in the cut to the head; the arm is lower and flatter.",
    points: [
      ["Legs", "As in the lunge to the head: front knee bent, back leg straight."],
      ["Sword arm", "Extended and nearly level, at about the height of the opponent's chest."],
      ["Blade", "Close to level, pointing at the target."],
    ],
  },
  {
    pose: "parry3",
    group: "Defence",
    text: "Tierce. The blade stands almost upright in front of the body and closes the high outside line, so a cut to the chest on that side lands on the blade.",
    points: [
      ["Sword arm", "The elbow drops and the hand stays in front of the chest."],
      ["Blade", "Near vertical, the point up."],
      ["Body", "Stays behind the blade, the weight a little back."],
      ["Covers", "The high line on the sword-arm side."],
    ],
  },
  {
    pose: "parry3Back",
    group: "Defence",
    text: "Tierce taken with the weight drawn back, as the old plates draw it. The hips sit back over the back foot, the back knee bends to take the weight and the front leg straightens, so the body is further from the cut while the blade closes the line.",
    points: [
      ["Legs", "The back knee bent and turned out over the back foot, carrying the weight; the front leg straight, its foot flat where it was in guard."],
      ["Hips", "Back over the back foot."],
      ["Torso", "Upright, or a little back, behind the blade."],
      ["Blade", "As in tierce: near vertical in front of the body, the point up."],
    ],
  },
  {
    pose: "faceParry",
    group: "Defence",
    text: "Face protection, against a cut at the outside of the face. The hand stays low in front of the chest and the blade slants forward and up, so the cut is met on the forte, well in front of the face, as the old plates draw it.",
    points: [
      ["Sword arm", "The elbow down by the side and the hand in front of the chest."],
      ["Blade", "Slanting forward and up, about halfway between level and upright, across the line to the face."],
      ["Legs", "Standing up, the front foot drawn back toward the back foot, the body upright behind the blade."],
      ["Covers", "The face, on the side of the sword arm."],
    ],
  },
  {
    pose: "parry5",
    group: "Defence",
    text: "Quinte, the parry for the head. The blade lies across above the head, so a cut coming down lands on the blade.",
    points: [
      ["Sword arm", "Raised, the hand above head height, the elbow bent."],
      ["Blade", "Roughly level and turned across, like a roof over the head."],
      ["Body", "A little back and under the blade. The legs stay in guard."],
      ["Covers", "The head."],
    ],
  },
  {
    pose: "parry5Back",
    group: "Defence",
    text: "Quinte with the weight drawn back. The body sits back over the bent back leg and the front leg straightens, so the head is further from the cut, and the blade lies across above it.",
    points: [
      ["Legs", "As in tierce with the weight back: the back knee bent over the back foot, the front leg straight."],
      ["Sword arm", "Raised, the hand just above the head, the elbow bent."],
      ["Blade", "Level and turned across, like a roof over the head."],
      ["Covers", "The head, with the body drawn back out of reach."],
    ],
  },
  {
    pose: "riposte",
    group: "Defence",
    text: "The attack that answers a parry. It comes straight away, before the opponent can recover: here, a cut to the head.",
    points: [
      ["Timing", "Starts the moment the parry has caught the blade."],
      ["Sword arm", "Straight and level, thrown forward at once."],
      ["Blade", "Level or a little below the hand, the cut dropping onto the target."],
      ["Body", "Leans into the cut, the hips travelling forward."],
    ],
  },
];

/** The base postures as a phrase for one fencer, a step for each, so the stage can show them one at a time. */
export function basePhrase() {
  return {
    name: "Base postures",
    camera: BASE_CAMERA,
    solo: true,
    steps: BASES.map(({ pose }) => ({ label: POSE_NAMES[pose], hold: 1000, A: { pose, x: BASE_X } })),
  };
}
