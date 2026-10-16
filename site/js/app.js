// The page: wires the controls to a phrase and draws it, every frame while it plays.
import { bladePaths, floorPath, inkFigure, stickFigure } from "./figure.js";
import { JOINTS, POSE_NAMES, POSES, PRESETS } from "./library.js";
import {
  buildTimeline,
  clearAdjustments,
  clone,
  editSpec,
  isPlainObject,
  parsePhrase,
  phraseToText,
  poseAt,
  setJoint,
  setPose,
} from "./phrase.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Layers of an ink figure, back to front, as inkFigure names them.
const LAYERS = ["l1", "l2", "l3", "l4", "head", "l6"];
// Four motion ghosts, each this far behind the one before.
const GHOSTS = [1, 2, 3, 4];
const GHOST_GAP_MS = 45;
// The most one frame may advance, so a tab coming back does not leap ahead.
const MAX_FRAME_MS = 64;
// The camera slider's range, which a pasted phrase is held to as well.
const CAMERA_LIMIT = 60;
// Someone who asked for less motion starts each phrase paused.
const AUTOPLAY = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const presetsEl = document.getElementById("presets");
const stagePanelEl = document.getElementById("stage-panel");
const stepCountEl = document.getElementById("step-count");
const stepLabelEl = document.getElementById("step-label");
const timecodeEl = document.getElementById("timecode");
const floorEl = document.getElementById("floor");
const ghostsEl = document.getElementById("ghosts");
const inkEl = document.getElementById("ink");
const trailsEl = document.getElementById("trails");
const trailEls = {
  fullA: document.getElementById("trail-full-a"),
  fullB: document.getElementById("trail-full-b"),
  doneA: document.getElementById("trail-done-a"),
  doneB: document.getElementById("trail-done-b"),
};
const prevButton = document.getElementById("prev-button");
const playButton = document.getElementById("play-button");
const nextButton = document.getElementById("next-button");
const playIconEl = document.getElementById("play-icon");
const pauseIconEl = document.getElementById("pause-icon");
const speedButtons = document.querySelectorAll("[data-speed]");
const toggleButtons = document.querySelectorAll("[data-toggle]");
const cameraEl = document.getElementById("camera");
const cameraValueEl = document.getElementById("camera-value");
const timelineEl = document.getElementById("timeline");
const stepsEl = document.getElementById("steps");
const announcerEl = document.getElementById("announcer");
const phraseStatusEl = document.getElementById("phrase-status");
const phraseTextEl = document.getElementById("phrase-text");
const editTitleEl = document.getElementById("edit-title");
const fencerButtons = { A: document.getElementById("fencer-a"), B: document.getElementById("fencer-b") };
const jointsEl = document.getElementById("joints");
const resetStepButton = document.getElementById("reset-step");
const posesEl = document.getElementById("poses");

// ---------- State ----------

const state = {
  preset: 0,
  phrase: null,
  time: 0,
  playing: false,
  speed: 0.5,
  loop: true,
  ghosts: true,
  trail: true,
  ink: true,
  camera: 0,
  fencer: "A",
  // The step on show while paused on one; null when the time decides.
  pin: null,
  phraseText: "",
  phraseError: "",
};
// state.phrase laid out in time, and its blade paths for one camera angle.
let timeline = buildTimeline(null);
let trails = null;

function usePhrase(phrase) {
  state.phrase = phrase;
  timeline = buildTimeline(phrase);
  trails = null;
}

function currentIndex() {
  return state.pin !== null && state.pin < timeline.steps.length ? state.pin : poseAt(timeline, state.time).index;
}

// A solo phrase has no fencer B, so edits go to A.
function editingFencer() {
  return state.fencer === "B" && !timeline.solo ? "B" : "A";
}

// ---------- Actions ----------

function pickPreset(index) {
  const phrase = clone(PRESETS[index].phrase);
  usePhrase(phrase);
  Object.assign(state, {
    preset: index,
    time: 0,
    pin: null,
    playing: AUTOPLAY,
    camera: phrase.camera || 0,
    fencer: "A",
    phraseText: phraseToText(phrase),
    phraseError: "",
  });
  update();
}

function jumpTo(index) {
  const step = timeline.steps[index];
  if (!step) return;
  Object.assign(state, { pin: index, playing: false, time: step.holdStart });
  update();
  announcerEl.textContent = `Step ${index + 1} of ${timeline.steps.length}: ${step.label}`;
}

