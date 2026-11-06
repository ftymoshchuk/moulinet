# Moulinet

Sabre Motion Lab: sabre fencing drawn in pen and ink, in your browser. Study
the base postures, practise from a library of scenes, or make a scene of your
own: slow it down, step through it and reshape any moment. Every pose is a
handful of numbers and every scene a short list of keyframes, so a whole
animation is a few lines of text you can edit, keep and share.

**Open it at <https://ftymoshchuk.github.io/moulinet/>.** It runs entirely in
your browser: no account, no server, and nothing you type leaves the page.
Scenes you save stay in your browser's own storage, on that device.

The name comes from the *moulinet*, the sabre's circular cut: the blade drops
forward past the arm, swings up behind and comes down over the top. It is one
of the five scenes built in.

## Three modes
One stage, three ways to use it. Choose the mode at the top of the page.

**Practice library.** Scenes to practise from, each with the event it was noted
at and a link to a reference, such as a video of the bout. Pick a scene and it
plays; the five built in are an advance, lunge and head cut; a chest cut
parried in 3 and riposted; a head attack parried in 5 and riposted to the head;
a cut at the outside of the face met with face protection, as an old plate
draws it; and the moulinet, solo. In the pairs the older man holds a guard of
his own, standing a little higher, with the sword arm bent and tucked in, so
the two do not stand as mirror images. The built-in scenes have no event or link,
because there is no real bout behind them. Scenes you save in the Creator are
listed below them, with whatever you noted, and a link opens in a new tab. They
live in your browser's storage, so one saved or deleted in another tab of the
page appears or goes here too.

**Base postures.** One fencer, never a pair, in one posture at a time, with the
posture described in words: what it is for, and the parts worth looking at,
the hand that holds the sabre among them. Pick a posture from the list, or use the arrows under the stage. The fourteen
postures are the poses of the library, in the order they are learned: the
guard; the two halves of an advance; the arm extended and the blade up; the
lunge in flight, to the head and to the chest; parry 3, and parry 3 with the
weight drawn back; face protection; parry 5, and parry 5 with the weight drawn
back; and the riposte.

**Creator.** Make a scene of your own. Start from a blank one with **New
scene**, or from a scene in the library: a built-in one opens as a copy, with
**Edit a copy in the Creator**, and one of your own opens as it is, with **Edit
in the Creator**, where **Save changes** writes over it. Add and remove steps,
name them, time them, give each fencer a pose and reshape it, then name the
scene, say where it was noted, add a reference link and keep it with **Save to
library**. A scene can be for one fencer or two. It asks before it replaces a
scene with changes that are not saved, and before you leave the page with one;
the camera angle counts, since a saved scene keeps it. If you save a scene that
another tab changed or deleted after you opened it, yours is kept as a new scene
beside theirs, and the Creator says so, so neither is lost.

All three share the stage, and its **camera**, which turns the view up to 60°
either way to see a blade come toward you or swing away. The library looks as
close as keeps everyone and their whole blades in view; the base postures, as
close as keeps the fencer and most of the blade in view, so the point of the
blade held up in Blade up runs off the top. Turning the camera never zooms, and
the Creator keeps one view while you reshape a scene.

**Hand close-up**, in every mode, looks closely at the sword hand instead, and
follows it as it moves: A's, or in the Creator the fencer you are reshaping. It
looks from the other side of the piste, outside the sword arm, which is where the
old books draw the grip and the hand positions from, so the blade points the way
it does in their plates; the camera turns it from there.

**3D figures**, in every mode, puts two people on the stage in place of the
drawing: bodies modelled in three dimensions, the young man and the older one,
posed from the same numbers, so their feet, their hands and their blades are
where the drawing has them, and drawn in ink. The floor, the marks round the
feet, the motion ghosts and the blade paths stay as they are. They load the
first time you turn them on, about 360 KB, and need a browser with WebGL 2; one
without says so and keeps the drawing. They are new, and the drawing is still
the default.

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
- **Adjust this moment:** sixteen sliders reshape either fencer on the current
  step, from where they stand on the piste, through the turn of the back foot
  and knee, the shoulders and the rear arm, to the angle and turn of the blade
  and the position of the hand that holds it, which moves in steps of 15° and
  says when it is on one of the books' hand positions.
- **Poses:** fourteen named poses to put on any step.
- **Phrase data:** the whole scene as text. Edit it in place or paste one in;
  it applies as you type, and says why when it can't. The fields above it and
  the text are the same thing, and follow each other. While the text can't be
  applied they wait, dimmed, so that nothing you typed is lost, and they take
  it up again as soon as it applies.

## The drawing
The fencers are not pictures. Each is worked out from a pose, a few numbers for
the joints, and drawn in the browser as pen and ink: a line round the body that
is fine where it faces the light and heavy where it turns away, as a pen
presses on the shadow side, and brush strokes that swell and end in points for
the folds of the breeches, the creases of the jersey, the wrinkles of a stocking
and the marks on the floor. The look follows the line illustrations of old
sabre training books, as a model to draw from; no scan or trace of any of them
is in this repository.

