// Personal puzzles: positions where you went wrong in your own games, with
// the engine's move as the answer. They come back with spaced repetition.

import type { MistakeTag } from '../chess/explain';
import { newCard, review, today, type SrsCard } from './srs';
import { update, type Slot } from './store';

export interface PersonalPuzzle {
  id: string;
  /** Position before your mistake (you to move). */
  fen: string;
  /** Best move (UCI) and the engine line after it. */
  solution: string;
  line: string[];
  /** What you played instead (SAN). */
  played: string;
  tag: MistakeTag;
  source: 'practice' | 'review';
  sourceLabel: string;
  createdAt: string;
  card: SrsCard;
}

export const puzzlesSlot: Slot<PersonalPuzzle[]> = {
  key: 'personal-puzzles',
  version: 1,
  initial: () => [],
};

export function addPuzzles(list: Omit<PersonalPuzzle, 'id' | 'createdAt' | 'card'>[]) {
  const d = today();
  update(puzzlesSlot, (all) => {
    const have = new Set(all.map((p) => p.fen));
    const fresh = list
      .filter((p) => !have.has(p.fen))
      .map((p) => ({ ...p, id: crypto.randomUUID(), createdAt: d, card: newCard(d) }));
    return [...fresh, ...all].slice(0, 500);
  });
}

export function gradePuzzle(id: string, quality: number) {
  update(puzzlesSlot, (all) => all.map((p) => (p.id === id ? { ...p, card: review(p.card, quality) } : p)));
}
