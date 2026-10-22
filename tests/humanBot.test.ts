import { describe, expect, it } from 'vitest';
import type { EngineLine } from '../src/engine/engine';
import { BOT_LEVELS, chooseCandidate, levelFor } from '../src/engine/humanBot';

const line = (uci: string, cp: number): EngineLine => ({ multipv: 1, depth: 5, score: { cp, mate: null }, pv: [uci] });
const lines = [line('e2e4', 50), line('d2d4', 40), line('a2a3', -20), line('g2g4', -400), line('f2f3', -900)];

describe('human-like bot', () => {
  it('picks the best move when the dice say so', () => {
    expect(chooseCandidate(lines, true, levelFor(1600), false, () => 0).pv[0]).toBe('e2e4');
  });

  it('never picks a move worse than its limit unless it is "blind"', () => {
    const lvl = levelFor(1200);
    for (let r = 0; r < 1; r += 0.01) {
      const m = chooseCandidate(lines, true, lvl, false, () => r).pv[0];
      expect(['g2g4', 'f2f3']).not.toContain(m);
    }
  });

  it('weaker bots spread their choices more', () => {
    const spread = (rating: number) => {
      const seen = new Set<string>();
      for (let r = 0; r < 1; r += 0.01) seen.add(chooseCandidate(lines, true, levelFor(rating), false, () => r).pv[0]);
      return seen.size;
    };
    expect(spread(600)).toBeGreaterThan(spread(1600));
  });

  it('reads scores from Black’s point of view when Black moves', () => {
    expect(chooseCandidate(lines, false, levelFor(1600), false, () => 0).pv[0]).toBe('f2f3');
  });

  it('has the six promised levels', () => {
    expect(BOT_LEVELS.map((l) => l.rating)).toEqual([600, 800, 1000, 1200, 1400, 1600]);
  });
});
