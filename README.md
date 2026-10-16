# Moulinet

Sabre Motion Lab: sabre fencing drawn in pen and ink, in your browser. Pick a
phrase, slow it down, step through it and reshape any moment. Every pose is a
handful of numbers and every phrase a short list of keyframes, so a whole
animation is a few lines of text you can edit, keep and share.

**Open it at <https://ftymoshchuk.github.io/moulinet/>.** It runs entirely in
your browser: no account, no server, and nothing you type leaves the page.

The name comes from the *moulinet*, the sabre's circular cut: the blade drops
forward past the arm, swings up behind and comes down over the top. It is one
of the four phrases built in.

## What it does
- **Four phrases to start from:** an advance, lunge and head cut; a chest cut
  parried in 3 and riposted; a head attack parried in 5 and riposted to the
  head; and the moulinet, solo.
- **Playback** at ¼, ½ or full speed, a step at a time, or scrubbed along the
  timeline, looped or once through.
- **Motion ghosts and blade paths** show how each moment was reached: four
  fading stick figures trail the fencers, and dotted lines trace both blade
  tips through the whole phrase.
- **Camera:** turn the view up to 60° either way, to see a blade come toward
  you or swing away.
- **Adjust this moment:** ten sliders reshape either fencer on the current
  step, from where they stand on the piste to the angle and turn of the blade.
- **Pose library:** eleven named poses to put on any step.
- **Phrase data:** the whole animation as text. Edit it in place or paste a
  phrase in; it applies as you type, and says why when it can't.

## Writing a phrase
A phrase is JSON. **Phrase data** shows the one on stage, a step per line:

```json
{
  "name": "Advance, lunge, head cut",
  "camera": 0,
  "steps": [
    {"label": "En garde", "hold": 600, "A": {"pose": "guard", "x": -30}, "B": {"pose": "guard", "x": 245}},
    {"label": "Lunge", "ms": 150, "A": {"pose": "lungeFly", "x": 0}},
    {"label": "Head cut lands", "ms": 120, "hold": 700, "ease": "snap", "A": {"pose": "lungeHead", "x": 0}}
  ]
}
```

- `name`: a title for the phrase, for you; the page does not show it.
- `camera`: the view in degrees from side on, -60 to 60. A pasted phrase with
  a new angle turns the view to it.
- `solo`: `true` for one fencer. B leaves the stage, and every edit goes to A.
- `steps`: the keyframes, in order, at least one.

Each step:

| Key | What it does |
|---|---|
| `label` | The step's name on the stage and on its button. |
| `ms` | Milliseconds to move into this step from the one before. The first step is where the phrase starts, so its `ms` is ignored. |
| `hold` | Milliseconds to stay on the step before the next move. |
| `ease` | How the move runs: `"snap"` arrives fast and settles, `"linear"` keeps one speed; anything else eases in and out. |
| `A`, `B` | Each fencer at the end of the move. A fencer a step leaves out stays as the step before had them. |

A fencer is `{"pose": …, "x": …, "adj": {…}}`:

- `pose`: a name from the pose library below. A name it does not know is drawn
  as the guard, and **Phrase data** says which name that was.
- `x`: where the fencer stands on the piste, in centimetres. Until a phrase
  places them, A stands at 0 and B at 245, facing each other.
- `adj`: joint values that override the pose on this step. **Adjust this
  moment** writes them; picking a pose or **Reset this step's adjustments**
  clears them.

The joints `adj` can set. Lengths are centimetres; angles are degrees, where 0
points at the opponent and 90 straight up.

| Key | Joint |
|---|---|
| `hipX`, `hipY` | Hips: how far forward of the back foot, and how high |
| `footF` | Front foot: how far forward of the back foot |
| `liftF`, `liftB` | How far the front or back foot is off the floor |
| `lean` | Torso lean, forward positive |
| `arm`, `fore` | Sword arm: upper arm and forearm |
| `blade` | Blade angle |
| `yaw` | Blade turned toward the camera |
| `rArm`, `rFore` | Rear arm, hand on the hip |

The poses. Each fills in what it leaves out from the guard.

| Name | Pose |
|---|---|
| `guard` | Guard, in tierce |
| `advLift`, `advLand` | Advance: front foot lifts, front foot lands |
| `prep` | Blade up |
| `lungeFly` | Lunge, in flight |
| `lungeHead`, `lungeChest` | Lunge, landing a head cut or a chest cut |
| `parry3`, `parry5` | Parry 3, parry 5 |
| `riposte` | Riposte to the head |
| `extend` | Arm extended |

## Run it on your own computer
The page is plain HTML, CSS and JavaScript in `site/`, with no build step and
no dependencies. Serve that folder with anything that serves files:

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
the timeline and its maths, the drawing (every phrase at every moment from
five camera angles, checked for broken path data), and the published files
(only relative links to files that exist, no outside requests, every element
the script needs). Two more run in a real browser: headless Chrome or
Chromium loads the page, then a driver page works every control and checks
the result. They need Chrome or Chromium on your `PATH`, or `CHROME_BIN`
pointing at one, and are skipped without it.

CI runs the same on every pull request, with the runner's Chrome and the
browser tests required. Its `ci-passed` job succeeds only when every other job
does, and is the one check `main` requires.

Project layout:
- `site/index.html` and `site/css/styles.css`: the page
- `site/js/app.js`: the controls, and drawing each frame
- `site/js/phrase.js`: phrases as data: timeline, in-betweens, text, edits
- `site/js/figure.js`: the pen-and-ink fencers, as SVG path data
- `site/js/library.js`: the poses, the built-in phrases and the sliders
- `site/fonts/`: Big Shoulders Display and IBM Plex, with their licences
- `scripts/serve.js`: the local server; `scripts/protect-repo.sh`: repository settings
- `tests/`

## Publishing
Every push to `main` publishes `site/` to GitHub Pages, through
`.github/workflows/pages.yml`, which runs the tests once more first. Setting
that up is a one-off for an admin of the repository:

1. Make the repository public, if it is not already. On GitHub Free, Pages
   needs that.
2. Run `scripts/protect-repo.sh` with the GitHub CLI signed in as a repository
   admin. It sets Pages to publish from GitHub Actions and links the site from
   the repository, and applies the branch ruleset and the security settings a
   public repository should have. For Pages alone, set Settings > Pages >
   Build and deployment > Source to **GitHub Actions** instead.
3. Publish: push to `main`, or run the **Pages** workflow from the Actions tab.

The site is then at <https://ftymoshchuk.github.io/moulinet/>.

## Contributing
Issues and pull requests are welcome. Run `npm test` before opening a pull
request, and for a change to the page, look at it with `npm start` too.

## License
Moulinet is licensed under the [Apache License 2.0](LICENSE). The fonts in
`site/fonts/` keep their own licence, the SIL Open Font License 1.1: see
[OFL-BigShoulders.txt](site/fonts/OFL-BigShoulders.txt) for Big Shoulders
Display and [OFL-IBMPlex.txt](site/fonts/OFL-IBMPlex.txt) for IBM Plex.