function stepBy(delta) {
  jumpTo(Math.max(0, Math.min(timeline.steps.length - 1, currentIndex() + delta)));
}

function togglePlay() {
  if (state.playing) {
    state.playing = false;
  } else {
    const pinned = state.pin !== null ? timeline.steps[state.pin] : null;
    let time = pinned ? pinned.holdStart : state.time;
    if (time >= timeline.duration - 1) time = 0;
    Object.assign(state, { playing: true, pin: null, time });
  }
  update();
}

// Changes the edited fencer at the current step, then stays paused on it.
function editCurrent(change) {
  const index = currentIndex();
  const phrase = editSpec(state.phrase, timeline, index, editingFencer(), change);
  if (!phrase) return;
  usePhrase(phrase);
  const step = timeline.steps[index];
  Object.assign(state, {
    playing: false,
    pin: index,
    time: step ? step.holdStart : 0,
    phraseText: phraseToText(phrase),
    phraseError: "",
  });
  update();
}

// Applies the phrase text as it is typed; text that is not a phrase yet is
// kept as typed and the last good phrase stays on stage.
function readPhraseText() {
  const text = phraseTextEl.value;
  state.phraseText = text;
  try {
    const phrase = parsePhrase(text);
    const camera = phrase.camera;
    const cameraChanged = typeof camera === "number" && camera !== state.phrase?.camera;
    usePhrase(phrase);
    Object.assign(state, {
      phraseError: "",
      pin: null,
      time: Math.min(state.time, timeline.duration),
      camera: cameraChanged ? Math.max(-CAMERA_LIMIT, Math.min(CAMERA_LIMIT, camera)) : state.camera,
    });
  } catch (error) {
    state.phraseError = String(error?.message || error);
  }
  update();
}

// ---------- Clock ----------

let frame = 0;
let lastTick = null;

function update() {
  render();
  if (state.playing && !frame) {
    lastTick = null;
    frame = requestAnimationFrame(tick);
  }
}

function tick(now) {
  frame = 0;
  if (!state.playing) return;
  if (lastTick !== null) {
    const time = state.time + Math.min(MAX_FRAME_MS, now - lastTick) * state.speed;
    if (time < timeline.duration) {
      state.time = time;
    } else if (state.loop) {
      state.time = time % timeline.duration;
    } else {
      state.time = timeline.duration;
      state.playing = false;
    }
  }
  lastTick = now;
  render();
  if (state.playing) frame = requestAnimationFrame(tick);
}

// ---------- Building the page ----------

function svgPath(parent, className) {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", className);
  parent.append(path);
  return path;
}

function createFencer(id) {
  const body = document.getElementById(`body-${id}`);
  const layers = {};
  for (const name of LAYERS) {
    const isHead = name === "head";
    layers[name] = {
      outline: svgPath(body, isHead ? "figure__outline figure__outline--head" : "figure__outline"),
      fill: svgPath(body, "figure__fill"),
      hair: isHead ? svgPath(body, "figure__hair") : null,
      detail: svgPath(body, "figure__detail"),
    };
  }
  const blade = document.getElementById(`blade-${id}`);
  const ghosts = document.getElementById(`ghosts-${id}`);
  const ghostBodies = {};
  const ghostBlades = {};
  // Oldest first, so the newest ghost is drawn on top.
  for (const k of [...GHOSTS].reverse()) ghostBodies[k] = svgPath(ghosts, `ghost ghost--${k}`);
  for (const k of [...GHOSTS].reverse()) ghostBlades[k] = svgPath(ghosts, `ghost-blade ghost-blade--${k}`);
  return {
    layers,
    ground: document.getElementById(`ground-${id}`),
    blade: {
      steel: svgPath(blade, "blade__steel"),
      guard: svgPath(blade, "blade__guard"),
      bow: svgPath(blade, "blade__bow"),
    },
    ghostBodies,
    ghostBlades,
  };
}

const fencers = { A: createFencer("a"), B: createFencer("b") };

const presetButtons = PRESETS.map((preset, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preset-button";
  button.textContent = preset.name;
  button.addEventListener("click", () => pickPreset(index));
  presetsEl.append(button);
  return button;
});

