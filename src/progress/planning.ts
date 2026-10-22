// Planning Trainer results.

import type { Slot } from './store';

export interface PlanningStats {
  quiz: { right: number; total: number };
  candidates: { rounds: number; foundBest: number };
  lessonsRead: string[];
  recentQuiz: string[];
  days: Record<string, { quiz: number; candidates: number }>;
}

export const planningSlot: Slot<PlanningStats> = {
  key: 'planning',
  version: 1,
  initial: () => ({ quiz: { right: 0, total: 0 }, candidates: { rounds: 0, foundBest: 0 }, lessonsRead: [], recentQuiz: [], days: {} }),
};

