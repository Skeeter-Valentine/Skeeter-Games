// Copies the site's puzzle-difficulty and gauntlet lineup code into
// functions/shared so the Cloud Functions award exactly the chili rating
// players see and accept exactly the lineups the site shows. Runs automatically
// before `firebase deploy` (firebase.json predeploy) and before the functions
// tests. functions/shared is generated, so it is not kept in git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const out = path.join(root, 'functions', 'shared');

export function sharedFiles(entry = path.join(src, 'utils', 'dailyDifficulty.js')) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
      stack.push(path.resolve(path.dirname(file), match[1]));
    }
  }
  return [...seen].map(file => path.relative(src, file)).sort();
}

export function syncShared() {
  fs.rmSync(out, { recursive: true, force: true });
  // Puzzle difficulty (peppers) and the gauntlet lineup rules.
  const files = [...new Set([...sharedFiles(), ...sharedFiles(path.join(src, 'gauntlet', 'weeklyLineup.js'))])];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
    fs.copyFileSync(path.join(src, file), path.join(out, file));
  }
  return files.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Copied ${syncShared()} files to functions/shared`);
