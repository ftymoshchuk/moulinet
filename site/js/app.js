// The page: wires the controls to a phrase and draws it, every frame while it plays.
//
// One stage serves three modes. The practice library plays a scene and says
// where it was noted. The base postures show one fencer in one posture at a
// time, in words as well as lines, and let a person change a posture's numbers
// for their own device. The Creator makes new scenes.
//
// The page has three tabs. Live knowledge and Book knowledge are sections, each
// with a practice library and base postures of its own; the Creator is the third.
import { BASE_BLADE, BASE_SECTIONS, FIGURE_DIR, FIGURE_NOTE, basePhrase, basesOf } from "./bases.js";
import { CAMERA_LIMIT, DEFAULT_FRAME, bladePaths, floorPath, frameFrom, frameOf, groundPath, handFrame, planFigure, planFloorPath, planFrame, stickFigure } from "./figure.js";
import { HANDLES, jointsOf, placeOf, shareOf, solve, stagePoint } from "./handles.js";
import { JOINTS, POSE_NAMES, POSES, PRESETS, SECTIONS } from "./library.js";
import {
  TEXT_KEYS,
  TEXT_LIMITS,
  buildTimeline,
  clearAdjustments,
  clearJoint,
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
  resolvePose,
  samePose,
  setJoint,
  setMeta,
  setPose,
  setSolo,
  setStepField,
} from "./phrase.js";
import {
  POSTURES_KEY,
  POSTURE_JOINTS,
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
} from "./postures.js";
import { milestoneLabel, moveTime, pauseTime, recordNote } from "./record.js";
import { STORAGE_KEY, deleteScene, readSaved, referenceUrl, saveScene, sceneSummary } from "./scenes.js";

const SVG_NS = "http://www.w3.org/2000/svg";
// Four motion ghosts, each this far behind the one before.
const GHOSTS = [1, 2, 3, 4];
const GHOST_GAP_MS = 45;
// What a fencer who has not moved leaves behind.
const NO_GHOST = { body: "", blade: "" };
// The most one frame may advance, so a tab coming back does not leap ahead.
const MAX_FRAME_MS = 64;
const MODE_NAMES = { library: "Practice library", base: "Base postures", creator: "Creator" };
const SECTION_NAMES = Object.fromEntries(SECTIONS.map(({ id, name }) => [id, name]));

// The tabs, and the pair of buttons that choose between a section's practice library and its base postures.
const tabButtons = document.querySelectorAll("[data-tab]");
const modeButtons = document.querySelectorAll("[data-mode]");
const viewSwitchEl = document.getElementById("view-switch");
// Every panel that belongs to some modes only, with the modes it belongs to.
const modePanels = [...document.querySelectorAll("[data-modes]")].map((el) => ({ el, modes: el.dataset.modes.split(" ") }));
// The base postures of each section, in the order they are shown.
const sectionBases = Object.fromEntries(SECTIONS.map(({ id }) => [id, basesOf(id)]));

const workspaceEl = document.getElementById("main");
const stagePanelEl = document.getElementById("stage-panel");
const stageEl = document.getElementById("stage");
const frameEl = document.getElementById("stage-frame");
const handlesEl = document.getElementById("handles");
// The plan: the fencers from above, under the stage, with the dots of the parts that turn toward or away from you.
const planEl = document.getElementById("plan");
const planFrameEl = document.getElementById("plan-frame");
const planViewEl = document.getElementById("plan-view");
const planHandlesEl = document.getElementById("plan-handles");
const planFloorEl = document.getElementById("plan-floor");
const planPaths = {
  A: { shoes: document.getElementById("plan-shoes-a"), body: document.getElementById("plan-body-a"), blade: document.getElementById("plan-blade-a") },
  B: { shoes: document.getElementById("plan-shoes-b"), body: document.getElementById("plan-body-b"), blade: document.getElementById("plan-blade-b") },
};
const canvas3dEl = document.getElementById("stage-3d");
const stageNoteEl = document.getElementById("stage-note");
const versionsNoteEl = document.getElementById("versions-note");
const recordNoteEl = document.getElementById("record-note");
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
const sceneSourceEl = document.getElementById("scene-source");
const sceneEventEl = document.getElementById("scene-event");
const sceneReferenceEl = document.getElementById("scene-reference");
const sceneNoteEl = document.getElementById("scene-note");
const sceneEditButton = document.getElementById("scene-edit");
const sceneDeleteButton = document.getElementById("scene-delete");

// The base postures.
const baseListEl = document.getElementById("base-list");
const basesIntroEl = document.getElementById("bases-intro");
const basesNoteEl = document.getElementById("bases-note");
const baseNameEl = document.getElementById("base-name");
const baseGroupEl = document.getElementById("base-group");
const baseTextEl = document.getElementById("base-text");
const basePointsEl = document.getElementById("base-points");
const baseKeyEl = document.getElementById("base-key");
const baseVersionEl = document.getElementById("base-version");
const figuresPanelEl = document.getElementById("figures-panel");
const baseFiguresEl = document.getElementById("base-figures");

// A posture's numbers, to change for this device.
const postureEditButton = document.getElementById("posture-edit");
const posturePanelEl = document.getElementById("posture-panel");
const postureTargetEl = document.getElementById("posture-target");
const postureDoneButton = document.getElementById("posture-done");
const postureGuardEl = document.getElementById("posture-guard");
const postureJointsEl = document.getElementById("posture-joints");
const postureResetButton = document.getElementById("posture-reset");
const postureCopyButton = document.getElementById("posture-copy");
const postureStatusEl = document.getElementById("posture-status");
const postureDetailsEl = document.getElementById("posture-details");
const postureNumbersEl = document.getElementById("posture-numbers");

