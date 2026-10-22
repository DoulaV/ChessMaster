import { existsSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { pickNear, type LichessPuzzle, type RawPuzzle } from '../src/modules/tactics/puzzles';
import { THEMES, newRating, startRating, weakestThemes, tacticsSlot } from '../src/progress/tactics';

const p = (id: string, rating: number, opening = ''): LichessPuzzle => ({ kind: 'lichess', id, fen: '', moves: [], rating, theme: 'fork', opening });

describe('puzzle rating', () => {
  it('goes up when you solve, down when you fail, more for surprises', () => {
    expect(newRating(1000, 1000, true, 100)).toBe(1010);
    expect(newRating(1000, 1000, false, 100)).toBe(990);
    expect(newRating(1000, 1400, true, 100) - 1000).toBeGreaterThan(newRating(1000, 800, true, 100) - 1000);
    expect(newRating(1000, 1000, true, 0)).toBe(1020); // faster at the start
  });

  it('starts near the Chess.com rating', () => {
    expect(startRating(800)).toBe(900);
  });

  it('puts unplayed and weak themes first', () => {
    const s = { ...tacticsSlot.initial(), byTheme: { fork: { right: 9, total: 10 }, pin: { right: 1, total: 10 } } };
    const order = weakestThemes(s);
    expect(order[0]).toBe('pin');
    expect(order[order.length - 1]).toBe('fork');
  });
});

describe('picking puzzles', () => {
  const list = Array.from({ length: 200 }, (_, i) => p(`p${i}`, 800 + i * 4, i % 2 ? 'italian' : 'sicilian'));

  it('picks puzzles close to your rating and skips recent ones', () => {
    const got = pickNear(list, 1000, 10, new Set(['p50']));
    expect(got).toHaveLength(10);
    for (const x of got) expect(Math.abs(x.rating - 1000)).toBeLessThanOrEqual(100);
    expect(got.some((x) => x.id === 'p50')).toBe(false);
  });

  it('can limit to studied openings', () => {
    const got = pickNear(list, 1000, 5, new Set(), new Set(['italian']));
    expect(got.every((x) => x.opening === 'italian')).toBe(true);
  });
});

describe('puzzle files', () => {
  const dir = 'public/puzzles';
  for (const t of THEMES) {
    it.skipIf(!existsSync(`${dir}/${t.id}.json`) || readFileSync(`${dir}/${t.id}.json`, 'utf8').length < 100)(`${t.name}: enough legal puzzles rated 800 to 1600`, () => {
      const rows = JSON.parse(readFileSync(`${dir}/${t.id}.json`, 'utf8')) as RawPuzzle[];
      expect(rows.length).toBeGreaterThan(500);
      // Check a sample thoroughly: every move is legal and the rating is in range.
      for (const [id, fen, moves, rating] of rows.filter((_, i) => i % 25 === 0)) {
        expect(rating, id).toBeGreaterThanOrEqual(800);
        expect(rating, id).toBeLessThan(1600);
        const c = new Chess(fen);
        for (const u of moves.split(' ')) expect(() => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }), id).not.toThrow();
        if (t.id === 'mate-in-1' || t.id === 'mate-in-2' || t.id === 'back-rank-mate') expect(c.isCheckmate(), id).toBe(true);
      }
    });
  }
});
