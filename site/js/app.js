// The page: wires the controls to a phrase and draws it, every frame while it plays.
//
// One stage serves three modes. The practice library plays a scene and says
// where it was noted. The base postures show one fencer in one posture at a
// time, in words as well as lines. The Creator makes new scenes.
import { BASES, BASE_GROUPS, basePhrase } from "./bases.js";
import { DEFAULT_FRAME, bladePaths, floorPath, frameOf, inkFigure, stickFigure } from "./figure.js";
import { JOINTS, POSE_NAMES, POSES, PRESETS } from "./library.js";
import {
  TEXT_KEYS,
  TEXT_LIMITS,
  buildTimeline,
  clearAdjustments,
  clip,
  clone,
  editSpec,
  insertStep,
  isPlainObject,
  newPhrase,
  parsePhrase,
  phraseToText,
  poseAt,
  removeStep,
  samePose,
  setJoint,
  setMeta,
  setPose,
  setSolo,
  setStepField,
} from "./phrase.js";
import { STORAGE_KEY, deleteScene, readSaved, referenceUrl, saveScene, sceneSummary } from "./scenes.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Layers of an ink figure, back to front, as inkFigure names them.
const LAYERS = ["l1", "l2", "l3", "l4", "head", "l6"];
// What each layer is when both fencers are drawn from the back (as the stage draws them): the sword arm, the two legs, the jersey, the head and the rear arm.
const PARTS = { l1: "jersey", l2: "trousers", l3: "trousers", l4: "jersey", head: "face", l6: "jersey" };
// Four motion ghosts, each this far behind the one before.
const GHOSTS = [1, 2, 3, 4];
const GHOST_GAP_MS = 45;
// What a fencer who has not moved leaves behind.
const NO_GHOST = { body: "", blade: "" };
// The most one frame may advance, so a tab coming back does not leap ahead.
const MAX_FRAME_MS = 64;
// The camera slider's range, which a pasted phrase is held to as well.
const CAMERA_LIMIT = 60;
// Someone who asked for less motion starts each phrase paused.
const AUTOPLAY = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MODE_NAMES = { library: "Practice library", base: "Base postures", creator: "Creator" };

const modeButtons = document.querySelectorAll("[data-mode]");
// Every panel that belongs to some modes only, with the modes it belongs to.
const modePanels = [...document.querySelectorAll("[data-modes]")].map((el) => ({ el, modes: el.dataset.modes.split(" ") }));
const stagePanelEl = document.getElementById("stage-panel");
const stageEl = document.getElementById("stage");
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

// The practice library.
const scenesBuiltinEl = document.getElementById("scenes-builtin");
const scenesSavedEl = document.getElementById("scenes-saved");
const scenesEmptyEl = document.getElementById("scenes-empty");
const sceneTitleEl = document.getElementById("scene-title");
const sceneKindEl = document.getElementById("scene-kind");
const sceneEventEl = document.getElementById("scene-event");
const sceneReferenceEl = document.getElementById("scene-reference");
const sceneNoteEl = document.getElementById("scene-note");
const sceneEditButton = document.getElementById("scene-edit");
const sceneDeleteButton = document.getElementById("scene-delete");

// The base postures.
const baseListEl = document.getElementById("base-list");
const baseNameEl = document.getElementById("base-name");
const baseGroupEl = document.getElementById("base-group");
const baseTextEl = document.getElementById("base-text");
const basePointsEl = document.getElementById("base-points");
const baseKeyEl = document.getElementById("base-key");

