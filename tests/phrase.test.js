import assert from "node:assert/strict";
import { test } from "node:test";

import { POSES, PRESETS } from "../site/js/library.js";
import {
  MAX_STEP_MS,
  TEXT_KEYS,
  TEXT_LIMITS,
  buildTimeline,
  clearAdjustments,
  clip,
  clone,
  ease,
  editSpec,
  insertStep,
  mixPoses,
  newPhrase,
  parsePhrase,
  phraseToText,
  poseAt,
  removeStep,
  resolvePose,
  samePose,
  setJoint,
  setMeta,
  setPose,
  setSolo,
  setStepField,
} from "../site/js/phrase.js";

const spans = (timeline) => timeline.steps.map((step) => [step.start, step.holdStart, step.end]);

test("each step moves for its ms, then holds; the first step does not move", () => {
  const timeline = buildTimeline({
    steps: [
      { label: "One", ms: 999, hold: 100 },
      { label: "Two", ms: 200, hold: 50 },
      { label: "Three", ms: 300 },
    ],
  });
  assert.deepEqual(spans(timeline), [
    [0, 0, 100],
    [100, 300, 350],
    [350, 650, 650],
  ]);
  assert.equal(timeline.duration, 650);
});

test("times that are missing, negative or not numbers count as zero", () => {
  const timeline = buildTimeline({
    steps: [{ hold: "soon" }, { ms: -50, hold: 20 }, { ms: "30" }, { ms: 1e400, hold: null }],
  });
  assert.deepEqual(spans(timeline), [
    [0, 0, 0],
    [0, 0, 20],
    [20, 50, 50],
    [50, 50, 50],
  ]);
});

test("the built-in phrases have the lengths the page reports", () => {
  const lengths = PRESETS.map(({ phrase }) => {
    const timeline = buildTimeline(phrase);
    return [timeline.steps.length, timeline.duration];
  });
  assert.deepEqual(lengths, [
    [8, 3390],
    [4, 3320],
    [5, 3440],
    [7, 2680],
  ]);
});

test("the built-in phrases use only library poses, and only the moulinet is solo", () => {
  for (const { phrase } of PRESETS) {
    const timeline = buildTimeline(phrase);
    assert.deepEqual(timeline.unknown, [], phrase.name);
    assert.equal(timeline.solo, phrase.name === "Moulinet to the head", phrase.name);
  }
});

test("a fencer a step leaves out keeps the spec from the step before", () => {
  const timeline = buildTimeline({
    steps: [
      { A: { pose: "guard", x: 10 }, B: { pose: "parry3", x: 200 } },
      { ms: 100, A: { pose: "lungeHead", x: 10 } },
    ],
  });
  assert.equal(timeline.steps[1].specB, timeline.steps[0].specB);
  assert.deepEqual(timeline.steps[1].B, { ...POSES.guard, ...POSES.parry3, x: 200 });
});

test("fencers start in guard, A at 0 and B at 310, until a phrase places them", () => {
  const [step] = buildTimeline({ steps: [{ label: "Nothing yet" }] }).steps;
  assert.deepEqual(step.A, { ...POSES.guard, x: 0 });
  assert.deepEqual(step.B, { ...POSES.guard, x: 310 });
});

test("steps without a label are numbered, and an empty phrase still shows one step", () => {
  const timeline = buildTimeline({ steps: [{}, null, 7, { label: "Fourth" }] });
  assert.deepEqual(
    timeline.steps.map((step) => step.label),
    ["Step 1", "Step 2", "Step 3", "Fourth"],
  );
  const empty = buildTimeline({ steps: [] });
  assert.equal(empty.steps.length, 1);
  assert.equal(empty.steps[0].label, "Empty phrase");
  assert.equal(empty.duration, 1);
  assert.equal(buildTimeline(null).steps.length, 1);
});

test("a pose the library lacks is drawn as the guard and reported once", () => {
  const timeline = buildTimeline({
    steps: [
      { A: { pose: "flunge" }, B: { pose: "toString" } },
      { ms: 100, A: { pose: "flunge" } },
    ],
  });
  assert.deepEqual(timeline.unknown, ["flunge", "toString"]);
  assert.deepEqual(timeline.steps[1].A, { ...POSES.guard, x: 0 });
});

