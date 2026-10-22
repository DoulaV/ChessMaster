// Play opening moves from memory. The app plays the opponent's moves; you
// play yours. A wrong move shows the right one and its reason, and the
// spaced-repetition card for that move comes back sooner.

import { Chess } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board, ARROW, HIGHLIGHT } from '../../chess/board/Board';
import { START_FEN, parseUci } from '../../chess/utils';
import { buildTree, isStudentMove, lineNodes } from '../../data/openings/build';
import { lesson as lessonById } from '../../data/openings/catalog';
import type { OpeningLesson, OpeningNode } from '../../data/openings/types';
import { gradeCard } from '../../progress/openings';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Button, Card, Progress } from '../../ui/kit';

export interface DrillItem {
  lessonId: string;
  lineId: string;
  /** Only ask moves at or after this ply (earlier ones are played for you). */
  askFrom: number;
  /** Stop after this ply. */
  endPly: number;
}

export interface DrillResult {
  asked: number;
  correct: number;
  mistakes: { lessonId: string; lineName: string; node: OpeningNode; played: string }[];
}

type Phase = 'auto' | 'yours' | 'wrong' | 'right' | 'line-done' | 'finished';

export function DrillSession({ items, title, onFinish, onExit }: {
  items: DrillItem[];
  title: string;
  onFinish: (r: DrillResult) => void;
  onExit: () => void;
}) {
  const [itemIdx, setItemIdx] = useState(0);
  const [ply, setPly] = useState(0); // moves played in the current line
  const [phase, setPhase] = useState<Phase>('auto');
  const [feedback, setFeedback] = useState<{ text: string; played?: string } | null>(null);
  const [result, setResult] = useState<DrillResult>({ asked: 0, correct: 0, mistakes: [] });
  const [wrongSquare, setWrongSquare] = useState<string | null>(null);
  // Moves already answered correctly this session are played for you, so shared openings aren't repeated.
  const knownThisSession = useRef(new Set<string>());
  const missedThisNode = useRef(false);

  const item = items[itemIdx];
  const lesson: OpeningLesson | undefined = item ? lessonById(item.lessonId) : undefined;
  const nodes = useMemo(() => (lesson && item ? lineNodes(lesson, item.lineId, item.endPly) : []), [lesson, item]);
  const root = lesson ? buildTree(lesson) : null;
  const fen = ply === 0 ? (root?.fen ?? START_FEN) : nodes[ply - 1].fen;
  const next = nodes[ply];
  const line = lesson?.lines.find((l) => l.id === item?.lineId);
  const orientation = lesson?.side ?? 'white';

  const needsAnswer = useCallback(
    (n: OpeningNode | undefined) =>
      !!n && !!lesson && !!item && isStudentMove(lesson, n.ply) && n.ply >= item.askFrom && !knownThisSession.current.has(n.key),
    [lesson, item],
  );

  // Drive the line: play opponent moves (and already-known moves) automatically.
  useEffect(() => {
    if (!item || phase === 'finished' || phase === 'wrong' || phase === 'line-done') return;
    if (!next) {
      setPhase('line-done');
      return;
    }
    if (phase === 'right') {
      const t = setTimeout(() => setPhase('auto'), 700);
      return () => clearTimeout(t);
    }
    if (needsAnswer(next)) {
      setPhase('yours');
      return;
    }
    const delay = isStudentMove(lesson!, next.ply) ? 250 : ply < (item.askFrom ?? 0) - 1 ? 150 : 550;
    const t = setTimeout(() => setPly((p) => p + 1), delay);
    return () => clearTimeout(t);
  }, [item, next, phase, ply, needsAnswer, lesson]);

  // Move on to the next line, or finish.
  useEffect(() => {
    if (phase !== 'line-done') return;
    const t = setTimeout(() => {
      if (itemIdx + 1 < items.length) {
        setItemIdx((i) => i + 1);
        setPly(0);
        setFeedback(null);
        setPhase('auto');
      } else {
        setPhase('finished');
        onFinish(result);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [phase, itemIdx, items.length, onFinish, result]);

  function onMove(uci: string): boolean {
    if (!next || !lesson || !line) return false;
    const c = new Chess(fen);
    let played;
    try {
      played = c.move(parseUci(uci));
    } catch {
      return false;
    }
    if (played.san === next.san) {
      if (phase === 'yours') {
        // First try.
        gradeCard(lesson.id, next.key, missedThisNode.current ? 1 : 5);
        setResult((r) => ({ ...r, asked: r.asked + 1, correct: r.correct + (missedThisNode.current ? 0 : 1) }));
        knownThisSession.current.add(next.key);
        setFeedback({ text: next.why });
        setPhase('right');
      } else {
        // Replaying the right move after a mistake.
        setFeedback({ text: next.why });
        setPhase('right');
      }
      missedThisNode.current = false;
      setWrongSquare(null);
      setPly((p) => p + 1);
      return true;
    }
    if (phase !== 'yours') return false;
    // Wrong move.
    const parent = ply === 0 ? root! : nodes[ply - 1];
    const other = parent.children.find((ch) => ch.san === played.san);
    const otherLine = other ? lesson.lines.find((l) => other.lines.includes(l.id))?.name : null;
    gradeCard(lesson.id, next.key, 1);
    setResult((r) => ({
      ...r,
      asked: r.asked + 1,
      mistakes: [...r.mistakes, { lessonId: lesson.id, lineName: line.name, node: next, played: played.san }],
    }));
    missedThisNode.current = true;
    setWrongSquare(played.to);
    setFeedback({
      played: played.san,
      text: otherLine
        ? `${played.san} is the move in the “${otherLine}” line. In this line the move is ${next.san}: ${next.why}`
        : `The book move is ${next.san}. ${next.why}`,
    });
    setPhase('wrong');
    return false;
  }

  if (!item || !lesson || !line) return null;

  if (phase === 'finished') {
    const pct = result.asked ? result.correct / result.asked : 1;
    return (
      <Card title={`${title}: done`}>
        <p className="mb-2 text-3xl font-extrabold">{Math.round(pct * 100)}%</p>
        <p className="mb-3 text-sm text-cm-muted">
          {result.correct} of {result.asked} moves right on the first try.
        </p>
        {result.mistakes.length > 0 && (
          <div className="mb-3 space-y-1 text-sm">
            <p className="font-bold">To review:</p>
            {result.mistakes.map((m, i) => (
              <p key={i}>
                {m.lineName}: you played <span className="text-red-400">{m.played}</span>, the move is{' '}
                <b className="text-cm-green-light">{m.node.san}</b>.
              </p>
            ))}
          </div>
        )}
        <Button variant="primary" onClick={onExit}>Done</Button>
      </Card>
    );
  }

  const highlights: Record<string, string> = {};
  if (wrongSquare) highlights[wrongSquare] = HIGHLIGHT.danger;
  const arrows =
    phase === 'wrong' && next
      ? (() => {
          const m = new Chess(fen).move(next.san);
          return [{ startSquare: m.from, endSquare: m.to, color: ARROW.good }];
        })()
      : [];
  const lastNode = ply > 0 ? nodes[ply - 1] : null;
  const lastMove = lastNode
    ? (() => {
        const m = new Chess(ply > 1 ? nodes[ply - 2].fen : root!.fen).move(lastNode.san);
        return { from: m.from, to: m.to };
      })()
    : null;

  return (
    <BoardLayout
      above={<PlayerBar name="Opponent (book moves)" icon="📖" />}
      board={
        <Board
          fen={fen}
          orientation={orientation}
          movable={phase === 'yours' || phase === 'wrong' ? orientation : 'none'}
          onMove={onMove}
          highlights={highlights}
          arrows={arrows}
          lastMove={lastMove}
          drawArrows={false}
        />
      }
      below={<PlayerBar name="You" icon="🙂" detail={`playing ${orientation}`} />}
      panel={
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-bold">{title}</span>
              <span className="text-cm-faint">
                Line {itemIdx + 1} of {items.length}
              </span>
            </div>
            <Progress value={(itemIdx + (next ? ply / Math.max(1, nodes.length) : 1)) / items.length} />
            <p className="mt-3 text-sm text-cm-muted">{line.name}</p>
          </Card>
          <Card>
            {phase === 'yours' && (
              <p className="text-lg font-bold">Your move. What does the book play here?</p>
            )}
            {phase === 'auto' && <p className="text-cm-muted">Opponent is moving…</p>}
            {phase === 'right' && feedback && (
              <div>
                <p className="text-lg font-bold text-cm-green-light">✓ Correct</p>
                <p className="text-sm">{feedback.text}</p>
              </div>
            )}
            {phase === 'wrong' && feedback && (
              <div>
                <p className="text-lg font-bold text-red-400">✗ Not this time</p>
                <p className="mb-2 text-sm">{feedback.text}</p>
                <p className="text-sm text-cm-muted">Play the green arrow move to continue.</p>
              </div>
            )}
            {phase === 'line-done' && <p className="text-lg font-bold text-cm-green-light">Line complete!</p>}
          </Card>
          <Card>
            <p className="text-sm text-cm-muted">
              Score so far: <b className="text-white">{result.correct}</b> / {result.asked}
            </p>
            <Button className="mt-2" size="sm" variant="ghost" onClick={onExit}>
              Stop drill
            </Button>
          </Card>
        </>
      }
    />
  );
}
