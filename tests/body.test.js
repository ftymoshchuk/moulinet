import assert from "node:assert/strict";
import { test } from "node:test";

import { bladePart, footSpan, headPart, legPart, place, rearArm, segment, shoe, shoeAcross, swordArm, torsoFrame, trunk } from "../site/js/body.js";
import { projector, skeleton } from "../site/js/figure.js";
import { area, dist } from "../site/js/ink.js";
import { handParts, headParts, shoeAcrossParts, shoeParts } from "../site/js/parts.js";
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
  assert.equal(sole.length, 3, "the welt above the sole");
  assert.equal(laces.length, 4);
  assert.equal(ink.length, 1, "the dark heel block");
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

test("a shoe is turned up at the toe, and its heel turns with it, when the foot is lifted", () => {
  const parts = shoeParts();
  const flat = shoe([100, 8], 0, parts);
  assert.deepEqual(flat.shape[0].slice(0, 2), [100 + parts.shape[0][0], 8 + parts.shape[0][1]], "set on the ankle");
  assert.deepEqual(flat.shape[0].slice(2), parts.shape[0].slice(2), "and keeping how much of its line it has");
  assert.equal(flat.shape.length, parts.shape.length);
  assert.equal(flat.lines.length, 6, "the welt, the toe cap and four laces");
  assert.equal(flat.ink.length, 1, "the dark heel goes with it");
  assert.equal(flat.hatch.length, parts.hatch.length);
  const toeOf = (made) => made.shape.reduce((best, p) => (p[0] > best[0] ? p : best));
  near(toeOf(flat)[0] - 100, 21.4, 1e-9, "the toe is the whole length of the shoe from the ankle");

  const tilted = shoe([100, 8], 30, parts);
  assert.ok(toeOf(tilted)[1] > toeOf(flat)[1] + 8, "a foot off the floor lands on its heel");
  const heelFront = (made) => made.ink[0].reduce((best, p) => (p[0] > best[0] ? p : best));
  assert.ok(heelFront(tilted)[0] > heelFront(flat)[0] + 3, "and its dark heel block turns with it, the foot pivoting on the ankle");
});

// ---------- The foot behind ----------

// Where a drawn foot stands on the page, from the points of its shapes.
const extentOf = (shapes) => {
  const points = shapes.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), middle: (Math.min(...xs) + Math.max(...xs)) / 2 };
};

// The foot behind of a pose, set on the page for a fencer facing `dir` from `camera`.
function footBehind({ dir = 1, camera = 0, older = false, adj = {} } = {}) {
  const pose = resolvePose({ pose: "guard", adj });
  const J = skeleton(pose);
  const W = projector(pose, dir, camera);
  const foot = shoeAcross(J.ankB, W, J.toeBack, older);
  return { foot, J, W, ...extentOf(foot.shapes), ankle: W(J.ankB)[0] };
}

test("the shoe of the foot behind has its toe at the camera: side on, it is seen end on, and the foot in front is seen long", () => {
  const behind = footBehind();
  const front = legPart(behind.J, behind.W, behind.J.ankF, behind.J.kF, { front: true, seat: false, older: false });
  const shoeOf = readPath(front.g).at(-1);
  assert.ok(behind.maxX - behind.minX < 16, `end on, it is ${behind.maxX - behind.minX} cm across`);
  assert.ok(boxOf([shoeOf]).maxX - boxOf([shoeOf]).minX > 25, "and the shoe in front, which points at the opponent, is the length of a foot");
  assert.ok(Math.abs(behind.middle - behind.ankle) < 5, "under the ankle, the toe coming at the camera and not at the opponent");
  near(behind.minY, -10, 0.6, "as high as the ankle bone, where the stocking goes in");
  assert.ok(behind.maxY > 0 && behind.maxY < 0.8, "on the floor, with the sole bowing a little below it, as a toe nearer than the heel does");
});

