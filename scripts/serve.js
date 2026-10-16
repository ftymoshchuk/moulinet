// Serves site/ the way GitHub Pages does, for working on the page locally:
//
//   npm start                   http://127.0.0.1:8000/
//   PORT=8080 npm start
//
// Only this machine can reach it. The browser tests serve the site with it too.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_DIR = fileURLToPath(new URL("../site/", import.meta.url));

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** A request handler that answers with the files under `root`, and 404 for anything else. */
export function siteHandler(root = SITE_DIR) {
  const base = resolve(root);
  return async (request, response) => {
    try {
      const { pathname } = new URL(request.url, "http://localhost");
      let path = resolve(base, `.${decodeURIComponent(pathname)}`);
      if (path !== base && !path.startsWith(base + sep)) throw new Error("outside the site");
      if ((await stat(path)).isDirectory()) path = join(path, "index.html");
      const body = await readFile(path);
      response.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
    }
  };
}

export function createSiteServer(root = SITE_DIR) {
  return createServer(siteHandler(root));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8000;
  createSiteServer().listen(port, "127.0.0.1", () => {
    console.log(`Sabre Motion Lab is at http://127.0.0.1:${port}/ (Ctrl+C stops it)`);
  });
}
