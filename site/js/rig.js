// The fencers as 3D figures: the bodies in models/fencers.bin (bodies.js) on
// skeletons of bones, posed from a pose's numbers so that the ankles, the hands
// and the sabre are where figure.js puts them, and the trunk, the neck and the
// head lie the way its skeleton has them.
//
// Every bone is at rest with no turn of its own, so a pose is worked out as the
// way each bone faces in the body's frame (cm, x toward the opponent, y up, z
// toward the camera for the fencer facing right) and only then made into a turn
// from its parent. Both fencers are posed in that frame, as figure.js has them;
// the fencer facing left is then turned round to face the other way.
import { Bone, BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, Matrix4, Mesh, Quaternion, Skeleton, SkinnedMesh, SphereGeometry, TubeGeometry, Vector3 } from "../vendor/three.module.min.js";
import { gripFrame } from "./body.js";
import { hiltParts } from "./parts.js";
import { knee3, kneeBehind, skeleton } from "./figure.js";

const RAD = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

// How far back along the blade from the hand's point on it the middle of the fist is (cm), as parts.js has the hilt,
// and where the forefinger and the thumb pinch the grip, which the sabre turns about in the fingers, as it does in a
// moulinet, when the wrist cannot bend as far as the blade would have it.
const FIST = 4.8;
const PINCH = 1.9;
// How far the hand may bend at the wrist from the line of the forearm (degrees).
const WRIST_BEND = 50;
// How the grip lies across the open hand at rest: turned this far from the line of the knuckles toward the fingers
// (degrees), this far behind the knuckles and this far out from the bones of the hand on the side of the palm (cm).
const GRIP_ACROSS = 40;
const GRIP_BACK = 1.6;
const GRIP_OUT = 2.4;
// How far each joint of a finger bends to close round the grip, from the knuckle out (degrees), the forefinger least;
// the thumb lies along the back of the grip. The rear hand, on the hip, is held loosely closed.
const SWORD_CURL = { 2: [58, 80, 48], 3: [64, 86, 52], 4: [68, 88, 52], 5: [72, 88, 50] };
const REAR_CURL = { 1: [6, 10, 8], 2: [22, 30, 20], 3: [24, 32, 22], 4: [26, 34, 22], 5: [28, 34, 22] };
// How much of the forearm's turn toward the hand each of its two bones takes, the elbow's end first, and how far the
// forearm can turn the hand either way (degrees).
const FOREARM_TWIST = [0.2, 0.65];
const FOREARM_TURN = 100;
// How far the shoulder may come forward, turning on the collarbone, to let the hand reach (degrees), and how much of
// the arm's length the reach may take before it does.
const SHOULDER_REACH = 16;
const REACH = 0.985;

const V = (p) => new Vector3(p[0], p[1], p[2] ?? 0);
const unit = (v) => v.clone().normalize();
const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
const mix = (a, b, t) => a.clone().multiplyScalar(1 - t).addScaledVector(b, t).normalize();

function basisOf(dir, ref) {
  const x = unit(dir);
  const y = ref.clone().addScaledVector(x, -ref.dot(x));
  if (y.lengthSq() < 1e-10) y.set(0, 1, 0).addScaledVector(x, -x.y);
  if (y.lengthSq() < 1e-10) y.set(0, 0, 1).addScaledVector(x, -x.z);
  y.normalize();
  return new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y));
}

/** The turn that takes `restDir` to `dir`, and `restRef`, as near as it can square to that, toward `ref`. */
function turnTo(restDir, restRef, dir, ref) {
  return new Quaternion().setFromRotationMatrix(basisOf(dir, ref).multiply(basisOf(restDir, restRef).transpose()));
}

// The axis a joint bends about, from the bone before it and the bone after; `fallback` when they are in line.
function hinge(a, b, c, fallback) {
  const h = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(b));
  return h.length() > 1e-3 * a.distanceTo(b) * b.distanceTo(c) ? h.normalize() : fallback.clone().normalize();
}

