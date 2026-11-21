import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";

import { JOINTS, POSE_NAMES, POSES, PRESETS } from "../site/js/library.js";
import { buildTimeline, resolvePose } from "../site/js/phrase.js";
import {
  POSTURES_KEY,
  POSTURE_JOINTS,
  cleanVersions,
  givenBy,
  hasVersion,
  moveJoint,
  numbersOf,
  numbersText,
  putJointBack,
  putPostureBack,
  readVersions,
  saveVersions,
  useVersions,
  versionOf,
  versionedPostures,
  versionsInUse,
} from "../site/js/postures.js";

// Whatever a test puts in force is taken out again.
afterEach(() => useVersions({}));

// Browser storage, in memory: the calls the page makes of it.
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// A browser that will not keep anything: full, or in a mode that forbids it.
const refusing = () => {
  throw new DOMException("full", "QuotaExceededError");
};
const refusingStorage = { getItem: () => null, setItem: refusing, removeItem: refusing };

const stored = (postures, version = 1) => JSON.stringify({ version, postures });
const guardPlain = () => ({ ...POSES.guard, x: 0 });

test("with no version in force, a pose is the library's laid over the guard, as it always was", () => {
  for (const name of Object.keys(POSES)) {
    assert.deepEqual(resolvePose({ pose: name }), { ...POSES.guard, ...POSES[name], x: 0 }, name);
  }
  assert.deepEqual(resolvePose({ pose: "no such pose" }), guardPlain(), "one the library lacks is the guard");
  assert.deepEqual(resolvePose({}), guardPlain());
  assert.deepEqual(versionedPostures(), []);
  assert.deepEqual(versionsInUse(), {});
});

test("every number the library gives a posture is one its slider can show, so a version never has to move it", () => {
  assert.deepEqual(POSTURE_JOINTS.map(({ key }) => key), JOINTS.filter(({ key }) => key !== "x").map(({ key }) => key), "every slider but where the fencer stands");
  for (const name of Object.keys(POSES)) {
    const pose = numbersOf(name);
    for (const { key, min, max } of POSTURE_JOINTS) assert.ok(pose[key] >= min && pose[key] <= max, `${name}: ${key} ${pose[key]} is outside ${min}..${max}`);
  }
});

test("a version changes the posture, and the postures that take that joint from the guard, and no others", () => {
  useVersions({ guard: { arm: -30 } });
  assert.equal(resolvePose({ pose: "guard" }).arm, -30);
  assert.equal(resolvePose({ pose: "guard" }).blade, POSES.guard.blade, "a joint it did not change is the library's");
  assert.equal(POSES.advLift.arm, undefined, "the advance sets no sword arm of its own");
  assert.equal(resolvePose({ pose: "advLift" }).arm, -30, "so it takes the guard's, as changed");
  assert.equal(resolvePose({ pose: "parry3" }).arm, POSES.parry3.arm, "a posture that sets the joint itself keeps its own");
  assert.equal(resolvePose({ pose: "no such pose" }).arm, -30, "a pose the library lacks is drawn as the guard, as changed");
  // What a scene says goes over it, and where the fencer stands over that.
  const pose = resolvePose({ pose: "guard", adj: { arm: 5 }, x: 12 });
  assert.equal(pose.arm, 5);
  assert.equal(pose.x, 12);
  // The rest of the guard is as it was.
  assert.deepEqual({ ...resolvePose({ pose: "guard" }), arm: POSES.guard.arm }, guardPlain());
});

test("a version of one posture leaves the others as the library has them", () => {
  useVersions({ parry3: { blade: 100, hipY: 70 } });
  assert.equal(resolvePose({ pose: "parry3" }).blade, 100);
  assert.equal(resolvePose({ pose: "parry3" }).hipY, 70);
  assert.deepEqual(resolvePose({ pose: "parry3Back" }), { ...POSES.guard, ...POSES.parry3Back, x: 0 });
  assert.deepEqual(resolvePose({ pose: "guard" }), guardPlain());
  assert.deepEqual(resolvePose({ pose: "parry3" }), { ...POSES.guard, ...POSES.parry3, blade: 100, hipY: 70, x: 0 });
});

