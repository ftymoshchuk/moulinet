// Phrases as data: turning one into a timeline, finding the pose at any
// moment, the text form the page edits, and the edits the controls make.
import { POSES } from "./library.js";

// Where each fencer stands until a phrase places them.
const START = { A: { pose: "guard", x: 0 }, B: { pose: "guard", x: 245 } };
// Values that are angles, so a move between two of them takes the short way round.
const ANGLES = new Set(["lean", "turn", "arm", "fore", "blade", "yaw", "rArm", "rFore"]);
// What a pose can hold. An adjustment to anything else is ignored.
const POSE_KEYS = new Set(Object.keys(POSES.guard));
// The text a scene carries about itself, and the order the data shows it in:
// these, then the camera and solo, then the steps.
export const TEXT_KEYS = ["name", "event", "reference", "note"];
const HEAD_KEYS = [...TEXT_KEYS, "camera", "solo"];
// The most each of them may say, and a step's label. The fields hold typing to
// these, a scene is saved only within them, and the page shows no more than they
// allow: a wall of pasted text would otherwise take seconds to lay out.
export const TEXT_LIMITS = { name: 100, event: 160, reference: 2000, note: 1000, label: 100 };
// A step's own keys, in the order its line shows them.
const STEP_KEYS = ["label", "ms", "hold", "ease", "A", "B"];
// The longest move or hold the controls will write, in milliseconds.
export const MAX_STEP_MS = 10000;
// How a step the page adds starts out: a quick move, a short pause.
const NEW_STEP = { ms: 300, hold: 200 };

export function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** `text` cut to `limit` characters, with an ellipsis where it was cut, and never in the middle of a character. */
export function clip(text, limit) {
  if (text.length <= limit) return text;
  let end = limit - 1;
  // A character outside the basic plane is two code units; keep both or neither.
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end--;
  return `${text.slice(0, end)}…`;
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
      label: clip(String(step.label || `Step ${i + 1}`), TEXT_LIMITS.label),
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

/**
 * The phrase as the page shows it: one line per setting, one line per step.
 * The name, event, reference and note come first, then the camera and solo,
 * then anything else, so a setting added later does not land after the steps.
 */
export function phraseToText(phrase) {
  const rank = (key) => (HEAD_KEYS.includes(key) ? HEAD_KEYS.indexOf(key) : HEAD_KEYS.length);
  const head = Object.keys(phrase)
    .filter((key) => key !== "steps")
    .sort((a, b) => rank(a) - rank(b))
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

// Edits to the scene as a whole and to its steps, for the Creator. Each returns
// a changed copy and leaves the phrase it was given alone, or null when it
// cannot make the change.

/** A scene with one step, both fencers in guard, to make something from. */
export function newPhrase() {
  return { camera: 0, steps: [{ label: "En garde", hold: 600, A: { ...START.A }, B: { ...START.B } }] };
}

/**
 * `phrase` with one of its text keys (name, event, reference or note) set to
 * `value`. Text that is empty or only spaces removes the key.
 */
export function setMeta(phrase, key, value) {
  if (!TEXT_KEYS.includes(key)) return null;
  const next = clone(phrase);
  const text = String(value ?? "");
  if (text.trim() === "") delete next[key];
  else next[key] = text;
  return next;
}

/** `phrase` for one fencer when `solo` is true, for two when it is not. */
export function setSolo(phrase, solo) {
  const next = clone(phrase);
  if (solo) next.solo = true;
  else delete next.solo;
  return next;
}

function hasStep(phrase, timeline, index) {
  return (
    isPlainObject(phrase) && Array.isArray(phrase.steps) && Number.isInteger(index) && index >= 0 && index < phrase.steps.length && Boolean(timeline.steps[index])
  );
}

// A step with its keys in the order its line shows them.
function tidyStep(step) {
  const out = {};
  for (const key of STEP_KEYS) if (Object.hasOwn(step, key)) out[key] = step[key];
  for (const key of Object.keys(step)) if (!Object.hasOwn(out, key)) out[key] = step[key];
  return out;
}

/**
 * `phrase` with a new step after step `index`, standing as that step does, and
 * the new step's index. Null if the phrase has no such step.
 */
export function insertStep(phrase, timeline, index) {
  if (!hasStep(phrase, timeline, index)) return null;
  const source = timeline.steps[index];
  const step = { ...NEW_STEP, A: clone(source.specA) };
  if (!timeline.solo) step.B = clone(source.specB);
  const next = clone(phrase);
  next.steps.splice(index + 1, 0, tidyStep(step));
  return { phrase: next, index: index + 1 };
}

/**
 * `phrase` without step `index`. The step after it keeps the poses it showed,
 * even where it only inherited them from the step that goes, so taking out one
 * moment leaves every other as it was. Null if there is no such step or it is
 * the only one.
 */
export function removeStep(phrase, timeline, index) {
  if (!hasStep(phrase, timeline, index) || phrase.steps.length < 2) return null;
  const next = clone(phrase);
  next.steps.splice(index, 1);
  const after = next.steps[index];
  if (after !== undefined) {
    const step = isPlainObject(after) ? after : {};
    const gone = timeline.steps[index];
    const before = timeline.steps[index - 1];
    for (const fencer of ["A", "B"]) {
      // Where the step would stand once the other is gone: as the step before
      // had them, or, with none before, as every phrase starts.
      const inherited = before ? before[`spec${fencer}`] : START[fencer];
      const shown = gone[`spec${fencer}`];
      if (!step[fencer] && JSON.stringify(inherited) !== JSON.stringify(shown)) step[fencer] = clone(shown);
    }
    next.steps[index] = tidyStep(step);
  }
  return next;
}

/**
 * `phrase` with one setting of step `index` changed: its `label`, the `ms` it
 * takes to move in, the `hold` after it, or its `ease`. Empty text removes a
 * setting, and so does an ease the page does not offer. Null if there is no
 * such step, or a time is not a number of milliseconds.
 */
export function setStepField(phrase, index, key, value) {
  if (!isPlainObject(phrase) || !Array.isArray(phrase.steps) || !Number.isInteger(index) || index < 0 || index >= phrase.steps.length) {
    return null;
  }
  const next = clone(phrase);
  const step = isPlainObject(next.steps[index]) ? next.steps[index] : {};
  const text = String(value ?? "");
  const empty = text.trim() === "";
  if (key === "label") {
    if (empty) delete step.label;
    else step.label = text;
  } else if (key === "ms" || key === "hold") {
    if (empty) {
      delete step[key];
    } else {
      const ms = Number(text);
      if (!Number.isFinite(ms) || ms < 0) return null;
      step[key] = Math.min(MAX_STEP_MS, Math.round(ms));
    }
  } else if (key === "ease") {
    if (text === "snap" || text === "linear") step.ease = text;
    else delete step.ease;
  } else {
    return null;
  }
  next.steps[index] = tidyStep(step);
  return next;
}