test("the camera turns the foot behind: its toe goes toward the opponent from one side and away from the other, for a fencer facing either way", () => {
  for (const dir of [1, -1]) {
    const toward = footBehind({ dir, camera: 60 });
    const away = footBehind({ dir, camera: -60 });
    const square = footBehind({ dir, camera: 0 });
    assert.ok(toward.maxX - toward.minX > 20 && away.maxX - away.minX > 20, `${dir}: from the side it is the length of a shoe`);
    assert.ok((toward.maxX - toward.minX) / (square.maxX - square.minX) > 1.6, `${dir}: and much longer than end on`);
    assert.ok(dir * (toward.middle - toward.ankle) > 4, `${dir}: the toe is toward the opponent`);
    assert.ok(dir * (away.middle - away.ankle) < -4, `${dir}: or away from them`);
  }
  // A foot turned a little back from the camera shows its toe a little back of the ankle, when seen square.
  const back = footBehind({ camera: 0 });
  assert.ok(back.middle < back.ankle, "turned back from the camera by the guard's toeBack");
});

test("the foot behind stands on the floor and rises with its ankle", () => {
  const planted = footBehind();
  const lifted = footBehind({ adj: { liftB: 7 } });
  near(planted.minY - lifted.minY, 7, 1e-9, "the whole shoe goes up with the ankle");
  near(planted.maxY - lifted.maxY, 7, 1e-9);
  near(lifted.maxX - lifted.minX, planted.maxX - planted.minX, 1e-9, "and does not change shape");
});

test("an older man's trousers hang over the top of the shoe, so what is under the cloth is left out", () => {
  const young = footBehind();
  const older = footBehind({ older: true, dir: -1 });
  assert.ok(older.foot.lines.length < young.foot.lines.length, "no collar, and fewer laces");
  const highest = (made) => Math.max(...made.foot.lines.flat().map((p) => -p[1]));
  assert.ok(highest(young) > 9, "a young man's collar is at the ankle");
  assert.ok(highest(older) < 8.5, "an older man's lines stop where the cloth begins");
  assert.deepEqual(older.foot.shapes.map((shape) => shape.length), young.foot.shapes.map((shape) => shape.length), "though the shoe itself is the same");
});

test("the shade is on the right of the page, for a fencer facing either way, and is lost where the shoe turns from the camera", () => {
  for (const dir of [1, -1]) {
    const square = footBehind({ dir, camera: 0 });
    // (The mirror of a foot turned back from the camera shows the other wall of the shoe, so some of the shade is out of sight.)
    assert.ok(square.foot.hatch.length >= 2, `${dir}: strokes of shade`);
    for (const stroke of square.foot.hatch) {
      assert.equal(stroke.length, 2);
      assert.ok(stroke[0][0] > square.middle, `${dir}: right of the middle of the shoe`);
    }
  }
  // Turned so that the right is the side away from the camera, those strokes are on the far side of the shoe.
  const facing = footBehind({ camera: -60 });
  const turnedAway = footBehind({ camera: 60 });
  assert.ok(facing.foot.hatch.length > turnedAway.foot.hatch.length, "fewer when the shade is on the side that cannot be seen");
  // The seam across the toe cap is the same: whatever is seen of it is drawn, and none where the box is turned right away.
  for (const camera of [-60, -30, 0, 30, 60]) {
    for (const stroke of footBehind({ camera }).foot.hatch) assert.ok(stroke.every((p) => p.every(Number.isFinite)));
  }
});

test("the span of the foot behind is how far its sole reaches either side of the ankle on the piste", () => {
  const J = skeleton(resolvePose({ pose: "guard" }));
  for (const camera of [-60, 0, 25, 60]) {
    const W = projector({ x: 0 }, 1, camera);
    const [from, to] = footSpan(W, J.toeBack);
    const { minX, maxX } = extentOf(shoeAcross(J.ankB, W, J.toeBack).shapes);
    // (The page is the piste compressed by the camera, so a span on the piste is taken across it.)
    const c = Math.cos((camera * Math.PI) / 180);
    near(W([J.ankB[0] + from, 0])[0] - W([J.ankB[0], 0])[0], (minX - W(J.ankB)[0]), 1e-9, `${camera}°: the foot's near edge`);
    assert.ok(to > 0 && from < 0 && (to - from) * c > 12, `${camera}°: either side of the ankle`);
    near((to - from) * c, maxX - minX, 1e-9, `${camera}°: as wide as the sole`);
  }
});

