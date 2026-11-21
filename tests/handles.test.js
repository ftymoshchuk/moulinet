import assert from "node:assert/strict";
import { test } from "node:test";

import { projector, skeleton, topProjector } from "../site/js/figure.js";
import { HANDLES, jointsOf, placeOf, shareOf, solve, stagePoint } from "../site/js/handles.js";
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
const MOVE = { x: 6, footF: 6, liftF: 6, hipX: 6, hipY: 6, lean: 10, arm: 10, fore: 10, blade: 10, rArm: 10, rFore: 10, turn: 10, armYaw: 10, foreYaw: 10, yaw: 10, kneeOut: 10, toeBack: 8 };
// The two views a part is dragged in: the stage, from the camera, and the plan, from above, which only looks from the
// two sides of the piste. The parts that have a dot in each, and the cameras to try them from.
const VIEWS = ["side", "plan"];
const CAMERAS_OF = { side: CAMERAS, plan: [180, 0] };
const partsIn = (view) => HANDLES.filter((part) => jointsOf(part, view).length > 0);
// How near the part must come to a place it can be taken to: half a degree of an 88 cm blade is 0.8 cm, and a hand that
// has four joints to put right has all four half a degree out.
const NEARLY = { side: 1.3, plan: 2 };

test("every part is named, follows a point of the skeleton, and moves it with joints the sliders have", () => {
  assert.equal(new Set(HANDLES.map(({ id }) => id)).size, HANDLES.length, "each has its own id");
  const sliders = new Set(JOINTS.map(({ key }) => key));
  for (const part of HANDLES) {
    assert.ok(part.name && !part.name.includes("  "), `${part.id} has a name`);
    assert.ok(VIEWS.some((view) => jointsOf(part, view).length > 0), `${part.id} has a dot in some view`);
    for (const view of VIEWS) {
      const joints = jointsOf(part, view);
      assert.ok(joints.length <= 4, `${part.id} in the ${view}: no more than four joints`);
      assert.equal(new Set(joints).size, joints.length, `${part.id} in the ${view}: each joint once`);
      for (const key of joints) assert.ok(sliders.has(key), `${part.id}: ${key} has a slider, so a drag cannot make a value a person cannot see`);
    }
    for (const name of Object.keys(POSES)) {
      const point = part.at(skeleton(resolvePose({ pose: name })));
      assert.ok(point.length >= 2 && point.slice(0, 3).every(Number.isFinite), `${part.id} in ${name}`);
    }
  }
  // Every joint a drag moves is one that a drag can move: the parts between them cover the foot, the hips, the head, the
  // arms and the blade, and, from above, the turn of the shoulders, the arm and blade across the chest, the knee and the foot.
  const side = [...new Set(partsIn("side").flatMap((part) => jointsOf(part, "side")))].toSorted();
  assert.deepEqual(side, ["arm", "blade", "footF", "fore", "hipX", "hipY", "lean", "liftF", "rArm", "rFore", "x"]);
  const plan = [...new Set(partsIn("plan").flatMap((part) => jointsOf(part, "plan")))].toSorted();
  assert.deepEqual(plan, ["arm", "armYaw", "blade", "fore", "foreYaw", "kneeOut", "toeBack", "turn", "yaw"]);
  // The stage has what is in the stage's plane; what turns toward the camera is dragged from above, and nothing is dragged
  // in a view that cannot move it.
  for (const key of ["armYaw", "foreYaw", "yaw", "turn", "kneeOut", "toeBack"]) assert.ok(!side.includes(key), `${key} is not on the stage`);
  assert.deepEqual(partsIn("plan").map(({ id }) => id), ["swordShoulder", "swordElbow", "swordHand", "bladeTip", "backKnee", "backToe"]);
});

test("a part has a dot from above only if some joint of it moves it across the piste, which the stage cannot show", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  for (const part of HANDLES) {
    const across = (view) => jointsOf(part, view).some((key) => {
      const [here, there] = [pose, { ...pose, [key]: pose[key] + 5 }].map((p) => placeOf(p, 1, 180, part, view)[1]);
      return Math.abs(there - here) > 0.3;
    });
    // Seen from above, the second coordinate is the depth: only the parts with a joint that changes it are drawn there.
    assert.equal(across("plan"), jointsOf(part, "plan").length > 0, `${part.id}`);
  }
});

