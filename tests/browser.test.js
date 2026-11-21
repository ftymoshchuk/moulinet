// The page in a real browser: headless Chrome or Chromium loads it from a
// local server, runs it, and hands back the DOM it ended up with.
//
// Skipped when no browser is found (set CHROME_BIN to point at one). CI sets
// REQUIRE_BROWSER=1, so there a missing browser fails instead.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { BASE_BLADE, BASE_CAMERA, BASE_SECTIONS, FIGURE_DIR, FIGURE_NOTE, basePhrase, basesOf } from "../site/js/bases.js";
import { DEFAULT_FRAME, floorPath, frameFrom, frameOf, handFrame } from "../site/js/figure.js";
import { HANDLES, placeOf, shareOf } from "../site/js/handles.js";
import { JOINTS, POSE_NAMES, POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, parsePhrase, resolvePose } from "../site/js/phrase.js";
import { POSTURE_JOINTS, numbersText } from "../site/js/postures.js";
import { siteHandler } from "../scripts/serve.js";

const run = promisify(execFile);
const BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
const DRIVER = readFileSync(new URL("./drive.html", import.meta.url));

function findBrowser() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const name of BROWSERS) {
      try {
        accessSync(join(dir, name), constants.X_OK);
        return join(dir, name);
      } catch {
        // Not here; keep looking.
      }
    }
  }
  return null;
}

const browser = findBrowser();
const skip = !browser && process.env.REQUIRE_BROWSER !== "1" && "no Chrome or Chromium found; set CHROME_BIN to run it";

/**
 * Opens `path` in the browser, served with the site, and returns the DOM the
 * page ended with and every line it logged to the console.
 */
async function openInBrowser(path, flags = []) {
  assert.ok(browser, "REQUIRE_BROWSER=1, but no Chrome or Chromium was found; set CHROME_BIN");
  const site = siteHandler();
  const server = createServer((request, response) => {
    if (new URL(request.url, "http://localhost").pathname !== "/drive.html") return site(request, response);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(DRIVER);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = await mkdtemp(join(tmpdir(), "moulinet-browser-"));
  try {
    const { stdout, stderr } = await run(
      browser,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--no-first-run",
        `--user-data-dir=${profile}`,
        "--enable-logging=stderr",
        "--virtual-time-budget=5000",
        ...flags,
        "--dump-dom",
        `http://127.0.0.1:${server.address().port}${path}`,
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
    );
    // The page logs nothing, so any console line is a problem: an uncaught
    // error, a failed load, something the security policy refused. A browser
    // with no graphics card draws the 3D figures in software and says how slow
    // that is; those notes are the browser's, not the page's.
    const notes = /GL Driver Message|Automatic fallback to software WebGL/;
    return { dom: stdout, consoleLines: stderr.split("\n").filter((line) => line.includes(":CONSOLE") && !notes.test(line)) };
  } finally {
    server.close();
    await rm(profile, { recursive: true, force: true });
  }
}

let driven = null;

/**
 * Runs the driver page, once however many tests read it, and returns what it
 * saw, any error it hit, and what the browser logged to the console.
 */
function drive() {
  driven ??= openInBrowser("/drive.html").then(resultsOf);
  return driven;
}

/** What the driver saw, out of the DOM it left, with what the browser logged. */
function resultsOf({ dom, consoleLines }) {
  const json = dom.match(/<pre id="results">([^<]*)<\/pre>/)?.[1];
  assert.ok(json, "the driver did not finish");
  const results = JSON.parse(json.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
  return { ...results, consoleLines };
}

const CONTROLS = ["#play-button", ".speed", "#timeline", "#steps", "#timecode", "[data-toggle=ghosts]", "[data-toggle=trail]", "[data-toggle=ink]", "[data-toggle=loop]", "[data-toggle=closeUp]", "#camera"];
const two = (n) => String(n).padStart(2, "0");

test("in a browser, the page opens on the practice library and builds its controls", { skip, timeout: 120_000 }, async () => {
  const { dom, consoleLines } = await openInBrowser("/");
  assert.deepEqual(consoleLines, []);
  const count = (pattern) => (dom.match(pattern) ?? []).length;
  assert.equal(count(/class="mode-button"/g), 3, "tabs");
  assert.match(dom, /<button[^>]*data-tab="live"[^>]*aria-pressed="true"[^>]*>Live knowledge</);
  assert.match(dom, /<button[^>]*data-mode="library"[^>]*aria-pressed="true"[^>]*>Practice library</);
  assert.equal(count(/class="scene-button"/g), PRESETS.length, "scenes in the library");
  assert.match(dom, /id="scene-title"[^>]*>Light cut on the blade, riposte to the top of the glove</);
  assert.equal(count(/class="step-button"/g), 6, "step buttons");
  assert.equal(count(/class="pose-button"/g), Object.keys(POSE_NAMES).length, "pose buttons");
  // A section's postures are listed when they are shown, not before.
  assert.equal(count(/class="base-button"/g), 0, "posture buttons");
  // The fencers are drawn in 3D on a canvas over the stage, with a stick figure for each to stand in where they cannot be.
  assert.match(dom, /<canvas id="stage-3d" class="stage__3d[^"]*" aria-hidden="true"/);
  assert.equal(count(/class="stick( fencer-b)?"/g), 2, "a stick figure for each fencer");
  assert.equal(count(/<input type="range" id="joint-/g), JOINTS.length, "joint sliders");
  // A posture's numbers have sliders of their own for every joint but where the fencer stands, in a panel that starts closed.
  assert.equal(count(/<input type="range" id="posture-joint-/g), JOINTS.length - 1, "sliders for a posture's numbers");
  assert.match(dom, /class="panel panel--posture hidden"/);
  // Nothing plays on its own: the page is at the first step, and Play is what it offers.
  assert.match(dom, /id="step-count"[^>]*>01 \/ 06</);
  assert.match(dom, /id="play-button"[^>]*aria-label="Play"/);
  // The panels of the other modes are there, and out of sight.
  assert.match(dom, /class="panel panel--poses hidden"/);
  assert.doesNotMatch(dom, /class="panel panel--library hidden"/);
  const paths = [...dom.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(paths.filter(Boolean).length > 10, `only ${paths.filter(Boolean).length} paths drawn`);
  assert.match(dom, /id="ground-a" class="ground" d="M/, "the marks on the floor round A's feet");
  for (const d of paths) assert.doesNotMatch(d, /NaN|Infinity|undefined/);
});

test("in a browser, working every control logs nothing and draws no broken path", { skip, timeout: 120_000 }, async () => {
  const { errors, seen, consoleLines } = await drive();
  assert.deepEqual(consoleLines, []);
  assert.deepEqual(errors, []);
  assert.equal(seen.badPaths, 0, "paths with NaN, Infinity or undefined");
});

// What a library card and the scene beside it say of where a scene comes from: the drills are live learning.
const LIVE = { source: "Live learning", sourceFact: "Live learning" };
// How the browser says the stage is turned: flipped across the page and not otherwise.
const MIRRORED = "matrix(-1, 0, 0, 1, 0, 0)";

test("in a browser, the page opens paused on the first scene, and nothing plays until Play is pressed", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.opening, { title: PRESETS[0].phrase.name, play: "Play", pauseHidden: true, playShown: true, count: "01 / 06", time: "0.00 / 3.22 s" });
});

test("in a browser, the stage is shown in a mirror in every mode, so the fencers are right-handed", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The skeleton has the sabre in the left hand of both fencers; flipped across the page they hold it in the right, in the
  // library, the postures and the Creator alike.
  assert.deepEqual(seen.mirror, { library: MIRRORED, base: MIRRORED, creator: MIRRORED });
});

test("in a browser, the scenes and the Creator are seen from the other side of the piste, facing B, and the postures from the side they always were", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The mirror alone puts A on the right. The camera goes round to the side B faces, which puts him back on the left, with his
  // back and his sword arm toward you and B's chest toward you. The floor is drawn for the camera it is seen from, so which
  // way round its ticks run says which side that is.
  assert.deepEqual(seen.floors, { library: floorPath(180), creator: floorPath(180), base: floorPath(25) });
});

test("in a browser, the camera can be turned all the way round, to the other side of the piste, and the stage goes round with it", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The slider goes a half turn either way, and its ends are the same view. A scene starts on B's side, at 180, so a half
  // turn takes it round to the original side, at 360: A on the right with his chest toward you, as before, with the floor
  // and the box the stage looks at as they are for the camera at 0, and a quarter turn takes it end on, with the box
  // centred on the pivot.
  assert.deepEqual(seen.round.range, ["-180", "180"]);
  const box = frameOf(buildTimeline(PRESETS[0].phrase));
  const at = (angle, total) => ({ shown: `${angle}°`, floor: floorPath(total), view: frameFrom(box, total) });
  const looked = (got, want, what) => {
    assert.equal(got.shown, want.shown, `${what}: the slider`);
    assert.equal(got.floor, want.floor, `${what}: the floor`);
    const view = got.view.split(" ").map(Number);
    view.forEach((value, i) => assert.ok(Math.abs(value - want.view[i]) <= 0.1 + 1e-9, `${what}: the stage looks at ${got.view}, not ${want.view.join(" ")}`));
  };
  looked(seen.round[90], at(90, 270), "a quarter turn from B's side");
  looked(seen.round[180], at(180, 360), "a half turn: the original side");
  looked(seen.round[-180], at(-180, 0), "a half turn the other way: the same view");
  assert.equal(seen.round[180].floor, seen.round[-180].floor, "the ends of the slider are one view");
  assert.equal(seen.round[180].view, seen.round[-180].view);
});

test("in a browser, the practice library holds the drills from the class, shows each one paused, and says what it is", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The drills from the class say what kind of learning they come from, on the card and beside the scene. Choosing one
  // does not play it.
  assert.deepEqual(seen.scenes, [
    { title: "Light cut on the blade, riposte to the top of the glove", pressed: "true", card: "Pair · 6 steps · 3.2 s", ...LIVE, play: "Play", count: "01 / 06", solo: false, camera: "0", time: "0.00 / 3.22 s", scrubbedTo: "06 / 06" },
    { title: "Light cut on the blade, riposte to the side of the glove", pressed: "true", card: "Pair · 10 steps · 3.7 s", ...LIVE, play: "Play", count: "01 / 10", solo: false, camera: "0", time: "0.00 / 3.73 s", scrubbedTo: "10 / 10" },
    { title: "Light cut on the blade, tierce, Hungarian cut under the glove", pressed: "true", card: "Pair · 10 steps · 3.8 s", ...LIVE, play: "Play", count: "01 / 10", solo: false, camera: "0", time: "0.00 / 3.75 s", scrubbedTo: "10 / 10" },
  ]);
  // A built-in scene says which class it was learned in, has no link to give, and cannot be deleted.
  assert.deepEqual(seen.builtIn, {
    title: "Light cut on the blade, riposte to the side of the glove",
    kind: "Built in",
    source: "Live learning",
    sourceNone: false,
    event: "Warsaw advanced sabre, 15 Nov 2026",
    eventNone: false,
    reference: "No link yet",
    links: 0,
    note: PRESETS[1].phrase.note,
    edit: "Edit a copy in the Creator",
    deleteHidden: true,
    savedEmpty: true,
  });
  assert.deepEqual(seen.libraryShows, { chosen: ["library"], panels: ["stage", "detail", "library"], controls: CONTROLS });

  assert.deepEqual(seen.stepped, {
    count: "03 / 06",
    label: "B's guard holds; top of A's glove open",
    play: "Play",
    announced: "Step 3 of 6: B's guard holds; top of A's glove open",
    // A has just come off B's blade and has all four ghosts, a body and a blade each; B holds the guard and has none.
    ghosts: { A: 8, B: 0 },
  });
  // (The close-up of the hand starts off, and is not one of the four; the Creator's dots to drag start on, and are not either.)
  assert.deepEqual(seen.toggledOff, { pressed: ["false", "false", "false", "false", "false", "true"], ghostsHidden: true, trailsHidden: true, inkFilter: null });
  assert.equal(seen.inkFilter, "url(#ink-texture)");
  assert.deepEqual(seen.camera, { shown: "-40°", floorTurned: true });
  assert.deepEqual(seen.speed, ["true", "false", "false"]);
  assert.equal(seen.playing, "Pause");
  assert.equal(seen.paused, "Play");
});

test("in a browser, a scene is looked at with its whole blades in view, and the postures with most of the blade", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // Worked out in the browser as in Node, to the tenth it is rounded to.
  const lookedAt = (actual, expected, what) => {
    const got = actual.split(" ").map(Number);
    assert.equal(got.length, 4, `${what}: ${actual}`);
    got.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= 0.1 + 1e-9, `${what}: the stage looks at ${actual}, not ${expected.join(" ")}`));
  };
  // The box is worked out for the camera at 0 and goes round with it. The scenes start on the other side of the piste, facing
  // B, at 180, so their box is across the page; the postures start at 0 and are turned a little, as they always were.
  assert.equal(seen.sceneViews.length, PRESETS.length);
  PRESETS.forEach(({ phrase }, i) => lookedAt(seen.sceneViews[i], frameFrom(frameOf(buildTimeline(phrase)), 180), phrase.name));
  lookedAt(seen.baseView, frameFrom(frameOf(buildTimeline(basePhrase("live")), BASE_BLADE), BASE_CAMERA), "the postures");
  lookedAt(seen.creatorView, frameFrom(DEFAULT_FRAME, 180), "the Creator");

  // The close-up looks at A's sword hand from outside the arm, round on the other side of the piste, wherever the hand
  // is and however the camera is turned; turned off, the stage looks at the scene again.
  const posture = (i) => buildTimeline(basePhrase("live")).steps[i].A;
  assert.equal(seen.closeUp.pressed, "true");
  assert.equal(seen.closeUp.floorTurned, true, "the piste turns round with the camera");
  lookedAt(seen.closeUp.guard, handFrame(posture(0), 1, 25 + 180), "the hand in guard");
  lookedAt(seen.closeUp.parry5, handFrame(posture(11), 1, 25 + 180), "the hand in parry 5");
  lookedAt(seen.closeUp.turned, handFrame(posture(11), 1, -20 + 180), "the hand with the camera turned");
  // A scene opens with the camera it was seen from, side on for this one.
  lookedAt(seen.closeUp.library.view, handFrame(resolvePose(PRESETS[0].phrase.steps[0].A), 1, PRESETS[0].phrase.camera + 180), "the hand in a scene");
  assert.equal(seen.closeUp.library.pressed, "true", "it stays on from mode to mode");
  lookedAt(seen.closeUp.off.view, frameFrom(frameOf(buildTimeline(PRESETS[0].phrase)), 180), "the scene again");
  assert.equal(seen.closeUp.off.pressed, "false");
});