The shoulders are turned toward you, as in those books: the jersey is a stack
of slices of the body, set round by the pose's `turn`, so it is broad at the
shoulders and tapers to the waist, about 38 cm across against 28, and the camera
swings it as it swings the piste. The sleeve of the arm on your side begins on
the jersey itself, and the other arm lies behind it, set on the shoulder at the
front of the chest and as long as an arm, its loose sleeve running on from the
line of the shoulder into a gauntlet. A sleeve is loose over an arm about 10 cm
thick: full over the upper arm, narrowing to the elbow, and fullest on the
forearm just below it, narrowing to the wrist. The hips turn with the shoulders, if not as far,
so each leg starts from a hip of its own, the leg behind on your side and the
leg in front on the far side: the legs part at the crotch, under a wide front
of the trousers, rather than from one point. The foot in front points at the
opponent, and the foot behind is turned across, its toe at you and turned back a
little by the pose's `toeBack`, so that the two make an L, as the stance is
taught. Each shoe is 29 cm from heel to toe, as long as a shoe for a man of the
fencers' height. The one behind is a few domes standing on the floor, which the camera turns
with the piste, so it is seen end on, from a quarter or from the side as the
camera moves. The guard is the plates' classic stance: wide, both knees bent,
each over its own foot, so both shins stand upright. The knee of the leg behind
is turned out toward you, over the foot, by the pose's `kneeOut`: a little in
the guard, so side on it is seen bent back over the foot, as the plates draw it,
and further, in proportion, as the weight sits back over that foot. In the lunge
the back leg is straight and the body stays nearly upright over the front leg.

The sabre is held as the plates of the grip and of the hand positions draw it,
and is worked out in three dimensions, the hand with it. The thumb lies along the
back of the grip, its tip just behind the guard, and the fingers curl round the
grip, the forefinger least; behind them the hand bends at the wrist to meet the
forearm in the mouth of the gauntlet, however the blade is held, and the grip
runs on past the heel of the hand to the pommel, a nut at its end. The fist is
one shape, with a line where one finger lies over the next or over the thumb,
and a crease at each middle knuckle that faces you. A blade turned out beyond the
far side of the sword arm is further from you than the body is, and is drawn
behind it, as the arm is. So in the moulinet, where the wrist turns the blade out
beyond the arm as it passes under and behind, and the elbow gives a little so the
hand rises, the blade goes behind the shoulder and the head, and the wrist bends
no further than it does in parry 5.

The guard is one sheet of steel, light, with a line of ink round it: from a lip
over the thumb it sweeps forward through the blade and round in front of the
fingers, then back under them, narrowing to the knuckle bow, into the pommel.
Across, it is bent like a bowl. So side on it is a crescent in front of and under
the fingers, as in the plate of the grip; from the side the edge faces, a shield
over the fist with the blade coming out of it; and from the side of the thumb you
look into it, shaded inside, at the fist. The pose's hand position turns the hand
and the hilt about the blade, as the books number the positions: in the third the
thumb is up and the edge down; in the second the palm is down and the edge out; in
the first the thumb is down and the edge up, with the knuckle bow over the fist;
in the fourth the palm is up and the edge in; and there are halves between them,
as the 2/3 of the guard.

The head is drawn as the plates draw it: a long skull and a short, square face,
carried forward on a thick neck. It is drawn a twentieth larger than life, as
an illustrator draws one, so the fencer is seven and a half heads tall and the
head holds its own against the jersey; the shadow under the jaw stops at its
angle, and the cord of the neck runs down behind it. The neck takes only part of the body's lean
and the head hardly any, so however the body leans the head is held up and the
eyes look ahead. The hair is strokes of the pen, combed in rows round the
crown, up off the forehead, back over the top and down the back of the head,
sparse on top where the light falls and heavier at the back, and its strokes
make the edge of the head where it grows. The shading is drawn the same way: a
fan of folds from the crotch, the cloth bloused over the belt and gathered
under it, shadow on the insides of the legs, where each faces the other, and
under the cloth that hangs over the band below the knee, and folds from the
armpits and at the elbows.

A young fencer wears knickerbockers and long stockings, an older one loose
trousers gathered at the ankle, a belly and narrower shoulders. The
knickerbockers are full at the hips and narrow to the knee, where the cloth
hangs over the band in a bag about a third wider than the stocking, as the
plates draw it. The stocking is drawn over a lower leg as one is shaped: from
the side, the shin runs nearly straight down the front and the calf swells
behind, widest just under the band, then narrows into an ankle about half as
wide; the leg behind, its foot and knee turned toward you, is seen from the
front, so its calf swells on either side, fuller on the inside. The strokes are placed by rule and never by chance, so a figure
moves as one drawing and does not flicker, and a pose that is held is drawn
once.

## The 3D figures
The bodies are MakeHuman's: its base mesh, skeleton and skin weights, which its
authors gave to the public domain, shaped into the two men with its body
targets. `scripts/bake-fencers.js` makes them once, ahead of time, into one
compressed file of 180 KB, `site/models/fencers.bin`: the young man athletic,
the older one heavier and balding; their legs as long as the skeleton's, 90 cm
from hip joint to ankle, and their arms 31 cm to the elbow and 27 cm to the
wrist; and every point of each body on a garment, the jacket and breeches or
trousers standing a little off the skin, the gloves, the shoes, the hair.

