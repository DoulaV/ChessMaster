// Builds public/puzzles/<theme>.json from the Lichess puzzle database (CC0).
// Streams the 300 MB file without saving it, keeps well-tested puzzles rated
// 800 to 1600, and samples about 2,500 per theme evenly across the ratings.
// Run with (curl uses the network proxy if there is one; Python decompresses):
//   curl -sS https://database.lichess.org/lichess_db_puzzle.csv.zst \
//     | python3 -c "import sys,zstandard; zstandard.ZstdDecompressor().copy_stream(sys.stdin.buffer, sys.stdout.buffer)" \
//     | node scripts/build-puzzles.mjs

import { Chess } from 'chess.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 800;
const MAX = 1600;
const PER_THEME = 2500;
const BUCKETS = [800, 1000, 1200, 1400]; // 4 rating bands of 200
const PER_BUCKET = PER_THEME / BUCKETS.length;

// Our themes and the Lichess theme tags they come from.
const THEMES = {
  fork: ['fork'],
  'double-attack': ['fork'], // forks made by the queen (see below)
  pin: ['pin'],
  skewer: ['skewer'],
  'discovered-attack': ['discoveredAttack'],
  'back-rank-mate': ['backRankMate'],
  'removing-defender': ['capturingDefender'],
  'mate-in-1': ['mateIn1'],
  'mate-in-2': ['mateIn2'],
  // Used by the Course (Unit 2) and Tactics.
  'double-check': ['doubleCheck'],
  deflection: ['deflection'],
  decoy: ['attraction'],
  'defensive-move': ['defensiveMove'],
  'smothered-mate': ['smotheredMate'],
  'anastasia-mate': ['anastasiaMate'],
  'arabian-mate': ['arabianMate'],
};
// Optional: only build some themes, e.g. `node scripts/build-puzzles.mjs deflection,decoy`.
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
for (const t of Object.keys(THEMES)) if (only && !only.has(t)) delete THEMES[t];

// Lichess opening tags -> our opening ids.
const OPENINGS = [
  ['London_System', 'london'],
  ['Italian_Game', 'italian'],
  ['Ruy_Lopez', 'ruy-lopez'],
  ['Scotch_Game', 'scotch'],
  ['Vienna_Game', 'vienna'],
  ['Kings_Gambit', 'kings-gambit'],
  ['Queens_Gambit_Declined', 'qgd'],
  ['Queens_Gambit_Accepted', 'qga'],
  ['Slav_Defense', 'slav'],
  ['Queens_Gambit', 'queens-gambit'],
  ['English_Opening', 'english'],
  ['Catalan_Opening', 'catalan'],
  ['Petrovs_Defense', 'e5-black'],
  ['Philidor_Defense', 'e5-black'],
  ['Sicilian_Defense', 'sicilian'],
  ['French_Defense', 'french'],
  ['Caro-Kann_Defense', 'caro-kann'],
  ['Scandinavian_Defense', 'scandinavian'],
  ['Pirc_Defense', 'pirc'],
  ['Modern_Defense', 'pirc'],
  ['Alekhine_Defense', 'alekhine'],
  ['Kings_Indian_Defense', 'kings-indian'],
  ['Nimzo-Indian_Defense', 'nimzo-indian'],
  ['Grunfeld_Defense', 'grunfeld'],
  ['Dutch_Defense', 'dutch'],
  ['Benoni_Defense', 'benoni'],
];

function openingOf(tags) {
  for (const [needle, id] of OPENINGS) if (tags.includes(needle)) return id;
  return '';
}

/** Piece that plays the first solution move (after the opponent's setup move). */
function firstSolverPiece(fen, moves) {
  const c = new Chess(fen);
  const m = moves.split(' ');
  c.move({ from: m[0].slice(0, 2), to: m[0].slice(2, 4), promotion: m[0][4] });
  return c.get(m[1].slice(0, 2))?.type;
}

// Reservoir sampling per theme and rating band.
const res = {};
const seen = {};
for (const t of Object.keys(THEMES)) {
  res[t] = BUCKETS.map(() => []);
  seen[t] = BUCKETS.map(() => 0);
}
function offer(theme, bucket, item) {
  const n = ++seen[theme][bucket];
  const r = res[theme][bucket];
  if (r.length < PER_BUCKET) r.push(item);
  else {
    const j = Math.floor(Math.random() * n);
    if (j < PER_BUCKET) r[j] = item;
  }
}

let lines = 0;
let kept = 0;
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (lines++ === 0) continue; // header
  const [id, fen, moves, rating, rd, popularity, plays, themes, , openingTags] = line.split(',');
  const r = Number(rating);
  if (r < MIN || r >= MAX || Number(rd) > 90 || Number(popularity) < 85 || Number(plays) < 300) continue;
  const tags = themes.split(' ');
  const bucket = Math.min(BUCKETS.length - 1, Math.floor((r - MIN) / 200));
  const item = [id, fen, moves, r, openingOf(openingTags || '')];
  let used = false;
  for (const [theme, from] of Object.entries(THEMES)) {
    if (!from.some((t) => tags.includes(t))) continue;
    if (theme === 'fork' || theme === 'double-attack') {
      const queen = firstSolverPiece(fen, moves) === 'q';
      if ((theme === 'double-attack') !== queen) continue;
    }
    offer(theme, bucket, item);
    used = true;
  }
  if (used) kept++;
  if (lines % 500000 === 0) console.log(`${lines} puzzles read, ${kept} candidates`);
}
if (lines < 1000) throw new Error('No puzzle data received');

const out = join(root, 'public/puzzles');
mkdirSync(out, { recursive: true });
const index = {};
for (const theme of Object.keys(THEMES)) {
  const list = res[theme].flat().sort((a, b) => a[3] - b[3]);
  writeFileSync(join(out, `${theme}.json`), JSON.stringify(list));
  index[theme] = list.length;
}
const indexFile = join(out, 'index.json');
let previous = {};
try {
  previous = JSON.parse(readFileSync(indexFile, 'utf8')).counts ?? {};
} catch {
  /* first build */
}
writeFileSync(indexFile, JSON.stringify({ built: new Date().toISOString().slice(0, 10), counts: { ...previous, ...index } }));
console.log('done', lines, 'read', index);