test("a posture's version is laid over what it takes from the guard, and over a version of the guard", () => {
  // advLift takes its arm from the guard. A version of the guard moves it; a version of advLift itself moves it more.
  useVersions({ guard: { arm: -30 }, advLift: { arm: -10 } });
  assert.equal(resolvePose({ pose: "guard" }).arm, -30);
  assert.equal(resolvePose({ pose: "advLift" }).arm, -10);
  assert.equal(resolvePose({ pose: "advLand" }).arm, -30, "the other advance still takes the guard's");
  assert.deepEqual(versionedPostures(), ["guard", "advLift"], "in the order of the library");
  assert.equal(hasVersion("advLift"), true);
  assert.equal(hasVersion("advLand"), false);
});

test("the scenes are drawn with the versions: they use the postures by name", () => {
  const first = PRESETS[0].phrase.steps[0];
  assert.equal(first.A.pose, "guard");
  assert.equal(buildTimeline(PRESETS[0].phrase).steps[0].A.rArm, POSES.guard.rArm);
  useVersions({ guard: { rArm: -100, hipX: 45, hipY: 70 } });
  const { A, B } = buildTimeline(PRESETS[0].phrase).steps[0];
  assert.equal(A.rArm, -100);
  assert.equal(B.rArm, -100);
  assert.equal(A.hipX, 45);
  assert.equal(A.hipY, 70);
  // A scene's own adjustments still win: the older fencer's guard stands his own height.
  assert.equal(first.B.adj.hipY, 80);
  assert.equal(B.hipY, 80);
  useVersions({});
  assert.equal(buildTimeline(PRESETS[0].phrase).steps[0].A.rArm, POSES.guard.rArm, "and taking them out puts it all back");
});

test("versions are held to what the page can use", () => {
  assert.deepEqual(cleanVersions({ guard: { arm: -30 } }), { guard: { arm: -30 } });
  const messy = {
    guard: { arm: -30, nope: 5, hipX: "41", blade: Number.NaN, yaw: Infinity, x: 50, liftB: 5, fore: null, rArm: undefined, lean: [3], turn: { v: 1 } },
    "no such pose": { arm: 1 },
    parry3: {},
    parry5: null,
    tierce: [1],
    quarte: "arm",
    septime: 5,
  };
  assert.deepEqual(cleanVersions(messy), { guard: { arm: -30 } }, "a number for a slider's joint of a pose the library has, and nothing else");
  for (const nothing of [null, undefined, [], "guard", 5, true]) assert.deepEqual(cleanVersions(nothing), {}, String(nothing));
  // Held to the range of the slider, as a pasted or old store cannot be trusted.
  assert.deepEqual(cleanVersions({ guard: { arm: 999, hipY: -5, hand: -999, blade: 180 } }), { guard: { hipY: 48, arm: 120, blade: 180, hand: -180 } });
  // A copy, in the order of the library, so the original is not shared.
  const given = { parry3: { arm: -100 }, guard: { arm: -30 } };
  const clean = cleanVersions(given);
  assert.deepEqual(Object.keys(clean), ["guard", "parry3"]);
  clean.guard.arm = 0;
  assert.equal(given.guard.arm, -30);
  // Putting versions in force takes only what can be used, and hands out copies.
  useVersions(messy);
  assert.deepEqual(versionsInUse(), { guard: { arm: -30 } });
  versionsInUse().guard.arm = 7;
  versionOf("guard").arm = 7;
  assert.equal(resolvePose({ pose: "guard" }).arm, -30, "what is handed out is a copy");
  assert.deepEqual(versionOf("tierce"), {}, "a posture with no version has no joints in it");
});

