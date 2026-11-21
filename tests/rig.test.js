// The 3D figures: the bodies baked from MakeHuman, and the rig that poses them
// from a pose's numbers so that they stand where the skeleton does.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { BONES, GARMENTS, SOURCE, pack } from "../scripts/bake-fencers.js";
import { Vector3 } from "../site/vendor/three.module.min.js";
import { readBodies } from "../site/js/bodies.js";
import { gripFrame, projector, skeleton } from "../site/js/figure.js";
import { POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, poseAt, resolvePose } from "../site/js/phrase.js";
import { bladeSection, createFigure, poseRig } from "../site/js/rig.js";
import { RECORDED_FIRST_DRILL } from "./recorded-drill.js";
import { RETIRED } from "./retired-scenes.js";

const bufferOf = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const bodies = readBodies(bufferOf(gunzipSync(readFileSync(new URL("../site/models/fencers.bin", import.meta.url)))));
const figures = { A: createFigure(bodies, "A"), B: createFigure(bodies, "B") };
const DIR = { A: 1, B: -1 };
const near = (a, b, tolerance, message) => assert.ok(a.distanceTo(b) <= tolerance, `${message}: ${a.distanceTo(b)} cm off`);

// Every scene at 30 moments, and every pose on its own, for both fencers: the scenes the library lists, and the ones it
// no longer does, which stay as test data for the moulinet and the parries.
const LIBRARY = [...PRESETS, ...RETIRED];
const moments = [];
for (const preset of LIBRARY) {
  const timeline = buildTimeline(preset.phrase);
  for (let i = 0; i <= 30; i++) {
    const t = (timeline.duration * i) / 30;
    const now = poseAt(timeline, t);
    for (const who of timeline.solo ? ["A"] : ["A", "B"]) moments.push({ where: `${preset.id} at ${Math.round(t)} ms, ${who}`, who, p: now[who] });
  }
}
for (const name of Object.keys(POSES)) for (const who of ["A", "B"]) moments.push({ where: `${name}, ${who}`, who, p: resolvePose({ pose: name }) });

test("what the bake packs the page reads back exactly, however far apart the numbers it keeps as steps are", () => {
  const n = 40;
  const index = Uint16Array.from({ length: 3 * 60 }, (_, i) => (i * 7919) % n);
  const skinIndex = Uint8Array.from({ length: 4 * n }, (_, i) => (i * 13) % BONES.length);
  const skinWeight = Uint8Array.from({ length: 4 * n }, (_, i) => [200, 40, 15, 0][i % 4]);
  const position = (k) => Int16Array.from({ length: 3 * n }, (_, i) => ((i * 7919 * k) % 64000) - 32000);
  const figure = (k) => ({
    position: position(k),
    garment: Uint8Array.from({ length: n }, (_, i) => (i * k) % GARMENTS.length),
    heads: BONES.map((_, i) => [i, k, i + 0.5]),
    tails: BONES.map((_, i) => [i + 2, k, 1]),
  });
  const baked = { count: n, index, skinIndex, skinWeight, parents: BONES.map((_, i) => i - 1), figures: { A: figure(1), B: figure(3) } };
  const read = readBodies(bufferOf(pack(baked)));
  assert.deepEqual([...read.index], [...index]);
  assert.deepEqual([...read.skinIndex], [...skinIndex]);
  assert.deepEqual([...read.skinWeight], [...skinWeight]);
  assert.deepEqual(read.bones.map((b) => b.name), BONES);
  assert.deepEqual(read.bones.map((b) => b.parent), baked.parents);
  assert.deepEqual(read.garments, GARMENTS);
  for (const who of ["A", "B"]) {
    const { position: kept, garment, heads, tails } = baked.figures[who];
    assert.deepEqual([...read.figures[who].position].map((v) => Math.round(v * 100)), [...kept], who);
    assert.deepEqual([...read.figures[who].garment], [...garment], who);
    assert.deepEqual([read.figures[who].heads, read.figures[who].tails], [heads, tails], who);
  }
  assert.throws(() => readBodies(new ArrayBuffer(16)), /not a fencers file/);
});