test("adjustments override the pose, except unknown keys and values that are not numbers", () => {
  const pose = resolvePose({ pose: "riposte", x: 12, adj: { arm: 20, blade: "40", fore: "far", hipx: 50, x: 99, lean: 1e400 } });
  assert.deepEqual(pose, { ...POSES.guard, ...POSES.riposte, arm: 20, blade: 40, x: 12 });
});

test("a position that is missing or not a finite number is 0", () => {
  assert.equal(resolvePose({ x: "left" }).x, 0);
  assert.equal(resolvePose({ x: 1e400 }).x, 0);
  assert.equal(resolvePose({}).x, 0);
  assert.equal(resolvePose("guard").x, 0);
});

test("between steps the pose eases from one keyframe to the next, then holds", () => {
  const timeline = buildTimeline({
    steps: [
      { hold: 100, A: { pose: "guard", x: 0 } },
      { ms: 200, hold: 100, ease: "linear", A: { pose: "guard", x: 100 } },
    ],
  });
  assert.equal(poseAt(timeline, 50).A.x, 0);
  assert.equal(poseAt(timeline, 50).index, 0);
  assert.equal(poseAt(timeline, 150).A.x, 25);
  assert.equal(poseAt(timeline, 150).index, 1);
  assert.equal(poseAt(timeline, 300).A, timeline.steps[1].A);
  assert.equal(poseAt(timeline, 9999).A, timeline.steps[1].A);
});

test("easing curves", () => {
  assert.equal(ease(0.5, "linear"), 0.5);
  assert.equal(ease(0.5, "snap"), 0.875);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(ease(0.25) - (0.5 - 0.5 * Math.cos(Math.PI / 4))) < 1e-12);
  for (const kind of ["linear", "snap", undefined]) {
    assert.equal(ease(-1, kind), 0);
    assert.equal(ease(2, kind), 1);
  }
});

test("angles take the short way round; lengths go straight", () => {
  const halfway = mixPoses({ blade: 170, hipX: 10 }, { blade: -170, hipX: 20 }, 0.5);
  assert.equal(halfway.blade, 180);
  assert.equal(halfway.hipX, 15);
  assert.equal(mixPoses({ arm: -170 }, { arm: 170 }, 0.25).arm, -175);
});

test("two poses are the same when every joint is, so a fencer who is not moving has no ghosts", () => {
  const guard = resolvePose({ pose: "guard", x: 5 });
  assert.equal(samePose(guard, resolvePose({ pose: "guard", x: 5 })), true);
  assert.equal(samePose(guard, resolvePose({ pose: "guard", x: 6 })), false, "a position");
  assert.equal(samePose(guard, resolvePose({ pose: "guard", x: 5, adj: { turn: 57 } })), false, "a joint");
  assert.equal(samePose(guard, { ...guard, extra: 1 }), false, "or a joint more");
  // A fencer a step leaves alone is mixed with himself on the way, and comes out the same.
  const timeline = buildTimeline({ steps: [{ A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 300 } }, { ms: 200, A: { pose: "lungeHead", x: 0 } }] });
  const during = poseAt(timeline, timeline.steps[1].start + 90);
  assert.equal(samePose(during.B, timeline.steps[1].B), true, "B has not moved");
  assert.equal(samePose(during.A, timeline.steps[1].A), false, "A is on the way");
  assert.equal(samePose(poseAt(timeline, timeline.steps[1].start + 40).B, during.B), true, "at any moment of the move");
});

test("how far the shoulders are turned is an angle like the others: a phrase can set it, and it eases between steps", () => {
  assert.equal(POSES.guard.turn, 58, "the guard has the shoulders turned toward the camera");
  assert.equal(resolvePose({ pose: "guard", adj: { turn: 20 } }).turn, 20);
  assert.equal(resolvePose({ pose: "lungeChest" }).turn, 58, "a pose that leaves it out keeps the guard's");
  const timeline = buildTimeline({
    steps: [
      { hold: 100, A: { pose: "guard", x: 0 } },
      { ms: 200, hold: 100, ease: "linear", A: { pose: "guard", x: 0, adj: { turn: 18 } } },
    ],
  });
  assert.equal(poseAt(timeline, 200).A.turn, 38, "halfway from 58 to 18");
  assert.equal(mixPoses({ turn: 170 }, { turn: -170 }, 0.5).turn, 180, "the short way round");
});

