// Quality checks for an opening lesson. Used by the tests; returns a list of
// problems (empty = good).

import { Chess } from 'chess.js';
import eco from '../eco.json';
import { buildTree, depthForRating, isStudentMove, lineNodes } from './build';
import type { OpeningLesson, OpeningNode } from './types';

const ECO = eco as unknown as Record<string, [string, string, string]>;
const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Official [eco, name] of the last named position along a move list. */
export function officialName(moves: string[]): [string, string] | null {
  const c = new Chess();
  let last: [string, string] | null = null;
  for (const m of moves) {
    c.move(m);
    const hit = ECO[epd(c.fen())];
    if (hit) last = [hit[0], hit[1]];
  }
  return last;
}

export function validateLesson(lesson: OpeningLesson): string[] {
  const errors: string[] = [];
  const err = (s: string) => errors.push(`${lesson.id}: ${s}`);
  let root: OpeningNode;
  try {
    root = buildTree(lesson);
  } catch (e) {
    return [(e as Error).message];
  }
  const walk = (n: OpeningNode) => {
    if (n.ply > 0 && n.why.length <= 10) err(`explanation too short at "${n.key}"`);
    if (/—/.test(n.why)) err(`em dash in explanation at "${n.key}"`);
    n.children.forEach(walk);
  };
  walk(root);
  for (const line of lesson.lines) {
    try {
      const name = officialName(line.moves.map(([s]) => s));
      if (!name) err(`line ${line.id} reaches no named position`);
      else if (name[0] !== line.eco || name[1] !== line.ecoName)
        err(`line ${line.id}: eco should be ${JSON.stringify(name)}, not ${JSON.stringify([line.eco, line.ecoName])}`);
    } catch (e) {
      err(`line ${line.id}: ${(e as Error).message}`);
    }
    const nodes = lineNodes(lesson, line.id, depthForRating(800));
    if (!nodes.some((n) => isStudentMove(lesson, n.ply))) err(`line ${line.id} has no student move in the first 8 moves`);
  }
  if (lesson.lines.filter((l) => l.main).length !== 1) err('needs exactly one main line');
  if (lesson.lines.length < 3) err('needs a main line and at least 2 side lines');
  if (new Set(lesson.lines.map((l) => l.id)).size !== lesson.lines.length) err('duplicate line ids');
  if (lesson.character.length < 50) err('character too short');
  if (lesson.plan.pieces.length < 4) err('plan needs 4+ pieces');
  if (lesson.plan.goals.length < 3) err('plan needs 3+ goals');
  if (lesson.offBook.length < 2) err('needs 2+ off-book tips');
  if (lesson.traps.length < 1) err('needs a trap');
  if (lesson.modelGames.length < 1) err('needs a model game');
  for (const t of lesson.traps) {
    const c = new Chess();
    try {
      t.moves.forEach((m) => c.move(m));
    } catch {
      err(`trap ${t.id} has an illegal move`);
    }
    if (t.mistakeAt >= t.moves.length) err(`trap ${t.id} mistakeAt out of range`);
  }
  for (const g of lesson.modelGames) {
    const c = new Chess();
    try {
      g.moves.forEach((m) => c.move(m));
    } catch {
      err(`game ${g.id} has an illegal move`);
    }
    for (const k of Object.keys(g.comments)) if (Number(k) >= g.moves.length) err(`game ${g.id} comment ${k} out of range`);
    if (g.result === '1-0' && c.isCheckmate() && c.turn() !== 'b') err(`game ${g.id} result does not match the mate`);
    if (g.result === '0-1' && c.isCheckmate() && c.turn() !== 'w') err(`game ${g.id} result does not match the mate`);
  }
  const text = JSON.stringify(lesson);
  if (text.includes('—')) err('contains an em dash somewhere');
  return errors;
}
