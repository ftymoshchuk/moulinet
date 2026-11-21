import assert from "node:assert/strict";
import { test } from "node:test";

import { projector, skeleton } from "../site/js/figure.js";
import { HANDLES, placeOf, shareOf, solve, stagePoint } from "../site/js/handles.js";
import { JOINTS, POSES, PRESETS } from "../site/js/library.js";
import { newPhrase, resolvePose } from "../site/js/phrase.js";

const handle = (id) => HANDLES.find((part) => part.id === id);
const LIMITS = Object.fromEntries(JOINTS.map(({ key, min, max }) => [key, { min, max }]));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// The camera the Creator looks from at the angle the slider starts at, and some others round the piste, none of them end on.
const CAMERAS = [180, 150, 210, 125, 235, 0, 30];
const FENCERS = [
  { who: "A", dir: 1, x: 0 },
  { who: "B", dir: -1, x: 310 },
];
// How far each joint is moved to make a place to take a part to: cm or degrees.
const MOVE = { x: 6, footF: 6, liftF: 6, hipX: 6, hipY: 6, lean: 10, arm: 10, fore: 10, blade: 10, rArm: 10, rFore: 10 };

test("every part is named, follows a point of the skeleton, and moves it with joints the sliders have", () => {
  assert.equal(new Set(HANDLES.map(({ id }) => id)).size, HANDLES.length, "each has its own id");
  const sliders = new Set(JOINTS.map(({ key }) => key));
  for (const part of HANDLES) {
    assert.ok(part.name && !part.name.includes("  "), `${part.id} has a name`);
    assert.ok(part.params.length >= 1 && part.params.length <= 2, `${part.id} has one or two joints`);
    for (const key of part.params) assert.ok(sliders.has(key), `${part.id}: ${key} has a slider, so a drag cannot make a value a person cannot see`);
    for (const name of Object.keys(POSES)) {
      const point = part.at(skeleton(resolvePose({ pose: name })));
      assert.ok(point.length >= 2 && point.slice(0, 3).every(Number.isFinite), `${part.id} in ${name}`);
    }
  }
  // Every joint a drag moves is one that a drag can move: the parts between them cover the foot, the hips, the head, the arms and the blade.
  assert.deepEqual([...new Set(HANDLES.flatMap(({ params }) => params))].toSorted(), ["arm", "blade", "footF", "fore", "hipX", "hipY", "lean", "liftF", "rArm", "rFore", "x"]);
});

test("a part taken to a place is put there, in every pose, from every side the camera can look from, for both fencers", () => {
  let tried = 0;
  for (const name of Object.keys(POSES)) {
    for (const { dir, x } of FENCERS) {
      const pose = resolvePose({ pose: name, x });
      for (const camera of CAMERAS) {
        for (const part of HANDLES) {
          for (const sign of [1, -1]) {
            // A place the part can be: where it goes with each of its joints moved.
            const moved = { ...pose };
            for (const key of part.params) {
              const by = key === "liftF" ? Math.abs(MOVE[key]) : sign * MOVE[key];
              moved[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, pose[key] + by));
            }
            const target = placeOf(moved, dir, camera, part);
            const got = solve(pose, dir, camera, part, target);
            const after = placeOf({ ...pose, ...got }, dir, camera, part);
            // Whole numbers cost a little: half a degree of an 88 cm blade is 0.8 cm.
            assert.ok(distance(after, target) < 1.3, `${name}, fencer ${dir}, camera ${camera}, ${part.id}: ${distance(after, target).toFixed(2)} cm off`);
            tried++;
          }
        }
      }
    }
  }
  assert.ok(tried > 5000);
});

test("a drag gives whole numbers within the sliders' ranges for the part's own joints, and leaves the pose alone", () => {
  const pose = resolvePose({ pose: "parry5", x: 0 });
  const before = structuredClone(pose);
  for (const part of HANDLES) {
    const here = placeOf(pose, 1, 180, part);
    for (const target of [[here[0] + 500, here[1] - 500], [here[0] - 500, here[1] + 500], [here[0] + 3, here[1] - 2]]) {
      const got = solve(pose, 1, 180, part, target);
      assert.deepEqual(Object.keys(got), part.params, `${part.id}: only its own joints`);
      for (const [key, value] of Object.entries(got)) {
        assert.ok(Number.isInteger(value), `${part.id}: ${key} ${value} is a whole number`);
        assert.ok(value >= LIMITS[key].min && value <= LIMITS[key].max, `${part.id}: ${key} ${value} is within its slider`);
      }
    }
  }
  assert.deepEqual(pose, before, "the pose it was given is as it was");
});

test("a part taken where it already is stays", () => {
  // The guard's own numbers are whole, so they come back as they were.
  for (const { dir, x } of FENCERS) {
    const pose = resolvePose({ pose: "guard", x });
    for (const camera of CAMERAS) {
      for (const part of HANDLES) {
        const got = solve(pose, dir, camera, part, placeOf(pose, dir, camera, part));
        assert.deepEqual(got, Object.fromEntries(part.params.map((key) => [key, pose[key]])), `${part.id} at ${camera}`);
      }
    }
  }
});