test("phrase text keeps one setting per line and one step per line, and reads back the same", () => {
  for (const { phrase } of PRESETS) {
    const text = phraseToText(phrase);
    assert.deepEqual(parsePhrase(text), phrase);
    const lines = text.split("\n");
    assert.equal(lines.length, Object.keys(phrase).length + phrase.steps.length + 3);
    assert.equal(lines.at(-3), `    ${JSON.stringify(phrase.steps.at(-1))}`);
  }
  assert.equal(phraseToText({ steps: [{ label: "Only" }] }), '{\n  "steps": [\n    {"label":"Only"}\n  ]\n}');
});

test("text that is not a phrase is refused with a reason", () => {
  assert.throws(() => parsePhrase('{"steps": ['), SyntaxError);
  for (const text of ["{}", '{"steps": []}', '{"steps": {}}', "[]", "null", "3"]) {
    assert.throws(() => parsePhrase(text), { message: 'it needs a "steps" list with at least one step' }, text);
  }
});

test("an edit to a spec the step only inherits copies it onto that step first", () => {
  const phrase = {
    steps: [
      { A: { pose: "guard", x: 0 }, B: { pose: "parry3", x: 245 } },
      { ms: 100, A: { pose: "lungeChest", x: 0 } },
    ],
  };
  const before = clone(phrase);
  const edited = editSpec(phrase, buildTimeline(phrase), 1, "B", (spec) => setJoint(spec, "arm", 12));
  assert.deepEqual(edited.steps[1].B, { pose: "parry3", x: 245, adj: { arm: 12 } });
  assert.deepEqual(edited.steps[0], phrase.steps[0]);
  assert.deepEqual(phrase, before, "the original phrase is left alone");
});

test("an edit reaches a step that is not an object, and a spec that is not one", () => {
  const phrase = { steps: [{ A: "guard" }, null] };
  const timeline = buildTimeline(phrase);
  assert.deepEqual(editSpec(phrase, timeline, 0, "A", (spec) => setJoint(spec, "x", 30)).steps[0].A, { x: 30 });
  assert.deepEqual(editSpec(phrase, timeline, 1, "A", (spec) => setPose(spec, "prep")).steps[1], { A: { pose: "prep" } });
  assert.equal(editSpec(phrase, timeline, 2, "A", () => {}), null);
  assert.equal(editSpec({ steps: [] }, buildTimeline({ steps: [] }), 0, "A", () => {}), null);
});

test("the position moves directly; every other joint is an adjustment", () => {
  const spec = { pose: "guard", x: 0, adj: { blade: 10 } };
  setJoint(spec, "x", 40);
  setJoint(spec, "arm", -5);
  assert.deepEqual(spec, { pose: "guard", x: 40, adj: { blade: 10, arm: -5 } });
  const bare = { adj: "junk" };
  setJoint(bare, "lean", 3);
  assert.deepEqual(bare, { adj: { lean: 3 } });
});

test("picking a pose or resetting drops the step's adjustments, and keeps its position", () => {
  const picked = { pose: "guard", x: 50, adj: { arm: 1 } };
  setPose(picked, "parry5");
  assert.deepEqual(picked, { pose: "parry5", x: 50 });
  const reset = { pose: "guard", x: 50, adj: { arm: 1 } };
  clearAdjustments(reset);
  assert.deepEqual(reset, { pose: "guard", x: 50 });
});

test("the name, event, reference and note come first in the text, then the camera and solo", () => {
  const phrase = { steps: [{ label: "Only" }], extra: 1, solo: true, note: "n", camera: 5, reference: "r", name: "N", event: "e" };
  assert.deepEqual(
    phraseToText(phrase).split("\n").slice(1, 8).map((line) => line.trim().split(":")[0]),
    ['"name"', '"event"', '"reference"', '"note"', '"camera"', '"solo"', '"extra"'],
  );
  assert.deepEqual(parsePhrase(phraseToText(phrase)), phrase, "the order is only how it is shown");
});

