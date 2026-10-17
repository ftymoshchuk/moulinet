import assert from "node:assert/strict";
import { test } from "node:test";

import { basePhrase } from "../site/js/bases.js";
import { DEFAULT_FRAME, PIVOT, bladePaths, bladeTip, floorPath, frameOf, inkFigure, knee, projector, skeleton, stickFigure } from "../site/js/figure.js";
import { area } from "../site/js/ink.js";
import { POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, poseAt, resolvePose } from "../site/js/phrase.js";
import { allPaths, readPath } from "./path-data.js";

const BAD_NUMBER = /NaN|Infinity|undefined/;

test("every phrase and every base posture draws clean paths at every moment, from every camera angle", () => {
  for (const phrase of [...PRESETS.map((preset) => preset.phrase), basePhrase()]) {
    const timeline = buildTimeline(phrase);
    for (const camera of [-60, -25, 0, 28, 60]) {
      for (let t = 0; t <= timeline.duration; t += 37) {
        const { A, B } = poseAt(timeline, t);
        const drawn = [
          inkFigure(A, 1, camera, { backView: true }),
          inkFigure(B, -1, camera, { older: true }),
          stickFigure(A, 1, camera),
          stickFigure(B, -1, camera),
        ];
        for (const d of drawn.flatMap((figure) => allPaths(figure))) {
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
    assert.match(figure[layer].k, /^M.*z$/, layer);
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
    assert.ok(Math.abs(Math.hypot(x - J.hn[0], y - J.hn[1], z - J.hn[2]) - 88) < 1e-9, name);
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

test("a shape worked out as the camera sees it is set across the page and up, and the projector knows its camera", () => {
  for (const camera of [-60, 0, 25, 60]) {
    const c = Math.cos((camera * Math.PI) / 180);
    for (const dir of [1, -1]) {
      const W = projector({ x: 140 }, dir, camera);
      assert.equal(W.camera, camera);
      const [x, y] = W.flat([20, 35]);
      assert.ok(Math.abs(x - ((140 - PIVOT) * c + PIVOT + dir * 20)) < 1e-9, `across, facing ${dir} from ${camera}°`);
      assert.equal(y, -35);
    }
  }
});

test("the shoulders turn toward the camera by the pose's turn: the two arms lie in planes either side of the body", () => {
  const side = skeleton(resolvePose({ pose: "guard", adj: { turn: 0 } }));
  const turned = skeleton(resolvePose({ pose: "guard", adj: { turn: 58 } }));
  assert.ok(Math.abs(side.sh[2] + 19) < 1e-9 && Math.abs(side.rs[2] - 19) < 1e-9, "side on, a shoulder's width either side");
  assert.ok(Math.abs(turned.sh[2] + 19 * Math.cos((58 * Math.PI) / 180)) < 1e-9, "turned, nearer the line of sight");
  assert.ok(Math.abs(turned.rs[2] + turned.sh[2]) < 1e-9, "evenly either side");
  assert.ok(turned.sh[0] !== side.sh[0] || turned.rs[0] !== side.rs[0], "and the rear shoulder is set back");
  assert.ok(Math.abs(turned.rs[0] - turned.T(48, 0)[0]) > 5, "well behind the spine");
});

test("the stage looks where the fencers are: everyone, at every step, is in a frame the shape of the page", () => {
  const shape = DEFAULT_FRAME[2] / DEFAULT_FRAME[3];
  for (const phrase of [...PRESETS.map((preset) => preset.phrase), basePhrase()]) {
    const timeline = buildTimeline(phrase);
    const [x, y, w, h] = frameOf(timeline);
    assert.ok(Math.abs(w / h - shape) < 0.01, `${phrase.name} is in the shape of the page`);
    assert.ok(w >= DEFAULT_FRAME[2] * 0.72 - 0.1 && w <= DEFAULT_FRAME[2] * 1.3 + 0.1, `${phrase.name} is no closer than a third of the way in, nor further than a third out (${w})`);
    assert.ok(y < 0 && y + h > 8, "the floor is in it, with room under it for the strokes at the feet");
    for (const step of timeline.steps) {
      for (const [who, dir] of timeline.solo ? [["A", 1]] : [["A", 1], ["B", -1]]) {
        const J = skeleton(step[who]);
        const W = projector(step[who], dir, 0);
        for (const [name, q] of Object.entries({ head: J.hd, hand: J.hn, tip: J.tip, back: J.ankB, front: J.ankF })) {
          const [px, py] = W(q);
          assert.ok(px >= x && px <= x + w && py >= y && py <= y + h, `${phrase.name}: ${who}'s ${name} is on the stage`);
        }
      }
    }
  }
});

test("a lone fencer is looked at closer than a pair, and the frame is worked out from the phrase alone", () => {
  const lone = frameOf(buildTimeline({ solo: true, steps: [{ A: { pose: "guard", x: 40 } }] }));
  const pair = frameOf(buildTimeline({ steps: [{ A: { pose: "lungeChest", x: 0 }, B: { pose: "parry3", x: 245 } }] }));
  assert.ok(lone[2] < pair[2], `${lone[2]} is closer than ${pair[2]}`);
  assert.deepEqual(frameOf(buildTimeline({ solo: true, steps: [{ A: { pose: "guard", x: 40 } }] })), lone);
  // Where the fencers stand moves the frame across, and does not zoom it.
  const moved = frameOf(buildTimeline({ solo: true, steps: [{ A: { pose: "guard", x: 340 } }] }));
  assert.ok(Math.abs(moved[2] - lone[2]) < 1e-9 && Math.abs(moved[3] - lone[3]) < 1e-9);
  assert.ok(Math.abs(moved[0] - lone[0] - 300) < 0.2, "moved with him");
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

test("the shapes of a figure are wound one way and its strokes another, so shapes merge and strokes stay solid", () => {
  for (const [dir, options] of [[1, { backView: true }], [-1, { older: true }], [1, {}], [-1, {}]]) {
    for (const name of ["guard", "lungeChest", "parry5"]) {
      const figure = inkFigure(resolvePose({ pose: name }), dir, 25, options);
      const where = `${name}, facing ${dir}, ${JSON.stringify(options)}`;
      const shapes = [figure.l1.g, figure.l2.g, figure.l3.g, figure.l4.g, figure.l6.g, figure.head.g, figure.head.hair].flatMap(readPath);
      assert.ok(shapes.length > 10);
      assert.ok(shapes.every((shape) => shape.closed && area(shape.points) > 0), `silhouettes, ${where}`);
      for (const layer of [figure.l1.k, figure.l2.k, figure.l3.k, figure.l4.k, figure.l6.k, figure.head.k, figure.head.s, figure.ground]) {
        const ways = new Set(readPath(layer).map((stroke) => Math.sign(area(stroke.points))));
        assert.equal(ways.size, 1, `strokes, ${where}`);
        assert.ok(!ways.has(0));
      }
    }
  }
});

test("a pose is drawn once for a view, and when drawn again for another it comes out the same", () => {
  const pose = resolvePose({ pose: "guard" });
  const first = inkFigure(pose, 1, 0);
  assert.equal(inkFigure(pose, 1, 0), first, "held, it is the same drawing");
  for (const [dir, camera, options] of [[1, 30, {}], [-1, 0, {}], [1, 0, { backView: true }], [1, 0, { older: true }]]) {
    const other = inkFigure(pose, dir, camera, options);
    assert.notEqual(other, first, `facing ${dir} from ${camera}° ${JSON.stringify(options)} is a new drawing`);
    assert.equal(inkFigure(pose, dir, camera, options), other, "and that one is held");
  }
  assert.deepEqual(inkFigure(pose, 1, 0), first, "nothing in a drawing is left to chance");
  assert.deepEqual(inkFigure(resolvePose({ pose: "guard" }), 1, 0), first, "nor to which pose object it was made from");
});

test("a pose held on a step is one drawing, however long the step lasts", () => {
  const timeline = buildTimeline(PRESETS[0].phrase);
  const early = poseAt(timeline, 100).A;
  const late = poseAt(timeline, 500).A;
  assert.equal(inkFigure(early, 1, 0), inkFigure(late, 1, 0));
  const moving = poseAt(timeline, timeline.steps[1].start + 40).A;
  assert.notEqual(inkFigure(moving, 1, 0), inkFigure(late, 1, 0));
});

test("a figure's path data stays small enough to draw again on every frame", () => {
  let largest = 0;
  for (const name of Object.keys(POSES)) {
    for (const camera of [-60, -30, 0, 30, 60]) {
      for (const [dir, options] of [[1, { backView: true }], [-1, { older: true }], [1, {}], [-1, {}]]) {
        const size = allPaths(inkFigure(resolvePose({ pose: name }), dir, camera, options)).reduce((sum, d) => sum + d.length, 0);
        largest = Math.max(largest, size);
        assert.ok(size < 30000, `${name} from ${camera}° is ${size} characters`);
      }
    }
  }
  assert.ok(largest > 8000, "and it is a drawing, not an outline");
});
