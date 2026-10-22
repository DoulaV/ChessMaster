// Opening progress: drill scores per day, mastery, spaced-repetition cards,
// and the learning path order.

import { BONUS_UNLOCKS, DEFAULT_PATH, entry, type PathStep } from '../data/openings/catalog';
import { read, update, type Slot } from './store';
import { isDue, newCard, review, today, type SrsCard } from './srs';

export interface OpeningProgress {
  /** Best full-drill score (0 to 1) for each day it was drilled. */
  drillDays: Record<string, number>;
  /** Lines the student has stepped through in Learn mode. */
  learnedLines: string[];
  masteredOn?: string;
}

export const MASTERY_SCORE = 0.9;
export const MASTERY_DAYS = 3;

export const openingProgressSlot: Slot<Record<string, OpeningProgress>> = {
  key: 'openings',
  version: 1,
  initial: () => ({}),
};

/** Cards keyed "<openingId>|<move path>", e.g. "italian|e4 e5 Nf3 Nc6 Bc4". */
export const openingCardsSlot: Slot<Record<string, SrsCard>> = {
  key: 'opening-cards',
  version: 1,
  initial: () => ({}),
};

export const pathSlot: Slot<string[]> = {
  key: 'opening-path',
  version: 1,
  initial: () => DEFAULT_PATH.map((s) => s.id),
};

export const recognizeSlot: Slot<{ correct: number; total: number; byOpening: Record<string, [number, number]> }> = {
  key: 'recognize',
  version: 1,
  initial: () => ({ correct: 0, total: 0, byOpening: {} }),
};

const emptyProgress = (): OpeningProgress => ({ drillDays: {}, learnedLines: [] });

export function progressOf(all: Record<string, OpeningProgress>, id: string): OpeningProgress {
  return all[id] ?? emptyProgress();
}

/** Days with a full drill at 90% or better. */
export function goodDays(p: OpeningProgress): string[] {
  return Object.entries(p.drillDays)
    .filter(([, s]) => s >= MASTERY_SCORE)
    .map(([d]) => d)
    .sort();
}

export function isMastered(p: OpeningProgress): boolean {
  return goodDays(p).length >= MASTERY_DAYS;
}

/** 0 to 1, for progress bars: learning the lines counts a little, drill days count most. */
export function masteryPercent(p: OpeningProgress, lineCount: number): number {
  if (isMastered(p)) return 1;
  const learned = lineCount ? Math.min(1, p.learnedLines.length / lineCount) : 0;
  return 0.25 * learned + 0.75 * (goodDays(p).length / MASTERY_DAYS);
}

export function recordDrill(openingId: string, score: number, date = today()) {
  update(openingProgressSlot, (all) => {
    const p = progressOf(all, openingId);
    const drillDays = { ...p.drillDays, [date]: Math.max(p.drillDays[date] ?? 0, score) };
    const next: OpeningProgress = { ...p, drillDays };
    if (!p.masteredOn && isMastered(next)) next.masteredOn = date;
    return { ...all, [openingId]: next };
  });
}

export function markLineLearned(openingId: string, lineId: string) {
  update(openingProgressSlot, (all) => {
    const p = progressOf(all, openingId);
    if (p.learnedLines.includes(lineId)) return all;
    return { ...all, [openingId]: { ...p, learnedLines: [...p.learnedLines, lineId] } };
  });
}

export const cardId = (openingId: string, key: string) => `${openingId}|${key}`;

export function gradeCard(openingId: string, key: string, quality: number, date = today()) {
  update(openingCardsSlot, (cards) => {
    const id = cardId(openingId, key);
    return { ...cards, [id]: review(cards[id] ?? newCard(date), quality, date) };
  });
}

export function dueCards(date = today()): string[] {
  const cards = read(openingCardsSlot);
  return Object.entries(cards)
    .filter(([, c]) => isDue(c, date))
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .map(([id]) => id);
}

/** The path in the user's order. Unknown or missing steps are fixed up. */
export function orderedPath(order: string[]): PathStep[] {
  const byId = new Map(DEFAULT_PATH.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const out: PathStep[] = [];
  for (const id of order) {
    const s = byId.get(id);
    if (s && !seen.has(id)) {
      out.push(s);
      seen.add(id);
    }
  }
  for (const s of DEFAULT_PATH) if (!seen.has(s.id)) out.push(s);
  return out;
}

export type OpeningStatus = 'mastered' | 'current' | 'locked' | 'coming-soon';

/**
 * Status of every opening in the path. You study one step at a time: the first
 * step that isn't fully mastered is "current", everything after it is locked.
 */
export function pathStatus(order: string[], all: Record<string, OpeningProgress>) {
  const steps = orderedPath(order);
  const status: Record<string, OpeningStatus> = {};
  let currentStep: PathStep | null = null;
  for (const step of steps) {
    const stepDone = step.openings.every((id) => isMastered(progressOf(all, id)));
    for (const id of step.openings) {
      if (isMastered(progressOf(all, id))) status[id] = 'mastered';
      else if (!currentStep) status[id] = entry(id)?.lesson ? 'current' : 'coming-soon';
      else status[id] = entry(id)?.lesson ? 'locked' : 'coming-soon';
    }
    if (!stepDone && !currentStep) currentStep = step;
  }
  // Bonus openings (not in the path) open up once their related opening is mastered.
  for (const [id, after] of Object.entries(BONUS_UNLOCKS)) {
    if (isMastered(progressOf(all, id))) status[id] = 'mastered';
    else if (!entry(id)?.lesson) status[id] = 'coming-soon';
    else status[id] = status[after] === 'mastered' ? 'current' : 'locked';
  }
  return { steps, status, currentStep };
}
