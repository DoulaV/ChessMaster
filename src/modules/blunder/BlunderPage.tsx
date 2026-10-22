import { Chess, type Square } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ARROW, Board, HIGHLIGHT } from '../../chess/board/Board';
import { blunderSlot, pct, type BlunderStats } from '../../progress/blunder';
import { today } from '../../progress/srs';
import { update, useSlot } from '../../progress/store';
import { BoardLayout } from '../../ui/BoardLayout';
import { Button, Card, Progress } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';
import { loadBank, pickFresh, type BankHanging, type BankSafe, type BankThreat, type BlunderBank } from './bank';
import { Checklist } from './Checklist';

const ROUND = 10;

type Kind = 'spot' | 'safe' | 'hanging';

function record(kind: Kind, fen: string, right: boolean | null) {
  update(blunderSlot, (s): BlunderStats => {
    const d = today();
    const day = s.days[d] ?? { spot: 0, safe: 0, hanging: 0 };
    const next = { ...s, recent: { ...s.recent, [kind]: [fen, ...s.recent[kind]].slice(0, 150) }, days: { ...s.days, [d]: { ...day, [kind]: day[kind] + 1 } } };
    if (kind !== 'hanging' && right !== null) next[kind] = { right: s[kind].right + (right ? 1 : 0), total: s[kind].total + 1 };
    return next;
  });
}

function useBank() {
  const [bank, setBank] = useState<BlunderBank | null>(null);
  useEffect(() => {
    loadBank().then(setBank);
  }, []);
  return bank;
}

const turnName = (fen: string) => (fen.split(' ')[1] === 'w' ? 'white' : 'black');

export function BlunderPage() {
  const { mode } = useParams();
  if (mode === 'threat') return <SpotThreat />;
  if (mode === 'safe') return <IsItSafe />;
  if (mode === 'hanging') return <HangingPieces />;
  return <BlunderHome />;
}

