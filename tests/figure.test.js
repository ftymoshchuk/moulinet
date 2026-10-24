import assert from "node:assert/strict";
import { test } from "node:test";

import { basePhrase } from "../site/js/bases.js";
import { DEFAULT_FRAME, PIVOT, bladePaths, bladeTip, floorPath, frameOf, inkFigure, knee, knee3, projector, skeleton, stickFigure } from "../site/js/figure.js";
import { area } from "../site/js/ink.js";
import { POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, poseAt, resolvePose } from "../site/js/phrase.js";
import { allPaths, boxOf, readPath } from "./path-data.js";

const BAD_NUMBER = /NaN|Infinity|undefined/;

function near(actual, expected, tolerance, message = "") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} ${actual} is not within ${tolerance} of ${expected}`);
}

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
  assert.match(figure.head.hair, /^M.*z$/, "the hair, in strokes");
  assert.match(figure.blade.back + figure.blade.front, /^M.*Z$/, "the blade");
  assert.match(figure.blade.g, /^M.*Z$/, "the guard");
  assert.match(figure.blade.o, /^M.*Z$/, "and its line of ink");
  assert.match(figure.ground, /^M/, "both feet are planted in guard");
});

test("the sword arm is drawn behind the body from the back, in front of it otherwise", () => {
  const pose = resolvePose({ pose: "guard" });
  const back = inkFigure(pose, 1, 0, { backView: true });
  const front = inkFigure(pose, 1, 0);
  assert.equal(back.l1.g, front.l6.g);
  assert.equal(back.l6.g, front.l1.g);
});

test("the feet make an L: the foot in front points at the opponent, the foot behind at the camera", () => {
  for (const [dir, options] of [[1, { backView: true }], [-1, { backView: true, older: true }]]) {
    for (const name of ["guard", "lungeChest", "parry3"]) {
      const pose = resolvePose({ pose: name });
      const figure = inkFigure(pose, dir, 0, options);
      // From the back, the leg in front is drawn first and the leg behind over it.
      const feet = [figure.l2, figure.l3].map((leg) => boxOf([readPath(leg.g).at(-1)]));
      const [front, back] = feet.map((box) => box.maxX - box.minX);
      assert.ok(front > 25, `${name}: the shoe in front is seen from the side, the length of a foot (${front})`);
      assert.ok(back < front * 0.6, `${name}: and the shoe behind is seen end on (${back})`);
      // The strokes on the floor under it go either side of it.
      const floor = readPath(figure.ground);
      assert.equal(floor.length, 6);
      const under = boxOf(floor.slice(3));
      const J = skeleton(pose);
      const ankle = projector(pose, dir, 0)(J.ankB)[0];
      assert.ok(under.minX < ankle - 8 && under.maxX > ankle + 8, `${name}: the strokes under the foot behind are round it`);
    }
  }
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

test("the knee can bend the other way: the same lengths, on the far side of the line from hip to ankle", () => {
  const side = (hx, hy, ax, ay, [kx, ky]) => (ax - hx) * (ky - hy) - (ay - hy) * (kx - hx);
  const [fx, fy] = knee(41, 80, 0, 8);
  const [bx, by] = knee(41, 80, 0, 8, -1);
  assert.ok(Math.abs(Math.hypot(bx - 41, by - 80) - 44) < 1e-9 && Math.abs(Math.hypot(bx - 0, by - 8) - 46) < 1e-9, "the thigh and shin are as long");
  assert.ok(side(41, 80, 0, 8, [fx, fy]) * side(41, 80, 0, 8, [bx, by]) < 0, "on the other side of the line");
  // A leg that cannot bend does not care which way it was asked to.
  assert.deepEqual(knee(0, 200, 0, 8, -1), knee(0, 200, 0, 8, 1));
});

test("a knee in depth keeps thigh and shin their lengths, bends the way it is told, and turns out toward the camera", () => {
  const hip = [40, 76, 5];
  const ankle = [0, 8, 0];
  const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const [side, out] of [[1, 0], [-1, 0], [-1, 60]]) {
    const k = knee3(hip, ankle, side, out);
    near(length(k, hip), 44, 1e-9, `${side}, ${out}°: the thigh`);
    near(length(k, ankle), 46, 1e-9, `${side}, ${out}°: the shin`);
  }
  // In the plane of the piste it is the knee of the flat leg.
  const flat = knee3([40, 76, 0], ankle, -1, 0);
  const [x, y] = knee(40, 76, 0, 8, -1);
  near(flat[0], x, 1e-9);
  near(flat[1], y, 1e-9);
  near(flat[2], 0, 1e-9);
  // Turned out, it comes toward the camera.
  assert.ok(knee3(hip, ankle, -1, 60)[2] > knee3(hip, ankle, -1, 0)[2] + 10);
  // Too short to reach, it goes straight toward the foot.
  const straight = knee3([0, 200, 0], [0, 8, 0], 1, 30);
  near(straight[0], 0, 1e-9);
  near(straight[2], 0, 1e-9);
});

test("the leg behind bends back at the knee, as the plates draw it, and the leg in front bends forward", () => {
  for (const name of ["guard", "advLand", "parry3", "extend"]) {
    const J = skeleton(resolvePose({ pose: name }));
    // Which side of the line from a leg's own hip to its ankle the knee is on.
    const line = (hip, a, k) => (a[0] - hip[0]) * (k[1] - hip[1]) - (a[1] - hip[1]) * (k[0] - hip[0]);
    assert.ok(line(J.hipB, J.ankB, J.kB) < 0, `${name}: the rear knee bends back`);
    assert.ok(J.kB[0] < J.hipB[0], `${name}: and is behind its hip`);
    // (Landing from an advance, the front leg is straight, and bends neither way.)
    if (name !== "advLand") assert.ok(line(J.hipF, J.ankF, J.kF) > 0, `${name}: the front knee bends forward`);
  }
  // A lunge has the leg behind straight, so which way it bends makes no difference.
  const lunge = skeleton(resolvePose({ pose: "lungeChest" }));
  const straight = Math.hypot(lunge.hipB[0] - lunge.ankB[0], lunge.hipB[1] - lunge.ankB[1], lunge.hipB[2]);
  assert.ok(Math.abs(straight - 90) < 1.5, "the rear leg is straight in the lunge");
});

test("the hips are turned toward the camera with the shoulders: the leg behind starts on the near side and back, the leg in front on the far side and forward", () => {
  for (const name of ["guard", "lungeChest", "parry5"]) {
    const J = skeleton(resolvePose({ pose: name }));
    assert.ok(J.hipB[0] < J.hip[0] && J.hipF[0] > J.hip[0], `${name}: apart along the piste`);
    assert.ok(J.hipB[2] > 0 && J.hipF[2] < 0, `${name}: either side of the body in depth`);
    near(J.hipB[0] + J.hipF[0], 2 * J.hip[0], 1e-9, `${name}: evenly either side of the middle of the hips`);
    near(Math.hypot(J.hipF[0] - J.hipB[0], J.hipF[2] - J.hipB[2]), 16, 1e-9, `${name}: a pelvis's width apart`);
  }
  // Side on, the hips are square to the camera, one behind the other.
  const side = skeleton(resolvePose({ pose: "guard", adj: { turn: 0 } }));
  near(side.hipB[0], side.hipF[0], 1e-9);
});

