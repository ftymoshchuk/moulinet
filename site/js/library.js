// The poses, the built-in phrases, and the joints the sliders move.
//
// A pose is a handful of numbers for one fencer, seen side on, facing the
// opponent, with the back foot at 0. Lengths are centimetres and angles are
// degrees, where 0 points at the opponent and 90 straight up:
//   hipX, hipY    the middle of the hips, forward of the back foot, and its height
//   footF         front foot reach; liftF and liftB lift a foot off the floor
//   toeBack       how far the toe of the foot behind is turned back from pointing
//                 straight at the camera: 0 makes an exact L with the foot in front
//   kneeOut       how far the knee of the leg behind is turned out toward the camera
//                 from bending straight back with the hips as far forward as in the
//                 guard, and further as they sit back over the foot: 0 is flat
//   lean          torso lean, forward positive
//   turn          how far the shoulders are turned toward the camera, 0 side on
//   arm, fore     sword arm: upper arm and forearm, how high each points
//   armYaw,       how far each is turned out of the plane of the sword shoulder, toward
//   foreYaw       the camera, which is across the chest from the sword side: 0 keeps the
//                 arm in that plane, as in the guard, and more brings the hand across
//   blade         the sabre; yaw turns it toward the camera
//   hand          how far the sword hand is turned about the blade, in the hand
//                 positions of the old sabre books: 0 is the third, thumb up and the
//                 edge down; -90 the second, palm down and the edge out; -180 the
//                 first, thumb down and the edge up; 90 the fourth, palm up and the
//                 edge in; and the halves between them, -45 the 2/3
//   rArm, rFore   rear arm, hand on the hip
// A pose fills in whatever it leaves out from the guard.
//
// "The camera" here, and in figure.js and rig.js, is the one the skeleton is worked
// out for, on the side of the piste the chest turns to. The page's own camera is on
// that side for the postures and on the other side for the scenes (see `viewCamera`
// in app.js), so for a scene "toward the camera" is away from you.
//
// The guard is the plates' classic stance: wide, the feet 84 cm apart, and both
// knees bent, each over its own foot, so both shins stand upright. Each leg starts
// from a hip of its own, the front one 6 cm forward of the middle of the hips and
// the back one 6 cm behind it. A thigh being 44 cm and the knee 54 cm up, with the
// hips at 77 the front knee is where the thigh reaches, 37 cm on from its hip,
// over the front foot. The knee of the leg behind is turned out toward the camera
// over its foot, which points that way: a little in the guard, so side on it is
// seen bent back over the foot, as the plates draw it, and further as the weight
// sits back over that foot. The poses that move the weight from there keep the
// knees over the feet to within a few centimetres. In the lunges the leg behind
// is straight from its hip to its foot, and the body stays nearly upright over the
// front leg. The parries with the weight back keep the feet where the guard has
// them and sit back over the bent back leg, the front leg straight, as the plates
// draw them seen from the front. Face protection stands up, the front foot drawn
// back toward the back foot, the hand low in front of the chest and the blade
// slanting forward across the line to the face, as the plate of an outside face
// cut draws it.
//
// The hand holds the sabre in the guard half way between the second position and
// the third, the 2/3, so the edge faces down and out, and turns it to meet each
// action with the edge: to the third for the cuts to the head, where the edge comes
// down; to the fourth for the cut to the chest, so the edge comes across into it;
// to the second for the parries that meet a cut from the outside, parry 3 and face
// protection; and right over, to the first, for parry 5, so the edge faces up at a
// cut to the head.
export const POSES = {
  guard: { hipX: 41, hipY: 77, footF: 84, liftF: 0, liftB: 0, lean: 0, turn: 58, arm: -24, fore: -4, armYaw: 0, foreYaw: 0, blade: 34, yaw: 0, hand: -45, rArm: -140, rFore: -28, toeBack: 14, kneeOut: 40 },
  advLift: { hipX: 44, hipY: 79, footF: 103, liftF: 4 },
  advLand: { hipX: 52.5, hipY: 79, footF: 114 },
  prep: { hipX: 42, lean: 1, arm: 15, fore: 30, blade: 85, hand: 0 },
  lungeFly: { hipX: 60, hipY: 70, footF: 124, liftF: 5, lean: 6, arm: 16, fore: 16, blade: 30, hand: 0 },
  lungeHead: { hipX: 83.1, hipY: 54.6, footF: 133, lean: 6, arm: 18, fore: 16, blade: 20, hand: 0 },
  lungeChest: { hipX: 83.1, hipY: 54.6, footF: 133, lean: 15, arm: 2, fore: 2, blade: 10, hand: 90 },
  parry3: { hipX: 38, hipY: 78, lean: -3, arm: -110, fore: -4, blade: 95, hand: -90 },
  parry3Back: { hipX: 24, hipY: 80, lean: -6, arm: -110, fore: -4, blade: 95, hand: -90 },
  faceParry: { hipX: 30, hipY: 82, footF: 56, lean: 0, arm: -97, fore: 8, blade: 53, hand: -90 },
  parry5: { hipX: 38, hipY: 78, lean: -4, arm: 20, fore: 112, blade: 6, yaw: 70, hand: -180 },
  parry5Back: { hipX: 24, hipY: 80, lean: -7, arm: 20, fore: 112, blade: 6, yaw: 70, hand: -180 },
  riposte: { hipX: 50, hipY: 77, footF: 100, lean: 8, arm: 0, fore: 0, blade: -6, hand: 0 },
  extend: { hipX: 42, lean: 1, arm: 4, fore: 4, blade: 14, hand: 0 },

  // The postures of Leszák Károly's Kardvívás (1906), the base chapters, in the
  // translation in sources/kardvivas-1906. The nine sabre positions are held in
  // the guard's stance, as the book's photographs show them, so each sets only the
  // arm, the blade and the hand. The book's hand positions are the ones the hand
  // slider names: its 6th attitude is the 2/3, its 5th the 3/4. Where the book
  // puts the hand across the body (prime, quarte, low quarte 1, sixte), the arm is
  // turned out of the plane of its shoulder (armYaw, foreYaw).
  basicStance: { hipX: 6, hipY: 97, footF: 12, toeBack: 0, turn: 45, arm: 0, fore: 0, blade: 0, yaw: 12, hand: -90 },
  atEase: { hipX: 17, hipY: 94, footF: 34, turn: 45, arm: -90, fore: -90, blade: -58, hand: -90, rArm: -100, rFore: -95 },
  tierce: { arm: -41, fore: 2, blade: 27, hand: -45 },
  seconde: { arm: -46, fore: 27, blade: -30, yaw: -6, hand: -135 },
  prime: { arm: -87, armYaw: 7, fore: 90, foreYaw: 50, blade: -57, yaw: 30, hand: 90 },
  quinte: { arm: -24, fore: 89, blade: 18, yaw: 62, hand: -180 },
  quarte: { arm: -95, fore: 0, foreYaw: 45, blade: 60, yaw: 42, hand: 45 },
  lowTierce: { arm: -95, fore: -20, blade: 51, yaw: -10, hand: -90 },
  lowQuarte1: { arm: -95, fore: -76, foreYaw: 65, blade: 61, yaw: 30, hand: 45 },
  lowQuarte2: { arm: -95, fore: -35, blade: 0, yaw: 80, hand: 0 },
  sixte: { arm: -6, armYaw: 79, fore: 77, foreYaw: -9, blade: 77, yaw: -64, hand: 90 },
  septime: { arm: 105, fore: 20, blade: -85, yaw: -28, hand: -90 },
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
  parry3Back: "Parry 3, weight back",
  faceParry: "Face protection",
  parry5: "Parry 5",
  parry5Back: "Parry 5, weight back",
  riposte: "Riposte, head",
  extend: "Arm extended",
  basicStance: "Basic stance",
  atEase: "At ease",
  tierce: "Tierce",
  seconde: "Seconde",
  prime: "Prime",
  quinte: "Quinte",
  quarte: "Quarte",
  lowTierce: "Low tierce",
  lowQuarte1: "Low quarte (1)",
  lowQuarte2: "Low quarte (2)",
  sixte: "Sixte",
  septime: "Septime",
};

