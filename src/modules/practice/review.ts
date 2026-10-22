// After a game: evaluate every position with Stockfish, then work out
// accuracy, the biggest mistakes, and the moment the game turned.

import { Chess, type Color } from 'chess.js';
import { classify, explainMove, mistakeTag, moveAccuracy, type MistakeTag, type MoveQuality } from '../../chess/explain';
import { parseUci, pvToSan, winChance } from '../../chess/utils';
import { scoreToCp, type Engine, type Score } from '../../engine/engine';

export interface ReviewedMove {
  /** 1-based half-move number. */
  ply: number;
  san: string;
  uci: string;
  color: Color;
  fenBefore: string;
  fenAfter: string;
  /** White-view scores. */
  before: Score;
  after: Score;
  bestUci: string;
  bestSan: string;
  bestLine: string[];
  /** Win chance lost by the mover (0 to 1). */
  winLoss: number;
  quality: MoveQuality;
  accuracy: number;
}

export interface Mistake {
  move: ReviewedMove;
  sentences: string[];
  tag: MistakeTag;
}

export interface GameReview {
  moves: ReviewedMove[];
  accuracy: Record<Color, number | null>;
  counts: Record<Color, { inaccuracy: number; mistake: number; blunder: number }>;
  topMistakes: Mistake[];
  turningPoint: { move: ReviewedMove; text: string } | null;
  /** White-view win chance after each position (for a small graph). */
  winGraph: number[];
}

const MATE: Score = { cp: 100000, mate: 0 };

/** Evaluate a position; terminal positions are scored without the engine. */
async function evalPos(engine: Engine, fen: string, depth: number): Promise<{ score: Score; pv: string[] }> {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { score: c.turn() === 'w' ? { cp: -MATE.cp, mate: 0 } : MATE, pv: [] };
  if (c.isGameOver()) return { score: { cp: 0, mate: null }, pv: [] };
  const lines = await engine.analyse(fen, { depth, multipv: 1 });
  const l = lines[0];
  return l ? { score: { ...l.score, cp: scoreToCp(l.score) }, pv: l.pv } : { score: { cp: 0, mate: null }, pv: [] };
}

export async function reviewGame(
  engine: Engine,
  startFen: string,
  sans: string[],
  student: Color,
  onProgress?: (done: number, total: number) => void,
  depth = 11,
): Promise<GameReview> {
  const c = new Chess(startFen);
  const fens = [c.fen()];
  const ucis: string[] = [];
  for (const s of sans) {
    const m = c.move(s);
    ucis.push(m.lan);
    fens.push(c.fen());
  }
  const evals: { score: Score; pv: string[] }[] = [];
  for (let i = 0; i < fens.length; i++) {
    evals.push(await evalPos(engine, fens[i], depth));
    onProgress?.(i + 1, fens.length);
  }

  const startPly = (Number(startFen.split(' ')[5]) - 1) * 2 + (startFen.split(' ')[1] === 'b' ? 1 : 0);
  const moves: ReviewedMove[] = sans.map((san, i) => {
    const color: Color = fens[i].split(' ')[1] === 'w' ? 'w' : 'b';
    const sign = color === 'w' ? 1 : -1;
    const wb = winChance(evals[i].score.cp);
    const wa = winChance(evals[i + 1].score.cp);
    const moverBefore = color === 'w' ? wb : 1 - wb;
    const moverAfter = color === 'w' ? wa : 1 - wa;
    const winLoss = Math.max(0, sign * (wb - wa));
    const bestUci = evals[i].pv[0] ?? ucis[i];
    return {
      ply: startPly + i + 1,
      san,
      uci: ucis[i],
      color,
      fenBefore: fens[i],
      fenAfter: fens[i + 1],
      before: evals[i].score,
      after: evals[i + 1].score,
      bestUci,
      bestSan: pvToSan(fens[i], [bestUci])[0] ?? '',
      bestLine: evals[i].pv.slice(0, 6),
      winLoss,
      quality: classify(winLoss, bestUci === ucis[i]),
      accuracy: moveAccuracy(moverBefore, moverAfter),
    };
  });

  const accuracy = { w: null, b: null } as Record<Color, number | null>;
  const counts = { w: { inaccuracy: 0, mistake: 0, blunder: 0 }, b: { inaccuracy: 0, mistake: 0, blunder: 0 } };
  for (const col of ['w', 'b'] as Color[]) {
    const mine = moves.filter((m) => m.color === col);
    if (mine.length) accuracy[col] = Math.round(mine.reduce((s, m) => s + m.accuracy, 0) / mine.length);
    for (const m of mine) if (m.quality in counts[col]) counts[col][m.quality as 'mistake']++;
  }

  const topMistakes: Mistake[] = moves
    .filter((m) => m.color === student && (m.quality === 'mistake' || m.quality === 'blunder' || m.quality === 'inaccuracy'))
    .sort((a, b) => b.winLoss - a.winLoss)
    .slice(0, 3)
    .map((m) => {
      const ex = explainMove({
        fenBefore: m.fenBefore,
        uci: m.uci,
        bestBefore: { score: m.before, uci: m.bestUci },
        after: { score: m.after, replyUci: evalsAfterReply(evals, moves.indexOf(m)) },
      });
      return { move: m, sentences: ex.sentences, tag: mistakeTag(m.fenBefore, m.uci, m.bestUci) };
    });

  // The turning point: the single biggest swing in winning chances.
  let turningPoint: GameReview['turningPoint'] = null;
  const swing = moves.reduce<ReviewedMove | null>((best, m) => (!best || m.winLoss > best.winLoss ? m : best), null);
  if (swing && swing.winLoss >= 0.15) {
    const who = swing.color === student ? 'your' : 'the bot’s';
    const label = `${Math.ceil(swing.ply / 2)}${swing.color === 'w' ? '.' : '...'} ${swing.san}`;
    const pctBefore = Math.round((swing.color === 'w' ? winChance(swing.before.cp) : 1 - winChance(swing.before.cp)) * 100);
    const pctAfter = Math.round((swing.color === 'w' ? winChance(swing.after.cp) : 1 - winChance(swing.after.cp)) * 100);
    turningPoint = {
      move: swing,
      text: `The game turned on ${who} move ${label}: ${swing.color === student ? 'your' : 'its'} winning chances fell from ${pctBefore}% to ${pctAfter}%. ${swing.bestSan ? `${swing.bestSan} was better.` : ''}`,
    };
  }

  return { moves, accuracy, counts, topMistakes, turningPoint, winGraph: evals.map((e) => winChance(e.score.cp)) };
}

function evalsAfterReply(evals: { pv: string[] }[], i: number): string | undefined {
  return evals[i + 1]?.pv[0];
}

/** Turn the student's mistakes into personal puzzles (position before the mistake, best move as the answer). */
export function puzzlesFrom(review: GameReview, student: Color, sourceLabel: string) {
  return review.moves
    .filter((m) => m.color === student && (m.quality === 'mistake' || m.quality === 'blunder') && m.bestUci)
    .map((m) => ({
      fen: m.fenBefore,
      solution: m.bestUci,
      line: m.bestLine,
      played: m.san,
      tag: mistakeTag(m.fenBefore, m.uci, m.bestUci),
      source: 'practice' as const,
      sourceLabel,
    }));
}

/** For a "turning point" or mistake: the move as a {from,to} for arrows. */
export const squaresOf = (uci: string) => {
  const p = parseUci(uci);
  return { from: p.from, to: p.to };
};
