import { Chess, type Color } from 'chess.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ARROW, Board, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { hangingPieces, threatsBy } from '../../chess/detectors';
import { MISTAKE_LABEL, QUALITY_LABEL } from '../../chess/explain';
import { treeFromSans } from '../../chess/moveTree';
import { START_FEN, formatLine, isValidFen, other, parseUci } from '../../chess/utils';
import { CATALOG, LESSONS } from '../../data/openings/catalog';
import { getBackgroundEngine, getEngine } from '../../engine/engine';
import { BOT_LEVELS, botMove, levelFor, thinkTime } from '../../engine/humanBot';
import { practiceSlot, recordAt, shouldLevelUp, type CoachLevel, type PracticeGame } from '../../progress/practice';
import { addPuzzles } from '../../progress/puzzles';
import { update, useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Badge, Button, Card, Modal, Progress, Segmented, Tip } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';
import { Checklist } from '../blunder/Checklist';
import { bookMovesFor, pickBookMove } from './book';
import { checkMove, hintWords } from './coach';
import { puzzlesFrom, reviewGame, squaresOf, type GameReview } from './review';

interface Setup {
  botRating: number;
  color: 'white' | 'black' | 'random';
  start: 'normal' | 'opening' | 'fen';
  lessonId: string;
  fen: string;
  time: 'none' | '10' | '15+10' | '30';
  coach: CoachLevel;
}

const TIMES: Record<Setup['time'], { base: number; inc: number } | null> = {
  none: null,
  '10': { base: 10 * 60_000, inc: 0 },
  '15+10': { base: 15 * 60_000, inc: 10_000 },
  '30': { base: 30 * 60_000, inc: 0 },
};

interface Game {
  setup: Setup;
  you: Color;
  startFen: string;
  lessonId: string | null;
  moves: string[];
  clock: Record<Color, number> | null;
  over: { result: 'win' | 'loss' | 'draw'; reason: string } | null;
  hintsLeft: number;
  takebacks: number;
  book: { inBook: boolean; label: string; alert: string | null };
}