test("how far the toe is turned back is the pose's: 0 is seen square from a level camera, and the more, the further back the toe is seen", () => {
  const square = footBehind({ adj: { toeBack: 0 } });
  near(square.middle, square.ankle, 1e-9, "turned back 0°, the shoe is seen square, its middle under the ankle");
  let last = square;
  for (const toeBack of [14, 30, 45]) {
    const turned = footBehind({ adj: { toeBack } });
    assert.ok(turned.middle < last.middle - 1, `${toeBack}°: the toe is further back`);
    assert.ok(turned.maxX - turned.minX > last.maxX - last.minX + 1, `${toeBack}°: and the shoe is seen longer`);
    last = turned;
  }
});

test("the span of the foot behind follows the pose's toeBack, and reaches further back the more the toe is turned back", () => {
  let last = 0;
  for (const toeBack of [0, 14, 30, 45]) {
    const J = skeleton(resolvePose({ pose: "guard", adj: { toeBack } }));
    const W = projector({ x: 0 }, 1, 0);
    const [from, to] = footSpan(W, J.toeBack);
    const { minX, maxX } = extentOf(shoeAcross(J.ankB, W, J.toeBack).shapes);
    near(W([J.ankB[0] + from, 0])[0] - W([J.ankB[0], 0])[0], minX - W(J.ankB)[0], 1e-9, `${toeBack}°: the foot's near edge`);
    near(to - from, maxX - minX, 1e-9, `${toeBack}°: as wide as the sole`);
    assert.ok(from < last, `${toeBack}°: further back than at the turn before`);
    last = from;
  }
});

test("the shoe of the foot behind stands as high as the profile shoe, from the heel to the toe", () => {
  const { domes, sole, laces, seam, hatch, collar } = shoeAcrossParts();
  const profile = shoeParts().shape;
  assert.ok(domes.length >= 3);
  for (const [mid, half, wide, high, square] of domes) {
    assert.ok([mid, half, wide, high, square].every(Number.isFinite) && half > 0 && wide > 0 && high > 0, "a dome with a size");
    assert.ok(square > 1, "a dome that is not a diamond or a spike, which the support of its footprint needs");
  }
  near(Math.min(...domes.map((d) => d[0] - d[1])), Math.min(...profile.map((p) => p[0])), 1, "the heel");
  near(Math.max(...domes.map((d) => d[0] + d[1])), Math.max(...profile.map((p) => p[0])), 1, "the toe");
  near(Math.max(...domes.map((d) => d[3])) - 8, Math.max(...profile.map((p) => p[1])), 0.5, "the ankle, 8 cm above the floor");
  assert.ok(!("turn" in shoeAcrossParts()), "how far it is turned back is the pose's toeBack, not the shoe's");
  assert.ok(sole.height > 0 && sole.edge > 0 && sole.bow > 0);
  assert.ok(laces.length === 4 && laces.every((along) => along > 0 && along < 10), "the laces are on the instep");
  assert.ok(seam > domes[2][0] && seam < domes[2][0] + domes[2][1], "the seam is on the front half of the toe box");
  assert.ok(hatch.length >= 4 && hatch.every(([which, across, along, length]) => domes[which] && across > 0 && length > 1 && Number.isFinite(along)));
  assert.ok(collar.wide > 3 && collar.ends > collar.middle, "the collar dips toward the middle");
  assert.equal(shoeAcrossParts(), shoeAcrossParts(), "a part is shared, and not changed by drawing");
});

