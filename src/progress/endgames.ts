// Endgame practice results. An endgame is mastered after 3 successes.

import type { Slot } from './store';

export interface EndgameRecord {
  attempts: number;
  wins: number;
  /** Successes in a row. */
  streak: number;
  mastered: boolean;
}

export const ENDGAME_MASTERY = 3;

export const endgamesSlot: Slot<{ byId: Record<string, EndgameRecord>; days: Record<string, number> }> = {
  key: 'endgames',
  version: 1,
  initial: () => ({ byId: {}, days: {} }),
};
