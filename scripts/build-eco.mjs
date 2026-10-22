// Downloads Lichess's open (CC0) list of named openings and saves it as
// src/data/eco.json, keyed by position, so any board position can be named.
// Run with: node scripts/build-eco.mjs (only needed when the list changes).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';
const out = {};
let count = 0;
for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const text = await (await fetch(`${base}${file}.tsv`)).text();
  for (const row of text.trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    chess.loadPgn(pgn);
    const epd = chess.fen().split(' ').slice(0, 4).join(' ');
    // Keep the shortest move order for a position that has several names.
    if (!out[epd] || out[epd][2].length > pgn.length) out[epd] = [eco, name, pgn];
    count++;
  }
}
writeFileSync(join(root, 'src/data/eco.json'), JSON.stringify(out));
console.log(`${count} openings, ${Object.keys(out).length} positions`);