test("in the guard each knee is over its own foot: the front shin is upright, the knee behind is turned out over the foot behind", () => {
  // How far in front of its ankle each knee is on the page: the front leg's, and the back leg's.
  const over = (name) => {
    const J = skeleton(resolvePose({ pose: name }));
    return [J.kF[0] - J.ankF[0], J.kB[0] - J.ankB[0]];
  };
  const [front, back] = over("guard");
  assert.ok(Math.abs(front) < 2, `the front shin is upright in the guard (${front})`);
  // The knee behind is over the back foot too, so both shins stand upright, as the classic stance has them, and side on
  // the leg behind is seen bent at the knee, its thigh sloping back from the hip.
  const J = skeleton(resolvePose({ pose: "guard" }));
  const degrees = (dx, dy) => (Math.atan2(dx, dy) * 180) / Math.PI;
  const shin = degrees(back, J.kB[1] - 8);
  const thigh = degrees(J.hipB[0] - J.kB[0], J.hipB[1] - J.kB[1]);
  assert.ok(Math.abs(shin) < 6, `the shin behind stands upright (${shin})`);
  assert.ok(thigh > 30, `and the thigh behind slopes back from the hip to the knee (${thigh})`);
  // A wide stance: the feet nearly as far apart as a leg is long.
  assert.ok(J.ankF[0] - J.ankB[0] > 80, `the feet are ${J.ankF[0] - J.ankB[0]} cm apart`);
  // The poses that move the weight from there keep the knees over the feet to within a few centimetres.
  for (const name of ["prep", "extend", "parry3", "parry5"]) {
    const [f, b] = over(name);
    assert.ok(Math.abs(f) < 5 && Math.abs(b) < 5, `${name}: the knees stay over the feet (${f}, ${b})`);
  }
  for (const name of ["lungeHead", "lungeChest"]) assert.ok(Math.abs(over(name)[0]) < 0.5, `${name}: the front knee is over the front ankle`);
});

