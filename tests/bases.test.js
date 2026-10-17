import assert from "node:assert/strict";
import { test } from "node:test";

import { BASES, BASE_CAMERA, BASE_GROUPS, BASE_X, basePhrase } from "../site/js/bases.js";
import { POSES, POSE_NAMES } from "../site/js/library.js";
import { buildTimeline, parsePhrase, phraseToText, poseAt } from "../site/js/phrase.js";

test("every pose in the library is a base posture, once, and no posture is a pose the library lacks", () => {
  const poses = BASES.map(({ pose }) => pose);
  assert.equal(new Set(poses).size, poses.length, "no posture twice");
  assert.deepEqual(poses.toSorted(), Object.keys(POSES).toSorted());
  for (const pose of poses) assert.ok(POSE_NAMES[pose], `${pose} has a name`);
});

test("each posture is described: what it is, and three or more parts worth looking at", () => {
  for (const { pose, group, text, points } of BASES) {
    assert.ok(BASE_GROUPS.includes(group), `${pose}: group ${group}`);
    assert.ok(text.length > 40 && text.endsWith("."), `${pose}: its text is a sentence or two`);
    assert.ok(points.length >= 3, `${pose}: only ${points.length} points`);
    for (const [what, how] of points) {
      assert.ok(what && how.endsWith("."), `${pose}: ${what}`);
      assert.doesNotMatch(`${what} ${how}`, /[<>]/, `${pose}: markup in a description`);
    }
    assert.equal(new Set(points.map(([what]) => what)).size, points.length, `${pose}: a part named twice`);
  }
});

test("the postures run group by group, in the order of the groups, so the numbers on the page climb", () => {
  const order = BASES.map(({ group }) => BASE_GROUPS.indexOf(group));
  assert.deepEqual(order, order.toSorted((a, b) => a - b));
  for (const group of BASE_GROUPS) assert.ok(BASES.some((base) => base.group === group), `${group} is empty`);
});

test("the postures make a phrase for one fencer, a step each, that stands in the same place every time", () => {
  const phrase = basePhrase();
  const timeline = buildTimeline(phrase);
  assert.equal(timeline.solo, true);
  assert.deepEqual(timeline.unknown, []);
  assert.deepEqual(
    timeline.steps.map((step) => step.label),
    BASES.map(({ pose }) => POSE_NAMES[pose]),
  );
  assert.deepEqual(
    phrase.steps.map((step) => step.A),
    BASES.map(({ pose }) => ({ pose, x: BASE_X })),
  );
  assert.ok(phrase.steps.every((step) => !("B" in step)), "nobody else is on stage");
  assert.deepEqual(parsePhrase(phraseToText(phrase)), phrase);
  assert.notEqual(basePhrase(), basePhrase(), "each call is a phrase of its own");
});

test("each posture has a moment of its own, so the stage can rest on any of them", () => {
  const timeline = buildTimeline(basePhrase());
  timeline.steps.forEach((step, i) => {
    assert.equal(poseAt(timeline, step.holdStart).index, i);
    assert.equal(poseAt(timeline, step.holdStart).A, step.A);
  });
  assert.ok(new Set(timeline.steps.map((step) => step.holdStart)).size === timeline.steps.length);
});

test("the camera for the postures is within the range the slider has", () => {
  assert.ok(Math.abs(BASE_CAMERA) <= 60);
  assert.equal(basePhrase().camera, BASE_CAMERA);
});
