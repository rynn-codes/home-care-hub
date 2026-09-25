#!/usr/bin/env node
/**
 * Build the demo as one HTML file.
 *
 * The published demo is a single page: the app's script and stylesheet
 * inlined into index.html, so it can be handed to the artifact host as one
 * file with nothing to fetch. Routing uses the hash (VITE_STANDALONE_DEMO)
 * because a hosted single file has no server to answer /billing.
 *
 *   npm run demo            → demo/joy-health.html
 *
 * Nothing about the page changes here beyond where its code lives: the
 * <script src> becomes an inline module at the end of <body>, and the
 * <link rel="stylesheet"> becomes a <style> in <head>. The output directory
 * is ignored by git; the file is a build product, not a source.
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dist = resolve(root, "dist");
const outDir = resolve(root, "demo");
const outFile = resolve(outDir, "joy-health.html");

execSync("npx vite build", { cwd: root, stdio: "inherit", env: { ...process.env, VITE_STANDALONE_DEMO: "true" } });

let html = readFileSync(resolve(dist, "index.html"), "utf8");

const script = html.match(/<script type="module" crossorigin src="\/assets\/([^"]+\.js)"><\/script>\s*/);
const style = html.match(/<link rel="stylesheet" crossorigin href="\/assets\/([^"]+\.css)">\s*/);
if (!script || !style) throw new Error("dist/index.html does not look like a Vite build: script or stylesheet tag not found");

const js = readFileSync(resolve(dist, "assets", script[1]), "utf8")
  // A literal "</script>" inside the bundle would end the inline tag early.
  .replace(/<\/script/gi, "<\\/script");
const css = readFileSync(resolve(dist, "assets", style[1]), "utf8");

// Function replacements: a string replacement would read "$&" and "$1" inside
// the bundle as patterns and quietly corrupt the code.
html = html.replace(script[0], () => "").replace(style[0], () => `<style>\n${css}\n    </style>\n    `);
html = html.replace("</body>", () => `  <script type="module">\n${js}\n    </script>\n  </body>`);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);
console.log(`Wrote ${outFile} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
