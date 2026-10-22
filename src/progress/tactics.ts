// Tactics progress: an adaptive puzzle rating, per-theme results, and the
// daily set of 15.

import { today } from './srs';
import { update, type Slot } from './store';

export const THEMES = [
  { id: 'fork', name: 'Fork', icon: '🍴', text: 'One piece attacks two things at once (often a knight).' },
  { id: 'double-attack', name: 'Double attack', icon: '⚔️', text: 'The queen hits two targets at once.' },
  { id: 'pin', name: 'Pin', icon: '📌', text: 'A piece can’t move without exposing something more valuable behind it.' },
  { id: 'skewer', name: 'Skewer', icon: '🍢', text: 'Attack a valuable piece; when it moves, take what was behind it.' },
  { id: 'discovered-attack', name: 'Discovered attack', icon: '🎭', text: 'Move one piece out of the way to unleash an attack from another.' },
  { id: 'back-rank-mate', name: 'Back rank mate', icon: '🏰', text: 'Checkmate on the back row when the king is boxed in by its own pawns.' },
  { id: 'removing-defender', name: 'Removing the defender', icon: '🧹', text: 'Capture or chase away the piece that protects something.' },
  { id: 'mate-in-1', name: 'Mate in 1', icon: '♚', text: 'Find the checkmate in one move.' },
  { id: 'mate-in-2', name: 'Mate in 2', icon: '♛', text: 'Find the first move of a two-move checkmate.' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DAILY_SIZE = 15;

export interface TacticsStats {
  rating: number;
  /** Puzzles played so far (the rating moves faster at the start). */
  games: number;
  /** End-of-day rating per local date, for the trend. */
  history: Record<string, number>;
  byTheme: Record<string, { right: number; total: number }>;
  /** Recently played puzzle ids, so they don't repeat. */
  recent: string[];
  days: Record<string, { done: number; right: number }>;
}

export const tacticsSlot: Slot<TacticsStats> = {
  key: 'tactics',
  version: 1,
  initial: () => ({ rating: 0, games: 0, history: {}, byTheme: {}, recent: [], days: {} }),
};

/** Starting puzzle rating from the Chess.com rating (puzzle ratings run a bit higher). */
export const startRating = (chesscomRating: number) => Math.max(600, Math.min(1500, chesscomRating + 100));

/** Elo-style update: up when you solve, down when you fail, more for surprises. */
export function newRating(rating: number, puzzleRating: number, solved: boolean, games: number): number {
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  const k = games < 30 ? 40 : 20;
  return Math.round(rating + k * ((solved ? 1 : 0) - expected));
}

export function recordPuzzle(id: string, theme: string, puzzleRating: number, solved: boolean, fallbackStart: number) {
  update(tacticsSlot, (s) => {
    const d = today();
    const base = s.rating || fallbackStart;
    const rating = newRating(base, puzzleRating, solved, s.games);
    const t = s.byTheme[theme] ?? { right: 0, total: 0 };
    const day = s.days[d] ?? { done: 0, right: 0 };
    return {
      ...s,
      rating,
      games: s.games + 1,
      history: { ...s.history, [d]: rating },
      byTheme: { ...s.byTheme, [theme]: { right: t.right + (solved ? 1 : 0), total: t.total + 1 } },
      recent: [id, ...s.recent].slice(0, 3000),
      days: { ...s.days, [d]: { done: day.done + 1, right: day.right + (solved ? 1 : 0) } },
    };
  });
}

/** Themes ordered weakest first (unplayed themes count as weak). */
export function weakestThemes(s: TacticsStats): string[] {
  const score = (id: string) => {
    const t = s.byTheme[id];
    return t && t.total ? (t.right + 1) / (t.total + 2) : 0.4;
  };
  return THEMES.map((t) => t.id as string).sort((a, b) => score(a) - score(b));
}