test("the bodies are MakeHuman's, as the fencers' skeleton has them: legs 90 cm from hip joint to ankle, arms 31 and 27 cm", () => {
  assert.deepEqual(bodies.source, SOURCE);
  assert.deepEqual(Object.keys(bodies.figures), ["A", "B"]);
  assert.deepEqual(bodies.bones.map((b) => b.name), BONES);
  for (const [i, bone] of bodies.bones.entries()) assert.ok(bone.parent < i, `${bone.name} comes after its parent`);
  assert.ok(bodies.vertices > 10000 && bodies.index.every((v) => v < bodies.vertices));
  for (let v = 0; v < bodies.vertices; v++) {
    const weights = bodies.skinWeight.subarray(4 * v, 4 * v + 4);
    assert.equal(weights.reduce((s, w) => s + w, 0), 255, `vertex ${v}: its bones' shares make the whole`);
    assert.ok(bodies.skinIndex.subarray(4 * v, 4 * v + 4).every((b) => b < BONES.length));
  }
  for (const [who, figure] of Object.entries(bodies.figures)) {
    const head = (name) => new Vector3(...figure.heads[BONES.indexOf(name)]);
    const length = (a, b) => head(a).distanceTo(head(b));
    for (const side of ["L", "R"]) {
      assert.ok(Math.abs(length(`upperleg01.${side}`, `lowerleg01.${side}`) + length(`lowerleg01.${side}`, `foot.${side}`) - 90) < 0.05, `${who}'s ${side} leg`);
      assert.ok(Math.abs(length(`upperarm01.${side}`, `lowerarm01.${side}`) - 31) < 0.05, `${who}'s ${side} upper arm`);
      assert.ok(Math.abs(length(`lowerarm01.${side}`, `wrist.${side}`) - 27) < 0.05, `${who}'s ${side} forearm`);
    }
    assert.ok(figure.garment.every((g) => g < GARMENTS.length));
    // What each wears: the young man stockings below the knee, the older man trousers to the ankle.
    const worn = new Set([...figure.garment].map((g) => GARMENTS[g]));
    assert.equal(worn.has("stocking"), who === "A", who);
    for (const kind of ["jacket", "breeches", "shoe", "glove", "skin", "hair", "eye"]) assert.ok(worn.has(kind), `${who} has ${kind}`);
  }
});

test("posed, the ankles and the rear hand are where the skeleton has them, and the knees bend the way its knees do", () => {
  for (const { where, who, p } of moments) {
    const { rig } = figures[who];
    const { at } = poseRig(rig, p);
    const J = skeleton(p);
    const bone = (name) => at[rig.at[name]];
    for (const [side, ankle, hip, knee] of [["L", J.ankF, J.hipF, J.kF], ["R", J.ankB, J.hipB, J.kB]]) {
      // As far above the floor as the body's ankle is above the sole of its shoe, so the shoe stands on the floor.
      near(bone(`foot.${side}`), new Vector3(ankle[0], ankle[1] - 8 + rig.ankle[side], 0), 1e-6, `${where}: the ${side} ankle`);
      // Where the skeleton's leg is bent, not near straight, the body's knee is off the line from hip to ankle on the same side.
      const line = new Vector3(...ankle, 0).sub(new Vector3(...hip)).normalize();
      const off = (k, h) => k.clone().sub(h).projectOnPlane(line);
      const bent = off(new Vector3(...knee), new Vector3(...hip));
      if (bent.length() > 3) assert.ok(off(bone(`lowerleg01.${side}`), bone(`upperleg01.${side}`)).dot(bent) > 0, `${where}: the ${side} knee bends the skeleton's way`);
    }
    near(bone("wrist.R"), new Vector3(...J.rh), 1e-6, `${where}: the rear hand`);
  }
});

test("the sword hand holds the sabre where the skeleton has it, the wrist bending no further than a wrist can", () => {
  let short = 0;
  for (const { where, who, p } of moments) {
    const { rig } = figures[who];
    const { q, at, short: missed } = poseRig(rig, p);
    // A hand out of reach, as only in the moulinet, falls a little short, and the sabre goes with it.
    short = Math.max(short, missed.length());
    assert.ok(missed.length() < 5, `${where}: the hand falls ${missed.length()} cm short`);
    const fingers = rig.hands.L.out.clone().applyQuaternion(q[rig.at["wrist.L"]]);
    const forearm = at[rig.at["wrist.L"]].clone().sub(at[rig.at["lowerarm01.L"]]);
    assert.ok(fingers.angleTo(forearm) < (70 * Math.PI) / 180, `${where}: the wrist bends ${(fingers.angleTo(forearm) * 180) / Math.PI}°`);
  }
  assert.ok(short > 0.5, "some hand does fall short, or the test would not see one");
});

