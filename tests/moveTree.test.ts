import { describe, expect, it } from 'vitest';
import { ROOT, addMove, createTree, deleteNode, lineEnd, parsePgn, pathTo, promote, toPgn } from '../src/chess/moveTree';

describe('move tree', () => {
  it('adds moves, reuses existing ones, rejects illegal ones', () => {
    let t = createTree();
    const a = addMove(t, ROOT, 'e4')!;
    t = a.tree;
    const again = addMove(t, ROOT, 'e2e4')!;
    expect(again.id).toBe(a.id);
    expect(addMove(t, a.id, 'e4')).toBeNull();
    const b = addMove(t, a.id, 'e5')!;
    expect(pathTo(b.tree, b.id)).toEqual([ROOT, a.id, b.id]);
  });

  it('round-trips PGN with variations and comments', () => {
    const pgn = '1. e4 e5 (1... c5 2. Nf3 (2. c3) d6) 2. Nf3 { Develops } Nc6 3. Bc4 *';
    const { tree } = parsePgn(pgn);
    const main = lineEnd(tree, ROOT);
    expect(tree.nodes[main].san).toBe('Bc4');
    const out = toPgn(tree);
    expect(out).toContain('1. e4 e5 (1... c5 2. Nf3 (2. c3) 2... d6) 2. Nf3 { Develops } 2... Nc6 3. Bc4');
    const again = parsePgn(out).tree;
    expect(Object.keys(again.nodes).length).toBe(Object.keys(tree.nodes).length);
  });

  it('reads headers, a FEN start and move numbers glued to moves', () => {
    const pgn = `[White "Me"]\n[Black "Bot"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1.e4 Kd7 2.Kd2 1-0`;
    const { tree, headers } = parsePgn(pgn);
    expect(headers.White).toBe('Me');
    expect(tree.nodes[lineEnd(tree, ROOT)].san).toBe('Kd2');
  });

  it('throws on illegal PGN moves', () => {
    expect(() => parsePgn('1. e4 e4')).toThrow();
  });

  it('promotes and deletes variations', () => {
    const { tree } = parsePgn('1. e4 (1. d4 d5) e5');
    const d4 = tree.nodes[ROOT].children[1];
    const p = promote(tree, d4);
    expect(p.nodes[ROOT].children[0]).toBe(d4);
    const del = deleteNode(p, d4);
    expect(Object.values(del.nodes).some((n) => n.san === 'd5')).toBe(false);
  });
});