// The older man's own guard, so the pair do not stand as mirror images in the
// scenes: he stands 3 cm higher, in a shallower bend, and holds the sword arm bent
// and tucked in, the blade a little steeper. Only joints that every other pose he
// takes sets for itself are changed, so none of it carries into his parries and
// ripostes, and no foot moves.
const OLDER_GUARD = { hipY: 80, arm: -42, fore: 10, blade: 38 };
const olderGuard = (x) => ({ pose: "guard", x, adj: { ...OLDER_GUARD } });

// The drills from a class, as they were taught there: A attacks and B defends.
// From the guard, A cuts lightly across B's blade, level, landing just above B's
// guard; B's guard holds and A's blade comes off it, A keeping the arm out. Then B
// ripostes to A's sword hand. With A's blade forward and the hand in the 2/3, the
// top of the glove is open, and B cuts down onto it. With A's point raised, the
// bell over the fist covers the top, and the hand in the 3/4 shows B the outside
// of the glove: B goes round to the outside of the hand and cuts in onto it,
// level. Or, as B comes round, A turns the guard out over that side, the hand
// where it was, which is tierce, and B goes on under the hand and cuts up into
// the underside of the glove: the Hungarian cut.
//
// A's light cut comes across from his own side, so it lands on the inside of B's
// blade, the hand in the 3/4 so the edge leads. B's sword arm lies in a plane of
// its own, a hand's breadth nearer the camera than A's (see below), so his blade
// crosses A's forearm at a shallow angle. It can come in level onto the outside of
// the glove because A's raised point stands the fist upright, and it goes round
// and under the hand in front of A's raised blade, never through it. Every cut
// lands edge first, on the middle or the foible, clear of A's bell and knuckle bow.
const LIVE = "Live learning";
const CLASS = "Warsaw advanced sabre, 15 Nov 2026";
const extendTo = (x, adj) => ({ pose: "extend", x, adj });
const lightCut = () => ({
  label: "A cuts lightly across B's blade, above the guard",
  ms: 240,
  hold: 300,
  ease: "snap",
  A: extendTo(0, { arm: -15, fore: 5, blade: 4, yaw: 21, hand: 45 }),
});
// A's blade comes off B's, the arm held out: the blade forward and the hand in the 2/3, so the top of the glove is
// open; or the point raised and the hand kept in the 3/4, so its outside is.
const topOpen = () => ({ label: "B's guard holds; top of A's glove open", ms: 140, hold: 60, A: extendTo(0, { arm: -15, fore: 5, blade: 4, yaw: -4, hand: -45 }) });
const pointUp = () => ({ label: "B's guard holds; A raises the point, side open", ms: 160, hold: 80, A: extendTo(0, { arm: -15, fore: 5, blade: 75, yaw: -5, hand: 45 }) });
// B's riposte, from his own height in the guard so he does not bob.
const olderTo = (pose, adj) => ({ pose, x: 310, adj: { hipY: 80, ...adj } });
// To the outside of A's hand: the point up, round in front of A's raised blade and out past the hand, then down beside
// it, level, at the height of the fist.
const roundOutside = () => [
  { label: "B lifts the point", ms: 110, B: olderTo("prep", { lean: 5, turn: 64, arm: 0, fore: 40, blade: 70, yaw: 6, hand: -45 }) },
  { label: "B goes round to the outside of A's hand", ms: 120, B: olderTo("extend", { lean: 6, turn: 72, arm: 0, fore: 25, blade: 45, yaw: 40, hand: -90 }) },
];
const downOutside = () => olderTo("extend", { lean: 6, turn: 76, arm: -22, fore: 2, blade: -3, yaw: 40, hand: -90 });
const bothRecover = () => ({ label: "Both recover", ms: 420, hold: 500, A: { pose: "guard", x: 0 }, B: olderGuard(310) });

