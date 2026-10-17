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

import { BASES, BASE_GROUPS } from "../site/js/bases.js";
import { POSE_NAMES, PRESETS } from "../site/js/library.js";
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
async function openInBrowser(path) {
  assert.ok(browser, "REQUIRE_BROWSER=1, but no Chrome or Chromium was found; set CHROME_BIN");
  const site = siteHandler();
  const server = createServer((request, response) => {
    if (request.url !== "/drive.html") return site(request, response);
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
        "--dump-dom",
        `http://127.0.0.1:${server.address().port}${path}`,
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
    );
    // The page logs nothing, so any console line is a problem: an uncaught
    // error, a failed load, something the security policy refused.
    return { dom: stdout, consoleLines: stderr.split("\n").filter((line) => line.includes(":CONSOLE")) };
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
  driven ??= openInBrowser("/drive.html").then(({ dom, consoleLines }) => {
    const json = dom.match(/<pre id="results">([^<]*)<\/pre>/)?.[1];
    assert.ok(json, "the driver did not finish");
    const results = JSON.parse(json.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
    return { ...results, consoleLines };
  });
  return driven;
}

const CONTROLS = ["#play-button", ".speed", "#timeline", "#steps", "#timecode", "[data-toggle=ghosts]", "[data-toggle=trail]", "[data-toggle=ink]", "[data-toggle=loop]", "#camera"];
const two = (n) => String(n).padStart(2, "0");

test("in a browser, the page opens on the practice library and builds its controls", { skip, timeout: 120_000 }, async () => {
  const { dom, consoleLines } = await openInBrowser("/");
  assert.deepEqual(consoleLines, []);
  const count = (pattern) => (dom.match(pattern) ?? []).length;
  assert.equal(count(/class="mode-button"/g), 3, "mode buttons");
  assert.match(dom, /<button[^>]*data-mode="library"[^>]*aria-pressed="true"[^>]*>Practice library</);
  assert.equal(count(/class="scene-button"/g), 4, "scenes in the library");
  assert.match(dom, /id="scene-title"[^>]*>Advance, lunge, head cut</);
  assert.equal(count(/class="step-button"/g), 8, "step buttons");
  assert.equal(count(/class="pose-button"/g), 11, "pose buttons");
  assert.equal(count(/class="base-button"/g), 11, "posture buttons");
  // Each fencer's parts are filled by what they are, so the older man's trousers can be a shade darker than his jersey.
  assert.equal(count(/class="figure__fill figure__fill--trousers"/g), 4, "two legs for each fencer");
  assert.equal(count(/class="figure__fill figure__fill--jersey"/g), 6, "the jersey and both arms for each");
  assert.equal(count(/class="figure__fill figure__fill--face"/g), 2, "and a face for each");
  assert.equal(count(/<input type="range" id="joint-/g), 10, "joint sliders");
  assert.match(dom, /id="step-count"[^>]*>\d\d \/ 08</);
  // The panels of the other modes are there, and out of sight.
  assert.match(dom, /class="panel panel--poses hidden"/);
  assert.doesNotMatch(dom, /class="panel panel--library hidden"/);
  const paths = [...dom.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(paths.filter(Boolean).length > 60, `only ${paths.filter(Boolean).length} paths drawn`);
  for (const d of paths) assert.doesNotMatch(d, /NaN|Infinity|undefined/);
});

test("in a browser, working every control logs nothing and draws no broken path", { skip, timeout: 120_000 }, async () => {
  const { errors, seen, consoleLines } = await drive();
  assert.deepEqual(consoleLines, []);
  assert.deepEqual(errors, []);
  assert.equal(seen.badPaths, 0, "paths with NaN, Infinity or undefined");
});

test("in a browser, the practice library plays each scene and says what it is", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.scenes, [
    { title: "Advance, lunge, head cut", pressed: "true", card: "Pair · 8 steps · 3.4 s", count: "01 / 08", solo: false, camera: "0", time: "0.00 / 3.39 s", scrubbedTo: "08 / 08" },
    { title: "Lunge to the chest, parry 3, riposte", pressed: "true", card: "Pair · 4 steps · 3.3 s", count: "01 / 04", solo: false, camera: "0", time: "0.00 / 3.32 s", scrubbedTo: "04 / 04" },
    { title: "Head attack, parry 5, riposte to head", pressed: "true", card: "Pair · 5 steps · 3.4 s", count: "01 / 05", solo: false, camera: "28", time: "0.00 / 3.44 s", scrubbedTo: "05 / 05" },
    { title: "Moulinet to the head", pressed: "true", card: "Solo · 7 steps · 2.7 s", count: "01 / 07", solo: true, camera: "25", time: "0.00 / 2.68 s", scrubbedTo: "07 / 07" },
  ]);
  // A built-in scene has no event or link to give, and says so, and cannot be deleted.
  assert.deepEqual(seen.builtIn, {
    title: "Lunge to the chest, parry 3, riposte",
    kind: "Built in",
    event: "Not noted yet",
    eventNone: true,
    reference: "No link yet",
    links: 0,
    note: PRESETS[1].phrase.note,
    edit: "Edit a copy in the Creator",
    deleteHidden: true,
    savedEmpty: true,
  });
  assert.deepEqual(seen.libraryShows, { chosen: ["library"], panels: ["stage", "detail", "library"], controls: CONTROLS });

  assert.deepEqual(seen.stepped, {
    count: "03 / 08",
    label: "Advance: front foot lands",
    play: "Play",
    announced: "Step 3 of 8: Advance: front foot lands",
    // A advances and has all four ghosts, a body and a blade each; B holds the guard and has none.
    ghosts: { A: 8, B: 0 },
  });
  assert.deepEqual(seen.toggledOff, { pressed: ["false", "false", "false", "false"], ghostsHidden: true, trailsHidden: true, inkFilter: null });
  assert.equal(seen.inkFilter, "url(#ink-texture)");
  assert.deepEqual(seen.camera, { shown: "-40°", floorTurned: true });
  assert.deepEqual(seen.speed, ["true", "false", "false"]);
  assert.equal(seen.playing, "Pause");
  assert.equal(seen.paused, "Play");
});

test("in a browser, the base postures show one fencer, not a pair, and describe each posture", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.baseShows, { chosen: ["base"], panels: ["stage", "detail", "bases"], controls: ["[data-toggle=ink]", "#camera"] });
  assert.deepEqual(seen.baseStage, {
    label: "Guard (tierce)",
    count: "01 / 11",
    solo: true,
    bodyA: "inline",
    bodyB: "none",
    bladeB: "none",
    legend: "none",
    ghostsHidden: true,
    trailsHidden: true,
    ghostToggle: "true",
    camera: "25",
    prev: "Previous posture",
    next: "Next posture",
  });
  assert.deepEqual(
    seen.postures,
    BASES.map((base, i) => ({
      name: POSE_NAMES[base.pose],
      group: base.group,
      key: base.pose,
      text: base.text,
      points: base.points,
      label: POSE_NAMES[base.pose],
      count: `${two(i + 1)} / ${two(BASES.length)}`,
      pressed: 1,
      pressedIs: i,
    })),
  );
  assert.deepEqual(seen.groups, BASE_GROUPS);
  assert.deepEqual(seen.arrows, {
    atStart: "01 / 11",
    third: "Advance, land",
    announced: "Posture 3 of 11: Advance, land",
    atEnd: "11 / 11",
    cameraTurned: true,
    inkOff: null,
  });
  assert.deepEqual(seen.baseKept, { count: "05 / 11", label: "Blade up" });
});

test("in a browser, the Creator edits a copy of a scene the way the page always has", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.copied, {
    showing: { chosen: ["creator"], panels: ["stage", "scene", "phrase", "step", "adjust", "poses"], controls: CONTROLS },
    name: "Advance, lunge, head cut",
    note: "A advances, raises the b",
    event: "",
    save: "Save to library",
    copyHidden: true,
    status: "Applied: 8 steps, 3.39 s",
    count: "01 / 08",
    asked: 0,
    // The button that was pressed went away with the mode; focus went to the mode's button.
    focus: "creator",
  });
  assert.deepEqual(seen.posed, {
    line: '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":310}},',
    pressed: ["Parry 3parry3"],
    editing: "Step 3: Advance: front foot lands. Fencer B.",
  });
  assert.deepEqual(seen.adjusted, {
    line: '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":200,"adj":{"blade":100}}},',
    said: "100°",
  });
  assert.equal(seen.reset, '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":200}},');

  assert.match(seen.broken.status, /^Not applied: /);
  assert.equal(seen.broken.isError, true);
  assert.equal(seen.broken.kept, '{"steps": [', "the text stays as typed");
  assert.equal(seen.broken.count, "03 / 08", "the last good phrase stays on stage");
  assert.deepEqual(seen.unknown, {
    status: "Applied. Unknown pose flunge shown as guard",
    isWarning: true,
    count: "02 / 02",
    camera: "60",
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
  assert.deepEqual(seen.removed, { labels: ["01En garde", "02Lunge"], count: "02 / 02", editing: "Step 2: Lunge. Fencer A." });
  assert.deepEqual(seen.alone, { line: '  "solo": true,', solo: true, bodyB: "none", canEditB: false });
  assert.deepEqual(seen.together, { line: false, solo: false, bodyB: "inline" });
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
  assert.deepEqual(seen.listed, { saved: [card, card], builtIn: 4, emptyHidden: true, pressed: 1 });
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
    saved: 4,
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
  assert.deepEqual(seen.deleted, { cards: 2, stored: 3, title: "Advance, lunge, head cut", focus: "library" });
  assert.deepEqual(seen.allDeleted, { cards: 0, stored: 1, emptyShown: true, builtIn: 4 }, "all that is left is the entry it cannot show");
  assert.deepEqual(seen.elsewhere, { cards: 0, title: "Advance, lunge, head cut" }, "a scene deleted in another tab leaves this one's list");
  const replace = "The scene in the Creator has changes that are not saved. Replace it?";
  assert.deepEqual(seen.asked, [replace, replace, replace, replace, replace, 'Delete "<b>Evil</b>" from this device?', 'Delete "<b>Evil</b>" from this device?', 'Delete "Lunge to the head" from this device?', 'Delete "Lunge to the head" from this device?']);
});

test("in a browser, text that is not a phrase yet keeps the fields still, and what was typed is not lost", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  // A new scene: every control that edits it is on, but for the move time of its first step and removing its only one.
  assert.deepEqual(seen.fieldsOn, { total: 33, off: 2 });
  assert.match(seen.onHold.status, /^Not applied: .+\. The fields are on hold until it is\.$/);
  assert.deepEqual({ ...seen.onHold, status: "" }, {
    total: 33,
    off: 33,
    status: "",
    note: "On hold: the phrase data is not applied yet.",
    noteIsWarning: true,
    focus: "phrase-text",
  }, "all of them are off, and the one that had the focus gave it to the text");
  assert.deepEqual({ ...seen.keptOnHold, status: "" }, { text: '{"name": "Mine", "steps": [', name: "Kept name", count: "01 / 01", same: true, status: "" }, "a change that gets through anyway is dropped");
  assert.match(seen.keptOnHold.status, /^Not applied: /);
  assert.deepEqual(seen.holdSave, { status: "Fix the phrase data first: it is not applied yet.", saved: 0 });
  assert.deepEqual(seen.resumed, { total: 33, off: 0, status: "Applied: 2 steps, 0.00 s", note: "", name: "Mine", steps: 2 }, "once it is a phrase they are on again, showing it");
  assert.deepEqual(seen.resumedEdit, { name: '  "name": "Mine, renamed",', text: ["{", '  "name": "Mine, renamed",', '  "steps": ['] });
});

