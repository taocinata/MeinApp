/**
 * version.js — Injects git commit hash into the build.
 *
 * 1. Writes public/version.json  { version, buildTime }
 * 2. Updates CACHE_NAME in public/sw.js so each deploy busts the SW cache
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// Get git hash (fallback to timestamp if not a git repo)
let hash;
try {
  hash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
  hash = Date.now().toString(36);
}

const buildTime = Date.now();
const version   = `${hash}`;

// 1. Write public/version.json
const versionJson = path.join(root, 'public', 'version.json');
fs.writeFileSync(versionJson, JSON.stringify({ version, buildTime }, null, 2));
console.log(`[version] ${version}  (${new Date(buildTime).toISOString()})`);

// 2. Patch CACHE_NAME in public/sw.js
const swPath = path.join(root, 'public', 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE_NAME\s*=\s*['"][^'"]*['"]/, `const CACHE_NAME = 'meinapp-${version}'`);
fs.writeFileSync(swPath, sw);
console.log(`[version] sw.js CACHE_NAME → meinapp-${version}`);