test("the plan and the stage agree along the piste: a part is as far across in one as in the other, from either side", () => {
  for (const name of Object.keys(POSES)) {
    for (const { dir, x } of FENCERS) {
      const pose = resolvePose({ pose: name, x });
      for (const camera of [180, 0]) {
        for (const part of HANDLES) {
          const [seen, above] = [placeOf(pose, dir, camera, part), placeOf(pose, dir, camera, part, "plan")];
          assert.ok(Math.abs(seen[0] - above[0]) < 1e-9, `${name}, ${dir}, ${camera}, ${part.id}`);
        }
      }
    }
  }
});

test("a part taken to a place is put there, in every pose, from every side the camera can look from, for both fencers", () => {
  const tried = { side: 0, plan: 0 };
  for (const view of VIEWS) {
    for (const name of Object.keys(POSES)) {
      for (const { dir, x } of FENCERS) {
        const pose = resolvePose({ pose: name, x });
        for (const camera of CAMERAS_OF[view]) {
          for (const part of partsIn(view)) {
            for (const sign of [1, -1]) {
              // A place the part can be: where it goes with each of its joints moved.
              const moved = { ...pose };
              for (const key of jointsOf(part, view)) {
                const by = key === "liftF" ? Math.abs(MOVE[key]) : sign * MOVE[key];
                moved[key] = Math.min(LIMITS[key].max, Math.max(LIMITS[key].min, pose[key] + by));
              }
              const target = placeOf(moved, dir, camera, part, view);
              const got = solve(pose, dir, camera, part, target, 1, view);
              const after = placeOf({ ...pose, ...got }, dir, camera, part, view);
              // Whole numbers cost a little.
              assert.ok(distance(after, target) < NEARLY[view], `${view}, ${name}, fencer ${dir}, camera ${camera}, ${part.id}: ${distance(after, target).toFixed(2)} cm off`);
              tried[view]++;
            }
          }
        }
      }
    }
  }
  assert.ok(tried.side > 5000 && tried.plan > 1000, JSON.stringify(tried));
});

test("a drag gives whole numbers within the sliders' ranges for the part's own joints, and leaves the pose alone", () => {
  const pose = resolvePose({ pose: "parry5", x: 0 });
  const before = structuredClone(pose);
  for (const view of VIEWS) {
    for (const part of partsIn(view)) {
      const here = placeOf(pose, 1, 180, part, view);
      for (const target of [[here[0] + 500, here[1] - 500], [here[0] - 500, here[1] + 500], [here[0] + 3, here[1] - 2]]) {
        const got = solve(pose, 1, 180, part, target, 1, view);
        assert.deepEqual(Object.keys(got), jointsOf(part, view), `${part.id}: only its own joints`);
        for (const [key, value] of Object.entries(got)) {
          assert.ok(Number.isInteger(value), `${view}, ${part.id}: ${key} ${value} is a whole number`);
          assert.ok(value >= LIMITS[key].min && value <= LIMITS[key].max, `${view}, ${part.id}: ${key} ${value} is within its slider`);
        }
      }
    }
  }
  assert.deepEqual(pose, before, "the pose it was given is as it was");
});

test("a part taken where it already is stays", () => {
  // The guard's own numbers are whole, so they come back as they were.
  for (const view of VIEWS) {
    for (const { dir, x } of FENCERS) {
      const pose = resolvePose({ pose: "guard", x });
      for (const camera of CAMERAS_OF[view]) {
        for (const part of partsIn(view)) {
          const got = solve(pose, dir, camera, part, placeOf(pose, dir, camera, part, view), 1, view);
          assert.deepEqual(got, Object.fromEntries(jointsOf(part, view).map((key) => [key, pose[key]])), `${view}, ${part.id} at ${camera}`);
        }
      }
    }
  }
});

