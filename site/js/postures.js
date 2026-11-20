// The postures people make their own. The numbers of a posture are in library.js and
// are the same for everyone; on the page a person can change some of them, and what
// they change is their version of that posture. A version is kept on their device
// only, and is laid over the posture's numbers wherever the page works a pose out
// (see `resolvePose` in phrase.js), so it shows in the postures, in the Creator and in
// every scene that uses the posture.
//
// A version holds just the joints that were moved, such as { guard: { arm: -30 } }.
// Anything it does not hold is the posture's own, so a joint put back leaves the
// version, and a posture with no joint left has no version at all.
//
// This module is imported by phrase.js, so it must not import from it.
import { JOINTS, POSES, POSE_NAMES } from "./library.js";

export const POSTURES_KEY = "moulinet.postures";
const VERSION = 1;

/** The joints of a posture that a person can change: every slider but where the fencer stands. */
export const POSTURE_JOINTS = JOINTS.filter(({ key }) => key !== "x");
const LIMITS = new Map(POSTURE_JOINTS.map(({ key, min, max }) => [key, { min, max }]));

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The joints of one version that the page can use: the sliders' joints that are numbers, held to the range
// of their slider, in the order of the sliders.
function usableJoints(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const { key } of POSTURE_JOINTS) {
    const value = raw[key];
    if (!Object.hasOwn(raw, key) || typeof value !== "number" || !Number.isFinite(value)) continue;
    const { min, max } = LIMITS.get(key);
    out[key] = Math.min(max, Math.max(min, value));
  }
  return out;
}

/**
 * `raw` as versions the page can use: only postures the library has, only their
 * joints that are numbers, held to the range of their slider, and no posture
 * without a joint. A copy, in the order of the library.
 */
export function cleanVersions(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const name of Object.keys(POSES)) {
    if (!Object.hasOwn(raw, name)) continue;
    const joints = usableJoints(raw[name]);
    if (Object.keys(joints).length > 0) out[name] = joints;
  }
  return out;
}

// What a posture gives without a version of its own: its numbers over the guard's, which may be a version.
function givenIn(versions, name) {
  return name === "guard" ? { ...POSES.guard } : { ...POSES.guard, ...versions.guard, ...POSES[name] };
}

function numbersIn(versions, name) {
  return { ...givenIn(versions, name), ...versions[name] };
}

// ---------- The versions in force ----------

let inUse = {};
let names = Object.freeze([]);

/** Puts `versions` in force: from now on the page works poses out with them. */
export function useVersions(versions) {
  inUse = cleanVersions(versions);
  names = Object.freeze(Object.keys(inUse));
}

/** The versions in force, as a copy to change and put back with `useVersions`. */
export function versionsInUse() {
  return Object.fromEntries(Object.entries(inUse).map(([name, joints]) => [name, { ...joints }]));
}

/** The postures that have a version in force, in the order of the library. */
export function versionedPostures() {
  return names;
}

export function hasVersion(name) {
  return Object.hasOwn(inUse, name);
}

/** The joints of a posture that have a version, with the values it gives them. */
export function versionOf(name) {
  return { ...inUse[name] };
}

/** The numbers of a posture as they are now: its own, over the guard's, with the versions in force. */
export function numbersOf(name) {
  return numbersIn(inUse, name);
}

/** The numbers of a posture without a version of its own: what a joint goes back to. */
export function givenBy(name) {
  return givenIn(inUse, name);
}

// ---------- Changing a version ----------
//
// Each returns changed versions and leaves those it was given alone.

function copyOf(versions) {
  return Object.fromEntries(Object.entries(versions).map(([name, joints]) => [name, { ...joints }]));
}

function withJoints(versions, name, joints) {
  if (Object.keys(joints).length > 0) versions[name] = joints;
  else delete versions[name];
  return cleanVersions(versions);
}

/**
 * `versions` with joint `key` of posture `name` at `value`, held to the range of its
 * slider. A value that is what the posture gives anyway is not a version, so the
 * joint is put back instead. Null for a posture the library lacks, a joint that is
 * not a slider's or a value that is not a number.
 */