/**
 * What the page says of each posture of a section, as the driver saw it: the postures are numbered within their
 * section, and the book's section has a panel of the book's photographs beside the stage, which live knowledge does not.
 */
const described = (bases, inBook) =>
  bases.map((base, i) => ({
    name: POSE_NAMES[base.pose],
    group: base.group,
    key: base.pose,
    text: base.text,
    points: base.points,
    label: POSE_NAMES[base.pose],
    count: `${two(i + 1)} / ${two(bases.length)}`,
    pressed: 1,
    pressedIs: i,
    figuresPanel: inBook
      ? {
          figures: (base.figures ?? []).map(({ n, file, caption, page, width, height }) => ({
            src: `${FIGURE_DIR}${file}`,
            alt: `Photograph from the book: ${caption}`,
            width: String(width),
            height: String(height),
            caption: `Fig. ${n}. ${caption} Book p. ${page}.`,
          })),
          note: base.figures?.length ? FIGURE_NOTE : null,
          empty: base.figures?.length ? null : "The book has no photograph of this posture.",
        }
      : null,
  }));

test("in a browser, the base postures of live knowledge show one fencer, not a pair, and describe each posture", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  const live = basesOf("live");
  assert.deepEqual(seen.baseShows, { chosen: ["base"], panels: ["stage", "detail", "bases"], controls: ["[data-toggle=ink]", "[data-toggle=closeUp]", "#camera"] });
  assert.deepEqual(seen.baseStage, {
    label: "Guard (tierce)",
    count: `01 / ${two(live.length)}`,
    solo: true,
    stickA: "inline",
    stickB: "none",
    groundB: "none",
    legend: "none",
    ghostsHidden: true,
    trailsHidden: true,
    ghostToggle: "true",
    camera: String(BASE_CAMERA),
    prev: "Previous posture",
    next: "Next posture",
  });
  assert.deepEqual(seen.postures, described(live));
  assert.deepEqual(seen.groups, BASE_SECTIONS.live.groups);
  assert.deepEqual(seen.liveBase, { tabs: ["live"], switchShown: true, intro: BASE_SECTIONS.live.intro, noteShown: false, listed: live.length });
  assert.deepEqual(seen.arrows, {
    atStart: `01 / ${two(live.length)}`,
    third: "Advance, land",
    announced: `Posture 3 of ${live.length}: Advance, land`,
    atEnd: `${two(live.length)} / ${two(live.length)}`,
    cameraTurned: true,
    inkOff: null,
  });
  assert.deepEqual(seen.baseKept, { count: `05 / ${two(live.length)}`, label: "Blade up" });
});