// How far off the line from hip to ankle, or shoulder to wrist, the skeleton's knee or elbow must be (cm) for its own
// way of bending to settle which way the limb bends; nearer the line, the more the limb's own way takes over, so that a
// limb passing through straight never turns over. An elbow's own way is out from the body, between the ways the
// skeleton's can bend, down or up; a knee's is its foot's.
// How much nearer the hip the ankle is taken to be, to find which way the skeleton's knee bends (cm).
const KNEE_SHORTER = 6;
// How much an all but straight sword arm's elbow points out from the body, beside the way the hand turns it.
const ELBOW_OUT = 0.4;
const BENT = 10;

/**
 * The middle joint of a limb from `h` to `a`, `l1` and `l2` long, bending toward `toward`, or `fallback` as the limb
 * straightens, and straight if it cannot reach; and the axis it bends about, which keeps its way however straight.
 */
function solveJoint(h, a, l1, l2, toward, fallback) {
  const d = a.clone().sub(h);
  const len = Math.max(1e-6, Math.min(d.length(), l1 + l2 - 1e-4));
  const u = d.clone().normalize();
  const along = (l1 * l1 + len * len - l2 * l2) / (2 * len);
  const r = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const square = (v) => v.clone().addScaledVector(u, -v.dot(u));
  const side = square(toward);
  side.add(square(fallback).multiplyScalar(Math.max(0, BENT - side.length()) / BENT));
  if (side.lengthSq() < 1e-10) side.copy(square(new Vector3(0, 0, 1))).add(square(X));
  side.normalize();
  return { joint: h.clone().addScaledVector(u, along).addScaledVector(side, r), axis: new Vector3().crossVectors(side, u).normalize() };
}

// The turn of `q` about `axis`, a unit step in its own frame, without the rest of it.
function twistOf(q, axis) {
  const p = axis.clone().multiplyScalar(q.x * axis.x + q.y * axis.y + q.z * axis.z);
  const t = new Quaternion(p.x, p.y, p.z, q.w);
  if (t.lengthSq() < 1e-12) return new Quaternion();
  t.normalize();
  if (t.w < 0) t.set(-t.x, -t.y, -t.z, -t.w);
  return t;
}

const part = (geometry, name, matrix) => {
  const mesh = new Mesh(matrix ? geometry.applyMatrix4(matrix) : geometry);
  mesh.name = name;
  return mesh;
};

/**
 * The sabre, in the frame of the hand on the blade as gripFrame has it: x along the blade toward its point from the
 * hand's point on it, y toward the edge, z = x × y. Its parts are named for the renderer to colour: the blade, the
 * bell guard and the knuckle bow round the fist, the grip and the pommel.
 */
function makeSabre() {
  const sabre = new Group();
  sabre.name = "sabre";
  // The blade, from where it comes out of the guard to the point: narrower and thinner toward the point.
  const blade = new BoxGeometry(1, 1, 1, 1, 1, 1);
  const pos = blade.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) + 0.5;
    pos.setXYZ(i, 3 + t * 85, pos.getY(i) * (1.25 - 0.8 * t), pos.getZ(i) * (0.4 - 0.2 * t));
  }
  blade.computeVertexNormals();
  sabre.add(part(blade, "blade"));
  // The bell: a shallow dome over the fist, its crown toward the point, deeper on the side of the edge.
  const bell = new SphereGeometry(6.2, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
  sabre.add(part(bell, "guard", new Matrix4().makeTranslation(-3.1, 2.0, 0).multiply(new Matrix4().makeScale(1, 1, 0.85)).multiply(new Matrix4().makeRotationZ(-Math.PI / 2))));
  // The knuckle bow, a flat bar from the rim of the bell round the fingers into the pommel.
  const bow = new CatmullRomCurve3([
    new Vector3(-1.2, 6.0, 0),
    new Vector3(-4.2, 6.0, 0),
    new Vector3(-8.0, 5.3, 0),
    new Vector3(-10.8, 4.0, 0),
    new Vector3(-12.6, 1.5, 0),
  ]);
  sabre.add(part(new TubeGeometry(bow, 24, 0.38, 8), "guard", new Matrix4().makeScale(1, 1, 2.2)));
  // The grip, and the pommel at its end.
  sabre.add(part(new CylinderGeometry(1.0, 1.1, 11.9, 12), "grip", new Matrix4().makeTranslation(-6.25, 0, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2))));
  sabre.add(part(new SphereGeometry(1.25, 14, 10), "pommel", new Matrix4().makeTranslation(-12.9, 0, 0)));
  return sabre;
}

