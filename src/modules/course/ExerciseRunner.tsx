// Runs a list of course exercises one by one.
// guided: the coach's questions are available before you answer (unlimited help).
// test / placement / review: no help; you see the answer afterwards.

import { Chess, type Square } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { ARROW, Board, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { moveIdeas } from '../../chess/explain';
import { parseUci, pvToSan } from '../../chess/utils';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Badge, Button, Card, Progress } from '../../ui/kit';
import { themeInfo } from '../tactics/puzzles';
import type { CourseItem } from './items';

export type RunMode = 'guided' | 'test' | 'placement' | 'review';

export interface RunResult {
  item: CourseItem;
  ok: boolean;
}

export function ExerciseRunner({ items, mode, title, coachQuestions = [], onFinish, onExit }: {
  items: CourseItem[];
  mode: RunMode;
  title: string;
  coachQuestions?: string[];
  onFinish: (results: RunResult[]) => void;
  onExit?: () => void;
}) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const item = items[i];
  const right = results.filter((r) => r.ok).length;

  useEffect(() => setAnswered(null), [i]);

  if (!item) return null;
  const done = (ok: boolean) => {
    if (answered !== null) return;
    setAnswered(ok);
    setResults((r) => [...r, { item, ok }]);
  };
  const next = () => {
    if (i + 1 >= items.length) onFinish(results);
    else setI(i + 1);
  };

  const header = (
    <Card className="mb-2">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="font-bold">{title}</span>
        <span className="text-cm-faint">
          {i + 1} of {items.length}
          {mode !== 'guided' && ` · ${right} right`}
        </span>
      </div>
      <Progress value={i / items.length} />
      {onExit && (
        <button className="mt-2 text-xs text-cm-muted underline" onClick={onExit}>Stop</button>
      )}
    </Card>
  );
  const footer =
    answered !== null ? (
      <Button variant="primary" className="w-full" onClick={next}>{i + 1 >= items.length ? 'Finish' : 'Next'}</Button>
    ) : null;
  const props = { item, guided: mode === 'guided', questions: coachQuestions, onAnswer: done, answered, header, footer };
  if (item.kind === 'threat') return <ThreatView key={i} {...props} q={item.q} />;
  if (item.kind === 'safe') return <SafeView key={i} {...props} q={item.q} />;
  if (item.kind === 'hanging') return <HangingView key={i} {...props} q={item.q} />;
  return <PuzzleView key={i} {...props} q={item.q} />;
}

interface ViewProps {
  guided: boolean;
  questions: string[];
  onAnswer: (ok: boolean) => void;
  answered: boolean | null;
  header: React.ReactNode;
  footer: React.ReactNode;
}

/** The coach's questions, revealed one at a time (guided practice only). */
function CoachLadder({ questions, extra }: { questions: string[]; extra?: string }) {
  const [shown, setShown] = useState(1);
  const all = extra ? [...questions, extra] : questions;
  return (
    <Card title="🧑‍🏫 Coach">
      <ol className="space-y-1.5 text-sm">
        {all.slice(0, shown).map((q, k) => (
          <li key={k}>
            <b>{k + 1}.</b> {q}
          </li>
        ))}
      </ol>
      {shown < all.length && (
        <Button size="sm" className="mt-2" onClick={() => setShown(shown + 1)}>Next question</Button>
      )}
    </Card>
  );
}

function Verdict({ ok, children }: { ok: boolean; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={`text-lg font-bold ${ok ? 'text-cm-green-light' : 'text-red-400'}`}>{ok ? '✓ Right!' : '✗ Not this time'}</p>
      <div className="text-[15px]">{children}</div>
    </div>
  );
}

const turnName = (fen: string) => (fen.split(' ')[1] === 'w' ? 'white' : 'black');

