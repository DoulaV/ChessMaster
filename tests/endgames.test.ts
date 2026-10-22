import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { ENDGAMES, SQUARE_QUIZ, randomStart } from '../src/data/endgames';

// Engine checks (wins are clearly winning, holds are draws, quiz answers match)
// were run with Stockfish when the content was written; these are the cheap
// checks that keep the data valid.

/** The side that is NOT to move must not be in check. */
function sideNotToMoveInCheck(fen: string): boolean {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  try {
    return new Chess(parts.join(' ')).isCheck();
  } catch {
    return true;
  }
}

describe('endgames', () => {
  it('has the seven endgames', () => {
    expect(ENDGAMES.map((e) => e.id)).toEqual(['kqk', 'krk', 'king-6th', 'opposition', 'square-rule', 'lucena', 'philidor']);
  });

  for (const g of ENDGAMES) {
    it(`${g.title}: legal start positions with the student to move`, () => {
      expect(g.positions.length).toBeGreaterThanOrEqual(3);
      expect(g.points.length).toBeGreaterThanOrEqual(4);
      const groups = [{ positions: g.positions, color: g.studentColor }];
      if (g.defense) groups.push({ positions: g.defense.positions, color: g.defense.studentColor });
      for (const { positions, color } of groups) {
        for (const fen of positions) {
          const c = new Chess(fen);
          expect(c.turn(), fen).toBe(color);
          expect(c.isGameOver(), fen).toBe(false);
          expect(sideNotToMoveInCheck(fen), fen).toBe(false);
        }
      }
    });

    if (g.demo) {
      it(`${g.title}: demo moves are legal and comments point at real moves`, () => {
        const c = new Chess(g.demo!.fen);
        for (const m of g.demo!.moves) expect(() => c.move(m), m).not.toThrow();
        for (const k of Object.keys(g.demo!.comments)) expect(Number(k)).toBeLessThan(g.demo!.moves.length);
      });
    }
  }

  it('square quiz: 8 legal positions with the side to move named in the question', () => {
    expect(SQUARE_QUIZ).toHaveLength(8);
    for (const q of SQUARE_QUIZ) {
      const c = new Chess(q.fen);
      expect(q.question).toMatch(c.turn() === 'w' ? /White to move/ : /Black to move/);
      expect(sideNotToMoveInCheck(q.fen)).toBe(false);
    }
  });

  it('random checkmate starts are always valid', () => {
    for (const id of ['kqk', 'krk'] as const) {
      for (let i = 0; i < 200; i++) {
        const fen = randomStart(id);
        const c = new Chess(fen);
        expect(c.turn()).toBe('w');
        expect(c.isGameOver()).toBe(false);
        expect(sideNotToMoveInCheck(fen), fen).toBe(false);
        const pieces = c.board().flat().filter(Boolean).map((p) => p!.color + p!.type).sort();
        expect(pieces).toEqual(['bk', 'wk', id === 'kqk' ? 'wq' : 'wr'].sort());
      }
    }
  });

  it('contains no em dash anywhere', () => {
    expect(JSON.stringify({ ENDGAMES, SQUARE_QUIZ })).not.toContain('—');
  });
});
