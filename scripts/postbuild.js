#!/usr/bin/env node
/**
 * Post-build step for the web export.
 *
 * `expo export --platform web` produces a single-page app at dist/index.html
 * (the GamerCoPlay app itself). We want the marketing landing page to live at
 * the site root (/) and the app to live at /app instead.
 *
 * This script:
 *   1. Renames the exported app entry  dist/index.html -> dist/app.html
 *   2. Copies the static landing page  web/landing.html -> dist/index.html
 *
 * Vercel rewrites (see vercel.json) then map /app and /app/* to /app.html.
 * The app's JS/asset URLs are absolute (/_expo/...), so it loads fine from any
 * route.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const exportedAppEntry = path.join(dist, 'index.html');
const appTarget = path.join(dist, 'app.html');
const landingSource = path.join(root, 'web', 'landing.html');

if (!fs.existsSync(exportedAppEntry)) {
  console.error(
    `[postbuild] Expected ${exportedAppEntry} to exist. Did "expo export" run first?`
  );
  process.exit(1);
}

if (!fs.existsSync(landingSource)) {
  console.error(`[postbuild] Missing landing page source: ${landingSource}`);
  process.exit(1);
}

// 1. Move the exported app entry to /app.html
fs.renameSync(exportedAppEntry, appTarget);
console.log('[postbuild] dist/index.html -> dist/app.html');

// 2. Place the landing page at the site root
fs.copyFileSync(landingSource, exportedAppEntry);
console.log('[postbuild] web/landing.html -> dist/index.html');

console.log('[postbuild] Done. Landing at /, app at /app.');