export function moveJoint(versions, name, key, value) {
  const limits = LIMITS.get(key);
  if (!limits || !Object.hasOwn(POSES, name) || typeof value !== "number" || !Number.isFinite(value)) return null;
  const next = copyOf(versions);
  const held = Math.min(limits.max, Math.max(limits.min, value));
  const joints = { ...next[name] };
  if (held === givenIn(next, name)[key]) delete joints[key];
  else joints[key] = held;
  return withJoints(next, name, joints);
}

/** `versions` with one joint of a posture back to what the posture gives. */
export function putJointBack(versions, name, key) {
  const next = copyOf(versions);
  const joints = { ...next[name] };
  delete joints[key];
  return withJoints(next, name, joints);
}

/** `versions` without the version of a posture. */
export function putPostureBack(versions, name) {
  const next = copyOf(versions);
  delete next[name];
  return cleanVersions(next);
}

// ---------- Making a version permanent ----------

/**
 * The versions as text to send on: for each posture its line for POSES in library.js
 * as it would read with the changes, and under it what they changed. A person can
 * send it, and it can be pasted into the library as it is.
 */
export function numbersText(versions) {
  const lines = ["// Sabre Motion Lab: my versions of postures. Each line goes in POSES, in site/js/library.js, in place of the posture's own."];
  for (const name of Object.keys(POSES)) {
    const joints = versions[name];
    if (!joints) continue;
    const own = { ...POSES[name], ...joints };
    lines.push(`${name}: { ${Object.entries(own).map(([key, value]) => `${key}: ${value}`).join(", ")} },`);
    const built = { ...POSES.guard, ...POSES[name] };
    const changes = POSTURE_JOINTS.filter(({ key }) => Object.hasOwn(joints, key)).map(({ key }) => `${key} ${built[key]} → ${joints[key]}`);
    lines.push(`// ${POSE_NAMES[name] ?? name}: ${changes.join(", ")}`);
  }
  return lines.join("\n");
}

// ---------- Kept on this device ----------
//
// `storage` is a browser's localStorage, or null where the browser will not give one.
// As with the scenes (scenes.js), every save reads what is stored afresh and writes it
// back whole, so what this page cannot show, a posture it does not know or a setting,
// is written back as it was; and a store from a newer version of the page is not
// written at all, since this one would only destroy it.

// What is stored: the versions this page can use, everything else to give back with
// them (`kept` postures and `rest` of the store), and whether it was written by a
// newer version of the page.
function readStore(storage) {
  let data;
  try {
    data = JSON.parse(storage.getItem(POSTURES_KEY));
  } catch {
    data = null;
  }
  const empty = { versions: {}, kept: {}, rest: {}, newer: false };
  if (!isObject(data)) return empty;
  if (data.version !== VERSION) return { ...empty, newer: typeof data.version === "number" && data.version > VERSION };
  const rest = { ...data };
  delete rest.version;
  delete rest.postures;
  const stored = isObject(data.postures) ? data.postures : {};
  const kept = {};
  for (const [name, entry] of Object.entries(stored)) {
    if (!Object.hasOwn(POSES, name)) kept[name] = entry;
  }
  return { versions: cleanVersions(stored), kept, rest, newer: false };
}

/** The versions kept on this device, as the page can use them. What cannot be read is left out. */
export function readVersions(storage) {
  return readStore(storage).versions;
}

/**
 * Keeps `versions` on this device. Returns `{ ok: true }`, or `{ error }`: "storage" if
 * the browser would not keep them, "newer" if they were saved by a newer version of the
 * page, which this one leaves alone.
 */
export function saveVersions(storage, versions) {
  if (!storage) return { error: "storage" };
  const store = readStore(storage);
  if (store.newer) return { error: "newer" };
  const clean = cleanVersions(versions);
  try {
    if (Object.keys(clean).length === 0 && Object.keys(store.kept).length === 0 && Object.keys(store.rest).length === 0) {
      // Nothing to keep, so nothing is left behind.
      storage.removeItem(POSTURES_KEY);
    } else {
      storage.setItem(POSTURES_KEY, JSON.stringify({ ...store.rest, version: VERSION, postures: { ...clean, ...store.kept } }));
    }
    return { ok: true };
  } catch {
    return { error: "storage" };
  }
}