// The Creator.
const metaInputs = {
  name: document.getElementById("meta-name"),
  event: document.getElementById("meta-event"),
  reference: document.getElementById("meta-reference"),
  note: document.getElementById("meta-note"),
};
const metaSoloEl = document.getElementById("meta-solo");
const referenceHintEl = document.getElementById("reference-hint");
const saveStatusEl = document.getElementById("save-status");
const sceneSaveButton = document.getElementById("scene-save");
const sceneSaveCopyButton = document.getElementById("scene-save-copy");
const sceneNewButton = document.getElementById("scene-new");
const stepNameEl = document.getElementById("step-name");
const stepMsEl = document.getElementById("step-ms");
const stepHoldEl = document.getElementById("step-hold");
const stepEaseEl = document.getElementById("step-ease");
const stepHintEl = document.getElementById("step-hint");
const stepAddButton = document.getElementById("step-add");
const stepRemoveButton = document.getElementById("step-remove");
const phraseStatusEl = document.getElementById("phrase-status");
const phraseTextEl = document.getElementById("phrase-text");
const editTitleEl = document.getElementById("edit-title");
const fencerButtons = { A: document.getElementById("fencer-a"), B: document.getElementById("fencer-b") };
const jointsEl = document.getElementById("joints");
const resetStepButton = document.getElementById("reset-step");
const posesEl = document.getElementById("poses");

// ---------- State ----------

const state = {
  mode: "library",
  // The scene on stage in the practice library, by key, and the posture on
  // stage in the base postures, by number.
  scene: PRESETS[0].id,
  base: 0,
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
  // The Creator's scene: the saved scene it came from, if any; its text and
  // camera angle as they were last saved or opened, which unsaved changes are
  // measured from; and what saving it last said.
  editing: null,
  baseline: "",
  baselineCamera: 0,
  saveMessage: "",
  saveTone: "",
};
// state.phrase laid out in time, and its blade paths for one camera angle.
let timeline = buildTimeline(null);
let trails = null;
// Where the stage looks, worked out once for each timeline.
let framed = { timeline: null, frame: DEFAULT_FRAME };
// What the Creator had on stage while another mode has the stage.
let parked = null;

// The scenes saved on this device, and every scene the library shows: the
// built-in ones, then the saved ones. `libraryVersion` says when to redraw its list.
let saved = [];
let scenes = [];
let libraryVersion = 0;

// The browser's local storage, or null where it will not give the page any.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function setSaved(list) {
  saved = list;
  scenes = [
    ...PRESETS.map(({ id, phrase }) => ({ key: id, builtin: true, phrase })),
    ...saved.map(({ id, phrase }) => ({ key: `saved:${id}`, id, builtin: false, phrase })),
  ];
  libraryVersion++;
}

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

function clampCamera(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(-CAMERA_LIMIT, Math.min(CAMERA_LIMIT, value)) : 0;
}

// What a scene says in words under `key`; anything that is not text says nothing.
function metaText(phrase, key) {
  const value = isPlainObject(phrase) ? phrase[key] : undefined;
  return typeof value === "string" ? value : "";
}

// What a scene says under `key` as the page shows it: no more than the field allows.
function sceneText(phrase, key) {
  return clip(metaText(phrase, key).trim(), TEXT_LIMITS[key]);
}

function sceneName(phrase) {
  return sceneText(phrase, "name") || "Untitled scene";
}

function announce(text) {
  announcerEl.textContent = text;
}

// ---------- Modes ----------

// The Creator's view of a scene, as it is parked and picked up again.
function creatorView(phrase) {
  return { phrase, phraseText: phraseToText(phrase), phraseError: "", pin: 0, fencer: "A", camera: clampCamera(phrase.camera) };
}

// A scene from the library, playing from its start, as the page shows each one.
function showScene(key) {
  const scene = scenes.find((candidate) => candidate.key === key) ?? scenes[0];
  const phrase = clone(scene.phrase);
  usePhrase(phrase);
  Object.assign(state, {
    mode: "library",
    scene: scene.key,
    time: 0,
    pin: null,
    playing: AUTOPLAY,
    camera: clampCamera(phrase.camera),
    fencer: "A",
    phraseText: phraseToText(phrase),
    phraseError: "",
  });
  update();
}

// The base postures, paused on posture `index`.
function showBase(index) {
  const phrase = basePhrase();
  usePhrase(phrase);
  const at = Math.max(0, Math.min(timeline.steps.length - 1, index));
  Object.assign(state, {
    mode: "base",
    base: at,
    time: timeline.steps[at].holdStart,
    pin: at,
    playing: false,
    camera: clampCamera(phrase.camera),
    fencer: "A",
    phraseText: "",
    phraseError: "",
  });
  update();
}

