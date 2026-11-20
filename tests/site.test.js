// What GitHub Pages will serve: site/ as it is, with no build step.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { SECTIONS } from "../site/js/library.js";
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
  // Scripts import each other, and the one library kept in site/vendor; the 3D figures are imported only when wanted.
  for (const { name, source } of scripts) {
    const imports = [...source.matchAll(/^import\b[^"]*"([^"]+)"/gm), ...source.matchAll(/\bimport\("([^"]+)"\)/g)];
    for (const [, path] of imports) {
      assert.match(path, /^(\.\/[\w-]+|\.\.\/vendor\/[\w.-]+)\.js$/, `${name} imports ${path}`);
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
  for (const attr of ["data-speed", "data-toggle", "data-tab", "data-mode", "data-modes"]) {
    assert.ok(html.includes(attr) && app.includes(`[${attr}]`), attr);
  }
});

const MODES = ["library", "base", "creator"];

test("the page has a tab for each section and one for the Creator, and a switch between a section's library and postures", () => {
  const tabs = [...html.matchAll(/<button\b[^>]*\bdata-tab="([^"]+)"[^>]*>([^<]*)</g)];
  assert.deepEqual(tabs.map((m) => m[1]), [...SECTIONS.map(({ id }) => id), "creator"]);
  assert.deepEqual(tabs.slice(0, -1).map((m) => m[2]), SECTIONS.map(({ name }) => name), "each tab is named as its section is");
  assert.match(tabs[0][0], /aria-pressed="true"/);
  for (const tab of tabs.slice(1)) assert.match(tab[0], /aria-pressed="false"/);
  assert.equal([...html.matchAll(/class="mode-button"/g)].length, tabs.length, "the tabs are the page's mode buttons");

  // The switch chooses between the two modes a section has: its practice library and its base postures.
  const choices = [...html.matchAll(/<button\b[^>]*\bdata-mode="([^"]+)"[^>]*>/g)];
  assert.deepEqual(choices.map((m) => m[1]), ["library", "base"]);
  assert.match(choices[0][0], /aria-pressed="true"/);
  assert.match(choices[1][0], /aria-pressed="false"/);
  assert.match(html, /<div id="view-switch"[^>]*data-modes="library base"/);
});

test("each mode has panels of its own, and the page opens on the library with only its panels showing", () => {
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

test("the library the 3D figures are drawn with and the bodies they are made of come with their licences", () => {
  assert.deepEqual(readdirSync(new URL("vendor/", SITE)).toSorted(), ["MIT-three.js.txt", "three.module.min.js"]);
  assert.match(read("vendor/MIT-three.js.txt"), /^The MIT License\n\nCopyright © 2010-2024 three\.js authors/);
  assert.match(read("vendor/three.module.min.js").slice(0, 200), /Copyright 2010-2024 Three\.js Authors\n \* SPDX-License-Identifier: MIT/);
  assert.match(read("vendor/three.module.min.js").slice(0, 300), /const t="170"/, "three.js r170, as the README says");
  assert.deepEqual(readdirSync(new URL("models/", SITE)).toSorted(), ["CC0-MakeHuman.txt", "fencers.bin"]);
  const cc0 = read("models/CC0-MakeHuman.txt");
  assert.match(cc0, /makehumancommunity\/makehuman\nat commit a8bc2d54ff0ac92e78ff71431b1023eda42bf482/);
  assert.match(cc0, /# Creative Commons CC0 1\.0 Universal/);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.license, "Apache-2.0 AND OFL-1.1 AND MIT AND CC0-1.0");
});

test("the fields hold typing to the same limits the scene is saved and shown within", () => {
  const limitOf = (id) => Number(html.match(new RegExp(`<(?:input|textarea)\\b[^>]*\\bid="${id}"[^>]*>`))?.[0].match(/\bmaxlength="(\d+)"/)?.[1]);
  for (const key of TEXT_KEYS) assert.equal(limitOf(`meta-${key}`), TEXT_LIMITS[key], `#meta-${key}`);
  assert.equal(limitOf("step-name"), TEXT_LIMITS.label, "#step-name");
});

test("the stage is shown in a mirror, so the fencers are right-handed, and the light is moved to fall from the upper left of what is seen", () => {
  // The skeleton has the sabre in the left hand of both fencers (rig.test.js holds it to that), which flipped across the page
  // is the right, with A on the right facing left.
  const frame = css.match(/\.stage__frame\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(frame, /transform:\s*scaleX\(-1\)/, "the frame the figures and the stage's own drawing share is flipped");
  // So the light, which is from the left of what is seen, is to the right in the frame the figures are drawn in.
  const sun = read("js/stage3d.js").match(/sun\.position\.set\((-?\d+), (-?\d+), (-?\d+)\)/);
  assert.ok(sun, "the light is set in stage3d.js");
  assert.ok(Number(sun[1]) > 0 && Number(sun[2]) > 0 && Number(sun[3]) > 0, "high, in front and to the right of the figures");
});

test("each fencer's sabre edge is drawn in the colour of his blade's path, as the page's styles have it", () => {
  const css = read("css/styles.css");
  const stage = read("js/stage3d.js");
  const edges = stage.match(/const EDGE = \{ A: "(#[0-9a-f]{6})", B: "(#[0-9a-f]{6})" \};/);
  assert.ok(edges, "the edge colours are set in stage3d.js");
  for (const [who, colour] of [["a", edges[1]], ["b", edges[2]]]) {
    assert.equal(css.match(new RegExp(`--trail-${who}: (#[0-9a-f]{6});`))?.[1], colour, `fencer ${who.toUpperCase()}`);
  }
});