function BlunderHome() {
  const [stats] = useSlot(blunderSlot);
  const navigate = useNavigate();
  const d = stats.days[today()];
  const cards = [
    { to: 'threat', icon: '👁️', title: 'Spot the threat', text: 'Your opponent just moved. Tap the piece or square they now threaten.', stat: pct(stats.spot) !== null ? `${pct(stats.spot)}% right (${stats.spot.total} done)` : 'Not tried yet' },
    { to: 'safe', icon: '⚖️', title: 'Is it safe?', text: 'You’re thinking about a move. Safe or blunder? Stockfish gives the verdict.', stat: pct(stats.safe) !== null ? `${pct(stats.safe)}% right (${stats.safe.total} done)` : 'Not tried yet' },
    { to: 'hanging', icon: '⏱️', title: 'Hanging pieces', text: 'Timed: tap every unprotected piece for both sides, as fast as you can.', stat: stats.hanging.bestMs ? `Best: ${(stats.hanging.bestMs / 1000).toFixed(1)} s for 10 positions` : 'Not tried yet' },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-extrabold">Blunder Check</h1>
      <Card title="Before EVERY move, ask:">
        <Checklist />
        <p className="mt-3 text-sm text-cm-muted">
          Most games under 1200 are decided by a piece left hanging or a threat nobody saw. These drills turn the checklist into a habit.
        </p>
      </Card>
      {d && (
        <p className="text-sm text-cm-muted">
          Today: {d.spot} threats spotted, {d.safe} safety checks, {d.hanging} hanging-piece rounds.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.to}>
            <p className="text-lg font-bold">{c.icon} {c.title}</p>
            <p className="mb-2 text-sm text-cm-muted">{c.text}</p>
            <p className="mb-3 text-xs text-cm-faint">{c.stat}</p>
            <Button variant="primary" className="w-full" onClick={() => navigate(`/blunder-check/${c.to}`)}>Start</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoundHeader({ title, n, right }: { title: string; n: number; right: number }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between text-sm">
        <Link to="/blunder-check" className="text-cm-muted hover:text-white">← Blunder Check</Link>
        <span className="text-cm-faint">{title} · {Math.min(n + 1, ROUND)} of {ROUND} · {right} right</span>
      </div>
      <Progress value={n / ROUND} />
    </Card>
  );
}

function RoundDone({ right, total, again, extra }: { right: number; total: number; again: () => void; extra?: string }) {
  return (
    <div className="mx-auto max-w-md">
      <Card title="Round complete">
        <p className="text-4xl font-extrabold">{right} / {total}</p>
        {extra && <p className="mt-1 text-sm text-cm-muted">{extra}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={again}>Play again</Button>
          <Link to="/blunder-check"><Button>Back</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function OpenInAnalysis({ fen, orientation }: { fen: string; orientation: 'white' | 'black' }) {
  const navigate = useNavigate();
  return (
    <Button size="sm" variant="ghost" onClick={() => navigate(analysisPath({ fen, orientation }))}>
      🔬 Open in Analysis
    </Button>
  );
}

function SpotThreat() {
  const bank = useBank();
  const [stats] = useSlot(blunderSlot);
  const [items, setItems] = useState<BankThreat[]>([]);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [answer, setAnswer] = useState<{ square: Square; ok: boolean } | null>(null);

  const start = () => {
    if (!bank) return;
    setItems(pickFresh(bank.threats, ROUND, stats.recent.spot));
    setI(0);
    setRight(0);
    setAnswer(null);
  };
  useEffect(start, [bank]);

  if (!bank) return <p className="text-cm-muted">Loading…</p>;
  if (!bank.threats.length) return <p className="text-cm-muted">No exercises yet.</p>;
  if (i >= items.length && items.length) return <RoundDone right={right} total={items.length} again={start} />;
  const q = items[i];
  if (!q) return null;
  const orientation = turnName(q.fen);

  const tap = (sq: Square) => {
    if (answer) return;
    const ok = q.answers.includes(sq);
    setAnswer({ square: sq, ok });
    if (ok) setRight((r) => r + 1);
    record('spot', q.fen, ok);
  };

  const highlights: Record<string, string> = {};
  const arrows = [];
  if (answer) {
    for (const a of q.answers) highlights[a] = HIGHLIGHT.danger;
    if (!answer.ok) highlights[answer.square] = HIGHLIGHT.warn;
    for (const [from, to] of q.threats) arrows.push({ startSquare: from, endSquare: to, color: ARROW.threat });
  }

  return (
    <BoardLayout
      above={<RoundHeader title="Spot the threat" n={i} right={right} />}
      board={
        <Board
          fen={q.fen}
          orientation={orientation}
          movable="none"
          onSquareTap={tap}
          lastMove={{ from: q.move[0], to: q.move[1] }}
          highlights={highlights}
          arrows={arrows}
          drawArrows={false}
        />
      }
      panel={
        <>
          <Card>
            <p className="text-sm text-cm-muted">You play {orientation}. Your opponent just played</p>
            <p className="mb-2 text-2xl font-extrabold">{q.move[2]}</p>
            {!answer ? (
              <p className="text-lg font-bold">What does it threaten? Tap the piece (or square) in danger.</p>
            ) : (
              <>
                <p className={`text-lg font-bold ${answer.ok ? 'text-cm-green-light' : 'text-red-400'}`}>
                  {answer.ok ? '✓ Well spotted!' : '✗ Not quite'}
                </p>
                <p className="mb-3 text-[15px]">{q.text}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => { setAnswer(null); setI((x) => x + 1); }}>Next</Button>
                  <OpenInAnalysis fen={q.fen} orientation={orientation} />
                </div>
              </>
            )}
          </Card>
          <Card title="Checklist, question 1">
            <Checklist compact active={0} />
          </Card>
        </>
      }
    />
  );
}

function IsItSafe() {
  const bank = useBank();
  const [stats] = useSlot(blunderSlot);
  const [items, setItems] = useState<BankSafe[]>([]);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [answer, setAnswer] = useState<'safe' | 'blunder' | null>(null);

  const start = () => {
    if (!bank) return;
    setItems(pickFresh(bank.safe, ROUND, stats.recent.safe));
    setI(0);
    setRight(0);
    setAnswer(null);
  };
  useEffect(start, [bank]);

  if (!bank) return <p className="text-cm-muted">Loading…</p>;
  if (!bank.safe.length) return <p className="text-cm-muted">No exercises yet.</p>;
  if (i >= items.length && items.length) return <RoundDone right={right} total={items.length} again={start} />;
  const q = items[i];
  if (!q) return null;
  const orientation = turnName(q.fen);

  const choose = (v: 'safe' | 'blunder') => {
    if (answer) return;
    setAnswer(v);
    const ok = v === q.verdict;
    if (ok) setRight((r) => r + 1);
    record('safe', q.fen, ok);
  };

  const c = new Chess(q.fen);
  const cand = c.move(q.san);
  const arrows = [{ startSquare: cand.from, endSquare: cand.to, color: ARROW.hint }];
  let afterFen = q.fen;
  if (answer) {
    afterFen = c.fen();
    if (q.reply) {
      try {
        const r = new Chess(afterFen).move(q.reply);
        arrows.splice(0, 1, { startSquare: r.from, endSquare: r.to, color: ARROW.threat });
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <BoardLayout
      above={<RoundHeader title="Is it safe?" n={i} right={right} />}
      board={
        <Board
          fen={afterFen}
          orientation={orientation}
          movable="none"
          arrows={arrows}
          lastMove={answer ? { from: cand.from, to: cand.to } : null}
          drawArrows={false}
        />
      }
      panel={
        <>
          <Card>
            <p className="text-sm text-cm-muted">You play {orientation}. You are thinking about</p>
            <p className="mb-3 text-2xl font-extrabold">{q.san}</p>
            {!answer ? (
              <>
                <p className="mb-3 font-bold">Go through the checklist. Is this move safe?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" variant="primary" onClick={() => choose('safe')}>✅ Safe</Button>
                  <Button size="lg" variant="danger" onClick={() => choose('blunder')}>❌ Blunder</Button>
                </div>
              </>
            ) : (
              <>
                <p className={`text-lg font-bold ${answer === q.verdict ? 'text-cm-green-light' : 'text-red-400'}`}>
                  {answer === q.verdict ? '✓ Right!' : '✗ Not this time'}{' '}
                  <span className="text-white">Stockfish: {q.verdict === 'safe' ? 'safe' : `blunder (loses about ${(q.loss / 100).toFixed(1)} pawns)`}</span>
                </p>
                {q.reply && q.verdict === 'blunder' && <p className="text-sm text-cm-muted">The red arrow shows the punishment: {q.reply}.</p>}
                <div className="my-2 space-y-1 text-[15px]">
                  {q.text.map((t, k) => (
                    <p key={k}>{t}</p>
                  ))}
                  {q.verdict === 'blunder' && q.best && !q.text.some((t) => t.startsWith('Better was')) && <p>Better was {q.best}.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => { setAnswer(null); setI((x) => x + 1); }}>Next</Button>
                  <OpenInAnalysis fen={q.fen} orientation={orientation} />
                </div>
              </>
            )}
          </Card>
          <Card title="The checklist">
            <Checklist compact active={answer ? undefined : 3} />
          </Card>
        </>
      }
    />
  );
}

const PENALTY_MS = 3000;

function HangingPieces() {
  const bank = useBank();
  const [stats] = useSlot(blunderSlot);
  const [items, setItems] = useState<BankHanging[]>([]);
  const [i, setI] = useState(0);
  const [found, setFound] = useState<Square[]>([]);
  const [wrong, setWrong] = useState<Square | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ ms: number; best: boolean } | null>(null);
  const timer = useRef<number | null>(null);

  const start = () => {
    if (!bank) return;
    setItems(pickFresh(bank.hanging, ROUND, stats.recent.hanging));
    setI(0);
    setFound([]);
    setMistakes(0);
    setResult(null);
    setStartedAt(null);
  };
  useEffect(start, [bank]);

  useEffect(() => {
    if (!startedAt || result) return;
    timer.current = window.setInterval(() => setNow(Date.now()), 100);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [startedAt, result]);

  if (!bank) return <p className="text-cm-muted">Loading…</p>;
  if (!bank.hanging.length) return <p className="text-cm-muted">No exercises yet.</p>;
  if (result) {
    return (
      <RoundDone
        right={ROUND}
        total={ROUND}
        again={start}
        extra={`Time: ${(result.ms / 1000).toFixed(1)} s (including ${mistakes} wrong taps × 3 s).${result.best ? ' 🏆 New best!' : stats.hanging.bestMs ? ` Best: ${(stats.hanging.bestMs / 1000).toFixed(1)} s.` : ''}`}
      />
    );
  }
  const q = items[i];
  if (!q) return null;
  const elapsed = startedAt ? now - startedAt + mistakes * PENALTY_MS : 0;

  const tap = (sq: Square) => {
    if (!startedAt) return;
    if (q.answers.includes(sq)) {
      if (found.includes(sq)) return;
      const next = [...found, sq];
      setFound(next);
      if (next.length === q.answers.length) {
        record('hanging', q.fen, null);
        if (i + 1 >= items.length) {
          const ms = Date.now() - startedAt + mistakes * PENALTY_MS;
          const best = !stats.hanging.bestMs || ms < stats.hanging.bestMs;
          update(blunderSlot, (s) => ({ ...s, hanging: { rounds: s.hanging.rounds + 1, bestMs: best ? ms : s.hanging.bestMs, lastMs: ms } }));
          setResult({ ms, best });
        } else {
          setTimeout(() => {
            setI((x) => x + 1);
            setFound([]);
          }, 350);
        }
      }
    } else {
      setMistakes((m) => m + 1);
      setWrong(sq);
      setTimeout(() => setWrong(null), 400);
    }
  };

  const highlights: Record<string, string> = {};
  for (const f of found) highlights[f] = HIGHLIGHT.good;
  if (wrong) highlights[wrong] = HIGHLIGHT.danger;

  return (
    <BoardLayout
      above={
        <Card>
          <div className="mb-2 flex items-center justify-between text-sm">
            <Link to="/blunder-check" className="text-cm-muted hover:text-white">← Blunder Check</Link>
            <span className="font-mono text-lg font-bold">{(elapsed / 1000).toFixed(1)} s</span>
          </div>
          <Progress value={i / ROUND} />
        </Card>
      }
      board={<Board fen={q.fen} orientation="white" movable="none" onSquareTap={tap} highlights={highlights} drawArrows={false} />}
      panel={
        <Card>
          {!startedAt ? (
            <>
              <p className="mb-2 text-lg font-bold">Tap every unprotected piece, for BOTH sides.</p>
              <p className="mb-3 text-sm text-cm-muted">
                Knights, bishops, rooks and queens that no friendly piece defends (not pawns or kings). 10 positions. A wrong tap adds 3 seconds.
              </p>
              <Button variant="primary" size="lg" className="w-full" onClick={() => { setStartedAt(Date.now()); setNow(Date.now()); }}>
                Start the clock
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg font-bold">Position {i + 1} of {ROUND}</p>
              <p className="text-sm text-cm-muted">Found {found.length} of {q.answers.length} unprotected pieces · {mistakes} wrong taps</p>
            </>
          )}
        </Card>
      }
    />
  );
}
