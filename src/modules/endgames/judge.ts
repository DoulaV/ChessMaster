// Did an endgame exercise end, and was it a success?

import type { Chess, Color } from 'chess.js';
import type { Endgame } from '../../data/endgames';

export type Outcome = { ok: boolean; text: string } | null;

/** Has `color` got a queen on the board? */
const hasQueen = (c: Chess, color: Color) => c.board().flat().some((p) => p && p.type === 'q' && p.color === color);
export const pawnCount = (c: Chess, color: Color) => c.board().flat().filter((p) => p && p.type === 'p' && p.color === color).length;

/**
 * Did the exercise end? Checked after every move.
 * mate: you must checkmate. promote: you must make a queen that survives.
 * hold: you must not get mated or let the other side keep a new queen.
 */
export function judge(c: Chess, goal: Endgame['goal'], student: Color, studentMoves: number, maxMoves: number, startPawns: number): Outcome {
  const opp: Color = student === 'w' ? 'b' : 'w';
  if (c.isCheckmate()) return c.turn() === opp ? { ok: true, text: 'Checkmate! You did it.' } : { ok: false, text: 'You were checkmated.' };
  if (goal === 'hold') {
    if (hasQueen(c, opp) && !hasQueen(c, student) && c.turn() === student) {
      // Only a loss if the new queen can't be taken right away.
      const canTake = c.moves({ verbose: true }).some((m) => m.captured === 'q');
      if (!canTake) return { ok: false, text: 'Your opponent made a queen. Try again: keep your king in front of the pawn.' };
    }
    if (c.isDraw() || c.isStalemate()) return { ok: true, text: 'Draw! You held the position.' };
    if (studentMoves >= maxMoves) return { ok: true, text: `You held for ${maxMoves} moves. That’s a draw.` };
    return null;
  }
  if (c.isStalemate()) return { ok: false, text: 'Stalemate: the king had no moves but wasn’t in check. That’s a draw. Leave it a square!' };
  if (c.isDraw()) return { ok: false, text: 'The game ended in a draw.' };
  if (goal === 'promote') {
    if (hasQueen(c, student) && c.turn() === student) return { ok: true, text: 'You made a queen and kept it. That wins!' };
    if (startPawns > 0 && pawnCount(c, student) === 0 && !hasQueen(c, student)) return { ok: false, text: 'Your pawn was captured. Try again.' };
  }
  if (studentMoves >= maxMoves) return { ok: false, text: `Out of moves: you have ${maxMoves} moves for this one. Try again, a bit more directly.` };
  return null;
}

