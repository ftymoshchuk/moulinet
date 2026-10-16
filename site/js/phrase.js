// Phrases as data: turning one into a timeline, finding the pose at any
// moment, the text form the page edits, and the edits the controls make.
import { POSES } from "./library.js";

// Where each fencer stands until a phrase places them.
const START = { A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } };
// Values that are angles, so a move between two of them takes the short way round.
const ANGLES = new Set(["lean", "arm", "fore", "blade", "yaw", "rArm", "rFore"]);
// What a pose can hold. An adjustment to anything else is ignored.
const POSE_KEYS = new Set(Object.keys(POSES.guard));

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function duration(value) {
  const ms = Number(value);
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

/**
 * The whole pose a fencer spec describes: its library pose laid over the
 * guard, then its adjustments, then where it stands. A pose name the library
 * lacks is drawn as the guard and added to `unknown`.
 */
export function resolvePose(spec, unknown = []) {
  const own = isPlainObject(spec) ? spec : {};
  const name = own.pose;
  const known = typeof name === "string" && Object.hasOwn(POSES, name);
  if (name && !known && !unknown.includes(String(name))) unknown.push(String(name));
  const pose = { ...POSES.guard, ...(known ? POSES[name] : {}) };
  if (isPlainObject(own.adj)) {
    for (const [key, value] of Object.entries(own.adj)) {
      const number = Number(value);
      if (POSE_KEYS.has(key) && Number.isFinite(number)) pose[key] = number;
    }
  }
  const x = Number(own.x);
  pose.x = Number.isFinite(x) ? x : 0;
  return pose;
}

/**
 * Lays a phrase out in time. Each step moves into its poses over `ms` (the
 * first step is already there) and then holds them for `hold`.
 */
export function buildTimeline(phrase) {
  const steps = isPlainObject(phrase) && Array.isArray(phrase.steps) ? phrase.steps : [];
  const unknown = [];
  const out = [];
  let specA = START.A;
  let specB = START.B;
  let t = 0;
  steps.forEach((raw, i) => {
    const step = isPlainObject(raw) ? raw : {};
    specA = step.A || specA;
    specB = step.B || specB;
    const start = t;
    t += i === 0 ? 0 : duration(step.ms);
    const holdStart = t;
    t += duration(step.hold);
    out.push({
      label: String(step.label || `Step ${i + 1}`),
      specA,
      specB,
      A: resolvePose(specA, unknown),
      B: resolvePose(specB, unknown),
      start,
      holdStart,
      end: t,
      ease: step.ease,
    });
  });
  if (!out.length) {
    out.push({ label: "Empty phrase", specA, specB, A: resolvePose(specA), B: resolvePose(specB), start: 0, holdStart: 0, end: 0 });
  }
  return { steps: out, duration: Math.max(t, 1), solo: Boolean(isPlainObject(phrase) && phrase.solo), unknown };
}

// "snap" arrives fast and settles; "linear" keeps one speed; anything else
// eases in and out.
export function ease(u, kind) {
  const x = Math.max(0, Math.min(1, u));
  if (kind === "snap") return 1 - (1 - x) ** 3;
  if (kind === "linear") return x;
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

export function mixPoses(from, to, amount) {
  const out = {};
  for (const key of Object.keys(to)) {
    const a = from[key];
    const b = to[key];
    if (ANGLES.has(key)) {
      const turn = ((((b - a) % 360) + 540) % 360) - 180;
      out[key] = a + turn * amount;
    } else {
      out[key] = a + (b - a) * amount;
    }
  }
  return out;
}

/** Both fencers' poses at time `t`, and the step that moment belongs to. */
export function poseAt(timeline, t) {
  const steps = timeline.steps;
  let index = 0;
  while (index < steps.length - 1 && t >= steps[index + 1].start) index++;
  const step = steps[index];
  if (index > 0 && t < step.holdStart) {
    const before = steps[index - 1];
    const amount = ease((t - step.start) / Math.max(1, step.holdStart - step.start), step.ease);
    return { A: mixPoses(before.A, step.A, amount), B: mixPoses(before.B, step.B, amount), index };
  }
  return { A: step.A, B: step.B, index };
}

/** The phrase as the page shows it: one line per setting, one line per step. */
export function phraseToText(phrase) {
  const head = Object.keys(phrase)
    .filter((key) => key !== "steps")
    .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(phrase[key])}`);
  const steps = (Array.isArray(phrase.steps) ? phrase.steps : []).map((step) => `    ${JSON.stringify(step)}`);
  return `{\n${head.join(",\n")}${head.length ? ",\n" : ""}  "steps": [\n${steps.join(",\n")}\n  ]\n}`;
}

/** Reads a phrase from text; throws, with a message for the reader, if it is not one. */
export function parsePhrase(text) {
  const phrase = JSON.parse(text);
  if (!isPlainObject(phrase) || !Array.isArray(phrase.steps) || phrase.steps.length === 0) {
    throw new Error('it needs a "steps" list with at least one step');
  }
  return phrase;
}

/**
 * A copy of `phrase` in which `change` has edited one fencer's spec at step
 * `index`. A spec the step only inherits becomes its own first, so the edit
 * stays on this step. Returns null if the phrase has no such step.
 */
export function editSpec(phrase, timeline, index, fencer, change) {
  if (!isPlainObject(phrase) || !Array.isArray(phrase.steps) || !timeline.steps[index] || index >= phrase.steps.length) {
    return null;
  }
  const next = clone(phrase);
  if (!isPlainObject(next.steps[index])) next.steps[index] = {};
  const step = next.steps[index];
  const base = isPlainObject(step[fencer]) ? step[fencer] : timeline.steps[index][`spec${fencer}`];
  const spec = isPlainObject(base) ? clone(base) : {};
  change(spec);
  step[fencer] = spec;
  return next;
}

// The changes the controls make to a spec, for editSpec.

export function setJoint(spec, key, value) {
  if (key === "x") {
    spec.x = value;
  } else {
    spec.adj = { ...(isPlainObject(spec.adj) ? spec.adj : {}), [key]: value };
  }
}

export function setPose(spec, name) {
  spec.pose = name;
  delete spec.adj;
}

export function clearAdjustments(spec) {
  delete spec.adj;
}
