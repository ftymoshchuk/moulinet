# Moulinet

Sabre Motion Lab: sabre fencing drawn in ink, in your browser. Practise what a
live class taught, study what a book teaches, or make a scene of your own: slow
it down, step through it and reshape any moment. Every pose is a
handful of numbers and every scene a short list of keyframes, so a whole
animation is a few lines of text you can edit, keep and share.

**Open it at <https://ftymoshchuk.github.io/moulinet/>.** It runs entirely in
your browser: no account, no server, and nothing you type leaves the page.
Scenes you save stay in your browser's own storage, on that device.

The name comes from the *moulinet*, the sabre's circular cut: the blade drops
forward past the arm, swings up behind and comes down over the top.

## Three tabs
One stage, three tabs. Choose the tab at the top of the page: **Live knowledge**,
**Book knowledge** or the **Creator**. The first two are sections, and each has
base postures of its own, since what a class teaches and what a book teaches are
not the same postures. Where a section has both scenes and postures, as live
knowledge does, a switch above its list chooses between its **practice library**
and its **base postures**; the book has postures only, so it opens on them. Each
tab remembers what it was showing, and comes back to it.

**Live knowledge: the practice library.** Scenes to practise from, each with the kind of learning
it comes from, such as a class taken in person, a video or a book, the event it
was noted at and a link to a reference, such as a video of the bout. The library
holds only what was learned live: the three built in are drills from a class, as
they were taught there. The page opens paused, and so does each scene you pick;
nothing on it plays until you press Play. The first drill is a corrected version,
recorded in the Creator step by step with the times the steps took: the defender
holds his blade out level and lowers the point and the hand, the attacker brings
his blade down from upright to level and reaches out, and the defender lowers his
elbow. It stops there, before the riposte to the top of the glove, which is still
to be recorded. In each of the other two the attacker cuts lightly across the
defender's blade, level, just above the guard, and the defender ripostes to the
attacker's sword hand: in onto its outside, level, when the attacker raises the
point; or, when the attacker turns the guard out over that side, which is tierce,
round and under the hand and up into the underside of the glove, the Hungarian cut.
In those two the older man holds the same guard, standing a little higher, in a
shallower bend, so the two do not stand as exact mirror images. The drills say where they
come from: live learning, at Warsaw advanced sabre on 15 November 2026. A scene's
source shows as a tag on its card. Scenes you save in the Creator are listed
below them, with whatever you noted, and a link opens in a new tab. They live in
your browser's storage, so one saved or deleted in another tab of the page
appears or goes here too.

**Base postures.** One fencer, never a pair, in one posture at a time, with the
posture described in words: what it is for, and the parts worth looking at,
the hand that holds the sabre among them. He is right-handed and faces left, as
the book's fencer does in its photographs: the sabre is in his right hand and the
sword arm on the far side of his chest, which is turned toward you, with the rear
hand on the hip nearer to you. Pick a posture from the list, or use the arrows under the stage. The
postures are the poses of the library, twenty-six of them, shared between the two
sections and numbered from 1 within each. **Live knowledge** has the first
fourteen, in the order they are learned: the guard; the two halves of an advance;
the arm extended and the blade up; the lunge in flight, to the head and to the
chest; parry 3, and parry 3 with the weight drawn back; face protection; parry
5, and parry 5 with the weight drawn back; and the riposte.

**Book knowledge.** The last twelve postures, taken from the base chapters of
Leszák Károly's *Kardvívás* (1906), whose translation is in
[`sources/kardvivas-1906`](sources/kardvivas-1906/): the basic stance and the
stance at ease, then the nine sabre positions the book teaches: tierce, seconde,
prime, quinte, quarte, low tierce, low quarte in its two forms, sixte and
septime. Each says where in the book it is, and what the book leaves open, and
beside the stage, under the list of postures, the page shows the book's photograph
of it, as printed, with its figure number and page: twelve figures in all, for
every posture but the stance at ease, which the book does not picture. No scenes
are made from the book yet, so this section has no practice library.