test("the fencer facing left is the one facing right turned round, so the blade's point is where the stage puts it from any camera", () => {
  for (const { where, who, p } of moments) {
    const figure = figures[who];
    figure.pose(p, DIR[who]);
    const { short } = poseRig(figure.rig, p);
    const J = skeleton(p);
    const tip = new Vector3(88, 0, 0).applyMatrix4(figure.sabre.matrixWorld);
    const hand = new Vector3(0, 0, 0).applyMatrix4(figure.sabre.matrixWorld);
    // The sabre is the skeleton's, moved only as far as a hand that falls short.
    const expected = (q) => new Vector3(p.x + DIR[who] * (q[0] + short.x), q[1] + short.y, DIR[who] * (q[2] + short.z));
    near(tip, expected(J.tip), 1e-6, `${where}: the point`);
    near(hand, expected(J.hn), 1e-6, `${where}: the hand's place on the blade`);
    if (short.length() > 1e-9) continue;
    // Seen from the camera as the stage turns it, the point is where the blade paths draw it.
    for (const camera of [-40, 0, 35, 180]) {
      const c = Math.cos((camera * Math.PI) / 180);
      const s = Math.sin((camera * Math.PI) / 180);
      const seen = [(tip.x - 115) * c + tip.z * s + 115, -tip.y];
      const drawn = projector(p, DIR[who], camera)(J.tip);
      assert.ok(Math.hypot(seen[0] - drawn[0], seen[1] - drawn[1]) < 1e-6, `${where}, camera ${camera}°`);
    }
  }
});

test("the sabre is in the left hand of both fencers as the rig has them, which is why the stage is shown in a mirror: on the page it is the right", () => {
  const p = resolvePose({ pose: "guard" });
  for (const who of ["A", "B"]) {
    const figure = figures[who];
    figure.pose(p, DIR[who]);
    const world = (name) => figure.mesh.skeleton.bones[figure.rig.at[name]].getWorldPosition(new Vector3());
    // With x to the right and z toward the camera, a fencer facing right has his right hand toward the camera, and one
    // facing left has it away from it. The sword is the model's left hand, and the rear hand its right.
    const toSword = world("upperarm01.L").sub(world("upperarm01.R"));
    assert.ok(toSword.dot(new Vector3(0, 0, DIR[who])) < 0, `${who}: the sword shoulder is on his left`);
  }
});

test("three.js turns the bones as the rig worked them out, for either fencer", () => {
  for (const { where, who, p } of moments.filter((_, i) => i % 7 === 0)) {
    const figure = figures[who];
    figure.pose(p, DIR[who]);
    const { at } = poseRig(figure.rig, p);
    const bones = figure.mesh.skeleton.bones;
    for (const [i, bone] of bones.entries()) {
      const worked = at[i].clone().applyMatrix4(figure.group.matrixWorld);
      near(bone.getWorldPosition(new Vector3()), worked, 1e-4, `${where}: ${bone.name}`);
    }
  }
});

test("the body moves smoothly: through every scene, no bone turns more than 25 degrees in 4 ms, even where a limb passes through straight", () => {
  for (const preset of LIBRARY) {
    const timeline = buildTimeline(preset.phrase);
    for (const who of timeline.solo ? ["A"] : ["A", "B"]) {
      const { rig } = figures[who];
      let before = null;
      for (let t = 0; t <= timeline.duration; t += 4) {
        const { q } = poseRig(rig, poseAt(timeline, t)[who]);
        if (before) {
          for (const [i, turn] of q.entries()) {
            const degrees = (turn.angleTo(before[i]) * 180) / Math.PI;
            assert.ok(degrees < 25, `${preset.id} at ${t} ms, ${who}: ${rig.names[i]} turns ${degrees.toFixed(1)}°`);
          }
        }
        before = q.map((turn) => turn.clone());
      }
    }
  }
});

// ---------- The drills from the class ----------
//
// The class's drills are kept as they were taught, so where each riposte lands is held here: edge first on A's glove, on
// the outside or underneath, with no blade going into an arm on the way. All three open with the cut as it was recorded in
// the Creator, as a corrected version of what the page had, and that is held to the recording, with no blade going into an
// arm in it either. The blades are measured as they are drawn: the edge and the back of each as far either side of its
// middle as the blade is wide there, and the glove and sleeve as the body is skinned.