test("in a browser, book knowledge opens on the book's postures with no switch to scenes, and each tab keeps its place", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  const book = basesOf("book");
  const live = basesOf("live");
  // The book's section has no scenes, so there is nothing to choose between, and the postures are what shows.
  assert.deepEqual(seen.bookShows, {
    chosen: ["base"],
    panels: ["stage", "detail", "bases", "figures"],
    controls: ["[data-toggle=ink]", "[data-toggle=closeUp]", "#camera"],
    tabs: ["book"],
    switchShown: false,
  });
  assert.deepEqual(seen.bookStage, {
    label: POSE_NAMES[book[0].pose],
    count: `01 / ${two(book.length)}`,
    intro: BASE_SECTIONS.book.intro,
    note: BASE_SECTIONS.book.note,
    noteShown: true,
  });
  assert.deepEqual(seen.bookPostures, described(book, true));
  // Each posture's photographs load at the size the page says: the twelve of them are the book's figures, and At ease has none.
  assert.deepEqual(
    seen.figuresLoaded,
    book.map((base) => (base.figures ?? []).map(() => true)),
  );
  assert.equal(seen.figuresLoaded.flat().length, 12);
  assert.deepEqual(seen.bookGroups, BASE_SECTIONS.book.groups);
  assert.deepEqual(seen.bookArrows, { atStart: `01 / ${two(book.length)}`, atEnd: `${two(book.length)} / ${two(book.length)}` });
  // The Creator is a tab of its own: no switch, and its tab takes the focus from the posture button it hid.
  assert.deepEqual(seen.bookToCreator, { tabs: ["creator"], switchShown: false, chosen: ["creator"], focus: "creator" });
  // Each section is as it was left: the book on its fourth posture, live knowledge on its fifth, with its switch.
  assert.deepEqual(seen.bookKept, { count: `04 / ${two(book.length)}`, label: POSE_NAMES[book[3].pose], tabs: ["book"] });
  assert.deepEqual(seen.liveKept, { count: `05 / ${two(live.length)}`, label: "Blade up", tabs: ["live"], switchShown: true, chosen: ["base"] });
  // The switch brings live knowledge's scenes back, all of them and only its own.
  assert.deepEqual(seen.liveLibrary, { tabs: ["live"], cards: PRESETS.filter(({ section }) => section === "live").length, chosen: ["library"] });
  assert.deepEqual(seen.liveLibraryKept, { tabs: ["live"], chosen: ["library"], title: PRESETS[0].phrase.name });
});

test("in a browser, the Creator edits a copy of a scene the way the page always has", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.copied, {
    showing: { chosen: ["creator"], panels: ["stage", "scene", "phrase", "step", "adjust", "poses"], controls: CONTROLS },
    name: "Light cut on the blade, riposte to the top of the glove",
    note: "A attacks, B defends, bo",
    // The copy keeps where the drill comes from.
    source: "Live learning",
    event: "Warsaw advanced sabre, 15 Nov 2026",
    save: "Save to library",
    copyHidden: true,
    status: "Applied: 6 steps, 3.22 s",
    count: "01 / 06",
    asked: 0,
    // The button that was pressed went away with the mode; focus went to the mode's button.
    focus: "creator",
  });
  // The third step of the drill, with fencer B given a pose of the library: A's part of it is as the drill has it.
  const third = `    {"label":"B's guard holds; top of A's glove open","ms":140,"hold":60,"A":{"pose":"extend","x":0,"adj":{"arm":-15,"fore":5,"blade":4,"yaw":-4,"hand":-45}},`;
  assert.deepEqual(seen.posed, {
    line: `${third}"B":{"pose":"parry3","x":310}},`,
    pressed: ["Parry 3parry3"],
    editing: "Step 3: B's guard holds; top of A's glove open. Fencer B.",
  });
  assert.deepEqual(seen.adjusted, {
    line: `${third}"B":{"pose":"parry3","x":200,"adj":{"blade":100}}},`,
    said: "100°",
  });
  // One joint at a time. Parry 3 gives the blade 95° and the hips 78 cm. A joint that has been moved says so and offers to go
  // back, and says to what; one that has not keeps the place of its button, but does not show it; the position has no pose to
  // go back to, so no button.
  const idle = (said, title, label) => ({ said, adjusted: false, reset: { shown: false, title, label } });
  const moved = (said, title, label) => ({ said, adjusted: true, reset: { shown: true, title, label } });
  const blade = (said, was) => (was ? moved : idle)(said, "Back to the pose: 95°", "Reset blade angle to the pose");
  const hips = (said, was) => (was ? moved : idle)(said, "Back to the pose: 78 cm", "Reset hip height to the pose");
  assert.deepEqual(seen.joints.moved, {
    blade: blade("100°", true),
    hipY: hips("70 cm", true),
    lean: idle("-3°", "Back to the pose: -3°", "Reset torso lean to the pose"),
    x: { said: "200 cm", adjusted: false, reset: null },
  });
  // Putting one back leaves the other where it was, and the focus on the slider it belonged to.
  assert.deepEqual(seen.joints.putBack, {
    line: `${third}"B":{"pose":"parry3","x":200,"adj":{"hipY":70}}},`,
    blade: blade("95°", false),
    hipY: hips("70 cm", true),
    slider: "95",
    focus: "joint-blade",
  });
  assert.deepEqual(seen.joints.allBack, { line: `${third}"B":{"pose":"parry3","x":200}},`, hipY: hips("78 cm", false) }, "the last one takes the adjustments with it");
  assert.equal(seen.reset, `${third}"B":{"pose":"parry3","x":200}},`);
  assert.deepEqual(seen.joints.resetAll, { blade: blade("95°", false), hipY: hips("78 cm", false) }, "resetting the step puts back what is left");

  assert.match(seen.broken.status, /^Not applied: /);
  assert.equal(seen.broken.isError, true);
  assert.equal(seen.broken.kept, '{"steps": [', "the text stays as typed");
  assert.equal(seen.broken.count, "03 / 06", "the last good phrase stays on stage");
  assert.deepEqual(seen.unknown, {
    status: "Applied. Unknown pose flunge shown as guard",
    isWarning: true,
    count: "02 / 02",
    camera: "180",
    labels: ["01Feint", "02<b>Cut</b>"],
    markup: 0,
  });
  assert.deepEqual(seen.solo, { solo: true, canEditB: false, editing: "Step 1: Alone. Fencer A.", status: "Applied: 1 step, 0.00 s", soloBox: true });
});

