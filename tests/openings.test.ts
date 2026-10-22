import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import eco from '../src/data/eco.json';
import { buildTree, depthForRating, isStudentMove, lineNodes } from '../src/data/openings/build';
import { CATALOG, DEFAULT_PATH, LESSONS } from '../src/data/openings/catalog';
import type { OpeningNode } from '../src/data/openings/types';

const ECO = eco as unknown as Record<string, [string, string, string]>;
const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

describe('opening data quality', () => {
  for (const lesson of LESSONS) {
    describe(lesson.name, () => {
      it('builds: every move is legal and explained', () => {
        const root = buildTree(lesson);
        const walk = (n: OpeningNode) => {
          if (n.ply > 0) expect(n.why.length, n.key).toBeGreaterThan(10);
          n.children.forEach(walk);
        };
        walk(root);
      });

      it('uses the official ECO code and name for every line', () => {
        for (const line of lesson.lines) {
          const c = new Chess();
          let last: [string, string, string] | null = null;
          for (const [san] of line.moves) {
            c.move(san);
            last = ECO[epd(c.fen())] ?? last;
          }
          expect(last, line.id).not.toBeNull();
          expect([line.eco, line.ecoName], line.id).toEqual([last![0], last![1]]);
        }
      });

      it('has a main line and 2+ side lines, each with student moves at every level', () => {
        expect(lesson.lines.filter((l) => l.main)).toHaveLength(1);
        expect(lesson.lines.length).toBeGreaterThanOrEqual(3);
        for (const line of lesson.lines) {
          const nodes = lineNodes(lesson, line.id, depthForRating(800));
          expect(nodes.some((n) => isStudentMove(lesson, n.ply)), line.id).toBe(true);
        }
      });

      it('has a plan, off-book advice and at least one trap and model game', () => {
        expect(lesson.character.length).toBeGreaterThan(50);
        expect(lesson.plan.pieces.length).toBeGreaterThanOrEqual(4);
        expect(lesson.offBook.length).toBeGreaterThanOrEqual(2);
        expect(lesson.traps.length).toBeGreaterThanOrEqual(1);
        expect(lesson.modelGames.length).toBeGreaterThanOrEqual(1);
      });

      it('traps and model games are legal, with comments on real moves', () => {
        for (const t of lesson.traps) {
          const c = new Chess();
          t.moves.forEach((m) => expect(() => c.move(m), `${t.id} ${m}`).not.toThrow());
          expect(t.mistakeAt).toBeLessThan(t.moves.length);
        }
        for (const g of lesson.modelGames) {
          const c = new Chess();
          g.moves.forEach((m) => expect(() => c.move(m), `${g.id} ${m}`).not.toThrow());
          for (const k of Object.keys(g.comments)) expect(Number(k)).toBeLessThan(g.moves.length);
          if (g.result === '1-0' && c.isCheckmate()) expect(c.turn()).toBe('b');
        }
      });
    });
  }

  it('catalog: every variation name exists in the official opening list', () => {
    const names = new Set(Object.values(ECO).map((v) => v[1]));
    for (const c of CATALOG) for (const v of c.variations) expect(names.has(v), v).toBe(true);
  });

  it('the learning path covers known openings, each once', () => {
    const ids = DEFAULT_PATH.flatMap((s) => s.openings);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(CATALOG.some((c) => c.id === id), id).toBe(true);
    expect(DEFAULT_PATH).toHaveLength(15);
  });
});