// The sword arm's glove and sleeve below the elbow, skinned as the page draws them, on the piste, each point with the
// way the surface faces there.
const SWORD_ARM = /^(lowerarm|wrist|finger).*\.L$/;
function armSurface(who, p) {
  const { q, at } = poseRig(figures[who].rig, p);
  const { heads, position, garment } = bodies.figures[who];
  const normal = figures[who].mesh.geometry.getAttribute("normal").array;
  const worn = new Set(["glove", "jacket"].map((g) => bodies.garments.indexOf(g)));
  const out = [];
  for (let v = 0; v < bodies.vertices; v++) {
    if (!worn.has(garment[v]) || !SWORD_ARM.test(bodies.bones[bodies.skinIndex[4 * v]].name)) continue;
    const P = new Vector3();
    const N = new Vector3();
    for (let j = 0; j < 4; j++) {
      const w = bodies.skinWeight[4 * v + j] / 255;
      if (!w) continue;
      const b = bodies.skinIndex[4 * v + j];
      P.add(new Vector3(position[3 * v] - heads[b][0], position[3 * v + 1] - heads[b][1], position[3 * v + 2] - heads[b][2]).applyQuaternion(q[b]).add(at[b]).multiplyScalar(w));
      N.add(new Vector3(normal[3 * v], normal[3 * v + 1], normal[3 * v + 2]).applyQuaternion(q[b]).multiplyScalar(w));
    }
    const d = DIR[who];
    out.push({ p: new Vector3(p.x + d * P.x, P.y, d * P.z), n: new Vector3(d * N.x, N.y, d * N.z).normalize(), glove: bodies.garments[garment[v]] === "glove" });
  }
  return out;
}

// A blade as the page draws it, on the piste: its middle k cm out from the hand, its edge and its back, and the way the
// edge faces; moved with a hand that falls short.
function bladeOf(who, p) {
  const J = skeleton(p);
  const { short } = poseRig(figures[who].rig, p);
  const d = DIR[who];
  const G = gripFrame(J);
  const middle = (k) => {
    const q = J.at(k);
    return new Vector3(p.x + d * (q[0] + short.x), q[1] + short.y, d * (q[2] + short.z));
  };
  const edge = new Vector3(d * G.e[0], G.e[1], d * G.e[2]);
  const along = (k, y) => middle(k).addScaledVector(edge, y);
  return { middle, edge, edgeAt: (k) => along(k, bladeSection(k).edge), backAt: (k) => along(k, bladeSection(k).back) };
}

// Where a blade comes nearest a sword arm: how far its edge is from the surface (negative inside it), which way the
// surface faces there, how far out along the blade, and whether that is the glove; and the deepest any part goes.
function touch(blade, arm) {
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const s of arm) [lo.min(s.p), hi.max(s.p)];
  lo.subScalar(4);
  hi.addScalar(4);
  let edge = null;
  let deepest = Infinity;
  for (let k = 3; k <= 88; k += 1) {
    for (const [line, x] of [["edge", blade.edgeAt(k)], ["middle", blade.middle(k)], ["back", blade.backAt(k)]]) {
      if (x.x < lo.x || x.y < lo.y || x.z < lo.z || x.x > hi.x || x.y > hi.y || x.z > hi.z) continue;
      let near = null;
      let nd = Infinity;
      for (const s of arm) {
        const d = x.distanceToSquared(s.p);
        if (d < nd) [nd, near] = [d, s];
      }
      const signed = x.clone().sub(near.p).dot(near.n);
      if (nd < 16) deepest = Math.min(deepest, signed);
      if (line === "edge" && (!edge || nd < edge.nd)) edge = { nd, k, signed, n: near.n, glove: near.glove };
    }
  }
  return { edge, deepest };
}

// The drills that go on from the cut to a riposte; the first stops with the cut, which is held below.
const CLASS_DRILLS = {
  "class-light-cut-side-of-glove": { where: "on the outside", facing: new Vector3(0.4, 0, -0.92).normalize() },
  "class-light-cut-tierce-hungarian-cut": { where: "underneath", facing: new Vector3(0, -1, -0.3).normalize() },
};
// How long the cut they open with takes (ms), which the recording gives the times of.
const CUT_MS = 30340;

