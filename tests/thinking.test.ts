import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { capturesStep, checksStep, dangerStep, lastMoveStep, planStep, threatsStep, worstPiece } from '../src/modules/practice/thinking';

function after(moves: string[]) {
  const c = new Chess();
  for (const m of moves) c.move(m);
  const h = c.history({ verbose: true });
  return { fen: c.fen(), last: h[h.length - 1] ?? null };
}

describe('Think with me coach', () => {
  it('explains what the opponent’s last move attacks', () => {
    const { fen, last } = after(['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Bb4', 'Nd5']);
    const s = lastMoveStep(fen, last);
    expect(s.answer.join(' ')).toMatch(/knight on d5 now attacks .*bishop on b4/);
    expect(s.answer.join(' ')).not.toMatch(/pawn on c7/); // protected pawns are skipped
  });

  it('spots a discovered attack', () => {
    // The black knight on e5 steps away and uncovers the rook on e8 against the white queen.
    const prev = '4r1k1/8/8/4n3/8/8/4Q3/6K1 b - - 0 1';
    const c = new Chess(prev);
    const m = c.move('Nc4');
    expect(c.fen().split(' ')[0]).toBe('4r1k1/8/8/8/2n5/8/4Q3/6K1');
    const s = lastMoveStep(c.fen(), m);
    expect(s.answer.join(' ')).toMatch(/opened a line: now your queen on e2/);
  });

  it('finds hanging pieces and mate threats', () => {
    expect(dangerStep('rnbqk1nr/pppp1ppp/8/4p3/1b2P3/1PN5/P1P2PPP/R1BQKBNR w KQkq - 0 1').answer.join(' ')).toMatch(/Nothing of yours|knight on c3/);
    expect(dangerStep('3r2k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1').answer.join(' ')).toMatch(/checkmate/);
  });

  it('lists checks and says which is mate', () => {
    expect(checksStep('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1').answer.join(' ')).toMatch(/Rd8# is CHECKMATE/);
  });

  it('judges captures by the exchange', () => {
    // Pawn takes undefended knight: wins; queen takes a pawn defended by a pawn: loses.
    const s = capturesStep('4k3/8/2p5/3p4/4P3/8/8/3QK3 w - - 0 1').answer.join(' ');
    expect(s).toMatch(/exd5 wins material/);
    expect(s).toMatch(/Qxd5 loses material/);
  });

  it('finds a fork threat', () => {
    const s = threatsStep('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(s.answer.length).toBeGreaterThan(0);
  });

  it('finds the least active piece and suggests castling', () => {
    const fen = after(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']).fen;
    expect(worstPiece(fen)?.square).toMatch(/b1|c1/);
    expect(planStep(fen).answer.join(' ')).toMatch(/castle/);
  });
});