test("a new scene is a valid phrase: one step, both fencers in guard, no pose the library lacks", () => {
  const phrase = newPhrase();
  assert.deepEqual(parsePhrase(phraseToText(phrase)), phrase);
  const timeline = buildTimeline(phrase);
  assert.equal(timeline.steps.length, 1);
  assert.deepEqual(timeline.unknown, []);
  assert.deepEqual(timeline.steps[0].A, { ...POSES.guard, x: 0 });
  assert.deepEqual(timeline.steps[0].B, { ...POSES.guard, x: 310 });
  assert.notEqual(newPhrase().steps[0].A, phrase.steps[0].A, "each one is its own copy");
});

test("text keys are set, and removed by empty text or only spaces, and no other key is touched", () => {
  const phrase = { name: "Old", steps: [{}] };
  const before = clone(phrase);
  assert.deepEqual(setMeta(phrase, "event", "Club night").event, "Club night");
  assert.equal(setMeta(phrase, "name", "").name, undefined);
  assert.equal("name" in setMeta(phrase, "name", "   "), false);
  assert.equal("note" in setMeta(phrase, "note", undefined), false);
  assert.equal(setMeta(phrase, "name", "Budapest ").name, "Budapest ", "a space typed at the end is kept");
  assert.deepEqual(phrase, before, "the original phrase is left alone");
  for (const key of ["steps", "camera", "solo", "__proto__", "constructor"]) assert.equal(setMeta(phrase, key, "x"), null, key);
  assert.deepEqual(TEXT_KEYS, ["name", "event", "reference", "note"]);
});

test("solo is switched on and off, and nothing else changes", () => {
  const phrase = { camera: 12, steps: [{ A: { pose: "guard" } }] };
  assert.deepEqual(setSolo(phrase, true), { ...phrase, solo: true });
  assert.deepEqual(setSolo(setSolo(phrase, true), false), phrase);
  assert.deepEqual(phrase, { camera: 12, steps: [{ A: { pose: "guard" } }] });
});

// What a step shows is its fencers' whole poses, whether it says so or inherits them.
const shown = (phrase) => buildTimeline(phrase).steps.map((step) => [step.A, step.B]);

// The built-in scenes never need a step to lean on the one before for a pose it
// was given there, so this one does: B is set in steps 2 and 4, A in 1 and 3.
const LEANING = {
  name: "Leaning",
  steps: [
    { A: { pose: "guard", x: -30 }, B: { pose: "guard", x: 200 } },
    { ms: 100, B: { pose: "parry3", x: 200 } },
    { ms: 100, A: { pose: "lungeChest", x: 0 } },
    { ms: 100, B: { pose: "riposte", x: 220 } },
    { ms: 100 },
  ],
};
const SCENES = [...PRESETS.map(({ phrase }) => phrase), LEANING];

test("a step added after step i stands as step i does, so nothing else on the page changes", () => {
  for (const phrase of SCENES) {
    const timeline = buildTimeline(phrase);
    for (let i = 0; i < phrase.steps.length; i++) {
      const added = insertStep(phrase, timeline, i);
      assert.equal(added.index, i + 1);
      const after = shown(added.phrase);
      const before = shown(phrase);
      assert.equal(after.length, before.length + 1);
      assert.deepEqual(after.slice(0, i + 1), before.slice(0, i + 1), `${phrase.name}, after step ${i + 1}`);
      assert.deepEqual(after[i + 1], before[i], "the new step is a copy of the one it follows");
      assert.deepEqual(after.slice(i + 2), before.slice(i + 1), `${phrase.name}, steps after it`);
    }
  }
});

