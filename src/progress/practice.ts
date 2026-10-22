// Practice games against the bots: results, and the level-up rule.

import type { MistakeTag } from '../chess/explain';
import type { Slot } from './store';

export type CoachLevel = 'full' | 'light' | 'none';

export interface PracticeGame {
  id: string;
  /** ISO time (UTC) when the game ended. */
  endedAt: string;
  botRating: number;
  color: 'white' | 'black';
  coach: CoachLevel;
  result: 'win' | 'loss' | 'draw';
  reason: string;
  accuracy: number | null;
  blunders: number;
  mistakes: number;
  takebacks: number;
  hints: number;
  tags: MistakeTag[];
  pgn: string;
}

export const practiceSlot: Slot<PracticeGame[]> = {
  key: 'practice-games',
  version: 1,
  initial: () => [],
};

/** Suggest the next level after 3 wins in the last 5 games at this level. */
export function shouldLevelUp(games: PracticeGame[], rating: number): boolean {
  const last5 = games.filter((g) => g.botRating === rating).slice(0, 5);
  return last5.filter((g) => g.result === 'win').length >= 3;
}

export function recordAt(games: PracticeGame[], rating: number) {
  const at = games.filter((g) => g.botRating === rating);
  return {
    wins: at.filter((g) => g.result === 'win').length,
    draws: at.filter((g) => g.result === 'draw').length,
    losses: at.filter((g) => g.result === 'loss').length,
  };
}
