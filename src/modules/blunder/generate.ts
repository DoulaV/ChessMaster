// Builds Blunder Check exercises from realistic positions: every position
// that appears in the opening lessons, so they look like real games.

import { Chess, type Color, type Move, type Square } from 'chess.js';
import { hangingPieces, mateInOneThreats, undefendedPieces } from '../../chess/detectors';
import { PIECE_NAME, flipTurn, other } from '../../chess/utils';
import { buildTree } from '../../data/openings/build';
import { LESSONS } from '../../data/openings/catalog';
import type { OpeningNode } from '../../data/openings/types';

let pool: string[] | null = null;

/** Positions from all opening lessons, after the first few moves. */
export function positionPool(minPly = 8): string[] {
  if (pool) return pool;
  const seen = new Set<string>();
  const walk = (n: OpeningNode) => {
    if (n.ply >= minPly) seen.add(n.fen);
    n.children.forEach(walk);
  };
  for (const l of LESSONS) walk(buildTree(l));
  pool = [...seen];
  return pool;
}

export type Rng = () => number;
const pick = <T,>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];
function shuffled<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const name = (p: string) => PIECE_NAME[p as keyof typeof PIECE_NAME];

export interface ThreatQuestion {
  /** Position before the opponent's move. */
  beforeFen: string;
  /** Position to show: the student is to move. */
  fen: string;
  /** The opponent's move that created the threat. */
  move: Pick<Move, 'from' | 'to' | 'san'>;
  student: Color;
  /** Squares that count as a right answer. */
  answers: Square[];
  /** The capture or mate the opponent threatens next (SAN), for arrows. */
  threats: { from: Square; to: Square; san: string }[];
  explanation: string;
}

/** Squares of `victim`'s pieces (not pawns or king) attacked by the other side. */
function piecesAttacked(c: Chess, victim: Color): Square[] {
  const out: Square[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (p && p.color === victim && p.type !== 'p' && p.type !== 'k' && c.isAttacked(p.square, other(victim))) out.push(p.square);
    }
  }
  return out;
}

/** Threats in `fen` against `victim` worth at least `minGain` pawns, or a mate. */
function threatsAgainst(fen: string, victim: Color, minGain: number) {
  return {
    hanging: hangingPieces(fen, victim).filter((h) => h.loss >= minGain),
    mates: mateInOneThreats(fen, other(victim)),
  };
}

/**
 * A position right after the opponent made a move that threatens to win
 * material (a minor piece or more) or to mate.
 */
export function makeThreatQuestion(rng: Rng = Math.random, tries = 60): ThreatQuestion | null {
  const fens = positionPool();
  for (let t = 0; t < tries; t++) {
    const before = pick(fens, rng);
    const c = new Chess(before);
    const opp = c.turn();
    const student = other(opp);
    const already = threatsAgainst(before, student, 1);
    const alreadySquares = new Set(already.hanging.map((h) => h.square));
    const attackedBefore = new Set(piecesAttacked(c, student));
    for (const m of shuffled(c.moves({ verbose: true }), rng)) {
      if (m.captured) continue; // keep it about the new threat, not a trade
      c.move(m);
      const fen = c.fen();
      const inCheck = c.isCheck();
      // Cheap filter: the move must attack at least one more of the student's pieces.
      const newlyAttacked = piecesAttacked(c, student).some((sq) => !attackedBefore.has(sq));
      c.undo();
      if (inCheck || !newlyAttacked) continue;
      const now = threatsAgainst(fen, student, 3);
      // The moved piece must not simply be free to take (that would be a gift, not a threat).
      const movedHangs = hangingPieces(fen, opp).some((h) => h.square === m.to);
      if (movedHangs) continue;
      const fresh = now.hanging.filter((h) => !alreadySquares.has(h.square));
      if (now.mates.length && !already.mates.length) {
        const flipped = flipTurn(fen);
        if (!flipped) continue;
        const mc = new Chess(flipped);
        const mate = mc.move(now.mates[0]);
        const king = mc.board().flat().find((p) => p && p.type === 'k' && p.color === student)?.square;
        return {
          beforeFen: before,
          fen,
          move: { from: m.from, to: m.to, san: m.san },
          student,
          answers: [mate.to, ...(king ? [king] : [])],
          threats: [{ from: mate.from, to: mate.to, san: now.mates[0] }],
          explanation: `${m.san} threatens checkmate with ${now.mates[0]}. You must stop it before doing anything else.`,
        };
      }
      if (fresh.length) {
        const flipped = flipTurn(fen);
        if (!flipped) continue;
        const pc = new Chess(flipped);
        const threats = fresh.map((h) => {
          const mv = pc.move(h.capture);
          pc.undo();
          return { from: mv.from, to: mv.to, san: h.capture };
        });
        const parts = fresh.map((h) => `your ${name(h.piece)} on ${h.square}`).join(' and ');
        const attacker = name(m.piece);
        const how = fresh.length > 1 ? 'Two targets at once: that is a double attack.' : `If you ignore it, ${fresh[0].capture} wins material.`;
        return {
          beforeFen: before,
          fen,
          move: { from: m.from, to: m.to, san: m.san },
          student,
          answers: fresh.map((h) => h.square),
          threats,
          explanation: `Their ${attacker} move ${m.san} attacks ${parts}. ${how}`,
        };
      }
    }
  }
  return null;
}

export interface SafeCandidate {
  fen: string;
  uci: string;
  san: string;
  student: Color;
  /** What the detectors expect (the engine has the final say). */
  expected: 'safe' | 'blunder';
}

/**
 * A position and a candidate move for "Is it safe?". About half the time the
 * candidate drops material by the detectors; the engine verifies later.
 */
export function makeSafeCandidate(rng: Rng = Math.random, tries = 60): SafeCandidate | null {
  const fens = positionPool();
  const wantBlunder = rng() < 0.5;
  for (let t = 0; t < tries; t++) {
    const fen = pick(fens, rng);
    const c = new Chess(fen);
    const student = c.turn();
    const before = new Set(hangingPieces(fen, student).map((h) => h.square));
    for (const m of shuffled(c.moves({ verbose: true }), rng)) {
      c.move(m);
      const after = c.fen();
      const mate = c.isCheckmate();
      c.undo();
      if (mate) continue;
      const newHang = hangingPieces(after, student).filter((h) => h.loss >= 2 && !before.has(h.square === m.to ? m.from : h.square));
      const allowsMate = mateInOneThreats(after, other(student)).length > 0;
      const looksBad = newHang.length > 0 || allowsMate;
      if (looksBad === wantBlunder) {
        return { fen, uci: m.lan, san: m.san, student, expected: wantBlunder ? 'blunder' : 'safe' };
      }
    }
  }
  return null;
}

export interface HangingQuestion {
  fen: string;
  /** Unprotected pieces (not pawns or kings) for both sides. */
  answers: Square[];
}

export function makeHangingQuestion(rng: Rng = Math.random, tries = 100): HangingQuestion | null {
  const fens = positionPool(10);
  for (let t = 0; t < tries; t++) {
    const fen = pick(fens, rng);
    const c = new Chess(fen);
    const answers = (['w', 'b'] as Color[])
      .flatMap((col) => undefendedPieces(fen, col))
      .filter((sq) => c.get(sq)?.type !== 'p');
    if (answers.length >= 1 && answers.length <= 5) return { fen, answers };
  }
  return null;
}
