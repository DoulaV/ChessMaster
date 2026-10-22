// Side panels of the Analysis board: engine lines, move explanation,
// threat view, "think first" quiz and the opening explorer.

import { Chess } from 'chess.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { threatsBy } from '../../chess/detectors';
import { QUALITY_LABEL, explainMove, formatScore, type MoveExplanation } from '../../chess/explain';
import { formatLine, flipTurn, other, pvToSan, turnOf, winChance } from '../../chess/utils';
import { getBackgroundEngine, type EngineLine, type Score } from '../../engine/engine';
import { nameOfLine, type OpeningName } from '../../data/eco';
import { explorer, type ExplorerResult } from '../../services/lichess';
import { Button, Card, Segmented } from '../../ui/kit';

export function EngineLines({ fen, lines, running, depth, onDepth, onPlay }: {
  fen: string;
  lines: EngineLine[];
  running: boolean;
  depth: number;
  onDepth: (d: number) => void;
  onPlay: (uci: string) => void;
}) {
  const c = new Chess(fen);
  const over = c.isGameOver();
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Engine
          {lines[0] && <span className="font-mono text-sm text-cm-faint">depth {lines[0].depth}</span>}
          {running && <span className="h-2 w-2 animate-pulse rounded-full bg-cm-green" />}
        </span>
      }
      actions={
        <label className="flex items-center gap-1 text-sm">
          Depth
          <select
            className="rounded border border-cm-line bg-transparent px-1 py-1"
            value={depth}
            onChange={(e) => onDepth(Number(e.target.value))}
          >
            {[10, 14, 18, 22].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      }
    >
      {over ? (
        <p className="text-sm">{c.isCheckmate() ? 'Checkmate.' : 'The game is over (draw).'}</p>
      ) : !lines.length ? (
        <p className="text-sm text-cm-faint">Thinking…</p>
      ) : (
        <ol className="space-y-1.5">
          {lines.map((l) => (
            <li key={l.multipv} className="flex items-start gap-2 text-sm">
              <span
                className={`w-14 shrink-0 rounded px-1 py-0.5 text-center font-mono font-semibold ${
                  winChance(l.score.cp) >= 0.5 ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-white'
                }`}
              >
                {formatScore(l.score)}
              </span>
              <button className="text-start hover:underline" onClick={() => onPlay(l.pv[0])}>
                {formatLine(fen, pvToSan(fen, l.pv, 10))}
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Plain-language verdict on the move that led to the current position. */
export function ExplainPanel({ parentFen, uci, auto }: {
  parentFen: string | null;
  uci: string | null;
  /** Run without asking (when the engine is on anyway). */
  auto: boolean;
}) {
  const [result, setResult] = useState<MoveExplanation | null>(null);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResult(null);
    setAsked(false);
  }, [parentFen, uci]);

  useEffect(() => {
    if (!parentFen || !uci || !(auto || asked)) return;
    let alive = true;
    setBusy(true);
    (async () => {
      const engine = getBackgroundEngine();
      const before = await engine.analyse(parentFen, { depth: 13, multipv: 1 });
      const c = new Chess(parentFen);
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      const afterFen = c.fen();
      const after = c.isGameOver() ? [] : await engine.analyse(afterFen, { depth: 13, multipv: 1 });
      if (!alive) return;
      const mateScore: Score | null = c.isCheckmate()
        ? { cp: c.turn() === 'w' ? -100000 : 100000, mate: 0 }
        : c.isDraw() || c.isStalemate()
          ? { cp: 0, mate: null }
          : null;
      setResult(
        explainMove({
          fenBefore: parentFen,
          uci,
          bestBefore: before[0] ? { score: before[0].score, uci: before[0].pv[0] } : null,
          after: after[0]
            ? { score: after[0].score, replyUci: after[0].pv[0] }
            : mateScore
              ? { score: mateScore }
              : null,
        }),
      );
      setBusy(false);
    })();
    return () => {
      alive = false;
    };
  }, [parentFen, uci, auto, asked]);

  if (!parentFen || !uci) return null;
  const color = {
    best: 'text-cm-green-light',
    good: 'text-cm-green-light',
    inaccuracy: 'text-cm-yellow',
    mistake: 'text-orange-400',
    blunder: 'text-red-400',
  };
  return (
    <Card title="About this move">
      {!auto && !asked ? (
        <Button size="sm" onClick={() => setAsked(true)}>Explain this move</Button>
      ) : busy || !result ? (
        <p className="text-sm text-cm-faint">Checking the move…</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <p className={`font-semibold ${color[result.quality]}`}>{QUALITY_LABEL[result.quality]}</p>
          {result.sentences.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}
    </Card>
  );
}

/** What would the opponent do if it were their move? */
export function useThreat(fen: string, enabled: boolean) {
  const [threat, setThreat] = useState<{ uci: string; san: string; words: string[] } | null>(null);
  useEffect(() => {
    setThreat(null);
    if (!enabled) return;
    const flipped = flipTurn(fen);
    if (!flipped) return;
    let alive = true;
    const opp = other(turnOf(fen));
    const words = threatsBy(fen, opp)
      .slice(0, 3)
      .map((t) =>
        t.kind === 'mate'
          ? `Threatens checkmate with ${t.san}.`
          : t.kind === 'win-material'
            ? `Threatens ${t.san}, winning material.`
            : `Can give check with ${t.san}.`,
      );
    getBackgroundEngine()
      .analyse(flipped, { depth: 12, multipv: 1 })
      .then((l) => {
        if (!alive || !l[0]) return;
        const uci = l[0].pv[0];
        setThreat({ uci, san: pvToSan(flipped, [uci])[0] ?? uci, words });
      });
    return () => {
      alive = false;
    };
  }, [fen, enabled]);
  return threat;
}

export function ThreatPanel({ threat }: { threat: ReturnType<typeof useThreat> }) {
  return (
    <Card title="Threat view">
      {!threat ? (
        <p className="text-sm text-cm-faint">Looking at what your opponent wants…</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p>
            If it were their move, they would play <b>{threat.san}</b> (red arrow).
          </p>
          {threat.words.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          {!threat.words.length && <p className="text-cm-faint">No direct threat to your pieces right now.</p>}
        </div>
      )}
    </Card>
  );
}

const EVAL_CHOICES = [
  { value: '2', label: 'White winning', cp: 300 },
  { value: '1', label: 'White better', cp: 100 },
  { value: '0', label: 'Equal', cp: 0 },
  { value: '-1', label: 'Black better', cp: -100 },
  { value: '-2', label: 'Black winning', cp: -300 },
];

function bucket(cp: number): string {
  if (cp >= 250) return '2';
  if (cp >= 70) return '1';
  if (cp > -70) return '0';
  if (cp > -250) return '-1';
  return '-2';
}

export interface ThinkGuess {
  fen: string;
  evalGuess: string;
  uci: string | null;
}

/** "Think first": the user commits to an evaluation and a move before seeing the engine. */
export function ThinkFirstPanel({ fen, guess, onGuess, onReveal }: {
  fen: string;
  guess: ThinkGuess | null;
  onGuess: (g: ThinkGuess) => void;
  onReveal: () => void;
}) {
  const [result, setResult] = useState<{ best: string; bestScore: Score; yourScore: Score | null; inTop: number } | null>(null);
  const active = guess && guess.fen === fen ? guess : null;
  const done = guess && guess.uci ? guess : null;

  useEffect(() => {
    setResult(null);
    if (!done?.uci) return;
    let alive = true;
    (async () => {
      const engine = getBackgroundEngine();
      const lines = await engine.analyse(done.fen, { depth: 15, multipv: 3 });
      if (!lines[0] || !alive) return;
      const inTop = lines.findIndex((l) => l.pv[0] === done.uci);
      let yourScore: Score | null = inTop >= 0 ? lines[inTop].score : null;
      if (inTop < 0) {
        const c = new Chess(done.fen);
        c.move({ from: done.uci!.slice(0, 2), to: done.uci!.slice(2, 4), promotion: done.uci![4] });
        const after = await engine.analyse(c.fen(), { depth: 13, multipv: 1 });
        yourScore = after[0]?.score ?? null;
      }
      if (!alive) return;
      setResult({ best: pvToSan(done.fen, [lines[0].pv[0]])[0], bestScore: lines[0].score, yourScore, inTop });
    })();
    return () => {
      alive = false;
    };
  }, [done?.fen, done?.uci]);

  if (done && result) {
    const yourMove = pvToSan(done.fen, [done.uci!])[0];
    const right = bucket(result.bestScore.cp) === done.evalGuess;
    const truth = EVAL_CHOICES.find((e) => e.value === bucket(result.bestScore.cp))!.label;
    return (
      <Card title="Think first: result">
        <div className="space-y-1.5 text-sm">
          <p>
            Your evaluation: <b>{EVAL_CHOICES.find((e) => e.value === done.evalGuess)?.label}</b>.{' '}
            Engine: <b>{truth}</b> ({formatScore(result.bestScore)}). {right ? '✅ Well judged.' : '❌ Not quite.'}
          </p>
          <p>
            Your move: <b>{yourMove}</b>.{' '}
            {result.inTop === 0
              ? '✅ That is the engine’s top choice!'
              : result.inTop > 0
                ? `👍 Engine choice #${result.inTop + 1}. The top move was ${result.best}.`
                : `The engine preferred ${result.best} (${formatScore(result.bestScore)}); after your move it is ${result.yourScore ? formatScore(result.yourScore) : '?'}.`}
          </p>
          <Button size="sm" onClick={onReveal}>Show engine lines</Button>
        </div>
      </Card>
    );
  }
  if (done) return <Card title="Think first"><p className="text-sm text-cm-faint">Comparing with the engine…</p></Card>;
  return (
    <Card title="Think first">
      <p className="mb-2 text-sm">1. Who is better here?</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EVAL_CHOICES.map((e) => (
          <Button
            key={e.value}
            size="sm"
            variant={active?.evalGuess === e.value ? 'primary' : 'secondary'}
            onClick={() => onGuess({ fen, evalGuess: e.value, uci: null })}
          >
            {e.label}
          </Button>
        ))}
      </div>
      <p className="text-sm">
        2. {active ? 'Now play your best move on the board.' : 'Then play your best move on the board.'}
      </p>
    </Card>
  );
}

export function OpeningPanel({ pathFens, fen, onPlay }: {
  pathFens: string[];
  fen: string;
  onPlay: (uci: string) => void;
}) {
  const [name, setName] = useState<OpeningName | null>(null);
  const [stats, setStats] = useState<ExplorerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'moves' | 'off'>('moves');

  useEffect(() => {
    let alive = true;
    nameOfLine(pathFens).then((n) => alive && setName(n));
    return () => {
      alive = false;
    };
  }, [pathFens.join('|')]);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setError(null);
    explorer(fen).then((r) => {
      if (!alive) return;
      if (r.ok) setStats(r.data);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [fen]);

  const total = (m: { white: number; draws: number; black: number }) => m.white + m.draws + m.black;
  const all = stats ? total(stats) : 0;

  return (
    <Card
      title="Opening"
      actions={
        stats && (
          <Segmented value={view} onChange={setView} options={[{ value: 'moves', label: 'Stats' }, { value: 'off', label: 'Hide' }]} />
        )
      }
    >
      <p className="mb-2 text-sm">
        {name ? (
          <>
            <span className="me-1 rounded bg-cm-panel2 px-1.5 py-0.5 font-mono text-xs">{name.eco}</span>
            {name.name}
          </>
        ) : pathFens.length > 1 ? (
          'Not a named opening.'
        ) : (
          'Starting position.'
        )}
      </p>
      {error === 'no-token' && (
        <p className="text-xs text-cm-faint">
          To see how often each move is played by players at your level, add a free Lichess token in{' '}
          <Link className="underline" to="/settings">Settings</Link>. Optional.
        </p>
      )}
      {error === 'bad-token' && (
        <p className="text-xs text-red-400">
          Lichess did not accept your token. Check it in <Link className="underline" to="/settings">Settings</Link>.
        </p>
      )}
      {error === 'network' && <p className="text-xs text-cm-faint">Explorer stats are unavailable right now (offline?).</p>}
      {stats && view === 'moves' && (
        all === 0 ? (
          <p className="text-xs text-cm-faint">No games at your level reached this position.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-cm-faint">
                <th className="text-start font-normal">Move</th>
                <th className="text-end font-normal">Played</th>
                <th className="w-1/2 ps-2 text-start font-normal">White / Draw / Black</th>
              </tr>
            </thead>
            <tbody>
              {stats.moves.slice(0, 8).map((m) => {
                const t = total(m);
                const pct = (n: number) => `${Math.round((n / t) * 100)}%`;
                return (
                  <tr key={m.uci} className="cursor-pointer hover:bg-cm-panel2" onClick={() => onPlay(m.uci)}>
                    <td className="py-1 font-semibold">{m.san}</td>
                    <td className="text-end">{Math.round((t / all) * 100)}%</td>
                    <td className="ps-2">
                      <div className="flex h-4 overflow-hidden rounded text-[10px] leading-4">
                        <div className="bg-neutral-100 text-center text-neutral-800" style={{ width: pct(m.white) }}>{pct(m.white)}</div>
                        <div className="bg-neutral-400 text-center" style={{ width: pct(m.draws) }} />
                        <div className="bg-neutral-800 text-center text-white" style={{ width: pct(m.black) }}>{pct(m.black)}</div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </Card>
  );
}