**Changing a posture.** Under a posture's description, **Edit this posture** opens
its numbers as sliders: the ones the Creator has for a moment, all but where the
fencer stands. Move one and the posture changes on the stage, and in the Creator
and in every scene that uses it, since a scene names its postures. What you
change is your own version of the posture. It is kept in your browser's storage,
as the joints you moved and nothing else, so it is on this device only: the
built-in posture stays as it is in the code, and nobody else sees yours. A
posture with a version says so, beside its name and on its button, and the
library and the Creator say that postures are being drawn as you made them. A
slider you have moved shows its value in amber and has a **Reset** that puts back
just that joint; a joint moved back to where the posture has it is no longer part
of the version; and **Reset to built-in** puts back all of the posture's, after
asking. A posture takes whatever it does not set itself from the guard, so
changing the guard changes them too: the advance's sword arm, for one. **Copy
numbers** copies the numbers of every posture you have made a version of, as
lines for `POSES` in `site/js/library.js` with what each changed, to send on so
that they can be made part of the page for everyone; where the browser will not
copy, they are left selected in a box to copy by hand. The words that describe a
posture are not changed with its numbers. On a screen wide and tall enough to
show them side by side, the stage stays in view beside the sliders as the page
scrolls.

**Creator.** Make a scene of your own. Start from a blank one with **New
scene**, or from a scene in the library: a built-in one opens as a copy, with
**Edit a copy in the Creator**, and one of your own opens as it is, with **Edit
in the Creator**, where **Save changes** writes over it. Add and remove steps,
name them, time them, give each fencer a pose and reshape it, then name the
scene, say where it comes from and where it was noted, add a reference link and keep it with **Save to
library**. A scene can be for one fencer or two. It asks before it replaces a
scene with changes that are not saved, and before you leave the page with one;
the camera angle counts, since a saved scene keeps it. If you save a scene that
another tab changed or deleted after you opened it, yours is kept as a new scene
beside theirs, and the Creator says so, so neither is lost.

All three share the stage, and its **camera**, which turns the view all the way
round the piste, up to a half turn either way: to see a blade come toward you or
swing away, end on, or from the other side of the piste, where the fencers change
places, so how you view them is up to you. The library looks as close as keeps
everyone and their whole blades in view; the base postures, as close as keeps the
fencer and most of the blade in view, so the point of the blade held up in Blade
up runs off the top. Turning the camera never zooms, and the view slides to keep
them in the frame as it goes round. The Creator keeps one view while you reshape
a scene.

**Hand close-up**, in every mode, looks closely at the sword hand instead, and
follows it as it moves: A's, or in the Creator the fencer you are reshaping. It
looks from outside the sword arm, which is where the old books draw the grip and
the hand positions from, so the blade points the way it does in their plates. In
a scene A's sword arm is on your side and B's on the far side, so for A it looks
from where you are and for B from the other side of the piste; in the base
postures the fencer's sword arm is on the far side, so it looks from there. The
camera turns it from there.

The library and the Creator, which play scenes, add:
- **Playback** at ¼, ½ or full speed, a step at a time, or scrubbed along the
  timeline, looped or once through.
- **Motion ghosts and blade paths** show how each moment was reached: four
  fading stick figures trail each fencer who is moving, and dotted lines trace
  both blade tips through the whole scene.

The base postures stand still, so they have neither.

In the Creator there is more:
- **This step:** its label, how long it takes to move into it and to stay on
  it, and whether it moves smoothly, snaps or keeps one speed. A step with no
  time to stay on it is passed through, and says so.
- **Adjust this moment:** eighteen sliders reshape either fencer on the current
  step, from where they stand on the piste, through the turn of the back foot
  and knee, the shoulders and the rear arm, to the sword arm, which can be
  turned out of the plane of its shoulder across the chest, the angle and turn
  of the blade and the position of the hand that holds it, which moves in steps
  of 15° and says when it is on one of the books' hand positions. A slider
  that has been moved shows its value in the accent colour and gets its own
  **Reset**, which puts that one joint back to what the pose says (hover it to
  see the value it goes back to) and leaves every other adjustment as it is. Where the fencer stands has no Reset of its own: that is a place on the
  piste, not a change to the pose.
