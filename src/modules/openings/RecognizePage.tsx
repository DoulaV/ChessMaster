// Quiz: watch the moves, name the opening. Covers every opening, even locked ones.

import { Chess } from 'chess.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Board } from '../../chess/board/Board';
import { START_FEN, formatLine } from '../../chess/utils';
import { pgnForName } from '../../data/eco';
import { CATALOG, type CatalogEntry } from '../../data/openings/catalog';
import { recognizeSlot } from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { BoardLayout } from '../../ui/BoardLayout';
import { Button, Card, Progress } from '../../ui/kit';

const ROUND = 10;

interface Question {
  entry: CatalogEntry;
  variation: string;
  moves: string[];
  options: CatalogEntry[];
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

async function makeQuestion(previous?: string): Promise<Question> {
  let e = pick(CATALOG);
  while (e.id === previous) e = pick(CATALOG);
  const variation = pick(e.variations);
  const moves = (await pgnForName(variation)) ?? [];
  // Wrong answers: prefer openings from the same group, so the quiz is not too easy.
  const same = shuffle(CATALOG.filter((c) => c.id !== e.id && c.group === e.group));
  const others = shuffle(CATALOG.filter((c) => c.id !== e.id && c.group !== e.group));
  const options = shuffle([e, ...[...same, ...others].slice(0, 3)]);
  return { entry: e, variation, moves, options };
}

export function RecognizePage() {
  const [stats, setStats] = useSlot(recognizeSlot);
  const [q, setQ] = useState<Question | null>(null);
  const [shown, setShown] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);

  const next = async () => {
    const nq = await makeQuestion(q?.entry.id);
    setQ(nq);
    setShown(0);
    setAnswer(null);
  };
  useEffect(() => {
    next();
  }, []);

  // Play the moves one by one.
  useEffect(() => {
    if (!q || shown >= q.moves.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), shown === 0 ? 500 : 550);
    return () => clearTimeout(t);
  }, [q, shown]);

  if (!q) return null;
  const c = new Chess();
  let last: { from: string; to: string } | null = null;
  for (const m of q.moves.slice(0, shown)) {
    const mv = c.move(m);
    last = { from: mv.from, to: mv.to };
  }
  const done = n >= ROUND;

  function choose(id: string) {
    if (answer || !q) return;
    setAnswer(id);
    setShown(q.moves.length);
    const right = id === q.entry.id;
    if (right) setScore((s) => s + 1);
    setN((x) => x + 1);
    setStats((s) => {
      const [r, t] = s.byOpening[q.entry.id] ?? [0, 0];
      return {
        correct: s.correct + (right ? 1 : 0),
        total: s.total + 1,
        byOpening: { ...s.byOpening, [q.entry.id]: [r + (right ? 1 : 0), t + 1] },
      };
    });
  }

  return (
    <BoardLayout
      board={<Board fen={c.fen()} orientation={q.entry.side} movable="none" lastMove={last} />}
      panel={
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <Link to="/openings" className="text-sm text-cm-muted hover:text-white">← Library</Link>
              <span className="text-sm text-cm-faint">Question {Math.min(n + (answer ? 0 : 1), ROUND)} of {ROUND} · {score} right</span>
            </div>
            <Progress value={n / ROUND} />
          </Card>
          {done ? (
            <Card title="Round complete">
              <p className="mb-1 text-3xl font-extrabold">{score} / {ROUND}</p>
              <p className="mb-3 text-sm text-cm-muted">All-time: {stats.correct} of {stats.total} right.</p>
              <Button variant="primary" onClick={() => { setN(0); setScore(0); next(); }}>Play again</Button>
            </Card>
          ) : (
            <Card title="Which opening is this?">
              <p className="mb-3 min-h-6 font-mono text-sm text-cm-muted">{formatLine(START_FEN, q.moves.slice(0, shown))}</p>
              <div className="grid gap-2">
                {q.options.map((o) => {
                  const isRight = answer && o.id === q.entry.id;
                  const isWrong = answer === o.id && o.id !== q.entry.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => choose(o.id)}
                      disabled={!!answer}
                      className={`min-h-12 rounded-lg px-4 text-start font-bold ${isRight ? 'bg-cm-green text-white' : isWrong ? 'bg-cm-red text-white' : 'bg-cm-panel2 hover:bg-cm-hover'}`}
                    >
                      {o.name}
                    </button>
                  );
                })}
              </div>
              {answer && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm">
                    {answer === q.entry.id ? '✅ Right! ' : '❌ '}
                    This is the <b>{q.variation}</b> ({q.entry.eco}).
                  </p>
                  <Button variant="primary" className="w-full" onClick={next}>Next</Button>
                </div>
              )}
            </Card>
          )}
        </>
      }
    />
  );
}
