import { Chess, type Color } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ARROW, Board, type Arrow } from '../../chess/board/Board';
import { LineViewer } from '../../chess/board/LineViewer';
import { formatLine, parseUci } from '../../chess/utils';
import { ENDGAMES, SQUARE_QUIZ, endgame, randomStart, type Endgame } from '../../data/endgames';
import { judge, pawnCount, type Outcome } from './judge';
import { getBackgroundEngine, getEngine } from '../../engine/engine';
import { ENDGAME_MASTERY, endgamesSlot } from '../../progress/endgames';
import { today } from '../../progress/srs';
import { update, useSlot } from '../../progress/store';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Badge, Button, Card, Progress, Segmented } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';

export function EndgamesPage() {
  const { id } = useParams();
  const eg = id ? endgame(id as Endgame['id']) : undefined;
  if (eg) return <EndgameView key={eg.id} eg={eg} />;
  return <EndgamesHome />;
}

function EndgamesHome() {
  const [stats] = useSlot(endgamesSlot);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold">Endgames</h1>
      <p className="text-cm-muted">The endings every player must know. Learn the technique, then practice against Stockfish until you win (or hold) {ENDGAME_MASTERY} times.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {ENDGAMES.map((e) => {
          const r = stats.byId[e.id];
          return (
            <Link key={e.id} to={`/endgames/${e.id}`} className="block rounded-lg bg-cm-panel p-3 hover:bg-cm-panel2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{e.icon} {e.title}</p>
                {r?.mastered ? <Badge tone="green">✓ Mastered</Badge> : r ? <Badge>{r.wins}/{ENDGAME_MASTERY}</Badge> : null}
              </div>
              <p className="text-sm text-cm-muted">{e.summary}</p>
              <Progress value={Math.min(1, (r?.wins ?? 0) / ENDGAME_MASTERY)} className="mt-2" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type Tab = 'learn' | 'practice' | 'defense' | 'quiz';

function EndgameView({ eg }: { eg: Endgame }) {
  const [tab, setTab] = useState<Tab>('learn');
  const [stats] = useSlot(endgamesSlot);
  const r = stats.byId[eg.id];
  const tabs: { value: Tab; label: string }[] = [
    { value: 'learn', label: '📖 Learn' },
    { value: 'practice', label: eg.goal === 'hold' ? '🛡️ Practice: hold' : '🎯 Practice: win' },
    ...(eg.defense ? [{ value: 'defense' as Tab, label: '🛡️ Practice: defend' }] : []),
    ...(eg.id === 'square-rule' ? [{ value: 'quiz' as Tab, label: '❓ Square quiz' }] : []),
  ];
  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2">
        <Link to="/endgames" className="text-cm-muted hover:text-white">← Endgames</Link>
        <h1 className="me-2 text-2xl font-extrabold">{eg.icon} {eg.title}</h1>
        {r?.mastered ? <Badge tone="green">✓ Mastered</Badge> : <Badge>{r?.wins ?? 0}/{ENDGAME_MASTERY} successes</Badge>}
      </div>
      <div className="mx-auto max-w-[1200px]">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>
      {tab === 'learn' && <LearnTab eg={eg} />}
      {tab === 'practice' && <Practice key="p" eg={eg} goal={eg.goal} student={eg.studentColor} positions={eg.positions} maxMoves={eg.maxMoves} points={eg.points} />}
      {tab === 'defense' && eg.defense && (
        <Practice key="d" eg={eg} goal="hold" student="b" positions={eg.defense.positions} maxMoves={eg.defense.maxMoves} points={eg.defense.points} />
      )}
      {tab === 'quiz' && <SquareQuiz />}
    </div>
  );
}

function LearnTab({ eg }: { eg: Endgame }) {
  const rules = (
    <Card title="The technique">
      <p className="mb-2 text-sm text-cm-muted">{eg.summary}</p>
      <ol className="list-decimal space-y-1.5 ps-5 text-sm">
        {eg.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
    </Card>
  );
  if (eg.demo) {
    return (
      <LineViewer
        moves={eg.demo.moves}
        comments={eg.demo.comments}
        startFen={eg.demo.fen}
        orientation={eg.studentColor === 'w' ? 'white' : 'black'}
        header={rules}
      />
    );
  }
  return (
    <BoardLayout
      board={<Board fen={eg.positions[0]} orientation={eg.studentColor === 'w' ? 'white' : 'black'} movable="none" />}
      panel={
        <>
          {rules}
          <p className="text-sm text-cm-muted">Ready? Open the Practice tab and try it against Stockfish.</p>
        </>
      }
    />
  );
}

function Practice({ eg, goal, student, positions, maxMoves, points }: {
  eg: Endgame;
  goal: Endgame['goal'];
  student: Color;
  positions: string[];
  maxMoves: number;
  points: string[];
}) {
  const navigate = useNavigate();
  const pick = () =>
    eg.id === 'kqk' || eg.id === 'krk' ? (Math.random() < 0.5 ? randomStart(eg.id) : positions[Math.floor(Math.random() * positions.length)]) : positions[Math.floor(Math.random() * positions.length)];
  const [startFen, setStartFen] = useState(pick);
  const [moves, setMoves] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const recorded = useRef(false);
  const run = useRef(0);

  const chess = useMemo(() => {
    const c = new Chess(startFen);
    for (const m of moves) c.move(m);
    return c;
  }, [startFen, moves]);
  const fen = chess.fen();
  const myMoves = moves.filter((_, i) => (new Chess(startFen).turn() === student ? i % 2 === 0 : i % 2 === 1)).length;
  const startPawns = useMemo(() => pawnCount(new Chess(startFen), student), [startFen, student]);

  // Check the result after every move.
  useEffect(() => {
    if (outcome) return;
    const o = judge(chess, goal, student, myMoves, maxMoves, startPawns);
    if (o) setOutcome(o);
  }, [chess]);

  // Save the result once.
  useEffect(() => {
    if (!outcome || recorded.current) return;
    recorded.current = true;
    update(endgamesSlot, (s) => {
      const r = s.byId[eg.id] ?? { attempts: 0, wins: 0, streak: 0, mastered: false };
      const wins = r.wins + (outcome.ok ? 1 : 0);
      const d = today();
      return {
        byId: { ...s.byId, [eg.id]: { attempts: r.attempts + 1, wins, streak: outcome.ok ? r.streak + 1 : 0, mastered: r.mastered || wins >= ENDGAME_MASTERY } },
        days: { ...s.days, [d]: (s.days[d] ?? 0) + 1 },
      };
    });
  }, [outcome]);

  // Stockfish defends (or attacks) with its best move.
  useEffect(() => {
    if (outcome || chess.turn() === student) return;
    const id = ++run.current;
    setThinking(true);
    getEngine()
      .analyseLatest(fen, { depth: 16, multipv: 1 })
      .then((l) => {
        if (id !== run.current) return;
        const uci = l[0]?.pv[0];
        setTimeout(() => {
          if (id !== run.current) return;
          setThinking(false);
          if (!uci) return;
          const san = new Chess(fen).move(parseUci(uci)).san;
          setMoves((m) => [...m, san]);
        }, 350);
      });
    return () => {
      run.current++;
    };
  }, [fen, outcome]);

  function onMove(uci: string) {
    if (outcome || thinking || chess.turn() !== student) return false;
    try {
      const san = new Chess(fen).move(parseUci(uci)).san;
      setHint(null);
      setMoves((m) => [...m, san]);
      return true;
    } catch {
      return false;
    }
  }

  async function showHint() {
    const l = await getBackgroundEngine().analyse(fen, { depth: 16, multipv: 1 });
    const uci = l[0]?.pv[0];
    if (uci) setHint({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  }

  const restart = (newPos: boolean) => {
    run.current++;
    recorded.current = false;
    setThinking(false);
    setOutcome(null);
    setHint(null);
    setMoves([]);
    if (newPos) setStartFen(pick());
  };

  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  const arrows: Arrow[] = hint ? [{ startSquare: hint.from, endSquare: hint.to, color: ARROW.hint }] : [];
  const orientation = student === 'w' ? 'white' : 'black';
  const goalText = goal === 'mate' ? `Checkmate within ${maxMoves} moves.` : goal === 'promote' ? 'Make a queen and keep it.' : `Hold the draw for ${maxMoves} moves.`;

  return (
    <BoardLayout
      above={<PlayerBar name="Stockfish" icon="🐟" detail={thinking ? 'thinking…' : ''} />}
      board={<Board fen={fen} orientation={orientation} movable={!outcome && !thinking && chess.turn() === student ? orientation : 'none'} onMove={onMove} lastMove={last ? { from: last.from, to: last.to } : null} arrows={arrows} />}
      below={<PlayerBar name="You" icon="🙂" detail={`${orientation}`} right={<span className="text-sm text-cm-muted">move {myMoves}/{maxMoves}</span>} />}
      panel={
        <>
          <Card>
            <p className="text-lg font-bold">Goal: {goalText}</p>
            {outcome ? (
              <>
                <p className={`mt-2 text-lg font-bold ${outcome.ok ? 'text-cm-green-light' : 'text-red-400'}`}>{outcome.ok ? '✓ ' : '✗ '}{outcome.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => restart(true)}>New position</Button>
                  <Button onClick={() => restart(false)}>Try this one again</Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(analysisPath({ fen: startFen, orientation }))}>🔬 Analysis</Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-cm-muted">{thinking ? 'Stockfish is answering…' : 'Your move. Stockfish plays the best defense.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={showHint} disabled={thinking}>💡 Hint</Button>
                  <Button size="sm" variant="ghost" onClick={() => restart(false)}>↺ Restart</Button>
                </div>
              </>
            )}
          </Card>
          <Card title="Remember">
            <ul className="space-y-1 text-sm">
              {points.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </Card>
          {moves.length > 0 && (
            <Card title="Moves">
              <p className="font-mono text-sm">{formatLine(startFen, moves)}</p>
            </Card>
          )}
        </>
      }
    />
  );
}

function SquareQuiz() {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  const q = SQUARE_QUIZ[i];
  if (!q) {
    return (
      <div className="mx-auto max-w-md">
        <Card title="Quiz complete">
          <p className="text-4xl font-extrabold">{right} / {SQUARE_QUIZ.length}</p>
          <Button className="mt-3" variant="primary" onClick={() => { setI(0); setRight(0); setAnswer(null); }}>Again</Button>
        </Card>
      </div>
    );
  }
  return (
    <BoardLayout
      board={<Board fen={q.fen} orientation="white" movable="none" />}
      panel={
        <Card>
          <p className="mb-1 text-sm text-cm-faint">Question {i + 1} of {SQUARE_QUIZ.length}</p>
          <p className="mb-3 text-lg font-bold">{q.question}</p>
          {answer === null ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant="primary" onClick={() => { setAnswer(true); if (q.answer) setRight((r) => r + 1); }}>Yes</Button>
              <Button size="lg" onClick={() => { setAnswer(false); if (!q.answer) setRight((r) => r + 1); }}>No</Button>
            </div>
          ) : (
            <>
              <p className={`font-bold ${answer === q.answer ? 'text-cm-green-light' : 'text-red-400'}`}>{answer === q.answer ? '✓ Right!' : '✗ Not quite'}</p>
              <p className="mb-3 text-sm">{q.explanation}</p>
              <Button variant="primary" onClick={() => { setI(i + 1); setAnswer(null); }}>Next</Button>
            </>
          )}
        </Card>
      }
    />
  );
}