- **Drag dots:** a dot lies on each part of the fencers that can be moved: the
  feet, the hips, the head, the sword elbow and hand, the point of the blade, and
  the rear elbow and hand. Take hold of one and move it, instead of moving a
  slider, and the part follows the pointer, from whichever side of the piste the
  camera is on; the sliders show what changed. Taking hold of a dot of the other
  fencer makes that fencer the one you are reshaping. The hand takes the whole arm
  with it, the elbow and the point of the blade turn only what they are on, the
  back foot moves the fencer along the piste, the head leans the body and the
  hips go up, down and along, the feet staying where they are. What is written
  to the step is whole numbers within the ranges of the sliders, and only the
  joints the drag moved; a joint taken back to what the pose gives it is no
  longer an adjustment. The dots show while the stage shows a step's own pose: a
  step picked, or a moment stopped in a step's hold, which is where pausing,
  moving along the timeline and pasting a phrase leave it. They are not there
  while a scene plays, between two steps or while the data is text that is not a
  phrase yet, and **Drag dots** puts them away. In the close-up of a hand the dots
  in view stay, those of the fencer whose hand it is, and the view holds still
  while one is dragged, and follows the hand again when it is let go; there the
  values are in tenths, since a degree of the arm is a long way on a stage that
  close. They work with a mouse, a finger or a pen. The sliders stay for the
  position of the hand, which no dot turns, and are the way in for the keyboard.
- **From above:** the stage has height and length but no depth, so under it the
  Creator draws the pair from above, the piste across the page, you at the
  bottom and A on the same side as on the stage, with a dot on each part that
  turns toward or away from you: the sword shoulder, which turns the shoulders,
  the elbow and hand, which turn the arm and the forearm out of their plane
  across the chest, the point of the blade, which turns it across the body, and
  the knee and the toe of the foot behind. They are dragged as the stage's dots
  are, and what a drag writes is the same joints the sliders have: the plan only
  gives the depth a place to be taken. A hand taken across the plan goes where the
  pointer goes, along the piste as well, so the arm may give a degree to keep it
  under it. The plan does not turn with the camera, a plan being easiest to read
  with the piste across it, but looks from the side of the piste the stage does,
  so that A is on the same side of both. Its box holds every pose of the scene,
  as the stage's does, and grows, wider too, for a pose that reaches far across the
  piste; it holds still while a part is dragged, so that the part stays under the
  pointer, and takes in the whole blade when it is let go. **From above** puts it
  away, and **Drag dots** puts away its dots with the stage's.
- **Record:** to act a movement out instead of building it a step at a time, press
  **Record** and drag the parts of the fencers as you would perform it. Each part
  you let go of is a milestone: a new step after the one you began from, named for
  who moved what (A moves the sword hand), with the pose the drag left and, as the
  move into it, the time the drag took, from the first change it made to the last,
  in tens of milliseconds and from a tenth of a second to five. A drag that follows
  on from the last milestone, with nothing else done to the scene in between, holds
  that milestone for the pause before it, up to two seconds, so that stopping to
  think does not play back as a hold. The step you began from is left as it was,
  and a press that moves nothing makes no milestone. A note under the stage says
  what to do, how many milestones there are, or that the dots are away. A milestone
  is a step like any other, to rename, retime, take out and play back, and with
  **Record** off a drag reshapes the step it is on, as before. It is off when the
  Creator is left.
- **Poses:** twenty-six named poses to put on any step, in the groups the
  sections of the page keep their base postures in.
- **Phrase data:** the whole scene as text. Edit it in place or paste one in;
  it applies as you type, and says why when it can't. The fields above it and
  the text are the same thing, and follow each other. While the text can't be
  applied they wait, dimmed, so that nothing you typed is lost, and they take
  it up again as soon as it applies.

## The figures
The fencers are not pictures. Each is worked out from a pose, a few numbers for
the joints, and drawn in the browser: two people modelled in three dimensions,
the young man and the older one, drawn in ink. The look follows the line
illustrations of old sabre training books, as a model to draw from; none of them
is scanned or traced into the figures. The one old book used here is a source for
the base postures, not a picture to draw from: its translation is kept under
`sources/`, and its photographs of the postures are shown beside them in Book
knowledge, as printed.