test("in a browser, the Creator makes a new scene, and asks before it throws one away", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The scene on show had changes, so "New scene" asked; no kept it, yes replaced it.
  assert.deepEqual(seen.keptOnNo, { name: "", text: '{"solo": true, "', asked: 1 });
  assert.deepEqual(seen.fresh, {
    asked: 2,
    status: "Applied: 1 step, 0.60 s",
    name: "",
    text: '{  "camera": 0,  "steps": [    {"label":"En garde","hold":600,"A":{"pose":"guard","x":0},"B":{"pose":"guard","x":310}}  ]}',
    save: "Save to library",
    copyHidden: true,
    count: "01 / 01",
    solo: false,
    soloBox: false,
  });
  assert.deepEqual(seen.freshAgain, { asked: 2 }, "a scene nobody has changed is replaced without asking");

  // The scene's words go into the data in their own order, whatever order they were typed in.
  assert.deepEqual(seen.words.head, [
    "{",
    '  "name": "Lunge to the head",',
    '  "event": "Club night, October",',
    '  "reference": "https://example.com/watch?v=abc",',
    '  "note": "Arm first.",',
    '  "camera": 0,',
    '  "steps": [',
  ]);
  assert.deepEqual(seen.nameBlanked, { line: '  "event": "Club night, October",', field: "" }, "spaces alone are no name");
  assert.deepEqual(seen.typed, { name: "From the data", event: "", note: "Typed here" }, "typing into the data fills in the fields");

  // What cannot be saved says why, puts the cursor where it is wanted, and saves nothing.
  assert.deepEqual(seen.noName, { status: "Give the scene a name first.", isError: true, focus: "meta-name", saved: 0 });
  assert.deepEqual(seen.badLink, { hint: "That is not a web address: it has to start with http:// or https://.", hintIsError: true });
  assert.deepEqual(seen.badLinkSave, { status: "The reference link has to be a web address, starting with http:// or https://.", focus: "meta-reference", saved: 0 });
  assert.deepEqual(seen.goodLink, { hint: "" });
  assert.deepEqual(seen.brokenSave, { status: "Fix the phrase data first: it is not applied yet.", saved: 0 });

  assert.deepEqual(seen.firstStep, { moveOff: true, hint: "The first step is where the scene starts, so it has no move time.", removeOff: true, placeholder: "Step 1", label: "En garde", hold: "" });
  assert.deepEqual(seen.added, {
    count: "02 / 02",
    line: '    {"ms":300,"hold":200,"A":{"pose":"guard","x":0},"B":{"pose":"guard","x":245}}',
    label: "",
    placeholder: "Step 2",
    moveOff: false,
    move: "300",
    hold: "200",
    hint: "",
    removeOff: false,
    paused: "Play",
  });
  assert.deepEqual(seen.timed, {
    line: '    {"label":"Lunge","ms":150,"hold":400,"ease":"snap","A":{"pose":"lungeHead","x":0},"B":{"pose":"guard","x":245}}',
    button: "02Lunge",
    ease: "snap",
    status: "Applied: 2 steps, 0.55 s",
  });
  assert.deepEqual(seen.negative, { field: "150", line: seen.timed.line }, "a time that is not one changes nothing, and the field goes back");
  assert.deepEqual(seen.cleared, { line: '    {"A":{"pose":"lungeHead","x":0},"B":{"pose":"guard","x":245}}', label: "", button: "02Step 2" });
  assert.deepEqual(seen.between, { labels: ["01En garde", "02Between", "03Lunge"], count: "02 / 03" });
  assert.deepEqual(seen.noHold, { hint: "" }, "the step after it jumps, so there is nothing to run on into");
  assert.deepEqual(seen.passedThrough, {
    hint: "With no time to stay on it, the move runs on through this step into the next without stopping.",
    line: '    {"label":"Between","ms":300,"A":{"pose":"guard","x":0},"B":{"pose":"guard","x":245}},',
  });
  assert.deepEqual(seen.removed, { labels: ["01En garde", "02Lunge"], count: "02 / 02", editing: "Step 2: Lunge. Fencer A." });
  assert.deepEqual(seen.alone, { line: '  "solo": true,', solo: true, stickB: "none", canEditB: false });
  assert.deepEqual(seen.together, { line: false, solo: false, stickB: "inline" });
});

test("in a browser, scenes are saved on this device, listed in the library with their link, and deleted", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.saved, {
    status: "Saved to the practice library on this device.",
    save: "Save changes",
    copyHidden: false,
    count: 1,
    // Kept with the camera angle it was seen from.
    phrase: {
      name: "Lunge to the head",
      event: "Club night, October",
      reference: "https://example.com/watch?v=abc",
      note: "Arm first.",
      steps: [
        { label: "En garde", hold: 600, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
        { label: "Lunge", ms: 150, A: { pose: "lungeHead", x: 0 } },
      ],
      camera: 33,
    },
    text: ["{", '  "name": "Lunge to the head",', '  "event": "Club night, October",', '  "reference": "https://example.com/watch?v=abc",', '  "note": "Arm first.",', '  "camera": 33,', '  "steps": ['],
  });
  assert.deepEqual(seen.editedAfter, { status: "" }, "a change takes back the news that it was saved");
  assert.deepEqual(seen.copy, { count: 2, names: ["Lunge to the head", "Lunge to the head"], notes: ["Arm first, then legs.", "Arm first."], ids: 2 });
  assert.deepEqual(seen.again, { count: 2 }, "saving a scene again changes it, and does not add one");
  assert.deepEqual(seen.full, { status: "This browser would not keep the scene, so it was not saved.", isError: true, count: 2 });
  assert.deepEqual(seen.kept, { event: "Kept while away", count: "02 / 02", showing: ["stage", "scene", "phrase", "step", "adjust", "poses"] }, "the Creator is as it was left");

  const card = "Lunge to the headPair · 2 steps · 0.8 sClub night, October";
  assert.deepEqual(seen.listed, { saved: [card, card], builtIn: PRESETS.length, emptyHidden: true, pressed: 1 });
  assert.deepEqual(seen.savedDetail, {
    title: "Lunge to the head",
    kind: "Saved on this device",
    event: "Club night, October",
    eventNone: false,
    note: "Arm first, then legs.",
    linkText: "https://example.com/watch?v=abc",
    href: "https://example.com/watch?v=abc",
    target: "_blank",
    rel: "noopener noreferrer",
    said: " (opens in a new tab)",
    edit: "Edit in the Creator",
    deleteHidden: false,
    count: "01 / 02",
    camera: "33",
    // The first saved card comes after the built-in scenes.
    saved: PRESETS.length,
  });

  // What is stored is not to be trusted: the link that is a script is no link, and markup is only words.
  assert.deepEqual(seen.hostile, {
    cards: 3,
    title: "<b>Evil</b>",
    links: 0,
    reference: "Not shown: it is not a web address.",
    referenceNone: true,
    event: "<img src=x onerror=alert(1)>",
    markup: 0,
  });

  // The Creator still had a change when the first was opened, so that one asked.
  assert.deepEqual(seen.editSaved, { asked: 1, name: "Lunge to the head", save: "Save changes", copyHidden: false, showing: ["creator"] });
  assert.deepEqual(seen.declined, { asked: 2, mode: ["library"], note: "Changed in the Creator", title: "Lunge to the head" });
  assert.deepEqual(seen.accepted, { asked: 3, mode: ["creator"], name: "Lunge to the head", note: "Arm first." });
  // Three scenes, and the one with no steps, which the page cannot show and so keeps as it was.
  assert.deepEqual(seen.overwrote, { count: 4, status: "Saved to the practice library on this device." });
  // Closing the page asks only while the scene has changes that are not saved.
  assert.deepEqual(seen.leaving, { saved: false, unsaved: true, backToSaved: false });
  assert.deepEqual(seen.cleanEdit, { asked: 0, mode: ["creator"] });

  assert.deepEqual(seen.deleteDeclined, { cards: 3, asked: 'Delete "<b>Evil</b>" from this device?' });
  assert.deepEqual(seen.deleted, { cards: 2, stored: 3, title: PRESETS[0].phrase.name, focus: "library" });
  assert.deepEqual(seen.allDeleted, { cards: 0, stored: 1, emptyShown: true, builtIn: PRESETS.length }, "all that is left is the entry it cannot show");
  assert.deepEqual(seen.elsewhere, { cards: 0, title: PRESETS[0].phrase.name }, "a scene deleted in another tab leaves this one's list");
  const replace = "The scene in the Creator has changes that are not saved. Replace it?";
  assert.deepEqual(seen.asked, [replace, replace, replace, replace, replace, 'Delete "<b>Evil</b>" from this device?', 'Delete "<b>Evil</b>" from this device?', 'Delete "Lunge to the head" from this device?', 'Delete "Lunge to the head" from this device?']);
});

test("in a browser, text that is not a phrase yet keeps the fields still, and what was typed is not lost", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // The controls that edit a scene: twelve fields and buttons for the scene and its step, a slider for each joint, a Reset
  // for each joint but the position, and a button for each pose.
  const EDITORS = 13 + JOINTS.length + (JOINTS.length - 1) + Object.keys(POSE_NAMES).length;
  // A new scene: every control that edits it is on, but for the move time of its first step and removing its only one.
  assert.deepEqual(seen.fieldsOn, { total: EDITORS, off: 2 });
  assert.match(seen.onHold.status, /^Not applied: .+\. The fields are on hold until it is\.$/);
  assert.deepEqual({ ...seen.onHold, status: "" }, {
    total: EDITORS,
    off: EDITORS,
    status: "",
    note: "On hold: the phrase data is not applied yet.",
    noteIsWarning: true,
    focus: "phrase-text",
  }, "all of them are off, and the one that had the focus gave it to the text");
  assert.deepEqual({ ...seen.keptOnHold, status: "" }, { text: '{"name": "Mine", "steps": [', name: "Kept name", count: "01 / 01", same: true, status: "" }, "a change that gets through anyway is dropped");
  assert.match(seen.keptOnHold.status, /^Not applied: /);
  assert.deepEqual(seen.holdSave, { status: "Fix the phrase data first: it is not applied yet.", saved: 0 });
  assert.deepEqual(seen.resumed, { total: EDITORS, off: 0, status: "Applied: 2 steps, 0.00 s", note: "", name: "Mine", steps: 2 }, "once it is a phrase they are on again, showing it");
  assert.deepEqual(seen.resumedEdit, { name: '  "name": "Mine, renamed",', text: ["{", '  "name": "Mine, renamed",', '  "steps": ['] });
});

