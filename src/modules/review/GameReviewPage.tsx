import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ARROW, Board, type Arrow } from '../../chess/board/Board';
import { MoveList } from '../../chess/board/MoveList';
import { MISTAKE_LABEL, QUALITY_LABEL } from '../../chess/explain';
import { ROOT, lineEnd, parsePgn, pathTo, type MoveTree } from '../../chess/moveTree';
import { getEngine } from '../../engine/engine';
import { addPuzzles } from '../../progress/puzzles';
import { reviewsSlot, type ReviewedGame } from '../../progress/reviews';
import { update, useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { chessComGames, lichessGames, type ImportedGame } from '../../services/games';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Badge, Button, Card, Progress, Segmented, Tip } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';
import { bookDeparture, type BookDeparture } from '../practice/book';
import { puzzlesFrom, reviewGame, squaresOf, type GameReview } from '../practice/review';

export function GameReviewPage() {
  const [settings, setSettings] = useSlot(settingsSlot);
  const [reviews] = useSlot(reviewsSlot);
  const [site, setSite] = useState<'chess.com' | 'lichess'>(settings.chesscomUser || !settings.lichessUser ? 'chess.com' : 'lichess');
  const [name, setName] = useState(site === 'chess.com' ? settings.chesscomUser : settings.lichessUser);
  const [games, setGames] = useState<ImportedGame[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<ImportedGame | null>(null);

  useEffect(() => setName(site === 'chess.com' ? settings.chesscomUser : settings.lichessUser), [site]);

  async function load() {
    const user = name.trim();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const list = site === 'chess.com' ? await chessComGames(user) : await lichessGames(user);
      setGames(list);
      setSettings((s) => (site === 'chess.com' ? { ...s, chesscomUser: user } : { ...s, lichessUser: user }));
      if (!list.length) setError('No standard chess games found in the last few months.');
    } catch (e) {
      setError((e as Error).message || 'Could not load games. Check your connection.');
    }
    setLoading(false);
  }

  if (open) return <ReviewOne game={open} onBack={() => setOpen(null)} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold">Game Review</h1>
      <Card>
        <p className="mb-3 text-sm text-cm-muted">
          Load your recent games. Stockfish checks every move, explains your blunders, shows where you left your opening book, and turns your mistakes into puzzles.
        </p>
        <Segmented value={site} onChange={setSite} options={[{ value: 'chess.com', label: 'Chess.com' }, { value: 'lichess', label: 'Lichess' }]} />
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-lg border p-2"
            placeholder={`Your ${site === 'chess.com' ? 'Chess.com' : 'Lichess'} username`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Button variant="primary" onClick={load} disabled={loading || !name.trim()}>{loading ? 'Loading…' : 'Load games'}</Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </Card>

      {games && games.length > 0 && (
        <Card title={`Your last ${games.length} games`}>
          <div className="divide-y divide-cm-line">
            {games.map((g) => {
              const opp = g.you === 'white' ? g.black : g.white;
              const done = reviews[g.id];
              return (
                <button key={g.id} onClick={() => setOpen(g)} className="flex w-full items-center gap-3 py-2.5 text-start hover:bg-cm-panel2">
                  <Badge tone={g.result === 'win' ? 'green' : g.result === 'loss' ? 'red' : 'muted'}>{g.result === 'win' ? 'Won' : g.result === 'loss' ? 'Lost' : 'Draw'}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">vs {opp.name} {opp.rating ? `(${opp.rating})` : ''}</span>
                    <span className="block text-xs text-cm-faint">
                      {new Date(g.playedAt).toLocaleDateString()} · {g.timeClass} · you played {g.you}
                    </span>
                  </span>
                  {done ? <Badge tone="green">{done.accuracy ?? '–'}% · {done.blunders} blunders</Badge> : <span className="text-sm text-cm-muted">Review ›</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {Object.keys(reviews).length > 0 && !games && (
        <p className="text-sm text-cm-faint">You have reviewed {Object.keys(reviews).length} games so far. Load your games to see them.</p>
      )}
    </div>
  );
}

function ReviewOne({ game, onBack }: { game: ImportedGame; onBack: () => void }) {
  const navigate = useNavigate();
  const parsed = useMemo(() => {
    try {
      return parsePgn(game.pgn);
    } catch {
      return null;
    }
  }, [game.pgn]);
  const you = game.you === 'white' ? 'w' : 'b';
  // The main line only (imported games have no side lines).
  const { tree, ids, sans, startFen } = useMemo(() => {
    const t: MoveTree = parsed?.tree ?? { nodes: {}, nextId: 0 };
    if (!parsed) return { tree: t, ids: [] as string[], sans: [] as string[], startFen: '' };
    const path = pathTo(t, lineEnd(t, ROOT)).slice(1);
    return { tree: t, ids: path, sans: path.map((id) => t.nodes[id].san), startFen: t.nodes[ROOT].fen };
  }, [parsed]);
  const [review, setReview] = useState<GameReview | null>(null);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<string>(ROOT);
  const [departure, setDeparture] = useState<BookDeparture | null>(null);

  useEffect(() => {
    if (!parsed || !sans.length) return;
    let alive = true;
    setDeparture(bookDeparture(startFen, sans, you));
    reviewGame(getEngine(), startFen, sans, you, (d, t) => alive && setProgress(d / t)).then((r) => {
      if (!alive) return;
      setReview(r);
      const dep = bookDeparture(startFen, sans, you);
      const summary: ReviewedGame = {
        id: game.id,
        site: game.site,
        playedAt: game.playedAt,
        opponent: (game.you === 'white' ? game.black : game.white).name,
        you: game.you,
        result: game.result,
        accuracy: r.accuracy[you],
        blunders: r.counts[you].blunder,
        mistakes: r.counts[you].mistake,
        tags: r.topMistakes.map((m) => m.tag),
        leftBook: dep ? { move: Math.floor(dep.index / 2) + 1, san: dep.san, byYou: dep.byYou, book: dep.book.map((b) => b.san).join(', ') } : null,
      };
      update(reviewsSlot, (all) => ({ ...all, [game.id]: summary }));
      addPuzzles(puzzlesFrom(r, you, `Your ${game.site} game vs ${summary.opponent}`, 'review'));
      const firstBad = r.topMistakes[0];
      if (firstBad) setCurrent(ids[r.moves.indexOf(firstBad.move)] ?? ROOT);
    });
    return () => {
      alive = false;
      getEngine().stopAll();
    };
  }, [parsed]);

  if (!parsed) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <Tip>This game could not be read.</Tip>
        <Button onClick={onBack}>Back</Button>
      </div>
    );
  }

  const marks: Record<string, string> = {};
  if (review) {
    review.moves.forEach((m, k) => {
      if (m.quality === 'blunder') marks[ids[k]] = '??';
      else if (m.quality === 'mistake') marks[ids[k]] = '?';
      else if (m.quality === 'inaccuracy') marks[ids[k]] = '?!';
    });
  }
  const idx = ids.indexOf(current);
  const node = tree.nodes[current];
  const reviewed = review && idx >= 0 ? review.moves[idx] : null;
  const arrows: Arrow[] = [];
  const nextMove = review?.moves[idx + 1];
  // Show the engine's choice for the move about to be played (from the position on the board).
  if (nextMove && nextMove.bestUci && nextMove.quality !== 'best' && nextMove.quality !== 'good') {
    const b = squaresOf(nextMove.bestUci);
    arrows.push({ startSquare: b.from, endSquare: b.to, color: ARROW.good });
  }
  const orientation = game.you;
  const opp = game.you === 'white' ? game.black : game.white;
  const me = game.you === 'white' ? game.white : game.black;
  const go = (d: number) => {
    const k = Math.max(-1, Math.min(ids.length - 1, idx + d));
    setCurrent(k < 0 ? ROOT : ids[k]);
  };

  return (
    <BoardLayout
      above={<PlayerBar name={opp.name} detail={opp.rating ? `(${opp.rating})` : ''} icon="👤" />}
      board={<Board fen={node.fen} orientation={orientation} movable="none" arrows={arrows} lastMove={node.uci ? squaresOf(node.uci) : null} />}
      below={
        <>
          <PlayerBar name={me.name} detail={me.rating ? `(${me.rating})` : ''} icon="🙂" />
          <div className="flex gap-1">
            <Button aria-label="Start" onClick={() => setCurrent(ROOT)}>⏮</Button>
            <Button aria-label="Back" onClick={() => go(-1)}>◀</Button>
            <Button aria-label="Next" variant="primary" className="flex-1" onClick={() => go(1)}>▶</Button>
            <Button aria-label="End" onClick={() => setCurrent(ids[ids.length - 1] ?? ROOT)}>⏭</Button>
          </div>
        </>
      }
      panel={
        <>
          <Card>
            <button className="text-sm text-cm-muted hover:text-white" onClick={onBack}>← All games</button>
            <p className="mt-1 text-lg font-bold">
              {game.result === 'win' ? 'You won' : game.result === 'loss' ? 'You lost' : 'Draw'} vs {opp.name}
            </p>
            {!review ? (
              <>
                <p className="mb-1 text-sm text-cm-muted">Stockfish is checking every move…</p>
                <Progress value={progress} />
              </>
            ) : (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-cm-panel2 p-2">
                    <p className="text-3xl font-extrabold text-cm-green-light">{review.accuracy[you] ?? '–'}</p>
                    <p className="text-xs text-cm-muted">your accuracy</p>
                  </div>
                  <div className="rounded-lg bg-cm-panel2 p-2">
                    <p className="text-3xl font-extrabold">{review.accuracy[you === 'w' ? 'b' : 'w'] ?? '–'}</p>
                    <p className="text-xs text-cm-muted">opponent</p>
                  </div>
                </div>
                <p className="mt-2 text-sm">
                  Your blunders: <b>{review.counts[you].blunder}</b> · mistakes: <b>{review.counts[you].mistake}</b> · inaccuracies: <b>{review.counts[you].inaccuracy}</b>
                </p>
                {review.counts[you].blunder + review.counts[you].mistake > 0 && (
                  <p className="text-xs text-cm-faint">Your mistakes were added to your puzzles (Train, then Tactics).</p>
                )}
              </>
            )}
          </Card>

          {departure && (
            <Card title="📖 Opening book">
              <p className="text-sm">
                {departure.line ? <>You followed <b>{departure.line}</b>. </> : null}
                {departure.byYou ? 'You' : 'Your opponent'} left the book on move {Math.floor(departure.index / 2) + 1} with <b>{departure.san}</b>.
                {' '}The book move{departure.book.length > 1 ? 's were' : ' was'} <b>{departure.book.map((b) => b.san).slice(0, 3).join(', ')}</b>.
              </p>
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setCurrent(departure.index === 0 ? ROOT : ids[departure.index - 1])}>
                Show the position
              </Button>
            </Card>
          )}

          {reviewed && (
            <Card>
              <p className="font-bold">
                {Math.ceil(reviewed.ply / 2)}{reviewed.color === 'w' ? '.' : '...'} {reviewed.san}{' '}
                <Badge tone={reviewed.quality === 'blunder' ? 'red' : reviewed.quality === 'mistake' || reviewed.quality === 'inaccuracy' ? 'yellow' : 'green'}>{QUALITY_LABEL[reviewed.quality]}</Badge>
              </p>
              {review?.topMistakes.find((m) => m.move === reviewed)?.sentences.map((t, k) => (
                <p key={k} className="text-sm">{t}</p>
              ))}
              {reviewed.quality !== 'best' && reviewed.bestSan && <p className="text-sm text-cm-muted">Stockfish preferred {reviewed.bestSan}.</p>}
            </Card>
          )}

          {review && review.topMistakes.length > 0 && (
            <Card title="Your biggest mistakes">
              <div className="space-y-2">
                {review.topMistakes.map((mk, k) => (
                  <button key={k} onClick={() => setCurrent(ids[review.moves.indexOf(mk.move) - 1] ?? ROOT)} className="block w-full rounded-lg bg-cm-panel2 p-2 text-start hover:bg-cm-hover">
                    <p className="font-bold">
                      {Math.ceil(mk.move.ply / 2)}{mk.move.color === 'w' ? '.' : '...'} {mk.move.san} <Badge>{MISTAKE_LABEL[mk.tag]}</Badge>
                    </p>
                    <p className="text-sm text-cm-muted">{mk.sentences[0]}</p>
                  </button>
                ))}
                <p className="text-xs text-cm-faint">Tap a mistake to see the position before it. The green arrow shows what Stockfish wanted.</p>
              </div>
            </Card>
          )}

          {review?.turningPoint && (
            <Card title="The moment the game turned">
              <p className="text-sm">{review.turningPoint.text}</p>
            </Card>
          )}

          <Card title="Moves">
            <div className="max-h-64 overflow-y-auto">
              <MoveList tree={tree} current={current} onSelect={setCurrent} marks={marks} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(analysisPath({ tree, current, orientation, title: `vs ${opp.name}` }))}>🔬 Open in Analysis</Button>
              <a className="inline-flex items-center px-2 text-sm text-cm-muted underline" href={game.url} target="_blank" rel="noreferrer">
                View on {game.site} ↗
              </a>
            </div>
          </Card>
        </>
      }
    />
  );
}