/**
 * The rig of one body: its bones at rest, and what posing needs to know of them, worked out once. `figure` is one of
 * readBodies' figures, `bodies` all of it.
 */
function makeRig(bodies, figure) {
  const names = bodies.bones.map((b) => b.name);
  const at = Object.fromEntries(names.map((n, i) => [n, i]));
  const parent = bodies.bones.map((b) => b.parent);
  const heads = figure.heads.map(V);
  const tails = figure.tails.map(V);
  const head = (n) => heads[at[n]];
  const offset = heads.map((h, i) => (parent[i] < 0 ? h.clone() : h.clone().sub(heads[parent[i]])));
  const rest = (a, b) => unit(head(b).clone().sub(head(a)));
  const length = (a, b) => head(a).distanceTo(head(b));

  // How high each ankle is above the sole of its shoe, from the vertices its foot moves most.
  const sole = { L: Infinity, R: Infinity };
  for (let v = 0; v < bodies.vertices; v++) {
    const bone = bodies.skinIndex[4 * v];
    for (const side of ["L", "R"]) if (bone === at[`foot.${side}`]) sole[side] = Math.min(sole[side], figure.position[3 * v + 1]);
  }

  const limb = (side, a, b, c) => ({
    upper: length(`${a}.${side}`, `${b}.${side}`),
    lower: length(`${b}.${side}`, `${c}.${side}`),
    restUpper: rest(`${a}.${side}`, `${b}.${side}`),
    restLower: rest(`${b}.${side}`, `${c}.${side}`),
    restHinge: hinge(head(`${a}.${side}`), head(`${b}.${side}`), head(`${c}.${side}`), X),
  });

  // The open hand at rest: across the knuckles from the forefinger to the little finger, out along the fingers, and
  // the side the palm faces; and the grip across it, which the fingers close round.
  const hand = (side) => {
    const wrist = head(`wrist.${side}`);
    const knuckles = [2, 3, 4, 5].map((f) => head(`finger${f}-1.${side}`));
    const middle = knuckles.reduce((s, k) => s.add(k), new Vector3()).multiplyScalar(1 / knuckles.length);
    const across = unit(knuckles[3].clone().sub(knuckles[0]));
    const out = middle.clone().sub(wrist);
    out.addScaledVector(across, -out.dot(across)).normalize();
    // For a left hand the palm is on this side; for a right hand, the other.
    const palm = new Vector3().crossVectors(across, out).multiplyScalar(side === "L" ? 1 : -1);
    const g = GRIP_ACROSS * RAD;
    const grip = out.clone().multiplyScalar(Math.sin(g)).addScaledVector(across, -Math.cos(g));
    const centre = middle.clone().addScaledVector(out, -GRIP_BACK).addScaledVector(palm, GRIP_OUT);
    return { wrist, across, out, palm, grip, centre };
  };

  // How each joint of each finger turns from its parent to close the hand, as a turn about the axis it bends on.
  const curl = (side, angles) => {
    const { palm } = hand(side);
    const turns = new Map();
    for (const [f, list] of Object.entries(angles)) {
      list.forEach((angle, j) => {
        const name = `finger${f}-${j + 1}.${side}`;
        const i = at[name];
        const next = at[`finger${f}-${j + 2}.${side}`];
        const along = unit((next === undefined ? tails[i] : heads[next]).clone().sub(heads[i]));
        const axis = new Vector3().crossVectors(along, palm);
        if (axis.lengthSq() < 1e-8) return;
        turns.set(i, new Quaternion().setFromAxisAngle(axis.normalize(), angle * RAD));
      });
    }
    return turns;
  };

  // The sword hand's thumb lies along the back of the grip, as parts.js has it: each of its bones turns to point at
  // the next of the thumb's joints there, the knuckle where it leaves the hand, the middle joint and the tip.
  const thumbAlongGrip = (side) => {
    const h = hand(side);
    const g = GRIP_ACROSS * RAD;
    const edge = h.out.clone().multiplyScalar(Math.cos(g)).addScaledVector(h.across, Math.sin(g));
    const point = ([x, y, z]) => h.centre.clone().addScaledVector(h.grip, x + FIST).addScaledVector(edge, y).addScaledVector(h.palm, z);
    const targets = hiltParts().thumb.joints.map(point);
    const turns = new Map();
    // The turn of the bone before, which at rest is the hand's: none.
    let before = new Quaternion();
    const start = heads[at[`finger1-1.${side}`]].clone();
    for (const j of [1, 2, 3]) {
      const i = at[`finger1-${j}.${side}`];
      const next = at[`finger1-${j + 1}.${side}`];
      const bone = (next === undefined ? tails[i] : heads[next]).clone().sub(heads[i]);
      const toward = targets[j - 1].clone().sub(start).normalize();
      const turn = new Quaternion().setFromUnitVectors(unit(bone.clone().applyQuaternion(before)), toward).multiply(before);
      turns.set(i, before.clone().invert().multiply(turn));
      start.add(bone.applyQuaternion(turn));
      before = turn;
    }
    return turns;
  };

  return {
    names,
    at,
    parent,
    heads,
    tails,
    offset,
    ankle: { L: head("foot.L").y - sole.L, R: head("foot.R").y - sole.R },
    legs: { L: limb("L", "upperleg01", "lowerleg01", "foot"), R: limb("R", "upperleg01", "lowerleg01", "foot") },
    arms: { L: limb("L", "upperarm01", "lowerarm01", "wrist"), R: limb("R", "upperarm01", "lowerarm01", "wrist") },
    hands: { L: hand("L"), R: hand("R") },
    curls: { L: new Map([...curl("L", SWORD_CURL), ...thumbAlongGrip("L")]), R: curl("R", REAR_CURL) },
    restFoot: { L: unit(tails[at["foot.L"]].clone().sub(head("foot.L"))), R: unit(tails[at["foot.R"]].clone().sub(head("foot.R"))) },
    restNeck: unit(tails[at.neck03].clone().sub(head("neck01"))),
  };
}