test("in a browser, text longer than a field allows is not saved, and longer text already saved is shown cut short", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  const refused = (status, focus) => ({ status, isError: true, focus, added: 0 });
  assert.deepEqual(seen.longName, refused("The name can be up to 100 characters, and this one has 101.", "meta-name"));
  assert.deepEqual(seen.longSource, refused("The source can be up to 40 characters, and this one has 41.", "meta-source"));
  assert.deepEqual(seen.longEvent, refused("The event can be up to 160 characters, and this one has 161.", "meta-event"));
  assert.deepEqual(seen.longNote, refused("The note can be up to 1000 characters, and this one has 1001.", "meta-note"));
  assert.deepEqual(seen.longLink, refused("The reference link can be up to 2000 characters, and this one has 2010.", "meta-reference"));
  assert.deepEqual(seen.longLabel, refused("The label of step 2 can be up to 100 characters, and this one has 101.", "step-name"));
  // As long as each may be is saved.
  assert.deepEqual({ status: seen.longest.status, isError: seen.longest.isError, added: seen.longest.added }, { status: "Saved to the practice library on this device.", isError: false, added: 1 });
  // Thirty thousand characters of each, written into storage behind the page's back.
  assert.deepEqual(seen.huge, { card: 100, cardSource: 40, cardEvent: 160, title: 100, titleEnd: "…", source: 40, event: 160, note: 1000, stage: 100, stepButton: 102, other: "02Two" });
});

test("in a browser, scenes saved by a newer version of the page are left alone", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.newer, {
    cards: 0,
    status: "The scenes on this device were saved by a newer version of this page, so this one leaves them alone. Reload the page to update it.",
    isError: true,
    untouched: true,
  });
});

test("in a browser, two tabs never write over each other's scenes", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // Another tab changed the scene while this one had it open: this one's is kept beside it.
  assert.deepEqual(seen.conflict, {
    status: "The saved scene was changed in another tab, so this is saved as a new scene beside it, and theirs is kept.",
    names: ["Shared, renamed", "Shared"],
    notes: ["v1", "v2"],
    save: "Save changes",
  });
  assert.deepEqual(seen.afterConflict, { notes: ["v3", "v2"], status: "Saved to the practice library on this device." }, "saved again, it changes its own copy and not theirs");
  // Deleted there: a new scene from here on.
  assert.deepEqual(seen.deletedElsewhere, {
    save: "Save to library",
    copyHidden: true,
    status: "The saved scene was deleted in another tab, so saving now keeps this as a new scene.",
  });
  assert.deepEqual(seen.deletedThenSaved, { count: 1, status: "Saved to the practice library on this device.", save: "Save changes" });
  assert.deepEqual(seen.deletedUnseen, { count: 1, status: "The saved scene was deleted in another tab, so this is saved as a new scene.", idChanged: true }, "even when this tab was not told");
  // On stage in the library.
  assert.deepEqual(seen.unchangedElsewhere, { count: "02 / 02", cards: 2 }, "a scene that did not change stays on its step");
  assert.deepEqual(seen.changedElsewhere, { count: "01 / 03", title: "Live, changed", steps: 3, label: "One" }, "one that did is loaded again");
});

test("in a browser, the camera angle is a change that is not saved, and removing a step leaves the focus on the step", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.cameraUnsaved, { opened: false, turned: true, declined: { asked: 1, name: "Camera" }, backAgain: false });
  assert.deepEqual(seen.cameraSaved, { camera: 10, unsaved: false }, "the new angle is the one that is kept");
  assert.deepEqual(seen.removeFocus, { count: "01 / 01", removeOff: true, focus: "step-name" });
});

// ---------- The numbers of a posture ----------

const GUARD = POSE_NAMES.guard;
const STORED = (postures) => ({ version: 1, postures });
// What the row of a slider says: its value, whether it has been moved, and so has a Reset to press, what Reset goes back to,
// and where the slider is.
const said = (value, slider, { moved = false, back = value } = {}) => ({ value, moved, idle: !moved, hint: `Back to: ${back}`, slider });
// What the note under the stage says in the library and the Creator, of one posture and of two.
const NOTE_ONE = "Your own version of Guard (tierce) is in use here, not the built-in one. It is on this device only. To go back to the built-in one, use Edit this posture, in the base postures.";
const NOTE_TWO = "Your own versions of Guard (tierce) and Parry 3 are in use here, not the built-in ones. They are on this device only. To go back to the built-in ones, use Edit this posture, in the base postures.";

test("in a browser, a posture's numbers stay closed until Edit this posture opens them, with a slider for every joint but where the fencer stands", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  const { posture } = seen;
  assert.equal(POSTURE_JOINTS.length, JOINTS.length - 1);
  assert.ok(!POSTURE_JOINTS.some(({ key }) => key === "x"), "where the fencer stands is not a joint of a posture");
  assert.deepEqual(posture.closed, { open: false, button: "Edit this posture", expanded: "false", target: GUARD, tag: false, marked: [], status: "", stage: false, note: false, stored: null });
  // Opened, the panel comes up beside the postures with the first slider ready, and the stage is kept in view beside it.
  assert.deepEqual(posture.open, {
    open: true,
    button: "Done editing",
    expanded: "true",
    target: GUARD,
    tag: false,
    marked: [],
    status: "",
    panels: ["stage", "detail", "posture", "bases"],
    title: GUARD,
    guardNote: true,
    sliders: POSTURE_JOINTS.map(({ key, min, max, step }) => [`posture-joint-${key}`, String(min), String(max), String(step ?? 1), String(POSES.guard[key])]),
    labels: POSTURE_JOINTS.map(({ key, label }) => [`posture-joint-${key}`, label]),
    resets: POSTURE_JOINTS.length,
    idle: POSTURE_JOINTS.length,
    moved: 0,
    resetOff: true,
    copyOff: true,
    focus: `posture-joint-${POSTURE_JOINTS[0].key}`,
    stage: true,
    pinned: "sticky",
    announced: `Editing the numbers of ${GUARD}.`,
    boxOpen: false,
    numbers: "",
    sliderIds: 0,
  });
  assert.deepEqual(posture.guard, { hip: said("77 cm", "77"), arm: said(`${POSES.guard.arm}°`, String(POSES.guard.arm)), hand: said("-45° (2/3)", "-45") }, "the sliders show the posture as built in, with nothing to put back");
  assert.deepEqual(posture.closedAgain, { open: false, button: "Edit this posture", expanded: "false", target: GUARD, tag: false, marked: [], status: "", stage: false, focus: "posture-edit" }, "the same button closes it, and keeps the focus");
});

test("in a browser, moving a slider makes the person's own version of the posture, kept as it moves, with a Reset of its own, and drawn on the stage", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  const guard = { footF: 100, hipY: 68, arm: -70 };
  assert.deepEqual(posture.moved, {
    open: true,
    button: "Done editing",
    expanded: "true",
    target: GUARD,
    tag: true,
    marked: [0],
    status: "Saved on this device.",
    arm: said("-70°", "-70", { moved: true, back: `${POSES.guard.arm}°` }),
    hipY: said("68 cm", "68", { moved: true, back: "77 cm" }),
    footF: said("100 cm", "100", { moved: true, back: "84 cm" }),
    blade: said(`${POSES.guard.blade}°`, String(POSES.guard.blade)),
    kept: STORED({ guard }),
    feetFollow: true,
    resetOff: false,
    copyOff: false,
    moved: 3,
    visibleResets: 3,
    numbers: numbersText({ guard }),
    stage: true,
  });
  // Another posture, while the numbers are open: the panel goes with it. One that takes its arm from the guard has the guard's,
  // as changed, and no version of its own until it is given one; put back, its arm goes back to the guard's.
  assert.deepEqual(posture.advance, {
    open: true,
    button: "Done editing",
    expanded: "true",
    target: POSE_NAMES.advLand,
    tag: false,
    marked: [0],
    status: "",
    title: POSE_NAMES.advLand,
    guardNote: false,
    arm: said("-70°", "-70"),
    footF: said("114 cm", "114"),
    hipY: said("79 cm", "79"),
    resetOff: true,
  });
  assert.deepEqual(posture.advanceOwn, { arm: said("-10°", "-10", { moved: true, back: "-70°" }), kept: STORED({ guard, advLand: { arm: -10 } }), marked: [0, 2] });
  assert.deepEqual(posture.advanceBack, { arm: said("-70°", "-70"), kept: STORED({ guard }), marked: [0], focus: "posture-joint-arm" }, "the slider keeps the focus when its Reset goes");
  // One joint of the guard is put back on its own and the others stay; a joint moved back to what the posture has is not a version.
  assert.deepEqual(posture.armBack, { arm: said(`${POSES.guard.arm}°`, String(POSES.guard.arm)), kept: STORED({ guard: { footF: 100, hipY: 68 } }), focus: "posture-joint-arm", hipY: said("68 cm", "68", { moved: true, back: "77 cm" }) });
  assert.deepEqual(posture.hipBack, { hipY: said("77 cm", "77"), kept: STORED({ guard: { footF: 100 } }) });
});