test("a new step moves quickly and holds briefly, has no label, and takes both fencers unless the scene is solo", () => {
  const phrase = newPhrase();
  const added = insertStep(phrase, buildTimeline(phrase), 0).phrase.steps[1];
  assert.deepEqual(added, { ms: 300, hold: 200, A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 310 } });
  const solo = setSolo(phrase, true);
  assert.deepEqual(Object.keys(insertStep(solo, buildTimeline(solo), 0).phrase.steps[1]), ["ms", "hold", "A"]);
  const copy = insertStep(phrase, buildTimeline(phrase), 0).phrase;
  copy.steps[1].A.x = 99;
  assert.equal(phrase.steps[0].A.x, 0, "the copy shares nothing with the phrase");
});

test("a step cannot be added after one the phrase does not have", () => {
  const phrase = newPhrase();
  const timeline = buildTimeline(phrase);
  for (const index of [-1, 1, 0.5, NaN, undefined]) assert.equal(insertStep(phrase, timeline, index), null, String(index));
  assert.equal(insertStep({ steps: [] }, buildTimeline({ steps: [] }), 0), null);
});

test("taking out a step leaves every other as it was, even one that only inherited its poses from it", () => {
  for (const phrase of SCENES) {
    const before = shown(phrase);
    const timeline = buildTimeline(phrase);
    for (let i = 0; i < phrase.steps.length; i++) {
      const removed = removeStep(phrase, timeline, i);
      assert.deepEqual(shown(removed), [...before.slice(0, i), ...before.slice(i + 1)], `${phrase.name}, without step ${i + 1}`);
    }
  }
});

test("taking out a step copies poses onto the next one only where it needs them", () => {
  const phrase = {
    steps: [
      { A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } },
      { ms: 100, A: { pose: "lungeChest", x: 0 }, B: { pose: "parry3", x: 245 } },
      { ms: 100, A: { pose: "guard", x: 0 } },
      { ms: 100, A: { pose: "prep", x: 0 } },
    ],
  };
  const timeline = buildTimeline(phrase);
  // Step 3 leaned on step 2 for B, so it takes B with it; its A is its own.
  assert.deepEqual(removeStep(phrase, timeline, 1).steps[1], { ms: 100, A: { pose: "guard", x: 0 }, B: { pose: "parry3", x: 245 } });
  // Step 4 inherits B from step 3, which is untouched, and A is its own: no copies.
  assert.deepEqual(removeStep(phrase, timeline, 2).steps[2], phrase.steps[3]);
  // Where the step before shows what the removed one did, there is nothing to copy.
  const plain = { steps: [{ A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } }, { ms: 50, A: { pose: "prep", x: 0 } }, { ms: 50, A: { pose: "guard", x: 0 } }] };
  assert.deepEqual(removeStep(plain, buildTimeline(plain), 1).steps[1], plain.steps[2]);
  assert.deepEqual(phrase, clone(phrase), "the original phrase is left alone");
});

test("taking out the first step makes the next the start, with the poses the first had", () => {
  const phrase = {
    steps: [
      { label: "First", A: { pose: "guard", x: -30 }, B: { pose: "guard", x: 200 } },
      { label: "Second", ms: 100, A: { pose: "prep", x: -30 } },
    ],
  };
  const removed = removeStep(phrase, buildTimeline(phrase), 0);
  assert.deepEqual(removed.steps, [{ label: "Second", ms: 100, A: { pose: "prep", x: -30 }, B: { pose: "guard", x: 200 } }]);
  // A start that is what every phrase starts as needs nothing copied, solo or not.
  const solo = { solo: true, steps: [{ A: { pose: "guard", x: 0 } }, { ms: 50, A: { pose: "prep", x: 0 } }] };
  assert.deepEqual(removeStep(solo, buildTimeline(solo), 0).steps, [{ ms: 50, A: { pose: "prep", x: 0 } }]);
});

test("the only step cannot be taken out, nor one that is not there", () => {
  const phrase = newPhrase();
  assert.equal(removeStep(phrase, buildTimeline(phrase), 0), null);
  const two = insertStep(phrase, buildTimeline(phrase), 0).phrase;
  for (const index of [-1, 2, 0.5]) assert.equal(removeStep(two, buildTimeline(two), index), null, String(index));
});