export function PracticePage() {
  const [settings] = useSlot(settingsSlot);
  const [games] = useSlot(practiceSlot);
  const [setup, setSetup] = useState<Setup>(() => ({
    botRating: levelFor(settings.rating).rating,
    color: 'white',
    start: 'normal',
    lessonId: 'italian',
    fen: '',
    time: 'none',
    coach: 'full',
  }));
  const [game, setGame] = useState<Game | null>(null);

  if (game) return <PlayGame initial={game} onExit={() => setGame(null)} onRematch={(g) => setGame(newGame(g.setup))} />;

  const lesson = LESSONS.find((l) => l.id === setup.lessonId);
  const fenOk = setup.start !== 'fen' || isValidFen(setup.fen.trim());
  const rec = recordAt(games, setup.botRating);
  const up = shouldLevelUp(games.filter((g) => g.takebacks === 0), setup.botRating);
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setSetup((s) => ({ ...s, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold">Practice</h1>
      <Card title="Opponent">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {BOT_LEVELS.map((b) => (
            <Button key={b.rating} size="sm" variant={b.rating === setup.botRating ? 'primary' : 'secondary'} onClick={() => set('botRating', b.rating)}>
              🤖 {b.rating}
            </Button>
          ))}
        </div>
        <p className="text-sm text-cm-muted">
          Your record vs {setup.botRating}: {rec.wins} wins, {rec.draws} draws, {rec.losses} losses.
        </p>
        {up && (
          <p className="mt-1 text-sm text-cm-green-light">
            🎉 You won 3 of your last 5 games at this level. Time to try {BOT_LEVELS.find((b) => b.rating > setup.botRating)?.rating ?? 'the top level'}!
          </p>
        )}
      </Card>
      <Card title="Your color">
        <Segmented value={setup.color} onChange={(v) => set('color', v)} options={[{ value: 'white', label: '♔ White' }, { value: 'black', label: '♚ Black' }, { value: 'random', label: '🎲 Random' }]} />
      </Card>
      <Card title="Start from">
        <Segmented value={setup.start} onChange={(v) => set('start', v)} options={[{ value: 'normal', label: 'Normal start' }, { value: 'opening', label: 'An opening' }, { value: 'fen', label: 'Custom FEN' }]} />
        {setup.start === 'opening' && (
          <div className="mt-3">
            <select className="w-full rounded-lg border p-2" value={setup.lessonId} onChange={(e) => set('lessonId', e.target.value)}>
              {CATALOG.filter((c) => c.lesson).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.side === 'white' ? 'you play White' : 'you play Black'})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-cm-faint">The bot plays the book moves of this opening; your color follows the opening.</p>
          </div>
        )}
        {setup.start === 'fen' && (
          <>
            <textarea className="mt-3 w-full rounded-lg border p-2 font-mono text-xs" rows={2} placeholder="Paste a FEN" value={setup.fen} onChange={(e) => set('fen', e.target.value)} />
            {!fenOk && setup.fen && <p className="text-sm text-red-400">That FEN is not valid.</p>}
          </>
        )}
      </Card>
      <Card title="Time control">
        <Segmented value={setup.time} onChange={(v) => set('time', v)} options={[{ value: 'none', label: 'No clock' }, { value: '10', label: '10 min' }, { value: '15+10', label: '15 + 10' }, { value: '30', label: '30 min' }]} />
      </Card>
      <Card title="Coach">
        <Segmented value={setup.coach} onChange={(v) => set('coach', v)} options={[{ value: 'full', label: '🧑‍🏫 Full coach' }, { value: 'light', label: '💡 Light coach' }, { value: 'none', label: '🎯 No help' }]} />
        <p className="mt-2 text-sm text-cm-muted">
          {setup.coach === 'full' && 'Before each move: the checklist, your unprotected pieces in red and their threats in yellow. If a move loses material, the coach warns you and offers a takeback.'}
          {setup.coach === 'light' && 'No highlights. The coach only warns you about big blunders (losing 2+ pawns of material, or allowing mate).'}
          {setup.coach === 'none' && 'A real game. Feedback only at the end.'}
        </p>
      </Card>
      <Button variant="primary" size="lg" className="w-full" disabled={!fenOk || (setup.start === 'fen' && !setup.fen.trim())} onClick={() => setGame(newGame(setup))}>
        Play
      </Button>
      {lesson && setup.start === 'opening' && <p className="text-center text-xs text-cm-faint">{lesson.name}</p>}
    </div>
  );
}

function newGame(setup: Setup): Game {
  let you: Color = setup.color === 'black' ? 'b' : setup.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : 'w';
  let startFen = START_FEN;
  let lessonId: string | null = null;
  if (setup.start === 'opening') {
    const lesson = LESSONS.find((l) => l.id === setup.lessonId);
    if (lesson) {
      you = lesson.side === 'white' ? 'w' : 'b';
      lessonId = lesson.id;
    }
  }
  if (setup.start === 'fen' && isValidFen(setup.fen.trim())) startFen = setup.fen.trim();
  const t = TIMES[setup.time];
  return {
    setup,
    you,
    startFen,
    lessonId,
    moves: [],
    clock: t ? { w: t.base, b: t.base } : null,
    over: null,
    hintsLeft: 3,
    takebacks: 0,
    book: { inBook: startFen === START_FEN, label: '', alert: null },
  };
}

function PlayGame({ initial, onExit, onRematch }: { initial: Game; onExit: () => void; onRematch: (g: Game) => void }) {
  const navigate = useNavigate();
  const [g, setG] = useState<Game>(initial);
  const [thinking, setThinking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<{ sentences: string[]; loss: number; bestUci: string } | null>(null);
  const [hint, setHint] = useState<{ fen: string; level: number; bestUci: string; words: string } | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [progress, setProgress] = useState(0);
  const runId = useRef(0);
  const hintLoading = useRef(false);
  const level = levelFor(g.setup.botRating);
  const orientation = g.you === 'w' ? 'white' : 'black';

  const chess = useMemo(() => {
    const c = new Chess(g.startFen);
    for (const m of g.moves) c.move(m);
    return c;
  }, [g.startFen, g.moves]);
  const fen = chess.fen();
  const turn = chess.turn();
  const yourTurn = turn === g.you && !g.over;

  // Detect the end of the game.
  useEffect(() => {
    if (g.over) return;
    let over: Game['over'] = null;
    if (chess.isCheckmate()) over = { result: turn === g.you ? 'loss' : 'win', reason: 'checkmate' };
    else if (chess.isStalemate()) over = { result: 'draw', reason: 'stalemate' };
    else if (chess.isInsufficientMaterial()) over = { result: 'draw', reason: 'not enough material to mate' };
    else if (chess.isThreefoldRepetition()) over = { result: 'draw', reason: 'threefold repetition' };
    else if (chess.isDraw()) over = { result: 'draw', reason: '50-move rule' };
    if (over) setG((x) => ({ ...x, over }));
  }, [chess, turn, g.over, g.you]);

  // Clocks.
  useEffect(() => {
    if (!g.clock || g.over || warning) return;
    const id = window.setInterval(() => {
      setG((x) => {
        if (!x.clock || x.over) return x;
        const t = { ...x.clock, [turn]: Math.max(0, x.clock[turn] - 100) };
        if (t[turn] === 0) return { ...x, clock: t, over: { result: turn === x.you ? 'loss' : 'win', reason: 'time ran out' } };
        return { ...x, clock: t };
      });
    }, 100);
    return () => clearInterval(id);
  }, [turn, g.over, !!g.clock, warning]);

  /** Apply a move (SAN) and update the book banner. */
  const applyMove = useCallback((san: string, byYou: boolean) => {
    setG((x) => {
      const c = new Chess(x.startFen);
      for (const m of x.moves) c.move(m);
      const prevFen = c.fen();
      const mover = c.turn();
      const book = bookMovesFor(prevFen, x.lessonId);
      const hit = book.find((b) => b.san === san);
      let bookState = x.book;
      if (x.book.inBook) {
        if (hit) bookState = { inBook: true, label: `${hit.lessonName}: ${hit.lineName}`, alert: null };
        else if (book.length) {
          const offBook = LESSONS.find((l) => l.id === (x.lessonId ?? book[0].lessonId))?.offBook[0];
          bookState = {
            inBook: false,
            label: '',
            alert: byYou
              ? `You left the book with ${san}. The book move was ${book.map((b) => b.san).slice(0, 3).join(' or ')} (${book[0].lineName}).`
              : `The bot left the book with ${san}. Now use opening principles${offBook ? `: ${offBook.advice}` : ': develop, castle, control the center.'}`,
          };
        } else bookState = { inBook: false, label: '', alert: null };
      }
      const clock = x.clock ? { ...x.clock, [mover]: x.clock[mover] + (TIMES[x.setup.time]?.inc ?? 0) } : null;
      return { ...x, moves: [...x.moves, san], book: bookState, clock };
    });
    setHint(null);
  }, []);

  // Bot's turn.
  useEffect(() => {
    if (g.over || turn === g.you || warning || checking) return;
    const id = ++runId.current;
    setThinking(true);
    const started = Date.now();
    const hist = chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    (async () => {
      let san: string | null = null;
      if (g.book.inBook) {
        const pick = pickBookMove(bookMovesFor(fen, g.lessonId));
        if (pick) san = pick.san;
      }
      if (!san) {
        const m = await botMove(getEngine(), fen, level, last?.captured ? last.to : null);
        if (m) san = new Chess(fen).move(parseUci(m.uci)).san;
      }
      const wait = Math.max(0, thinkTime(fen) * (g.book.inBook ? 0.5 : 1) - (Date.now() - started));
      setTimeout(() => {
        if (id !== runId.current || !san) return;
        setThinking(false);
        applyMove(san, false);
      }, wait);
    })();
    return () => {
      runId.current++;
    };
  }, [fen, turn, g.over, g.you, warning, checking]);

  function onMove(uci: string) {
    if (!yourTurn || thinking || checking || warning) return false;
    const before = fen;
    let san: string;
    try {
      san = new Chess(fen).move(parseUci(uci)).san;
    } catch {
      return false;
    }
    applyMove(san, true);
    if (g.setup.coach !== 'none') {
      setChecking(true);
      checkMove(getBackgroundEngine(), before, uci, g.setup.coach).then((r) => {
        setChecking(false);
        if (r.warn) setWarning({ sentences: r.sentences, loss: r.loss, bestUci: r.bestUci });
      });
    }
    return true;
  }

  function takeBack(countIt = true) {
    setWarning(null);
    runId.current++;
    setThinking(false);
    setG((x) => {
      // Remove the bot's reply too if it already moved.
      let n = x.moves.length;
      const c = new Chess(x.startFen);
      for (const m of x.moves) c.move(m);
      const toDrop = c.turn() === x.you ? 2 : 1;
      n = Math.max(0, n - toDrop);
      const moves = x.moves.slice(0, n);
      return { ...x, moves, book: bookStateAfter(x.startFen, moves, x.lessonId), takebacks: x.takebacks + (countIt ? 1 : 0), over: null };
    });
  }

  async function askHint() {
    if (!yourTurn || hintLoading.current) return;
    if (hint && hint.fen === fen) {
      setHint({ ...hint, level: Math.min(3, hint.level + 1) });
      return;
    }
    if (g.hintsLeft <= 0) return;
    hintLoading.current = true;
    const l = await getBackgroundEngine().analyse(fen, { depth: 13, multipv: 1 });
    hintLoading.current = false;
    const bestUci = l[0]?.pv[0];
    if (!bestUci) return;
    setG((x) => ({ ...x, hintsLeft: x.hintsLeft - 1 }));
    setHint({ fen, level: 1, bestUci, words: hintWords(fen, bestUci) });
  }

  function resign() {
    if (confirm('Resign this game? It will count as a loss.')) setG((x) => ({ ...x, over: { result: 'loss', reason: 'resignation' } }));
  }

  // When the game ends: review it with the engine and save everything.
  useEffect(() => {
    if (!g.over || review) return;
    runId.current++;
    getEngine().stopAll();
    let alive = true;
    (async () => {
      const r = g.moves.length
        ? await reviewGame(getEngine(), g.startFen, g.moves, g.you, (d, t) => alive && setProgress(d / t))
        : null;
      if (!alive) return;
      const label = `Practice vs ${g.setup.botRating} bot`;
      const record: PracticeGame = {
        id: crypto.randomUUID(),
        endedAt: new Date().toISOString(),
        botRating: g.setup.botRating,
        color: orientation,
        coach: g.setup.coach,
        result: g.over!.result,
        reason: g.over!.reason,
        accuracy: r?.accuracy[g.you] ?? null,
        blunders: r?.counts[g.you].blunder ?? 0,
        mistakes: r?.counts[g.you].mistake ?? 0,
        takebacks: g.takebacks,
        hints: 3 - g.hintsLeft,
        tags: r?.topMistakes.map((m) => m.tag) ?? [],
        pgn: pgnOf(g, formatLine(g.startFen, g.moves)),
      };
      update(practiceSlot, (all) => [record, ...all].slice(0, 300));
      if (r) addPuzzles(puzzlesFrom(r, g.you, label));
      setReview(r ?? emptyReview());
    })();
    return () => {
      alive = false;
    };
  }, [g.over]);

  // Board decorations.
  const highlights: Record<string, string> = {};
  const arrows: Arrow[] = [];
  if (g.setup.coach === 'full' && yourTurn && !warning) {
    for (const h of hangingPieces(fen, g.you)) highlights[h.square] = HIGHLIGHT.danger;
    for (const t of threatsBy(fen, other(g.you))) {
      if (t.kind === 'mate') highlights[t.square] = HIGHLIGHT.warn;
    }
  }
  if (hint && hint.fen === fen) {
    const { from, to } = squaresOf(hint.bestUci);
    if (hint.level >= 2) highlights[from] = HIGHLIGHT.info;
    if (hint.level >= 3) arrows.push({ startSquare: from, endSquare: to, color: ARROW.hint });
  }
  if (warning) {
    const hist = chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (last) highlights[last.to] = HIGHLIGHT.danger;
  }
  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  const fmtClock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const clockBadge = (c: Color) =>
    g.clock ? (
      <span className={`rounded px-2 py-1 font-mono text-lg font-bold ${turn === c && !g.over ? 'bg-white text-black' : 'bg-cm-panel2 text-cm-muted'}`}>{fmtClock(g.clock[c])}</span>
    ) : undefined;

  if (review) {
    return <ReviewScreen g={g} review={review} onRematch={() => onRematch(g)} onExit={onExit} openAnalysis={() => {
      const { tree, last: lastId } = treeFromSans(g.moves, g.startFen);
      navigate(analysisPath({ tree, current: lastId, orientation, title: `Practice vs ${g.setup.botRating}` }));
    }} />;
  }

  return (
    <>
      <BoardLayout
        above={<PlayerBar name={`Bot ${g.setup.botRating}`} icon="🤖" detail={thinking ? 'thinking…' : ''} right={clockBadge(other(g.you))} />}
        board={
          <Board
            fen={fen}
            orientation={orientation}
            movable={yourTurn && !thinking && !checking && !warning ? orientation : 'none'}
            onMove={onMove}
            lastMove={last ? { from: last.from, to: last.to } : null}
            highlights={highlights}
            arrows={arrows}
          />
        }
        below={<PlayerBar name="You" icon="🙂" detail={g.setup.coach === 'none' ? '' : g.setup.coach === 'full' ? 'Full coach' : 'Light coach'} right={clockBadge(g.you)} />}
        panel={
          <>
            {g.over ? (
              <Card title="Game over">
                <p className="mb-2 text-lg font-bold">{g.over.result === 'win' ? 'You won! 🎉' : g.over.result === 'loss' ? 'You lost.' : 'Draw.'} ({g.over.reason})</p>
                <p className="mb-1 text-sm text-cm-muted">Reviewing your game with Stockfish…</p>
                <Progress value={progress} />
              </Card>
            ) : (
              <Card>
                <p className="text-lg font-bold">{checking ? 'Coach is checking your move…' : yourTurn ? 'Your move' : 'Bot is thinking…'}</p>
                {g.book.inBook && g.book.label && <p className="mt-1 text-sm text-cm-green-light">📖 In book: {g.book.label}</p>}
                {g.book.alert && <p className="mt-2 rounded-lg bg-cm-yellow/15 p-2 text-sm">📖 {g.book.alert}</p>}
                {hint && hint.fen === fen && (
                  <p className="mt-2 rounded-lg bg-cm-blue/20 p-2 text-sm">
                    💡 {hint.words}
                    {hint.level >= 2 && ' The piece to move is highlighted in blue.'}
                    {hint.level >= 3 && ' The arrow shows the move.'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={askHint}
                    disabled={!yourTurn || (g.hintsLeft <= 0 && !(hint && hint.fen === fen)) || (hint?.fen === fen && hint.level >= 3)}
                  >
                    💡 Hint {hint && hint.fen === fen ? `(${hint.level}/3)` : `(${g.hintsLeft} left)`}
                  </Button>
                  <Button size="sm" onClick={() => takeBack(true)} disabled={g.moves.length === 0 || thinking}>↩ Takeback</Button>
                  <Button size="sm" variant="ghost" onClick={resign}>🏳 Resign</Button>
                </div>
                {g.setup.coach !== 'none' && g.takebacks > 0 && (
                  <p className="mt-2 text-xs text-cm-faint">Takebacks: {g.takebacks} (a win with takebacks doesn’t count toward levelling up)</p>
                )}
              </Card>
            )}
            {g.setup.coach === 'full' && !g.over && (
              <Card title="Before you move">
                <Checklist compact />
                <p className="mt-2 text-xs text-cm-faint">
                  <span className="me-1 inline-block h-3 w-3 rounded-sm" style={{ background: HIGHLIGHT.danger }} /> your piece can be taken for free
                  <span className="ms-3 me-1 inline-block h-3 w-3 rounded-sm" style={{ background: HIGHLIGHT.warn }} /> they threaten mate there
                </p>
              </Card>
            )}
            <Card title="Moves">
              <p className="font-mono text-sm leading-6">{g.moves.length ? formatLine(g.startFen, g.moves) : 'No moves yet.'}</p>
            </Card>
          </>
        }
      />
      <Modal open={!!warning} onClose={() => setWarning(null)} title="⚠️ Careful!">
        {warning && (
          <div className="space-y-2">
            {warning.sentences.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            <p className="text-sm text-cm-muted">This move gives away about {(warning.loss / 100).toFixed(1)} pawns.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="primary" onClick={() => takeBack(true)}>↩ Take it back</Button>
              <Button onClick={() => setWarning(null)}>Play it anyway</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Book banner state after a list of moves (used after a takeback). */
function bookStateAfter(startFen: string, moves: string[], lessonId: string | null): Game['book'] {
  if (startFen !== START_FEN) return { inBook: false, label: '', alert: null };
  const c = new Chess(startFen);
  let label = '';
  for (const m of moves) {
    const hit = bookMovesFor(c.fen(), lessonId).find((b) => b.san === m);
    if (!hit) return { inBook: false, label: '', alert: null };
    label = `${hit.lessonName}: ${hit.lineName}`;
    c.move(m);
  }
  return { inBook: true, label, alert: null };
}

function pgnOf(g: Game, movetext: string): string {
  const result = g.over?.result === 'draw' ? '1/2-1/2' : (g.over?.result === 'win') === (g.you === 'w') ? '1-0' : '0-1';
  const you = 'You';
  const bot = `Bot ${g.setup.botRating}`;
  const headers = [
    `[Event "ChessMaster practice"]`,
    `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
    `[White "${g.you === 'w' ? you : bot}"]`,
    `[Black "${g.you === 'b' ? you : bot}"]`,
    `[Result "${result}"]`,
    ...(g.startFen !== START_FEN ? [`[SetUp "1"]`, `[FEN "${g.startFen}"]`] : []),
  ];
  return `${headers.join('\n')}\n\n${movetext} ${result}\n`;
}

function emptyReview(): GameReview {
  return { moves: [], accuracy: { w: null, b: null }, counts: { w: { inaccuracy: 0, mistake: 0, blunder: 0 }, b: { inaccuracy: 0, mistake: 0, blunder: 0 } }, topMistakes: [], turningPoint: null, winGraph: [] };
}

function ReviewScreen({ g, review, onRematch, onExit, openAnalysis }: {
  g: Game;
  review: GameReview;
  onRematch: () => void;
  onExit: () => void;
  openAnalysis: () => void;
}) {
  const [games] = useSlot(practiceSlot);
  const navigate = useNavigate();
  const [focus, setFocus] = useState<number | null>(review.topMistakes.length ? 0 : null);
  const you = g.you;
  const orientation = you === 'w' ? 'white' : 'black';
  const m = focus !== null ? review.topMistakes[focus]?.move : review.turningPoint?.move;
  const arrows: Arrow[] = [];
  if (m) {
    const played = squaresOf(m.uci);
    arrows.push({ startSquare: played.from, endSquare: played.to, color: ARROW.threat });
    if (m.bestUci && m.bestUci !== m.uci) {
      const best = squaresOf(m.bestUci);
      arrows.push({ startSquare: best.from, endSquare: best.to, color: ARROW.good });
    }
  }
  const up = shouldLevelUp(games.filter((x) => x.takebacks === 0), g.setup.botRating);
  const next = BOT_LEVELS.find((b) => b.rating > g.setup.botRating)?.rating;
  const result = g.over?.result;

  return (
    <BoardLayout
      board={<Board fen={m ? m.fenBefore : new Chess(g.startFen).fen()} orientation={orientation} movable="none" arrows={arrows} drawArrows={false} />}
      below={m && <p className="mt-2 text-sm text-cm-muted">Red: what was played. Green: what Stockfish preferred.</p>}
      panel={
        <>
          <Card>
            <p className="text-2xl font-extrabold">{result === 'win' ? 'You won! 🎉' : result === 'loss' ? 'You lost' : 'Draw'}</p>
            <p className="text-sm text-cm-muted">vs Bot {g.setup.botRating} · {g.over?.reason}{g.takebacks ? ` · ${g.takebacks} takebacks` : ''}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-cm-panel2 p-2">
                <p className="text-3xl font-extrabold text-cm-green-light">{review.accuracy[you] ?? '–'}</p>
                <p className="text-xs text-cm-muted">your accuracy</p>
              </div>
              <div className="rounded-lg bg-cm-panel2 p-2">
                <p className="text-3xl font-extrabold">{review.accuracy[other(you)] ?? '–'}</p>
                <p className="text-xs text-cm-muted">bot’s accuracy</p>
              </div>
            </div>
            <p className="mt-2 text-sm">
              Your blunders: <b>{review.counts[you].blunder}</b> · mistakes: <b>{review.counts[you].mistake}</b> · inaccuracies: <b>{review.counts[you].inaccuracy}</b>
            </p>
            {result === 'win' && up && next && (
              <Tip>🎉 3 wins in your last 5 games against {g.setup.botRating}. You’re ready for the {next} bot!</Tip>
            )}
          </Card>

          {review.turningPoint && (
            <Card title="The moment the game turned">
              <p className="text-sm">{review.turningPoint.text}</p>
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setFocus(null)}>Show on the board</Button>
            </Card>
          )}

          <Card title="Your top mistakes">
            {review.topMistakes.length === 0 ? (
              <p className="text-sm text-cm-muted">No real mistakes. Well played!</p>
            ) : (
              <div className="space-y-2">
                {review.topMistakes.map((mk, i) => (
                  <button
                    key={i}
                    onClick={() => setFocus(i)}
                    className={`block w-full rounded-lg p-3 text-start ${focus === i ? 'bg-cm-hover' : 'bg-cm-panel2 hover:bg-cm-hover'}`}
                  >
                    <p className="font-bold">
                      {Math.ceil(mk.move.ply / 2)}{mk.move.color === 'w' ? '.' : '...'} {mk.move.san}{' '}
                      <Badge tone={mk.move.quality === 'blunder' ? 'red' : 'yellow'}>{QUALITY_LABEL[mk.move.quality]}</Badge>{' '}
                      <Badge>{MISTAKE_LABEL[mk.tag]}</Badge>
                    </p>
                    {mk.sentences.map((t, k) => (
                      <p key={k} className="text-sm">{t}</p>
                    ))}
                  </button>
                ))}
                {review.topMistakes.some((x) => x.move.quality !== 'inaccuracy') && (
                  <p className="text-xs text-cm-faint">Your mistakes and blunders were added to your personal puzzles, so they come back for practice.</p>
                )}
              </div>
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={onRematch}>Play again</Button>
            <Button onClick={openAnalysis}>🔬 Open in Analysis</Button>
            <Button variant="ghost" onClick={onExit}>New setup</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
          </div>
          <p className="text-xs text-cm-faint">Results are saved for your dashboard.</p>
        </>
      }
    />
  );
}