test("in a browser, a version is used wherever the page uses the posture, and the library and the Creator say so", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  // The Creator has the guard as the person made it: its slider shows it and says what it goes back to, and it is no adjustment.
  assert.deepEqual(posture.creator, {
    open: false,
    stage: false,
    foot: { value: "100", text: "100 cm", adjusted: false, hint: "Back to the pose: 100 cm" },
    hip: "66 cm",
    note: NOTE_ONE,
    noteInStage: true,
  });
  assert.deepEqual(posture.library, { note: NOTE_ONE, showing: ["stage", "detail", "library"] });
  assert.deepEqual(posture.libraryScene, { title: PRESETS[0].phrase.name, note: true });
  assert.deepEqual(posture.libraryTwo, { note: NOTE_TWO });
  // Among the postures themselves it is marked on the posture and on its button, not in a note.
  assert.deepEqual(posture.back, { open: false, button: "Edit this posture", expanded: "false", target: GUARD, tag: true, marked: [0], status: "", note: false, stage: false });
});

test("in a browser, all of a posture's changes are put back at once, after asking", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  assert.deepEqual(posture.reopened, { open: true, button: "Done editing", expanded: "true", target: GUARD, tag: true, marked: [0], status: "", moved: 2 });
  assert.deepEqual(
    posture.declined,
    { asked: `Put the built-in numbers back on ${GUARD}? Your changes to it are lost.`, kept: STORED({ guard: { footF: 100, hipY: 66 } }), moved: 2 },
    "it asks first, and a no changes nothing",
  );
  assert.deepEqual(posture.reset, {
    open: true,
    button: "Done editing",
    expanded: "true",
    target: GUARD,
    tag: false,
    marked: [],
    status: "Back to the built-in numbers.",
    kept: null,
    moved: 0,
    focus: "posture-joint-footF",
    resetOff: true,
    copyOff: true,
    numbers: "",
    footF: said("84 cm", "84"),
    asked: 2,
    feetBack: true,
  });
});

test("in a browser, the numbers of the person's versions are copied to send on, or left selected where the browser will not copy", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  const numbers = numbersText({ guard: { arm: -30 }, parry3: { blade: 100 } });
  // All the versions' at once, whichever posture is on show.
  assert.deepEqual(posture.wontCopy, {
    status: "This browser would not copy them, so they are selected below: copy them yourself.",
    warns: true,
    boxOpen: true,
    selected: [0, numbers.length, numbers.length],
    focus: "posture-numbers",
    numbers,
  });
  assert.deepEqual(posture.copied, { copied: [numbers], same: true, status: "Copied the numbers of 2 postures: Guard (tierce) and Parry 3.", warns: false });
});

test("in a browser, a version the browser will not keep still shows, and versions from another tab or a newer page are handled as scenes are", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  const kept = { guard: { arm: -30 }, parry3: { blade: 100 } };
  assert.deepEqual(posture.full, { status: "This browser would not keep your version, so it lasts only until you leave the page.", isError: true, yaw: said("40°", "40", { moved: true, back: "0°" }), kept: STORED(kept) }, "shown, and not kept");
  assert.deepEqual(posture.saveAgain, { status: "Saved on this device.", isError: false, kept: STORED({ guard: kept.guard, parry3: { blade: 100, yaw: 41 } }) }, "and kept again once the browser will");
  // What another tab made comes here, and replaces what this tab had; what it took back goes.
  assert.deepEqual(posture.elsewhere, { marked: [11], tag: false, kept: STORED({ parry5: { yaw: 50 } }) });
  assert.deepEqual(posture.elsewhereParry5, { marked: [11], tag: true, yaw: said("50°", "50", { moved: true, back: "70°" }) });
  assert.deepEqual(posture.elsewhereGone, { marked: [], tag: false, yaw: said("70°", "70") });
  assert.deepEqual(posture.newer, {
    marked: [11],
    tag: true,
    yaw: said("20°", "20", { moved: true, back: "70°" }),
    status: "The versions on this device were saved by a newer version of this page, so this one leaves them alone. Yours lasts only until you leave the page. Reload the page to update it.",
    isError: true,
    untouched: true,
  });
});

test("in a browser, the numbers close when the postures are left, the book's postures can be changed too, and nothing is left on the device", { skip, timeout: 120_000 }, async () => {
  const { posture } = (await drive()).seen;
  assert.deepEqual(posture.leftOpen, { open: false, button: "Edit this posture", stage: false });
  assert.deepEqual(posture.bookClosed, { open: false, button: "Edit this posture", stage: false });
  assert.deepEqual(posture.book, { open: true, target: POSE_NAMES.tierce, sliders: POSTURE_JOINTS.length, guardNote: false, stage: true });
  assert.deepEqual(posture.done, { open: false, button: "Edit this posture", expanded: "false", stage: false, focus: "posture-edit" }, "Done closes them and leaves the focus on the button that opened them");
  assert.deepEqual(posture.cleaned, { stored: null, marked: [], note: false });
});

// ---------- Dragging the parts of a fencer ----------

const PARTS = (who) => HANDLES.map(({ name }) => `Drag to move ${who}'s ${name}`);
const part = (looks, title) => looks.dots.find((dot) => dot.title === title);
// The fencers' specs in a phrase as the Creator's data shows it, for one of its steps.
const specsOf = (looks, index = 0) => {
  const step = parsePhrase(looks.phrase).steps[index];
  return { A: step.A, B: step.B };
};
// Where each dot should be across and down the stage's box as the page shows it, mirror and all: on the part of the fencer
// it belongs to, as the stage draws that for the step on show, and the view and camera the phrase was seen with.
function dotsShouldBe(looks) {
  const step = buildTimeline(parsePhrase(looks.phrase)).steps[looks.step];
  const view = looks.view.split(" ").map(Number);
  // The camera the page looks from: the slider's, on the side the Creator looks from, which for a close-up of B's hand is B's own.
  const camera = looks.camera + (looks.closeUp && looks.editing.endsWith("Fencer B.") ? 0 : 180);
  const expected = {};
  for (const [who, dir] of [["A", 1], ["B", -1]]) {
    for (const handle of HANDLES) {
      const [across, down] = shareOf(placeOf(step[who], dir, camera, handle), view);
      expected[`Drag to move ${who}'s ${handle.name}`] = [1 - across, down];
    }
  }
  return expected;
}
// Every dot that shows is on its part, to within a few pixels of the stage.
function assertOnTheParts(looks, what) {
  const expected = dotsShouldBe(looks);
  const shown = looks.dots.filter((dot) => dot.shown);
  assert.ok(shown.length > 0, `${what}: no dots`);
  for (const dot of shown) {
    const [across, down] = expected[dot.title];
    assert.ok(Math.abs(dot.across - across) * looks.box[0] < 2.5 && Math.abs(dot.down - down) * looks.box[1] < 2.5, `${what}: ${dot.title} is at ${(dot.across * looks.box[0]).toFixed(1)}, ${(dot.down * looks.box[1]).toFixed(1)} px, not ${(across * looks.box[0]).toFixed(1)}, ${(down * looks.box[1]).toFixed(1)}`);
  }
}
// How far, in pixels of the page, a dot went between two looks.
const movedBy = (before, after, title) => {
  const [a, b] = [part(before, title), part(after, title)];
  return [(b.across - a.across) * after.box[0], (b.down - a.down) * after.box[1]];
};
// Pixels of the page to centimetres of the stage, which is what a joint's value is in.
const cm = (looks) => looks.view.split(" ").map(Number)[2] / looks.box[0];
const near = (actual, expected, by, what) => assert.ok(Math.abs(actual - expected) <= by, `${what}: ${actual}, not within ${by} of ${expected}`);