test("a joint is moved in a copy, and a value the posture gives anyway is no version", () => {
  const none = {};
  const first = moveJoint(none, "guard", "arm", -30);
  assert.deepEqual(first, { guard: { arm: -30 } });
  assert.deepEqual(none, {}, "the versions it was given are left alone");
  const second = moveJoint(first, "guard", "blade", 40);
  assert.deepEqual(second, { guard: { arm: -30, blade: 40 } });
  assert.deepEqual(first, { guard: { arm: -30 } });
  // Moved back to where the library has it, a joint is no longer a version.
  assert.deepEqual(moveJoint(second, "guard", "blade", POSES.guard.blade), { guard: { arm: -30 } });
  assert.deepEqual(moveJoint(first, "guard", "arm", POSES.guard.arm), {}, "and a posture with none left has no version");
  // advLift takes the guard's arm, so the guard's arm is what it gives anyway; but not once the guard's has been changed.
  assert.deepEqual(moveJoint({}, "advLift", "arm", POSES.guard.arm), {});
  assert.deepEqual(moveJoint({}, "advLift", "arm", -10), { advLift: { arm: -10 } });
  assert.deepEqual(moveJoint({ guard: { arm: -30 } }, "advLift", "arm", POSES.guard.arm), { guard: { arm: -30 }, advLift: { arm: POSES.guard.arm } });
  assert.deepEqual(moveJoint({ guard: { arm: -30 } }, "advLift", "arm", -30), { guard: { arm: -30 } });
  // Held to the range of the slider.
  assert.deepEqual(moveJoint({}, "guard", "arm", 500), { guard: { arm: 120 } });
  assert.deepEqual(moveJoint({}, "guard", "arm", -500), { guard: { arm: -120 } });
  // What it cannot do, it says with null: a posture the library lacks, a joint with no slider, and what is not a number.
  const refused = [
    ["no such pose", "arm", 1],
    ["guard", "x", 50],
    ["guard", "liftB", 3],
    ["guard", "nope", 3],
    ["guard", "arm", Number.NaN],
    ["guard", "arm", Infinity],
    ["guard", "arm", "5"],
    ["guard", "arm", undefined],
    ["guard", "arm", null],
  ];
  for (const [name, key, value] of refused) assert.equal(moveJoint({}, name, key, value), null, `${name} ${key} ${value}`);
});

test("a joint is put back on its own, and a posture all at once", () => {
  const both = { guard: { arm: -30, blade: 40 }, parry3: { blade: 100 } };
  const copy = structuredClone(both);
  assert.deepEqual(putJointBack(both, "guard", "arm"), { guard: { blade: 40 }, parry3: { blade: 100 } });
  assert.deepEqual(putJointBack(putJointBack(both, "guard", "arm"), "guard", "blade"), { parry3: { blade: 100 } }, "the last one takes the posture's version with it");
  assert.deepEqual(putJointBack(both, "guard", "hipX"), both, "a joint with no version stays as it was");
  assert.deepEqual(putJointBack(both, "tierce", "arm"), both, "so does a posture with none");
  assert.deepEqual(putPostureBack(both, "guard"), { parry3: { blade: 100 } });
  assert.deepEqual(putPostureBack(both, "tierce"), both);
  assert.deepEqual(both, copy, "the versions it was given are left alone");
});

test("what a joint goes back to is what the posture gives without a version of its own", () => {
  useVersions({ guard: { arm: -30 }, advLift: { arm: -10 }, parry3: { blade: 100 } });
  assert.equal(givenBy("guard").arm, POSES.guard.arm, "the guard goes back to the library's");
  assert.equal(givenBy("advLift").arm, -30, "a posture that takes it from the guard goes back to the guard's, as changed");
  assert.equal(givenBy("parry3").blade, POSES.parry3.blade, "and one that sets it itself to its own");
  for (const name of Object.keys(POSES)) assert.deepEqual(numbersOf(name), { ...givenBy(name), ...versionOf(name) }, name);
});