test("a parry with the weight back sits over the bent back leg, the front leg straight, the arm and blade as in the parry", () => {
  const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] ?? 0) - (b[2] ?? 0));
  for (const [back, parry] of [["parry3Back", "parry3"], ["parry5Back", "parry5"]]) {
    const pose = resolvePose({ pose: back });
    const J = skeleton(pose);
    const plain = skeleton(resolvePose({ pose: parry }));
    assert.equal(pose.footF, POSES.guard.footF, `${back}: the feet are where the guard has them; only the weight moves`);
    assert.ok(J.hip[0] < plain.hip[0] - 10, `${back}: the hips go back (${J.hip[0]} against ${plain.hip[0]})`);
    assert.ok(Math.abs(J.kB[0] - J.ankB[0]) < 4, `${back}: the back knee is over the back foot (${J.kB[0] - J.ankB[0]})`);
    assert.ok(length(J.hipB, J.ankB) < 80, `${back}: and bent, taking the weight`);
    assert.ok(length(J.hipF, J.ankF) >= 89.9, `${back}: the front leg is straight`);
    assert.ok(pose.lean < 0, `${back}: the body is upright or a little back`);
    for (const key of ["arm", "fore", "blade", "yaw"]) assert.equal(pose[key], resolvePose({ pose: parry })[key], `${back}: the ${key} is the parry's`);
  }
});

test("face protection holds the hand low in front and slants the blade forward across the line to the face", () => {
  const pose = resolvePose({ pose: "faceParry" });
  const J = skeleton(pose);
  const guard = skeleton(resolvePose({ pose: "guard" }));
  assert.ok(J.hn[1] < J.sh[1] - 15 && J.hn[1] > J.hip[1] + 15, `the hand is in front of the chest, below the shoulder (${J.hn[1]})`);
  assert.ok(J.hn[0] - J.hip[0] > 35, `and well in front of the body (${J.hn[0] - J.hip[0]})`);
  assert.ok(J.el[1] < J.hn[1] && J.el[0] < J.hn[0], "the elbow down and back, under the line of the forearm");
  assert.ok(pose.blade > 40 && pose.blade < 65 && pose.yaw === 0, "the blade slants forward and up, halfway between level and upright");
  // At the height of the face, the blade is well in front of it.
  const k = (J.hd[1] - J.hn[1]) / Math.sin((pose.blade * Math.PI) / 180);
  assert.ok(J.at(k)[0] > J.hd[0] + 30, `across the line to the face, ${J.at(k)[0] - J.hd[0]} cm in front of it`);
  // Standing up: the feet closer than in guard, the front foot drawn back, and the hips higher.
  assert.ok(pose.footF < POSES.guard.footF - 15 && J.hip[1] > guard.hip[1], "standing up, the front foot drawn back");
});

test("in the outside face cut, the cut crosses the parrying blade on its forte, and the point comes to the face", () => {
  const phrase = PRESETS.find(({ id }) => id === "outside-face-cut-face-protection").phrase;
  const timeline = buildTimeline(phrase);
  const step = timeline.steps.find((s) => s.B.blade === POSES.faceParry.blade);
  assert.ok(step, "B takes face protection");
  const blade = (pose, dir) => {
    const J = skeleton(pose);
    const W = projector(pose, dir, phrase.camera);
    return { J, W, from: W(J.at(1.6)), to: W(J.tip) };
  };
  const a = blade(step.A, 1);
  const b = blade(step.B, -1);
  // Where the two blades cross on the page, as how far along each.
  const [p, r, q, v] = [a.from, [a.to[0] - a.from[0], a.to[1] - a.from[1]], b.from, [b.to[0] - b.from[0], b.to[1] - b.from[1]]];
  const d = r[0] * v[1] - r[1] * v[0];
  const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / d;
  const u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / d;
  assert.ok(t > 0 && t < 1 && u > 0 && u < 1, "the blades cross");
  const onB = u * Math.hypot(...v);
  assert.ok(onB > 15 && onB < 35, `on the forte of B's blade, ${onB} cm out from the guard`);
  // The point, as the plate draws it, comes to the face: in front of the middle of the head (B faces left), no further
  // than just past the tip of the nose, and between the chin and the eyes.
  const head = b.W(b.J.hd);
  const ahead = head[0] - a.to[0];
  assert.ok(ahead > 0 && ahead < 17, `the point is at the face (${ahead} cm in front of the middle of the head)`);
  assert.ok(a.to[1] - head[1] > 0 && a.to[1] - head[1] < 12, `below the eyes and above the chin (${a.to[1] - head[1]} cm under the middle of the head)`);
});

