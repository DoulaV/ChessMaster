// Copies the Stockfish engine (lite, single-threaded) into public/ so Vite serves it.
// Single-threaded means it runs on GitHub Pages without special server headers.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/stockfish/bin');
const out = join(root, 'public/stockfish');
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(join(src, f), join(out, f));
}
console.log('Stockfish copied to public/stockfish');