// A phrase is a list of steps. Each step moves into its poses over `ms`, then
// holds them for `hold`; a fencer a step leaves out keeps the previous spec. A
// step with no hold is passed through: the body runs on through it without
// stopping, as a lunge in flight runs on into the landing.
//
// A sword arm lies in a plane of its own, about 12 cm to one side of the line
// between the fencers, so two blades that cross in the side view can still pass
// each other in depth.
//
// The page keeps what it teaches in two sections, one tab each, and each section
// has its own base postures (see bases.js) and its own scenes. Live knowledge is
// what was learned in person and practised; Book knowledge is what a book teaches,
// taken from its text. The Creator, the third tab, belongs to neither.
export const SECTIONS = [
  { id: "live", name: "Live knowledge" },
  { id: "book", name: "Book knowledge" },
];

// These are the scenes the practice library starts with, each in a `section` of
// the page. It lists only what was learned live: the drills from a class, each
// saying which class, as a scene may with a `source`, the kind of learning it
// comes from, an `event`, where it was noted, and a `reference` link. No scene is
// made from the book yet, so the book's section has only its postures.
export const PRESETS = [
  {
    id: "class-light-cut-top-of-glove",
    section: "live",
    phrase: {
      name: "Light cut on the blade, riposte to the top of the glove",
      source: LIVE,
      event: CLASS,
      note: "A attacks, B defends, both in guard. A cuts lightly across B's blade, level, just above the guard; B's guard holds and A's blade comes off, A keeping the arm out with the top of the glove open. B lifts the point and cuts down onto the top of A's glove.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
        lightCut(),
        topOpen(),
        { label: "B lifts the point", ms: 110, B: olderTo("prep", { lean: 4, turn: 62, arm: -5, fore: 30, blade: 62, yaw: 8, hand: 0 }) },
        { label: "B cuts down onto the top of A's glove", ms: 150, hold: 700, ease: "snap", B: olderTo("extend", { lean: 9, turn: 62, arm: -13, fore: 20, blade: -5, yaw: 21, hand: 0 }) },
        bothRecover(),
      ],
    },
  },
  {
    id: "class-light-cut-side-of-glove",
    section: "live",
    phrase: {
      name: "Light cut on the blade, riposte to the side of the glove",
      source: LIVE,
      event: CLASS,
      note: "As the cut to the top of the glove, but A raises the point as his blade comes off, so the bell covers the top of the hand and the outside of the glove is open. B goes round to the outside of A's hand and cuts in, level, onto the outside of the glove. The hand close-up looks from that side.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
        lightCut(),
        pointUp(),
        ...roundOutside(),
        { label: "B brings the blade down outside the hand", ms: 110, B: downOutside() },
        { label: "B cuts in onto the outside of A's glove", ms: 130, hold: 700, ease: "snap", B: olderTo("extend", { lean: 6, turn: 76, arm: -22, fore: 2, blade: -3, yaw: 24, hand: -90 }) },
        { label: "B drops the blade under the hand", ms: 120, B: olderTo("extend", { lean: 4, turn: 70, arm: -40, fore: -12, blade: -4, yaw: 30, hand: -90 }) },
        { label: "B brings it back under the arm", ms: 140, B: olderTo("extend", { lean: 3, turn: 64, arm: -44, fore: -8, blade: -2, yaw: 4, hand: -90 }) },
        bothRecover(),
      ],
    },
  },
  {
    id: "class-light-cut-tierce-hungarian-cut",
    section: "live",
    phrase: {
      name: "Light cut on the blade, tierce, Hungarian cut under the glove",
      source: LIVE,
      event: CLASS,
      note: "As the cut to the side of the glove, but as B comes round to the outside, A turns the guard out over it, the hand where it was: tierce. B goes on under the hand and cuts up into the underside of the glove: the Hungarian cut. Then he draws the blade out from under, and both recover.",
      camera: 0,
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: olderGuard(310) },
        lightCut(),
        pointUp(),
        ...roundOutside(),
        { label: "A turns the guard out to cover: tierce", ms: 110, A: extendTo(0, { arm: -15, fore: 5, blade: 75, yaw: -5, hand: -90 }), B: downOutside() },
        { label: "B goes under the hand", ms: 110, B: olderTo("extend", { lean: 8, turn: 70, arm: -32, fore: -14, blade: -2, yaw: 38, hand: -135 }) },
        { label: "Hungarian cut under A's glove", ms: 140, hold: 700, ease: "snap", B: olderTo("extend", { lean: 8, turn: 63, arm: -20, fore: -20, blade: 6, yaw: 19, hand: -135 }) },
        { label: "B draws the blade out from under", ms: 160, B: olderTo("extend", { lean: 6, turn: 62, arm: -25, fore: -15, blade: -20, yaw: 2, hand: -90 }) },
        bothRecover(),
      ],
    },
  },
];

