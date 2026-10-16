// What GitHub Pages will serve: site/ as it is, with no build step.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

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

test("every element the script looks up is on the page, once", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  const wanted = [...app.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  for (const [, template] of app.matchAll(/getElementById\(`([^`]+)`\)/g)) {
    for (const fencer of ["a", "b"]) wanted.push(template.replace("${id}", fencer));
  }
  assert.ok(wanted.length > 30);
  for (const id of wanted) assert.ok(ids.includes(id), `#${id} is not in index.html`);
  for (const attr of ["data-speed", "data-toggle"]) {
    assert.ok(html.includes(attr) && app.includes(`[${attr}]`), attr);
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