// The Creator, with the scene it had when another mode took the stage.
function showCreator() {
  const view = parked;
  usePhrase(view.phrase);
  const at = view.pin < timeline.steps.length ? view.pin : 0;
  Object.assign(state, {
    mode: "creator",
    time: timeline.steps[at].holdStart,
    pin: at,
    playing: false,
    camera: view.camera,
    fencer: view.fencer,
    phraseText: view.phraseText,
    phraseError: view.phraseError,
  });
  update();
}

function leaveMode() {
  if (state.mode === "base") {
    state.base = currentIndex();
  } else if (state.mode === "creator") {
    parked = {
      phrase: state.phrase,
      phraseText: state.phraseText,
      phraseError: state.phraseError,
      pin: currentIndex(),
      fencer: state.fencer,
      camera: state.camera,
    };
  }
}

function pickMode(mode) {
  if (mode === state.mode) return;
  leaveMode();
  if (mode === "library") showScene(state.scene);
  else if (mode === "base") showBase(state.base);
  else showCreator();
  announce(MODE_NAMES[mode]);
}

// The Creator's scene has changes that are not saved: in its text, or in the
// angle of the camera, which a saved scene keeps.
function unsaved() {
  const view = state.mode === "creator" ? state : parked;
  return view.phraseText !== state.baseline || view.camera !== state.baselineCamera;
}

// Whether the Creator's scene may be replaced: it may if it is saved, or if the person says so.
function confirmReplace() {
  return !unsaved() || window.confirm("The scene in the Creator has changes that are not saved. Replace it?");
}

// Puts a scene in the Creator, as a new one or as one saved earlier (`editing`).
function openInCreator(phrase, editing) {
  parked = creatorView(phrase);
  Object.assign(state, { editing, baseline: parked.phraseText, baselineCamera: parked.camera, saveMessage: "", saveTone: "" });
  if (state.mode === "creator") showCreator();
  else pickMode("creator");
}

// ---------- Actions ----------

