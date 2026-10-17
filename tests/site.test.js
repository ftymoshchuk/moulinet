// What GitHub Pages will serve: site/ as it is, with no build step.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { TEXT_KEYS, TEXT_LIMITS } from "../site/js/phrase.js";

const SITE = new URL("../site/", import.meta.url);
const read = (path) => readFileSync(new URL(path, SITE), "utf8");
const html = read("index.html");
const css = read("css/styles.css");
const scripts = readdirSync(new URL("js/", SITE))
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, source: read(`js/${name}`) }));
const app = scripts.find((script) => script.name === "app.js").source;

test("the page loads only its own files, by relative paths that exist", () => {
  const fromHtml = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const fromCss = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => new URL(m[1], new URL("css/", SITE)));
  assert.ok(fromHtml.length >= 5 && fromCss.length >= 5);
  for (const ref of fromHtml) {
    // A leading slash would break under GitHub Pages' /moulinet/ prefix.
    assert.doesNotMatch(ref, /^(\/|[a-z]+:)/i, ref);
    assert.ok(existsSync(new URL(ref, SITE)), `${ref} is missing`);
  }
  for (const url of fromCss) {
    assert.ok(url.href.startsWith(SITE.href), `${url} is outside site/`);
    assert.ok(existsSync(url), `${url} is missing`);
  }
  for (const { name, source } of scripts) {
    for (const [, path] of source.matchAll(/^import\b[^"]*"([^"]+)"/gm)) {
      assert.match(path, /^\.\/[\w-]+\.js$/, `${name} imports ${path}`);
      assert.ok(existsSync(new URL(`js/${path}`, SITE)), `${name} imports ${path}, which is missing`);
    }
  }
});

test("the content security policy allows nothing from elsewhere", () => {
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(policy, "no policy");
  assert.match(policy, /default-src 'none'/);
  assert.doesNotMatch(policy, /https?:|\*|unsafe/);
  assert.doesNotMatch(html, /\sstyle="/, "inline styles are blocked by the policy");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "inline scripts are blocked by the policy");
});

test("no script builds HTML from strings, so phrase text can never become markup", () => {
  for (const { name, source } of scripts) {
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, name);
  }
});

test("every element the scripts look up is on the page, once", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  const wanted = [];
  for (const { source } of scripts) {
    wanted.push(...[...source.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]));
    for (const [, template] of source.matchAll(/getElementById\(`([^`]+)`\)/g)) {
      for (const fencer of ["a", "b"]) wanted.push(template.replace("${id}", fencer));
    }
  }
  assert.ok(wanted.length > 60);
  for (const id of wanted) assert.ok(ids.includes(id), `#${id} is not in index.html`);
  for (const attr of ["data-speed", "data-toggle", "data-mode", "data-modes"]) {
    assert.ok(html.includes(attr) && app.includes(`[${attr}]`), attr);
  }
});

const MODES = ["library", "base", "creator"];

test("each mode has a button and panels of its own, and the page opens on the library with only its panels showing", () => {
  const buttons = [...html.matchAll(/<button\b[^>]*\bdata-mode="([^"]+)"[^>]*>/g)];
  assert.deepEqual(buttons.map((m) => m[1]), MODES);
  assert.match(buttons[0][0], /aria-pressed="true"/);
  for (const button of buttons.slice(1)) assert.match(button[0], /aria-pressed="false"/);

  const panels = [...html.matchAll(/<[a-z]+\b[^>]*\bdata-modes="([^"]+)"[^>]*>/g)].map((m) => ({ modes: m[1].split(" "), tag: m[0] }));
  assert.ok(panels.length >= 15);
  for (const { modes, tag } of panels) {
    for (const mode of modes) assert.ok(MODES.includes(mode), `${mode} in ${tag}`);
    // The script shows the right panels at once, but not before it has loaded.
    const startsHidden = /\bclass="[^"]*\bhidden\b/.test(tag);
    assert.equal(startsHidden, !modes.includes("library"), `a panel for ${modes.join(" and ")} ${startsHidden ? "starts hidden" : "does not start hidden"}`);
  }
  for (const mode of MODES) {
    assert.ok(panels.some(({ modes }) => modes.length === 1 && modes[0] === mode), `${mode} has no panel of its own`);
  }
  assert.match(app, /MODE_NAMES = \{ library: "[^"]+", base: "[^"]+", creator: "[^"]+" \}/);
});

test("a link that opens a new tab says it opens nothing of this page to the other", () => {
  for (const [tag] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(tag, /rel="[^"]*noopener noreferrer/, tag);
  for (const { name, source } of scripts) {
    if (source.includes("_blank")) assert.match(source, /rel = "noopener noreferrer"/, name);
  }
});

test("every bundled font is used, preloaded fonts among them, and has its licence", () => {
  const fonts = readdirSync(new URL("fonts/", SITE));
  const woff2 = fonts.filter((name) => name.endsWith(".woff2"));
  const used = [...css.matchAll(/url\("\.\.\/fonts\/([^"]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(woff2.toSorted(), used.toSorted());
  for (const [, path] of html.matchAll(/rel="preload" href="fonts\/([^"]+)"/g)) assert.ok(used.includes(path), path);
  assert.deepEqual(fonts.filter((name) => name.endsWith(".txt")).toSorted(), ["OFL-BigShoulders.txt", "OFL-IBMPlex.txt"]);
  for (const licence of ["OFL-BigShoulders.txt", "OFL-IBMPlex.txt"]) {
    assert.match(read(`fonts/${licence}`), /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});

test("the fields hold typing to the same limits the scene is saved and shown within", () => {
  const limitOf = (id) => Number(html.match(new RegExp(`<(?:input|textarea)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0].match(/\bmaxlength="(\d+)"/)?.[1]);
  for (const key of TEXT_KEYS) assert.equal(limitOf(`meta-${key}`), TEXT_LIMITS[key], `#meta-${key}`);
  assert.equal(limitOf("step-name"), TEXT_LIMITS.label, "#step-name");
});
