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

/** The saved scenes, newest first, as `{ id, phrase }`. What cannot be read is left out. */
export function readSaved(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!isPlainObject(data) || data.version !== VERSION || !Array.isArray(data.scenes)) return [];
    const seen = new Set();
    const scenes = [];
    for (const entry of data.scenes) {
      if (!isPlainObject(entry) || typeof entry.id !== "string" || !entry.id || seen.has(entry.id)) continue;
      const { phrase } = entry;
      if (!isPlainObject(phrase) || !Array.isArray(phrase.steps) || phrase.steps.length === 0) continue;
      seen.add(entry.id);
      scenes.push({ id: entry.id, phrase });
    }
    return scenes;
  } catch {
    return [];
  }
}

function write(storage, scenes) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, scenes }));
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
 * null if the browser would not keep them.
 */
export function saveScene(storage, phrase, id = null) {
  const scenes = readSaved(storage);
  const at = id === null ? -1 : scenes.findIndex((scene) => scene.id === id);
  let saved = id;
  if (at >= 0) {
    scenes[at] = { id, phrase };
  } else {
    saved = newId(scenes);
    scenes.unshift({ id: saved, phrase });
  }
  return write(storage, scenes) ? { id: saved, scenes } : null;
}

/** Forgets the saved scene `id`. Returns the scenes left, or null if the browser would not keep the change. */
export function deleteScene(storage, id) {
  const scenes = readSaved(storage).filter((scene) => scene.id !== id);
  return write(storage, scenes) ? scenes : null;
}
