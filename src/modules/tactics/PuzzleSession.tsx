// Solve a list of puzzles one by one. Works for Lichess puzzles (the
// opponent plays the first move, then you find the rest) and for your own
// puzzles from your games (find the move you missed).

import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ARROW, Board, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { MISTAKE_LABEL } from '../../chess/explain';
import { treeFromSans } from '../../chess/moveTree';
import { parseUci, pvToSan } from '../../chess/utils';
import { gradePuzzle } from '../../progress/puzzles';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { newRating, recordPuzzle, startRating, tacticsSlot } from '../../progress/tactics';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Badge, Button, Card, Progress } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';
import { themeInfo, type PuzzleItem } from './puzzles';

type Phase = 'intro' | 'solving' | 'opponent' | 'solved' | 'failed';

export interface SessionResult {
  solved: number;
  total: number;
}

export function PuzzleSession({ items, title, onDone }: { items: PuzzleItem[]; title: string; onDone: (r: SessionResult) => void }) {
  const [settings] = useSlot(settingsSlot);
  const [stats] = useSlot(tacticsSlot);
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  /** Number of moves of the puzzle line already on the board. */
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const graded = useRef(false);

  const item = items[i];
  // A uniform view: start position, and the full UCI line (opponent's setup move first for Lichess).
  const view = useMemo(() => {
    if (!item) return null;
    if (item.kind === 'lichess') return { fen: item.fen, line: item.moves, setupMoves: 1 };
    return { fen: item.puzzle.fen, line: [item.puzzle.solution], setupMoves: 0 };
  }, [item]);

  const positions = useMemo(() => {
    if (!view) return [];
    const c = new Chess(view.fen);
    const out = [{ fen: c.fen(), last: null as null | { from: string; to: string } }];
    for (const u of view.line) {
      try {
        const m = c.move(parseUci(u));
        out.push({ fen: c.fen(), last: { from: m.from, to: m.to } });
      } catch {
        break;
      }
    }
    return out;
  }, [view]);

  const solver = view ? new Chess(positions[view.setupMoves]?.fen ?? view.fen).turn() : 'w';
  const orientation = solver === 'w' ? 'white' : 'black';

  // Start each puzzle: play the opponent's setup move after a short pause.
  useEffect(() => {
    if (!view) return;
    setStep(0);
    setWrong(null);
    setShowSolution(0);
    setRatingDelta(null);
    graded.current = false;
    if (view.setupMoves === 0) {
      setPhase('solving');
      return;
    }
    setPhase('intro');
    const t = setTimeout(() => {
      setStep(1);
      setPhase('solving');
    }, 700);
    return () => clearTimeout(t);
  }, [view]);

  // After a right move, the opponent answers automatically.
  useEffect(() => {
    if (phase !== 'opponent') return;
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      setPhase('solving');
    }, 450);
    return () => clearTimeout(t);
  }, [phase]);

  // Step through the solution after a miss.
  useEffect(() => {
    if (phase !== 'failed' || !showSolution || !view) return;
    if (step >= view.line.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 600);
    return () => clearTimeout(t);
  }, [phase, showSolution, step, view]);

  function grade(solved: boolean) {
    if (graded.current || !item) return;
    graded.current = true;
    if (item.kind === 'lichess') {
      const before = stats.rating || startRating(settings.rating);
      recordPuzzle(item.id, item.theme, item.rating, solved, startRating(settings.rating));
      setRatingDelta(newRating(before, item.rating, solved, stats.games) - before);
    } else {
      gradePuzzle(item.puzzle.id, solved ? 5 : 1);
    }
    if (solved) setSolvedCount((n) => n + 1);
  }

  function onMove(uci: string): boolean {
    if (phase !== 'solving' || !view) return false;
    const expected = view.line[step];
    const c = new Chess(positions[step].fen);
    let move;
    try {
      move = c.move(parseUci(uci));
    } catch {
      return false;
    }
    // Any checkmate counts, even if it's not the listed move.
    const ok = uci === expected || c.isCheckmate();
    if (!ok) {
      setWrong(move.to);
      grade(false);
      setPhase('failed');
      return false;
    }
    const nextStep = step + 1;
    if (c.isCheckmate() || nextStep >= view.line.length) {
      setStep(view.line.length);
      grade(true);
      setPhase('solved');
      return true;
    }
    setStep(nextStep);
    setPhase('opponent');
    return true;
  }

  if (!item || !view) {
    return null;
  }

  const pos = positions[Math.min(step, positions.length - 1)];
  const highlights: Record<string, string> = {};
  const arrows: Arrow[] = [];
  if (wrong && phase === 'failed' && !showSolution) {
    highlights[wrong] = HIGHLIGHT.danger;
    const exp = parseUci(view.line[step]);
    arrows.push({ startSquare: exp.from, endSquare: exp.to, color: ARROW.good });
  }
  const theme = item.kind === 'lichess' ? themeInfo(item.theme) : null;
  const done = phase === 'solved' || phase === 'failed';
  const isLast = i + 1 >= items.length;

  const next = () => {
    if (isLast) onDone({ solved: solvedCount, total: items.length });
    else setI((x) => x + 1);
  };

  return (
    <BoardLayout
      above={
        <Card className="mb-2">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold">{title}</span>
            <span className="text-cm-faint">{i + 1} of {items.length} · {solvedCount} solved</span>
          </div>
          <Progress value={i / items.length} />
        </Card>
      }
      board={
        <Board
          fen={pos.fen}
          orientation={orientation}
          movable={phase === 'solving' ? orientation : 'none'}
          onMove={onMove}
          lastMove={pos.last}
          highlights={highlights}
          arrows={arrows}
        />
      }
      below={<PlayerBar name="You" icon="🙂" detail={`${orientation} to move`} />}
      panel={
        <>
          <Card>
            {item.kind === 'lichess' ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="green">{theme?.icon} {theme?.name}</Badge>
                {done && <Badge>Puzzle rating {item.rating}</Badge>}
              </div>
            ) : (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="yellow">⭐ From your game</Badge>
                <Badge>{MISTAKE_LABEL[item.puzzle.tag]}</Badge>
              </div>
            )}
            {phase === 'intro' && <p className="text-lg font-bold">Watch your opponent’s move…</p>}
            {(phase === 'solving' || phase === 'opponent') && (
              <>
                <p className="text-lg font-bold">{orientation === 'white' ? 'White' : 'Black'} to move: find the best move.</p>
                {item.kind === 'personal' && (
                  <p className="text-sm text-cm-muted">In {item.puzzle.sourceLabel.toLowerCase()} you played {item.puzzle.played} here. Find the better move.</p>
                )}
                {item.kind === 'lichess' && theme && <p className="text-sm text-cm-muted">{theme.text}</p>}
              </>
            )}
            {phase === 'solved' && (
              <p className="text-lg font-bold text-cm-green-light">
                ✓ Solved!{ratingDelta !== null && <span className="ms-2 text-sm text-white">rating {ratingDelta >= 0 ? '+' : ''}{ratingDelta}</span>}
              </p>
            )}
            {phase === 'failed' && (
              <>
                <p className="text-lg font-bold text-red-400">
                  ✗ Not this one{ratingDelta !== null && <span className="ms-2 text-sm text-white">rating {ratingDelta}</span>}
                </p>
                <p className="text-sm text-cm-muted">
                  The green arrow shows the right move: {pvToSan(positions[Math.max(0, view.setupMoves)].fen, view.line.slice(view.setupMoves)).join(' ')}.
                </p>
              </>
            )}
            {done && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" onClick={next}>{isLast ? 'Finish' : 'Next puzzle'}</Button>
                {phase === 'failed' && !showSolution && (
                  <Button onClick={() => { setShowSolution(1); setStep(view.setupMoves); setWrong(null); }}>▶ Play the solution</Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const sans = pvToSan(view.fen, view.line);
                    const { tree, last } = treeFromSans(sans.slice(0, view.setupMoves), view.fen);
                    navigate(analysisPath({ tree, current: last, orientation }));
                  }}
                >
                  🔬 Analysis
                </Button>
              </div>
            )}
          </Card>
        </>
      }
    />
  );
}
