import { describe, expect, it } from 'vitest';
import { classify, moveIdeas, moveProblems } from '../src/chess/explain';

describe('plain-language explanations', () => {
  it('explains a move that leaves a piece undefended', () => {
    // The knight on c3 is protected only by the queen on d2; Qe2 walks away and Bxc3 wins it.
    const fen = 'rnbqk1nr/pppp1ppp/8/4p3/1b2P3/1PN5/P1PQ1PPP/R1B1KBNR w KQkq - 0 1';
    const problems = moveProblems(fen, 'd2e2');
    expect(problems.join(' ')).toMatch(/knight on c3/);
    expect(problems.join(' ')).toMatch(/Bxc3/);
  });

  it('explains allowing a back-rank mate', () => {
    const fen = '3r2k1/5ppp/8/8/8/8/5PPP/1Q4K1 w - - 0 1';
    expect(moveProblems(fen, 'b1b7').join(' ')).toMatch(/checkmate.*Rd1#/);
  });

  it('praises a fork', () => {
    const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
    expect(moveIdeas(fen, 'b5c7').join(' ')).toMatch(/Fork/);
  });

  it('classifies by lost winning chances', () => {
    expect(classify(0.2, false)).toBe('blunder');
    expect(classify(0.12, false)).toBe('mistake');
    expect(classify(0.06, false)).toBe('inaccuracy');
    expect(classify(0.01, false)).toBe('good');
    expect(classify(0.3, true)).toBe('best');
  });
});
