// The 3D figures: the bodies baked from MakeHuman, and the rig that poses them
// from a pose's numbers so that they stand where the skeleton does.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { BONES, GARMENTS, SOURCE, pack } from "../scripts/bake-fencers.js";
import { Vector3 } from "../site/vendor/three.module.min.js";
import { readBodies } from "../site/js/bodies.js";
import { projector, skeleton } from "../site/js/figure.js";
import { POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, poseAt, resolvePose } from "../site/js/phrase.js";
import { createFigure, poseRig } from "../site/js/rig.js";

const bufferOf = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const bodies = readBodies(bufferOf(gunzipSync(readFileSync(new URL("../site/models/fencers.bin", import.meta.url)))));
const figures = { A: createFigure(bodies, "A"), B: createFigure(bodies, "B") };
const DIR = { A: 1, B: -1 };
const near = (a, b, tolerance, message) => assert.ok(a.distanceTo(b) <= tolerance, `${message}: ${a.distanceTo(b)} cm off`);

// Every built-in scene at 30 moments, and every pose on its own, for both fencers.
const moments = [];
for (const preset of PRESETS) {
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
