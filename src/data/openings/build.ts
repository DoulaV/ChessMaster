// Builds and checks the move tree of an opening lesson.

import { Chess } from 'chess.js';
import { START_FEN } from '../../chess/utils';
import type { OpeningLesson, OpeningNode } from './types';

/** Plies (half-moves) of theory to learn at a given Chess.com rating. */
export function depthForRating(rating: number): number {
  if (rating < 1000) return 16; // about 8 moves each
  if (rating < 1300) return 20; // about 10 moves
  return 24; // about 12 moves
}

const trees = new Map<string, OpeningNode>();

/** Build the tree. Throws if any move is illegal or has no explanation. */
export function buildTree(lesson: OpeningLesson): OpeningNode {
  const cached = trees.get(lesson.id);
  if (cached) return cached;
  const root: OpeningNode = { key: '', san: '', why: '', ply: 0, fen: START_FEN, lines: [], children: [] };
  for (const line of lesson.lines) {
    const chess = new Chess();
    let node = root;
    node.lines.push(line.id);
    line.moves.forEach(([san, why], i) => {
      let move;
      try {
        move = chess.move(san);
      } catch {
        throw new Error(`${lesson.id}/${line.id}: illegal move ${i + 1} "${san}"`);
      }
      let child = node.children.find((c) => c.san === move.san);
      if (!child) {
        if (!why) throw new Error(`${lesson.id}/${line.id}: move ${i + 1} "${san}" has no explanation`);
        child = {
          key: node.key ? `${node.key} ${move.san}` : move.san,
          san: move.san,
          why,
          ply: i + 1,
          fen: chess.fen(),
          lines: [],
          children: [],
        };
        node.children.push(child);
      } else if (why && !child.why) {
        child.why = why;
      }
      child.lines.push(line.id);
      node = child;
    });
  }
  trees.set(lesson.id, root);
  return root;
}

/** Nodes along a line, from the first move, limited to `maxPly`. */
export function lineNodes(lesson: OpeningLesson, lineId: string, maxPly = 999): OpeningNode[] {
  const root = buildTree(lesson);
  const line = lesson.lines.find((l) => l.id === lineId);
  if (!line) return [];
  const out: OpeningNode[] = [];
  let node = root;
  for (const [san] of line.moves.slice(0, maxPly)) {
    const chess = new Chess(node.fen);
    const m = chess.move(san);
    const next = node.children.find((c) => c.san === m.san);
    if (!next) break;
    out.push(next);
    node = next;
  }
  return out;
}

/** Is it the student's move at this node's parent? (White lessons: odd plies.) */
export function isStudentMove(lesson: OpeningLesson, ply: number): boolean {
  return lesson.side === 'white' ? ply % 2 === 1 : ply % 2 === 0;
}

export function findNode(lesson: OpeningLesson, key: string): OpeningNode | null {
  const walk = (n: OpeningNode): OpeningNode | null => {
    if (n.key === key) return n;
    for (const c of n.children) {
      if (key === c.key || key.startsWith(c.key + ' ')) return walk(c);
    }
    return null;
  };
  return walk(buildTree(lesson));
}