**The skeleton.** A pose sets where the hips are, how far the body leans, where
each foot stands and how far it is lifted, the angles of the arms and the blade,
and the hand position. The sword arm lies in the plane of its own shoulder
unless the pose turns the upper arm and the forearm out of it toward you, across
the chest, by `armYaw` and `foreYaw`, as `yaw` turns the blade: that is how
prime and sixte bring the hand across the body. The shoulders are turned toward
you, as in those books,
by the pose's `turn`, and the hips with them, if not as far, so each leg starts
from a hip of its own. The foot in front points at the opponent, and the foot
behind is turned across, its toe at you and turned back a little by the pose's
`toeBack`, so that the two make an L, as the stance is taught. The guard is the
plates' classic stance: wide, both knees bent, each over its own foot. The knee
of the leg behind is turned out toward you, over the foot, by the pose's
`kneeOut`: a little in the guard, and further, in proportion, as the weight sits
back over that foot. In the lunge the back leg is straight and the body stays
nearly upright over the front leg. The neck takes only part of the body's lean
and the head hardly any, so however the body leans the head is held up and the
eyes look ahead. The pose's hand position turns the hand and the hilt about the
blade, as the books number the positions: in the third the thumb is up and the
edge down; in the second the palm is down and the edge out; in the first the
thumb is down and the edge up, with the knuckle bow over the fist; in the
fourth the palm is up and the edge in; and there are halves between them, as
the 2/3 of the guard.

**The bodies** are MakeHuman's: its base mesh, skeleton and skin weights, which
its authors gave to the public domain, shaped into the two men with its body
targets. `scripts/bake-fencers.js` makes them once, ahead of time, into one
compressed file of 190 KB, `site/models/fencers.bin`: the young man athletic, in
knickerbockers and long stockings, and the older one heavier and balding, in
trousers to the ankle; their legs as long as the skeleton's, 90 cm from hip
joint to ankle, and their arms 31 cm to the elbow and 27 cm to the wrist; and
every point of each body on a garment, the jacket and breeches or trousers
standing a little off the skin, the gloves, the shoes, the hair. The cloth is
smoothed so it runs over the hollows of the body instead of into them, the seat
spans the cleft of the buttocks, and the bare feet are rounded into shoes. Each
garment ends in a straight seam round the body, at the waist, below the knee,
at the collar and at the cuffs, where the ink draws a line, as an illustrator
draws a hem.

**Posing.** Each frame poses the bodies from the skeleton. The hips go where the
skeleton has them, square to its hips, and the chest turns and leans with its
shoulders, the spine turning from one to the other; the neck and head lean and
nod as the skeleton's do. Each ankle goes exactly where the skeleton's is, as
far above the floor as the body's ankle is above the sole of its shoe, with the
knee bending the skeleton's way, and the foot lies flat or tips up at the toe as
it lifts. The rear hand goes where the skeleton has it, on the hip. The sword
hand closes round the grip, the fingers curled round it, the forefinger least,
and the thumb along its back, its tip just behind the guard; the sabre is
exactly where the skeleton has it. A hand that would have to bend further at
the wrist, or turn further about the forearm, than an arm can goes only so far,
and the sabre turns between thumb and forefinger for the rest, as it does in a
moulinet. The shoulder comes forward on the collarbone to let the hand reach,
and in the few moments of a moulinet it still cannot, the hand falls short by
a few centimetres and the sabre goes with it. The blade is drawn as a blade, broad at
the guard and narrowing to the point, the back sweeping down to meet the edge there,
and the edge, ground thin, in the colour of its fencer's blade path, so that which way
it faces shows in every cut and parry, even where the blade is thin on the page. An arm or a leg all but straight
turns its elbow or knee the way the skeleton's would bend, or failing that the
way the hand or the foot has it, so a limb passing through straight never turns
over: no bone turns more than 25° in 4 ms.

In the skeleton's own frame, the fencer facing left stands as the skeleton has
him, which is the one facing right turned round: his sword arm is on your side,
and the blades meet in three dimensions where they touch, not only from the side,
as the drills are worked out.

