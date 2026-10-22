// Loads the Lichess puzzles (public/puzzles/<theme>.json) and picks sets.

import type { PersonalPuzzle } from '../../progress/puzzles';
import { isDue } from '../../progress/srs';
import { THEMES, weakestThemes, type TacticsStats } from '../../progress/tactics';

/** [id, fen, moves, rating, openingId] as stored in the JSON files. */
export type RawPuzzle = [string, string, string, number, string];

export interface LichessPuzzle {
  kind: 'lichess';
  id: string;
  /** Position before the opponent's first move. */
  fen: string;
  /** UCI moves: the opponent's move first, then the solution. */
  moves: string[];
  rating: number;
  theme: string;
  opening: string;
}

export interface MyPuzzle {
  kind: 'personal';
  puzzle: PersonalPuzzle;
}

export type PuzzleItem = LichessPuzzle | MyPuzzle;

const cache = new Map<string, Promise<LichessPuzzle[]>>();

export function loadTheme(theme: string): Promise<LichessPuzzle[]> {
  let p = cache.get(theme);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}puzzles/${theme}.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: RawPuzzle[]) =>
        rows.map(([id, fen, moves, rating, opening]) => ({ kind: 'lichess' as const, id, fen, moves: moves.split(' '), rating, theme, opening })),
      )
      .catch(() => []);
    cache.set(theme, p);
  }
  return p;
}

/**
 * Pick `n` puzzles from a theme close to the player's rating, skipping recent
 * ones. The window widens if there aren't enough.
 */
export function pickNear(list: LichessPuzzle[], rating: number, n: number, recent: Set<string>, openings?: Set<string>): LichessPuzzle[] {
  const usable = list.filter((p) => !recent.has(p.id) && (!openings || openings.has(p.opening)));
  for (const window of [100, 200, 350, 2000]) {
    const near = usable.filter((p) => Math.abs(p.rating - rating) <= window);
    if (near.length >= n) {
      const out: LichessPuzzle[] = [];
      const pool = [...near];
      while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      return out;
    }
  }
  return usable.slice(0, n);
}

/**
 * Today's 15: up to 5 of your own puzzles that are due, then Lichess puzzles,
 * leaning toward your weakest themes.
 */
export async function buildDailySet(stats: TacticsStats, rating: number, personal: PersonalPuzzle[], size: number, openings?: Set<string>): Promise<PuzzleItem[]> {
  const mine: PuzzleItem[] = personal.filter((p) => isDue(p.card)).slice(0, 5).map((puzzle) => ({ kind: 'personal', puzzle }));
  const need = size - mine.length;
  const order = weakestThemes(stats);
  // Weakest themes get more puzzles: 3, 3, 2, 2, then 1 each.
  const plan: Record<string, number> = {};
  const shares = [3, 3, 2, 2, 1, 1, 1, 1, 1];
  let left = need;
  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    const take = Math.min(left, shares[i] ?? 1);
    plan[order[i]] = (plan[order[i]] ?? 0) + take;
    left -= take;
  }
  const recent = new Set(stats.recent);
  const picked: PuzzleItem[] = [];
  for (const [theme, n] of Object.entries(plan)) {
    const list = await loadTheme(theme);
    picked.push(...pickNear(list, rating, n, recent, openings));
  }
  // If the opening filter left us short, top up without it.
  if (openings && picked.length < need) {
    const list = await loadTheme(order[0]);
    picked.push(...pickNear(list, rating, need - picked.length, new Set([...recent, ...picked.map((p) => (p as LichessPuzzle).id)])));
  }
  return [...mine, ...picked.sort(() => Math.random() - 0.5)];
}

export const themeInfo = (id: string) => THEMES.find((t) => t.id === id);
