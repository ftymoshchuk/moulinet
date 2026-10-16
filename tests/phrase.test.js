import assert from "node:assert/strict";
import { test } from "node:test";

import { POSES, PRESETS } from "../site/js/library.js";
import {
  buildTimeline,
  clearAdjustments,
  clone,
  ease,
  editSpec,
  mixPoses,
  parsePhrase,
  phraseToText,
  poseAt,
  resolvePose,
  setJoint,
  setPose,
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

test("fencers start in guard, A at 0 and B at 245, until a phrase places them", () => {
  const [step] = buildTimeline({ steps: [{ label: "Nothing yet" }] }).steps;
  assert.deepEqual(step.A, { ...POSES.guard, x: 0 });
  assert.deepEqual(step.B, { ...POSES.guard, x: 245 });
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