test("in a browser, the Creator puts a dot on each part of the fencers that can be dragged, where the stage draws that part, and only the Creator does", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  assert.deepEqual(handles.library, { dots: false, toggle: false });
  assert.deepEqual(handles.base, { dots: false, toggle: false });
  const { opening } = handles;
  assert.equal(opening.shown, true);
  assert.deepEqual(opening.toggle, { shown: true, pressed: true, label: "Drag dots" });
  assert.deepEqual(opening.dots.map((dot) => dot.title), [...PARTS("A"), ...PARTS("B")]);
  assert.ok(opening.dots.every((dot) => dot.shown), "both fencers' dots show");
  // The fencer being edited has the dots that are solid; the other's are rings.
  assert.deepEqual(opening.dots.map((dot) => dot.other), [...PARTS("A").map(() => false), ...PARTS("B").map(() => true)]);
  assert.ok(opening.dots.every((dot) => dot.size[0] >= 28 && dot.size[1] >= 28), "large enough for a finger");
  assertOnTheParts(opening, "the pair in guard");
  assert.equal(opening.editing, "Step 1: En garde. Fencer A.");
});

test("in a browser, taking hold of a part and moving the pointer moves the part with it, and the joints that moved it show on the sliders", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { opening, hand } = handles;
  assert.deepEqual({ defaultPrevented: hand.defaultPrevented, held: hand.held, stillHeld: hand.stillHeld, letGo: hand.letGo }, { defaultPrevented: true, held: true, stillHeld: true, letGo: true }, "the pointer is the dot's while it is down, and it lets go");
  // The hand went up the page as far as the pointer did, 30 px, and the arm went with it.
  const title = "Drag to move A's sword hand";
  const [across, up] = movedBy(opening, hand.after, title);
  near(across, 0, 2.5, "the hand did not go across");
  near(up, -30, 2.5, "the hand went up with the pointer");
  assertOnTheParts(hand.after, "the arm raised");
  // The joints that moved it are written to the step, and nothing else; the sliders say so.
  const { adj, x } = specsOf(hand.after).A;
  assert.deepEqual(Object.keys(adj).toSorted(), ["arm", "fore"]);
  assert.equal(x, 0);
  assert.deepEqual(hand.sliders, { arm: String(adj.arm), fore: String(adj.fore), blade: String(POSES.guard.blade), x: "0" });
  assert.ok(Number.isInteger(adj.arm) && Number.isInteger(adj.fore), "whole numbers, as the sliders have");
  assert.equal(hand.after.editing, "Step 1: En garde. Fencer A.");
  // The other fencer's dots are rings, and moved nothing.
  assert.deepEqual(specsOf(hand.after).B, specsOf(opening).B);
});

test("in a browser, taking hold of a part of the other fencer makes that fencer the one being edited, and leaves the first as it was", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { hand, other } = handles;
  assert.equal(other.before, "Step 1: En garde. Fencer A.");
  assert.equal(other.pressedA, true);
  assert.deepEqual({ held: other.held, stillHeld: other.stillHeld, letGo: other.letGo }, { held: true, stillHeld: true, letGo: true });
  assert.equal(other.after.editing, "Step 1: En garde. Fencer B.");
  assert.equal(other.pressedB, true);
  const [across, up] = movedBy(hand.after, other.after, "Drag to move B's sword hand");
  near(across, 0, 2.5, "B's hand did not go across");
  near(up, -24, 2.5, "B's hand went up with the pointer");
  assert.deepEqual(specsOf(other.after).A, specsOf(hand.after).A, "A is as it was");
  assert.deepEqual(Object.keys(specsOf(other.after).B.adj).toSorted(), ["arm", "fore"]);
  assert.deepEqual(other.sliders, { arm: String(specsOf(other.after).B.adj.arm), fore: String(specsOf(other.after).B.adj.fore) }, "the sliders are B's now");
  // The dots turn over: B's are the ones that are solid, and A's are rings.
  assert.deepEqual(other.after.dots.map((dot) => dot.other), [...PARTS("A").map(() => true), ...PARTS("B").map(() => false)]);
  assertOnTheParts(other.after, "B's arm raised");
});

test("in a browser, a foot moves the fencer along the piste, the head leans the body and brings it back to nothing, and the hips go where they are taken", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { foot, lean, hips, other } = handles;
  // The back foot taken 40 px to the right on the page, toward B, carries A that far along the piste: the position slider, not an adjustment.
  near(Number(foot.sliders.x), 40 * cm(foot.after), 1.5, "the fencer went along the piste");
  assert.equal(specsOf(foot.after).A.x, Number(foot.sliders.x));
  assert.deepEqual({ footF: foot.sliders.footF, hipX: foot.sliders.hipX }, { footF: String(POSES.guard.footF), hipX: String(POSES.guard.hipX) }, "the rest of the body went with it");
  assert.equal(foot.after.editing, "Step 1: En garde. Fencer A.", "the pointer took A's foot, so A is edited again");
  assertOnTheParts(foot.after, "A moved along");
  // The head taken forward leans the body; taken back to where it was, the lean is gone and is not left in the step as an adjustment.
  assert.ok(Number(lean.out.lean) > 5, `leaning forward: ${lean.out.lean}`);
  assert.equal(lean.back.lean, "0");
  assert.equal(specsOf(lean.after).A.adj.lean, undefined, "a joint put back to the pose's own is no adjustment");
  assert.deepEqual(Object.keys(specsOf(lean.after).A.adj).toSorted(), ["arm", "fore"], "the others' are kept");
  // The hips taken back 24 px and up 16 on the page: back along the piste and higher.
  near(Number(hips.sliders.hipX), POSES.guard.hipX - 24 * cm(hips.after), 1.5, "the hips went back");
  near(Number(hips.sliders.hipY), POSES.guard.hipY + 16 * cm(hips.after), 1.5, "and up");
  assertOnTheParts(hips.after, "the hips moved");
  assert.deepEqual(specsOf(hips.after).B, specsOf(other.after).B, "and B is as it was while A was edited");
});

test("in a browser, the dots go with the camera, and a part is taken hold of from where the camera sees it", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { hips, turned, turnedDrag, round } = handles;
  assert.equal(turned.camera, 60);
  assert.notEqual(turned.view, hips.after.view, "the stage looks somewhere else");
  assertOnTheParts(turned, "the camera turned to 60");
  assertOnTheParts(round, "the camera all the way round");
  // A foot taken 30 px to the left and 10 up, seen from there, goes where the pointer took it, which is not 15 cm along the piste:
  // from there the camera sees along the piste a half as far, and the other way round for the page's mirror.
  const [across, up] = movedBy(turned, turnedDrag.after, "Drag to move A's front foot");
  near(across, -30, 2.5, "across, as the pointer went");
  near(up, -10, 2.5, "up, as the pointer went");
  assertOnTheParts(turnedDrag.after, "the foot taken from the side");
  const seen = Math.cos(((turned.camera + 180) * Math.PI) / 180);
  near(Number(turnedDrag.sliders.footF), POSES.guard.footF + (30 * cm(turned)) / seen, 2, "the reach changed by what the camera sees of it");
  near(Number(turnedDrag.sliders.liftF), 10 * cm(turned), 1.5, "and the foot was lifted");
});

test("in a browser, only a press of the first button begins a drag, only its pointer is heard, and a drag taken far off stops at the ends of the sliders", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  assert.deepEqual(handles.otherButton, { moved: false, held: false });
  assert.deepEqual(handles.letGoOutside, { ended: true, movedAfter: false }, "a mouse button let go where the page cannot see ends it");
  assert.deepEqual(handles.strangerPointer, { moved: false, stillHeld: true }, "another pointer is not heard");
  assert.deepEqual(handles.finished, { held: false });
  assert.deepEqual(handles.pressedAgain, { moved: false, held: true }, "the same pointer pressing again takes hold afresh, where it is, and the part does not jump");
  assert.deepEqual(handles.pressedAgainEnded, { held: false });
  const hips = JOINTS.filter(({ key }) => key === "hipX" || key === "hipY");
  const by = Object.fromEntries(hips.map(({ key, min, max }) => [key, { min, max }]));
  assert.deepEqual(handles.farOff, { sliders: { hipX: String(by.hipX.min), hipY: String(by.hipY.max) }, phrase: false, paths: 0 }, "up and back, as far as the sliders go");
  assert.deepEqual(handles.farOther, { hipX: String(by.hipX.max), hipY: String(by.hipY.min) }, "and down and forward");
});

