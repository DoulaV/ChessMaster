import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (const r of '87654321') for (const f of 'abcdefgh') out.push(`${f}${r}` as Square);
  return out;
})();

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? 'White' : 'Black');

export function turnOf(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Position part of a FEN without the move counters, for comparing positions. */
export function epd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function parseUci(uci: string) {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: (uci[4] as PieceSymbol | undefined) ?? undefined,
  };
}

export const moveToUci = (m: Pick<Move, 'from' | 'to' | 'promotion'>) =>
  `${m.from}${m.to}${m.promotion ?? ''}`;

/** Play a UCI move on a FEN. Returns null if illegal. */
export function playUci(fen: string, uci: string): { fen: string; move: Move } | null {
  const c = new Chess(fen);
  try {
    const move = c.move(parseUci(uci));
    return { fen: c.fen(), move };
  } catch {
    return null;
  }
}

/** Convert an engine line to SAN moves, stopping at the first illegal one. */
export function pvToSan(fen: string, pv: string[], max = 99): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, max)) {
    try {
      out.push(c.move(parseUci(uci)).san);
    } catch {
      break;
    }
  }
  return out;
}

/** "1. e4 e5 2. Nf3" style text for a list of SAN moves starting at a FEN. */
export function formatLine(fen: string, sans: string[]): string {
  const parts = fen.split(' ');
  let moveNo = Number(parts[5] ?? 1);
  let white = parts[1] === 'w';
  const out: string[] = [];
  sans.forEach((san, i) => {
    if (white) out.push(`${moveNo}. ${san}`);
    else out.push(i === 0 ? `${moveNo}... ${san}` : san);
    if (!white) moveNo++;
    white = !white;
  });
  return out.join(' ');
}

/** Same position with the other side to move (a "pass"). Null if that would be illegal. */
export function flipTurn(fen: string): string | null {
  const p = fen.split(' ');
  p[1] = p[1] === 'w' ? 'b' : 'w';
  p[3] = '-';
  const flipped = p.join(' ');
  try {
    const c = new Chess(flipped);
    // If the new side to move could capture the king, the side that "passed" was in check.
    const kingSq = findKing(c, other(c.turn()));
    if (kingSq && c.isAttacked(kingSq, c.turn())) return null;
    return flipped;
  } catch {
    return null;
  }
}

export function findKing(c: Chess, color: Color): Square | null {
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (p && p.type === 'k' && p.color === color) return sq;
  }
  return null;
}

export function materialBalance(fen: string): number {
  const c = new Chess(fen);
  let sum = 0;
  for (const sq of SQUARES) {
    const p = c.get(sq);
    if (p && p.type !== 'k') sum += (p.color === 'w' ? 1 : -1) * PIECE_VALUE[p.type];
  }
  return sum;
}

/** Win chance (0 to 1) for White from a centipawn score, the same curve Lichess uses. */
export function winChance(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}
