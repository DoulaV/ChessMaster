// The chessboard used everywhere. Supports dragging and tap-tap moving
// (tap a piece, then tap where it goes), legal-move dots, arrows,
// highlighted squares and a promotion picker.

import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { useMemo, useState, type CSSProperties } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { findKing } from '../utils';

export type { Arrow };

export const ARROW = {
  engine: 'rgba(37, 99, 235, 0.75)',
  engine2: 'rgba(37, 99, 235, 0.45)',
  engine3: 'rgba(37, 99, 235, 0.3)',
  threat: 'rgba(220, 38, 38, 0.8)',
  good: 'rgba(22, 163, 74, 0.8)',
  hint: 'rgba(234, 179, 8, 0.85)',
};

export const HIGHLIGHT = {
  danger: 'rgba(239, 68, 68, 0.55)',
  warn: 'rgba(250, 204, 21, 0.55)',
  good: 'rgba(34, 197, 94, 0.5)',
  info: 'rgba(59, 130, 246, 0.45)',
};

const THEMES = {
  green: { light: '#ebecd0', dark: '#779556' },
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
};

export interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /** Which side the user may move. */
  movable?: 'white' | 'black' | 'both' | 'none';
  /** Called with a UCI move. Return false to reject it. */
  onMove?: (uci: string) => boolean | void;
  /** Called when a square is tapped (for "click the threatened piece" exercises). */
  onSquareTap?: (square: Square) => void;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  highlights?: Record<string, string>;
  /** Let the user draw their own arrows with right-click. */
  drawArrows?: boolean;
}

const promoPieces: PieceSymbol[] = ['q', 'r', 'b', 'n'];

export function Board({
  fen,
  orientation = 'white',
  movable = 'both',
  onMove,
  onSquareTap,
  lastMove,
  arrows = [],
  highlights = {},
  drawArrows = true,
}: BoardProps) {
  const [settings] = useSlot(settingsSlot);
  const theme = THEMES[settings.boardTheme] ?? THEMES.green;
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const canMoveColor = (c: 'w' | 'b') =>
    movable === 'both' || (movable === 'white' && c === 'w') || (movable === 'black' && c === 'b');

  const targets = useMemo(() => {
    if (!chess || !selected) return [] as Square[];
    return chess.moves({ square: selected, verbose: true }).map((m) => m.to);
  }, [chess, selected]);

  function tryMove(from: Square, to: Square): boolean {
    if (!chess || !onMove) return false;
    const moves = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!moves.length) return false;
    if (moves.some((m) => m.promotion)) {
      setPromo({ from, to });
      return true;
    }
    setSelected(null);
    return onMove(`${from}${to}`) !== false;
  }

  function handleSquare(square: Square) {
    onSquareTap?.(square);
    if (!chess || movable === 'none') return;
    const piece = chess.get(square);
    if (selected && targets.includes(square)) {
      tryMove(selected, square);
      setSelected(null);
      return;
    }
    if (piece && piece.color === chess.turn() && canMoveColor(piece.color)) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { background: 'rgba(255, 255, 51, 0.4)' };
    squareStyles[lastMove.to] = { background: 'rgba(255, 255, 51, 0.4)' };
  }
  for (const [sq, color] of Object.entries(highlights)) {
    squareStyles[sq] = { background: color };
  }
  if (chess?.isCheck()) {
    const k = findKing(chess, chess.turn());
    if (k) squareStyles[k] = { background: 'radial-gradient(circle, rgba(239,68,68,0.9) 30%, transparent 75%)' };
  }
  if (selected) squareStyles[selected] = { background: 'rgba(20, 85, 30, 0.5)' };
  for (const t of targets) {
    const occupied = chess?.get(t);
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: occupied
        ? 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 60%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.22) 22%, transparent 24%)',
    };
  }

  const turnColor = chess?.turn() === 'b' ? 'b' : 'w';

  return (
    <div className="relative w-full select-none" style={{ touchAction: 'none' }}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareStyle: { backgroundColor: theme.dark },
          squareStyles,
          arrows,
          allowDrawingArrows: drawArrows,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: 150,
          allowDragging: movable !== 'none' && !!onMove,
          canDragPiece: ({ piece }) =>
            piece.pieceType[0] === turnColor && canMoveColor(turnColor),
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            setSelected(null);
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return tryMove(sourceSquare as Square, targetSquare as Square);
          },
          onSquareClick: ({ square }) => handleSquare(square as Square),
          onPieceDrag: ({ square }) => {
            if (square) setSelected(square as Square);
          },
        }}
      />
      {promo && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
          onClick={() => setPromo(null)}
        >
          <div className="flex gap-2 rounded-xl bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {promoPieces.map((p) => (
              <button
                key={p}
                className="flex h-16 w-16 items-center justify-center rounded-lg border text-4xl hover:bg-gray-100"
                onClick={() => {
                  const { from, to } = promo;
                  setPromo(null);
                  setSelected(null);
                  onMove?.(`${from}${to}${p}`);
                }}
                aria-label={`Promote to ${p}`}
              >
                {(turnColor === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' })[
                  p as 'q'
                ]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
