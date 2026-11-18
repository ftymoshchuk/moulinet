// The base postures: each pose in the library, described in words, in the
// order they are learned, and the phrase that shows them one fencer at a time.
import { POSE_NAMES } from "./library.js";

// What each posture is for, in the order the page groups them. The last group is
// not a purpose but a source: the postures of the base chapters of Leszák Károly's
// Kardvívás (1906), as the translation in sources/kardvivas-1906 gives them. They
// come last so that the others keep their numbers, and each says where in the book
// it is, and what the book leaves open.
export const BASE_GROUPS = ["Stance", "Footwork", "Attack", "Defence", "Leszák, 1906"];

// Where the one fencer stands for every posture (cm), the same for all, so
// moving from one to the next changes the fencer and not the view.
export const BASE_X = 60;
// Turned a little from side on, so a blade held across the body, as in parry 5,
// is not seen end on.
export const BASE_CAMERA = 25;
// How far along the blade from the hand (cm) the stage must keep in view. All of
// it would let the blade held up in "Blade up" set the height of the view for
// every posture and leave the fencer small. This much lets only the point of
// that one run off the top, about a tenth of its length, and keeps every other
// blade whole. The library keeps whole blades in view.
export const BASE_BLADE = 60;

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
      ["Hand", "Half way between the second position and the third, the 2/3: the thumb on the back of the grip, and the edge turned down and out, so the knuckle bow covers the fingers from below and outside."],
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
      ["Hand", "In the third position, thumb up and the edge down, ready to cut."],
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
      ["Hand", "In the third position, so the edge faces forward, ready to come down onto the head."],
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
      ["Hand", "In the third position, the edge coming down onto the head."],
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
      ["Hand", "Turned to the fourth position, palm up, so the edge comes across into the chest."],
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
      ["Hand", "In the second position, palm down, so the edge faces out to meet the cut."],
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
      ["Hand", "As in tierce: in the second position, the edge out."],
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
      ["Hand", "In the second position, the edge turned out to meet the cut."],
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
      ["Hand", "Turned right over, to the first position: thumb down, so the edge faces up at the cut."],
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
      ["Hand", "As in quinte: in the first position, the edge up."],
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
      ["Hand", "Back in the third position, the edge coming down onto the head."],
    ],
  },
  {
    pose: "basicStance",
    group: "Leszák, 1906",
    text: "The position every drill in the 1906 book begins from. The fencer stands upright, heels together, with the sabre arm held out level and the left hand on the hip; the swings and the sabre positions are learned from here before the fencing stance is taken.",
    points: [
      ["Feet", "The heels touch and the feet make a right angle, the toe of the front foot pointing straight at the opponent."],
      ["Body", "Upright and natural, turned half left: the left shoulder drawn back and the right hip drawn in a little."],
      ["Sword arm", "Straight out in front, level with the shoulder."],
      ["Sabre", "The point forward, turned a little across the arm, so that the sabre and the extended arm make an obtuse angle."],
      ["Hand", "In the second position, palm down and the edge out to the right: the book's 2nd attitude."],
      ["Left hand", "On the left hip."],
      ["Book", "Leszák Károly, Kardvívás (1906), §5, Fig. 2."],
    ],
  },
  {
    pose: "atEase",
    group: "Leszák, 1906",
    text: "The rest taken on the command At ease. The sabre arm is lowered until the point touches the ground in front of the right foot, and the fencer may shift the left hand and the right foot and stand comfortably.",
    points: [
      ["Sword arm", "Lowered with the sabre, hanging at the side."],
      ["Point", "Touches the ground in front of the right foot."],
      ["Left hand and right foot", "Free to leave their places, so the stance is the fencer's own."],
      ["Body", "Upright and easy; the book gives no further rule."],
      ["Book", "Leszák Károly, Kardvívás (1906), §7."],
    ],
  },
  {
    pose: "tierce",
    group: "Leszák, 1906",
    text: "The first of the starting sabre positions, and the one the fencing stance begins in. The hand is drawn back a little with the elbow pressed down, so that the basket covers it, and the point looks at the opponent at the height of the right eye.",
    points: [
      ["Sword arm", "The elbow bent moderately and pressed down, drawing the basket back a little."],
      ["Cover", "The basket covers the hand and the forearm."],
      ["Blade", "The point at the height of your right eye, and in the line."],
      ["Hand", "Half way between the second position and the third, the 2/3, as in the guard: the book's 6th attitude."],
      ["Covers", "The outer upper openings, once a parry swing has brought the sabre here."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 I, Figs. 7 and 17. Close to the Guard, the first posture in the list."],
    ],
  },
  {
    pose: "seconde",
    group: "Leszák, 1906",
    text: "The low position on the outside. The sabre is swung down in front of the body and out to the right, the hand at shoulder height and the point at hip height; it covers the lower outside openings.",
    points: [
      ["Sword arm", "The elbow moderately bent, the upper edge of the basket level with the right shoulder."],
      ["Blade", "The point level with the right hip, in the low line, pointing forward and a little to the right."],
      ["Hand", "The book says the blade slants up to the right; read here as the edge turned up and out, the 1/2, half way between the first position and the second."],
      ["Covers", "The outer lower openings."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 II, Fig. 8."],
    ],
  },
  {
    pose: "prime",
    group: "Leszák, 1906",
    text: "The low position on the inside. The sabre is brought in front of the chest and swung forward and to the left, the point down at the height of the left knee; it covers the lower inside openings.",
    points: [
      ["Sword arm", "The hand in front of the chest, the upper edge of the basket level with the left shoulder, the elbow moderately bent."],
      ["Blade", "The point in the low line, level with the left knee, pointing forward and to the left."],
      ["Hand", "The book turns the edge obliquely left and up. The nearest position here is the fourth, palm up and the edge in."],
      ["Covers", "The inner lower openings."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 III, Fig. 9."],
    ],
  },
  {
    pose: "quinte",
    group: "Leszák, 1906",
    text: "The parry for the head. The basket stands in front of the right temple and the blade slants up across the head, so that a cut to the head lands on it.",
    points: [
      ["Sword arm", "Raised, the elbow moderately bent, the basket in front of the right temple."],
      ["Blade", "Slanting up across the head, the point a little left of the left temple and higher."],
      ["Hand", "The book names no hand position. Shown in the first, thumb down and the edge up, as in parry 5."],
      ["Covers", "The head."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 IV, Fig. 10. The printed words about the inner face are doubtful; the translation has a note."],
    ],
  },
  {
    pose: "quarte",
    group: "Leszák, 1906",
    text: "The parry for the inside of the body. The basket is snatched in to the pit of the stomach, the elbow drops to the hip and the blade stands up and across to the left, outside the line.",
    points: [
      ["Sword arm", "The elbow sunk to the hip, the forearm level and pointing half left, the basket in front of the pit of the stomach."],
      ["Blade", "The point to the left, outside the line, at the height of the left eye."],
      ["Hand", "Half way between the third position and the fourth, the 3/4: the book's 5th attitude, the edge turned down and left."],
      ["Covers", "The inner upper openings."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 V, Fig. 11."],
    ],
  },
  {
    pose: "lowTierce",
    group: "Leszák, 1906",
    text: "Tierce with the hand brought right down. The elbow rests on the right hip and the blade stands up and out to the right; it covers the lower outside openings and belongs to school fencing and free fencing.",
    points: [
      ["Sword arm", "Bent, the elbow on the right hip, the forearm sloping a little down, the lower edge of the basket below the hip."],
      ["Blade", "The point at the height of the right temple, outside the line."],
      ["Hand", "In the second position, the edge turned out."],
      ["Covers", "The outer lower openings."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 VI, Fig. 12. An auxiliary parry."],
    ],
  },
  {
    pose: "lowQuarte1",
    group: "Leszák, 1906",
    text: "The first of two low quartes, which covers the belly. The elbow is pressed to the hip and the forearm lies across the front of the body, down and to the left, with the blade rising steeply outside the line.",
    points: [
      ["Sword arm", "The elbow pressed to the hip, the forearm pointing to the left and down."],
      ["Blade", "The edge to the left and down; the point outside the line, at eye height."],
      ["Hand", "The 3/4, the book's 5th attitude: the edge down and left."],
      ["Covers", "The belly."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 VII.1, Fig. 13. An auxiliary parry."],
    ],
  },
  {
    pose: "lowQuarte2",
    group: "Leszák, 1906",
    text: "The second low quarte: the bent arm is jerked down with a blow, so that the sabre lies level across the front of the hips, its point fully to the left. It is quinte turned over, and covers against low thrusts.",
    points: [
      ["Sword arm", "The bent arm jerked down, the hand low at the right hip."],
      ["Blade", "Level, the point turned fully to the left, the forte of the blade below the hip."],
      ["Hand", "In the third position, the edge turned down."],
      ["Covers", "Against low thrusts."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 VII.2, Fig. 14. An auxiliary parry."],
    ],
  },
  {
    pose: "sixte",
    group: "Leszák, 1906",
    text: "A parry for the head, reached from tierce. The elbow lifts toward the left shoulder with the forearm upright and the hand at the left eye, and the blade lies out to the right above the head.",
    points: [
      ["Sword arm", "The elbow raised toward the left shoulder, the forearm upright, the hand toward the left eye."],
      ["Blade", "Out to the right across the head, close to level."],
      ["Hand", "The edge faces up. With the blade turned out to the right that is the fourth position here."],
      ["Covers", "The head."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 VIII, Fig. 15. An auxiliary parry."],
    ],
  },
  {
    pose: "septime",
    group: "Leszák, 1906",
    text: "The yielding parry, begun as sixte. The blade is taken almost straight down while the hand stays to the right of the right temple at head height, so that the sabre also covers the outer upper openings.",
    points: [
      ["Sword arm", "Raised, the hand to the right of the right temple and at head height."],
      ["Blade", "Almost vertical, the point down, a little out to the right."],
      ["Hand", "The book names no hand position. Shown in the second, the edge out to meet a cut from the outside."],
      ["Covers", "The outer upper openings."],
      ["Book", "Leszák Károly, Kardvívás (1906), §11 after VIII, Fig. 16. A yielding parry, and an auxiliary one."],
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
