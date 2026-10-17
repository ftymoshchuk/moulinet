import assert from "node:assert/strict";
import { test } from "node:test";

import { PRESETS } from "../site/js/library.js";
import { newPhrase } from "../site/js/phrase.js";
import { STORAGE_KEY, deleteScene, newId, readSaved, referenceUrl, saveScene, sceneSummary } from "../site/js/scenes.js";

// Browser storage, in memory: the two calls the page makes of it.
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
}

// A browser that will not keep anything: full, or in a mode that forbids it.
const refusingStorage = { getItem: () => null, setItem: () => { throw new DOMException("full", "QuotaExceededError"); } };

const stored = (scenes, version = 1) => JSON.stringify({ version, scenes });
const scene = (id, name = id) => ({ id, phrase: { ...newPhrase(), name } });

test("a reference link is opened only if it is a web address", () => {
  assert.equal(referenceUrl("https://example.com/watch?v=abc"), "https://example.com/watch?v=abc");
  assert.equal(referenceUrl("http://example.com"), "http://example.com/");
  assert.equal(referenceUrl("  https://example.com/a b  "), "https://example.com/a%20b", "spaces round it go, spaces in it are escaped");
  assert.equal(referenceUrl("HTTPS://EXAMPLE.COM/Path"), "https://example.com/Path");
  // Typed with a slash short, it is still a web address, and the link shows it as the one it is.
  assert.equal(referenceUrl("https:example.com"), "https://example.com/");
});

test("a link that is a script, a file, a mail form or anything but http and https is never one", () => {
  const refused = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\nscript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "mailto:someone@example.com",
    "blob:https://example.com/1234",
    "about:blank",
    "//example.com/x",
    "/watch?v=abc",
    "example.com/watch",
    "www.example.com",
    "https://",
  ];
  for (const link of refused) assert.equal(referenceUrl(link), null, JSON.stringify(link));
});

test("a link with a name and password in front, one that is too long, or one that is not text, is refused", () => {
  assert.equal(referenceUrl("https://user:pass@example.com/"), null);
  assert.equal(referenceUrl("https://google.com@evil.example/"), null, "the host is not the one it starts with");
  assert.equal(referenceUrl(`https://example.com/${"a".repeat(2000)}`), null);
  for (const value of [undefined, null, 5, {}, ["https://example.com"], true, ""]) assert.equal(referenceUrl(value), null, String(value));
});

test("a scene is described in words: pair or solo, steps, seconds", () => {
  assert.deepEqual(PRESETS.map(({ phrase }) => sceneSummary(phrase)), [
    "Pair · 8 steps · 3.4 s",
    "Pair · 4 steps · 3.3 s",
    "Pair · 5 steps · 3.4 s",
    "Solo · 7 steps · 2.7 s",
  ]);
  assert.equal(sceneSummary(newPhrase()), "Pair · 1 step · 0.6 s");
});

test("saved scenes come back as they were saved, newest first", () => {
  const storage = memoryStorage();
  assert.deepEqual(readSaved(storage), [], "nothing saved yet");
  const first = saveScene(storage, scene("x", "First").phrase);
  const second = saveScene(storage, scene("x", "Second").phrase);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(readSaved(storage).map(({ phrase }) => phrase.name), ["Second", "First"]);
  assert.deepEqual(second.scenes, readSaved(storage));
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)).version, 1);
});

test("saving a scene that is already saved changes it in place; one that is gone is saved anew", () => {
  const storage = memoryStorage();
  const a = saveScene(storage, scene("a", "A").phrase);
  const b = saveScene(storage, scene("b", "B").phrase);
  const changed = saveScene(storage, { ...scene("a").phrase, name: "A, changed" }, a.id);
  assert.equal(changed.id, a.id);
  assert.deepEqual(readSaved(storage).map(({ id, phrase }) => [id, phrase.name]), [[b.id, "B"], [a.id, "A, changed"]], "it keeps its place");
  const lost = saveScene(storage, scene("c", "C").phrase, "no-such-id");
  assert.notEqual(lost.id, "no-such-id");
  assert.equal(readSaved(storage).length, 3);
});

test("a scene saved in another tab is not lost to this one's older list", () => {
  const storage = memoryStorage();
  saveScene(storage, scene("a", "Mine").phrase);
  // Another tab saves while this one still shows its own list.
  const other = readSaved(storage);
  storage.data.set(STORAGE_KEY, stored([scene("theirs", "Theirs"), ...other]));
  saveScene(storage, scene("b", "Mine too").phrase);
  assert.deepEqual(readSaved(storage).map(({ phrase }) => phrase.name), ["Mine too", "Theirs", "Mine"]);
  assert.deepEqual(deleteScene(storage, "theirs").map(({ phrase }) => phrase.name), ["Mine too", "Mine"]);
});

test("a saved scene is forgotten, and forgetting one that is not there changes nothing", () => {
  const storage = memoryStorage();
  const a = saveScene(storage, scene("a", "A").phrase);
  const b = saveScene(storage, scene("b", "B").phrase);
  assert.deepEqual(deleteScene(storage, a.id).map(({ id }) => id), [b.id]);
  assert.deepEqual(deleteScene(storage, "nope").map(({ id }) => id), [b.id]);
  assert.deepEqual(readSaved(storage).map(({ id }) => id), [b.id]);
});

test("a browser that will not keep scenes, or give storage at all, is reported, not thrown", () => {
  assert.equal(saveScene(refusingStorage, newPhrase()), null);
  assert.equal(deleteScene(refusingStorage, "a"), null);
  assert.equal(saveScene(null, newPhrase()), null);
  assert.deepEqual(readSaved(null), []);
  assert.deepEqual(readSaved(refusingStorage), []);
});

test("what is stored but cannot be read is left out, and the rest still comes back", () => {
  const good = scene("good");
  const cases = {
    "not JSON": "{oops",
    "not an object": "[]",
    "null": "null",
    "another version": stored([good], 2),
    "no version": JSON.stringify({ scenes: [good] }),
    "scenes not a list": JSON.stringify({ version: 1, scenes: {} }),
  };
  for (const [what, text] of Object.entries(cases)) {
    assert.deepEqual(readSaved(memoryStorage({ [STORAGE_KEY]: text })), [], what);
  }
  const mixed = stored([
    good,
    scene("good"),
    { id: "", phrase: newPhrase() },
    { id: 5, phrase: newPhrase() },
    { id: "no-phrase" },
    { id: "no-steps", phrase: { steps: [] } },
    { id: "steps-not-a-list", phrase: { steps: {} } },
    { id: "phrase-is-text", phrase: "guard" },
    null,
    7,
    scene("also-good"),
  ]);
  assert.deepEqual(readSaved(memoryStorage({ [STORAGE_KEY]: mixed })).map(({ id }) => id), ["good", "also-good"]);
});

test("a new id is one the saved scenes do not have", () => {
  const taken = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}` }));
  const ids = new Set();
  for (let i = 0; i < 200; i++) ids.add(newId(taken));
  assert.ok(ids.size > 190, "ids differ from one call to the next");
  for (const id of ids) assert.ok(id && !taken.some((scene) => scene.id === id));
  const real = Date.now;
  const random = Math.random;
  try {
    // Time stands still and the dice repeat: the first id is taken, so it moves on.
    Date.now = () => 1;
    let calls = 0;
    Math.random = () => (calls++ < 1 ? 0.5 : 0.25);
    assert.equal(newId([{ id: `1${(0.5).toString(36).slice(2, 6)}` }]), `1${(0.25).toString(36).slice(2, 6)}`);
  } finally {
    Date.now = real;
    Math.random = random;
  }
});
