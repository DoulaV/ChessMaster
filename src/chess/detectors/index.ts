// Simple, explainable chess pattern detectors. They are not as strong as the
// engine, but they say *why* something is good or bad in words a beginner
// understands (a hanging piece, a fork, a pin, a mate threat).

import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUE, SQUARES, findKing, flipTurn, other } from '../utils';

export interface HangingPiece {
  square: Square;
  piece: PieceSymbol;
  color: Color;
  /** Material the opponent wins by capturing (in pawns). */
  loss: number;
  /** The capture that wins it, in SAN. */
  capture: string;
}

/**
 * How much the side to move wins by starting a capture sequence on `sq`,
 * each side always recapturing with its cheapest piece and stopping when
 * continuing would lose. 0 means capturing there doesn't win anything.
 */
export function exchangeGain(c: Chess, sq: Square, depth = 0): number {
  const target = c.get(sq);
  if (!target || depth > 10) return 0;
  const cheapest = bestCapture(c, sq);
  if (!cheapest) return 0;
  c.move({ from: cheapest.from, to: cheapest.to, promotion: cheapest.promotion ? 'q' : undefined });
  const value = PIECE_VALUE[target.type] - exchangeGain(c, sq, depth + 1);
  c.undo();
  return Math.max(0, value);
}

/** The capture that starts the best exchange on `sq` for the side to move. */
function bestCapture(c: Chess, sq: Square): Move | null {
  // Only generate moves for pieces that attack the square (much faster than all moves).
  const caps = c
    .attackers(sq, c.turn())
    .flatMap((from) => c.moves({ square: from, verbose: true }))
    .filter((m) => m.to === sq && !m.isEnPassant());
  if (!caps.length) return null;
  return caps.reduce((a, b) => (PIECE_VALUE[b.piece] < PIECE_VALUE[a.piece] ? b : a));
}

/** Position with `color` to move (passing if needed). Null if that's impossible. */
function withTurn(fen: string, color: Color): Chess | null {
  const c = new Chess(fen);
  if (c.turn() === color) return c;
  const f = flipTurn(fen);
  return f ? new Chess(f) : null;
}

/** Pieces of `color` that the opponent could win right now if it were their move. */
export function hangingPieces(fen: string, color: Color): HangingPiece[] {
  const c = withTurn(fen, other(color));
  if (!c) return [];
  const out: HangingPiece[] = [];
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (!p || p.color !== color || p.type === 'k') continue;
    if (!c.isAttacked(sq, c.turn())) continue;
    const loss = exchangeGain(c, sq);
    if (loss > 0) {
      const cap = bestCapture(c, sq);
      out.push({ square: sq, piece: p.type, color, loss, capture: cap?.san ?? '' });
    }
  }
  return out.sort((a, b) => b.loss - a.loss);
}

/** Pieces of `color` that no friendly piece protects (kings excluded). */
export function undefendedPieces(fen: string, color: Color): Square[] {
  const c = new Chess(fen);
  return SQUARES.filter((sq) => {
    const p = c.get(sq);
    return p && p.color === color && p.type !== 'k' && c.attackers(sq, color).length === 0;
  });
}

export interface Fork {
  /** Square of the forking piece. */
  from: Square;
  piece: PieceSymbol;
  targets: Square[];
}

/**
 * Pieces of `color` that attack two or more enemy targets worth going after:
 * the king, a more valuable piece, or a piece that isn't protected.
 */
export function findForks(fen: string, color: Color): Fork[] {
  const c = new Chess(fen);
  const forks: Fork[] = [];
  for (const from of SQUARES) {
    const p = c.get(from);
    if (!p || p.color !== color || p.type === 'k') continue;
    const targets = SQUARES.filter((sq) => {
      const t = c.get(sq);
      if (!t || t.color === color) return false;
      if (!c.attackers(sq, color).includes(from)) return false;
      if (t.type === 'k') return true;
      if (PIECE_VALUE[t.type] > PIECE_VALUE[p.type]) return true;
      return c.attackers(sq, other(color)).length === 0;
    });
    if (targets.length >= 2) forks.push({ from, piece: p.type, targets });
  }
  return forks;
}

export interface Pin {
  /** The piece doing the pinning. */
  by: Square;
  /** The piece that is stuck. */
  pinned: Square;
  /** What's behind it (the king or a more valuable piece). */
  behind: Square;
  absolute: boolean;
}

const DIRS: Record<'r' | 'b', [number, number][]> = {
  r: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  b: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

const sqAt = (f: number, r: number) =>
  f >= 0 && f < 8 && r >= 0 && r < 8 ? (`${'abcdefgh'[f]}${r + 1}` as Square) : null;

/** Pins made by `color`'s bishops, rooks and queens. */
export function findPins(fen: string, color: Color): Pin[] {
  const c = new Chess(fen);
  const pins: Pin[] = [];
  for (const by of SQUARES) {
    const p = c.get(by);
    if (!p || p.color !== color || !['b', 'r', 'q'].includes(p.type)) continue;
    const dirs = p.type === 'q' ? [...DIRS.r, ...DIRS.b] : DIRS[p.type as 'r' | 'b'];
    const f0 = by.charCodeAt(0) - 97;
    const r0 = Number(by[1]) - 1;
    for (const [df, dr] of dirs) {
      let first: Square | null = null;
      for (let i = 1; i < 8; i++) {
        const sq = sqAt(f0 + df * i, r0 + dr * i);
        if (!sq) break;
        const t = c.get(sq);
        if (!t) continue;
        if (t.color === color) break;
        if (!first) {
          first = sq;
          continue;
        }
        const pinnedPiece = c.get(first)!;
        if (t.type === 'k' || PIECE_VALUE[t.type] > PIECE_VALUE[pinnedPiece.type]) {
          pins.push({ by, pinned: first, behind: sq, absolute: t.type === 'k' });
        }
        break;
      }
    }
  }
  return pins;
}

/** Mating moves `color` would have if it were their turn. */
export function mateInOneThreats(fen: string, color: Color): string[] {
  const c = withTurn(fen, color);
  if (!c) return [];
  return c
    .moves({ verbose: true })
    .filter((m) => {
      c.move(m);
      const mate = c.isCheckmate();
      c.undo();
      return mate;
    })
    .map((m) => m.san);
}

export interface Threat {
  kind: 'mate' | 'win-material' | 'check';
  san: string;
  /** Square the threat lands on (for highlighting). */
  square: Square;
  gain?: number;
}

/** What `color` threatens to do next move: mates, free captures, checks. */
export function threatsBy(fen: string, color: Color): Threat[] {
  const c = withTurn(fen, color);
  if (!c) return [];
  const out: Threat[] = [];
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    if (c.isCheckmate()) out.push({ kind: 'mate', san: m.san, square: m.to });
    else if (c.isCheck()) out.push({ kind: 'check', san: m.san, square: m.to });
    c.undo();
  }
  for (const h of hangingPieces(c.fen(), other(color))) {
    out.push({ kind: 'win-material', san: h.capture, square: h.square, gain: h.loss });
  }
  const rank = { mate: 0, 'win-material': 1, check: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || (b.gain ?? 0) - (a.gain ?? 0));
}

/** Square of the side to move's king if it is in check, else null. */
export function checkedKing(fen: string): Square | null {
  const c = new Chess(fen);
  return c.isCheck() ? findKing(c, c.turn()) : null;
}
