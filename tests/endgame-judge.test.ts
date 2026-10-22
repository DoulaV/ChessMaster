import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { judge } from '../src/modules/endgames/judge';

describe('endgame results', () => {
  it('a checkmate by the student is a success', () => {
    const c = new Chess('7k/8/6KQ/8/8/8/8/8 w - - 0 1');
    c.move('Qh7#');
    expect(judge(c, 'mate', 'w', 5, 25, 0)).toMatchObject({ ok: true });
  });

  it('stalemate is a failure when you need to mate', () => {
    const s = new Chess('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1');
    s.move('Qg6');
    expect(s.isStalemate()).toBe(true);
    expect(judge(s, 'mate', 'w', 5, 25, 0)).toMatchObject({ ok: false });
  });

  it('running out of moves fails a mate exercise', () => {
    const c = new Chess('8/8/8/4k3/8/8/8/4K2Q b - - 0 1');
    expect(judge(c, 'mate', 'w', 25, 25, 0)).toMatchObject({ ok: false });
  });

  it('promoting to a queen that survives is a success', () => {
    const c = new Chess('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    c.move('e8=Q');
    c.move('Ka1');
    expect(judge(c, 'promote', 'w', 2, 20, 1)).toMatchObject({ ok: true });
  });

  it('holding: losing to a new queen fails, surviving the moves succeeds', () => {
    const lost = new Chess('4K3/8/8/8/8/8/3p4/k7 b - - 0 1');
    lost.move('d1=Q');
    // White (the "student" defending here) can't take the queen.
    expect(judge(lost, 'hold', 'w', 3, 20, 0)).toMatchObject({ ok: false });
    const fine = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(judge(fine, 'hold', 'b', 20, 20, 0)?.ok).toBe(true);
  });
});
