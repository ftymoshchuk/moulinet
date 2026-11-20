import assert from "node:assert/strict";
import { test } from "node:test";

import { BASES, BASE_CAMERA, BASE_GROUPS, BASE_SECTIONS, BASE_X, basePhrase, basesOf } from "../site/js/bases.js";
import { CAMERA_LIMIT } from "../site/js/figure.js";
import { POSES, POSE_NAMES, PRESETS, SECTIONS } from "../site/js/library.js";
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
  assert.ok(Math.abs(BASE_CAMERA) <= CAMERA_LIMIT);
  assert.equal(basePhrase().camera, BASE_CAMERA);
});

test("the base postures are kept in the sections of the page, each with groups, an introduction and postures of its own", () => {
  assert.deepEqual(Object.keys(BASE_SECTIONS), SECTIONS.map(({ id }) => id), "a list of postures for each section, in the order of the tabs");
  const seen = [];
  for (const [id, { groups, intro }] of Object.entries(BASE_SECTIONS)) {
    assert.ok(groups.length > 0, `${id} has groups`);
    assert.ok(intro.endsWith("."), `${id} has an introduction`);
    for (const group of groups) {
      assert.ok(!seen.includes(group), `${group} is in one section only`);
      seen.push(group);
    }
    assert.ok(basesOf(id).length > 0, `${id} has postures`);
  }
  assert.deepEqual(BASE_GROUPS, seen);
});

test("the sections share the postures out between them, in order, so every posture is in one section and each section's numbers climb from 1", () => {
  assert.deepEqual(SECTIONS.flatMap(({ id }) => basesOf(id)), BASES);
  for (const { id } of SECTIONS) {
    for (const base of basesOf(id)) assert.ok(BASE_SECTIONS[id].groups.includes(base.group), `${base.pose} is in ${id}`);
  }
});

test("each section's postures make a phrase of their own, and with no section named the phrase has them all", () => {
  for (const { id } of SECTIONS) {
    const phrase = basePhrase(id);
    assert.deepEqual(
      phrase.steps.map((step) => step.A.pose),
      basesOf(id).map(({ pose }) => pose),
    );
    const timeline = buildTimeline(phrase);
    assert.equal(timeline.solo, true);
    assert.deepEqual(timeline.unknown, []);
    assert.equal(phrase.camera, BASE_CAMERA);
  }
  assert.equal(basePhrase().steps.length, BASES.length);
  assert.notEqual(basePhrase("live"), basePhrase("live"), "each call is a phrase of its own");
});

test("every built-in scene belongs to a section of the page, and the page opens on a section that has scenes", () => {
  const ids = SECTIONS.map(({ id }) => id);
  for (const { id, section } of PRESETS) assert.ok(ids.includes(section), `${id}: section ${section}`);
  assert.ok(PRESETS.some(({ section }) => section === ids[0]), "the first section has scenes, for the page to open on");
});
