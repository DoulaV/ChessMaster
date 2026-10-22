// An opening book built from all the lessons: for any position that appears
// in a lesson, which moves are "book" and which line they belong to.

import { epd } from '../../chess/utils';
import { buildTree } from '../../data/openings/build';
import { LESSONS } from '../../data/openings/catalog';
import type { OpeningLesson, OpeningNode } from '../../data/openings/types';

export interface BookMove {
  san: string;
  lessonId: string;
  lessonName: string;
  lineName: string;
  /** Lessons where this move is the main line weigh more. */
  weight: number;
}

let index: Map<string, BookMove[]> | null = null;

function lineName(lesson: OpeningLesson, node: OpeningNode): string {
  return lesson.lines.find((l) => node.lines.includes(l.id))?.name ?? lesson.name;
}

export function bookIndex(): Map<string, BookMove[]> {
  if (index) return index;
  index = new Map();
  for (const lesson of LESSONS) {
    const mainId = lesson.lines.find((l) => l.main)?.id;
    const walk = (n: OpeningNode) => {
      const key = epd(n.fen);
      const list = index!.get(key) ?? [];
      for (const c of n.children) {
        const existing = list.find((b) => b.san === c.san);
        const weight = 1 + (mainId && c.lines.includes(mainId) ? 2 : 0) + c.lines.length * 0.5;
        if (existing) existing.weight += weight;
        else list.push({ san: c.san, lessonId: lesson.id, lessonName: lesson.name, lineName: lineName(lesson, c), weight });
      }
      if (list.length) index!.set(key, list);
      n.children.forEach(walk);
    };
    walk(buildTree(lesson));
  }
  return index;
}

export function bookMoves(fen: string): BookMove[] {
  return bookIndex().get(epd(fen)) ?? [];
}

/** Book moves, restricted to one lesson when the game started from it. */
export function bookMovesFor(fen: string, lessonId?: string | null): BookMove[] {
  const all = bookMoves(fen);
  if (!lessonId) return all;
  const lesson = LESSONS.find((l) => l.id === lessonId);
  if (!lesson) return all;
  const own = findChildren(lesson, fen);
  return own.length ? own : [];
}

function findChildren(lesson: OpeningLesson, fen: string): BookMove[] {
  const key = epd(fen);
  const out: BookMove[] = [];
  const mainId = lesson.lines.find((l) => l.main)?.id;
  const walk = (n: OpeningNode) => {
    if (epd(n.fen) === key) {
      for (const c of n.children) {
        if (!out.some((o) => o.san === c.san)) {
          out.push({
            san: c.san,
            lessonId: lesson.id,
            lessonName: lesson.name,
            lineName: lineName(lesson, c),
            weight: 1 + (mainId && c.lines.includes(mainId) ? 2 : 0) + c.lines.length * 0.5,
          });
        }
      }
    }
    n.children.forEach(walk);
  };
  walk(buildTree(lesson));
  return out;
}

/** Weighted random pick, like a human who mostly plays the main line. */
export function pickBookMove(moves: BookMove[], random: () => number = Math.random): BookMove | null {
  if (!moves.length) return null;
  const total = moves.reduce((s, m) => s + m.weight, 0);
  let r = random() * total;
  for (const m of moves) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return moves[0];
}
