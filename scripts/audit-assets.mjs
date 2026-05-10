// Asset audit — counts the sprite URLs the game ACTUALLY references at runtime
// and reports total size. Sprite-atlas packing only makes sense once this
// cumulative size or texture-bind overhead becomes a measured bottleneck.
//
// Run: `node scripts/audit-assets.mjs`
//
// Threshold for revisiting #74:
//   - cumulative loaded asset size > 2 MB,  OR
//   - measured PerfOverlay (Shift+P) shows < 60 FPS on mid-tier hardware
//     during peak combat (200+ active sprites).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const codeFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) codeFiles.push(full);
  }
}
walk(path.join(ROOT, 'src'));

// Find all asset URL references in source: anything with assets/.../*.png|jpg|ogg|mp3
const refs = new Set();
const re = /assets\/[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|gif|ogg|mp3|wav)/g;
for (const f of codeFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) refs.add(m[0]);
}

let totalBytes = 0;
let missing = 0;
const sizes = [];
for (const r of refs) {
  const full = path.join(ROOT, 'public', r);
  try {
    const stat = fs.statSync(full);
    totalBytes += stat.size;
    sizes.push({ path: r, bytes: stat.size });
  } catch {
    missing++;
  }
}
sizes.sort((a, b) => b.bytes - a.bytes);

console.log(`\nReferenced assets: ${refs.size}  |  Missing: ${missing}`);
console.log(`Total size: ${(totalBytes / 1024).toFixed(1)} KB (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`\nTop 10 by size:`);
for (const s of sizes.slice(0, 10)) {
  console.log(`  ${(s.bytes / 1024).toFixed(1).padStart(7)} KB  ${s.path}`);
}

console.log(`\n--- Atlas threshold (#74) ---`);
const ATLAS_THRESHOLD_MB = 2;
const totalMB = totalBytes / 1024 / 1024;
if (totalMB >= ATLAS_THRESHOLD_MB) {
  console.log(`Above ${ATLAS_THRESHOLD_MB} MB threshold — sprite atlas would help. Pack the top-N items.`);
} else {
  console.log(`Below ${ATLAS_THRESHOLD_MB} MB threshold — atlas not needed yet. Defer #74.`);
}