test("the drills from the class: each riposte lands edge first on A's glove, on top, on the outside or underneath as the class has it, on the foible, and no blade goes into an arm on the way", () => {
  for (const [id, { where, facing }] of Object.entries(CLASS_DRILLS)) {
    const { phrase } = PRESETS.find((preset) => preset.id === id);
    const timeline = buildTimeline(phrase);
    // The riposte is the step B holds longest.
    const hit = timeline.steps.reduce((best, step) => (step.end - step.holdStart > best.end - best.holdStart && step.specB.pose !== "guard" ? step : best));
    const blade = bladeOf("B", hit.B);
    const { edge, deepest } = touch(blade, armSurface("A", hit.A));
    assert.ok(edge.glove, `${id}: on the glove`);
    assert.ok(edge.signed > -0.1 && edge.signed < 0.6, `${id}: the edge touches it, ${edge.signed.toFixed(2)} cm off`);
    assert.ok(deepest > -0.1, `${id}: and nothing goes into it (${deepest.toFixed(2)})`);
    assert.ok(edge.k > 50 && edge.k < 82, `${id}: on the middle or the foible, ${edge.k} cm out`);
    const angle = (edge.n.angleTo(facing) * 180) / Math.PI;
    assert.ok(angle < 30, `${id}: ${where}, the glove facing ${angle.toFixed(0)}° from that`);
    assert.ok(blade.edge.dot(edge.n) < -0.8, `${id}: edge first`);
    // Every 10 ms from just before the cut ends, neither blade goes into the other's sword arm; the cut is held below.
    for (let ms = CUT_MS - 200; ms <= timeline.duration; ms += 10) {
      const now = poseAt(timeline, ms);
      for (const [who, other] of [["B", "A"], ["A", "B"]]) {
        const { deepest: d } = touch(bladeOf(who, now[who]), armSurface(other, now[other]));
        assert.ok(d > -0.2, `${id} at ${ms} ms: ${who}'s blade goes ${(-d).toFixed(2)} cm into ${other}'s arm`);
      }
    }
  }
});

// The names the steps of the cut have, for what they do.
const CUT_LABELS = ["En garde", "B lowers the point", "B lowers the hand", "B raises the hand a little", "A brings his blade down", "A reaches out", "A raises the hand a little", "B lowers his elbow"];

test("every drill opens with the cut as it was recorded in the Creator, step for step with the times they took, under the names the steps have", () => {
  const unnamed = (steps) => steps.map(({ label, ...rest }) => rest);
  for (const { id, phrase } of PRESETS) {
    const cut = phrase.steps.slice(0, 8);
    assert.deepEqual(unnamed(cut), unnamed(RECORDED_FIRST_DRILL.steps), `${id}: the recording's poses and times`);
    assert.deepEqual(cut.map(({ label }) => label), CUT_LABELS, `${id}: the names`);
    assert.equal(phrase.camera, RECORDED_FIRST_DRILL.camera);
    assert.equal(buildTimeline(phrase).steps[7].end, CUT_MS, `${id}: the cut takes as long as the recording did`);
  }
  // The first drill is the cut alone: the riposte to the top of the glove is still to be recorded.
  const first = PRESETS.find((preset) => preset.id === "class-light-cut-top-of-glove");
  assert.equal(first.phrase.steps.length, 8);
  assert.equal(buildTimeline(first.phrase).duration, CUT_MS);
});

test("in the cut, B holds his blade out level and then lowers the point and the hand while A stands as he was, then A brings his blade down from upright to level, and no blade goes into an arm", () => {
  const { phrase } = PRESETS.find((preset) => preset.id === "class-light-cut-top-of-glove");
  const timeline = buildTimeline(phrase);
  const [start, lowered, , settled, brought] = timeline.steps;
  assert.deepEqual([start.B.blade, start.B.arm, start.B.yaw], [2, -5, 22]);
  assert.equal(lowered.B.blade, -20);
  assert.deepEqual([settled.B.arm, settled.B.fore], [-21, -21]);
  assert.deepEqual([start.A.blade, settled.A.blade, brought.A.blade], [81, 81, 9]);
  // Every 40 ms, neither blade goes into the other's sword arm; B's point passes A's glove as it lowers, near, and outside it.
  let nearest = Infinity;
  for (let ms = 0; ms <= timeline.duration; ms += 40) {
    const now = poseAt(timeline, ms);
    for (const [who, other] of [["B", "A"], ["A", "B"]]) {
      const { deepest: d } = touch(bladeOf(who, now[who]), armSurface(other, now[other]));
      assert.ok(d > -0.2, `at ${ms} ms: ${who}'s blade goes ${(-d).toFixed(2)} cm into ${other}'s arm`);
      nearest = Math.min(nearest, d);
    }
  }
  assert.ok(nearest < 2, `a blade does pass the other's arm close: ${nearest.toFixed(2)} cm`);
});