test("the knee behind is turned out toward the camera over the foot, with thigh and shin as long as ever", () => {
  for (const name of ["guard", "parry3", "advLift", "lungeFly", "riposte"]) {
    const J = skeleton(resolvePose({ pose: name }));
    const [kx, ky, kz] = J.kB;
    const hip = J.hipB;
    assert.ok(Math.abs(Math.hypot(kx - hip[0], ky - hip[1], kz - hip[2]) - 44) < 1e-9, `${name}: the thigh is 44 cm`);
    assert.ok(Math.abs(Math.hypot(kx - J.ankB[0], ky - J.ankB[1], kz) - 46) < 1e-9, `${name}: and the shin 46`);
    assert.ok(kz > hip[2] + 5, `${name}: toward the camera, over a foot that points there`);
    const front = J.kF;
    assert.ok(Math.abs(Math.hypot(front[0] - J.hipF[0], front[1] - J.hipF[1], front[2] - J.hipF[2]) - 44) < 1e-9, `${name}: the thigh in front is 44 cm too`);
    assert.ok(Math.abs(Math.hypot(front[0] - J.ankF[0], front[1] - J.ankF[1], front[2]) - 46) < 1e-9, `${name}: and its shin 46`);
    // Turned out, the leg is seen shorter than its bones, and the knee is not as far back as it bends.
    const bent = knee(hip[0], hip[1], J.ankB[0], J.ankB[1], -1);
    assert.ok(Math.hypot(kx - hip[0], ky - hip[1]) < 44 - 0.5, `${name}: the thigh is seen foreshortened`);
    const side = (k) => (J.ankB[0] - hip[0]) * (k[1] - hip[1]) - (J.ankB[1] - hip[1]) * (k[0] - hip[0]);
    assert.ok(side([kx, ky]) * side(bent) > 0 && Math.abs(side([kx, ky])) < Math.abs(side(bent)), `${name}: still bending back, but not as far as it would side on`);
  }
  // A leg that is straight has nowhere to turn: its knee is on the line from the hip to the foot.
  const lunge = skeleton(resolvePose({ pose: "lungeChest" }));
  const [h, a, k] = [lunge.hipB, [...lunge.ankB, 0], lunge.kB];
  const t = ((k[0] - h[0]) * (a[0] - h[0]) + (k[1] - h[1]) * (a[1] - h[1]) + (k[2] - h[2]) * (a[2] - h[2])) / ((a[0] - h[0]) ** 2 + (a[1] - h[1]) ** 2 + (a[2] - h[2]) ** 2);
  assert.ok(Math.hypot(...[0, 1, 2].map((i) => h[i] + (a[i] - h[i]) * t - k[i])) < 0.5, "the back leg in a lunge is straight, and its knee faces no way");
  // The same drawing for a foot lifted off the floor.
  const lifted = skeleton(resolvePose({ pose: "guard", adj: { liftB: 12 } })).kB;
  assert.ok(lifted[2] > 5 && lifted.every(Number.isFinite));
});

test("an advance lands the front foot where the next guard has it, so no foot slides when the back foot follows", () => {
  const { steps } = buildTimeline(PRESETS[0].phrase);
  const step = (text) => steps.find((s) => s.label.includes(text));
  const front = (s) => s.A.x + s.A.footF;
  const [guard, lifted, landed, followed] = [steps[0], step("front foot lifts"), step("front foot lands"), step("back foot follows")];
  assert.ok(front(guard) < front(lifted) && front(lifted) < front(landed), "the front foot goes forward");
  assert.equal(front(landed), front(followed), "and stays where it landed while the back foot comes up to it");
  // The leg that lands is straight, as a foot comes down on its heel.
  const J = skeleton(landed.A);
  assert.ok(Math.hypot(J.hipF[0] - J.ankF[0], J.hipF[1] - J.ankF[1], J.hipF[2]) >= 89.95, "on a straight leg");
});

