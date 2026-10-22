// A bot that plays like a human at a given rating, not like a weakened engine.
//
// 1. Stockfish looks at several candidate moves at a shallow depth (shallow
//    searches miss deeper tactics, which is how people miss them too).
// 2. Sometimes the bot "doesn't notice" danger and only looks 1 move deep.
// 3. It picks among the candidates with a weighted random choice: better
//    moves are likelier, weaker bots choose more loosely.
// 4. Common-sense rules: it takes back pieces and takes a mate when it sees one.

import { Chess } from 'chess.js';
import { scoreToCp, type Engine, type EngineLine } from './engine';
import { parseUci } from '../chess/utils';

export interface BotLevel {
  rating: number;
  depth: number;
  candidates: number;
  /** Chance (0 to 1) of thinking only one move deep, missing threats. */
  blindness: number;
  /** How loosely it picks (centipawns). Higher = more random. */
  looseness: number;
  /** Never chooses a move this much worse than the best (centipawns), unless "blind". */
  maxLoss: number;
}

export const BOT_LEVELS: BotLevel[] = [
  { rating: 600, depth: 2, candidates: 8, blindness: 0.35, looseness: 140, maxLoss: 900 },
  { rating: 800, depth: 3, candidates: 8, blindness: 0.25, looseness: 100, maxLoss: 600 },
  { rating: 1000, depth: 4, candidates: 6, blindness: 0.15, looseness: 65, maxLoss: 350 },
  { rating: 1200, depth: 6, candidates: 6, blindness: 0.09, looseness: 40, maxLoss: 200 },
  { rating: 1400, depth: 8, candidates: 5, blindness: 0.05, looseness: 25, maxLoss: 120 },
  { rating: 1600, depth: 10, candidates: 4, blindness: 0.03, looseness: 15, maxLoss: 80 },
];

export function levelFor(rating: number): BotLevel {
  return BOT_LEVELS.reduce((a, b) => (Math.abs(b.rating - rating) < Math.abs(a.rating - rating) ? b : a));
}

/** Score of a line from the moving side's point of view. */
function moverCp(line: EngineLine, whiteToMove: boolean): number {
  const cp = scoreToCp(line.score);
  return whiteToMove ? cp : -cp;
}

/** Weighted random choice; exported for tests with a fixed random source. */
export function chooseCandidate(
  lines: EngineLine[],
  whiteToMove: boolean,
  level: BotLevel,
  blind: boolean,
  random: () => number = Math.random,
): EngineLine {
  const scored = lines.map((l) => ({ l, cp: moverCp(l, whiteToMove) }));
  const best = Math.max(...scored.map((s) => s.cp));
  const pool = scored.filter((s) => blind || best - s.cp <= level.maxLoss);
  const weights = pool.map((s) => Math.exp(-(best - Math.min(s.cp, best)) / level.looseness));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].l;
  }
  return pool[0].l;
}

export interface BotMove {
  uci: string;
  /** For debugging and coaching: was this a "didn't see it" move? */
  blind: boolean;
}

/**
 * Pick the bot's move. `recaptureSquare` is where the opponent just captured
 * (if their last move was a capture), for the "always take back" rule.
 */
export async function botMove(
  engine: Engine,
  fen: string,
  level: BotLevel,
  recaptureSquare?: string | null,
  random: () => number = Math.random,
): Promise<BotMove | null> {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  if (legal.length === 1) return { uci: legal[0].lan, blind: false };
  const whiteToMove = chess.turn() === 'w';

  // Take a mate in one when there is one (weak bots miss it sometimes).
  const mate = legal.find((m) => {
    chess.move(m);
    const r = chess.isCheckmate();
    chess.undo();
    return r;
  });
  if (mate && random() > level.blindness / 2) return { uci: mate.lan, blind: false };

  const blind = random() < level.blindness;
  const lines = await engine.analyse(fen, {
    depth: blind ? 1 : level.depth,
    multipv: level.candidates,
  });
  if (!lines.length) {
    const m = legal[Math.floor(random() * legal.length)];
    return { uci: m.lan, blind };
  }

  // People almost always take back a piece that was just captured.
  if (recaptureSquare) {
    const best = moverCp(lines[0], whiteToMove);
    const recapture = lines.find(
      (l) => parseUci(l.pv[0]).to === recaptureSquare && best - moverCp(l, whiteToMove) < 150,
    );
    if (recapture && random() < 0.85) return { uci: recapture.pv[0], blind };
  }

  return { uci: chooseCandidate(lines, whiteToMove, level, blind, random).pv[0], blind };
}

/** A short, human-feeling pause before the bot moves (ms). */
export function thinkTime(fen: string): number {
  const c = new Chess(fen);
  const n = c.moves().length;
  return 400 + Math.min(1400, n * 25) + Math.random() * 500;
}