test("in a browser, a finger drags a part as a mouse does, and at a later step the dots are on that step's poses and a drag changes that step alone", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { touch, secondStep } = handles;
  assert.deepEqual({ defaultPrevented: touch.defaultPrevented, held: touch.held, stillHeld: touch.stillHeld, letGo: touch.letGo }, { defaultPrevented: true, held: true, stillHeld: true, letGo: true });
  // The elbow turns the upper arm about the shoulder, so it goes up with the pointer, a little across.
  const [across, up] = movedBy(touch.before, touch.after, "Drag to move A's sword elbow");
  assert.ok(up < -8 && Math.abs(across) < 8, `the elbow went up ${up.toFixed(1)} and across ${across.toFixed(1)} px`);
  assert.notEqual(specsOf(touch.after).A.adj.arm, specsOf(touch.before).A.adj?.arm, "the upper arm turned");
  assertOnTheParts(touch.after, "the elbow taken by a finger");
  // The second step: the dots are on its poses, and taking B's foot there changes that step's B and leaves the first as it was.
  assert.equal(secondStep.before.step, 1);
  assertOnTheParts(secondStep.before, "the second step");
  assert.equal(secondStep.after.step, 1);
  assertOnTheParts(secondStep.after, "the second step, B's foot taken");
  assert.deepEqual(specsOf(secondStep.after, 0), specsOf(secondStep.before, 0), "the first step is as it was");
  assert.deepEqual(specsOf(secondStep.after, 1).A, specsOf(secondStep.before, 1).A, "and so is A at the second");
  const b = specsOf(secondStep.after, 1).B;
  assert.ok(b.adj.footF !== undefined && b.adj.footF !== specsOf(secondStep.before, 0).B.adj?.footF, "B's front foot reaches differently at the second step");
  const [foot] = movedBy(secondStep.before, secondStep.after, "Drag to move B's front foot");
  near(foot, -24, 2.5, "B's foot went across with the pointer");
});

test("in a browser, the dots show while the stage shows a step's own pose, however it was left there, and not while a scene plays, between two steps, over text that is not a phrase yet, or when turned off", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  assert.deepEqual(handles.playing, { shown: false, toggle: true }, "playing");
  // Stopped in a step's hold, the stage shows that step's own pose, so the dots are there: after pausing, along the timeline, and
  // with a phrase pasted in, none of which pick a step. Between two steps the stage shows a moment that no step has.
  assert.deepEqual(handles.paused, { shown: true, time: "0.90 / 1.10 s" }, "paused where it started, which was the picked second step's hold");
  assert.deepEqual(handles.between, { shown: false, time: "0.75 / 1.10 s" }, "in the move into the second step");
  assert.deepEqual({ shown: handles.firstHold.shown, time: handles.firstHold.time }, { shown: true, time: "0.30 / 1.10 s" });
  assert.equal(handles.firstHold.looks.step, 0);
  assertOnTheParts(handles.firstHold.looks, "the timeline in the first hold");
  assert.deepEqual({ shown: handles.secondHold.shown, time: handles.secondHold.time }, { shown: true, time: "1.00 / 1.10 s" });
  assert.equal(handles.secondHold.looks.step, 1, "and in the second");
  assertOnTheParts(handles.secondHold.looks, "the timeline in the second hold");
  assert.deepEqual(handles.stepPicked, { shown: true }, "a step picked");
  assert.deepEqual(handles.off, { shown: false, pressed: false });
  assert.deepEqual(handles.on, { shown: true, pressed: true });
  assert.deepEqual(handles.onHold, { shown: false }, "text that is not a phrase yet");
  assert.deepEqual(handles.resumed, { shown: true }, "and as soon as it is one again, with no step picked");
  assert.equal(handles.pasted.shown, true, "a phrase pasted in");
  assertOnTheParts(handles.pasted, "the pasted phrase");
  assert.deepEqual(specsOf(handles.pasted).B.adj, { arm: -52, blade: 80, fore: 26 });
  assert.equal(handles.pastedThenCamera.camera, 40);
  assert.equal(handles.pastedThenCamera.shown, true, "and the camera turned after it");
  assertOnTheParts(handles.pastedThenCamera, "the pasted phrase from a turned camera");
  assert.deepEqual(handles.solo, { A: HANDLES.length, B: 0 });
  assert.deepEqual(handles.pair, { B: HANDLES.length });
  assert.deepEqual(handles.left, { shown: false });
  assert.deepEqual(handles.back, { shown: true });
});

test("in a browser, the dots stay in the close-up of a hand, those in view and the fencer's being edited, and the view holds still while one is dragged", { skip, timeout: 120_000 }, async () => {
  const { handles } = (await drive()).seen;
  const { before, during, after } = handles.closeUp;
  const title = "Drag to move A's sword hand";
  const shown = (looks) => looks.dots.filter((dot) => dot.shown);
  // A's hand is looked at: only A's dots, those that are in view, and the hand among them.
  assert.equal(before.closeUp, true);
  assert.ok(shown(before).length >= 1 && shown(before).length < HANDLES.length, `${shown(before).length} dots in view`);
  assert.ok(shown(before).every((dot) => dot.title.startsWith("Drag to move A")), "A's");
  assert.ok(shown(before).some((dot) => dot.title === title), "the hand is among them");
  for (const dot of shown(before)) assert.ok(dot.across >= -0.011 && dot.across <= 1.011 && dot.down >= -0.011 && dot.down <= 1.011, `${dot.title} is in view`);
  assertOnTheParts(before, "the close-up of A's hand");
  // Taken hold of and moved 24 px back toward the shoulder and 18 up, the hand goes with the pointer and the view does not move.
  assert.equal(during.view, before.view, "the view holds still");
  assert.equal(part(during, title).dragging, true);
  const [across, up] = movedBy(before, during, title);
  near(across, -24, 3, "the hand went back with the pointer");
  near(up, -18, 3, "and up");
  assertOnTheParts(during, "the hand dragged in the close-up");
  // Let go, the view follows the hand again, and the hand is back in the middle of it where it was, to within a few pixels: the
  // view is centred between the wrist and the forte of the blade, which the turn of the forearm moves a little.
  assert.notEqual(after.view, during.view, "the view follows the hand when it is let go");
  const [backAcross, backUp] = movedBy(before, after, title);
  assert.ok(Math.hypot(backAcross, backUp) < 10, `the hand is ${Math.hypot(backAcross, backUp).toFixed(1)} px from where it was in the view`);
  assertOnTheParts(after, "the close-up after the drag");
  // What was written is in tenths: a drag of a centimetre or two at this size is a few degrees, and whole degrees would move the hand
  // in steps of ten pixels.
  const adj = specsOf(after).A.adj;
  const was = specsOf(before).A.adj ?? {};
  const moved = ["arm", "fore"].filter((key) => adj[key] !== was[key]);
  assert.ok(moved.length >= 1, "the arm moved");
  for (const key of moved) assert.ok(Math.abs(adj[key] * 10 - Math.round(adj[key] * 10)) < 1e-6, `${key} ${adj[key]} is in tenths`);
  assert.ok(moved.some((key) => !Number.isInteger(adj[key])), "and not in whole degrees");
  // B's hand is looked at when B is the one being edited: B's dots.
  const { closeUpB } = handles;
  assert.equal(closeUpB.editing.endsWith("Fencer B."), true);
  assert.ok(shown(closeUpB).length >= 1 && shown(closeUpB).every((dot) => dot.title.startsWith("Drag to move B")), "B's");
  assert.ok(shown(closeUpB).some((dot) => dot.title === "Drag to move B's sword hand"));
  assertOnTheParts(closeUpB, "the close-up of B's hand");
});

test("in a browser, the fencers are 3D figures, one alone and two in a pair, or stick figures with a note saying why", { skip, timeout: 120_000 }, async () => {
  const { seen, errors, consoleLines } = await drive();
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleLines, []);
  const { figures3d } = seen;
  if (figures3d.loaded.canvas) {
    assert.deepEqual(figures3d.loaded, { canvas: true, sticks: [false, false], note: "" });
    assert.equal(figures3d.pair, "A B");
    assert.equal(figures3d.solo, "A");
  } else {
    // A browser that cannot draw them in 3D, such as one with no graphics at all.
    assert.match(figures3d.loaded.note, /^The fencers are drawn as stick figures, as .+\.$/);
    assert.deepEqual(figures3d.loaded.sticks, [true, true]);
  }
});

test("in a browser without WebGL, stick figures stand in for the 3D figures, and a note under the stage says why", { skip, timeout: 120_000 }, async () => {
  const { seen, errors, consoleLines } = resultsOf(await openInBrowser("/drive.html?fallback", ["--disable-3d-apis"]));
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleLines, []);
  assert.deepEqual(seen.fallback, {
    canvas: false,
    sticks: [true, true],
    note: "The fencers are drawn as stick figures, as this browser cannot draw them in 3D, having no WebGL 2.",
  });
  // The stick figures stand in the same frame as the 3D ones, which is shown in a mirror.
  assert.equal(seen.fallbackMirror, MIRRORED);
});