test("in a browser, text longer than a field allows is not saved, and longer text already saved is shown cut short", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  const refused = (status, focus) => ({ status, isError: true, focus, added: 0 });
  assert.deepEqual(seen.longName, refused("The name can be up to 100 characters, and this one has 101.", "meta-name"));
  assert.deepEqual(seen.longEvent, refused("The event can be up to 160 characters, and this one has 161.", "meta-event"));
  assert.deepEqual(seen.longNote, refused("The note can be up to 1000 characters, and this one has 1001.", "meta-note"));
  assert.deepEqual(seen.longLink, refused("The reference link can be up to 2000 characters, and this one has 2010.", "meta-reference"));
  assert.deepEqual(seen.longLabel, refused("The label of step 2 can be up to 100 characters, and this one has 101.", "step-name"));
  // As long as each may be is saved.
  assert.deepEqual({ status: seen.longest.status, isError: seen.longest.isError, added: seen.longest.added }, { status: "Saved to the practice library on this device.", isError: false, added: 1 });
  // Thirty thousand characters of each, written into storage behind the page's back.
  assert.deepEqual(seen.huge, { card: 100, cardEvent: 160, title: 100, titleEnd: "…", event: 160, note: 1000, stage: 100, stepButton: 102, other: "02Two" });
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
  assert.deepEqual(seen.unchangedElsewhere, { count: "02 / 02", cards: 2 }, "a scene that did not change plays on");
  assert.deepEqual(seen.changedElsewhere, { count: "01 / 03", title: "Live, changed", steps: 3, label: "One" }, "one that did is loaded again");
});

test("in a browser, the camera angle is a change that is not saved, and removing a step leaves the focus on the step", { skip, timeout: 120_000 }, async () => {
  const { seen } = await drive();
  assert.deepEqual(seen.cameraUnsaved, { opened: false, turned: true, declined: { asked: 1, name: "Camera" }, backAgain: false });
  assert.deepEqual(seen.cameraSaved, { camera: 10, unsaved: false }, "the new angle is the one that is kept");
  assert.deepEqual(seen.removeFocus, { count: "01 / 01", removeOff: true, focus: "step-name" });
});