/**
 * Where every bone of a rig is and which way it faces, in the body's frame, for the pose `p`: world turns `q` and
 * the bones' starts `at`, by bone number, with the hand on the blade, `grip`, as gripFrame has it.
 */
export function poseRig(rig, p) {
  const J = skeleton(p);
  const n = rig.names.length;
  const q = Array.from({ length: n }, () => new Quaternion());
  const at = rig.heads.map((h) => h.clone());
  const fixed = new Uint8Array(n);
  const b = (name) => rig.at[name];
  const set = (name, turn) => {
    q[b(name)].copy(turn);
    fixed[b(name)] = 1;
  };
  // Every bone not given a turn of its own turns with its parent; then each starts where its parent puts it.
  const settle = () => {
    for (let i = 0; i < n; i++) {
      const pa = rig.parent[i];
      if (pa < 0) continue;
      if (!fixed[i]) q[i].copy(q[pa]);
      at[i].copy(rig.offset[i]).applyQuaternion(q[pa]).add(at[pa]);
    }
  };

  // The trunk: the hips square to the line between the hip joints, the chest to the line between the shoulders and
  // leaning with the body, and the spine turning from one to the other.
  const hipF = V(J.hipF);
  const hipB = V(J.hipB);
  const sh = V(J.sh);
  const rs = V(J.rs);
  const up = V([J.u[0], J.u[1], 0]);
  const pelvisLeft = unit(hipF.clone().sub(hipB));
  const shoulderLeft = unit(sh.clone().sub(rs));
  const qPelvis = turnTo(Y, X, Y, pelvisLeft);
  const qChest = turnTo(Y, X, up, shoulderLeft);
  set("root", qPelvis);
  set("spine05", qPelvis);
  set("spine04", qPelvis.clone().slerp(qChest, 0.3));
  set("spine03", qPelvis.clone().slerp(qChest, 0.6));
  set("spine02", qPelvis.clone().slerp(qChest, 0.85));
  set("spine01", qChest);
  // The neck leans as the skeleton's does, turning from the shoulders toward the opponent; the head faces the
  // opponent, nodding a little with the lean.
  const headLeft = new Vector3(0, 0, -1);
  const qNeck = turnTo(rig.restNeck, X, V([J.nu[0], J.nu[1], 0]), mix(shoulderLeft, headLeft, 0.6));
  for (const name of ["neck01", "neck02", "neck03"]) set(name, qNeck);
  const nod = J.lean * 0.15 * RAD;
  set("head", turnTo(Y, X, new Vector3(Math.sin(nod), Math.cos(nod), 0), headLeft));
  settle();

  // The middle of the hip joints where the skeleton has the hips.
  const shift = V([...J.hip, 0]).sub(mid(at[b("upperleg01.L")], at[b("upperleg01.R")]));
  for (const point of at) point.add(shift);

  // The legs: the model's left is the leg in front, its right the leg behind. Each ankle goes where the skeleton has
  // it, as far above the floor as the model's ankle is above its sole, the knee bending the way the skeleton's does.
  const tb = (p.toeBack ?? 0) * RAD;
  // Which way each knee bends is the way the skeleton's would with the ankle a little nearer the hip, so that it is
  // settled even where the skeleton's leg is straight and its knee on the line.
  const bentKnee = (hip, ankle, front) => {
    const toward = ankle.clone().sub(hip);
    const a = hip.clone().addScaledVector(toward, 1 - KNEE_SHORTER / toward.length());
    const k = front ? knee3(J.hipF, [a.x, a.y, a.z], 1) : kneeBehind(J.hipB[0], J.hipB[1], a.x, a.y, J.hipB[2], p.kneeOut ?? 40);
    return V(k).sub(mid(hip, a));
  };
  const legs = [
    ["L", hipF, V([...J.ankF, 0]), new Vector3(1, 0, 0)],
    ["R", hipB, V([...J.ankB, 0]), new Vector3(-Math.sin(tb), 0, Math.cos(tb))],
  ];
  for (const [side, h0, a0, foot] of legs) {
    const leg = rig.legs[side];
    const hip = at[b(`upperleg01.${side}`)];
    const ankle = a0.clone().setY(a0.y - 8 + rig.ankle[side]);
    const leftOfFoot = new Vector3().crossVectors(Y, foot).normalize();
    const { joint: knee, axis } = solveJoint(hip, ankle, leg.upper, leg.lower, bentKnee(h0, a0, side === "L"), foot);
    const qThigh = turnTo(leg.restUpper, leg.restHinge, knee.clone().sub(hip), axis);
    set(`upperleg01.${side}`, qThigh);
    set(`upperleg02.${side}`, qThigh);
    const qShin = turnTo(leg.restLower, leg.restHinge, ankle.clone().sub(knee), axis);
    set(`lowerleg01.${side}`, qShin);
    set(`lowerleg02.${side}`, qShin);
    // The foot flat on the floor, its toe the way the skeleton's points, turned up at the toe as it is lifted.
    const restFoot = rig.restFoot[side];
    const pitch = Math.atan2(-restFoot.y, Math.hypot(restFoot.x, restFoot.z));
    const tilt = Math.min(30, Math.max(0, (a0.y - 8) * 2.1)) * RAD;
    const dir = foot.clone().multiplyScalar(Math.cos(pitch - tilt)).add(new Vector3(0, -Math.sin(pitch - tilt), 0));
    set(`foot.${side}`, turnTo(restFoot, X, dir, leftOfFoot));
  }
  settle();

  // The sword hand, the model's left, closes round the grip as gripFrame has the hilt in the hand: the grip along the
  // blade, the palm the way the hand's frame says, the middle of the fist a little back from the hand's point.
  const G = gripFrame(J, { dir: 1 });
  const [ga, gs] = [V(G.a), V(G.s)];
  const hand = rig.hands.L;
  const pinch = V(J.hn).addScaledVector(ga, -PINCH);
  const pinchAtRest = hand.centre.clone().addScaledVector(hand.grip, FIST - PINCH);
  // The hand round the grip, bending at the wrist from `forearm` no further than a wrist can, the sabre turning in the
  // fingers for the rest: the hand's turn, and where that puts the wrist. Given the turn of the forearm, `fore`, the
  // hand also turns about the forearm no further than a forearm can turn it; beyond that it turns back as the sabre
  // goes on turning in the fingers, so that a blade that goes right round, as in a moulinet, takes the hand smoothly.
  const onBlade = turnTo(hand.grip, hand.palm, ga, gs);
  const holding = (forearm, fore) => {
    let turn = onBlade.clone();
    if (fore) {
      const along = rig.arms.L.restLower;
      const t = twistOf(fore.clone().invert().multiply(turn), along);
      const angle = 2 * Math.atan2(new Vector3(t.x, t.y, t.z).dot(along), t.w);
      const most = FOREARM_TURN * RAD;
      const kept = Math.abs(angle) <= most ? angle : (Math.sign(angle) * most * (Math.PI - Math.abs(angle))) / (Math.PI - most);
      turn = new Quaternion().setFromAxisAngle(along.clone().applyQuaternion(fore), kept - angle).multiply(turn);
    }
    const fingers = hand.out.clone().applyQuaternion(turn);
    const bent = fingers.angleTo(forearm);
    if (bent > WRIST_BEND * RAD) {
      const axis = new Vector3().crossVectors(fingers, forearm);
      if (axis.lengthSq() < 1e-10) axis.copy(hand.palm).applyQuaternion(turn);
      turn = new Quaternion().setFromAxisAngle(axis.normalize(), bent - WRIST_BEND * RAD).multiply(turn);
    }
    return { turn, wrist: pinch.clone().add(hand.wrist.clone().sub(pinchAtRest).applyQuaternion(turn)) };
  };

  // The turn of each forearm, as the elbow bends it, before the hand turns it.
  const forearms = {};
  // An arm from its shoulder to `wrist`, the elbow bending toward the skeleton's `e0` from its line from `s0` to `end`,
  // the hand turned `qWrist` (or along the forearm) and its fingers closed.
  const reachFor = (side, wrist, qWrist, e0, s0, end, fallback) => {
    const arm = rig.arms[side];
    set(`clavicle.${side}`, q[b("spine01")]);
    settle();
    // If the hand is out of reach, the shoulder comes forward toward it, turning on the collarbone.
    const reach = REACH * (arm.upper + arm.lower);
    const pivot = at[b(`clavicle.${side}`)];
    const shoulder = at[b(`upperarm01.${side}`)];
    if (shoulder.distanceTo(wrist) > reach) {
      const axis = new Vector3().crossVectors(shoulder.clone().sub(pivot), wrist.clone().sub(pivot));
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        const moved = (angle) => shoulder.clone().sub(pivot).applyAxisAngle(axis, angle).add(pivot);
        let [lo, hi] = [0, SHOULDER_REACH * RAD];
        if (moved(hi).distanceTo(wrist) <= reach) {
          for (let k = 0; k < 20; k++) {
            const m = (lo + hi) / 2;
            if (moved(m).distanceTo(wrist) > reach) lo = m;
            else hi = m;
          }
        }
        set(`clavicle.${side}`, new Quaternion().setFromAxisAngle(axis, hi).multiply(q[b("spine01")]));
        settle();
      }
    }
    const s = at[b(`upperarm01.${side}`)];
    // A sword arm all but straight turns its elbow the way the hand on the blade would have the forearm turn least,
    // where it bends about the axis the hand's turn gives it, and out from the body where that says little.
    const out = side === "L" ? new Vector3().crossVectors(unit(wrist.clone().sub(s)), arm.restHinge.clone().applyQuaternion(onBlade)).addScaledVector(unit(fallback), ELBOW_OUT) : fallback;
    const solved = solveJoint(s, wrist, arm.upper, arm.lower, e0.clone().sub(mid(s0, end)), out);
    // The upper arm and the forearm for the elbow at `joint` bending about `axis`, and how far the hand is turned about
    // the forearm from it.
    const shaped = ({ joint, axis }) => {
      const qUpper = turnTo(arm.restUpper, arm.restHinge, joint.clone().sub(s), axis);
      const qFore = turnTo(arm.restLower, arm.restHinge, wrist.clone().sub(joint), axis);
      const twist = twistOf(qFore.clone().invert().multiply(qWrist ?? qFore), arm.restLower);
      return { qUpper, qFore, twist };
    };
    const { qUpper, qFore, twist } = shaped(solved);
    forearms[side] = qFore;
    set(`upperarm01.${side}`, qUpper);
    set(`upperarm02.${side}`, qUpper);
    // The hand's turn about the forearm is shared out along it, so the wrist does not wring.
    const turnOfHand = qWrist ?? qFore;
    set(`lowerarm01.${side}`, qFore.clone().multiply(new Quaternion().slerp(twist, FOREARM_TWIST[0])));
    set(`lowerarm02.${side}`, qFore.clone().multiply(new Quaternion().slerp(twist, FOREARM_TWIST[1])));
    set(`wrist.${side}`, turnOfHand);
    // The fingers close, each joint turning from the one before.
    for (let i = 0; i < n; i++) {
      const turn = rig.curls[side].get(i);
      if (turn) set(rig.names[i], q[rig.parent[i]].clone().multiply(turn));
      else if (!fixed[i] && rig.parent[i] >= 0) q[i].copy(q[rig.parent[i]]);
    }
    settle();
  };

  // The sword arm reaches for the hand bent from the forearm as the skeleton has it, then again with the hand bent from
  // the forearm that gives, which the wrist can manage. The rear hand, the model's right, goes where the skeleton has it.
  const swordArm = [V(J.el), V(J.sh), V(J.hn), new Vector3(0, -0.3, -1)];
  let held = holding(unit(V(J.hn).sub(V(J.el))));
  reachFor("L", held.wrist, held.turn, ...swordArm);
  held = holding(unit(at[b("wrist.L")].clone().sub(at[b("lowerarm01.L")])), forearms.L);
  reachFor("L", held.wrist, held.turn, ...swordArm);
  reachFor("R", V(J.rh), null, V(J.re), rs, V(J.rh), new Vector3(-0.4, -0.3, 1));
  // Where a hand out of reach falls short of where it would hold the sabre: the sabre goes with it.
  const short = at[b("wrist.L")].clone().sub(held.wrist);
  return { q, at, grip: G, wrists: { L: held.wrist, R: V(J.rh) }, short };
}