const jointControls = JOINTS.map((joint) => {
  const id = `joint-${joint.key}`;
  const wrapper = document.createElement("div");
  wrapper.className = "joint";
  const row = document.createElement("div");
  row.className = "joint__row";
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = joint.label;
  const value = document.createElement("span");
  value.className = "joint__value";
  const input = document.createElement("input");
  input.type = "range";
  input.id = id;
  input.min = String(joint.min);
  input.max = String(joint.max);
  input.step = "1";
  input.addEventListener("input", () => {
    editCurrent((spec) => setJoint(spec, joint.key, Math.round(Number(input.value))));
  });
  row.append(label, value);
  wrapper.append(row, input);
  jointsEl.append(wrapper);
  return { joint, input, value };
});

const poseButtons = Object.keys(POSES).map((key) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pose-button";
  const name = document.createElement("span");
  name.textContent = POSE_NAMES[key] || key;
  const code = document.createElement("span");
  code.className = "pose-button__key";
  code.textContent = key;
  button.append(name, code);
  button.addEventListener("click", () => editCurrent((spec) => setPose(spec, key)));
  posesEl.append(button);
  return { key, button };
});

// The step buttons follow the phrase, so they are rebuilt when its steps change.
let stepButtons = [];
let stepsShown = null;

function renderSteps(index) {
  const labels = JSON.stringify(timeline.steps.map((step) => step.label));
  if (labels !== stepsShown) {
    stepsShown = labels;
    stepButtons = timeline.steps.map((step, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "step-button";
      const number = document.createElement("span");
      number.className = "step-button__number";
      number.textContent = twoDigits(i + 1);
      button.append(number, step.label);
      button.addEventListener("click", () => jumpTo(i));
      return button;
    });
    stepsEl.replaceChildren(...stepButtons);
  }
  stepButtons.forEach((button, i) => setPressed(button, i === index));
}

prevButton.addEventListener("click", () => stepBy(-1));
nextButton.addEventListener("click", () => stepBy(1));
playButton.addEventListener("click", togglePlay);

for (const button of speedButtons) {
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    update();
  });
}

for (const button of toggleButtons) {
  button.addEventListener("click", () => {
    const key = button.dataset.toggle;
    state[key] = !state[key];
    update();
  });
}

cameraEl.addEventListener("input", () => {
  state.camera = Number(cameraEl.value);
  update();
});

timelineEl.addEventListener("input", () => {
  Object.assign(state, { time: Number(timelineEl.value), playing: false, pin: null });
  update();
});

for (const [fencer, button] of Object.entries(fencerButtons)) {
  button.addEventListener("click", () => {
    state.fencer = fencer;
    update();
  });
}

resetStepButton.addEventListener("click", () => editCurrent(clearAdjustments));
phraseTextEl.addEventListener("input", readPhraseText);

// ---------- Drawing ----------

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function setAttr(el, name, value) {
  const text = String(value);
  if (el.getAttribute(name) !== text) el.setAttribute(name, text);
}

function setPressed(el, pressed) {
  setAttr(el, "aria-pressed", pressed ? "true" : "false");
}

function setValue(input, value) {
  const text = String(value);
  if (input.value !== text) input.value = text;
}

function twoDigits(n) {
  return String(n).padStart(2, "0");
}

function seconds(ms) {
  return (ms / 1000).toFixed(2);
}

function polyline(points, count) {
  return count < 2 ? "" : `M${points.slice(0, count).join("L")}`;
}

function drawFencer(parts, figure) {
  for (const name of LAYERS) {
    const layer = parts.layers[name];
    const shape = figure[name];
    setAttr(layer.outline, "d", shape.g);
    setAttr(layer.fill, "d", shape.g);
    if (layer.hair) setAttr(layer.hair, "d", shape.hair);
    setAttr(layer.detail, "d", shape.d);
  }
  setAttr(parts.ground, "d", figure.ground);
  setAttr(parts.blade.steel, "d", figure.blade.k);
  setAttr(parts.blade.guard, "d", figure.blade.g);
  setAttr(parts.blade.bow, "d", figure.blade.d);
}