Each frame poses the bodies from the pose's numbers. The hips go where the
skeleton has them, square to its hips, and the chest turns and leans with its
shoulders, the spine turning from one to the other; the neck and head lean and
nod as the skeleton's do. Each ankle goes exactly where the skeleton's is, as
far above the floor as the body's ankle is above the sole of its shoe, with the
knee bending the skeleton's way, and the foot lies flat or tips up at the toe as
it lifts. The rear hand goes where the skeleton has it. The sword hand closes
round the grip as the drawing holds the hilt, the sabre exactly where the
skeleton has it; a hand that would have to bend further at the wrist than a
wrist can bends only that far, and the sabre turns between thumb and forefinger
for the rest, as it does in a moulinet. The shoulder comes forward on the
collarbone to let the hand reach, and in the few moments it still cannot, the
hand falls short by at most a centimetre or so and the sabre goes with it.

The fencer facing left stands as the skeleton has him, which is the one facing
right turned round: his sword arm is on your side, and the blades meet in three
dimensions at a parry, not only from the side. So his close-up stays on your
side of the piste, outside his sword arm.

They are drawn with [three.js](https://threejs.org), r170, kept in
`site/vendor/`, three times over, off the page: in the flat colours of what they
wear, in white under a light from high in front, and as which way each point of
them faces and how far it is from you. Ink goes where the distance jumps, at
their outline and where a part passes in front of another, where a surface turns
sharply, and where one colour meets another, at a cuff or a collar; hatching
goes where the light is low, crossed where it is lowest; everything else keeps
its flat colour. The drawing is made finer than the screen, so the lines are
smooth, on a canvas laid over the stage.

## Writing a phrase
A scene is a phrase: JSON, with a few words about where it comes from. **Phrase
data** shows the one on stage, a step per line:

```json
{
  "name": "Advance, lunge, head cut",
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
- `event`: where it was noted, in your own words: the competition and round,
  say. Up to 160 characters.
- `reference`: a link to where you can see it, up to 2,000 characters. Only
  `http` and `https` addresses become links; anything else is shown as not a
  link.
- `note`: whatever else is worth saying, up to 1,000 characters.
- `camera`: the view in degrees from side on, -60 to 60. A pasted phrase with
  a new angle turns the view to it, and saving a scene keeps the angle it was
  seen from.
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
  moment** writes them; picking a pose or **Reset this step's adjustments**
  clears them.

The joints `adj` can set. Lengths are centimetres; angles are degrees, where 0
points at the opponent and 90 straight up.

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
postures** describe each one in words.

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
reference link is a web address, the base postures, the drawing (the curves and
brush strokes, the parts of a body and their proportions, the hilt and the hand in each hand position,
and every phrase and posture at every moment from five camera angles, checked for
broken path data and for shapes that do not merge), the 3D figures (the bodies
read back as they were baked, and posed in every scene with the ankles, the rear
hand and the blade's point where the skeleton has them, from any camera, and the
wrist bending no further than a wrist can), and the published files (only
relative links to files that exist, no outside requests, every element the
scripts need, and the licences of what is bundled). Fourteen more run
in a real browser: headless Chrome or Chromium loads the page, then a driver
page works every control of every mode, with hostile input among it, and checks
the result, down to two tabs saving the same scene and the 3D figures loading,
or saying why they cannot. They need Chrome or Chromium
on your `PATH`, or `CHROME_BIN` pointing at one, and are skipped without it.

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
- `site/js/app.js`: the modes, the controls, and drawing each frame
- `site/js/phrase.js`: phrases as data: timeline, in-betweens, text, edits
- `site/js/figure.js`: a pose's skeleton, the camera, where the stage looks, and the fencer drawn from them
- `site/js/body.js`: the parts of a fencer: jersey, arms, legs, head, and the sabre with the hand that holds it
- `site/js/parts.js`: the head, hands, shoes and the slices of the jersey, drawn by hand: as points, the shoe behind as a few domes, and the hilt and the fist round it in the frame of the hand
- `site/js/folds.js`: the ink work: cloth folds, creases, hems, stockings, floor strokes
- `site/js/ink.js`: pen and ink as SVG path data: curves, outlines and tapered brush strokes
- `site/js/library.js`: the poses, the built-in scenes and the sliders
- `site/js/bases.js`: the base postures, in words
- `site/js/scenes.js`: reference links, and the scenes saved on this device
- `site/js/stage3d.js`: the 3D figures drawn in ink on a canvas over the stage
- `site/js/rig.js`: the 3D bodies on their bones, posed from a pose's skeleton, and the sabre
- `site/js/bodies.js`: reads the bodies from `site/models/fencers.bin`
- `site/models/`: the bodies, with their licence; `site/vendor/`: three.js, with its licence
- `site/fonts/`: Big Shoulders Display and IBM Plex, with their licences
- `scripts/serve.js`: the local server; `scripts/bake-fencers.js`: the bodies from MakeHuman's files; `scripts/protect-repo.sh`: repository settings
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
