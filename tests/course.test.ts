import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ExerciseSource } from '../src/data/course/types';
import { LESSONS_IN_ORDER, UNITS } from '../src/data/course/units';
import {
  GUIDED_COUNT,
  addCoachNote,
  addToReview,
  canTestOut,
  courseSlot,
  currentLesson,
  dueReview,
  emptyLesson,
  gradeReview,
  isComplete,
  isUnlocked,
  lessonsForTags,
  nextStep,
  setLesson,
} from '../src/progress/course';
import { memoryBackend, read, setBackend, update } from '../src/progress/store';

beforeEach(() => setBackend(memoryBackend()));

const first = LESSONS_IN_ORDER[0].id;
const second = LESSONS_IN_ORDER[1].id;
const third = LESSONS_IN_ORDER[2].id;

function themesOf(src: ExerciseSource): string[] {
  if (src.kind === 'puzzles') return src.themes;
  if (src.kind === 'mixed') return src.parts.flatMap(themesOf);
  return [];
}

describe('course data', () => {
  it('has unique lesson ids, in unit order', () => {
    const ids = LESSONS_IN_ORDER.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LESSONS_IN_ORDER.length).toBeGreaterThanOrEqual(11);
    for (const u of UNITS) for (const l of u.lessons) expect(l.unit).toBe(u.id);
  });

  it('every lesson is complete and uses no em dashes', () => {
    for (const l of LESSONS_IN_ORDER) {
      expect(l.concept.length, l.id).toBeGreaterThan(0);
      expect(l.rules.length, l.id).toBeGreaterThan(0);
      expect(l.coachQuestions.length, l.id).toBeGreaterThan(0);
      expect(l.gameFocus && l.homework, l.id).toBeTruthy();
      expect(JSON.stringify(l), l.id).not.toContain('—');
    }
  });

  it('every puzzle theme has a puzzle file', () => {
    for (const l of LESSONS_IN_ORDER) for (const t of themesOf(l.exercises)) expect(existsSync(`public/puzzles/${t}.json`), `${l.id} ${t}`).toBe(true);
  });
});

describe('strict progression', () => {
  it('only the first lesson is open at the start', () => {
    const s = read(courseSlot);
    expect(isUnlocked(s, first)).toBe(true);
    expect(isUnlocked(s, second)).toBe(false);
    expect(currentLesson(s)?.id).toBe(first);
  });

  it('walks learn, guided, test, game, done', () => {
    expect(nextStep(read(courseSlot), first)).toBe('learn');
    setLesson(first, (p) => ({ ...p, learned: true }));
    expect(nextStep(read(courseSlot), first)).toBe('guided');
    setLesson(first, (p) => ({ ...p, guided: GUIDED_COUNT }));
    expect(nextStep(read(courseSlot), first)).toBe('test');
    setLesson(first, (p) => ({ ...p, testBest: 0.9, passed: true }));
    expect(nextStep(read(courseSlot), first)).toBe('game');
    expect(isUnlocked(read(courseSlot), second)).toBe(false);
    setLesson(first, (p) => ({ ...p, gamePlayed: true }), 'game');
    const s = read(courseSlot);
    expect(nextStep(s, first)).toBe('done');
    expect(s.lessons[first].completedOn).toBeTruthy();
    expect(isUnlocked(s, second)).toBe(true);
    expect(isUnlocked(s, third)).toBe(false);
    expect(currentLesson(s)?.id).toBe(second);
  });

  it('a passed test without learning only counts when tested out', () => {
    expect(isComplete({ ...emptyLesson(), passed: true })).toBe(false);
    expect(isComplete({ ...emptyLesson(), passed: true, testedOut: true })).toBe(true);
  });

  it('allows testing out only with a strong placement score in that area', () => {
    update(courseSlot, (s) => ({ ...s, placement: { done: true, skipped: false, scores: { safety: 0.9, tactics: 0.5 } } }));
    const s = read(courseSlot);
    const safety = LESSONS_IN_ORDER.find((l) => l.area === 'safety')!.id;
    const tactics = LESSONS_IN_ORDER.find((l) => l.area === 'tactics')!.id;
    expect(canTestOut(s, safety)).toBe(true);
    expect(canTestOut(s, tactics)).toBe(false);
  });
});

describe('review queue and coach notes', () => {
  it('adds missed items once, and they are due today', () => {
    addToReview(first, [{ key: 'a', item: 1 }, { key: 'b', item: 2 }]);
    addToReview(first, [{ key: 'a', item: 1 }]);
    let s = read(courseSlot);
    expect(s.review.length).toBe(2);
    expect(dueReview(s).length).toBe(2);
    gradeReview('a', true);
    s = read(courseSlot);
    expect(dueReview(s).map((r) => r.key)).toEqual(['b']);
  });

  it('points mistakes at the lessons that fix them', () => {
    const ids = lessonsForTags(['hung-piece', 'missed-fork']);
    expect(ids.length).toBe(2);
    for (const id of ids) expect(LESSONS_IN_ORDER.some((l) => l.id === id)).toBe(true);
    addCoachNote('Game 1', ['hung-piece', 'hung-piece']);
    const note = read(courseSlot).notes[0];
    expect(note.text).toContain('2 times');
    expect(note.lessons.length).toBe(1);
    addCoachNote('Game 2', []);
    expect(read(courseSlot).notes[0].text).toContain('No real mistakes');
  });
});
