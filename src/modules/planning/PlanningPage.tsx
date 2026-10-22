import { Chess } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ARROW, Board, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { classify, formatScore, QUALITY_LABEL } from '../../chess/explain';
import { parseUci, pvToSan, winChance } from '../../chess/utils';
import { entry } from '../../data/openings/catalog';
import { PLAN_EXERCISES, PLANNING_LESSONS } from '../../data/planning/content';
import type { PlanExercise } from '../../data/planning/types';
import { getEngine, scoreToCp } from '../../engine/engine';
import { openingProgressSlot } from '../../progress/openings';
import { today } from '../../progress/srs';
import { update, useSlot, type Slot } from '../../progress/store';
import { BoardLayout } from '../../ui/BoardLayout';
import { Badge, Button, Card, Progress } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';
import { positionPool } from '../blunder/generate';

interface PlanningStats {
  quiz: { right: number; total: number };
  candidates: { rounds: number; foundBest: number };
  lessonsRead: string[];
  recentQuiz: string[];
  days: Record<string, { quiz: number; candidates: number }>;
}

export const planningSlot: Slot<PlanningStats> = {
  key: 'planning',
  version: 1,
  initial: () => ({ quiz: { right: 0, total: 0 }, candidates: { rounds: 0, foundBest: 0 }, lessonsRead: [], recentQuiz: [], days: {} }),
};

function bumpDay(s: PlanningStats, k: 'quiz' | 'candidates'): PlanningStats['days'] {
  const d = today();
  const day = s.days[d] ?? { quiz: 0, candidates: 0 };
  return { ...s.days, [d]: { ...day, [k]: day[k] + 1 } };
}

const toArrows = (pairs: [string, string][], color = ARROW.good): Arrow[] => pairs.map(([a, b]) => ({ startSquare: a, endSquare: b, color }));

export function PlanningPage() {
  const { mode, id } = useParams();
  if (mode === 'lesson' && id) return <LessonView id={id} />;
  if (mode === 'plan') return <PlanQuiz />;
  if (mode === 'candidates') return <CandidateMoves />;
  return <PlanningHome />;
}

