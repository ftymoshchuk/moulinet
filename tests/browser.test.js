// The page in a real browser: headless Chrome or Chromium loads it from a
// local server, runs it, and hands back the DOM it ended up with.
//
// Skipped when no browser is found (set CHROME_BIN to point at one). CI sets
// REQUIRE_BROWSER=1, so there a missing browser fails instead.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { accessSync, constants, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { siteHandler } from "../scripts/serve.js";

const run = promisify(execFile);
const BROWSERS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
const DRIVER = readFileSync(new URL("./drive.html", import.meta.url));

function findBrowser() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const name of BROWSERS) {
      try {
        accessSync(join(dir, name), constants.X_OK);
        return join(dir, name);
      } catch {
        // Not here; keep looking.
      }
    }
  }
  return null;
}

const browser = findBrowser();
const skip = !browser && process.env.REQUIRE_BROWSER !== "1" && "no Chrome or Chromium found; set CHROME_BIN to run it";

/**
 * Opens `path` in the browser, served with the site, and returns the DOM the
 * page ended with and every line it logged to the console.
 */
async function openInBrowser(path) {
  assert.ok(browser, "REQUIRE_BROWSER=1, but no Chrome or Chromium was found; set CHROME_BIN");
  const site = siteHandler();
  const server = createServer((request, response) => {
    if (request.url !== "/drive.html") return site(request, response);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(DRIVER);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = await mkdtemp(join(tmpdir(), "moulinet-browser-"));
  try {
    const { stdout, stderr } = await run(
      browser,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--no-first-run",
        `--user-data-dir=${profile}`,
        "--enable-logging=stderr",
        "--virtual-time-budget=5000",
        "--dump-dom",
        `http://127.0.0.1:${server.address().port}${path}`,
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
    );
    // The page logs nothing, so any console line is a problem: an uncaught
    // error, a failed load, something the security policy refused.
    return { dom: stdout, consoleLines: stderr.split("\n").filter((line) => line.includes(":CONSOLE")) };
  } finally {
    server.close();
    await rm(profile, { recursive: true, force: true });
  }
}

test("in a browser, the page builds its controls and draws the first phrase", { skip, timeout: 120_000 }, async () => {
  const { dom, consoleLines } = await openInBrowser("/");
  assert.deepEqual(consoleLines, []);
  const count = (pattern) => (dom.match(pattern) ?? []).length;
  assert.equal(count(/class="preset-button"/g), 4, "phrase buttons");
  assert.match(dom, /class="preset-button" aria-pressed="true">Advance, lunge, head cut</);
  assert.equal(count(/class="step-button"/g), 8, "step buttons");
  assert.equal(count(/class="pose-button"/g), 11, "pose buttons");
  assert.equal(count(/<input type="range" id="joint-/g), 10, "joint sliders");
  assert.match(dom, /id="step-count"[^>]*>\d\d \/ 08</);
  assert.match(dom, /id="phrase-status"[^>]*>Applied: 8 steps, 3\.39 s</);
  const paths = [...dom.matchAll(/<path\b[^>]*?\sd="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(paths.filter(Boolean).length > 60, `only ${paths.filter(Boolean).length} paths drawn`);
  for (const d of paths) assert.doesNotMatch(d, /NaN|Infinity|undefined/);
});

test("in a browser, every control does what it says", { skip, timeout: 120_000 }, async () => {
  const { dom, consoleLines } = await openInBrowser("/drive.html");
  assert.deepEqual(consoleLines, []);
  const json = dom.match(/<pre id="results">([^<]*)<\/pre>/)?.[1];
  assert.ok(json, "the driver did not finish");
  const { errors, seen } = JSON.parse(json.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"));
  assert.deepEqual(errors, []);
  assert.equal(seen.badPaths, 0, "paths with NaN, Infinity or undefined");

  assert.deepEqual(
    seen.phrases.map(({ name, pressed, count, solo, canEditB, camera, status, time, scrubbedTo }) => [name, pressed, count, solo, canEditB, camera, status, time, scrubbedTo]),
    [
      ["Advance, lunge, head cut", "true", "01 / 08", false, true, "0", "Applied: 8 steps, 3.39 s", "0.00 / 3.39 s", "08 / 08"],
      ["Chest cut, parry 3", "true", "01 / 04", false, true, "0", "Applied: 4 steps, 3.32 s", "0.00 / 3.32 s", "04 / 04"],
      ["Parry 5, riposte to head", "true", "01 / 05", false, true, "28", "Applied: 5 steps, 3.44 s", "0.00 / 3.44 s", "05 / 05"],
      ["Moulinet to head (solo)", "true", "01 / 07", true, false, "25", "Applied: 7 steps, 2.68 s", "0.00 / 2.68 s", "07 / 07"],
    ],
  );

  assert.deepEqual(seen.stepped, {
    count: "03 / 08",
    label: "Advance: front foot lands",
    play: "Play",
    announced: "Step 3 of 8: Advance: front foot lands",
  });
  assert.deepEqual(seen.posed, {
    line: '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":245}},',
    pressed: ["Parry 3parry3"],
    editing: "Step 3: Advance: front foot lands. Fencer B.",
  });
  assert.deepEqual(seen.adjusted, {
    line: '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":200,"adj":{"blade":100}}},',
    said: "100°",
  });
  assert.equal(seen.reset, '    {"label":"Advance: front foot lands","ms":110,"A":{"pose":"advLand","x":-30},"B":{"pose":"parry3","x":200}},');

  assert.deepEqual(seen.toggledOff, { pressed: ["false", "false", "false", "false"], ghostsHidden: true, trailsHidden: true, inkFilter: null });
  assert.equal(seen.inkFilter, "url(#ink-texture)");
  assert.deepEqual(seen.camera, { shown: "-40°", floorTurned: true });
  assert.deepEqual(seen.speed, ["true", "false", "false"]);
  assert.equal(seen.playing, "Pause");
  assert.equal(seen.paused, "Play");

  assert.match(seen.broken.status, /^Not applied: /);
  assert.equal(seen.broken.isError, true);
  assert.equal(seen.broken.kept, '{"steps": [', "the text stays as typed");
  assert.match(seen.broken.count, /\/ 08$/, "the last good phrase stays on stage");
  assert.deepEqual(seen.unknown, {
    status: "Applied. Unknown pose flunge shown as guard",
    isWarning: true,
    count: "02 / 02",
    camera: "60",
    labels: ["01Feint", "02<b>Cut</b>"],
    markup: 0,
  });
  assert.deepEqual(seen.solo, { solo: true, canEditB: false, editing: "Step 1: Alone. Fencer A.", status: "Applied: 1 step, 0.00 s" });
});