// The Creator.
const metaInputs = {
  name: document.getElementById("meta-name"),
  source: document.getElementById("meta-source"),
  event: document.getElementById("meta-event"),
  reference: document.getElementById("meta-reference"),
  note: document.getElementById("meta-note"),
};
// The sources the scenes in the library already name, offered as the source is typed, so they are spelt alike.
const sourceListEl = document.getElementById("source-list");
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
  // The section whose tab is open, "live" or "book"; with the Creator on show, the
  // one it was opened from.
  section: "live",
  // The scene on stage in the practice library, by key, and the posture on
  // stage in the base postures, by number within its section.
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
  // A close-up of the sword hand, from outside the arm.
  closeUp: false,
  // In the Creator, the dots on the stage that parts of the fencers are dragged by.
  handles: true,
  // In the Creator, the fencers seen from above, under the stage, with dots of their own.
  plan: true,
  // In the Creator, recording: each part of a fencer let go of after a drag makes a milestone, a step after the one the drag
  // began from, which takes as long as the drag did.
  record: false,
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
  // Whether the numbers of the posture on show are open to change, and what keeping the person's version of it last said.
  editPosture: false,
  postureMessage: "",
  postureTone: "",
};
// state.phrase laid out in time, and its blade paths for one camera angle.
let timeline = buildTimeline(null);
let trails = null;
// Where the stage looks, worked out once for each timeline.
let framed = { timeline: null, frame: DEFAULT_FRAME };
// What the Creator had on stage while another mode has the stage.
let parked = null;

// What each section last had on stage, for when its tab is opened again: its
// practice library or its base postures, and the posture it was on. A section with
// no scenes of its own opens on its postures.
const views = Object.fromEntries(SECTIONS.map(({ id }) => [id, { mode: "library", base: 0 }]));

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
    ...PRESETS.map(({ id, section, phrase }) => ({ key: id, builtin: true, section, phrase })),
    // A saved scene has no section of its own yet, so it stays in the practice library of live knowledge, where it always was.
    ...saved.map(({ id, phrase }) => ({ key: `saved:${id}`, id, builtin: false, section: "live", phrase })),
  ];
  libraryVersion++;
}

// The scenes in a section's practice library.
function scenesOf(section) {
  return scenes.filter((scene) => scene.section === section);
}

// The scene a section opens on: the one last on stage if it is the section's own, or its first. Null if it has none.
function sceneFor(section) {
  const own = scenesOf(section);
  return own.find((scene) => scene.key === state.scene) ?? own[0] ?? null;
}

