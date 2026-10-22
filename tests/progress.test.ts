import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PATH } from '../src/data/openings/catalog';
import {
  dueCards,
  gradeCard,
  isMastered,
  openingProgressSlot,
  orderedPath,
  pathStatus,
  progressOf,
  recordDrill,
} from '../src/progress/openings';
import { addDays, newCard, review } from '../src/progress/srs';
import { memoryBackend, read, setBackend } from '../src/progress/store';

beforeEach(() => setBackend(memoryBackend()));

describe('SM-2', () => {
  it('grows the gap on success and resets on failure', () => {
    let c = newCard('2026-01-01');
    c = review(c, 5, '2026-01-01');
    expect(c.due).toBe('2026-01-02');
    c = review(c, 5, '2026-01-02');
    expect(c.due).toBe('2026-01-08');
    c = review(c, 5, '2026-01-08');
    expect(c.interval).toBeGreaterThan(6);
    const failed = review(c, 1, '2026-02-01');
    expect(failed).toMatchObject({ reps: 0, interval: 1, due: '2026-02-02', lapses: 1 });
    expect(failed.ef).toBeLessThan(c.ef);
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('lists due cards', () => {
    gradeCard('italian', 'e4', 1, '2026-01-01');
    gradeCard('italian', 'e4 e5 Nf3', 5, '2026-01-01');
    expect(dueCards('2026-01-02')).toEqual(['italian|e4', 'italian|e4 e5 Nf3']);
    expect(dueCards('2026-01-01')).toEqual([]);
  });
});

describe('mastery', () => {
  it('needs 90%+ on 3 different days', () => {
    recordDrill('italian', 0.95, '2026-01-01');
    recordDrill('italian', 0.99, '2026-01-01');
    recordDrill('italian', 0.8, '2026-01-02');
    expect(isMastered(progressOf(read(openingProgressSlot), 'italian'))).toBe(false);
    recordDrill('italian', 0.9, '2026-01-03');
    expect(isMastered(progressOf(read(openingProgressSlot), 'italian'))).toBe(false);
    recordDrill('italian', 0.92, '2026-01-05');
    const p = progressOf(read(openingProgressSlot), 'italian');
    expect(isMastered(p)).toBe(true);
    expect(p.masteredOn).toBe('2026-01-05');
  });

  it('unlocks the next step only after the current one is mastered', () => {
    const order = DEFAULT_PATH.map((s) => s.id);
    let st = pathStatus(order, {});
    expect(st.status.italian).toBe('current');
    expect(st.status['e5-black']).toBe('locked');
    const mastered = { drillDays: { a: 1, b: 1, c: 1 }, learnedLines: [] };
    st = pathStatus(order, { italian: mastered });
    expect(st.status.italian).toBe('mastered');
    expect(st.status['e5-black']).toBe('current');
    expect(st.status.qgd).toBe('locked');
  });

  it('unlocks the bonus QGA after the QGD is mastered', () => {
    const order = DEFAULT_PATH.map((s) => s.id);
    const m = { drillDays: { a: 1, b: 1, c: 1 }, learnedLines: [] };
    expect(pathStatus(order, {}).status.qga).not.toBe('current');
    expect(pathStatus(order, { italian: m, 'e5-black': m, qgd: m }).status.qga).not.toBe('locked');
  });

  it('respects a custom order and repairs unknown ids', () => {
    const order = ['s3', 's1', 'nope'];
    const steps = orderedPath(order);
    expect(steps[0].id).toBe('s3');
    expect(steps).toHaveLength(15);
    expect(pathStatus(order, {}).status.qgd).toBe('current');
  });
});
