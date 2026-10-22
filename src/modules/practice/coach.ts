// The coach in Practice Mode: warns about bad moves and gives hints.

import { Chess, type Color } from 'chess.js';
import { hangingPieces, mateInOneThreats } from '../../chess/detectors';
import { explainMove, moveIdeas, moveProblems } from '../../chess/explain';
import { other, parseUci } from '../../chess/utils';
import { scoreToCp, type Engine } from '../../engine/engine';
import type { CoachLevel } from '../../progress/practice';

export interface MoveCheck {
  warn: boolean;
  /** Centipawns the move gave away compared with the best move. */
  loss: number;
  sentences: string[];
  bestUci: string;
}

/** Score for the side to move (centipawns, mate = huge). */
async function score(engine: Engine, fen: string, depth: number) {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: -100000, pv: [] as string[] };
  if (c.isGameOver()) return { cp: 0, pv: [] as string[] };
  const l = (await engine.analyse(fen, { depth, multipv: 1 }))[0];
  if (!l) return { cp: 0, pv: [] as string[] };
  const cp = scoreToCp(l.score);
  return { cp: c.turn() === 'w' ? cp : -cp, pv: l.pv };
}

/**
 * Should the coach warn about this move?
 * Full coach: any move that loses about 1.5 pawns or more, or that a detector sees hanging material.
 * Light coach: only big blunders (2+ pawns of material, or allowing mate).
 */
export async function checkMove(engine: Engine, fenBefore: string, uci: string, level: CoachLevel): Promise<MoveCheck> {
  if (level === 'none') return { warn: false, loss: 0, sentences: [], bestUci: '' };
  const c = new Chess(fenBefore);
  const mover = c.turn();
  c.move(parseUci(uci));
  if (c.isCheckmate()) return { warn: false, loss: 0, sentences: [], bestUci: uci };
  const before = await score(engine, fenBefore, 11);
  const after = await score(engine, c.fen(), 11);
  const afterMover = -after.cp;
  const loss = Math.max(0, before.cp - afterMover);
  const problems = moveProblems(fenBefore, uci);
  const allowsMate = after.cp > 50000 || problems.some((p) => p.includes('checkmate'));
  const warn =
    level === 'full'
      ? loss >= 150 || (problems.length > 0 && loss >= 80)
      : allowsMate || (loss >= 200 && before.cp < 600);
  if (!warn) return { warn: false, loss, sentences: [], bestUci: before.pv[0] ?? '' };
  const toWhite = (cp: number) => (mover === 'w' ? cp : -cp);
  const ex = explainMove({
    fenBefore,
    uci,
    bestBefore: before.pv[0] ? { score: { cp: toWhite(before.cp), mate: null }, uci: before.pv[0] } : null,
    after: { score: { cp: toWhite(afterMover), mate: null }, replyUci: after.pv[0] },
  });
  return { warn, loss, sentences: ex.sentences.filter((s) => !s.startsWith('The evaluation')), bestUci: before.pv[0] ?? '' };
}

/** A hint in words, from the best move and the position. */
export function hintWords(fen: string, bestUci: string): string {
  const me: Color = new Chess(fen).turn();
  const ideas = moveIdeas(fen, bestUci).join(' ');
  if (/This is checkmate/.test(ideas)) return 'There is a checkmate in one! Look at every check.';
  if (mateInOneThreats(fen, other(me)).length) return 'Your opponent threatens checkmate. Find a way to stop it.';
  if (/Forks/.test(ideas)) return 'Look for a fork: one piece attacking two at once.';
  if (/Pins/.test(ideas)) return 'Look for a pin: line up a piece with something more valuable behind it.';
  if (/Wins material/.test(ideas)) return 'Something can be won: look for a piece that isn’t protected well enough.';
  if (/Threatens checkmate/.test(ideas)) return 'You can make a checkmate threat. Look at your opponent’s king.';
  if (hangingPieces(fen, me).length) return 'One of your pieces is in danger. Save it first.';
  if (/Captures/.test(ideas)) return 'Look at the captures available to you.';
  if (/Gives check/.test(ideas)) return 'Look at checks: one of them is strong here.';
  return 'No quick tactic here. Improve your worst piece, or follow the plan: develop, castle, control the center.';
}
