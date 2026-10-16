import assert from "node:assert/strict";
import { test } from "node:test";

import { PIVOT, bladePaths, bladeTip, floorPath, inkFigure, knee, projector, skeleton, stickFigure } from "../site/js/figure.js";
import { PRESETS } from "../site/js/library.js";
import { buildTimeline, poseAt, resolvePose } from "../site/js/phrase.js";

const BAD_NUMBER = /NaN|Infinity|undefined/;

function pathsOf(figure) {
  const out = [];
  const walk = (value) => {
    if (typeof value === "string") out.push(value);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(figure);
  return out;
}

test("every phrase draws clean paths at every moment, from every camera angle", () => {
  for (const { phrase } of PRESETS) {
    const timeline = buildTimeline(phrase);
    for (const camera of [-60, -25, 0, 28, 60]) {
      for (let t = 0; t <= timeline.duration; t += 37) {
        const { A, B } = poseAt(timeline, t);
        const drawn = [
          inkFigure(A, 1, camera, { backView: true }),
          inkFigure(B, -1, camera, { bald: true }),
          stickFigure(A, 1, camera),
          stickFigure(B, -1, camera),
        ];
        for (const d of drawn.flatMap(pathsOf)) {
          assert.doesNotMatch(d, BAD_NUMBER, `${phrase.name} at ${t} ms, camera ${camera}`);
        }
      }
    }
  }
});

test("an ink figure has every layer, each with a silhouette and detail lines", () => {
  const figure = inkFigure(resolvePose({ pose: "guard" }), 1, 0);
  for (const layer of ["l1", "l2", "l3", "l4", "l6"]) {
    assert.match(figure[layer].g, /^M.*Z$/, layer);
    assert.match(figure[layer].d, /^M/, layer);
  }
  assert.match(figure.head.g, /^M.*Z$/);
  assert.match(figure.head.hair, /^M.*Z$/);
  assert.match(figure.blade.k, /^M.*Z$/);
  assert.match(figure.blade.g, /^M.*Z$/);
  assert.match(figure.blade.d, /^M/);
  assert.match(figure.ground, /^M/, "both feet are planted in guard");
});

test("the sword arm is drawn behind the body from the back, in front of it otherwise", () => {
  const pose = resolvePose({ pose: "guard" });
  const back = inkFigure(pose, 1, 0, { backView: true });
  const front = inkFigure(pose, 1, 0);
  assert.equal(back.l1.g, front.l6.g);
  assert.equal(back.l6.g, front.l1.g);
});

test("a foot lifted clear of the floor leaves no hatching", () => {
  const planted = inkFigure(resolvePose({ pose: "guard" }), 1, 0).ground;
  const lifted = inkFigure(resolvePose({ pose: "guard", adj: { liftF: 20, liftB: 20 } }), 1, 0).ground;
  assert.equal((planted.match(/M/g) || []).length, 6);
  assert.equal(lifted, "");
});

test("the knee keeps thigh and shin lengths and bends forward", () => {
  const [kx, ky] = knee(33, 84, 68, 8);
  assert.ok(Math.abs(Math.hypot(kx - 33, ky - 84) - 44) < 1e-9);
  assert.ok(Math.abs(Math.hypot(kx - 68, ky - 8) - 46) < 1e-9);
  // Forward of the straight line from hip to ankle.
  const side = (68 - 33) * (ky - 84) - (8 - 84) * (kx - 33);
  assert.ok(side > 0);
});

test("a leg too short to reach the foot goes straight toward it", () => {
  const [kx, ky] = knee(0, 200, 0, 8);
  assert.ok(Math.abs(kx) < 1e-9);
  assert.ok(Math.abs(ky - (200 - 44 * (192 / 90))) < 1e-9);
});

test("the blade tip is 88 cm from the hand", () => {
  for (const name of ["guard", "parry5", "riposte"]) {
    const J = skeleton(resolvePose({ pose: name }));
    const [x, y, z] = J.tip;
    assert.ok(Math.abs(Math.hypot(x - J.hn[0], y - J.hn[1], z) - 88) < 1e-9, name);
  }
});

test("seen square on, a fencer facing left mirrors one facing right", () => {
  const pose = { x: 100 };
  assert.deepEqual(projector(pose, 1, 0)([10, 20, 5]), [110, -20]);
  assert.deepEqual(projector(pose, -1, 0)([10, 20, 5]), [90, -20]);
});

test("turning the camera swings the piste around the pivot and brings depth into view", () => {
  const atPivot = projector({ x: PIVOT }, 1, 90)([0, 0, 10]);
  assert.ok(Math.abs(atPivot[0] - (PIVOT + 10)) < 1e-9);
  const farAlong = projector({ x: PIVOT + 100 }, 1, 60)([0, 0, 0]);
  assert.ok(Math.abs(farAlong[0] - (PIVOT + 50)) < 1e-9);
});

test("the floor has a tick every 50 cm, and a longer one at the centre", () => {
  const d = floorPath(0);
  assert.ok(d.startsWith("M-600.0 0 H900.0"));
  assert.equal(d.match(/ V/g).length, 29);
  assert.ok(d.includes("M100.0 0 V6"));
  assert.ok(d.includes("M50.0 0 V3"));
  assert.ok(floorPath(60).startsWith("M-242.5 0 H507.5"));
});

test("blade paths sample the whole phrase about every 10 ms, at most 700 times", () => {
  const timeline = buildTimeline(PRESETS[0].phrase);
  const paths = bladePaths(timeline, 0);
  assert.equal(paths.times.length, 340);
  assert.equal(paths.times[0], 0);
  assert.equal(paths.times.at(-1), timeline.duration);
  assert.equal(paths.a[0], bladeTip(timeline.steps[0].A, 1, 0));
  assert.equal(paths.b.at(-1), bladeTip(timeline.steps.at(-1).B, -1, 0));

  const long = buildTimeline({ steps: [{ hold: 60000 }] });
  assert.equal(bladePaths(long, 0).times.length, 701);
});