test("the legs: the foot behind is turned across, the seat belongs to one leg, a lifted foot is turned up", () => {
  const { J, W } = posed();
  const shoeOf = (leg) => {
    const shapes = readPath(leg.g);
    return widthOf(shapes[shapes.length - 1]);
  };
  const front = legPart(J, W, J.ankF, J.kF, { front: true, seat: false, older: false });
  const back = legPart(J, W, J.ankB, J.kB, { front: false, seat: false, older: false });
  assert.ok(shoeOf(back)[0] < shoeOf(front)[0] * 0.6, "turned across, so seen end on, where the foot in front is seen long");
  assert.equal(readPath(back.g).length, readPath(front.g).length + 1, "the shoe behind is its upper and its sole");

  const seated = legPart(J, W, J.ankF, J.kF, { front: true, seat: true, older: false });
  assert.equal(readPath(seated.g).length, readPath(front.g).length + 1, "the hips and seat are one more shape");

  const lifted = posed("guard", { liftF: 20 });
  const raised = legPart(lifted.J, lifted.W, lifted.J.ankF, lifted.J.kF, { front: true, seat: false, older: false });
  assert.ok(shoeOf(raised)[1] > shoeOf(front)[1] + 3, "the toe is up");
  const heavy = posed("guard", { liftF: 80 });
  const high = legPart(heavy.J, heavy.W, heavy.J.ankF, heavy.J.kF, { front: true, seat: false, older: false });
  assert.ok(shoeOf(high)[1] < 24, "though only so far");
});

test("the leg behind is drawn with the pose's toeBack in its shoe, and the foot in front does not turn with it", () => {
  const legs = (toeBack) => {
    const { J, W } = posed("guard", { toeBack });
    return {
      back: legPart(J, W, J.ankB, J.kB, { front: false, seat: false, older: false }),
      front: legPart(J, W, J.ankF, J.kF, { front: true, seat: false, older: false }),
    };
  };
  const [guard, turned] = [legs(14), legs(40)];
  assert.notDeepEqual(turned.back, guard.back, "the shoe behind turns");
  assert.deepEqual(turned.front, guard.front, "and the foot in front does not");
});

test("a knee turned toward the camera is drawn where the camera sees it, and the leg is drawn to that knee", () => {
  const pose = resolvePose({ pose: "guard" });
  const J = skeleton(pose);
  const [x, y, z] = J.kB;
  assert.ok(z > 5, "the knee behind has a depth");
  for (const camera of [-60, -25, 0, 25, 60]) {
    const W = projector(pose, 1, camera);
    // On the piste, a knee that is nearer the camera is as much further along as the camera turns its depth into.
    const along = x + z * Math.tan((camera * Math.PI) / 180);
    near(W([x, y, z])[0], W([along, y])[0], 1e-9, `${camera}°: where the camera sees the knee`);
    const turned = legPart(J, W, J.ankB, J.kB, { front: false, seat: false, older: false });
    const placed = legPart(J, W, J.ankB, [along, y], { front: false, seat: false, older: false });
    assert.deepEqual(turned, placed, `${camera}°: and the leg is drawn to it`);
  }
  const flat = legPart(J, projector(pose, 1, 30), J.ankB, [x, y], { front: false, seat: false, older: false });
  assert.notEqual(flat.g, legPart(J, projector(pose, 1, 30), J.ankB, J.kB, { front: false, seat: false, older: false }).g, "seen from a quarter, it is not where a knee in the plane of the piste would be");
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
  assert.equal(readPath(trunkOf.d).length, 1, "one line where the collar turns over, and no more");
  assert.ok(readPath(trunkOf.k).length >= 8, "and a few long folds, not a row of ticks");
  assert.ok(readPath(trunkOf.k).length <= 14, "not many more than a few");
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
  for (const key of ["g", "hair", "k"]) assert.match(head[key], /^M/, key);
  assert.match(head.s, /^M/, "a young man's dark hair has strokes of paper left in it");
  assert.equal(headPart(J, W, true).s, "", "and an older man's thin grey hair has none");
  const old = headPart(J, W, true);
  assert.notEqual(old.hair, head.hair);
  // An older man's head is a little larger, and carried lower and further forward.
  const oldBox = boxOf(readPath(old.g));
  assert.ok(oldBox.maxY - oldBox.minY > (box.maxY - box.minY) * 1.04, "a little larger");
  const oldCentre = [(oldBox.minX + oldBox.maxX) / 2, (oldBox.minY + oldBox.maxY) / 2];
  assert.ok(oldCentre[0] > centre[0] + 0.5 && oldCentre[1] > centre[1] + 0.5, "lower and further forward");

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
