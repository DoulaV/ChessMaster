import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { hangingPieces, mateInOneThreats, undefendedPieces } from '../src/chess/detectors';
import { flipTurn } from '../src/chess/utils';
import blunderBank from '../src/data/blunder.json';
import type { BlunderBank } from '../src/modules/blunder/bank';
import { makeHangingQuestion, makeSafeCandidate, makeThreatQuestion, positionPool } from '../src/modules/blunder/generate';

// Small seeded random generator so the tests are repeatable.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('blunder check exercises', () => {
  it('has a big pool of real positions', () => {
    expect(positionPool().length).toBeGreaterThan(500);
  });

  it('threat questions: the student is to move and the answer pieces really are threatened', () => {
    const r = rng(1);
    let made = 0;
    for (let i = 0; i < 6; i++) {
      const q = makeThreatQuestion(r);
      if (!q) continue;
      made++;
      const c = new Chess(q.fen);
      expect(c.turn()).toBe(q.student);
      expect(q.answers.length).toBeGreaterThan(0);
      const hang = hangingPieces(q.fen, q.student).map((h) => h.square);
      const mates = mateInOneThreats(q.fen, c.turn() === 'w' ? 'b' : 'w');
      expect(q.answers.some((a) => hang.includes(a)) || mates.length > 0).toBe(true);
      // The threats are legal moves for the opponent if they could move again.
      const f = new Chess(flipTurn(q.fen)!);
      for (const t of q.threats) expect(() => f.move(t.san)).not.toThrow();
      expect(q.explanation).toMatch(/threatens|attacks/);
    }
    expect(made).toBeGreaterThan(3);
  }, 60000);

  it('safe candidates are legal moves for the side to move', () => {
    const r = rng(2);
    for (let i = 0; i < 8; i++) {
      const q = makeSafeCandidate(r);
      expect(q).not.toBeNull();
      const c = new Chess(q!.fen);
      expect(c.turn()).toBe(q!.student);
      expect(() => c.move(q!.san)).not.toThrow();
    }
  }, 60000);

  it('hanging-piece questions list exactly the unprotected pieces', () => {
    const r = rng(3);
    for (let i = 0; i < 20; i++) {
      const q = makeHangingQuestion(r)!;
      const c = new Chess(q.fen);
      const expected = [...undefendedPieces(q.fen, 'w'), ...undefendedPieces(q.fen, 'b')].filter((s) => c.get(s)?.type !== 'p');
      expect(q.answers.sort()).toEqual(expected.sort());
    }
  });
});

const bank = blunderBank as unknown as BlunderBank;

// Skipped only while the bank is being rebuilt (it is empty then).
describe.skipIf(bank.safe.length === 0)('the pre-built exercise bank', () => {

  it('has enough exercises of each kind', () => {
    expect(bank.threats.length).toBeGreaterThanOrEqual(200);
    expect(bank.safe.length).toBeGreaterThanOrEqual(200);
    expect(bank.hanging.length).toBeGreaterThanOrEqual(200);
    const blunders = bank.safe.filter((s) => s.verdict === 'blunder').length;
    expect(blunders / bank.safe.length).toBeGreaterThan(0.3);
    expect(blunders / bank.safe.length).toBeLessThan(0.7);
  });

  it('threat answers are the student’s own pieces or squares, and the threats are legal', () => {
    for (const q of bank.threats) {
      const c = new Chess(q.fen);
      const flipped = new Chess(flipTurn(q.fen)!);
      expect(q.answers.length).toBeGreaterThan(0);
      for (const [, , san] of q.threats) expect(() => flipped.move(san)).not.toThrow();
      const own = q.answers.filter((a) => c.get(a)?.color === c.turn());
      expect(own.length).toBeGreaterThan(0);
    }
  });

  it('safe/blunder verdicts match the engine loss, and moves are legal', () => {
    for (const q of bank.safe) {
      expect(() => new Chess(q.fen).move(q.san)).not.toThrow();
      if (q.verdict === 'safe') expect(q.loss).toBeLessThanOrEqual(60);
      else expect(q.loss).toBeGreaterThanOrEqual(200);
      expect(q.text.join(' ')).not.toMatch(/—/);
    }
  });

  it('no position repeats within a section', () => {
    for (const list of [bank.threats, bank.hanging]) {
      expect(new Set(list.map((q) => q.fen)).size).toBe(list.length);
    }
  });
});
