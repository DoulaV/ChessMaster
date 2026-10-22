import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { PLAN_EXERCISES, PLANNING_LESSONS } from '../src/data/planning/content';
import { CATALOG } from '../src/data/openings/catalog';

const square = /^[a-h][1-8]$/;

describe('planning content', () => {
  it('has the 7 lessons, each with rules and 2 legal examples', () => {
    expect(PLANNING_LESSONS.map((l) => l.id)).toEqual([
      'piece-activity', 'center', 'king-safety', 'weak-squares', 'open-files', 'pawn-breaks', 'trading',
    ]);
    for (const l of PLANNING_LESSONS) {
      expect(l.points.length).toBeGreaterThanOrEqual(4);
      expect(l.points.length).toBeLessThanOrEqual(6);
      expect(l.examples).toHaveLength(2);
      for (const ex of l.examples) {
        expect(() => new Chess(ex.fen), ex.title).not.toThrow();
        expect(ex.arrows.length).toBeGreaterThanOrEqual(1);
        expect(ex.arrows.length).toBeLessThanOrEqual(3);
        for (const [a, b] of ex.arrows) {
          expect(a).toMatch(square);
          expect(b).toMatch(square);
        }
        for (const h of ex.highlight ?? []) expect(h).toMatch(square);
      }
    }
  });

  it('has 30+ exercises over 15+ openings, both colors', () => {
    expect(PLAN_EXERCISES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(PLAN_EXERCISES.map((e) => e.openingId)).size).toBeGreaterThanOrEqual(15);
    expect(PLAN_EXERCISES.some((e) => e.orientation === 'white')).toBe(true);
    expect(PLAN_EXERCISES.some((e) => e.orientation === 'black')).toBe(true);
    expect(new Set(PLAN_EXERCISES.map((e) => e.id)).size).toBe(PLAN_EXERCISES.length);
  });

  it('every exercise is legal, from a real opening, with exactly one right answer', () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    for (const e of PLAN_EXERCISES) {
      const c = new Chess(e.fen);
      expect(c.turn(), e.id).toBe(e.orientation === 'white' ? 'w' : 'b');
      expect(ids.has(e.openingId), e.id).toBe(true);
      expect(e.options.length).toBeGreaterThanOrEqual(3);
      expect(e.options.length).toBeLessThanOrEqual(4);
      expect(e.options.filter((o) => o.correct)).toHaveLength(1);
      if (e.firstMove) expect(() => new Chess(e.fen).move(e.firstMove!), e.id).not.toThrow();
    }
  });

  it('contains no em dashes', () => {
    expect(JSON.stringify([PLANNING_LESSONS, PLAN_EXERCISES])).not.toContain('—');
  });
});