test("a part taken further than it can go goes as far as it can, nearer than it was, and no joint goes past its slider", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  // Taken far off in some direction, no part ends further from the place than it began, but for the half a degree that
  // whole numbers can cost it, which is a centimetre at the end of a blade: the head, the shoulder, the knee and the toe only
  // turn, and a place on the far side of what they turn about is not one they can come nearer.
  for (const view of VIEWS) {
    for (const part of partsIn(view)) {
      const here = placeOf(pose, 1, 180, part, view);
      for (const far of [[here[0] + 400, here[1] - 400], [here[0] - 400, here[1] + 400]]) {
        const got = solve(pose, 1, 180, part, far, 1, view);
        const after = placeOf({ ...pose, ...got }, 1, 180, part, view);
        assert.ok(distance(after, far) <= distance(here, far) + 1, `${view}, ${part.id} went away from ${far}`);
        for (const [key, value] of Object.entries(got)) assert.ok(value >= LIMITS[key].min && value <= LIMITS[key].max, `${view}, ${part.id}: ${key} ${value} is within its slider`);
      }
    }
  }
  for (const part of partsIn("side")) {
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
  // The toe taken round to where the foot turned back past its slider would put it stops at the end of the slider.
  const toe = handle("backToe");
  assert.equal(solve(pose, 1, 180, toe, placeOf({ ...pose, toeBack: 70 }, 1, 180, toe, "plan"), 1, "plan").toeBack, LIMITS.toeBack.max);
  assert.equal(solve(pose, 1, 180, toe, placeOf({ ...pose, toeBack: -20 }, 1, 180, toe, "plan"), 1, "plan").toeBack, LIMITS.toeBack.min);
  // And so does the knee, turned out as far as it goes, or not at all.
  const knee = handle("backKnee");
  assert.equal(solve(pose, 1, 180, knee, placeOf({ ...pose, kneeOut: 90 }, 1, 180, knee, "plan"), 1, "plan").kneeOut, LIMITS.kneeOut.max);
  assert.equal(solve(pose, 1, 180, knee, placeOf({ ...pose, kneeOut: 0 }, 1, 180, knee, "plan"), 1, "plan").kneeOut, LIMITS.kneeOut.min);
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
  for (const part of partsIn("side")) {
    const got = solve(pose, 1, 90, part, [placeOf(pose, 1, 90, part)[0] + 80, placeOf(pose, 1, 90, part)[1]]);
    for (const key of jointsOf(part, "side")) assert.ok(Math.abs(got[key] - pose[key]) <= 12, `${part.id} ${key} ${got[key]}`);
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

test("in a view so close that a degree is a long way, a part is placed in tenths, which put it nearer, within the sliders", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  const part = handle("swordHand");
  const here = placeOf(pose, 1, 180, part);
  const miss = (got, target) => distance(placeOf({ ...pose, ...got }, 1, 180, part), target);
  // A quarter of a centimetre across and four tenths up: a few pixels of a close-up of a hand, and less than a degree of the forearm.
  const target = [here[0] + 0.25, here[1] - 0.4];
  const whole = solve(pose, 1, 180, part, target);
  const fine = solve(pose, 1, 180, part, target, 0.1);
  assert.ok(miss(fine, target) < 0.12, `tenths put the hand ${miss(fine, target).toFixed(3)} cm from it`);
  assert.ok(miss(fine, target) < miss(whole, target), "nearer than whole numbers");
  for (const [key, value] of Object.entries(fine)) {
    assert.ok(Math.abs(value * 10 - Math.round(value * 10)) < 1e-6, `${key} ${value} is in tenths`);
    assert.ok(value >= LIMITS[key].min && value <= LIMITS[key].max, `${key} ${value} is within its slider`);
  }
  // With no unit given it is whole numbers, as always, and a joint put in tenths can be put back to the pose's own whole number.
  for (const value of Object.values(whole)) assert.ok(Number.isInteger(value));
  const back = solve({ ...pose, ...fine }, 1, 180, part, here, 0.1);
  for (const key of jointsOf(part, "side")) assert.ok(Math.abs(back[key] - pose[key]) < 0.35, `${key} ${back[key]} goes back to ${pose[key]}`);
});

test("from above, the hand and the blade go across the piste with the joints that turn them out of the arm's plane, and the arm keeps its height", () => {
  // The camera at 180 is the side the page starts on: A's sword arm is toward it, so toward it is down the plan.
  const pose = resolvePose({ pose: "guard", x: 0 });
  const hand = handle("swordHand");
  const tip = handle("bladeTip");
  const [along, deep] = placeOf(pose, 1, 180, hand, "plan");
  // The hand taken 12 cm toward the camera and then 12 cm away from it.
  const toward = solve(pose, 1, 180, hand, [along, deep + 12], 1, "plan");
  const away = solve(pose, 1, 180, hand, [along, deep - 12], 1, "plan");
  assert.ok(toward.armYaw < -2 && toward.foreYaw < -2, `toward the camera: ${JSON.stringify(toward)}`);
  assert.ok(away.armYaw > 2 && away.foreYaw > 2, `away from it: ${JSON.stringify(away)}`);
  // It is turned out of the arm's plane, not raised: the hand stays at the height it was, within a few cm.
  const height = (got) => placeOf({ ...pose, ...got }, 1, 180, hand)[1] - placeOf(pose, 1, 180, hand)[1];
  assert.ok(Math.abs(height(toward)) < 3 && Math.abs(height(away)) < 3, `${height(toward).toFixed(1)}, ${height(away).toFixed(1)} cm of height`);
  // The other fencer is the first turned round, so the same drag turns his arm the other way.
  const other = resolvePose({ pose: "guard", x: 310 });
  const [otherAlong, otherDeep] = placeOf(other, -1, 180, hand, "plan");
  const otherToward = solve(other, -1, 180, hand, [otherAlong, otherDeep + 12], 1, "plan");
  assert.ok(otherToward.armYaw > 2 && otherToward.foreYaw > 2, `the other fencer: ${JSON.stringify(otherToward)}`);
  // The point of the blade taken across the piste turns the blade across the body; along it, the blade up and down.
  const [tipAlong, tipDeep] = placeOf(pose, 1, 180, tip, "plan");
  const across = solve(pose, 1, 180, tip, [tipAlong, tipDeep + 15], 1, "plan");
  assert.ok(across.yaw < -5 && across.blade === pose.blade, `across: ${JSON.stringify(across)}`);
  const along2 = solve(pose, 1, 180, tip, [tipAlong - 15, tipDeep], 1, "plan");
  assert.ok(along2.blade !== pose.blade && Math.abs(along2.yaw) <= 1, `along: ${JSON.stringify(along2)}`);
});

test("from above, the shoulder, knee and toe follow the pointer round the point they turn about", () => {
  const pose = resolvePose({ pose: "guard", x: 0 });
  // Each is taken to where a turn would put it, and found there.
  for (const [id, key, by] of [["swordShoulder", "turn", -12], ["swordShoulder", "turn", 12], ["backKnee", "kneeOut", 12], ["backKnee", "kneeOut", -12], ["backToe", "toeBack", 10], ["backToe", "toeBack", -10]]) {
    const part = handle(id);
    const target = placeOf({ ...pose, [key]: pose[key] + by }, 1, 180, part, "plan");
    assert.equal(solve(pose, 1, 180, part, target, 1, "plan")[key], pose[key] + by, `${id} ${by}`);
  }
  // Turned square to the piste the sword shoulder is farther toward the camera than turned side on.
  const square = placeOf({ ...pose, turn: 0 }, 1, 180, handle("swordShoulder"), "plan");
  const turned = placeOf({ ...pose, turn: 80 }, 1, 180, handle("swordShoulder"), "plan");
  assert.ok(square[1] > turned[1] + 15, "square on, the sword shoulder is farther toward the camera");
});

test("the plan has its place where the stage has it, from above, with the camera on its side of the piste", () => {
  const pose = resolvePose({ pose: "lungeHead", x: 0 });
  const J = skeleton(pose);
  for (const camera of [180, 0]) {
    const T = topProjector(pose, 1, camera);
    assert.deepEqual(placeOf(pose, 1, camera, handle("swordHand"), "plan"), T(J.hn));
    assert.deepEqual(placeOf(pose, 1, camera, handle("bladeTip"), "plan"), T(J.at(88)));
    assert.deepEqual(placeOf(pose, 1, camera, handle("swordShoulder"), "plan"), T(J.sh));
    assert.deepEqual(placeOf(pose, 1, camera, handle("backKnee"), "plan"), T(J.kB));
  }
  // The toe of the back foot is the shoe's far end, 21 cm on from the ankle, turned back as the foot is.
  const ankle = topProjector(pose, 1, 180)(J.ankB);
  const toe = placeOf(pose, 1, 180, handle("backToe"), "plan");
  assert.ok(Math.abs(distance(ankle, toe) - 21) < 1e-6, `${distance(ankle, toe)}`);
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
