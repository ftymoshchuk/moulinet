import assert from "node:assert/strict";
import { test } from "node:test";

import { bladePart, headPart, legPart, place, rearArm, segment, shoe, swordArm, torsoFrame, trunk } from "../site/js/body.js";
import { projector, skeleton } from "../site/js/figure.js";
import { area, dist } from "../site/js/ink.js";
import { handParts, headParts, shoeParts } from "../site/js/parts.js";
import { resolvePose } from "../site/js/phrase.js";
import { boxOf, readPath } from "./path-data.js";

function near(actual, expected, tolerance, message = "") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} ${actual} is not within ${tolerance} of ${expected}`);
}

// A pose, with its joints and the projector that sets it on the page facing right, side on.
function posed(name = "guard", adj = {}, camera = 0) {
  const pose = resolvePose({ pose: name, adj });
  return { pose, J: skeleton(pose), W: projector(pose, 1, camera) };
}

const widthOf = (shape) => {
  const box = boxOf([shape]);
  return [box.maxX - box.minX, box.maxY - box.minY];
};

// ---------- What is drawn by hand ----------

test("the hand-drawn parts are made of finite points, and the hair lies on the head", () => {
  const finite = (points) => points.every((p) => p.length >= 2 && p.slice(0, 2).every(Number.isFinite));
  for (const older of [false, true]) {
    const head = headParts(older);
    for (const key of ["skull", "hair", "ear", "earFold"]) assert.ok(head[key].length >= 3 && finite(head[key]), `${key}, older ${older}`);
    for (const strokes of [...head.streaks, ...head.tufts]) assert.ok(strokes.length >= 2 && finite(strokes));
    for (const mark of Object.values(head.face)) assert.ok(mark.length >= 3 && finite(mark.slice(0, 3)) && mark.at(-1) > 0, "a mark has points and a thickness");
    const xs = head.skull.map((p) => p[0]);
    const ys = head.skull.map((p) => p[1]);
    for (const [x, y] of head.hair) {
      assert.ok(x > Math.min(...xs) - 1.5 && x < Math.max(...xs) + 1.5, `hair at ${x}, ${y}`);
      assert.ok(y > Math.min(...ys) - 1.5 && y < Math.max(...ys) + 1.5, `hair at ${x}, ${y}`);
    }
  }
});

test("an older man has the same face and a balding man's hair", () => {
  const young = headParts(false);
  const older = headParts(true);
  for (const key of ["skull", "ear", "earFold", "face"]) assert.equal(older[key], young[key], key);
  for (const key of ["hair", "streaks", "tufts"]) assert.notDeepEqual(older[key], young[key], key);
  assert.ok(Math.abs(area(older.hair)) < Math.abs(area(young.hair)) / 2, "less hair, and none on top");
  assert.deepEqual(headParts(), young, "the young man is the default");
});

test("the sword hand is behind the guard and the rear hand starts at the wrist", () => {
  const { fist, hip } = handParts();
  for (const [x] of [...fist.shape, ...fist.lines.flat()]) assert.ok(x <= 0, "the fist reaches back from the grip");
  assert.ok(Math.max(...fist.shape.map((p) => p[0])) > -3, "and its front is at the grip");
  assert.ok(Math.min(...hip.shape.map((p) => p[0])) >= -1, "the rear hand starts at the wrist");
  assert.ok(Math.max(...hip.shape.map((p) => p[0])) > 10, "and its fingers run along the forearm");
  assert.notEqual(handParts().fist, fist, "each call hands back its own copy");
});

test("the shoe stands on the floor 8 cm below the ankle, toe forward and heel back", () => {
  const { shape, sole, laces, ink, hatch } = shoeParts();
  near(Math.min(...shape.map((p) => p[1])), -8, 0.5, "the sole");
  assert.ok(Math.max(...shape.map((p) => p[0])) > 20 && Math.min(...shape.map((p) => p[0])) < -5, "toe and heel");
  assert.equal(sole.length, 3);
  assert.equal(laces.length, 4);
  assert.equal(ink.length, 2, "the dark sole and heel");
  assert.ok(hatch.length >= 6 && hatch.every((stroke) => stroke.length === 2), "strokes on the heel and the toe cap");
  for (const [, y] of ink.flat()) assert.ok(y < -4.9 && y > -8.7, "the sole and heel are low on the shoe");
});

// ---------- The builders ----------

test("a limb segment runs round its bone, as far out as it is told on each side", () => {
  const rounded = segment([0, 0], [10, 0], [3, 3], [2, 2], [0, 1]);
  assert.equal(rounded.length, 10, "two stations on each side, and three points round each end");
  let box = boxOf([{ points: rounded }]);
  near(box.maxY, 3, 1e-9, "as far out on the side that faces the reference");
  near(box.minY, -2, 1e-9, "and as far on the other");
  assert.ok(box.minX < -1 && box.maxX > 11, "the ends are rounded off past the joints");

  const flat = segment([0, 0], [10, 0], [3, 3], [2, 2], [0, 1], [0, 0]);
  box = boxOf([{ points: flat }]);
  near(box.minX, 0, 1e-9, "no cap, no overhang");
  near(box.maxX, 10, 1e-9);

  const flipped = boxOf([{ points: segment([0, 0], [10, 0], [3, 3], [2, 2], [0, -1]) }]);
  near(flipped.maxY, 2, 1e-9, "turned to face the other way");
  near(flipped.minY, -3, 1e-9);

  const tapered = segment([0, 0], [10, 0], [4, 3, 2], [4, 3, 2], [0, 1]);
  assert.equal(tapered.length, 12);
  assert.ok(tapered.some((p) => p[0] === 5 && p[1] === 3), "its width is sampled evenly along the bone");
});

test("a point of a frame is the origin, then so far along the axis, then so far to its left", () => {
  assert.deepEqual(place([1, 1], [1, 0], 2, 3).map(Math.round), [3, 4]);
  assert.deepEqual(place([1, 1], [0, 1], 2, 3).map(Math.round), [-2, 3]);
});

test("a shoe is turned up at the toe, and seen short when it points across", () => {
  const parts = shoeParts();
  const flat = shoe([100, 8], 0, 1, parts);
  assert.deepEqual(flat.shape[0], [100 + parts.shape[0][0], 8 + parts.shape[0][1]], "set on the ankle");
  assert.equal(flat.shape.length, parts.shape.length);
  assert.equal(flat.lines.length, 7, "the sole, the heel, the toe cap and four laces");
  assert.equal(flat.ink.length, 2, "the dark sole and heel go with it");
  assert.equal(flat.hatch.length, parts.hatch.length);
  const toeOf = (made) => made.shape.reduce((best, p) => (p[0] > best[0] ? p : best));

  const short = shoe([100, 8], 0, 0.5, parts);
  near(toeOf(short)[0] - 100, 21.4 / 2, 1e-9, "the toe comes back by the length");
  assert.deepEqual(short.shape[0], flat.shape[0], "the heel stays where it was");

  const tilted = shoe([100, 8], 30, 1, parts);
  assert.ok(toeOf(tilted)[1] > toeOf(flat)[1] + 8, "a foot off the floor lands on its heel");
  const soleToe = (made) => made.ink[0].reduce((best, p) => (p[0] > best[0] ? p : best));
  assert.ok(soleToe(tilted)[1] > soleToe(flat)[1] + 8, "and its sole turns with it");
});

test("the legs: the foot behind is seen shorter, the seat belongs to one leg, a lifted foot is turned up", () => {
  const { J, W } = posed();
  const shoeOf = (leg) => {
    const shapes = readPath(leg.g);
    return widthOf(shapes[shapes.length - 1]);
  };
  const front = legPart(J, W, J.ankF, J.kF, { front: true, seat: false, older: false });
  const back = legPart(J, W, J.ankB, J.kB, { front: false, seat: false, older: false });
  assert.ok(shoeOf(back)[0] < shoeOf(front)[0] * 0.85, "turned across, so short");

  const seated = legPart(J, W, J.ankF, J.kF, { front: true, seat: true, older: false });
  assert.equal(readPath(seated.g).length, readPath(front.g).length + 1, "the hips and seat are one more shape");

  const lifted = posed("guard", { liftF: 20 });
  const raised = legPart(lifted.J, lifted.W, lifted.J.ankF, lifted.J.kF, { front: true, seat: false, older: false });
  assert.ok(shoeOf(raised)[1] > shoeOf(front)[1] + 3, "the toe is up");
  const heavy = posed("guard", { liftF: 80 });
  const high = legPart(heavy.J, heavy.W, heavy.J.ankF, heavy.J.kF, { front: true, seat: false, older: false });
  assert.ok(shoeOf(high)[1] < 24, "though only so far");
});

test("an older man is in loose trousers, with no pouch of cloth at the knee", () => {
  const { J, W } = posed();
  const young = legPart(J, W, J.ankF, J.kF, { front: true, seat: false, older: false });
  const older = legPart(J, W, J.ankF, J.kF, { front: true, seat: false, older: true });
  assert.notEqual(older.g, young.g);
  assert.notEqual(older.k, young.k, "and folds of loose cloth, pulled from the crotch");
  assert.ok(older.d.length > 0 && young.d.length > 0);
});

test("the trunk is a jersey, a neck and a collar, with its seams and the shading on it", () => {
  const { J, W } = posed();
  const trunkOf = trunk(J, W, false);
  assert.equal(readPath(trunkOf.g).length, 3, "jersey, neck, collar");
  assert.equal(readPath(trunkOf.d).length, 3, "the collar's two lines, and the stitching of the hem");
  assert.ok(readPath(trunkOf.k).length >= 10, "and a few long folds, not a row of ticks");
  assert.ok(readPath(trunkOf.k).length < readPath(trunk(J, W, true).k).length, "an older man has the folds of a belly as well");
  // The belly of an older man shows low on the jersey, at the waist.
  const waist = (trunkDrawn) => {
    const points = readPath(trunkDrawn.g)[0].points;
    const lowest = Math.max(...points.map((p) => p[1]));
    const highest = Math.min(...points.map((p) => p[1]));
    const low = points.filter((p) => p[1] > lowest - (lowest - highest) * 0.15);
    return { front: Math.max(...low.map((p) => p[0])), back: Math.min(...low.map((p) => p[0])) };
  };
  const young = waist(trunkOf);
  const older = waist(trunk(J, W, true));
  assert.ok(older.front - young.front > 0.6, `an older man carries more at the front (${older.front - young.front})`);
  assert.ok(older.front - young.front > older.back - young.back, "more at the front than at the back");
  near(older.back, young.back, 1.5, "and the back is not much changed");
});

// How wide the jersey looks, front to back across the page, `up` cm above the hips.
const widthAt = (frame, up) => {
  const { front, back } = frame.slice(up);
  return front[0] - back[0];
};

test("turned toward the camera the shoulders are broad and taper to the waist; side on they are not", () => {
  const frameOf = (turn, camera = 0, older = false) => {
    const { J, W } = posed("guard", { turn }, camera);
    return torsoFrame(J, W, older);
  };
  const turned = frameOf(58);
  const side = frameOf(0);
  assert.ok(widthAt(turned, 48) > widthAt(turned, 15) * 1.15, "broader at the shoulders than at the waist");
  assert.ok(widthAt(turned, 48) > widthAt(side, 48) + 8, "and broader than the same man side on");
  near(widthAt(side, 48), widthAt(side, 15), 2, "side on he is as deep at the shoulders as at the hips");
  // The camera swings the jersey round as it swings: round to where the shoulders are square to it, they are side on again.
  near(widthAt(frameOf(58, 60), 48), widthAt(side, 48), 1.5, "turned 58° and seen from 60° round");
  near(widthAt(frameOf(0, 60), 48), widthAt(turned, 48), 1.5, "and the other way about");
  // An older man's shoulders are narrower and his waist is not.
  const older = frameOf(58, 0, true);
  assert.ok(widthAt(older, 48) < widthAt(turned, 48), "narrower shoulders");
  assert.ok(widthAt(older, 15) >= widthAt(turned, 15) - 0.5, "a waist as full");
});

test("a point of the jersey is found by its height and how far it is across, from the back, -1, to the front, 1", () => {
  const { J, W } = posed();
  const frame = torsoFrame(J, W, false);
  const { front, back } = frame.slice(30);
  assert.deepEqual(frame.across(30, -1), back);
  assert.deepEqual(frame.across(30, 1), front);
  near(frame.across(30, 0)[0], (front[0] + back[0]) / 2, 1e-9);
  near(frame.across(30, 0)[1], (front[1] + back[1]) / 2, 1e-9);
  // Higher on the jersey is higher on the page, though the body leans.
  assert.ok(frame.across(45, 0)[1] < frame.across(15, 0)[1]);
  // Between two slices the shape is between theirs, and beyond the last it is the last's.
  const { rows } = frame;
  const mid = (rows[2][0] + rows[3][0]) / 2;
  const [a, b, c] = [rows[2][0], mid, rows[3][0]].map((up) => widthAt(frame, up));
  assert.ok(b >= Math.min(a, c) - 0.01 && b <= Math.max(a, c) + 0.01, "between its neighbours");
});

test("the rear sleeve starts on the jersey itself, so the shoulder is the jersey's and not a tube set on it", () => {
  const { J, W } = posed();
  const hands = handParts();
  const frame = torsoFrame(J, W, false);
  const sleeve = readPath(rearArm(J, W, hands.hip, frame).g)[0].points;
  for (const [up, v] of [[54.2, -0.97], [52.4, -1], [50.4, -1]]) {
    const anchor = frame.across(up, v);
    assert.ok(sleeve.some((p) => dist(p, anchor) < 0.15), `the sleeve is joined to the jersey ${up} cm up`);
  }
});

test("the arms carry their hands: the fist is at the grip and the other hand on the hip", () => {
  const { J, W } = posed();
  const hands = handParts();
  const sword = swordArm(J, W, hands.fist);
  const shapes = readPath(sword.g);
  assert.equal(shapes.length, 4, "sleeve, forearm, cuff and fist");
  assert.equal(readPath(sword.d).length, hands.fist.lines.length);
  const grip = W(J.hn);
  for (const p of shapes[3].points) assert.ok(dist(p, grip) < 15, "the fist is round the grip");

  const rear = rearArm(J, W, hands.hip);
  assert.equal(readPath(rear.g).length, 4, "sleeve, forearm, hand and the point of the elbow");
  const hip = W(J.rh);
  for (const p of readPath(rear.g)[2].points) assert.ok(dist(p, hip) < 15, "the hand is at the end of the forearm");
});

test("the head sits where the skeleton puts it, and turns older with the hair", () => {
  const { J, W } = posed();
  const head = headPart(J, W, false);
  const box = boxOf(readPath(head.g));
  const centre = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  assert.ok(dist(centre, W(J.hd)) < 3);
  assert.ok(box.maxY - box.minY > 20 && box.maxY - box.minY < 30, "about a head tall");
  for (const key of ["g", "hair", "s", "d", "k"]) assert.match(head[key], /^M/, key);
  assert.equal(headPart(J, W, true).g, head.g, "the same skull");
  assert.notEqual(headPart(J, W, true).hair, head.hair);

  const turned = headPart(J, projector(posed().pose, 1, 60), false);
  const narrow = boxOf(readPath(turned.g));
  assert.ok(narrow.maxX - narrow.minX < (box.maxX - box.minX) * 0.7, "seen from the side it is turned away from");
});

test("the sabre is a blade 83 cm long from the cup, a cup over the blade, and a bow back under the fist", () => {
  const { J, W } = posed();
  const blade = bladePart(J, W);
  const [taper] = readPath(blade.k);
  assert.equal(taper.points.length, 4);
  near(dist(taper.points[0], taper.points[1]), 83, 0.5, "from 5 cm out to the tip");
  assert.ok(dist(taper.points[0], taper.points[3]) > dist(taper.points[1], taper.points[2]) * 2, "thicker at the cup than at the tip");
  const [cup] = readPath(blade.g);
  assert.equal(cup.points.length, 13, "twelve points, and the one that shuts the curve");
  assert.ok(cup.closed);
  // The bell seen from the side is a thin crescent across the blade, 3 cm out along it, open toward the hand.
  const near3 = W(J.at(3));
  const along = [W(J.tip)[0] - W(J.at(5))[0], W(J.tip)[1] - W(J.at(5))[1]];
  const long = Math.hypot(...along);
  const u = [along[0] / long, along[1] / long];
  const lengthwise = cup.points.map((p) => (p[0] - near3[0]) * u[0] + (p[1] - near3[1]) * u[1]);
  const crosswise = cup.points.map((p) => -(p[0] - near3[0]) * u[1] + (p[1] - near3[1]) * u[0]);
  const span = (list) => Math.max(...list) - Math.min(...list);
  near(span(crosswise), 11.2, 0.6, "across the blade");
  assert.ok(span(lengthwise) < span(crosswise) * 0.5, "and thin along it");
  assert.ok(Math.max(...lengthwise) > 1.5 && Math.min(...lengthwise) > -1.5, "bulging toward the blade");
  assert.ok(readPath(blade.d)[0].points.length >= 3, "the bow");
});