test("a part taken further than it can go goes as far as it can, nearer than it was, and no joint goes past its slider", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  for (const part of HANDLES) {
    const here = placeOf(pose, 1, 180, part);
    const far = [here[0] + 400, here[1] - 400];
    const got = solve(pose, 1, 180, part, far);
    const after = placeOf({ ...pose, ...got }, 1, 180, part);
    assert.ok(distance(after, far) < distance(here, far) - 0.5, `${part.id} went toward it`);
  }
  // The hips taken off the top corner of the piste stop at the ends of their sliders.
  assert.deepEqual(solve(pose, 1, 180, handle("hips"), [-600, -600]), { hipX: LIMITS.hipX.max, hipY: LIMITS.hipY.max });
  assert.deepEqual(solve(pose, 1, 180, handle("hips"), [600, 600]), { hipX: LIMITS.hipX.min, hipY: LIMITS.hipY.min });
  // A foot cannot be taken below the floor.
  const foot = placeOf(pose, 1, 180, handle("frontFoot"));
  assert.equal(solve(pose, 1, 180, handle("frontFoot"), [foot[0], foot[1] + 50]).liftF, LIMITS.liftF.min);
});

test("a joint that goes all the way round is turned the short way past the end of its slider, not stopped there", () => {
  for (const [part, key] of [[handle("bladeTip"), "blade"], [handle("rearElbow"), "rArm"], [handle("rearHand"), "rFore"]]) {
    const pose = { ...resolvePose({ pose: "guard", x: 0 }), [key]: 170 };
    // Ten degrees past the end of the slider is 170 on the other side, which is where the part is going.
    const target = placeOf({ ...pose, [key]: 190 }, 1, 180, part);
    const got = solve(pose, 1, 180, part, target);
    assert.ok(Math.abs(got[key] - -170) <= 2, `${key} went round to ${got[key]}`);
    assert.ok(distance(placeOf({ ...pose, ...got }, 1, 180, part), target) < 1.3);
  }
});

test("seen end on, a part cannot be taken across the page, which is toward the camera, but can be taken up", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  const foot = placeOf(pose, 1, 90, handle("frontFoot"));
  // Taken across the page, it stays; taken up, it lifts.
  assert.equal(solve(pose, 1, 90, handle("frontFoot"), [foot[0] + 40, foot[1]]).footF, pose.footF);
  assert.ok(solve(pose, 1, 90, handle("frontFoot"), [foot[0], foot[1] - 12]).liftF > 5);
  // Nothing is ever far off in numbers either: a whole drag across the page at that angle moves a joint very little.
  for (const part of HANDLES) {
    const got = solve(pose, 1, 90, part, [placeOf(pose, 1, 90, part)[0] + 80, placeOf(pose, 1, 90, part)[1]]);
    for (const key of part.params) assert.ok(Math.abs(got[key] - pose[key]) <= 12, `${part.id} ${key} ${got[key]}`);
  }
});

test("dragging a little at a time follows the pointer, the way a mouse moves", () => {
  let pose = resolvePose({ pose: "guard", x: 0 });
  const part = handle("swordHand");
  const start = placeOf(pose, 1, 180, part);
  const grabbed = [];
  for (let i = 1; i <= 24; i++) {
    const target = [start[0] + i * 0.5, start[1] - i];
    pose = { ...pose, ...solve(pose, 1, 180, part, target) };
    const here = placeOf(pose, 1, 180, part);
    grabbed.push(distance(here, target));
  }
  assert.ok(Math.max(...grabbed) < 1.3, `the hand stays under the pointer: ${Math.max(...grabbed).toFixed(2)} cm off`);
  // The whole arm went with it: the hand is where the pointer is, up and across.
  const end = placeOf(pose, 1, 180, part);
  assert.ok(Math.abs(end[0] - (start[0] + 12)) < 1.3 && Math.abs(end[1] - (start[1] - 24)) < 1.3);
});

test("where the stage's box is on the page, and what share of it a point is, turn into each other, with the mirror", () => {
  const view = [-80, -236, 420, 254];
  const box = { left: 100, top: 50, width: 840, height: 508 };
  for (const mirrored of [false, true]) {
    for (const point of [[-80, -236], [340, 18], [130, -109], [0, 0], [-35.5, -200.25]]) {
      const [across, down] = shareOf(point, view);
      // Where that share of the box is on the page: turned across in a mirror.
      const client = [box.left + (mirrored ? 1 - across : across) * box.width, box.top + down * box.height];
      const back = stagePoint(client, box, view, mirrored);
      assert.ok(distance(back, point) < 1e-9, `${point} ${mirrored}`);
    }
  }
  assert.deepEqual(shareOf([-80, -236], view), [0, 0]);
  assert.deepEqual(shareOf([340, 18], view), [1, 1]);
  // The left of the box on the page is the right of the stage in a mirror.
  assert.deepEqual(stagePoint([100, 50], box, view, true), [340, -236]);
  assert.deepEqual(stagePoint([100, 50], box, view, false), [-80, -236]);
});

test("the position slider reaches every place a fencer starts in, so taking hold of one does not move it", () => {
  const { min, max } = LIMITS.x;
  const places = [];
  for (const phrase of [newPhrase(), ...PRESETS.map((preset) => preset.phrase)]) {
    for (const step of phrase.steps) {
      for (const who of ["A", "B"]) if (typeof step[who]?.x === "number") places.push(step[who].x);
    }
  }
  assert.ok(places.includes(310), "the second fencer stands at 310 cm");
  for (const x of places) assert.ok(x >= min && x <= max, `${x} cm is outside the position slider, ${min} to ${max}`);
});

test("the parts are where the stage draws the fencer: the hand and the point of the blade are where its lines end", () => {
  const pose = resolvePose({ pose: "lungeHead", x: 0 });
  const J = skeleton(pose);
  const W = projector(pose, 1, 180);
  assert.deepEqual(placeOf(pose, 1, 180, handle("swordHand")), W(J.hn));
  assert.deepEqual(placeOf(pose, 1, 180, handle("bladeTip")), W(J.at(88)));
  assert.deepEqual(placeOf(pose, 1, 180, handle("frontFoot")), W(J.ankF));
  assert.deepEqual(placeOf(pose, 1, 180, handle("hips")), W(J.hip));
});