/**
 * A fencer as a 3D figure: `group`, to put in a scene, holds the body, a skinned mesh, and the sabre, whose parts are
 * meshes named for what they are. `pose(p, dir)` poses it, dir 1 facing right and -1 facing left.
 */
export function createFigure(bodies, who) {
  const figure = bodies.figures[who];
  const rig = makeRig(bodies, figure);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(figure.position, 3));
  geometry.setAttribute("skinIndex", new BufferAttribute(bodies.skinIndex, 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(bodies.skinWeight, 4, true));
  geometry.setIndex(new BufferAttribute(bodies.index, 1));
  geometry.computeVertexNormals();
  const bones = rig.names.map((name) => Object.assign(new Bone(), { name }));
  bones.forEach((bone, i) => {
    bone.position.copy(rig.offset[i]);
    if (rig.parent[i] >= 0) bones[rig.parent[i]].add(bone);
  });
  const mesh = new SkinnedMesh(geometry);
  mesh.name = `body-${who}`;
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones));
  mesh.frustumCulled = false;
  const sabre = makeSabre();
  sabre.matrixAutoUpdate = false;
  const group = new Group();
  group.add(mesh, sabre);

  return {
    group,
    mesh,
    sabre,
    rig,
    pose(p, dir) {
      const { q, at, grip, short } = poseRig(rig, p);
      bones.forEach((bone, i) => {
        const pa = rig.parent[i];
        if (pa < 0) {
          bone.quaternion.copy(q[i]);
          bone.position.copy(at[i]);
        } else {
          bone.quaternion.copy(q[pa]).invert().multiply(q[i]);
        }
      });
      const [a, e] = [V(grip.a), V(grip.e)];
      sabre.matrix.makeBasis(a, e, new Vector3().crossVectors(a, e)).setPosition(V(skeleton(p).hn).add(short));
      group.position.set(p.x, 0, 0);
      group.rotation.set(0, dir < 0 ? Math.PI : 0, 0);
      group.updateMatrixWorld(true);
    },
  };
}