function ThreatView({ q, guided, questions, onAnswer, answered, header, footer }: ViewProps & { q: Extract<CourseItem, { kind: 'threat' }>['q'] }) {
  const [tapped, setTapped] = useState<Square | null>(null);
  const highlights: Record<string, string> = {};
  const arrows: Arrow[] = [];
  if (answered !== null) {
    for (const a of q.answers) highlights[a] = HIGHLIGHT.danger;
    if (tapped && !q.answers.includes(tapped)) highlights[tapped] = HIGHLIGHT.warn;
    for (const [f, t] of q.threats) arrows.push({ startSquare: f, endSquare: t, color: ARROW.threat });
  }
  return (
    <BoardLayout
      above={header}
      board={
        <Board
          fen={q.fen}
          orientation={turnName(q.fen)}
          movable="none"
          onSquareTap={(sq) => {
            if (answered !== null) return;
            setTapped(sq);
            onAnswer(q.answers.includes(sq));
          }}
          lastMove={{ from: q.move[0], to: q.move[1] }}
          highlights={highlights}
          arrows={arrows}
          drawArrows={false}
        />
      }
      panel={
        <>
          <Card>
            <p className="text-sm text-cm-muted">You play {turnName(q.fen)}. Your opponent just played</p>
            <p className="mb-2 text-2xl font-extrabold">{q.move[2]}</p>
            {answered === null ? <p className="font-bold">Tap the piece (or square) it threatens.</p> : <Verdict ok={answered}>{q.text}</Verdict>}
          </Card>
          {guided && answered === null && <CoachLadder questions={questions} />}
          {footer}
        </>
      }
    />
  );
}

function SafeView({ q, guided, questions, onAnswer, answered, header, footer }: ViewProps & { q: Extract<CourseItem, { kind: 'safe' }>['q'] }) {
  const c = new Chess(q.fen);
  const cand = c.move(q.san);
  const arrows: Arrow[] = [{ startSquare: cand.from, endSquare: cand.to, color: ARROW.hint }];
  let fen = q.fen;
  if (answered !== null) {
    fen = c.fen();
    if (q.reply && q.verdict === 'blunder') {
      try {
        const r = new Chess(fen).move(q.reply);
        arrows.splice(0, 1, { startSquare: r.from, endSquare: r.to, color: ARROW.threat });
      } catch {
        /* ignore */
      }
    }
  }
  const choose = (v: 'safe' | 'blunder') => onAnswer(v === q.verdict);
  return (
    <BoardLayout
      above={header}
      board={<Board fen={fen} orientation={turnName(q.fen)} movable="none" arrows={arrows} lastMove={answered !== null ? { from: cand.from, to: cand.to } : null} drawArrows={false} />}
      panel={
        <>
          <Card>
            <p className="text-sm text-cm-muted">You play {turnName(q.fen)}. You are thinking about</p>
            <p className="mb-3 text-2xl font-extrabold">{q.san}</p>
            {answered === null ? (
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" variant="primary" onClick={() => choose('safe')}>✅ Safe</Button>
                <Button size="lg" variant="danger" onClick={() => choose('blunder')}>❌ Blunder</Button>
              </div>
            ) : (
              <Verdict ok={answered}>
                <p className="mb-1 font-bold">Stockfish: {q.verdict === 'safe' ? 'safe' : `blunder (gives away about ${(q.loss / 100).toFixed(1)} pawns)`}</p>
                {q.text.map((t, k) => (
                  <p key={k}>{t}</p>
                ))}
              </Verdict>
            )}
          </Card>
          {guided && answered === null && <CoachLadder questions={questions} />}
          {footer}
        </>
      }
    />
  );
}

function HangingView({ q, guided, questions, onAnswer, answered, header, footer }: ViewProps & { q: Extract<CourseItem, { kind: 'hanging' }>['q'] }) {
  const [found, setFound] = useState<Square[]>([]);
  const [wrong, setWrong] = useState<Square[]>([]);
  const finish = (ok: boolean) => onAnswer(ok);
  const highlights: Record<string, string> = {};
  for (const f of found) highlights[f] = HIGHLIGHT.good;
  for (const w of wrong) highlights[w] = HIGHLIGHT.danger;
  if (answered !== null) for (const a of q.answers) if (!found.includes(a)) highlights[a] = HIGHLIGHT.warn;
  return (
    <BoardLayout
      above={header}
      board={
        <Board
          fen={q.fen}
          orientation="white"
          movable="none"
          highlights={highlights}
          drawArrows={false}
          onSquareTap={(sq) => {
            if (answered !== null || found.includes(sq) || wrong.includes(sq)) return;
            if (q.answers.includes(sq)) {
              const f = [...found, sq];
              setFound(f);
              if (f.length === q.answers.length) finish(wrong.length === 0);
            } else {
              setWrong([...wrong, sq]);
            }
          }}
        />
      }
      panel={
        <>
          <Card>
            <p className="font-bold">Tap every unprotected knight, bishop, rook and queen, for both sides.</p>
            <p className="text-sm text-cm-muted">Found {found.length} of {q.answers.length}{wrong.length ? ` · ${wrong.length} wrong taps` : ''}</p>
            {answered === null && (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => finish(false)}>I can’t find more: show me</Button>
            )}
            {answered !== null && (
              <Verdict ok={answered}>
                {answered ? 'You found them all with no wrong taps.' : 'Yellow squares are the ones you missed; red are pieces that were protected.'}
              </Verdict>
            )}
          </Card>
          {guided && answered === null && <CoachLadder questions={questions} />}
          {footer}
        </>
      }
    />
  );
}

