import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { exchangeGain, findForks, findPins, hangingPieces, mateInOneThreats, threatsBy, undefendedPieces } from '../src/chess/detectors';

describe('detectors', () => {
  it('finds a piece left hanging', () => {
    // A black knight on e4, attacked by a pawn and not protected.
    const fen = 'rnbqkb1r/pppp1ppp/8/4p3/4n3/3P4/PPP2PPP/RNBQKBNR w KQkq - 0 4';
    const h = hangingPieces(fen, 'b');
    expect(h[0]).toMatchObject({ square: 'e4', piece: 'n', loss: 3, capture: 'dxe4' });
  });

  it('does not call a defended piece hanging when trading is even', () => {
    // The knight on f3 is pinned-ish by Bg4 but protected: Bxf3 Qxf3 is an even trade.
    const fen = 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4';
    expect(hangingPieces(fen, 'w').find((x) => x.square === 'f3')).toBeUndefined();
  });

  it('counts exchanges: queen defended by pawn is still lost to a pawn', () => {
    const c = new Chess('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    expect(exchangeGain(c, 'd5')).toBe(9);
  });

  it('respects pins: a pinned defender does not count', () => {
    // The c6 knight defends d4, but it is pinned to the king by the bishop on a4.
    const fen = '4k3/8/2n5/8/B2b4/8/8/3RK3 w - - 0 1';
    // Bishop d4 is attacked by the rook on d1 and "defended" by Nc6, which is pinned (Ba4 to Ke8).
    expect(hangingPieces(fen, 'b').map((h) => h.square)).toContain('d4');
  });

  it('lists undefended pieces', () => {
    const fen = '4k3/8/8/8/8/2N5/1P6/4K3 w - - 0 1';
    expect(undefendedPieces(fen, 'w')).toEqual(['b2']);
  });

  it('finds a knight fork of king and rook', () => {
    const fen = 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1';
    const f = findForks(fen, 'w');
    expect(f[0].targets.sort()).toEqual(['a8', 'e8'].sort());
  });

  it('finds a pin to the king', () => {
    const fen = '4k3/4n3/8/8/8/8/8/4RK2 w - - 0 1';
    expect(findPins(fen, 'w')[0]).toMatchObject({ by: 'e1', pinned: 'e7', behind: 'e8', absolute: true });
  });

  it('spots a back-rank mate threat', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1';
    expect(mateInOneThreats(fen, 'w')).toEqual(['Rd8#']);
    expect(threatsBy(fen, 'w')[0]).toMatchObject({ kind: 'mate', san: 'Rd8#' });
  });
});
