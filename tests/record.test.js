import assert from "node:assert/strict";
import { test } from "node:test";

import { HANDLES } from "../site/js/handles.js";
import { MAX_STEP_MS, buildTimeline, insertStep, newPhrase, setStepField } from "../site/js/phrase.js";
import { MOVE_MS, PAUSE_MAX_MS, milestoneLabel, moveTime, pauseTime, recordNote } from "../site/js/record.js";

test("how long a drag took is a move of whole tens of milliseconds, never shorter or longer than a move is worth giving", () => {
  assert.equal(moveTime(412), 410);
  assert.equal(moveTime(415), 420);
  assert.equal(moveTime(1234.5), 1230);
  // A drag that made no time, or went backward in time, still moves; one that was left held for a minute does not take one.
  assert.equal(moveTime(0), MOVE_MS.min);
  assert.equal(moveTime(-30), MOVE_MS.min);
  assert.equal(moveTime(40), MOVE_MS.min);
  assert.equal(moveTime(60_000), MOVE_MS.max);
  for (const bad of [NaN, Infinity, undefined, null, "soon"]) assert.ok(moveTime(bad) >= MOVE_MS.min && moveTime(bad) <= MOVE_MS.max, `${bad}`);
  // Every value it gives is one a step takes as it is, within what the step's field allows.
  assert.ok(MOVE_MS.min >= 0 && MOVE_MS.max <= MAX_STEP_MS);
  const timeline = buildTimeline(newPhrase());
  for (const took of [0, 37, 250, 999, 4999, 5001, 99_999]) {
    const set = setStepField(newPhrase(), 0, "ms", moveTime(took));
    assert.equal(set.steps[0].ms, moveTime(took), `${took}`);
    assert.ok(timeline.steps.length === 1);
  }
});

test("the pause before a drag is the hold on the milestone before, in whole tens, and not kept for longer than it is worth", () => {
  assert.equal(pauseTime(0), 0);
  assert.equal(pauseTime(733), 730);
  assert.equal(pauseTime(1999), 2000);
  assert.equal(pauseTime(PAUSE_MAX_MS + 1), PAUSE_MAX_MS);
  assert.equal(pauseTime(120_000), PAUSE_MAX_MS, "a stop to think is not a hold of two minutes");
  assert.equal(pauseTime(-50), 0);
  for (const bad of [NaN, Infinity, undefined, null, "soon"]) assert.ok(pauseTime(bad) >= 0 && pauseTime(bad) <= PAUSE_MAX_MS, `${bad}`);
  assert.ok(PAUSE_MAX_MS <= MAX_STEP_MS);
});

test("a milestone is named for who moved what, in the words the part has", () => {
  assert.equal(milestoneLabel("A", "sword hand"), "A moves the sword hand");
  assert.equal(milestoneLabel("B", "blade tip"), "B moves the blade tip");
  // Every part reads as a name that fits it, and the label fits in a step's label.
  for (const part of HANDLES) {
    const label = milestoneLabel("A", part.name);
    assert.match(label, /^A moves the [a-z ]+$/, label);
    assert.ok(label.length <= 100);
  }
  // The label is what a step says of itself: a milestone put after a step, and named.
  const added = insertStep(newPhrase(), buildTimeline(newPhrase()), 0);
  const named = setStepField(added.phrase, added.index, "label", milestoneLabel("A", "sword hand"));
  assert.equal(named.steps[1].label, "A moves the sword hand");
});

test("the note under the stage says how to record, how far it has got, and why nothing is recorded when no part can be taken", () => {
  assert.match(recordNote({ ready: true, count: 0 }), /^Recording: drag a part of a fencer and let go, and that is a milestone/);
  assert.match(recordNote({ ready: true, count: 0 }), /Press Record again to stop\.$/);
  assert.match(recordNote({ ready: true, count: 1 }), /^Recording: 1 milestone so far\./);
  assert.match(recordNote({ ready: true, count: 2 }), /^Recording: 2 milestones so far\./);
  assert.match(recordNote({ ready: true, count: 12 }), /12 milestones/);
  assert.match(recordNote({ ready: false, count: 3 }), /turn on Drag dots, or pause on a step/);
  assert.doesNotMatch(recordNote({ ready: false, count: 3 }), /milestones so far/);
});
