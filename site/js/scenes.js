// Scenes people make: the link that says where one was noted, and the scenes
// saved on this device. A scene is a phrase, with its name, event, reference
// and note beside the steps.
import { buildTimeline, isPlainObject } from "./phrase.js";

export const STORAGE_KEY = "moulinet.scenes";
const VERSION = 1;
const MAX_LINK = 2000;

/**
 * The address a reference link opens, or null if `value` is not a web address.
 * Only http and https count, and not with a name and password in front, so a
 * link that is really a script, a file or a mail form is never put on the page
 * as a link, whoever wrote it into the scene.
 */
export function referenceUrl(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_LINK) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.href;
}

/** A scene's size in words, for its card in the library: "Pair · 8 steps · 3.4 s". */
export function sceneSummary(phrase) {
  const { solo, steps, duration } = buildTimeline(phrase);
  return `${solo ? "Solo" : "Pair"} · ${steps.length} ${steps.length === 1 ? "step" : "steps"} · ${(duration / 1000).toFixed(1)} s`;
}

// ---------- Saved on this device ----------
//
// `storage` is a browser's localStorage, or null where the browser will not
// give one. Every call reads what is stored afresh and writes it back whole, so
// a scene saved in another tab is not lost to this one's older copy.
//
// Writing back whole means giving back all of it. What this page cannot show, an
// entry it does not understand or a setting it does not know, is written back as
// it was, after the scenes it can; and a store from a newer version of the page
// is not written at all, since this one would only destroy it.

function readable(entry) {
  if (!isPlainObject(entry) || typeof entry.id !== "string" || !entry.id) return false;
  const { phrase } = entry;
  return isPlainObject(phrase) && Array.isArray(phrase.steps) && phrase.steps.length > 0;
}

// What is stored: the scenes this page can show, everything else to give back
// with them (`kept` entries and `rest` of the store), and whether it was written
// by a newer version of the page.
function readStore(storage) {
  let data;
  try {
    data = JSON.parse(storage.getItem(STORAGE_KEY));
  } catch {
    data = null;
  }
  const empty = { scenes: [], kept: [], rest: {}, newer: false };
  if (!isPlainObject(data)) return empty;
  if (data.version !== VERSION) return { ...empty, newer: typeof data.version === "number" && data.version > VERSION };
  const rest = { ...data };
  delete rest.version;
  delete rest.scenes;
  const seen = new Set();
  const scenes = [];
  const kept = [];
  for (const entry of Array.isArray(data.scenes) ? data.scenes : []) {
    if (readable(entry) && !seen.has(entry.id)) {
      seen.add(entry.id);
      scenes.push({ id: entry.id, phrase: entry.phrase });
    } else {
      kept.push(entry);
    }
  }
  return { scenes, kept, rest, newer: false };
}

/** The saved scenes, newest first, as `{ id, phrase }`. What cannot be read is left out. */
export function readSaved(storage) {
  return readStore(storage).scenes;
}

function write(storage, store, scenes) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...store.rest, version: VERSION, scenes: [...scenes, ...store.kept] }));
    return true;
  } catch {
    return false;
  }
}

/** A scene id that none of `scenes` has. */
export function newId(scenes) {
  const taken = new Set(scenes.map((scene) => scene.id));
  let id;
  do {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  } while (taken.has(id));
  return id;
}

/**
 * Saves `phrase` as the scene `id`, or as a new scene, at the top, when `id` is
 * null or no longer saved. Returns the scene's id and every saved scene, or
 * `{ error }`: "storage" if the browser would not keep them, "newer" if they
 * were saved by a newer version of the page, which this one leaves alone.
 */
export function saveScene(storage, phrase, id = null) {
  const store = readStore(storage);
  if (store.newer) return { error: "newer" };
  const scenes = store.scenes;
  const at = id === null ? -1 : scenes.findIndex((scene) => scene.id === id);
  let saved = id;
  if (at >= 0) {
    scenes[at] = { id, phrase };
  } else {
    saved = newId([...scenes, ...store.kept.filter(isPlainObject)]);
    scenes.unshift({ id: saved, phrase });
  }
  return write(storage, store, scenes) ? { id: saved, scenes } : { error: "storage" };
}

/** Forgets the saved scene `id`. Returns the scenes left, or `{ error }` as saveScene does. */
export function deleteScene(storage, id) {
  const store = readStore(storage);
  if (store.newer) return { error: "newer" };
  const scenes = store.scenes.filter((scene) => scene.id !== id);
  return write(storage, store, scenes) ? { scenes } : { error: "storage" };
}