test("the numbers to send on are lines for POSES, as they would read with the changes", () => {
  const text = numbersText({ guard: { arm: -30, blade: 40 } });
  const [header, line, changes, ...more] = text.split("\n");
  assert.match(header, /^\/\/ Sabre Motion Lab: my versions of postures\. .*site\/js\/library\.js/);
  assert.equal(line, "guard: { hipX: 41, hipY: 77, footF: 84, liftF: 0, liftB: 0, lean: 0, turn: 58, arm: -30, fore: 26, armYaw: 0, foreYaw: 0, blade: 40, yaw: 0, hand: -45, rArm: -140, rFore: -28, toeBack: 14, kneeOut: 40 },");
  assert.equal(changes, `// ${POSE_NAMES.guard}: arm -52 → -30, blade 80 → 40`);
  assert.deepEqual(more, []);

  // A posture says what it sets itself and what was changed; a joint it takes from the guard is shown against the guard's.
  const advance = numbersText({ advLift: { arm: -10 } }).split("\n");
  assert.equal(advance[1], "advLift: { hipX: 44, hipY: 79, footF: 103, liftF: 4, arm: -10 },");
  assert.equal(advance[2], `// ${POSE_NAMES.advLift}: arm -52 → -10`);

  // Several, in the order of the library whatever the order they were made in, the changes in the order of the sliders.
  const several = numbersText({ parry3: { blade: 100 }, guard: { hand: -90, hipY: 70 } }).split("\n");
  assert.deepEqual(several.map((row) => row.split(":")[0]), [several[0].split(":")[0], "guard", `// ${POSE_NAMES.guard}`, "parry3", `// ${POSE_NAMES.parry3}`]);
  assert.match(several[2], /hipY 77 → 70, hand -45 → -90$/);

  // With no version there is nothing to send but the header.
  assert.equal(numbersText({}).split("\n").length, 1);
});

test("a line of numbers reads back as the posture it describes, and reads as the library's own lines do", () => {
  const source = readFileSync(new URL("../site/js/library.js", import.meta.url), "utf8");
  const read = (row) => Object.fromEntries([...row.matchAll(/(\w+): (-?[\d.]+)/g)].map(([, key, value]) => [key, Number(value)]));
  for (const name of Object.keys(POSES)) {
    // A line made from a joint set to what it was: the library's own line, as it is in library.js.
    const [key] = Object.keys(POSES[name]);
    const row = numbersText({ [name]: { [key]: POSES[name][key] } }).split("\n")[1];
    assert.ok(source.includes(`\n  ${row}\n`), `${name}: ${row} is not a line of library.js`);
    assert.deepEqual(read(row.slice(row.indexOf("{"))), POSES[name], name);
  }
  // And with changes, it is the posture with them.
  const versions = { guard: { arm: -30, hipX: 43.5 }, advLift: { arm: -12, hipX: 40 }, parry5: { yaw: 80 } };
  const rows = numbersText(versions).split("\n").filter((row) => !row.startsWith("//"));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const name = row.slice(0, row.indexOf(":"));
    assert.deepEqual(read(row.slice(row.indexOf("{"))), { ...POSES[name], ...versions[name] }, name);
  }
});

test("versions are kept on the device, and read back as they were", () => {
  const storage = memoryStorage();
  assert.deepEqual(readVersions(storage), {}, "nothing is kept at first");
  const versions = { guard: { arm: -30 }, parry3: { blade: 100, hipY: 70 } };
  assert.deepEqual(saveVersions(storage, versions), { ok: true });
  assert.deepEqual(JSON.parse(storage.data.get(POSTURES_KEY)), { version: 1, postures: versions });
  assert.deepEqual(readVersions(storage), versions);
  assert.deepEqual(saveVersions(storage, { guard: { arm: -30 } }), { ok: true });
  assert.deepEqual(readVersions(storage), { guard: { arm: -30 } }, "a save is the whole of them");
  // Nothing left to keep, and nothing is left behind.
  assert.deepEqual(saveVersions(storage, {}), { ok: true });
  assert.equal(storage.data.has(POSTURES_KEY), false);
  assert.deepEqual(readVersions(storage), {});
  assert.deepEqual(saveVersions(storage, {}), { ok: true }, "taking out what is not there is no trouble");
  // What cannot be used is not kept.
  saveVersions(storage, { guard: { arm: 999, nope: 1 }, "no such pose": { arm: 1 }, parry3: {} });
  assert.deepEqual(JSON.parse(storage.data.get(POSTURES_KEY)), { version: 1, postures: { guard: { arm: 120 } } });
});