test("a step's label, timing and ease are set, and removed by empty text; the step keeps its keys in order", () => {
  const phrase = { steps: [{ A: { pose: "guard" }, hold: 5 }, { ease: "snap", ms: 90, label: "Two" }] };
  const before = clone(phrase);
  let next = setStepField(phrase, 0, "label", "En garde");
  next = setStepField(next, 0, "ms", "120");
  next = setStepField(next, 0, "ease", "linear");
  assert.deepEqual(Object.keys(next.steps[0]), ["label", "ms", "hold", "ease", "A"]);
  assert.deepEqual(next.steps[0], { label: "En garde", ms: 120, hold: 5, ease: "linear", A: { pose: "guard" } });
  next = setStepField(next, 0, "label", "  ");
  next = setStepField(next, 0, "hold", "");
  next = setStepField(next, 0, "ease", "smooth");
  assert.deepEqual(next.steps[0], { ms: 120, A: { pose: "guard" } });
  assert.deepEqual(setStepField(phrase, 1, "ease", "").steps[1], { ms: 90, label: "Two" });
  assert.deepEqual(phrase, before, "the original phrase is left alone");
});

test("times are whole milliseconds, no longer than the page allows, and a time that is not one changes nothing", () => {
  const phrase = { steps: [{}, {}] };
  assert.equal(setStepField(phrase, 1, "ms", "250.6").steps[1].ms, 251);
  assert.equal(setStepField(phrase, 1, "hold", "0").steps[1].hold, 0);
  assert.equal(setStepField(phrase, 1, "hold", 1e9).steps[1].hold, MAX_STEP_MS);
  assert.equal(setStepField(phrase, 1, "ms", "1e3").steps[1].ms, 1000);
  for (const bad of ["-5", "soon", "Infinity", "NaN"]) assert.equal(setStepField(phrase, 1, "ms", bad), null, bad);
});

test("a setting that is not a step's, and a step that is not there, change nothing", () => {
  const phrase = { steps: [{}] };
  for (const key of ["A", "steps", "__proto__", "x"]) assert.equal(setStepField(phrase, 0, key, "1"), null, key);
  for (const index of [-1, 1, 0.5]) assert.equal(setStepField(phrase, index, "label", "x"), null, String(index));
  assert.equal(setStepField({ steps: {} }, 0, "label", "x"), null);
  assert.deepEqual(setStepField({ steps: [7] }, 0, "label", "x").steps, [{ label: "x" }], "a step that is not an object becomes one");
});

test("text is cut to the limit with an ellipsis, and never in the middle of a character", () => {
  assert.equal(clip("short", 10), "short");
  assert.equal(clip("exactly ten", 11), "exactly ten", "as long as it may be is not cut");
  assert.equal(clip("abcdefghij", 5), "abcd…");
  assert.equal(clip("abcdefghij", 5).length, 5, "the ellipsis counts");
  assert.equal(clip("ab😀cd", 4), "ab…", "a character of two code units is kept whole or not at all");
  assert.equal(clip("ab😀cd", 5), "ab😀…");
  assert.equal(clip("W".repeat(30000), TEXT_LIMITS.name).length, TEXT_LIMITS.name);
  assert.equal(clip("anything", 1), "…");
});

test("each kind of text has a limit, and the fields on the page hold to the same ones", () => {
  assert.deepEqual(TEXT_LIMITS, { name: 100, event: 160, reference: 2000, note: 1000, label: 100 });
  for (const key of TEXT_KEYS) assert.ok(Number.isInteger(TEXT_LIMITS[key]) && TEXT_LIMITS[key] > 0, key);
});

test("a step's label is shown no longer than the limit, and the phrase keeps what was written", () => {
  const long = "Q".repeat(5000);
  const phrase = { steps: [{ label: long }, { label: "x".repeat(TEXT_LIMITS.label) }, { label: "Short" }, {}] };
  const labels = buildTimeline(phrase).steps.map((step) => step.label);
  assert.equal(labels[0], `${"Q".repeat(TEXT_LIMITS.label - 1)}…`);
  assert.equal(labels[1], "x".repeat(TEXT_LIMITS.label), "one as long as it may be is not cut");
  assert.deepEqual(labels.slice(2), ["Short", "Step 4"]);
  assert.equal(phrase.steps[0].label, long, "the data is not changed");
});
