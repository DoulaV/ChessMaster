import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { mistakeTag, moveAccuracy } from '../src/chess/explain';
import { START_FEN } from '../src/chess/utils';
import { Engine, type UciTransport } from '../src/engine/engine';
import { bookMoves, bookMovesFor, pickBookMove } from '../src/modules/practice/book';
import { hintWords } from '../src/modules/practice/coach';
import { puzzlesFrom, reviewGame } from '../src/modules/practice/review';
import { shouldLevelUp, type PracticeGame } from '../src/progress/practice';

const require = createRequire(import.meta.url);
function nodeEngine() {
  let cb: (l: string) => void = () => {};
  const sf = require('stockfish')('lite-single', (l: string) => cb(l));
  const t: UciTransport = { send: (c) => sf.processCommand(c), onLine: (f) => (cb = f), terminate: () => sf.terminate() };
  return new Engine(t);
}

describe('opening book', () => {
  it('knows the main first moves and weights the main lines', () => {
    const first = bookMoves(START_FEN).map((m) => m.san).sort();
    expect(first).toEqual(expect.arrayContaining(['e4', 'd4', 'c4']));
    const italianOnly = bookMovesFor(START_FEN, 'italian').map((m) => m.san);
    expect(italianOnly).toEqual(['e4']);
    expect(pickBookMove(bookMoves(START_FEN), () => 0)).not.toBeNull();
  });
});

describe('coach and review helpers', () => {
  it('scores accuracy like Lichess: no loss = 100, big loss = low', () => {
    expect(Math.round(moveAccuracy(0.5, 0.5))).toBe(100);
    expect(moveAccuracy(0.6, 0.1)).toBeLessThan(15);
  });

  it('tags a hung piece and a missed mate', () => {
    // Qd2-e2 leaves the c3 knight to Bxc3.
    expect(mistakeTag('rnbqk1nr/pppp1ppp/8/4p3/1b2P3/1PN5/P1PQ1PPP/R1B1KBNR w KQkq - 0 1', 'd2e2', 'g1f3')).toBe('hung-piece');
    expect(mistakeTag('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'h2h3', 'd1d8')).toBe('missed-mate');
  });

  it('gives a mate hint in words', () => {
    expect(hintWords('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8')).toMatch(/checkmate/);
  });

  it('suggests a level-up after 3 wins in the last 5 games', () => {
    const g = (result: PracticeGame['result']) => ({ botRating: 800, result }) as PracticeGame;
    expect(shouldLevelUp([g('win'), g('loss'), g('win'), g('loss'), g('loss'), g('win')], 800)).toBe(false);
    expect(shouldLevelUp([g('win'), g('loss'), g('win'), g('win')], 800)).toBe(true);
  });
});

describe('game review with Stockfish', () => {
  it('finds the blunder in a Scholar’s Mate loss and turns it into a puzzle', async () => {
    const e = nodeEngine();
    const moves = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
    const r = await reviewGame(e, START_FEN, moves, 'b', undefined, 8);
    e.terminate();
    expect(r.moves).toHaveLength(7);
    const nf6 = r.moves[5];
    expect(nf6.quality).toBe('blunder');
    expect(r.topMistakes[0].move.san).toBe('Nf6');
    expect(r.topMistakes[0].tag).toBe('allowed-mate');
    expect(r.turningPoint?.move.san).toBe('Nf6');
    expect(r.accuracy.b!).toBeLessThan(r.accuracy.w!);
    const puzzles = puzzlesFrom(r, 'b', 'test');
    expect(puzzles[0].fen).toBe(nf6.fenBefore);
  }, 60000);
});
