// Builds the Blunder Check exercise bank (src/data/blunder.json), checking
// every exercise with Stockfish. Skipped in normal test runs.
// Run with: npm run gen:blunder

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Chess } from 'chess.js';
import { it } from 'vitest';
import { explainMove } from '../src/chess/explain';
import { flipTurn, pvToSan } from '../src/chess/utils';
import { Engine, scoreToCp, type UciTransport } from '../src/engine/engine';
import { makeHangingQuestion, makeSafeCandidate, makeThreatQuestion } from '../src/modules/blunder/generate';
import type { BlunderBank } from '../src/modules/blunder/bank';

const require = createRequire(import.meta.url);
function nodeEngine(): Engine {
  let cb: (l: string) => void = () => {};
  const sf = require('stockfish')('lite-single', (l: string) => cb(l));
  const t: UciTransport = { send: (c) => sf.processCommand(c), onLine: (f) => (cb = f), terminate: () => sf.terminate() };
  return new Engine(t);
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * Drop detector sentences that blame a different capture than the engine's
 * real answer, and fall back to a plain, always-true sentence.
 */
function honestText(text: string[], verdict: string, reply: string, loss: number): string[] {
  if (verdict !== 'blunder') return text;
  const plain = (s: string) => s.replace(/[+#]/g, '');
  const keep = text.filter((t) => {
    const m = t.match(/,? and (\S+) wins (it|material)|: (\S+) wins (it|material)|This allows a fork: (\S+) attacks|still not safe: (\S+) wins it/);
    const san = m && (m[1] || m[3] || m[5] || m[6]);
    return !san || plain(san) === plain(reply);
  });
  if (!keep.some((t) => !t.startsWith('Better was'))) {
    keep.unshift(`This gives away about ${(loss / 100).toFixed(1)} pawns compared with the best move. Your opponent’s best answer is ${reply} (red arrow).`);
  }
  return keep;
}

const N_THREAT = 300;
const N_SAFE = 300;
const N_HANG = 250;

it.skipIf(!process.env.GEN)('build blunder bank', async () => {
  const engine = nodeEngine();
  const rng = seeded(20261022);
  /** Best score for the side to move, in centipawns. */
  const best = async (fen: string, depth: number) => {
    const l = await engine.analyse(fen, { depth });
    if (!l[0]) return { cp: 0, uci: '' };
    const cp = scoreToCp(l[0].score);
    return { cp: fen.split(' ')[1] === 'w' ? cp : -cp, uci: l[0].pv[0], score: l[0].score };
  };

  const bank: BlunderBank = { threats: [], safe: [], hanging: [] };
  const seen = new Set<string>();

  // Spot the threat: real only if "passing" would let the opponent win 2+ pawns more.
  let tries = 0;
  while (bank.threats.length < N_THREAT && tries++ < N_THREAT * 6) {
    const q = makeThreatQuestion(rng);
    if (!q || seen.has(q.fen)) continue;
    const flipped = flipTurn(q.fen);
    if (!flipped) continue;
    const real = await best(q.fen, 11); // student to move, best defence
    const pass = await best(flipped, 11); // opponent to move again
    const gain = pass.cp + real.cp; // both from the mover's view: opp gain if student passes
    if (gain < 200 || Math.abs(real.cp) > 400) continue;
    seen.add(q.fen);
    bank.threats.push({
      fen: q.fen,
      move: [q.move.from, q.move.to, q.move.san],
      answers: q.answers,
      threats: q.threats.map((t) => [t.from, t.to, t.san]),
      text: q.explanation,
    });
  }

  // Is it safe? Engine verdict: safe = loses at most 0.6, blunder = loses 2+ pawns.
  tries = 0;
  while (bank.safe.length < N_SAFE && tries++ < N_SAFE * 6) {
    const q = makeSafeCandidate(rng);
    if (!q || seen.has(q.fen + q.uci)) continue;
    const before = await best(q.fen, 13);
    if (Math.abs(before.cp) > 400) continue;
    const c = new Chess(q.fen);
    c.move(q.san);
    if (c.isGameOver()) continue;
    const afterBest = await best(c.fen(), 12);
    const after = -afterBest.cp; // student's view
    const loss = before.cp - after;
    const verdict = loss <= 60 ? 'safe' : loss >= 200 ? 'blunder' : null;
    if (!verdict) continue;
    seen.add(q.fen + q.uci);
    const ex = explainMove({
      fenBefore: q.fen,
      uci: q.uci,
      bestBefore: { score: { cp: q.student === 'w' ? before.cp : -before.cp, mate: null }, uci: before.uci },
      after: { score: { cp: q.student === 'w' ? after : -after, mate: null }, replyUci: afterBest.uci },
    });
    const reply = (afterBest.uci ? pvToSan(c.fen(), [afterBest.uci])[0] : '') ?? '';
    bank.safe.push({
      fen: q.fen,
      uci: q.uci,
      san: q.san,
      verdict,
      loss: Math.round(loss),
      best: pvToSan(q.fen, [before.uci])[0] ?? '',
      reply: reply ?? '',
      text: honestText(ex.sentences.filter((s) => !s.startsWith('The evaluation went')), verdict, reply, loss),
    });
  }

  tries = 0;
  while (bank.hanging.length < N_HANG && tries++ < N_HANG * 4) {
    const q = makeHangingQuestion(rng);
    if (!q || seen.has('h' + q.fen)) continue;
    seen.add('h' + q.fen);
    bank.hanging.push({ fen: q.fen, answers: q.answers });
  }

  engine.terminate();
  writeFileSync('src/data/blunder.json', JSON.stringify(bank));
  console.log(
    `threats ${bank.threats.length}, safe ${bank.safe.length} (${bank.safe.filter((s) => s.verdict === 'blunder').length} blunders), hanging ${bank.hanging.length}`,
  );
}, 3_600_000);
