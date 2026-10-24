import assert from "node:assert/strict";
import { test } from "node:test";

import { along, crotchFan, crotchFolds, cuffGathers, groundStrokes, kneeFolds, kneePuckers, sleeveFolds, sockWrinkles, thighFolds, torsoFolds, waistband } from "../site/js/folds.js";
import { area, blob, brush, curve, dist, inside, lerp, line, perp, ribbon, rotate, solid, unit, wound } from "../site/js/ink.js";
import { boxOf, readPath } from "./path-data.js";

// Path data is written to a tenth of a unit, so a point is that close to where it was given.
const TENTH = 0.051;

function near(actual, expected, tolerance = TENTH, message = "") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} ${actual} is not within ${tolerance} of ${expected}`);
}

function nearPoint(actual, expected, tolerance = TENTH, message = "") {
  near(actual[0], expected[0], tolerance, `${message} x:`);
  near(actual[1], expected[1], tolerance, `${message} y:`);
}

test("a closed curve goes through every point it is given, once, and shuts", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const [shape] = readPath(curve(square));
  assert.equal(shape.closed, true);
  assert.equal(shape.points.length, 5, "the start, and a stretch to each point, the last back to the start");
  shape.points.forEach((p, i) => nearPoint(p, square[i % 4], TENTH, `point ${i}`));
  assert.equal(shape.controls.length, 8, "two handles for each stretch");
});

test("a curve that is not closed ends at its last point and is not shut", () => {
  const points = [[0, 0], [10, 5], [20, 0], [30, 8]];
  const d = line(points);
  assert.doesNotMatch(d, /Z/i);
  const [shape] = readPath(d);
  assert.equal(shape.closed, false);
  assert.equal(shape.points.length, points.length);
  shape.points.forEach((p, i) => nearPoint(p, points[i]));
});

test("a curve leaves each point in the line of the way it came, but a corner turns", () => {
  const [bend] = readPath(line([[0, 0], [10, 5], [20, 0]]));
  const [, arrive, leave] = bend.controls;
  const mid = bend.points[1];
  const into = [mid[0] - arrive[0], mid[1] - arrive[1]];
  const out = [leave[0] - mid[0], leave[1] - mid[1]];
  assert.ok(Math.abs(into[0] * out[1] - into[1] * out[0]) < 0.5, "the two handles lie on one line");
  assert.ok(into[0] * out[0] + into[1] * out[1] > 0, "and run the same way");

  const [corner] = readPath(line([[0, 0], [10, 0, 1], [10, 10]]));
  nearPoint(corner.controls[1], corner.points[1], 1e-9, "the handle into a corner");
  nearPoint(corner.controls[2], corner.points[1], 1e-9, "the handle out of a corner");
});

test("a curve is written in tenths of a unit, with no stray minus zero", () => {
  const d = curve([[0, 0], [0.04, -0.04], [0.3, 0.2], [-0.03, 0.01], [-2345.678, 2345.678]]) + brush([[0, 0], [0.03, -0.02]], 0.01);
  for (const token of d.match(/-?\d[\d.]*/g)) {
    assert.match(token, /^-?\d+(\.\d)?$/, `${token} has more than a tenth`);
    assert.doesNotMatch(token, /^-0(\.0)?$/, "no zero is written with a sign");
  }
});

test("shapes are wound one way, whichever way their points ran", () => {
  const clockwise = [[0, 0], [0, 10], [10, 10], [10, 0]];
  const anticlockwise = clockwise.slice().reverse();
  assert.ok(area(clockwise) < 0 && area(anticlockwise) > 0);
  assert.deepEqual(wound(clockwise), anticlockwise);
  assert.equal(wound(anticlockwise), anticlockwise, "a shape already wound that way is left alone");
  for (const points of [clockwise, anticlockwise]) {
    const [shape] = readPath(blob(points));
    assert.ok(area(shape.points) > 0, "so shapes drawn together are one shape");
  }
  assert.equal(blob(clockwise), blob(clockwise));
});

test("a brush stroke is a lens: pointed at both ends, widest where it swells", () => {
  const [lens] = readPath(brush([[0, 0], [10, 0]], 2));
  assert.equal(lens.closed, true);
  assert.equal(lens.points.length, 8, "eight corners");
  nearPoint(lens.points[0], [0, 0]);
  nearPoint(lens.points[4], [10, 0]);
  near(dist(lens.points[2], lens.points[6]), 2, 0.11, "the width");
  near(lens.points[2][0], 4.5, TENTH, "the widest place is 0.45 of the way along");
  for (const i of [1, 3, 5, 7]) {
    const across = dist(lens.points[i], lens.points[8 - i]);
    assert.ok(across < 1.9, `the sides nearer the ends are narrower (${across})`);
  }
  const [early] = readPath(brush([[0, 0], [10, 0]], 2, 0.2));
  near(early.points[2][0], 2, TENTH, "a stroke that swells early is widest early");
});

test("a brush stroke through three points bends through the middle one", () => {
  const [lens] = readPath(brush([[0, 0], [5, 4], [10, 0]], 2, 0.5));
  const mid = lerp(lens.points[2], lens.points[6], 0.5);
  nearPoint(mid, [5, 4], 0.11, "the widest place");
  nearPoint(lens.points[0], [0, 0]);
  nearPoint(lens.points[4], [10, 0]);
});

test("a brush stroke is wound the same way whichever way it runs, so strokes that cross stay solid", () => {
  const ways = new Set();
  for (let degrees = 0; degrees < 360; degrees += 15) {
    const [x, y] = rotate([12, 0], degrees);
    const [lens] = readPath(brush([[3, -2], [3 + x, -2 + y]], 1.4, 0.4));
    ways.add(Math.sign(area(lens.points)));
  }
  assert.equal(ways.size, 1, "one way round");
  assert.ok(!ways.has(0), "and not a flat one");
});

// A regular polygon of `n` corners round (0, 0), wound anticlockwise.
function polygon(n, radius) {
  return Array.from({ length: n }, (_, i) => [radius * Math.cos((i / n) * 2 * Math.PI), radius * Math.sin((i / n) * 2 * Math.PI)]);
}

test("a line of ink is laid just outside its shape, a curve with a point for each of the shape's", () => {
  const ring = polygon(24, 20);
  const [edge] = readPath(ribbon(ring));
  assert.equal(edge.closed, true);
  assert.equal(edge.points.length, ring.length + 1, "the outer edge only, the start shut at the end");
  assert.ok(area(edge.points) > 0, "wound the same way as a shape");
  edge.points.slice(0, ring.length).forEach((p, i) => {
    const out = Math.hypot(...p) - 20;
    assert.ok(out > 0.1 && out < 1.4, `point ${i} is ${out} cm outside the shape`);
  });
});

test("the line is thin where the shape faces the light and heavy where it turns away", () => {
  const ring = polygon(36, 20);
  const edge = readPath(ribbon(ring))[0].points;
  // The light comes from above and to the left of the page.
  const lit = ring.map((p, i) => [Math.hypot(...edge[i]) - 20, (p[0] * -0.6 + p[1] * -0.8) / 20]);
  const toward = lit.filter(([, facing]) => facing > 0.9).map(([weight]) => weight);
  const away = lit.filter(([, facing]) => facing < -0.9).map(([weight]) => weight);
  assert.ok(toward.length >= 2 && away.length >= 2);
  const mean = (list) => list.reduce((sum, v) => sum + v, 0) / list.length;
  assert.ok(mean(toward) < 0.45, `thin toward the light (${mean(toward)})`);
  assert.ok(mean(away) > 0.7, `heavy away from it (${mean(away)})`);
  assert.ok(mean(away) > mean(toward) * 2);
  const [fine] = readPath(ribbon(ring, 0.1, 0.2));
  const finest = Math.max(...fine.points.slice(0, 36).map((p) => Math.hypot(...p) - 20));
  assert.ok(finest < 0.5, "the weights are the ones asked for");
});

test("a point can keep part of the line, or none, and a point given as a corner stays a corner", () => {
  const ring = polygon(12, 10);
  const plain = readPath(ribbon(ring))[0].points;
  const half = readPath(ribbon(ring.map((p, i) => (i === 3 ? [p[0], p[1], 0, 0.5] : p))))[0].points;
  const none = readPath(ribbon(ring.map((p, i) => (i === 3 ? [p[0], p[1], 0, 0] : p))))[0].points;
  const out = (points) => Math.hypot(...points[3]) - 10;
  near(out(none), 0, 0.06, "no line where the edge is only a seam");
  near(out(half), out(plain) / 2, 0.1, "half of it");
  near(Math.hypot(...half[4]), Math.hypot(...plain[4]), 0.06, "and the points round it are as they were");

  const square = [[0, 0], [10, 0, 1], [10, 10], [0, 10]];
  const [corner] = readPath(ribbon(square));
  nearPoint(corner.controls[1], corner.points[1], 1e-9, "the handle into a corner");
  nearPoint(corner.controls[2], corner.points[1], 1e-9, "the handle out of a corner");
});

test("a line of ink round a shape is the same whichever way the shape was given, and is never not a number", () => {
  const ring = polygon(10, 15);
  assert.equal(ribbon(ring), ribbon(ring.slice().reverse()));
  for (const points of [[[0, 0], [0, 0], [0, 0]], [[1, 1], [1, 1], [5, 5]], [[0, 0], [10, 0]], [[3, 3]]]) {
    assert.doesNotMatch(ribbon(points), /NaN|Infinity|undefined/);
  }
});

test("a shape of solid ink is wound the way a brush stroke is, opposite to a shape that merges", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  for (const points of [square, square.slice().reverse()]) {
    const [ink] = readPath(solid(points));
    const [shape] = readPath(blob(points));
    assert.ok(area(ink.points) < 0 && area(shape.points) > 0);
    assert.equal(ink.closed, true);
  }
  const [stroke] = readPath(brush([[0, 0], [10, 0]], 2));
  assert.equal(Math.sign(area(readPath(solid(square))[0].points)), Math.sign(area(stroke.points)), "the way every stroke is wound");
});

test("the vector helpers", () => {
  assert.deepEqual(unit([1, 1], [1, 1]), [1, 0], "where the points coincide, along x");
  near(Math.hypot(...unit([0, 0], [3, 4])), 1, 1e-12);
  nearPoint(perp([1, 0]), [0, 1], 1e-12);
  nearPoint(rotate([1, 0], 90), [0, 1], 1e-12);
  nearPoint(rotate([2, 3], 360), [2, 3], 1e-12);
  assert.deepEqual(lerp([0, 0], [10, 20], 0.25), [2.5, 5]);
  assert.equal(area([[0, 0], [1, 0], [1, 1], [0, 1]]), 2, "twice the area, signed");
});

test("a point is inside a polygon or not, however the polygon is wound", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  for (const shape of [square, square.slice().reverse()]) {
    assert.ok(inside(shape, [5, 5]));
    assert.ok(!inside(shape, [15, 5]) && !inside(shape, [5, -1]));
  }
  // A notch is outside.
  const notched = [[0, 0], [10, 0], [10, 10], [5, 4], [0, 10]];
  assert.ok(!inside(notched, [5, 8]));
  assert.ok(inside(notched, [5, 2]));
});

// ---------- The strokes laid on a figure ----------

const FLAT = (q) => [q[0], q[1]];

// Every kind of fold, drawn in centimetres on a pose-less leg and torso.
function folds(seed = 1) {
  const hip = [0, 84];
  const knee = [30, 50];
  const ankle = [40, 8];
  // A jersey 30 cm across, leaning a little: `up` its height, `v` from -1 at the back to 1 at the front.
  const at = (up, v) => [up * 0.1 + v * 15, up * 0.99];
  const su = unit(knee, ankle);
  return {
    thigh: thighFolds(FLAT, hip, knee, [1, 0], seed),
    knee: kneeFolds(FLAT, knee, su, [1, 0], seed),
    sock: sockWrinkles(FLAT, lerp(knee, ankle, 0.2), ankle, [1, 0], seed),
    cuff: cuffGathers(FLAT, ankle, su, [1, 0], seed),
    crotch: crotchFolds(FLAT, hip, knee, [1, 0], seed),
    fan: crotchFan(FLAT, [20, 60], [0, 1], [1, 0], seed),
    puckers: kneePuckers(FLAT, knee, su, [1, 0], seed),
    torso: torsoFolds(at, seed),
    belly: torsoFolds(at, seed, true),
    waist: waistband(at, seed),
    sleeve: sleeveFolds(FLAT, [10, 120], [30, 100], [50, 110], seed),
    ground: groundStrokes(FLAT, ankle, true, seed),
  };
}

test("every fold is a row of lens-shaped strokes, long and slender", () => {
  for (const [name, d] of Object.entries(folds())) {
    const strokes = readPath(d);
    assert.ok(strokes.length >= (name === "puckers" ? 2 : name === "waist" ? 1 : 3), `${name} has strokes`);
    for (const lens of strokes) {
      assert.equal(lens.closed, true, name);
      assert.equal(lens.points.length, 8, name);
      const width = dist(lens.points[2], lens.points[6]);
      const length = dist(lens.points[0], lens.points[4]);
      assert.ok(width <= length * 0.25 + 0.11, `${name}: ${width} across for ${length} long`);
    }
  }
});

test("the folds are the same every time and move with the seed: nothing is random", () => {
  assert.deepEqual(folds(), folds());
  const other = folds(5);
  // (The belt is ruled, not wobbled, so it is the same line for every seed.)
  for (const [name, d] of Object.entries(folds()).filter(([name]) => name !== "waist")) assert.notEqual(d, other[name], `${name} varies with its seed`);
  assert.equal(folds().waist, other.waist);
});

test("a frame along a bone faces the side it is told to", () => {
  for (const ref of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const [a, b] of [[[0, 0], [10, 3]], [[10, 3], [0, 0]]]) {
      const f = along(a, b, ref);
      assert.ok(f.n[0] * ref[0] + f.n[1] * ref[1] >= 0, `towards ${ref} along ${a} to ${b}`);
      near(f.length, dist(a, b), 1e-12);
    }
  }
  const f = along([0, 0], [10, 0], [0, 1]);
  nearPoint(f.at(0, 0), [0, 0], 1e-12);
  nearPoint(f.at(1, 0), [10, 0], 1e-12);
  nearPoint(f.at(0.5, 3), [5, 3], 1e-12, "out on the side that faces the reference");
});

test("the strokes on the floor lie on it, and are shorter as the foot lifts", () => {
  const planted = boxOf(readPath(groundStrokes(FLAT, [50, 8], true, 7, 1)));
  const rising = boxOf(readPath(groundStrokes(FLAT, [50, 8], true, 7, 0.4)));
  assert.ok(planted.maxY < 3 && planted.minY > -6, "on and just below the floor line");
  assert.ok(rising.maxX < planted.maxX, "shorter");
  assert.ok(planted.minX < 50 && planted.maxX > 50, "either side of the foot");
  const back = boxOf(readPath(groundStrokes(FLAT, [50, 8], false, 7, 1)));
  assert.ok(back.maxX < planted.maxX, "shorter behind the front foot's");
});

test("the strokes under a foot turned across go all round it, and draw in as it lifts", () => {
  const span = [-6, 8];
  const planted = boxOf(readPath(groundStrokes(FLAT, [50, 8], false, 9, 1, span)));
  assert.equal(readPath(groundStrokes(FLAT, [50, 8], false, 9, 1, span)).length, 3, "three strokes, as under any foot");
  assert.ok(planted.maxY < 3 && planted.minY > -6, "on and just below the floor line");
  assert.ok(planted.minX < 50 + span[0] - 4 && planted.maxX > 50 + span[1] + 4, "past the foot at both ends");
  near((planted.minX + planted.maxX) / 2, 50 + (span[0] + span[1]) / 2, 5, "round it, and not trailing off toward the opponent");
  const rising = boxOf(readPath(groundStrokes(FLAT, [50, 8], false, 9, 0.4, span)));
  assert.ok(rising.minX > planted.minX && rising.maxX < planted.maxX, "shorter at both ends as the foot lifts");
  assert.deepEqual(groundStrokes(FLAT, [50, 8], false, 9, 1, span), groundStrokes(FLAT, [50, 8], false, 9, 1, span), "and the same every time");
});