test("the neck takes only part of the body's lean, so the head is held up however the body leans", () => {
  const upright = skeleton(resolvePose({ pose: "guard", adj: { lean: 0 } }));
  const leaning = skeleton(resolvePose({ pose: "guard", adj: { lean: 30 } }));
  const angle = ([x, y]) => (Math.atan2(x, y) * 180) / Math.PI;
  near(angle(upright.nu), 0, 1e-9, "upright, the neck is upright");
  assert.ok(angle(leaning.nu) > 3 && angle(leaning.nu) < 15, `leaning 30°, the neck leans ${angle(leaning.nu)}°`);
  // The head is on the neck, so it stays well up over the base of the neck: higher than it would be on a neck that leant
  // all the way with the body.
  const rise = (J) => J.hd[1] - J.nk[1];
  const [up, forward] = [upright.hd[1] - upright.nk[1], upright.hd[0] - upright.nk[0]];
  const tipped = up * Math.cos(Math.PI / 6) - forward * Math.sin(Math.PI / 6);
  assert.ok(rise(leaning) > tipped + 2, `the head is still held up over it (${rise(leaning)} against ${tipped})`);
  near(Math.hypot(leaning.hd[0] - leaning.nk[0], leaning.hd[1] - leaning.nk[1]), Math.hypot(upright.hd[0] - upright.nk[0], upright.hd[1] - upright.nk[1]), 1e-9, "on a neck as long");
});

test("the sword arm is set on the shoulder turned away, at the front of the chest, and is as long as an arm", () => {
  const side = skeleton(resolvePose({ pose: "guard", adj: { turn: 0 } }));
  const turned = skeleton(resolvePose({ pose: "guard", adj: { turn: 58 } }));
  const spine = (J) => J.T(52, 0)[0];
  assert.ok(Math.abs(side.sh[0] - side.T(50, 0)[0]) < 1e-9, "side on, the shoulder is over the spine");
  assert.ok(turned.sh[0] - turned.T(50, 0)[0] > 12, "turned, it is well forward of it");
  assert.ok(turned.sh[0] - spine(turned) > 12 && spine(turned) - turned.rs[0] > 12, "and the other shoulder well behind");
  for (const J of [side, turned]) {
    const upper = Math.hypot(J.el[0] - J.sh[0], J.el[1] - J.sh[1]);
    const fore = Math.hypot(J.hn[0] - J.el[0], J.hn[1] - J.el[1]);
    assert.ok(Math.abs(upper - 32) < 1e-9 && Math.abs(fore - 37) < 1e-9, "shoulder to elbow, and elbow to the grip");
  }
  // From the shoulder the hand reaches the length of the arm, so the guard hand is well ahead of the chest.
  assert.ok(turned.hn[0] - turned.sh[0] > 40);
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
  assert.ok(Math.abs(side.sh[2] + 22) < 1e-9 && Math.abs(side.rs[2] - 22) < 1e-9, "side on, a shoulder's width either side");
  assert.ok(Math.abs(turned.sh[2] + 22 * Math.cos((58 * Math.PI) / 180)) < 1e-9, "turned, nearer the line of sight");
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
      const shapes = [figure.l1.g, figure.l2.g, figure.l3.g, figure.l4.g, figure.l6.g, figure.head.g, figure.blade.g, figure.blade.inside.g, figure.blade.fist.g, figure.blade.wall].filter(Boolean).flatMap(readPath);
      assert.ok(shapes.length > 10);
      assert.ok(shapes.every((shape) => shape.closed && area(shape.points) > 0), `silhouettes, ${where}`);
      // (The hair is drawn in strokes of the pen, so it is wound as they are.)
      for (const layer of [figure.l1.k, figure.l2.k, figure.l3.k, figure.l4.k, figure.l6.k, figure.head.k, figure.head.hair, figure.ground, figure.blade.k, figure.blade.inside.k].filter(Boolean)) {
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
        assert.ok(size < 36000, `${name} from ${camera}° is ${size} characters`);
      }
    }
  }
  assert.ok(largest > 8000, "and it is a drawing, not an outline");
});
