// Set up any position: pick a piece, tap squares to place it.

import { Chess } from 'chess.js';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Button, Segmented } from '../../ui/kit';
import { START_FEN } from '../utils';

const PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const GLYPH: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

type Placement = Record<string, string>; // square -> "wK"

function fromFen(fen: string): Placement {
  const out: Placement = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, ri) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out[`${'abcdefgh'[f]}${8 - ri}`] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        f++;
      }
    }
  });
  return out;
}

function boardPart(p: Placement): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (const f of 'abcdefgh') {
      const pc = p[`${f}${r}`];
      if (!pc) empty++;
      else {
        if (empty) row += empty;
        empty = 0;
        row += pc[0] === 'w' ? pc[1] : pc[1].toLowerCase();
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

function castling(p: Placement): string {
  let s = '';
  if (p.e1 === 'wK' && p.h1 === 'wR') s += 'K';
  if (p.e1 === 'wK' && p.a1 === 'wR') s += 'Q';
  if (p.e8 === 'bK' && p.h8 === 'bR') s += 'k';
  if (p.e8 === 'bK' && p.a8 === 'bR') s += 'q';
  return s || '-';
}

export function validatePosition(fen: string): string | null {
  const board = fen.split(' ')[0];
  const wk = (board.match(/K/g) ?? []).length;
  const bk = (board.match(/k/g) ?? []).length;
  if (wk !== 1 || bk !== 1) return 'Each side needs exactly one king.';
  const ranks = board.split('/');
  if (/[pP]/.test(ranks[0]) || /[pP]/.test(ranks[7])) return 'Pawns cannot stand on the first or last row.';
  try {
    new Chess(fen);
    // The side NOT to move must not be in check.
    const flipped = fen.replace(/ [wb] /, (m) => (m === ' w ' ? ' b ' : ' w '));
    if (new Chess(flipped).isCheck()) return 'The side that is not moving is in check. Change who moves.';
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

export function PositionEditor({ initialFen, onDone, onCancel }: {
  initialFen: string;
  onDone: (fen: string) => void;
  onCancel: () => void;
}) {
  const [placement, setPlacement] = useState<Placement>(() => fromFen(initialFen));
  const [brush, setBrush] = useState<string>('wP');
  const [turn, setTurn] = useState<'w' | 'b'>(initialFen.split(' ')[1] === 'b' ? 'b' : 'w');
  const fen = `${boardPart(placement)} ${turn} ${castling(placement)} - 0 1`;
  const error = validatePosition(fen);

  const position: Record<string, { pieceType: string }> = {};
  for (const [sq, pc] of Object.entries(placement)) position[sq] = { pieceType: pc };

  return (
    <div className="space-y-3">
      <Chessboard
        options={{
          position,
          allowDragging: false,
          onSquareClick: ({ square }) =>
            setPlacement((p) => {
              const next = { ...p };
              if (brush === 'x' || next[square] === brush) delete next[square];
              else next[square] = brush;
              return next;
            }),
        }}
      />
      <p className="text-xs text-cm-faint">Pick a piece, then tap squares. Tap again to remove.</p>
      {(['w', 'b'] as const).map((c) => (
        <div key={c} className="flex flex-wrap gap-1">
          {PIECES.map((p) => (
            <button
              key={p}
              onClick={() => setBrush(c + p)}
              className={`h-11 w-11 rounded-lg border text-3xl leading-none ${brush === c + p ? 'border-cm-green bg-cm-green/30' : 'border-cm-line'}`}
              aria-label={`${c === 'w' ? 'White' : 'Black'} ${p}`}
            >
              {GLYPH[c + p]}
            </button>
          ))}
          {c === 'w' && (
            <button
              onClick={() => setBrush('x')}
              className={`h-11 rounded-lg border px-3 text-sm ${brush === 'x' ? 'border-cm-green bg-cm-green/30' : 'border-cm-line'}`}
            >
              Eraser
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={turn}
          onChange={setTurn}
          options={[
            { value: 'w', label: 'White to move' },
            { value: 'b', label: 'Black to move' },
          ]}
        />
        <Button size="sm" onClick={() => setPlacement(fromFen(START_FEN))}>Start position</Button>
        <Button size="sm" onClick={() => setPlacement({})}>Clear</Button>
      </div>
      <p className="font-mono text-xs break-all text-cm-faint">{fen}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={!!error} onClick={() => onDone(fen)}>
          Use this position
        </Button>
      </div>
    </div>
  );
}