**Which hand.** The skeleton has the sword on the side of the chest away from the
camera, so as it is worked out both fencers hold the sabre in the left hand: A
stands on the left facing right, his chest turned toward you, and B, who is A
turned round, faces left with his back to you. The stage is shown in a mirror, so
on the page they are right-handed, as in life and in the book. Everything on the
stage turns with it, the figures, their marks on the floor, the motion ghosts and
the blade paths. A mirror alone would put A on the right, so the camera for the
scenes and the Creator goes round to the other side of the piste, facing B: A is
back on the left, facing right, with his back and his sword arm toward you, and B
faces left with his chest toward you and his sword arm on the far side. The base
postures have one fencer and are seen from the first side, so that he faces left
with his chest toward you and his sword arm on the far side, as the book's
photographs show him. That is where the camera starts, and you can turn it all the
way round to the other side: for a scene, round to where A is on the right facing
left with his chest toward you and B has his back to you. The light is on the
camera's side, to the upper left of what is seen. The poses, the scenes and the
camera angle mean what they always did: the piste still runs from A's end on the
left to B's on the right. Where this page says a pose turns toward the camera or
toward you, it means toward the side the chest turns to, which is toward you in the
postures and away from you in the scenes, until you turn the camera round.

**The ink.** The figures are drawn with [three.js](https://threejs.org), r170,
kept in `site/vendor/`, three times over, off the page: in the flat colours of
what they wear, in white under a light from high in front, and as which way each
point of them faces and how far it is from you. Ink goes where the distance
jumps, at their outline and where a part passes in front of another, where a
surface turns sharply, and where one colour meets another, at a seam; the line
is heavier on the side away from the light, as a pen presses on the shadow
side, and finer round the sabres, so as not to hide a blade's edge. Hatching goes where the light is low, crossed where it is lowest, ruled
from a point on each fencer so that it moves with him rather than staying on the
screen; the young man's hair is dark, the older man's grey hair strokes of the
pen; everything else keeps its flat colour. With **Ink texture** on, the pen
wavers a little along its lines. The drawing is made finer than the screen, so
the lines are smooth, on a canvas laid over the stage, whose floor, motion
ghosts and blade paths show through, and three strokes of the pen on the floor
under each planted shoe, shorter as it lifts.

The figures load as the page opens, about 370 KB, and need a browser with WebGL
2. The stage waits a moment for them; in a browser without it, stick figures
stand in, and a note under the stage says why.

## Writing a phrase
A scene is a phrase: JSON, with a few words about where it comes from. **Phrase
data** shows the one on stage, a step per line:

```json
{
  "name": "Advance, lunge, head cut",
  "source": "Live learning",
  "event": "Club night, October",
  "reference": "https://example.com/watch?v=abc",
  "note": "The arm moves before the legs.",
  "camera": 0,
  "steps": [
    {"label": "En garde", "hold": 600, "A": {"pose": "guard", "x": -30}, "B": {"pose": "guard", "x": 310}},
    {"label": "Lunge", "ms": 150, "A": {"pose": "lungeFly", "x": 0}},
    {"label": "Head cut lands", "ms": 120, "hold": 700, "ease": "snap", "A": {"pose": "lungeHead", "x": 0}}
  ]
}
```

- `name`: the scene's title in the library, up to 100 characters.
- `source`: the kind of learning it comes from, in your own words: a class taken
  in person (live learning, as the drills from the class say), a video, a book.
  It shows as a tag on the scene's card, and the Creator offers the sources the
  library already has as you type. Up to 40 characters.
- `event`: where it was noted, in your own words: the competition and round,
  say. Up to 160 characters.
- `reference`: a link to where you can see it, up to 2,000 characters. Only
  `http` and `https` addresses become links; anything else is shown as not a
  link.
- `note`: whatever else is worth saying, up to 1,000 characters.
- `camera`: the view in degrees from side on, -180 to 180: 0 is the side the
  page starts on, B's side for a scene, and 180 the other side of the piste. A
  pasted phrase with a new angle turns the view to it, and saving a scene keeps
  the angle it was seen from.
- `solo`: `true` for one fencer. B leaves the stage, and every edit goes to A.
- `steps`: the keyframes, in order, at least one.

The fields hold typing to those lengths, and a scene is saved only within them:
the Creator says which text is too long and takes you to it. Text that is longer
anyway, pasted in or saved some other way, is shown cut short.

Each step:

| Key | What it does |
|---|---|
| `label` | The step's name on the stage and on its button, up to 100 characters. A step without one is called "Step" and its number. |
| `ms` | Milliseconds to move into this step from the one before. The first step is where the phrase starts, so its `ms` is ignored. |
| `hold` | Milliseconds to stay on the step before the next move. A step with no hold, between two moves, is passed through: the body runs on through it without stopping, as the lunge in flight runs on into the landing. |
| `ease` | How the move runs: `"snap"` arrives fast and settles, `"linear"` keeps one speed; anything else eases in and out. A move that starts or ends at a step it passes through leaves or arrives at the speed the body has there. |
| `A`, `B` | Each fencer at the end of the move. A fencer a step leaves out stays as the step before had them. |

Between two steps each joint goes from where one has it to where the next does,
and never past either. Through a step that is passed through, a joint that goes
on the same way keeps moving, and one that turns back stops there. The feet and
the hips move by where they are on the piste, so a foot that is in the same place
at both ends of a move stays there, however the rest of the body moves. A foot
that travels along the floor while the other stays where it is, as in a lunge,
a recovery or the back foot of an advance, is lifted on the way, a tenth as high
as it travels and no more than 4 cm, and set down where it is going, the foot in
front heel first. One that moves less than 2 cm slides, and so do both feet when
both travel. A step that lifts a foot itself, as the advance does, keeps its own
lift.

A fencer is `{"pose": …, "x": …, "adj": {…}}`:

- `pose`: a name from the pose library below. A name it does not know is drawn
  as the guard, and **Phrase data** says which name that was.
- `x`: where the fencer stands on the piste, in centimetres. Until a phrase
  places them, A stands at 0 and B at 310, facing each other.
- `adj`: joint values that override the pose on this step. **Adjust this
  moment** writes them; a slider's own **Reset** takes back just that joint,
  and picking a pose or **Reset this step's adjustments** clears them all.

The joints `adj` can set. Lengths are centimetres; angles are degrees, where 0
points at the opponent and 90 straight up. Where a row says the camera, it means
the side the chest turns to, as in **Which hand** above.

| Key | Joint |
|---|---|
| `hipX`, `hipY` | Hips: how far their middle is forward of the back foot, and how high |
| `footF` | Front foot: how far forward of the back foot |
| `liftF`, `liftB` | How far the front or back foot is off the floor |
| `toeBack` | How far the toe of the foot behind is turned back from pointing at the camera: 0 makes an exact L with the front foot |
| `kneeOut` | How far the knee behind is turned out toward the camera, from bending straight back: 0 is flat, 90 straight at the camera |
| `lean` | Torso lean, forward positive |
| `turn` | How far the shoulders are turned toward the camera: 0 is side on, 90 square to it |
| `arm`, `fore` | Sword arm: upper arm and forearm |
| `blade` | Blade angle |
| `yaw` | Blade turned toward the camera |
| `hand` | The hand position, turned about the blade as the books number the positions: 0 is the third, thumb up and the edge down; -90 the second, palm down and the edge out; -180 the first, thumb down and the edge up; 90 the fourth, palm up and the edge in; and the halves between them, -45 the 2/3. A move between two goes through the ones between |
| `rArm`, `rFore` | Rear arm, hand on the hip |

The poses. Each fills in what it leaves out from the guard. The **Base
postures** describe each one in words, and let you change its numbers for this
device: a scene names its poses, so a posture you have changed is drawn as you
changed it wherever a scene uses it, and your version is not part of the scene.

| Name | Pose |
|---|---|
| `guard` | Guard, in tierce |
| `advLift`, `advLand` | Advance: front foot lifts, front foot lands |
| `prep` | Blade up |
| `lungeFly` | Lunge, in flight |
| `lungeHead`, `lungeChest` | Lunge, landing a head cut or a chest cut |
| `parry3`, `parry5` | Parry 3, parry 5 |
| `parry3Back`, `parry5Back` | Parry 3, parry 5, with the weight drawn back over the bent back leg |
| `faceParry` | Face protection: standing up, the hand low in front and the blade slanting forward across the line to the face |
| `riposte` | Riposte to the head |
| `extend` | Arm extended |

Each holds the sabre in a hand position of its own: the guard and the advance in
the 2/3, with the edge down and out; the arm extended, the blade up, the cuts to
the head and the riposte in the third; the cut to the chest in the fourth; parry 3
and face protection in the second, the edge out to meet the cut; and parry 5 in
the first, turned right over so the edge faces up.

## Run it on your own computer
The page is plain HTML, CSS and JavaScript in `site/`, with no build step; the
one library it uses, three.js for the 3D figures, is kept in `site/vendor/`.
Serve that folder with anything that serves files:

```bash
git clone https://github.com/ftymoshchuk/moulinet.git
cd moulinet
npm start                                       # needs Node.js 20 or newer
# or
python3 -m http.server --directory site 8000
```

Then open <http://127.0.0.1:8000/>. Opening `site/index.html` straight from
disk does not work, because browsers load JavaScript modules only over HTTP.

## Development
```bash
npm test
```
There is nothing to install: the tests use Node's own test runner. They cover
the timeline and its maths, with how the body moves between steps (through a step
it passes, the feet that stay and the feet that step, and a wrist that never bends
past what parry 5 asks), the edits the Creator makes to a scene, the saved
scenes (what they keep and what they leave alone) and the check that a
reference link is a web address, the postures people make their own versions of
(what a version changes and what it leaves, which joints and values it can hold,
the lines of numbers it gives to send on, and how it is kept on the device and
what is left alone there), the parts of a fencer that can be dragged on the stage
and on the plan from above (a drag turned into joint values that put the part where
it was taken, for every pose, both fencers and every side of the piste, within the
sliders' ranges, and the mirror they are shown in), the milestones a recording
makes (how long a drag or a pause took as the times a step takes, and what a
milestone is called), the base postures of each section, the skeleton and the camera
(the knees and the arms, the hand positions, where the stage looks, with every
fencer in it at every camera angle all the way round, and every phrase and posture
at every moment from eight camera angles, checked for broken path data), the
postures of the 1906 book, each checked against what the book
says of it, the figures (the bodies read back as they were baked, and posed in
every scene with the ankles, the rear hand and the blade's point where the
skeleton has them, from any camera, the sabre in the left hand of both fencers,
which the stage's mirror makes the right, the wrist bending no further than a wrist
can and no bone turning over, and the drills from the class landing where the class
has them: the light cut on the inside of the defender's blade just above his guard,
and each riposte edge first on the attacker's glove, on the outside or underneath,
with no blade going into an arm at any moment, and the first drill held to the
recording it was made from), and the published files (only relative links to
files that exist, no outside requests, every element the scripts need, and the
licences of what is bundled). Forty-five more run in a real browser: headless
Chrome or Chromium loads the page, then a driver page works every control of
every tab and mode, with hostile input among it, and checks the result, down to
the page opening paused, the stage turned in its mirror, the camera on the side
of the piste it should be and turning all the way round, two browser tabs saving
the same scene, a posture's numbers changed, kept, copied and put back, the
parts of a fencer taken hold of and dragged with the pointer, on the stage and on
the plan from above, and a recording of them, and the 3D figures
taking the stage; and once more with
WebGL turned off, where the stick figures stand in and the note says why. They
need Chrome or Chromium on your `PATH`, or `CHROME_BIN` pointing at one, and are
skipped without it.

The practice library lists only the drills from the class. The five scenes it used
to list, an advance, lunge and head cut, a chest cut parried in 3, a head attack
parried in 5, a cut at the face met with face protection, and the moulinet, stay in
`tests/retired-scenes.js` as test data: they are the longest runs of poses the
timeline, the figures and the rig are tried on.

To change the bodies, edit `scripts/bake-fencers.js` and run it on MakeHuman's
files, from its repository at the commit the script names:

```bash
git clone --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman.git ../makehuman
git -C ../makehuman sparse-checkout set makehuman/data/3dobjs makehuman/data/rigs makehuman/data/targets/macrodetails
git -C ../makehuman checkout a8bc2d54ff0ac92e78ff71431b1023eda42bf482
node scripts/bake-fencers.js ../makehuman/makehuman
```

CI runs the same on every pull request, with the runner's Chrome and the
browser tests required. Its `ci-passed` job succeeds only when every other job
does, and is the one check `main` requires.

Dependabot opens a pull request when an action the workflows use has a new
release, and CI checks it like any other change. The two Pages actions only
run when a merge publishes, so if a bump breaks them, that publish fails and
the site stays as it was.

Project layout:
- `site/index.html` and `site/css/styles.css`: the page
- `site/js/app.js`: the tabs and modes, the controls, and drawing each frame
- `site/js/phrase.js`: phrases as data: timeline, in-betweens, text, edits
- `site/js/figure.js`: a pose's skeleton, the hand on the blade, the camera, where the stage looks, the motion ghosts, the blade paths and the marks on the floor
- `site/js/library.js`: the poses, the sections of the page, the built-in scenes and the sliders
- `site/js/bases.js`: the base postures, in words, and which section each belongs to
- `site/js/scenes.js`: reference links, and the scenes saved on this device
- `site/js/postures.js`: the postures people make their own versions of, laid over the library's numbers and kept on this device
- `site/js/handles.js`: the parts of a fencer that can be dragged on the stage in the Creator, and the joint values that put one where it is taken
- `site/js/stage3d.js`: the figures drawn in ink on a canvas over the stage
- `site/js/rig.js`: the bodies on their bones, posed from a pose's skeleton, and the sabre
- `site/js/bodies.js`: reads the bodies from `site/models/fencers.bin`
- `site/models/`: the bodies, with their licence; `site/vendor/`: three.js, with its licence
- `site/fonts/`: Big Shoulders Display and IBM Plex, with their licences
- `scripts/serve.js`: the local server; `scripts/bake-fencers.js`: the bodies from MakeHuman's files; `scripts/protect-repo.sh`: repository settings
- `sources/kardvivas-1906/`: the translation of the base chapters of a Hungarian sabre book of 1906, with its glossary and figures, which the last twelve base postures are taken from (not part of the published site, except for the twelve photographs the page shows, copied into `site/img/kardvivas-1906/`)
- `tests/`

## Publishing
Changes reach `main` only through pull requests, and a pull request merges
only when `ci-passed` is green and the branch is up to date with `main`. Each
merge publishes `site/` to <https://ftymoshchuk.github.io/moulinet/> through
`.github/workflows/pages.yml`, which runs the tests once more first. To
publish `main` again without a change, run the **Pages** workflow from the
Actions tab.

`scripts/protect-repo.sh` set this up, and running it again puts back any
setting that has drifted. It needs the GitHub CLI signed in as a repository
admin, and the repository public, since on GitHub Free rulesets and Pages
need that. It applies the branch ruleset, sets Pages to publish from GitHub
Actions, makes the site the repository's website, and turns on the security
settings a public repository should have.

## Contributing
Issues and pull requests are welcome. Run `npm test` before opening a pull
request, and for a change to the page, look at it with `npm start` too.

## License
Moulinet is licensed under the [Apache License 2.0](LICENSE). The fonts in
`site/fonts/` keep their own licence, the SIL Open Font License 1.1: see
[OFL-BigShoulders.txt](site/fonts/OFL-BigShoulders.txt) for Big Shoulders
Display and [OFL-IBMPlex.txt](site/fonts/OFL-IBMPlex.txt) for IBM Plex.
three.js, in `site/vendor/`, is under the MIT License: see
[MIT-three.js.txt](site/vendor/MIT-three.js.txt). The bodies in `site/models/`
are made from MakeHuman's assets, which are in the public domain, and are
dedicated to it likewise under CC0 1.0: see
[CC0-MakeHuman.txt](site/models/CC0-MakeHuman.txt).