// The hand positions the books name, by how far the hand is turned (see `hand`
// above), so the slider can say which one it is on.
export const HAND_POSITIONS = { "-180": "1st", "-135": "1/2", "-90": "2nd", "-45": "2/3", 0: "3rd", 45: "3/4", 90: "4th" };

// The sliders under "Adjust this moment", in order. `x` is where the fencer
// stands on the piste; every other key overrides a value of the pose. A slider
// moves in steps of `step`, or of one, and says the name in `names` of a value
// that has one. The labels say where a joint turns in terms of the fencer, not of
// the camera: the camera is on the side of the piste the chest turns to in the
// postures, and on the other side in the scenes.
export const JOINTS = [
  { key: "x", label: "Position on the piste", min: -70, max: 300, unit: " cm" },
  { key: "footF", label: "Front foot reach", min: 10, max: 135, unit: " cm" },
  { key: "liftF", label: "Front foot lift", min: 0, max: 30, unit: " cm" },
  { key: "hipX", label: "Hips forward", min: 5, max: 90, unit: " cm" },
  { key: "hipY", label: "Hip height", min: 48, max: 98, unit: " cm" },
  { key: "toeBack", label: "Back foot turned back", min: 0, max: 45, unit: "°" },
  { key: "kneeOut", label: "Back knee turned out", min: 0, max: 90, unit: "°" },
  { key: "lean", label: "Torso lean", min: -25, max: 35, unit: "°" },
  { key: "turn", label: "Shoulder turn from square", min: 0, max: 90, unit: "°" },
  { key: "arm", label: "Upper arm", min: -120, max: 120, unit: "°" },
  { key: "fore", label: "Forearm", min: -100, max: 130, unit: "°" },
  { key: "armYaw", label: "Upper arm across the chest", min: -90, max: 90, unit: "°" },
  { key: "foreYaw", label: "Forearm across the chest", min: -90, max: 90, unit: "°" },
  { key: "blade", label: "Blade angle", min: -180, max: 180, unit: "°" },
  { key: "yaw", label: "Blade across the body", min: -85, max: 85, unit: "°" },
  { key: "hand", label: "Hand position", min: -180, max: 90, step: 15, unit: "°", names: HAND_POSITIONS },
  { key: "rArm", label: "Rear upper arm", min: -180, max: 180, unit: "°" },
  { key: "rFore", label: "Rear forearm", min: -180, max: 180, unit: "°" },
];
