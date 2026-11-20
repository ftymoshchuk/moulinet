// The postures taken from Leszák Károly's Kardvívás (1906), in sources/kardvivas-1906, each checked against what the
// book says of it. Lengths are centimetres on the skeleton the stage draws: the fencer's own height from the floor, x
// toward the opponent and z toward the camera, which is across the chest from the sword side, so a point with z > 0
// is to the fencer's left and one with z < 0 to the right, as the postures show him: right-handed, as the book's fencer
// is, facing left with his chest toward the camera. The tolerances are those of a model with a single height
// for every fencer, a few centimetres, not of the book's own words.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { BASES, BASE_GROUPS, BASE_SECTIONS, FIGURE_DIR, basesOf } from "../site/js/bases.js";
import { gripFrame, skeleton } from "../site/js/figure.js";
import { HAND_POSITIONS, POSES } from "../site/js/library.js";
import { resolvePose } from "../site/js/phrase.js";

const GROUP = "Leszák, 1906";
// The postures, in the order the book gives them (§5, §7, then the sabre positions of §11).
const BOOK = ["basicStance", "atEase", "tierce", "seconde", "prime", "quinte", "quarte", "lowTierce", "lowQuarte1", "lowQuarte2", "sixte", "septime"];

const DEG = Math.PI / 180;
/** A posture, its skeleton, and the way its edge faces. */
function take(name) {
  const pose = resolvePose({ pose: name });
  const J = skeleton(pose);
  return { pose, J, edge: gripFrame(J).e, tip: J.tip, hand: J.hn };
}
const within = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual.toFixed(1)}, not within ${tolerance} of ${expected.toFixed(1)}`);
/** How far the elbow is bent, 180 when the arm is straight. */
const bend = ({ pose }) => 180 - Math.abs(pose.fore - pose.arm);

test("the book's postures are the last group of the base postures, in the book's order, and each says where in the book it is", () => {
  assert.equal(BASE_GROUPS.at(-1), GROUP);
  const ours = BASES.filter((base) => base.group === GROUP);
  assert.deepEqual(ours.map(({ pose }) => pose), BOOK);
  assert.deepEqual(BASES.slice(-BOOK.length).map(({ pose }) => pose), BOOK, "they come after every other posture, so the others keep their numbers");
  // The page keeps them in the section of its own, Book knowledge, and no other posture is in it.
  assert.deepEqual(BASE_SECTIONS.book.groups, [GROUP]);
  assert.deepEqual(basesOf("book").map(({ pose }) => pose), BOOK);
  for (const { pose, points } of ours) {
    const book = points.find(([what]) => what === "Book");
    assert.ok(book, `${pose}: a Book point`);
    assert.match(book[1], /Kardvívás \(1906\), §\d+/, `${pose}: names the book and the section`);
  }
});

const SOURCE_FIGURES = new URL("../sources/kardvivas-1906/figures/", import.meta.url);
const SITE_FIGURES = new URL(`../site/${FIGURE_DIR}`, import.meta.url);

/** The width and height a JPEG says it has, from the first frame header in it. */
function jpegSize(bytes) {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = bytes[at + 1];
    // A start-of-frame marker, not one of the table markers that sit among them.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error("no frame header");
}

test("the photographs shown beside the book's postures are the figures of the book, as in sources, and each posture shows the figures its Book point cites", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", SOURCE_FIGURES), "utf8"));
  const shown = [];
  for (const base of BASES) {
    const figures = base.figures ?? [];
    const book = base.points.find(([what]) => what === "Book")?.[1] ?? "";
    const cited = [...book.matchAll(/Figs?\. (\d+)(?: and (\d+))?/g)].flatMap((m) => [m[1], m[2]]).filter(Boolean).map(Number);
    assert.deepEqual(figures.map(({ n }) => n), cited, `${base.pose}: shows the figures it cites`);
    if (figures.length) assert.equal(base.group, GROUP, `${base.pose}: only the book's postures have the book's photographs`);
    for (const figure of figures) {
      const entry = manifest.figures.find((candidate) => candidate.figure === figure.n);
      assert.ok(entry, `Fig. ${figure.n} is in the manifest`);
      assert.equal(figure.file, entry.file);
      assert.equal(entry.caption_en, `Fig. ${figure.n}. ${figure.caption}`, "the printed caption, in English");
      assert.equal(figure.page, entry.book_page);
      // The site carries its own copy, so it can be published without sources/; it must be the same file.
      const copy = readFileSync(new URL(figure.file, SITE_FIGURES));
      assert.ok(copy.equals(readFileSync(new URL(figure.file, SOURCE_FIGURES))), `${figure.file} is the same file as the one in sources`);
      assert.deepEqual([figure.width, figure.height], jpegSize(copy), `${figure.file}: the size the page keeps room for`);
      shown.push(figure.file);
    }
  }
  assert.equal(new Set(shown).size, shown.length, "no figure is shown twice");
  assert.deepEqual(readdirSync(SITE_FIGURES).filter((name) => name.endsWith(".jpg")).toSorted(), shown.toSorted(), "every photograph in the site is shown by a posture");
  assert.ok(existsSync(new URL("SOURCE.txt", SITE_FIGURES)), "the folder says where its files come from");
});

test("the hand positions are the book's attitudes: the 6th is the 2/3, the 5th the 3/4, the 2nd, 3rd and 1st the positions of those names", () => {
  // §6: the 1st attitude has the edge up, the 2nd to the right, the 3rd down, the 4th to the left; the 5th is between the 3rd
  // and the 4th, the 6th between the 2nd and the 3rd. The hand slider's positions run the same way round.
  const attitude = { 1: -180, 2: -90, 3: 0, 4: 90, 5: 45, 6: -45 };
  assert.equal(HAND_POSITIONS[attitude[1]], "1st");
  assert.equal(HAND_POSITIONS[attitude[5]], "3/4");
  assert.equal(HAND_POSITIONS[attitude[6]], "2/3");
  assert.equal(POSES.tierce.hand, attitude[6], "tierce is in the 6th attitude (§11 I)");
  assert.equal(POSES.quarte.hand, attitude[5], "quarte is in the 5th (§11 V)");
  assert.equal(POSES.lowQuarte1.hand, attitude[5], "low quarte 1 has the edge left and down: the 5th (§11 VII.1)");
  assert.equal(POSES.basicStance.hand, attitude[2], "the basic stance has the edge to the right: the 2nd (§5, §6)");
  assert.equal(POSES.lowTierce.hand, attitude[2], "low tierce has the edge turned outward (§11 VI)");
  assert.equal(POSES.lowQuarte2.hand, attitude[3], "low quarte 2 has the edge turned down (§11 VII.2)");
  assert.equal(POSES.quinte.hand, attitude[1], "quinte has no hand position in the book; the first, as in parry 5");
  for (const name of BOOK) assert.ok(HAND_POSITIONS[resolvePose({ pose: name }).hand], `${name}: a position the books name`);
});

test("basic stance (§5): heels together at a right angle, upright and half left, the arm out level with the shoulder, the left hand on the hip", () => {
  const { pose, J, edge } = take("basicStance");
  assert.equal(pose.toeBack, 0, "the feet make an exact right angle");
  assert.ok(Math.abs(J.ankF[0] - J.ankB[0]) <= 14, "the heels touch, or nearly: the feet are a foot's width apart at most");
  assert.ok(Math.hypot(J.hipF[0] - J.ankF[0], J.hipF[1] - J.ankF[1]) >= 88, "the front leg is straight");
  assert.ok(Math.hypot(J.hipB[0] - J.ankB[0], J.hipB[1] - J.ankB[1]) >= 88, "and so is the back leg");
  assert.equal(pose.lean, 0, "upright");
  assert.ok(pose.turn > 30 && pose.turn < 60, "turned half left, the left shoulder back");
  within(J.hn[1], J.sh[1], 1, "the sabre hand is at shoulder height");
  within(Math.hypot(J.hn[0] - J.sh[0], J.hn[1] - J.sh[1]), 69, 1, "the arm is straight");
  // On the hip at the belt, as in the guard: the hand rests about 17 cm above the hip joint.
  within(J.rh[1] - J.hip[1], 17, 8, "the left hand is on the hip");
  // §5: the sabre makes an obtuse angle with the extended arm, turned across it: the point goes to the left, the edge being right.
  const arm = [J.hn[0] - J.el[0], J.hn[1] - J.el[1], J.hn[2] - J.el[2]];
  const blade = [J.tip[0] - J.hn[0], J.tip[1] - J.hn[1], J.tip[2] - J.hn[2]];
  const angle = Math.acos((arm[0] * blade[0] + arm[1] * blade[1] + arm[2] * blade[2]) / (Math.hypot(...arm) * Math.hypot(...blade))) / DEG;
  assert.ok(angle > 5 && angle < 30, `the sabre is turned ${angle.toFixed(0)}° from the line of the arm: an obtuse angle between them`);
  assert.ok(pose.yaw > 0 && edge[2] < -0.9, "the point goes left, and the edge faces right");
});

test("at ease (§7): the arm lowered with the sabre until its point touches the ground in front of the right foot", () => {
  const { J, tip, hand } = take("atEase");
  within(tip[1], 0, 2, "the point is on the ground");
  assert.ok(tip[0] > J.ankF[0], `in front of the right foot (${tip[0].toFixed(0)} against ${J.ankF[0]})`);
  assert.ok(hand[1] < J.hip[1], "the hand hangs below the hip");
  assert.ok(J.rh[1] < J.hip[1] + 5, "the left hand is let go of the hip");
});

test("tierce (§11 I): the basket drawn back by a moderately bent elbow, the point at the height of the right eye, in the line, the 6th attitude", () => {
  const t = take("tierce");
  const bent = bend(t);
  assert.ok(bent > 120 && bent < 150, `the elbow is bent moderately (${bent.toFixed(0)}°)`);
  assert.ok(t.hand[0] - t.J.hip[0] < 85, "the basket is drawn back, not reaching");
  within(t.tip[1], t.J.hd[1], 6, "the point is at the height of the eye");
  assert.ok(Math.abs(t.tip[2]) <= Math.abs(t.J.sh[2]) + 1, "and in the line: no further out than the shoulder");
  assert.ok(t.edge[1] < -0.4 && t.edge[2] < -0.5, "the edge faces down and out");
});

test("seconde (§11 II): the point level with the right hip in the low line, the upper edge of the basket level with the shoulder, the edge up and to the right", () => {
  const t = take("seconde");
  within(t.tip[1], t.J.hip[1], 6, "the point is at the height of the hip");
  within(t.hand[1] + 6, t.J.sh[1], 6, "the upper edge of the basket, 6 cm above the hand, is at shoulder height");
  assert.ok(bend(t) > 90 && bend(t) < 140, "the arm is bent moderately");
  assert.ok(t.pose.blade < -20 && t.pose.yaw <= 0, "the point goes down, forward and no further than a little to the right");
  assert.ok(t.edge[1] > 0.5 && t.edge[2] < -0.5, "the edge faces up and out to the right");
});

test("prime (§11 III): the hand in front of the chest with the basket at shoulder height, the point at the left knee in the low line, the edge toward the left", () => {
  const t = take("prime");
  assert.ok(t.hand[2] > 0, "the hand has come across the body to the left of the middle");
  within(t.hand[1] + 6, t.J.sh[1], 8, "the upper edge of the basket is at the height of the shoulder");
  within(t.tip[1], t.J.kB[1], 8, "the point is at the height of the left knee, the back one");
  assert.ok(t.tip[2] > t.hand[2], "and goes on to the left of the hand");
  assert.ok(t.edge[2] > 0.7, "the edge faces left: the nearest position the model has to left and up");
});

test("quinte (§11 IV): the basket in front of the right temple, the blade across above the head, its point left of the left temple and higher", () => {
  const t = take("quinte");
  within(t.hand[1], t.J.hd[1], 8, "the hand is at the height of the temple");
  assert.ok(t.hand[2] < 0, "on the right of the head");
  assert.ok(t.tip[2] > 20, "the point is well to the left of the head");
  assert.ok(t.tip[1] >= t.J.hd[1] + 5, "and higher than it");
  assert.ok(t.edge[1] > 0.9, "the edge is up");
});

test("quarte (§11 V): the elbow at the hip, the forearm level and half left, the point at the left eye, to the left and outside the line, the 5th attitude", () => {
  const t = take("quarte");
  assert.ok(t.J.el[1] - t.J.hip[1] <= 22, `the elbow has sunk to the hip (${(t.J.el[1] - t.J.hip[1]).toFixed(0)} cm above it)`);
  assert.ok(Math.abs(t.pose.fore) <= 10, "the forearm is level");
  within(t.pose.foreYaw, 45, 10, "and points half left");
  assert.ok(t.hand[2] > 0, "the basket is in front of the middle of the body");
  within(t.tip[1], t.J.hd[1], 6, "the point is at the height of the left eye");
  assert.ok(t.tip[2] > 30, `to the left, outside the line (${t.tip[2].toFixed(0)} cm left of the middle)`);
  assert.ok(t.edge[1] < -0.5 && t.edge[2] > 0.4, "the edge faces down and left");
});

test("low tierce (§11 VI): the elbow on the right hip, the basket below the hip, the point at the right temple outside the line, the edge out", () => {
  const t = take("lowTierce");
  assert.ok(t.J.el[1] - t.J.hip[1] <= 22, "the elbow rests on the hip");
  assert.ok(t.hand[1] - 6 <= t.J.hip[1] + 1, "the lower edge of the basket, 6 cm below the hand, is no higher than the hip");
  assert.ok(t.pose.fore < 0, "the forearm slopes down");
  within(t.tip[1], t.J.hd[1], 6, "the point is at the height of the temple");
  assert.ok(t.tip[2] < -25, `outside the line, to the right (${t.tip[2].toFixed(0)})`);
  assert.ok(t.edge[2] < -0.9, "the edge is turned outward");
});

test("low quarte 1 (§11 VII.1): the elbow at the hip, the forearm to the left and down, the edge left and down, the point outside the line at eye height", () => {
  const t = take("lowQuarte1");
  assert.ok(t.J.el[1] - t.J.hip[1] <= 22, "the elbow is at the hip");
  assert.ok(t.pose.fore < 0 && t.pose.foreYaw > 45, "the forearm points down and to the left");
  assert.ok(t.edge[1] < -0.4 && t.edge[2] > 0.4, "the edge faces down and left");
  within(t.tip[1], t.J.hd[1], 8, "the point is at eye height");
  assert.ok(t.tip[2] > 30, "outside the line, to the left");
});

test("low quarte 2 (§11 VII.2): quinte turned over: the sabre level, its point fully left, the edge down, the strong of the blade below the hip", () => {
  const t = take("lowQuarte2");
  assert.ok(Math.abs(t.pose.blade) <= 3, "the sabre is level");
  assert.ok(t.pose.yaw >= 75, "its point turned fully to the left");
  assert.ok(t.edge[1] < -0.9, "the edge faces down");
  assert.ok(t.J.at(29)[1] < t.J.hip[1], "the strong, the first third of the blade, is below the hip");
  const quinte = take("quinte");
  assert.ok(quinte.edge[1] > 0.9 && t.edge[1] < -0.9, "the reverse of quinte: its edge is up where this one's is down");
});

test("sixte (§11 VIII): the elbow raised toward the left shoulder, the forearm upright, the hand at the left eye, the blade out to the right across the head, the edge up", () => {
  const t = take("sixte");
  assert.ok(t.pose.armYaw >= 60, "the upper arm lies across the chest toward the left shoulder");
  assert.ok(Math.abs(t.pose.fore - 90) <= 20, "the forearm stands upright");
  within(t.hand[1], t.J.hd[1], 20, "the hand is at the height of the head");
  assert.ok(t.hand[2] > 0, "and to the left of its middle");
  assert.ok(t.tip[2] < -40, "the blade goes out to the right");
  assert.ok(t.tip[1] > t.hand[1], "rising, across above the head");
  assert.ok(t.edge[1] > 0.7, "the edge is up");
});

test("septime (§11): from sixte the blade almost vertically down, the hand to the right of the right temple at head height", () => {
  const t = take("septime");
  assert.ok(t.pose.blade <= -75, "the blade is almost vertical, the point down");
  assert.ok(t.tip[1] < t.hand[1] - 70, "hanging well below the hand");
  assert.ok(t.hand[2] < 0, "the hand is to the right of the head");
  within(t.hand[1], t.J.hd[1], 25, "at about the height of the head");
});
