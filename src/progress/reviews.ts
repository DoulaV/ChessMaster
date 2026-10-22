// Summaries of imported games you reviewed (for the dashboard).

import type { MistakeTag } from '../chess/explain';
import type { Slot } from './store';

export interface ReviewedGame {
  id: string;
  site: 'chess.com' | 'lichess';
  playedAt: string;
  opponent: string;
  you: 'white' | 'black';
  result: 'win' | 'loss' | 'draw';
  accuracy: number | null;
  blunders: number;
  mistakes: number;
  tags: MistakeTag[];
  leftBook: { move: number; san: string; byYou: boolean; book: string } | null;
}

export const reviewsSlot: Slot<Record<string, ReviewedGame>> = {
  key: 'game-reviews',
  version: 1,
  initial: () => ({}),
};