function drawStage(now) {
  const camera = state.camera;
  stagePanelEl.classList.toggle("is-solo", timeline.solo);
  setAttr(floorEl, "d", floorPath(camera));
  drawFencer(fencers.A, inkFigure(now.A, 1, camera, { backView: true }));
  drawFencer(fencers.B, inkFigure(now.B, -1, camera, { bald: true }));
  if (state.ink) setAttr(inkEl, "filter", "url(#ink-texture)");
  else inkEl.removeAttribute("filter");

  ghostsEl.classList.toggle("hidden", !state.ghosts);
  if (state.ghosts) {
    for (const k of GHOSTS) {
      const then = poseAt(timeline, Math.max(0, state.time - k * GHOST_GAP_MS));
      const a = stickFigure(then.A, 1, camera);
      const b = stickFigure(then.B, -1, camera);
      setAttr(fencers.A.ghostBodies[k], "d", a.body);
      setAttr(fencers.A.ghostBlades[k], "d", a.blade);
      setAttr(fencers.B.ghostBodies[k], "d", b.body);
      setAttr(fencers.B.ghostBlades[k], "d", b.blade);
    }
  }

  trailsEl.classList.toggle("hidden", !state.trail);
  if (state.trail) {
    if (!trails || trails.camera !== camera) trails = { camera, ...bladePaths(timeline, camera) };
    let done = 0;
    while (done < trails.times.length && trails.times[done] <= state.time + 0.5) done++;
    setAttr(trailEls.fullA, "d", polyline(trails.a, trails.a.length));
    setAttr(trailEls.fullB, "d", polyline(trails.b, trails.b.length));
    setAttr(trailEls.doneA, "d", polyline(trails.a, done));
    setAttr(trailEls.doneB, "d", polyline(trails.b, done));
  }
}

function render() {
  const steps = timeline.steps;
  const index = currentIndex();
  const step = steps[index];
  const fencer = editingFencer();
  const shown = state.pin !== null && state.pin < steps.length ? step : poseAt(timeline, state.time);
  const time = Math.min(state.time, timeline.duration);

  drawStage(shown);
  setText(stepCountEl, `${twoDigits(index + 1)} / ${twoDigits(steps.length)}`);
  setText(stepLabelEl, step.label);
  setText(timecodeEl, `${seconds(time)} / ${seconds(timeline.duration)} s`);

  presetButtons.forEach((button, i) => setPressed(button, state.preset === i));
  setAttr(playButton, "aria-label", state.playing ? "Pause" : "Play");
  pauseIconEl.classList.toggle("hidden", !state.playing);
  playIconEl.classList.toggle("hidden", state.playing);
  for (const button of speedButtons) setPressed(button, Number(button.dataset.speed) === state.speed);
  for (const button of toggleButtons) setPressed(button, state[button.dataset.toggle]);
  setValue(cameraEl, state.camera);
  setText(cameraValueEl, `${state.camera}°`);
  setAttr(cameraEl, "aria-valuetext", `${state.camera}°`);
  // The maximum first, or the browser would clamp the new value to the old one.
  setAttr(timelineEl, "max", Math.round(timeline.duration));
  setValue(timelineEl, Math.round(time));
  setAttr(timelineEl, "aria-valuetext", `${seconds(time)} of ${seconds(timeline.duration)} seconds`);
  renderSteps(index);

  setText(editTitleEl, `Step ${index + 1}: ${step.label}. Fencer ${fencer}.`);
  setPressed(fencerButtons.A, fencer === "A");
  setPressed(fencerButtons.B, fencer === "B");
  fencerButtons.B.disabled = timeline.solo;
  const target = step[fencer];
  for (const { joint, input, value } of jointControls) {
    let v = Number(target[joint.key]) || 0;
    // A blade turned past half a circle shows as the same angle within it.
    if (joint.key === "blade" && (v < -180 || v > 180)) v = ((((v + 180) % 360) + 360) % 360) - 180;
    v = Math.round(v);
    const text = `${v}${joint.unit}`;
    setValue(input, v);
    setText(value, text);
    setAttr(input, "aria-valuetext", text);
  }
  const spec = step[`spec${fencer}`];
  const pose = isPlainObject(spec) ? spec.pose : undefined;
  for (const { key, button } of poseButtons) setPressed(button, pose === key);

  let status = `Applied: ${steps.length} ${steps.length === 1 ? "step" : "steps"}, ${seconds(timeline.duration)} s`;
  let tone = "ok";
  if (state.phraseError) {
    status = `Not applied: ${state.phraseError}`;
    tone = "error";
  } else if (timeline.unknown.length) {
    status = `Applied. Unknown pose ${timeline.unknown.join(", ")} shown as guard`;
    tone = "warn";
  }
  setText(phraseStatusEl, status);
  phraseStatusEl.classList.toggle("phrase-status--warn", tone === "warn");
  phraseStatusEl.classList.toggle("phrase-status--error", tone === "error");
  // Only text that came from elsewhere is written back, so typing never
  // loses its place.
  if (phraseTextEl.value !== state.phraseText) phraseTextEl.value = state.phraseText;
}

pickPreset(0);