// The tab that is open: a section's, or the Creator's.
function openTab() {
  return state.mode === "creator" ? "creator" : state.section;
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

// A camera angle held to the camera slider's range, which a pasted phrase is held to as well.
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

// A scene from the library, at its start and paused: nothing on the page plays until Play is pressed.
function showScene(key) {
  const scene = scenes.find((candidate) => candidate.key === key) ?? scenes[0];
  const phrase = clone(scene.phrase);
  usePhrase(phrase);
  Object.assign(state, {
    mode: "library",
    section: scene.section,
    scene: scene.key,
    time: 0,
    pin: null,
    playing: false,
    camera: clampCamera(phrase.camera),
    fencer: "A",
    phraseText: phraseToText(phrase),
    phraseError: "",
  });
  update();
}

// The base postures of the open section, paused on posture `index`.
function showBase(index) {
  const phrase = basePhrase(state.section);
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
    postureMessage: "",
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
    views[state.section] = { mode: "base", base: state.base };
    // The numbers of a posture are open to change only while the postures are on show.
    state.editPosture = false;
  } else if (state.mode === "library") {
    views[state.section] = { ...views[state.section], mode: "library" };
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

// Chooses what the open section shows, its practice library or its base postures, or opens the Creator.
function pickMode(mode) {
  if (mode === state.mode) return;
  leaveMode();
  // A section with no scenes has no library to show, so the library is the first section's that has one.
  if (mode === "library") showScene((sceneFor(state.section) ?? scenes[0]).key);
  else if (mode === "base") showBase(views[state.section].base);
  else showCreator();
  announce(MODE_NAMES[mode]);
}

// Opens a tab: a section, as it was when it was last on show, or the Creator.
function pickTab(tab) {
  if (tab === "creator") return pickMode("creator");
  if (tab === state.section && state.mode !== "creator") return;
  leaveMode();
  state.section = tab;
  const scene = views[tab].mode === "library" ? sceneFor(tab) : null;
  if (scene) showScene(scene.key);
  else showBase(views[tab].base);
  announce(SECTION_NAMES[tab]);
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
  Object.assign(state, { pin: index, playing: false, time: step.holdStart, postureMessage: "" });
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
const TEXT_NAMES = { name: "name", source: "source", event: "event", reference: "reference link", note: "note" };

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

// ---------- The person's versions of the postures ----------

// What the page says when a version could not be kept.
const POSTURE_ERRORS = {
  storage: "This browser would not keep your version, so it lasts only until you leave the page.",
  newer: "The versions on this device were saved by a newer version of this page, so this one leaves them alone. Yours lasts only until you leave the page. Reload the page to update it.",
};

function postureName(name) {
  return POSE_NAMES[name] || name;
}

// Names in a sentence: "Guard (tierce) and Parry 3".
const andList = new Intl.ListFormat("en", { type: "conjunction" });

// The posture on show among the base postures, by the name of its pose.
function currentPosture() {
  return sectionBases[state.section][currentIndex()].pose;
}

// Puts `versions` in force and keeps them on this device, then works every pose out again with them: the postures, the
// scene on show and the Creator's scene all use the postures by name. A version the browser would not keep still holds
// until the page is left.
function changeVersions(versions, said) {
  useVersions(versions);
  const result = saveVersions(getStorage(), versionsInUse());
  Object.assign(state, result.error ? { postureMessage: POSTURE_ERRORS[result.error], postureTone: "error" } : { postureMessage: said, postureTone: "" });
  usePhrase(state.phrase);
  update();
}

function moveJointOfPosture(key, value) {
  const next = moveJoint(versionsInUse(), currentPosture(), key, value);
  if (next) changeVersions(next, "Saved on this device.");
}

function putJointOfPostureBack(key) {
  changeVersions(putJointBack(versionsInUse(), currentPosture(), key), "Saved on this device.");
}

// All of the posture's changes at once, which asks first: they may be a lot of careful work.
function putPostureBackToBuiltIn() {
  const name = currentPosture();
  if (!hasVersion(name) || !window.confirm(`Put the built-in numbers back on ${postureName(name)}? Your changes to it are lost.`)) return;
  changeVersions(putPostureBack(versionsInUse(), name), "Back to the built-in numbers.");
}

// Copies the numbers of every posture the person has made a version of, to send on. A browser that will not copy
// leaves them selected in their box, to be copied by hand.
async function copyNumbers() {
  const have = versionedPostures();
  if (have.length === 0) return;
  let copied = true;
  try {
    await navigator.clipboard.writeText(numbersText(versionsInUse()));
  } catch {
    copied = false;
  }
  if (!copied) {
    postureDetailsEl.open = true;
    postureNumbersEl.focus();
    postureNumbersEl.select();
  }
  const which = `${have.length === 1 ? "one posture" : `${have.length} postures`}: ${andList.format(have.map(postureName))}`;
  Object.assign(state, copied ? { postureMessage: `Copied the numbers of ${which}.`, postureTone: "" } : { postureMessage: "This browser would not copy them, so they are selected below: copy them yourself.", postureTone: "warn" });
  update();
}

// Opens the numbers of the posture on show to change, or closes them.
function openPosture(open) {
  Object.assign(state, { editPosture: open, postureMessage: "" });
  // The button that was pressed is where the person is, so it keeps the focus when the panel it belongs to goes.
  if (!open) postureEditButton.focus();
  update();
  if (open) postureControls[0].input.focus();
  announce(open ? `Editing the numbers of ${postureName(currentPosture())}.` : "Done editing.");
}

// ---------- Clock ----------

let frame = 0;
let lastTick = null;

// ---------- The 3D figures ----------

// The fencers are 3D figures, which load as the page opens: the drawing code, then
// the bodies. The stage waits a moment for them; if they take longer, or this
// browser cannot draw them, it shows the fencers as stick figures meanwhile.
let stage3d = null;
let waitFor3d = 0;
const WAIT_FOR_3D_MS = 1500;

// Whether this browser can draw them, before anything is fetched for them: they
// need WebGL 2, and a way to uncompress the bodies.
function canDraw3d() {
  if (typeof DecompressionStream !== "function") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

// Says under the stage why the fencers are stick figures.
function noteStickFigures(why) {
  setText(stageNoteEl, `The fencers are drawn as stick figures, as ${why}.`);
  stageNoteEl.classList.remove("hidden");
}

function start3d() {
  waitFor3d = performance.now() + WAIT_FOR_3D_MS;
  setTimeout(update, WAIT_FOR_3D_MS);
  Promise.resolve()
    .then(() => {
      if (!canDraw3d()) throw Object.assign(new Error("no WebGL 2"), { why: "this browser cannot draw them in 3D, having no WebGL 2" });
      return import("./stage3d.js");
    })
    .then(({ createStage3d }) => createStage3d(canvas3dEl))
    .then((stage) => {
      stage3d = stage;
    })
    .catch((error) => noteStickFigures(error.why ?? `their 3D figures could not be loaded (${error.message})`))
    .finally(() => {
      waitFor3d = 0;
      update();
    });
}

// Whether the stage shows the 3D figures now. A browser can take the drawing
// away, as when a graphics card is reset, and then the stick figures stand in.
function showing3d() {
  if (stage3d?.lost) {
    stage3d = null;
    noteStickFigures("the browser took the 3D figures' drawing away");
  }
  return Boolean(stage3d);
}

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
  const ghosts = document.getElementById(`ghosts-${id}`);
  const ghostBodies = {};
  const ghostBlades = {};
  // Oldest first, so the newest ghost is drawn on top.
  for (const k of [...GHOSTS].reverse()) ghostBodies[k] = svgPath(ghosts, `ghost ghost--${k}`);
  for (const k of [...GHOSTS].reverse()) ghostBlades[k] = svgPath(ghosts, `ghost-blade ghost-blade--${k}`);
  return {
    ground: document.getElementById(`ground-${id}`),
    stick: document.getElementById(`stick-${id}`),
    ghostBodies,
    ghostBlades,
  };
}

const fencers = { A: createFencer("a"), B: createFencer("b") };

// The slider of one joint, with its value and, where there is something to go back to, a Reset of its own. The Creator
// has one for each joint of the step being reshaped, and the postures have one for each joint of a posture being edited,
// so `idPrefix` keeps their ids apart. `change` is told the value the slider is moved to; `putBack` is what Reset does.
function jointControl(joint, parent, { idPrefix, goesBackTo, change, putBack }) {
  const id = `${idPrefix}-${joint.key}`;
  const wrapper = element("div", "joint");
  const row = element("div", "joint__row");
  const label = element("label", "", joint.label);
  label.htmlFor = id;
  const value = element("span", "joint__value");
  const input = element("input");
  input.type = "range";
  input.id = id;
  input.min = String(joint.min);
  input.max = String(joint.max);
  input.step = String(joint.step ?? 1);
  input.addEventListener("input", () => change(Math.round(Number(input.value))));
  // A joint that has been moved can be put back on its own, without touching the others. The position is where the
  // fencer stands, not a joint of the pose, so it has nothing to go back to.
  let reset = null;
  if (joint.key !== "x") {
    reset = element("button", "joint__reset", "Reset");
    reset.type = "button";
    setAttr(reset, "aria-label", `Reset ${joint.label.toLowerCase()} to ${goesBackTo}`);
    reset.addEventListener("click", () => {
      putBack();
      // The button goes away with the change, so the slider it belonged to keeps the focus.
      input.focus();
    });
  }
  row.append(label, value);
  // The position has no Reset, but keeps its place, so that the values line up down the column.
  if (reset) {
    row.append(reset);
  } else {
    const spacer = element("span", "joint__spacer");
    setAttr(spacer, "aria-hidden", "true");
    row.append(spacer);
  }
  wrapper.append(row, input);
  parent.append(wrapper);
  return { joint, input, value, reset };
}

const jointControls = JOINTS.map((joint) =>
  jointControl(joint, jointsEl, {
    idPrefix: "joint",
    goesBackTo: "the pose",
    change: (v) => editCurrent((spec) => setJoint(spec, joint.key, v)),
    putBack: () => editCurrent((spec) => clearJoint(spec, joint.key)),
  }),
);

// The same sliders for the numbers of a posture, in the base postures: every joint but where the fencer stands.
const postureControls = POSTURE_JOINTS.map((joint) =>
  jointControl(joint, postureJointsEl, {
    idPrefix: "posture-joint",
    goesBackTo: "the built-in",
    change: (v) => moveJointOfPosture(joint.key, v),
    putBack: () => putJointOfPostureBack(joint.key),
  }),
);

// ---------- Dragging the parts of a fencer ----------

// There are two views to drag in: the stage, from the side, where a part goes along the piste and up, and the plan, from
// above, where it goes along the piste and toward or away from you. Each has a box that is mirrored, the dots laid over it.
const surfaces = {
  side: { frame: frameEl, dots: handlesEl },
  plan: { frame: planFrameEl, dots: planHandlesEl },
};

// The dot on each part of each fencer in each view that has the part, made once and put where the part is each time the
// stage is drawn. Taking hold of one makes its fencer the one being edited.
const dots = ["A", "B"].flatMap((who) =>
  HANDLES.flatMap((part) =>
    ["side", "plan"]
      .filter((view) => jointsOf(part, view).length > 0)
      .map((view) => {
        const el = element("div", `handle handle--${who.toLowerCase()}${view === "plan" ? " handle--plan" : ""}`);
        setAttr(el, "title", view === "plan" ? `Drag to move ${who}'s ${part.name}, seen from above` : `Drag to move ${who}'s ${part.name}`);
        el.addEventListener("pointerdown", (event) => startDrag(event, who, part, el, view));
        surfaces[view].dots.append(el);
        return { who, part, view, el };
      }),
  ),
);

// What each view looks at, as it was last drawn, which is what a point of the page is placed against.
const looking = { side: DEFAULT_FRAME, plan: planFrame([], 180) };
// The drag in progress: the pointer that began it, whose part it is, in which view, the view's box as it was when it took
// hold, and how far the pointer was from the part then, so that the part does not jump to the pointer.
let drag = null;
// The recording in progress: how many milestones it has made, and the last of them, as the step it made, when the drag that
// made it last changed anything (ms, on the page's clock) and the scene's text as it left it, so that a milestone that follows
// on from it can tell nothing else has been done to the scene since.
let recording = { count: 0, last: null };
let wasRecording = false;

// Whether the dots are on the stage: in the Creator, while the stage shows a step's own pose, which is what changing it
// changes, and not a moment between two, and no text is waiting to be made a phrase of. A step picked is its own pose; so
// is a moment stopped in a step's hold, which is where pasting a phrase, pausing and moving along the timeline can leave
// the stage. Nothing is dragged while a scene plays.
function handlesShown() {
  if (state.mode !== "creator" || !state.handles || state.phraseError !== "" || state.playing) return false;
  if (state.pin !== null) return state.pin < timeline.steps.length;
  const at = poseAt(timeline, state.time);
  const step = timeline.steps[at.index];
  return at.A === step.A && at.B === step.B;
}

// Puts each dot of a view on its part of the fencer, by how far across and down the view it is, as it is drawn. A part that
// is off the view, as most are in the close-up of a hand, has no dot, and in the close-up only the hand of the fencer being
// reshaped is looked at, so only that fencer has dots.
function drawDots(view, now, camera, box) {
  const show = handlesShown();
  surfaces[view].dots.classList.toggle("hidden", !show);
  if (!show) return;
  const editing = editingFencer();
  for (const { who, part, view: dotView, el } of dots) {
    if (dotView !== view) continue;
    const [across, down] = shareOf(placeOf(now[who], who === "A" ? 1 : -1, camera, part, view), box);
    // A scene of one fencer has no dots on the other. The one being dragged stays, whether or not the part has gone beyond what
    // the view holds, which a view that holds still for the drag, as the plan does, lets it do.
    const outside = across < -0.01 || across > 1.01 || down < -0.01 || down > 1.01;
    const gone = (who === "B" && timeline.solo) || (view === "side" && state.closeUp && who !== editing) || (outside && drag?.el !== el);
    el.classList.toggle("hidden", gone);
    if (gone) continue;
    el.style.left = `${(across * 100).toFixed(2)}%`;
    el.style.top = `${(down * 100).toFixed(2)}%`;
    el.classList.toggle("is-other", who !== editing);
  }
}

// Which side of the piste the plan looks from: the one the stage looks from, as near as it goes, so that the two have A on
// the same side. Unlike the stage it does not turn with the camera, a plan being easiest to read with the piste across it.
function planCamera() {
  return Math.cos(((state.camera + SCENE_SIDE) * Math.PI) / 180) < 0 ? 180 : 0;
}

// What the plan looks at: every pose of the scene in it, so that it keeps one view as the scene is reshaped; and while a
// part is dragged in it, the view it had when the part was taken hold of, so that the part stays under the pointer.
let planned = { timeline: null, camera: null, frame: looking.plan };
function planBox(camera) {
  if (drag?.view === "plan") return drag.frame;
  if (planned.timeline !== timeline || planned.camera !== camera) {
    const fencers = timeline.steps.flatMap((step) => [[step.A, 1], ...(timeline.solo ? [] : [[step.B, -1]])]);
    planned = { timeline, camera, frame: planFrame(fencers, camera) };
  }
  return planned.frame;
}

// The plan, in the Creator: the fencers from above, and the dots.
function drawPlan(now) {
  const show = state.mode === "creator" && state.plan;
  planEl.classList.toggle("hidden", !show);
  if (!show) return;
  const camera = planCamera();
  const box = planBox(camera);
  looking.plan = box;
  setAttr(planViewEl, "viewBox", box.join(" "));
  setAttr(planFloorEl, "d", planFloorPath(camera));
  for (const [who, dir] of [["A", 1], ["B", -1]]) {
    const figure = planFigure(now[who], dir, camera);
    setAttr(planPaths[who].shoes, "d", figure.shoes);
    setAttr(planPaths[who].body, "d", figure.body);
    setAttr(planPaths[who].blade, "d", figure.blade);
  }
  drawDots("plan", now, camera, box);
}

// Where on a view, in its units, a pointer is. The views are shown in a mirror, which the page's own coordinates know nothing of.
function viewAt(event, view) {
  const el = surfaces[view].frame;
  const mirrored = new DOMMatrixReadOnly(getComputedStyle(el).transform).a < 0;
  return stagePoint([event.clientX, event.clientY], el.getBoundingClientRect(), looking[view], mirrored);
}

// The camera a view is looked at from.
const cameraOf = (view) => (view === "plan" ? planCamera() : viewCamera());

function startDrag(event, who, part, el, view) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (drag) {
    // Another finger is not heard. The same pointer pressing again says the last drag never saw it lifted, so that one is over.
    if (drag.pointer !== event.pointerId) return;
    stopDrag();
  }
  // Not a text selection, and on a touch screen not a scroll.
  event.preventDefault();
  state.fencer = who;
  const pose = timeline.steps[currentIndex()][who];
  const point = placeOf(pose, who === "A" ? 1 : -1, cameraOf(view), part, view);
  const grabbed = viewAt(event, view);
  drag = { pointer: event.pointerId, who, part, el, view, frame: looking[view], offset: [grabbed[0] - point[0], grabbed[1] - point[1]] };
  el.classList.add("is-dragging");
  window.addEventListener("pointermove", dragTo);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  update();
}

// Moves the part toward the pointer: the joints that move it take the values that put it nearest, as the view sees it, and
// only those that change are written to the step.
function dragTo(event) {
  if (!drag || event.pointerId !== drag.pointer) return;
  // A mouse button let go outside the page leaves no word of it.
  if (event.pointerType === "mouse" && event.buttons === 0) return endDrag(event);
  const { who, part, view, offset } = drag;
  const pointer = viewAt(event, view);
  const pose = timeline.steps[currentIndex()][who];
  // Whole numbers, except in the close-up of a hand, where a degree of the arm is a long way on the stage, so tenths.
  const values = solve(pose, who === "A" ? 1 : -1, cameraOf(view), part, [pointer[0] - offset[0], pointer[1] - offset[1]], view === "side" && state.closeUp ? 0.1 : 1, view);
  const changed = Object.entries(values).filter(([key, value]) => value !== pose[key]);
  if (changed.length === 0) return;
  // Recording, the first change a drag makes begins a milestone, which the drag then reshapes.
  if (state.record && drag.milestone === undefined) beginMilestone();
  editCurrent((spec) => {
    const given = resolvePose({ pose: spec.pose });
    for (const [key, value] of changed) {
      // A joint taken back to what the pose gives it is no longer an adjustment.
      if (key !== "x" && value === given[key]) clearJoint(spec, key);
      else setJoint(spec, key, value);
    }
  });
  drag.movedUntil = performance.now();
}

// Begins a milestone: a step after the one the drag began from, as that one stands, named for the part. It is the step on
// show from then on, so the drag reshapes it and the step it began from is left as it was. It follows on from the last
// milestone if it was begun from that one and the scene is as that one left it, with nothing done to it since.
function beginMilestone() {
  const base = currentIndex();
  const added = insertStep(state.phrase, timeline, base);
  if (!added) return;
  const last = recording.last;
  const followsOn = Boolean(last) && last.index === base && last.text === state.phraseText;
  const named = setStepField(added.phrase, added.index, "label", milestoneLabel(drag.who, drag.part.name)) ?? added.phrase;
  Object.assign(drag, { milestone: added.index, base, followsOn, movedFrom: performance.now() });
  applyEdit(named, added.index);
}

// Ends the milestone a drag made: the move into it takes as long as the drag did, from its first change to its last, and the
// step it followed on from, if it did, is held for the pause between the two.
function finishMilestone() {
  const { milestone, base, followsOn, movedFrom, movedUntil = movedFrom } = drag;
  if (milestone === undefined) return;
  let phrase = setStepField(state.phrase, milestone, "ms", moveTime(movedUntil - movedFrom)) ?? state.phrase;
  if (followsOn) phrase = setStepField(phrase, base, "hold", pauseTime(movedFrom - recording.last.endedAt)) ?? phrase;
  const count = recording.count + 1;
  applyEdit(phrase, milestone);
  recording = { count, last: { index: milestone, endedAt: movedUntil, text: state.phraseText } };
  announce(`Milestone ${count}: step ${milestone + 1} of ${timeline.steps.length}`);
}

function stopDrag() {
  finishMilestone();
  drag.el.classList.remove("is-dragging");
  drag = null;
  window.removeEventListener("pointermove", dragTo);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  // A close-up held still for the drag goes back to following the hand.
  update();
}

function endDrag(event) {
  if (drag && event.pointerId === drag.pointer) stopDrag();
}

// The poses, in groups as the sections of the page keep their base postures: each section's postures are its own poses.
const poseGroups = SECTIONS.map(({ id, name }) => ({ name, keys: sectionBases[id].map(({ pose }) => pose) }));
const grouped = new Set(poseGroups.flatMap(({ keys }) => keys));
const loose = Object.keys(POSES).filter((key) => !grouped.has(key));
if (loose.length) poseGroups.push({ name: "Other", keys: loose });
const poseButtons = [];
for (const { name: groupName, keys } of poseGroups) {
  const row = element("div", "poses");
  for (const key of keys) {
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
    row.append(button);
    poseButtons.push({ key, button });
  }
  const group = element("div", "list-group");
  group.append(element("h4", "list-group__title", groupName), row);
  posesEl.append(group);
}

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
  ...jointControls.map(({ reset }) => reset).filter(Boolean),
  ...poseButtons.map(({ button }) => button),
];

// The base postures of the section on show, grouped as the section groups them. The
// buttons are numbered in the order the postures are learned, which is the order of
// the steps; the list is rebuilt when the section changes.
let baseButtons = [];
// Each button says, while it is shown, that the person has made a version of its posture.
let baseMarks = [];
let baseListShown = "";

function renderBaseList() {
  if (baseListShown === state.section) return;
  baseListShown = state.section;
  const { groups, intro, note } = BASE_SECTIONS[state.section];
  baseButtons = [];
  baseMarks = [];
  baseListEl.replaceChildren(
    ...groups.map((group) => {
      const row = element("div", "base-buttons");
      sectionBases[state.section].forEach((base, i) => {
        if (base.group !== group) return;
        const button = element("button", "base-button");
        button.type = "button";
        const mark = element("span", "base-button__mine hidden", "edited");
        button.append(element("span", "step-button__number", twoDigits(i + 1)), POSE_NAMES[base.pose] || base.pose, mark);
        button.addEventListener("click", () => jumpTo(i));
        row.append(button);
        baseButtons[i] = button;
        baseMarks[i] = mark;
      });
      const list = element("div", "list-group");
      list.append(element("h4", "list-group__title", group), row);
      return list;
    }),
  );
  setText(basesIntroEl, intro);
  setText(basesNoteEl, note ?? "");
  basesNoteEl.classList.toggle("hidden", !note);
}

// The library's list follows the scenes, so it is rebuilt when they change.
let sceneButtons = [];
let listShown = "";

function renderSceneList() {
  sceneButtons = scenesOf(state.section).map((scene) => {
    const button = element("button", "scene-button");
    button.type = "button";
    button.append(element("span", "scene-button__title", sceneName(scene.phrase)));
    const source = sceneText(scene.phrase, "source");
    if (source) button.append(element("span", "scene-button__source", source));
    button.append(element("span", "scene-button__meta", sceneSummary(scene.phrase)));
    const event = sceneText(scene.phrase, "event");
    if (event) button.append(element("span", "scene-button__event", event));
    button.addEventListener("click", () => showScene(scene.key));
    return { key: scene.key, builtin: scene.builtin, button };
  });
  scenesBuiltinEl.replaceChildren(...sceneButtons.filter((scene) => scene.builtin).map((scene) => scene.button));
  scenesSavedEl.replaceChildren(...sceneButtons.filter((scene) => !scene.builtin).map((scene) => scene.button));
  scenesEmptyEl.classList.toggle("hidden", sceneButtons.some((scene) => !scene.builtin));
  const sources = [...new Set(scenes.map((scene) => sceneText(scene.phrase, "source")).filter(Boolean))].sort();
  sourceListEl.replaceChildren(...sources.map((source) => Object.assign(document.createElement("option"), { value: source })));
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

for (const button of tabButtons) button.addEventListener("click", () => pickTab(button.dataset.tab));
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

postureEditButton.addEventListener("click", () => openPosture(!state.editPosture));
postureDoneButton.addEventListener("click", () => openPosture(false));
postureResetButton.addEventListener("click", putPostureBackToBuiltIn);
postureCopyButton.addEventListener("click", copyNumbers);

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
// was deleted there, is a new scene from here on. The versions of the postures that
// another tab made or took back are drawn here too.
window.addEventListener("storage", (event) => {
  const postures = event.key === null || event.key === POSTURES_KEY;
  const scenesToo = event.key === null || event.key === STORAGE_KEY;
  if (!postures && !scenesToo) return;
  if (postures) {
    useVersions(readVersions(getStorage()));
    usePhrase(state.phrase);
    if (!scenesToo) return update();
  }
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

// The Creator keeps one view as a scene is reshaped; the library looks as close as
// keeps everyone and their whole blades in; the postures, as close as keeps the
// fencer and most of the blade in.
//
// A close-up looks at a sword hand instead, and follows it as it moves: the hand
// of the fencer being reshaped in the Creator, and A's elsewhere. While a part is
// dragged in it the view holds still, so that the part stays under the pointer, and
// goes back to following the hand when the pointer is let go.
//
// The box is worked out once for the camera at 0, and goes round with the camera.
function frameFor(now) {
  if (state.closeUp) {
    if (drag?.view === "side") return drag.frame;
    const who = state.mode === "creator" ? editingFencer() : "A";
    return handFrame(now[who], who === "A" ? 1 : -1, viewCamera());
  }
  if (state.mode === "creator") return frameFrom(DEFAULT_FRAME, viewCamera());
  const blade = state.mode === "base" ? BASE_BLADE : undefined;
  if (framed.timeline !== timeline || framed.blade !== blade) framed = { timeline, blade, frame: frameOf(timeline, blade) };
  return frameFrom(framed.frame, viewCamera());
}

// Which side of the piste the camera starts on, as how far round it is before the
// person turns it, which they can do all the way round. Everything is worked out in
// the frame the skeleton has, where the camera at 0 sees A's chest and B's back, and
// the fencers are left-handed. The stage is shown in a mirror (`.stage__frame` in
// styles.css), which makes them right-handed and, seen from 0, puts A on the right.
// The scenes and the Creator start on the other side, 180: the camera faces B, A is
// back on the left with his back and his sword arm toward you, and B's chest is
// toward you. The postures have the one fencer, and start from 0, so that he faces
// left with his chest toward you, as the book's fencer does in its photographs.
const SCENE_SIDE = 180;
const POSTURE_SIDE = 0;
function sideOf() {
  return state.mode === "base" ? POSTURE_SIDE : SCENE_SIDE;
}

// Where the camera looks from. The close-up looks from outside the sword arm,
// which is where the old books draw the grip and the hand positions from, whichever
// side the stage is seen from: in the skeleton's frame A's is on the side away from
// 0, so for A it looks from 180, and B's, who is A turned round, is on the side of 0,
// so for B, in the Creator, it looks from there. The camera turns it from there.
function viewCamera() {
  if (!state.closeUp) return state.camera + sideOf();
  const nearSide = state.mode === "creator" && editingFencer() === "B";
  return state.camera + (nearSide ? 0 : 180);
}

function drawStage(now) {
  const camera = viewCamera();
  const view = frameFor(now);
  looking.side = view;
  setAttr(stageEl, "viewBox", view.join(" "));
  // The postures stand still, so they have no motion to show.
  const moving = state.mode !== "base";
  stagePanelEl.classList.toggle("is-solo", timeline.solo);
  setAttr(floorEl, "d", floorPath(camera));
  const in3d = showing3d();
  canvas3dEl.classList.toggle("hidden", !in3d);
  if (in3d) {
    stage3d.draw({ poses: now, solo: timeline.solo, frame: view, camera, ink: state.ink });
    canvas3dEl.dataset.fencers = timeline.solo ? "A" : "A B";
  }
  // Without them, stick figures; as the page opens, the stage waits a moment for them first.
  const sticks = !in3d && performance.now() >= waitFor3d;
  for (const [who, dir] of [["A", 1], ["B", -1]]) {
    const stick = sticks ? stickFigure(now[who], dir, camera) : NO_GHOST;
    setAttr(fencers[who].stick, "d", stick.body + stick.blade);
    setAttr(fencers[who].ground, "d", groundPath(now[who], dir, camera));
  }
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
  drawDots("side", now, camera, view);
  drawPlan(now);
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
// cannot keep the focus. The button of what is on show takes it, so a person on
// the keyboard is not sent back to the top of the page: the one that chose the
// practice library or the postures if the section has that choice, or else its tab.
function keepFocus() {
  const focused = document.activeElement;
  if (focused && focused !== document.body && focused.closest(".hidden")) {
    const choice = viewSwitchEl.classList.contains("hidden") ? undefined : [...modeButtons].find((button) => button.dataset.mode === state.mode);
    (choice ?? [...tabButtons].find((button) => button.dataset.tab === openTab()))?.focus();
  }
}

// Which panels and controls the mode shows, and which tab is open. Only a change
// of mode or section, or of the scenes there are, needs it.
let modeShown = null;

function renderMode() {
  const shown = `${state.mode}:${state.section}:${libraryVersion}`;
  if (modeShown === shown) return;
  modeShown = shown;
  for (const { el, modes } of modePanels) el.classList.toggle("hidden", !modes.includes(state.mode));
  // The library and the postures are a choice only in a section that has both.
  viewSwitchEl.classList.toggle("hidden", state.mode === "creator" || scenesOf(state.section).length === 0);
  // The book's photographs have their panel only where the section's postures are the book's.
  figuresPanelEl.classList.toggle("hidden", state.mode !== "base" || !sectionBases[state.section].some((base) => base.figures?.length));
  for (const button of tabButtons) setPressed(button, button.dataset.tab === openTab());
  for (const button of modeButtons) setPressed(button, button.dataset.mode === state.mode);
  const unit = state.mode === "base" ? "posture" : "step";
  setAttr(prevButton, "aria-label", `Previous ${unit}`);
  setAttr(nextButton, "aria-label", `Next ${unit}`);
}

let detailShown = null;

function renderLibrary() {
  const list = `${libraryVersion}:${state.section}`;
  if (listShown !== list) {
    listShown = list;
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
  setFact(sceneSourceEl, sceneText(phrase, "source"), "Not noted yet");
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

let baseShown = "";

// The book's photographs of a posture, beside the stage: each with the number and caption it was printed
// with, and the page, and one line under them all about how they differ from the stage. A posture the book
// has no photograph of says so.
function renderFigures(figures) {
  const cards = figures.map(({ n, file, caption, page, width, height }) => {
    const card = element("figure", "book-figure");
    const image = element("img", "book-figure__image");
    image.src = `${FIGURE_DIR}${file}`;
    image.alt = `Photograph from the book: ${caption}`;
    image.width = width;
    image.height = height;
    image.decoding = "async";
    card.append(image, element("figcaption", "book-figure__caption", `Fig. ${n}. ${caption} Book p. ${page}.`));
    return card;
  });
  baseFiguresEl.replaceChildren(...(cards.length ? [...cards, element("p", "book-figures__note", FIGURE_NOTE)] : [element("p", "panel__intro", "The book has no photograph of this posture.")]));
}

// What a joint's slider says of a value: the number, its unit and the name of the position it is on, if it has one.
function jointText(joint, v) {
  const name = joint.names?.[v];
  return `${v}${joint.unit}${name ? ` (${name})` : ""}`;
}

// Puts a joint's slider at `number`. `moved` says whether it has been moved from what a Reset would put it back to, which
// it then shows, with a Reset to press; `back` says in the Reset's hint what it goes back to.
function showJoint({ joint, input, value, reset }, number, moved, back) {
  let v = Number(number) || 0;
  // A blade turned past half a circle shows as the same angle within it.
  if (joint.key === "blade" && (v < -180 || v > 180)) v = ((((v + 180) % 360) + 360) % 360) - 180;
  v = Math.round(v);
  const text = jointText(joint, v);
  setValue(input, v);
  setText(value, text);
  setAttr(input, "aria-valuetext", text);
  value.classList.toggle("is-adjusted", moved);
  if (reset) {
    reset.classList.toggle("is-idle", !moved);
    setAttr(reset, "title", back);
  }
}

// The numbers of the posture on show, which can be changed while they are open to change.
function renderPosture(name) {
  const open = state.editPosture;
  posturePanelEl.classList.toggle("hidden", !open);
  workspaceEl.classList.toggle("is-editing-posture", open);
  setAttr(postureEditButton, "aria-expanded", open ? "true" : "false");
  setText(postureEditButton, open ? "Done editing" : "Edit this posture");
  if (!open) return;
  setText(postureTargetEl, postureName(name));
  postureGuardEl.classList.toggle("hidden", name !== "guard");
  const moved = versionOf(name);
  const now = numbersOf(name);
  const given = givenBy(name);
  for (const control of postureControls) {
    const { joint } = control;
    showJoint(control, now[joint.key], Object.hasOwn(moved, joint.key), `Back to: ${jointText(joint, Math.round(Number(given[joint.key]) || 0))}`);
  }
  // A person who was on a button that has nothing to do now is put on the first slider.
  const first = postureControls[0].input;
  setDisabled(postureResetButton, !hasVersion(name), first);
  const have = versionedPostures().length;
  setDisabled(postureCopyButton, have === 0, first);
  // All their versions' numbers are in the box, to copy or to send on.
  const numbers = have === 0 ? "" : numbersText(versionsInUse());
  if (postureNumbersEl.value !== numbers) postureNumbersEl.value = numbers;
  setText(postureStatusEl, state.postureMessage);
  postureStatusEl.classList.toggle("phrase-status--error", state.postureTone === "error");
  postureStatusEl.classList.toggle("phrase-status--warn", state.postureTone === "warn");
}

// Said in the library and the Creator when some postures are drawn as the person made them: that is not how they are
// built in, and not how anyone else sees them.
function renderVersionsNote() {
  const have = versionedPostures();
  const show = state.mode !== "base" && have.length > 0;
  versionsNoteEl.classList.toggle("hidden", !show);
  if (!show) return;
  const one = have.length === 1;
  setText(
    versionsNoteEl,
    `Your own ${one ? "version" : "versions"} of ${andList.format(have.map(postureName))} ${one ? "is" : "are"} in use here, not the built-in ${one ? "one" : "ones"}. ${one ? "It is" : "They are"} on this device only. To go back to the built-in ${one ? "one" : "ones"}, use Edit this posture, in the base postures.`,
  );
}

// While recording, in the Creator: what to do, and how many milestones there are, or why nothing can be recorded now.
function renderRecordNote() {
  const show = state.mode === "creator" && state.record;
  recordNoteEl.classList.toggle("hidden", !show);
  if (show) setText(recordNoteEl, recordNote({ ready: handlesShown(), count: recording.count }));
}

function renderBase(index) {
  renderBaseList();
  const bases = sectionBases[state.section];
  const base = bases[index];
  baseButtons.forEach((button, i) => {
    setPressed(button, i === index);
    baseMarks[i].classList.toggle("hidden", !hasVersion(bases[i].pose));
  });
  baseVersionEl.classList.toggle("hidden", !hasVersion(base.pose));
  renderPosture(base.pose);
  const shown = `${state.section}:${index}`;
  if (baseShown === shown) return;
  baseShown = shown;
  setText(baseNameEl, POSE_NAMES[base.pose] || base.pose);
  setText(baseGroupEl, base.group);
  setText(baseTextEl, base.text);
  setText(baseKeyEl, base.pose);
  basePointsEl.replaceChildren(...base.points.map(([what, how]) => fact(what, how)));
  renderFigures(base.figures ?? []);
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
  // A step with no time to stay on it is passed through, which is worth knowing while timing it.
  let hint = "";
  if (index === 0) hint = "The first step is where the scene starts, so it has no move time.";
  else if (timeline.steps[index].through) hint = "With no time to stay on it, the move runs on through this step into the next without stopping.";
  setText(stepHintEl, hint);
  setDisabled(stepRemoveButton, paused || timeline.steps.length < 2, paused ? phraseTextEl : stepNameEl);

  // Adjust this moment, and the poses.
  setText(editTitleEl, `Step ${index + 1}: ${step.label}. Fencer ${fencer}.`);
  setPressed(fencerButtons.A, fencer === "A");
  setPressed(fencerButtons.B, fencer === "B");
  fencerButtons.B.disabled = timeline.solo;
  const target = step[fencer];
  const spec = step[`spec${fencer}`];
  const pose = isPlainObject(spec) ? spec.pose : undefined;
  // The joints this fencer has been moved on this step, and so can be put back to what the pose gives them.
  const moved = isPlainObject(spec) && isPlainObject(spec.adj) ? spec.adj : {};
  const given = resolvePose({ pose });
  for (const control of jointControls) {
    const { joint, reset } = control;
    // A joint that has been moved says so, and offers to go back to what the pose gives it, which it says.
    const adjusted = reset !== null && Object.hasOwn(moved, joint.key);
    showJoint(control, target[joint.key], adjusted, `Back to the pose: ${jointText(joint, Math.round(Number(given[joint.key]) || 0))}`);
  }
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
  // Nothing is being edited outside the base postures, and nothing is recorded outside the Creator; a recording that is
  // turned on starts from no milestones.
  if (state.mode !== "base") workspaceEl.classList.remove("is-editing-posture");
  if (state.mode !== "creator") state.record = false;
  if (state.record && !wasRecording) recording = { count: 0, last: null };
  wasRecording = state.record;
  renderVersionsNote();
  renderRecordNote();
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

// The canvas of the 3D figures is drawn at its size on the page, so a change of
// size draws them again, even when nothing is playing.
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    if (showing3d()) render();
  }).observe(canvas3dEl);
}

start3d();

useVersions(readVersions(getStorage()));
setSaved(readSaved(getStorage()));
parked = creatorView(newPhrase());
state.baseline = parked.phraseText;
state.baselineCamera = parked.camera;
showScene(PRESETS[0].id);