test("what is stored but cannot be read is left out, and the rest still comes back", () => {
  const cases = {
    "not JSON": "{oops",
    "not an object": "[]",
    null: "null",
    "a number": "7",
    "another version": stored({ guard: { arm: -30 } }, 2),
    "no version": JSON.stringify({ postures: { guard: { arm: -30 } } }),
    "postures not an object": JSON.stringify({ version: 1, postures: [] }),
    "postures text": JSON.stringify({ version: 1, postures: "guard" }),
  };
  for (const [what, text] of Object.entries(cases)) assert.deepEqual(readVersions(memoryStorage({ [POSTURES_KEY]: text })), {}, what);
  const mixed = stored({ guard: { arm: -30, nope: 4 }, "no such pose": { arm: 3 }, parry3: { blade: "100" }, parry5: { yaw: 80 }, tierce: 7, quarte: null });
  assert.deepEqual(readVersions(memoryStorage({ [POSTURES_KEY]: mixed })), { guard: { arm: -30 }, parry5: { yaw: 80 } });
  // A browser with no storage has nothing kept.
  assert.deepEqual(readVersions(null), {});
  assert.deepEqual(readVersions(undefined), {});
});

test("versions saved by a newer version of the page are not shown, and not written over", () => {
  for (const version of [2, 7, 1.5]) {
    const text = stored({ guard: { arm: -30 } }, version);
    const storage = memoryStorage({ [POSTURES_KEY]: text });
    assert.deepEqual(readVersions(storage), {}, `version ${version} is not one this page can read`);
    assert.deepEqual(saveVersions(storage, { parry3: { blade: 100 } }), { error: "newer" }, `saving over version ${version}`);
    assert.deepEqual(saveVersions(storage, {}), { error: "newer" }, `clearing version ${version}`);
    assert.equal(storage.data.get(POSTURES_KEY), text, "left exactly as it was");
  }
});

test("a store this page cannot make sense of is the page's own to replace", () => {
  const texts = ["{oops", "[]", "null", "7", JSON.stringify({ postures: { guard: { arm: -30 } } }), stored({}, 0), stored({}, "1"), stored({}, -3)];
  for (const text of texts) {
    const storage = memoryStorage({ [POSTURES_KEY]: text });
    assert.deepEqual(saveVersions(storage, { guard: { arm: -30 } }), { ok: true }, text);
    assert.deepEqual(JSON.parse(storage.data.get(POSTURES_KEY)), { version: 1, postures: { guard: { arm: -30 } } }, text);
  }
});

test("what this page cannot use is written back as it was", () => {
  const later = { arm: 3, shiny: true };
  const raw = { version: 1, settings: { sort: "name" }, postures: { guard: { arm: -30 }, "a posture from a newer page": later, parry3: { blade: 100 } } };
  const storage = memoryStorage({ [POSTURES_KEY]: JSON.stringify(raw) });
  const now = () => JSON.parse(storage.data.get(POSTURES_KEY));
  assert.deepEqual(readVersions(storage), { guard: { arm: -30 }, parry3: { blade: 100 } }, "only the versions it can use");
  assert.deepEqual(saveVersions(storage, { guard: { arm: -20 } }), { ok: true });
  assert.deepEqual(now().postures, { guard: { arm: -20 }, "a posture from a newer page": later }, "the posture it does not know is kept");
  assert.deepEqual(now().settings, { sort: "name" }, "and a setting it does not know");
  assert.equal(now().version, 1);
  // Taking out every version it has leaves what it keeps, and the key.
  assert.deepEqual(saveVersions(storage, {}), { ok: true });
  assert.deepEqual(now(), { version: 1, settings: { sort: "name" }, postures: { "a posture from a newer page": later } });
});

test("a browser that will not keep the versions says so", () => {
  assert.deepEqual(saveVersions(refusingStorage, { guard: { arm: -30 } }), { error: "storage" });
  assert.deepEqual(saveVersions(refusingStorage, {}), { error: "storage" }, "nor will it take them out");
  assert.deepEqual(saveVersions(null, { guard: { arm: -30 } }), { error: "storage" });
  assert.deepEqual(saveVersions(undefined, {}), { error: "storage" });
  const storage = memoryStorage({ [POSTURES_KEY]: stored({ guard: { arm: -30 } }) });
  storage.setItem = refusing;
  assert.deepEqual(saveVersions(storage, { guard: { arm: -20 } }), { error: "storage" });
  assert.deepEqual(readVersions(storage), { guard: { arm: -30 } }, "and what was kept stays");
});