function PlanningHome() {
  const [stats] = useSlot(planningSlot);
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-extrabold">Planning</h1>
      <p className="text-cm-muted">Stop thinking one move at a time. Learn what to aim for, then practice choosing plans and comparing options.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-lg font-bold">🗺️ What’s the plan?</p>
          <p className="mb-2 text-sm text-cm-muted">A position from your openings: pick the best plan out of 3 or 4, then learn why.</p>
          <p className="mb-3 text-xs text-cm-faint">{stats.quiz.total ? `${Math.round((stats.quiz.right / stats.quiz.total) * 100)}% right (${stats.quiz.total} done)` : 'Not tried yet'}</p>
          <Button variant="primary" onClick={() => navigate('/planning/plan')}>Start</Button>
        </Card>
        <Card>
          <p className="text-lg font-bold">🎯 Candidate moves</p>
          <p className="mb-2 text-sm text-cm-muted">Enter your top 3 moves before moving. Stockfish ranks them. Train yourself to think in options.</p>
          <p className="mb-3 text-xs text-cm-faint">{stats.candidates.rounds ? `Found the best move in ${stats.candidates.foundBest} of ${stats.candidates.rounds}` : 'Not tried yet'}</p>
          <Button variant="primary" onClick={() => navigate('/planning/candidates')}>Start</Button>
        </Card>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Lessons</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLANNING_LESSONS.map((l) => (
            <Link key={l.id} to={`/planning/lesson/${l.id}`} className="block rounded-lg bg-cm-panel p-3 hover:bg-cm-panel2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{l.icon} {l.title}</p>
                {stats.lessonsRead.includes(l.id) && <Badge tone="green">✓ Read</Badge>}
              </div>
              <p className="text-sm text-cm-muted">{l.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function LessonView({ id }: { id: string }) {
  const lesson = PLANNING_LESSONS.find((l) => l.id === id);
  const [ex, setEx] = useState(0);
  useEffect(() => {
    if (lesson) update(planningSlot, (s) => (s.lessonsRead.includes(lesson.id) ? s : { ...s, lessonsRead: [...s.lessonsRead, lesson.id] }));
  }, [lesson]);
  if (!lesson) return <p>Lesson not found. <Link className="underline" to="/planning">Back</Link></p>;
  const e = lesson.examples[ex];
  const highlights: Record<string, string> = {};
  for (const sq of e.highlight ?? []) highlights[sq] = HIGHLIGHT.info;
  const idx = PLANNING_LESSONS.indexOf(lesson);
  const nextLesson = PLANNING_LESSONS[idx + 1];
  return (
    <BoardLayout
      board={<Board fen={e.fen} orientation={e.orientation} movable="none" arrows={toArrows(e.arrows)} highlights={highlights} drawArrows={false} />}
      panel={
        <>
          <Card>
            <Link to="/planning" className="text-sm text-cm-muted hover:text-white">← Planning</Link>
            <h1 className="mt-1 text-2xl font-extrabold">{lesson.icon} {lesson.title}</h1>
            <p className="mt-1 text-cm-muted">{lesson.summary}</p>
          </Card>
          <Card title="The rules">
            <ul className="space-y-1.5 text-sm">
              {lesson.points.map((p) => (
                <li key={p}>✅ {p}</li>
              ))}
            </ul>
          </Card>
          <Card title={`Example ${ex + 1} of ${lesson.examples.length}: ${e.title}`}>
            <p className="text-[15px]">{e.text}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ex + 1 < lesson.examples.length ? (
                <Button variant="primary" onClick={() => setEx(ex + 1)}>Next example</Button>
              ) : nextLesson ? (
                <Link to={`/planning/lesson/${nextLesson.id}`} onClick={() => setEx(0)}><Button variant="primary">Next lesson: {nextLesson.title}</Button></Link>
              ) : (
                <Link to="/planning/plan"><Button variant="primary">Practice: What’s the plan?</Button></Link>
              )}
              {ex > 0 && <Button onClick={() => setEx(ex - 1)}>Previous</Button>}
            </div>
          </Card>
        </>
      }
    />
  );
}

const QUIZ_ROUND = 6;

function PlanQuiz() {
  const [stats] = useSlot(planningSlot);
  const [progress] = useSlot(openingProgressSlot);
  const navigate = useNavigate();
  const pickRound = () => {
    const studied = new Set(Object.entries(progress).filter(([, p]) => Object.keys(p.drillDays).length || p.learnedLines.length).map(([k]) => k));
    const recent = new Set(stats.recentQuiz);
    const score = (e: PlanExercise) => (studied.has(e.openingId) ? 0 : 1) + (recent.has(e.id) ? 2 : 0) + Math.random();
    return [...PLAN_EXERCISES].sort((a, b) => score(a) - score(b)).slice(0, QUIZ_ROUND);
  };
  const [items, setItems] = useState<PlanExercise[]>(pickRound);
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const q = items[i];
  // Shuffle the options once per question.
  const options = useMemo(() => (q ? q.options.map((o, k) => ({ ...o, k })).sort(() => Math.random() - 0.5) : []), [q]);

  if (!q) {
    return (
      <div className="mx-auto max-w-md">
        <Card title="Round complete">
          <p className="text-4xl font-extrabold">{right} / {items.length}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => { setItems(pickRound()); setI(0); setRight(0); setChoice(null); }}>Play again</Button>
            <Link to="/planning"><Button>Back</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  const choose = (k: number) => {
    if (choice !== null) return;
    setChoice(k);
    const ok = q.options[k].correct;
    if (ok) setRight((r) => r + 1);
    update(planningSlot, (s) => ({
      ...s,
      quiz: { right: s.quiz.right + (ok ? 1 : 0), total: s.quiz.total + 1 },
      recentQuiz: [q.id, ...s.recentQuiz].slice(0, 30),
      days: bumpDay(s, 'quiz'),
    }));
  };

  let arrows: Arrow[] = [];
  if (choice !== null && q.firstMove) {
    try {
      const m = new Chess(q.fen).move(q.firstMove);
      arrows = [{ startSquare: m.from, endSquare: m.to, color: ARROW.good }];
    } catch {
      /* ignore */
    }
  }

  return (
    <BoardLayout
      above={
        <Card className="mb-2">
          <div className="mb-2 flex items-center justify-between text-sm">
            <Link to="/planning" className="text-cm-muted hover:text-white">← Planning</Link>
            <span className="text-cm-faint">{i + 1} of {items.length} · {right} right</span>
          </div>
          <Progress value={i / items.length} />
        </Card>
      }
      board={<Board fen={q.fen} orientation={q.orientation} movable="none" arrows={arrows} drawArrows={false} />}
      panel={
        <Card>
          <Badge>{entry(q.openingId)?.name ?? q.openingId}</Badge>
          <p className="my-2 text-lg font-bold">{q.question}</p>
          <div className="grid gap-2">
            {options.map((o) => {
              const picked = choice === o.k;
              const cls = choice === null ? 'bg-cm-panel2 hover:bg-cm-hover' : o.correct ? 'bg-cm-green text-white' : picked ? 'bg-cm-red text-white' : 'bg-cm-panel2 opacity-60';
              return (
                <button key={o.k} onClick={() => choose(o.k)} disabled={choice !== null} className={`min-h-12 rounded-lg px-4 py-2 text-start font-semibold ${cls}`}>
                  {o.text}
                </button>
              );
            })}
          </div>
          {choice !== null && (
            <div className="mt-3 space-y-2">
              <p className={`font-bold ${q.options[choice].correct ? 'text-cm-green-light' : 'text-red-400'}`}>{q.options[choice].correct ? '✓ Right plan!' : '✗ Not the best plan'}</p>
              <p className="text-[15px]">{q.explanation}</p>
              {q.firstMove && <p className="text-sm text-cm-muted">A good first step: <b className="text-white">{q.firstMove}</b> (green arrow).</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => { setI(i + 1); setChoice(null); }}>Next</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(analysisPath({ fen: q.fen, orientation: q.orientation }))}>🔬 Analysis</Button>
              </div>
            </div>
          )}
        </Card>
      }
    />
  );
}

interface Ranked {
  uci: string;
  san: string;
  /** Score for the side to move (centipawns). */
  cp: number;
  loss: number;
  quality: ReturnType<typeof classify>;
}

function CandidateMoves() {
  const navigate = useNavigate();
  const pick = () => {
    const pool = [...positionPool(10), ...PLAN_EXERCISES.map((e) => e.fen)];
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const [fen, setFen] = useState(pick);
  const [cands, setCands] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ranked: Ranked[]; best: Ranked; foundBest: boolean } | null>(null);
  const turn = new Chess(fen).turn();
  const orientation = turn === 'w' ? 'white' : 'black';

  const add = (uci: string) => {
    if (result || cands.includes(uci) || cands.length >= 3) return false;
    setCands([...cands, uci]);
    return false; // keep the board on the original position
  };

  async function rank() {
    setBusy(true);
    const engine = getEngine();
    const top = await engine.analyse(fen, { depth: 14, multipv: 5 });
    const sideCp = (cp: number) => (turn === 'w' ? cp : -cp);
    const bestLine = top[0];
    const bestCp = sideCp(scoreToCp(bestLine.score));
    const evalMove = async (uci: string): Promise<number> => {
      const inTop = top.find((l) => l.pv[0] === uci);
      if (inTop) return sideCp(scoreToCp(inTop.score));
      const c = new Chess(fen);
      c.move(parseUci(uci));
      if (c.isCheckmate()) return 100000;
      if (c.isGameOver()) return 0;
      const l = (await engine.analyse(c.fen(), { depth: 12, multipv: 1 }))[0];
      return l ? -(c.turn() === 'w' ? scoreToCp(l.score) : -scoreToCp(l.score)) : 0;
    };
    const mk = async (uci: string): Promise<Ranked> => {
      const cp = await evalMove(uci);
      const loss = Math.max(0, bestCp - cp);
      const wl = Math.max(0, winChance(bestCp) - winChance(cp));
      return { uci, san: pvToSan(fen, [uci])[0] ?? uci, cp, loss, quality: classify(wl, uci === bestLine.pv[0]) };
    };
    const ranked: Ranked[] = [];
    for (const u of cands) ranked.push(await mk(u));
    ranked.sort((a, b) => b.cp - a.cp);
    const best = await mk(bestLine.pv[0]);
    const foundBest = ranked.some((r) => r.uci === best.uci || r.loss <= 20);
    update(planningSlot, (s) => ({
      ...s,
      candidates: { rounds: s.candidates.rounds + 1, foundBest: s.candidates.foundBest + (foundBest ? 1 : 0) },
      days: bumpDay(s, 'candidates'),
    }));
    setResult({ ranked, best, foundBest });
    setBusy(false);
  }

  const colors = ['rgba(255,170,0,0.9)', 'rgba(93,155,227,0.9)', 'rgba(190,120,255,0.9)'];
  const arrows: Arrow[] = cands.map((u, k) => ({ startSquare: u.slice(0, 2), endSquare: u.slice(2, 4), color: colors[k] }));
  if (result && !cands.includes(result.best.uci)) {
    arrows.push({ startSquare: result.best.uci.slice(0, 2), endSquare: result.best.uci.slice(2, 4), color: ARROW.good });
  }

  return (
    <BoardLayout
      board={<Board fen={fen} orientation={orientation} movable={result || cands.length >= 3 ? 'none' : orientation} onMove={add} arrows={arrows} drawArrows={false} />}
      panel={
        <>
          <Card>
            <Link to="/planning" className="text-sm text-cm-muted hover:text-white">← Planning</Link>
            <p className="mt-1 text-lg font-bold">{orientation === 'white' ? 'White' : 'Black'} to move. What are your top 3 candidate moves?</p>
            <p className="text-sm text-cm-muted">
              Make each move on the board; it is saved as a candidate and the board stays put. Think about checks, captures and threats first, then plans.
            </p>
          </Card>
          <Card title={`Your candidates (${cands.length}/3)`}>
            {cands.length === 0 && <p className="text-sm text-cm-faint">None yet.</p>}
            <ol className="space-y-1">
              {cands.map((u, k) => (
                <li key={u} className="flex items-center justify-between gap-2">
                  <span className="font-bold" style={{ color: colors[k] }}>{k + 1}. {pvToSan(fen, [u])[0]}</span>
                  {!result && <Button size="sm" variant="ghost" onClick={() => setCands(cands.filter((c) => c !== u))}>Remove</Button>}
                </li>
              ))}
            </ol>
            {!result && (
              <Button variant="primary" className="mt-3 w-full" disabled={cands.length === 0 || busy} onClick={rank}>
                {busy ? 'Stockfish is thinking…' : cands.length < 3 ? `Rank my ${cands.length} move${cands.length === 1 ? '' : 's'}` : 'Rank my 3 moves'}
              </Button>
            )}
          </Card>
          {result && (
            <Card title="Stockfish’s ranking">
              <table className="w-full text-sm">
                <tbody>
                  {result.ranked.map((r) => (
                    <tr key={r.uci} className="border-b border-cm-line">
                      <td className="py-1.5 font-bold">{r.san}</td>
                      <td className="text-end font-mono">{formatScore({ cp: turn === 'w' ? r.cp : -r.cp, mate: null })}</td>
                      <td className="ps-2 text-end">
                        <Badge tone={r.quality === 'best' || r.quality === 'good' ? 'green' : r.quality === 'inaccuracy' ? 'yellow' : 'red'}>{QUALITY_LABEL[r.quality]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm">
                {result.foundBest
                  ? '✅ The engine’s best move (or one just as good) was among your candidates.'
                  : `The engine’s best move was ${result.best.san} (green arrow). Next time, look for it among checks, captures and threats.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => { setFen(pick()); setCands([]); setResult(null); }}>Next position</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(analysisPath({ fen, orientation }))}>🔬 Analysis</Button>
              </div>
            </Card>
          )}
        </>
      }
    />
  );
}
