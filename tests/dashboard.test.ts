import { describe, expect, it } from 'vitest';
import { blunderSlot } from '../src/progress/blunder';
import { botResults, currentStage, mistakeCounts, roadmap, streak, todaysPlan, type DashboardInput } from '../src/progress/dashboard';
import { planningSlot } from '../src/progress/planning';
import type { PracticeGame } from '../src/progress/practice';
import { tacticsSlot } from '../src/progress/tactics';

const base = (): DashboardInput => ({
  rating: 800,
  openings: {},
  path: [],
  blunder: blunderSlot.initial(),
  tactics: tacticsSlot.initial(),
  planning: planningSlot.initial(),
  practice: [],
  reviews: {},
  endgames: { byId: {}, days: {} },
  today: '2026-10-22',
});

const game = (over: Partial<PracticeGame>): PracticeGame => ({
  id: Math.random().toString(), endedAt: '2026-10-22T12:00:00.000Z', botRating: 800, color: 'white', coach: 'none', result: 'win', reason: 'checkmate',
  accuracy: 80, blunders: 0, mistakes: 0, takebacks: 0, hints: 0, tags: [], pgn: '', ...over,
});

describe('dashboard', () => {
  it('counts the streak back from today, or from yesterday if today is empty', () => {
    const d = base();
    d.tactics.days = { '2026-10-20': { done: 1, right: 1 }, '2026-10-21': { done: 1, right: 1 } };
    expect(streak(d)).toBe(2);
    d.blunder.days = { '2026-10-22': { spot: 1, safe: 0, hanging: 0 } };
    expect(streak(d)).toBe(3);
    d.tactics.days = { '2026-10-19': { done: 1, right: 1 } };
    expect(streak(d)).toBe(1);
  });

  it('ticks off today’s plan items', () => {
    const d = base();
    d.tactics.days = { '2026-10-22': { done: 15, right: 10 } };
    d.openings = { italian: { drillDays: { '2026-10-22': 0.8 }, learnedLines: [] } };
    const plan = todaysPlan(d, 'italian');
    expect(plan.find((p) => p.id === 'puzzles')!.done).toBe(true);
    expect(plan.find((p) => p.id === 'opening')!.done).toBe(true);
    expect(plan.find((p) => p.id === 'blunder')!.done).toBe(false);
  });

  it('builds a 4-stage roadmap and picks the stage from the rating', () => {
    const d = base();
    const stages = roadmap(d);
    expect(stages.map((s) => s.range)).toEqual([[800, 1000], [1000, 1200], [1200, 1400], [1400, 1500]]);
    expect(currentStage(stages, 800).id).toBe('stage-1');
    expect(currentStage(stages, 1250).id).toBe('stage-3');
    expect(currentStage(stages, 1600).id).toBe('stage-4');
    expect(stages[0].items.every((i) => !i.done)).toBe(true);
  });

  it('marks openings and checkmates done when mastered', () => {
    const d = base();
    const m = { drillDays: { a: 1, b: 1, c: 1 }, learnedLines: [] };
    d.openings = { italian: m, 'e5-black': m, qgd: m };
    d.endgames.byId = { kqk: { attempts: 3, wins: 3, streak: 3, mastered: true }, krk: { attempts: 3, wins: 3, streak: 3, mastered: true } };
    const s1 = roadmap(d)[0];
    expect(s1.items.find((i) => i.label.startsWith('First 3'))!.done).toBe(true);
    expect(s1.items.find((i) => i.label.startsWith('Basic checkmates'))!.done).toBe(true);
  });

  it('summarises bot results and mistake types', () => {
    const d = base();
    d.practice = [game({ result: 'win', tags: ['hung-piece'] }), game({ result: 'loss', tags: ['hung-piece', 'allowed-fork'] }), game({ botRating: 1000, result: 'loss' })];
    expect(botResults(d)).toEqual([
      { rating: 800, wins: 1, total: 2, rate: 0.5 },
      { rating: 1000, wins: 0, total: 1, rate: 0 },
    ]);
    expect(mistakeCounts(d)[0]).toMatchObject({ tag: 'hung-piece', count: 2 });
  });
});