/** Words for each step of a puzzle solution, from the pattern detectors. */
function solutionWords(fen: string, line: string[]): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  line.forEach((u, k) => {
    const before = c.fen();
    const m = c.move(parseUci(u));
    if (k === 0) out.push(`Your opponent played ${m.san}.`);
    else if (k % 2 === 1) out.push(`${m.san}: ${moveIdeas(before, u)[0] ?? 'the key move.'}`);
    else out.push(`They answer ${m.san}.`);
  });
  return out;
}

function PuzzleView({ q, guided, questions, onAnswer, answered, header, footer }: ViewProps & { q: Extract<CourseItem, { kind: 'puzzle' }>['q'] }) {
  const positions = useMemo(() => {
    const c = new Chess(q.fen);
    const out = [{ fen: c.fen(), last: null as null | { from: string; to: string } }];
    for (const u of q.moves) {
      const m = c.move(parseUci(u));
      out.push({ fen: c.fen(), last: { from: m.from, to: m.to } });
    }
    return out;
  }, [q]);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'solve' | 'reply' | 'over'>('intro');
  const [wrongSq, setWrongSq] = useState<string | null>(null);
  const [replay, setReplay] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setStep(1);
      setPhase('solve');
    }, 700);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (phase !== 'reply') return;
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      setPhase('solve');
    }, 450);
    return () => clearTimeout(t);
  }, [phase]);
  // Replay the solution after a miss.
  useEffect(() => {
    if (!replay || step >= q.moves.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [replay, step]);

  const solver = new Chess(positions[1]?.fen ?? q.fen).turn();
  const orientation = solver === 'w' ? 'white' : 'black';
  const theme = themeInfo(q.theme);

  function onMove(uci: string) {
    if (phase !== 'solve') return false;
    const c = new Chess(positions[step].fen);
    let m;
    try {
      m = c.move(parseUci(uci));
    } catch {
      return false;
    }
    if (uci !== q.moves[step] && !c.isCheckmate()) {
      setWrongSq(m.to);
      setPhase('over');
      onAnswer(false);
      return false;
    }
    if (c.isCheckmate() || step + 1 >= q.moves.length) {
      setStep(q.moves.length);
      setPhase('over');
      onAnswer(true);
      return true;
    }
    setStep(step + 1);
    setPhase('reply');
    return true;
  }

  const pos = positions[Math.min(step, positions.length - 1)];
  const highlights: Record<string, string> = {};
  const arrows: Arrow[] = [];
  if (phase === 'over' && answered === false && !replay) {
    if (wrongSq) highlights[wrongSq] = HIGHLIGHT.danger;
    const exp = parseUci(q.moves[step]);
    arrows.push({ startSquare: exp.from, endSquare: exp.to, color: ARROW.good });
  }
  const words = solutionWords(q.fen, q.moves);

  return (
    <BoardLayout
      above={header}
      board={<Board fen={pos.fen} orientation={orientation} movable={phase === 'solve' ? orientation : 'none'} onMove={onMove} lastMove={pos.last} highlights={highlights} arrows={arrows} />}
      below={<PlayerBar name="You" icon="🙂" detail={`${orientation} to move`} />}
      panel={
        <>
          <Card>
            {theme && <Badge tone="green">{theme.icon} {theme.name}</Badge>}
            {phase !== 'over' ? (
              <p className="mt-2 text-lg font-bold">{phase === 'intro' ? 'Watch your opponent’s move…' : 'Find the best move.'}</p>
            ) : (
              <div className="mt-2">
                <Verdict ok={!!answered}>
                  <ul className="space-y-0.5 text-sm text-cm-muted">
                    {words.map((w, k) => (
                      <li key={k}>{w}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-cm-faint">Solution: {pvToSan(positions[1].fen, q.moves.slice(1)).join(' ')}</p>
                </Verdict>
                {answered === false && !replay && (
                  <Button size="sm" className="mt-2" onClick={() => { setReplay(true); setWrongSq(null); setStep(1); }}>▶ Play the solution</Button>
                )}
              </div>
            )}
          </Card>
          {guided && phase !== 'over' && <CoachLadder questions={questions} extra={theme ? `Hint: this is a ${theme.name.toLowerCase()} puzzle. ${theme.text}` : undefined} />}
          {footer}
        </>
      }
    />
  );
}