function jumpTo(index) {
  const step = timeline.steps[index];
  if (!step) return;
  Object.assign(state, { pin: index, playing: false, time: step.holdStart });
  update();
  announce(`${state.mode === "base" ? "Posture" : "Step"} ${index + 1} of ${timeline.steps.length}: ${step.label}`);
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

// Puts an edited phrase on stage, paused on step `index`. While the data is text
// that is not a phrase yet the fields are on hold (see renderCreator), and a
// change that reaches here anyway is dropped: it would put the last good phrase
// over what is being typed.
function applyEdit(phrase, index) {
  if (state.phraseError) return update();
  usePhrase(phrase);
  const step = timeline.steps[index];
  Object.assign(state, {
    playing: false,
    pin: index,
    time: step ? step.holdStart : 0,
    phraseText: phraseToText(phrase),
    phraseError: "",
    saveMessage: "",
  });
  update();
}

// Changes the edited fencer at the current step, then stays paused on it.
function editCurrent(change) {
  const index = currentIndex();
  const phrase = editSpec(state.phrase, timeline, index, editingFencer(), change);
  if (phrase) applyEdit(phrase, index);
}

// Changes one setting of the current step, such as its label or its timing. A
// value that cannot be used leaves the phrase alone, and the field goes back to it.
function editStep(key, value) {
  const index = currentIndex();
  const phrase = setStepField(state.phrase, index, key, value);
  if (phrase) applyEdit(phrase, index);
  else update();
}

function addStep() {
  const added = insertStep(state.phrase, timeline, currentIndex());
  if (added) applyEdit(added.phrase, added.index);
}

function removeCurrentStep() {
  const index = currentIndex();
  const phrase = removeStep(state.phrase, timeline, index);
  if (phrase) applyEdit(phrase, Math.min(index, phrase.steps.length - 1));
}

// Changes what the scene says about itself. The stage stays as it is: typing a
// name does not pause the scene or move it to another step.
function editScene(phrase) {
  if (!phrase) return;
  if (state.phraseError) return update();
  usePhrase(phrase);
  Object.assign(state, { phraseText: phraseToText(phrase), phraseError: "", saveMessage: "" });
  update();
}

// Applies the phrase text as it is typed; text that is not a phrase yet is
// kept as typed and the last good phrase stays on stage.
function readPhraseText() {
  const text = phraseTextEl.value;
  state.phraseText = text;
  state.saveMessage = "";
  try {
    const phrase = parsePhrase(text);
    const camera = phrase.camera;
    const cameraChanged = typeof camera === "number" && camera !== state.phrase?.camera;
    usePhrase(phrase);
    Object.assign(state, {
      phraseError: "",
      pin: null,
      time: Math.min(state.time, timeline.duration),
      camera: cameraChanged ? clampCamera(camera) : state.camera,
    });
  } catch (error) {
    state.phraseError = String(error?.message || error);
  }
  update();
}

function say(message, tone = "ok") {
  Object.assign(state, { saveMessage: message, saveTone: tone });
  update();
}

// What a scene's texts are called when one is too long.
const TEXT_NAMES = { name: "name", event: "event", reference: "reference link", note: "note" };

// The first of the scene's texts, or a step's label, that is longer than it may be: the field to
// take the cursor to (and the step to show, for a label), and what to say.
function tooLong(phrase) {
  for (const key of TEXT_KEYS) {
    const length = metaText(phrase, key).length;
    if (length > TEXT_LIMITS[key]) {
      return { field: metaInputs[key], message: `The ${TEXT_NAMES[key]} can be up to ${TEXT_LIMITS[key]} characters, and this one has ${length}.` };
    }
  }
  const at = phrase.steps.findIndex((step) => isPlainObject(step) && typeof step.label === "string" && step.label.length > TEXT_LIMITS.label);
  if (at < 0) return null;
  return { step: at, field: stepNameEl, message: `The label of step ${at + 1} can be up to ${TEXT_LIMITS.label} characters, and this one has ${phrase.steps[at].label.length}.` };
}

// What the page says when the saved scenes could not be changed.
const STORE_ERRORS = {
  storage: "This browser would not keep the scene, so it was not saved.",
  newer: "The scenes on this device were saved by a newer version of this page, so this one leaves them alone. Reload the page to update it.",
};

// Keeps the Creator's scene in the practice library: as the scene it came from,
// or, with `asCopy`, as a new one.
function save(asCopy) {
  if (state.phraseError) return say("Fix the phrase data first: it is not applied yet.", "error");
  const phrase = clone(state.phrase);
  for (const key of TEXT_KEYS) {
    const text = metaText(phrase, key).trim();
    if (text) phrase[key] = text;
    else delete phrase[key];
  }
  if (!phrase.name) {
    metaInputs.name.focus();
    return say("Give the scene a name first.", "error");
  }
  const long = tooLong(phrase);
  if (long) {
    // A step's label is shown with its step.
    if (long.step !== undefined) jumpTo(long.step);
    long.field.focus();
    return say(long.message, "error");
  }
  if (phrase.reference && !referenceUrl(phrase.reference)) {
    metaInputs.reference.focus();
    return say("The reference link has to be a web address, starting with http:// or https://.", "error");
  }
  phrase.camera = state.camera;

  // The scene this one came from may have been changed, or deleted, in another
  // tab since it was opened. Saving over it would lose that work, so this is
  // kept as a new scene beside it.
  let target = asCopy ? null : state.editing;
  let news = "Saved to the practice library on this device.";
  if (target !== null) {
    const stored = readSaved(getStorage()).find((scene) => scene.id === target);
    if (!stored) {
      target = null;
      news = "The saved scene was deleted in another tab, so this is saved as a new scene.";
    } else if (phraseToText(stored.phrase) !== state.baseline) {
      target = null;
      news = "The saved scene was changed in another tab, so this is saved as a new scene beside it, and theirs is kept.";
    }
  }
  const result = saveScene(getStorage(), phrase, target);
  if (result.error) return say(STORE_ERRORS[result.error], "error");
  setSaved(result.scenes);
  usePhrase(phrase);
  const text = phraseToText(phrase);
  Object.assign(state, { editing: result.id, baseline: text, baselineCamera: state.camera, phraseText: text });
  return say(news);
}

function editSelectedScene() {
  const scene = scenes.find((candidate) => candidate.key === state.scene);
  if (scene && confirmReplace()) openInCreator(clone(scene.phrase), scene.builtin ? null : scene.id);
}

function deleteSelectedScene() {
  const scene = scenes.find((candidate) => candidate.key === state.scene);
  if (!scene || scene.builtin || !window.confirm(`Delete "${sceneName(scene.phrase)}" from this device?`)) return;
  const result = deleteScene(getStorage(), scene.id);
  if (result.error) return announce(result.error === "newer" ? STORE_ERRORS.newer : "This browser would not keep the change, so the scene was not deleted.");
  setSaved(result.scenes);
  // The Creator's copy of it is no longer the saved scene.
  if (state.editing === scene.id) state.editing = null;
  showScene(PRESETS[0].id);
  announce(`Deleted ${sceneName(scene.phrase)}.`);
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

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// One row of a facts list: what it is, and what it says.
function fact(term, detail) {
  const row = element("div", "fact");
  row.append(element("dt", "", term), element("dd", "", detail));
  return row;
}

function createFencer(id) {
  const body = document.getElementById(`body-${id}`);
  const layers = {};
  for (const name of LAYERS) {
    const isHead = name === "head";
    layers[name] = {
      outline: svgPath(body, "figure__outline"),
      fill: svgPath(body, `figure__fill figure__fill--${PARTS[name]}`),
      hair: isHead ? svgPath(body, "figure__hair") : null,
      shine: isHead ? svgPath(body, "figure__shine") : null,
      detail: svgPath(body, "figure__detail"),
      ink: svgPath(body, "figure__ink"),
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

// Every control that edits the phrase, which wait while the data has an error.
const editors = [
  ...Object.values(metaInputs),
  metaSoloEl,
  stepNameEl,
  stepHoldEl,
  stepEaseEl,
  stepAddButton,
  resetStepButton,
  ...jointControls.map(({ input }) => input),
  ...poseButtons.map(({ button }) => button),
];

// The base postures, grouped by what they are for. The buttons are numbered in
// the order the postures are learned, which is the order of the steps.
const baseButtons = [];
for (const group of BASE_GROUPS) {
  const row = element("div", "base-buttons");
  BASES.forEach((base, i) => {
    if (base.group !== group) return;
    const button = element("button", "base-button");
    button.type = "button";
    button.append(element("span", "step-button__number", twoDigits(i + 1)), POSE_NAMES[base.pose] || base.pose);
    button.addEventListener("click", () => jumpTo(i));
    row.append(button);
    baseButtons[i] = button;
  });
  const section = element("div", "list-group");
  section.append(element("h4", "list-group__title", group), row);
  baseListEl.append(section);
}

// The library's list follows the scenes, so it is rebuilt when they change.
let sceneButtons = [];
let listShown = -1;

function renderSceneList() {
  sceneButtons = scenes.map((scene) => {
    const button = element("button", "scene-button");
    button.type = "button";
    button.append(element("span", "scene-button__title", sceneName(scene.phrase)), element("span", "scene-button__meta", sceneSummary(scene.phrase)));
    const event = sceneText(scene.phrase, "event");
    if (event) button.append(element("span", "scene-button__event", event));
    button.addEventListener("click", () => showScene(scene.key));
    return { key: scene.key, builtin: scene.builtin, button };
  });
  scenesBuiltinEl.replaceChildren(...sceneButtons.filter((scene) => scene.builtin).map((scene) => scene.button));
  scenesSavedEl.replaceChildren(...sceneButtons.filter((scene) => !scene.builtin).map((scene) => scene.button));
  scenesEmptyEl.classList.toggle("hidden", saved.length > 0);
}

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

for (const button of modeButtons) button.addEventListener("click", () => pickMode(button.dataset.mode));

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

sceneEditButton.addEventListener("click", editSelectedScene);
sceneDeleteButton.addEventListener("click", deleteSelectedScene);

for (const key of TEXT_KEYS) {
  metaInputs[key].addEventListener("input", () => editScene(setMeta(state.phrase, key, metaInputs[key].value)));
}
metaSoloEl.addEventListener("change", () => editScene(setSolo(state.phrase, metaSoloEl.checked)));
sceneSaveButton.addEventListener("click", () => save(false));
sceneSaveCopyButton.addEventListener("click", () => save(true));
sceneNewButton.addEventListener("click", () => {
  if (confirmReplace()) openInCreator(newPhrase(), null);
});

stepNameEl.addEventListener("input", () => editStep("label", stepNameEl.value));
stepMsEl.addEventListener("input", () => editStep("ms", stepMsEl.value));
stepHoldEl.addEventListener("input", () => editStep("hold", stepHoldEl.value));
stepEaseEl.addEventListener("change", () => editStep("ease", stepEaseEl.value));
stepAddButton.addEventListener("click", addStep);
stepRemoveButton.addEventListener("click", removeCurrentStep);

// Leaving the page with a scene that is not saved asks first, as replacing it does.
window.addEventListener("beforeunload", (event) => {
  if (!unsaved()) return;
  event.preventDefault();
  event.returnValue = "";
});

// Scenes saved in another tab appear here, and one deleted there leaves. A scene
// on stage that was changed there is loaded again, and the Creator's scene, if it
// was deleted there, is a new scene from here on.
window.addEventListener("storage", (event) => {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  setSaved(readSaved(getStorage()));
  if (state.editing !== null && !saved.some((scene) => scene.id === state.editing)) {
    state.editing = null;
    state.saveMessage = "The saved scene was deleted in another tab, so saving now keeps this as a new scene.";
    state.saveTone = "";
  }
  const scene = scenes.find((candidate) => candidate.key === state.scene);
  if (state.mode !== "library") update();
  else if (!scene) showScene(PRESETS[0].id);
  else if (phraseToText(scene.phrase) !== state.phraseText) showScene(scene.key);
  else update();
});

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

// Turns a control off or on. One that has the focus when it goes off hands the
// focus to `fallback` first, or a person on the keyboard is left on nothing.
function setDisabled(el, disabled, fallback) {
  if (el.disabled === disabled) return;
  if (disabled && document.activeElement === el) fallback.focus();
  el.disabled = disabled;
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
    setAttr(layer.outline, "d", shape.o);
    setAttr(layer.fill, "d", shape.g);
    if (layer.hair) setAttr(layer.hair, "d", shape.hair);
    if (layer.shine) setAttr(layer.shine, "d", shape.s);
    setAttr(layer.detail, "d", shape.d);
    setAttr(layer.ink, "d", shape.k ?? "");
  }
  setAttr(parts.ground, "d", figure.ground);
  setAttr(parts.blade.steel, "d", figure.blade.k);
  setAttr(parts.blade.guard, "d", figure.blade.g);
  setAttr(parts.blade.bow, "d", figure.blade.d);
}

// The Creator keeps one view as a scene is reshaped; the library and the postures
// look as close as keeps everyone in.
function frameFor() {
  if (state.mode === "creator") return DEFAULT_FRAME;
  if (framed.timeline !== timeline) framed = { timeline, frame: frameOf(timeline) };
  return framed.frame;
}

function drawStage(now) {
  const camera = state.camera;
  setAttr(stageEl, "viewBox", frameFor().join(" "));
  // The postures stand still, so they have no motion to show.
  const moving = state.mode !== "base";
  stagePanelEl.classList.toggle("is-solo", timeline.solo);
  setAttr(floorEl, "d", floorPath(camera));
  drawFencer(fencers.A, inkFigure(now.A, 1, camera, { backView: true }));
  drawFencer(fencers.B, inkFigure(now.B, -1, camera, { backView: true, older: true }));
  if (state.ink) setAttr(inkEl, "filter", "url(#ink-texture)");
  else inkEl.removeAttribute("filter");

  ghostsEl.classList.toggle("hidden", !state.ghosts || !moving);
  if (state.ghosts && moving) {
    for (const k of GHOSTS) {
      const then = poseAt(timeline, Math.max(0, state.time - k * GHOST_GAP_MS));
      const a = samePose(then.A, now.A) ? NO_GHOST : stickFigure(then.A, 1, camera);
      const b = samePose(then.B, now.B) ? NO_GHOST : stickFigure(then.B, -1, camera);
      setAttr(fencers.A.ghostBodies[k], "d", a.body);
      setAttr(fencers.A.ghostBlades[k], "d", a.blade);
      setAttr(fencers.B.ghostBodies[k], "d", b.body);
      setAttr(fencers.B.ghostBlades[k], "d", b.blade);
    }
  }

  trailsEl.classList.toggle("hidden", !state.trail || !moving);
  if (state.trail && moving) {
    if (!trails || trails.camera !== camera) trails = { camera, ...bladePaths(timeline, camera) };
    let done = 0;
    while (done < trails.times.length && trails.times[done] <= state.time + 0.5) done++;
    setAttr(trailEls.fullA, "d", polyline(trails.a, trails.a.length));
    setAttr(trailEls.fullB, "d", polyline(trails.b, trails.b.length));
    setAttr(trailEls.doneA, "d", polyline(trails.a, done));
    setAttr(trailEls.doneB, "d", polyline(trails.b, done));
  }
}

// A link to a reference, which opens in a new tab and tells that page nothing about this one.
function referenceLink(href) {
  const link = element("a", "reference-link", href);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(element("span", "visually-hidden", " (opens in a new tab)"));
  return link;
}

// A fact's words, or a line saying there are none yet.
function setFact(el, text, none) {
  el.classList.toggle("is-empty", !text);
  setText(el, text || none);
}

// A control that has just been hidden, such as a button that changed the mode,
// cannot keep the focus. The button of the mode on show takes it, so a person on
// the keyboard is not sent back to the top of the page.
function keepFocus() {
  const focused = document.activeElement;
  if (focused && focused !== document.body && focused.closest(".hidden")) {
    [...modeButtons].find((button) => button.dataset.mode === state.mode)?.focus();
  }
}

// Which panels and controls the mode shows. Only a change of mode needs it.
let modeShown = null;

function renderMode() {
  if (modeShown === state.mode) return;
  modeShown = state.mode;
  for (const { el, modes } of modePanels) el.classList.toggle("hidden", !modes.includes(state.mode));
  for (const button of modeButtons) setPressed(button, button.dataset.mode === state.mode);
  const unit = state.mode === "base" ? "posture" : "step";
  setAttr(prevButton, "aria-label", `Previous ${unit}`);
  setAttr(nextButton, "aria-label", `Next ${unit}`);
}

let detailShown = null;

function renderLibrary() {
  if (listShown !== libraryVersion) {
    listShown = libraryVersion;
    renderSceneList();
  }
  for (const { key, button } of sceneButtons) setPressed(button, key === state.scene);

  // The facts about the scene change only when the scene or the list does.
  const scene = scenes.find((candidate) => candidate.key === state.scene) ?? scenes[0];
  const shown = `${libraryVersion}:${scene.key}`;
  if (detailShown === shown) return;
  detailShown = shown;
  const { phrase } = scene;
  setText(sceneTitleEl, sceneName(phrase));
  setText(sceneKindEl, scene.builtin ? "Built in" : "Saved on this device");
  setFact(sceneEventEl, sceneText(phrase, "event"), "Not noted yet");
  setFact(sceneNoteEl, sceneText(phrase, "note"), "None");
  const reference = metaText(phrase, "reference").trim();
  const href = referenceUrl(reference);
  sceneReferenceEl.classList.toggle("is-empty", !href);
  if (href) sceneReferenceEl.replaceChildren(referenceLink(href));
  else sceneReferenceEl.replaceChildren(reference ? "Not shown: it is not a web address." : "No link yet");
  setText(sceneEditButton, scene.builtin ? "Edit a copy in the Creator" : "Edit in the Creator");
  sceneDeleteButton.classList.toggle("hidden", scene.builtin);
}

let baseShown = -1;

function renderBase(index) {
  baseButtons.forEach((button, i) => setPressed(button, i === index));
  if (baseShown === index) return;
  baseShown = index;
  const base = BASES[index];
  setText(baseNameEl, POSE_NAMES[base.pose] || base.pose);
  setText(baseGroupEl, base.group);
  setText(baseTextEl, base.text);
  setText(baseKeyEl, base.pose);
  basePointsEl.replaceChildren(...base.points.map(([what, how]) => fact(what, how)));
}

function renderCreator(index, step) {
  const phrase = state.phrase;
  const fencer = editingFencer();

  // While the data is text that is not a phrase yet, the fields wait: a change
  // to one would put the last good phrase over what is being typed.
  const paused = state.phraseError !== "";
  for (const el of editors) setDisabled(el, paused, phraseTextEl);

  // The scene as a whole.
  for (const key of TEXT_KEYS) setValue(metaInputs[key], metaText(phrase, key));
  if (metaSoloEl.checked !== timeline.solo) metaSoloEl.checked = timeline.solo;
  const reference = metaText(phrase, "reference").trim();
  const badLink = reference !== "" && referenceUrl(reference) === null;
  setText(referenceHintEl, badLink ? "That is not a web address: it has to start with http:// or https://." : "");
  referenceHintEl.classList.toggle("field__hint--error", badLink);
  setText(sceneSaveButton, state.editing ? "Save changes" : "Save to library");
  sceneSaveCopyButton.classList.toggle("hidden", !state.editing);
  setText(saveStatusEl, state.saveMessage || (paused ? "On hold: the phrase data is not applied yet." : ""));
  saveStatusEl.classList.toggle("phrase-status--error", state.saveMessage !== "" && state.saveTone === "error");
  saveStatusEl.classList.toggle("phrase-status--warn", state.saveMessage === "" && paused);

  // This step: what the phrase itself says, not what the page fills in.
  const own = isPlainObject(phrase.steps[index]) ? phrase.steps[index] : {};
  setValue(stepNameEl, typeof own.label === "string" ? own.label : "");
  setAttr(stepNameEl, "placeholder", `Step ${index + 1}`);
  setValue(stepMsEl, typeof own.ms === "number" ? own.ms : "");
  setDisabled(stepMsEl, paused || index === 0, paused ? phraseTextEl : stepHoldEl);
  setValue(stepHoldEl, typeof own.hold === "number" ? own.hold : "");
  setValue(stepEaseEl, own.ease === "snap" || own.ease === "linear" ? own.ease : "");
  setText(stepHintEl, index === 0 ? "The first step is where the scene starts, so it has no move time." : "");
  setDisabled(stepRemoveButton, paused || timeline.steps.length < 2, paused ? phraseTextEl : stepNameEl);

  // Adjust this moment, and the poses.
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

  let status = `Applied: ${timeline.steps.length} ${timeline.steps.length === 1 ? "step" : "steps"}, ${seconds(timeline.duration)} s`;
  let tone = "ok";
  if (state.phraseError) {
    status = `Not applied: ${state.phraseError}. The fields are on hold until it is.`;
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

function render() {
  const steps = timeline.steps;
  const index = currentIndex();
  const step = steps[index];
  const shown = state.pin !== null && state.pin < steps.length ? step : poseAt(timeline, state.time);
  const time = Math.min(state.time, timeline.duration);

  renderMode();
  drawStage(shown);
  setText(stepCountEl, `${twoDigits(index + 1)} / ${twoDigits(steps.length)}`);
  setText(stepLabelEl, step.label);
  setText(timecodeEl, `${seconds(time)} / ${seconds(timeline.duration)} s`);

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

  if (state.mode === "library") renderLibrary();
  else if (state.mode === "base") renderBase(index);
  else renderCreator(index, step);
  keepFocus();
}

setSaved(readSaved(getStorage()));
parked = creatorView(newPhrase());
state.baseline = parked.phraseText;
state.baselineCamera = parked.camera;
showScene(PRESETS[0].id);
