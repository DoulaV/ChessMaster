// Step through a fixed list of moves with comments (traps, model games).

import { Chess } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { analysisPath } from '../../modules/analysis/handoff';
import { BoardLayout } from '../../ui/BoardLayout';
import { Button, Card } from '../../ui/kit';
import { treeFromSans } from '../moveTree';
import { START_FEN, formatLine } from '../utils';
import { Board, HIGHLIGHT } from './Board';

export function LineViewer({ moves, comments = {}, orientation, header, highlightIndex, initialIndex, extra }: {
  moves: string[];
  /** Comments keyed by move index. */
  comments?: Record<number, string>;
  orientation: 'white' | 'black';
  header?: React.ReactNode;
  /** Index of a move to mark (e.g. the mistake in a trap). */
  highlightIndex?: number;
  initialIndex?: number;
  extra?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const positions = useMemo(() => {
    const c = new Chess();
    const out = [{ fen: START_FEN, from: '', to: '' }];
    for (const m of moves) {
      const mv = c.move(m);
      out.push({ fen: c.fen(), from: mv.from, to: mv.to });
    }
    return out;
  }, [moves]);
  // `index` = number of moves played.
  const [index, setIndex] = useState(initialIndex ?? 0);
  useEffect(() => setIndex(initialIndex ?? 0), [moves, initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(moves.length, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const pos = positions[index];
  const comment = index > 0 ? comments[index - 1] : undefined;
  const highlights: Record<string, string> = {};
  if (highlightIndex !== undefined && index - 1 === highlightIndex) {
    highlights[pos.to] = HIGHLIGHT.danger;
  }

  return (
    <BoardLayout
      board={<Board fen={pos.fen} orientation={orientation} movable="none" lastMove={pos.from ? pos : null} highlights={highlights} />}
      below={
        <div className="mt-2 flex items-center gap-1">
          <Button aria-label="Start" onClick={() => setIndex(0)}>⏮</Button>
          <Button aria-label="Back" onClick={() => setIndex((i) => Math.max(0, i - 1))}>◀</Button>
          <Button variant="primary" className="flex-1" aria-label="Next move" onClick={() => setIndex((i) => Math.min(moves.length, i + 1))}>
            Next ▶
          </Button>
          <Button aria-label="End" onClick={() => setIndex(moves.length)}>⏭</Button>
        </div>
      }
      panel={
        <>
          {header}
          <Card>
            <p className="mb-2 text-sm text-cm-faint">Move {index} of {moves.length}</p>
            <p className="min-h-12 text-[15px]">{comment ?? (index === 0 ? 'Tap Next to step through the moves.' : '')}</p>
          </Card>
          <Card title="Moves">
            <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
              {moves.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i + 1)}
                  className={`rounded px-1 py-0.5 font-semibold ${i + 1 === index ? 'bg-cm-hover' : 'hover:bg-cm-panel2'} ${i === highlightIndex ? 'text-red-400' : ''}`}
                >
                  {i % 2 === 0 && <span className="me-0.5 font-normal text-cm-faint">{i / 2 + 1}.</span>}
                  {m}
                  {i === highlightIndex && '?'}
                </button>
              ))}
            </div>
            <p className="sr-only">{formatLine(START_FEN, moves)}</p>
          </Card>
          {extra}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const { tree, last } = treeFromSans(moves.slice(0, index));
              navigate(analysisPath({ tree, current: last, orientation }));
            }}
          >
            🔬 Open in Analysis
          </Button>
        </>
      }
    />
  );
}
