// Picks exercises for a lesson from the Blunder Check bank and the Lichess puzzles.

import type { ExerciseSource } from '../../data/course/types';
import { loadBank, type BankHanging, type BankSafe, type BankThreat } from '../blunder/bank';
import { loadTheme, pickNear, type LichessPuzzle } from '../tactics/puzzles';

export type CourseItem =
  | { kind: 'threat'; q: BankThreat }
  | { kind: 'safe'; q: BankSafe }
  | { kind: 'hanging'; q: BankHanging }
  | { kind: 'puzzle'; q: LichessPuzzle };

export const itemKey = (i: CourseItem) => (i.kind === 'puzzle' ? `pz:${i.q.id}` : `${i.kind}:${i.q.fen}${i.kind === 'safe' ? i.q.uci : ''}`);

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function pick<T>(list: T[], n: number, avoid: Set<string>, key: (t: T) => string): T[] {
  const fresh = list.filter((x) => !avoid.has(key(x)));
  return shuffle(fresh.length >= n ? fresh : list).slice(0, n);
}

/**
 * `n` exercises from a source. Puzzles are picked near `rating`; `easy` picks
 * the easiest ones (for worked examples).
 */
export async function loadItems(source: ExerciseSource, n: number, rating: number, avoid: Set<string> = new Set(), easy = false): Promise<CourseItem[]> {
  if (source.kind === 'mixed') {
    const per = Math.ceil(n / source.parts.length);
    const all = (await Promise.all(source.parts.map((p) => loadItems(p, per, rating, avoid, easy)))).flat();
    return shuffle(all).slice(0, n);
  }
  if (source.kind === 'puzzles') {
    const per = Math.ceil(n / source.themes.length);
    const out: CourseItem[] = [];
    for (const theme of source.themes) {
      const list = await loadTheme(theme);
      const usable = list.filter((p) => !avoid.has(`pz:${p.id}`));
      const chosen = easy ? usable.slice(0, 40).sort(() => Math.random() - 0.5).slice(0, per) : pickNear(usable, rating, per, new Set());
      out.push(...chosen.map((q) => ({ kind: 'puzzle' as const, q })));
    }
    return shuffle(out).slice(0, n);
  }
  const bank = await loadBank();
  if (source.kind === 'threats') return pick(bank.threats, n, avoid, (q) => `threat:${q.fen}`).map((q) => ({ kind: 'threat', q }));
  if (source.kind === 'hanging') {
    // Easy examples: positions with few unprotected pieces.
    const list = easy ? bank.hanging.filter((h) => h.answers.length <= 2) : bank.hanging;
    return pick(list, n, avoid, (q) => `hanging:${q.fen}`).map((q) => ({ kind: 'hanging', q }));
  }
  // Safe or blunder: half and half, so guessing doesn't work.
  const safe = pick(bank.safe.filter((q) => q.verdict === 'safe'), Math.ceil(n / 2), avoid, (q) => `safe:${q.fen}${q.uci}`);
  const bad = pick(bank.safe.filter((q) => q.verdict === 'blunder'), Math.floor(n / 2), avoid, (q) => `safe:${q.fen}${q.uci}`);
  return shuffle([...safe, ...bad]).map((q) => ({ kind: 'safe', q }));
}
