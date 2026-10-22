// Course progress: placement test, lesson steps, the review queue of missed
// exercises, and the coach's notes from your games.

import type { MistakeTag } from '../chess/explain';
import type { Area } from '../data/course/types';
import { LESSONS_IN_ORDER, lessonById } from '../data/course/units';
import { isDue, newCard, review, today, type SrsCard } from './srs';
import { update, type Slot } from './store';

export const PASS_MARK = 0.8;
export const GUIDED_COUNT = 5;
export const TEST_COUNT = 10;

export interface LessonProgress {
  learned: boolean;
  /** Guided exercises finished. */
  guided: number;
  /** Best test score (0 to 1). */
  testBest: number | null;
  passed: boolean;
  /** Skipped learn/guided/game because the placement test showed you know it. */
  testedOut: boolean;
  gamePlayed: boolean;
  completedOn?: string;
}

/** A missed exercise, kept to practice again (stored whole so it can be replayed). */
export interface ReviewItem {
  key: string;
  lessonId: string;
  item: unknown;
  card: SrsCard;
}

export interface CoachNote {
  date: string;
  text: string;
  lessons: string[];
}

export interface CourseState {
  placement: { done: boolean; skipped: boolean; date?: string; scores: Partial<Record<Area, number>> };
  lessons: Record<string, LessonProgress>;
  review: ReviewItem[];
  notes: CoachNote[];
  /** What was done each day (for "today's session"). */
  days: Record<string, { warmup: number; lesson: number; game: number }>;
}

export const courseSlot: Slot<CourseState> = {
  key: 'course',
  version: 1,
  initial: () => ({ placement: { done: false, skipped: false, scores: {} }, lessons: {}, review: [], notes: [], days: {} }),
};

export const emptyLesson = (): LessonProgress => ({ learned: false, guided: 0, testBest: null, passed: false, testedOut: false, gamePlayed: false });

export function lessonState(s: CourseState, id: string): LessonProgress {
  return s.lessons[id] ?? emptyLesson();
}

export function isComplete(p: LessonProgress): boolean {
  return p.passed && (p.testedOut || (p.learned && p.gamePlayed));
}

/** Strict order: a lesson opens when every lesson before it is complete. */
export function isUnlocked(s: CourseState, id: string): boolean {
  const i = LESSONS_IN_ORDER.findIndex((l) => l.id === id);
  if (i < 0) return false;
  return LESSONS_IN_ORDER.slice(0, i).every((l) => isComplete(lessonState(s, l.id)));
}

export function currentLesson(s: CourseState) {
  return LESSONS_IN_ORDER.find((l) => !isComplete(lessonState(s, l.id))) ?? null;
}

export type LessonStep = 'learn' | 'guided' | 'test' | 'game' | 'done';

/** The next thing to do in a lesson. */
export function nextStep(s: CourseState, id: string): LessonStep {
  const p = lessonState(s, id);
  if (isComplete(p)) return 'done';
  if (p.passed && !p.gamePlayed) return 'game';
  if (!p.learned) return 'learn';
  if (p.guided < GUIDED_COUNT) return 'guided';
  return 'test';
}

/** May this lesson be tested out (placement score of 80%+ in its area)? */
export function canTestOut(s: CourseState, id: string): boolean {
  const l = lessonById(id);
  const score = l ? s.placement.scores[l.area] : undefined;
  return score !== undefined && score >= PASS_MARK;
}

function bumpDay(s: CourseState, k: 'warmup' | 'lesson' | 'game'): CourseState['days'] {
  const d = today();
  const day = s.days[d] ?? { warmup: 0, lesson: 0, game: 0 };
  return { ...s.days, [d]: { ...day, [k]: day[k] + 1 } };
}

export function setLesson(id: string, fn: (p: LessonProgress) => LessonProgress, dayKey: 'lesson' | 'game' = 'lesson') {
  update(courseSlot, (s) => {
    const before = lessonState(s, id);
    let p = fn(before);
    if (!before.completedOn && isComplete(p)) p = { ...p, completedOn: today() };
    return { ...s, lessons: { ...s.lessons, [id]: p }, days: bumpDay(s, dayKey) };
  });
}

/** Add missed exercises to the review queue (they come back with spaced repetition). */
export function addToReview(lessonId: string, items: { key: string; item: unknown }[]) {
  if (!items.length) return;
  update(courseSlot, (s) => {
    const have = new Set(s.review.map((r) => r.key));
    const fresh = items.filter((i) => !have.has(i.key)).map((i) => ({ ...i, lessonId, card: newCard() }));
    return { ...s, review: [...fresh, ...s.review].slice(0, 300) };
  });
}

export function gradeReview(key: string, ok: boolean) {
  update(courseSlot, (s) => ({
    ...s,
    review: s.review.map((r) => (r.key === key ? { ...r, card: review(r.card, ok ? 5 : 1) } : r)),
    days: bumpDay(s, 'warmup'),
  }));
}

export const dueReview = (s: CourseState) => s.review.filter((r) => isDue(r.card));

/** Which lessons fix which kind of mistake. */
export function lessonsForTags(tags: MistakeTag[]): string[] {
  const out: string[] = [];
  for (const t of new Set(tags)) {
    for (const l of LESSONS_IN_ORDER) {
      if (l.fixes.includes(t) && !out.includes(l.id)) {
        out.push(l.id);
        break;
      }
    }
  }
  return out;
}

/** The coach writes a short note after a game, pointing at the lessons that fix its mistakes. */
export function addCoachNote(source: string, tags: MistakeTag[], fallback = 'No real mistakes. Keep using your checklist.') {
  const lessons = lessonsForTags(tags);
  const counts = new Map<MistakeTag, number>();
  for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const LABEL: Record<MistakeTag, string> = {
    'allowed-mate': 'you allowed a checkmate',
    'hung-piece': 'you left a piece unprotected',
    'allowed-fork': 'you allowed a fork',
    'missed-mate': 'you missed a checkmate',
    'missed-fork': 'you missed a fork',
    'missed-win': 'you missed a chance to win material',
    other: 'a plan or position mistake',
  };
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (n > 1 ? `${LABEL[t]} (${n} times)` : LABEL[t]));
  const text = parts.length
    ? `${source}: ${parts.join(', ')}. ${lessons.length ? `Review lesson ${lessons.map((l) => `${l} (${lessonById(l)?.title})`).join(' and ')}.` : ''}`
    : `${source}: ${fallback}`;
  update(courseSlot, (s) => ({ ...s, notes: [{ date: today(), text, lessons }, ...s.notes].slice(0, 50) }));
}

export function markGameDay() {
  update(courseSlot, (s) => ({ ...s, days: bumpDay(s, 'game') }));
}
