// Start from the end of a book line and play the position against the bot,
// to practice THE PLAN.

import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Board } from '../../chess/board/Board';
import { treeFromSans } from '../../chess/moveTree';
import { START_FEN, formatLine, parseUci } from '../../chess/utils';
import { depthForRating, lineNodes } from '../../data/openings/build';
import type { OpeningLesson } from '../../data/openings/types';
import { getEngine } from '../../engine/engine';
import { BOT_LEVELS, botMove, levelFor, thinkTime } from '../../engine/humanBot';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { BoardLayout, PlayerBar } from '../../ui/BoardLayout';
import { Button, Card } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';

export function PlayOut({ lesson }: { lesson: OpeningLesson }) {
  const [settings] = useSlot(settingsSlot);
  const navigate = useNavigate();
  const [lineId, setLineId] = useState(lesson.lines.find((l) => l.main)?.id ?? lesson.lines[0].id);
  const [rating, setRating] = useState(levelFor(settings.rating + 200).rating);
  const [game, setGame] = useState<{ moves: string[]; start: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const runId = useRef(0);

  const bookSans = useMemo(
    () => lineNodes(lesson, lineId, depthForRating(settings.rating)).map((n) => n.san),
    [lesson, lineId, settings.rating],
  );
  const you = lesson.side === 'white' ? 'w' : 'b';
  const bookFen = useMemo(() => {
    const c = new Chess();
    for (const m of game ? game.moves.slice(0, game.start) : bookSans) c.move(m);
    return c.fen();
  }, [game, bookSans]);

  const chess = useMemo(() => {
    const c = new Chess();
    for (const m of game?.moves ?? bookSans) c.move(m);
    return c;
  }, [game, bookSans]);
  const fen = chess.fen();
  const over = chess.isGameOver();

  // Bot's turn.
  useEffect(() => {
    if (!game || over || chess.turn() === you) return;
    const id = ++runId.current;
    setThinking(true);
    const hist = chess.history({ verbose: true });
    const last = hist[hist.length - 1];
    const started = Date.now();
    botMove(getEngine(), fen, levelFor(rating), last?.captured ? last.to : null).then((m) => {
      const wait = Math.max(0, thinkTime(fen) - (Date.now() - started));
      setTimeout(() => {
        if (id !== runId.current || !m) return;
        const c = new Chess(fen);
        const mv = c.move(parseUci(m.uci));
        setGame((g) => (g ? { ...g, moves: [...g.moves, mv.san] } : g));
        setThinking(false);
      }, wait);
    });
  }, [game, fen, over, chess, you, rating]);

  function onMove(uci: string) {
    if (!game || chess.turn() !== you || over) return false;
    const c = new Chess(fen);
    try {
      const mv = c.move(parseUci(uci));
      setGame({ ...game, moves: [...game.moves, mv.san] });
      return true;
    } catch {
      return false;
    }
  }

  const resultText = () => {
    if (chess.isCheckmate()) return chess.turn() === you ? 'Checkmate. The bot won this time.' : 'Checkmate! You won! 🎉';
    if (chess.isStalemate()) return 'Stalemate: a draw.';
    if (chess.isDraw()) return 'Draw.';
    return '';
  };

  const hist = chess.history({ verbose: true });
  const last = hist[hist.length - 1];
  const played = game ? game.moves.slice(game.start) : [];

  return (
    <BoardLayout
      above={<PlayerBar name={`Bot ${rating}`} icon="🤖" detail={thinking ? 'thinking…' : ''} />}
      board={
        <Board
          fen={fen}
          orientation={lesson.side}
          movable={game && !over && !thinking ? lesson.side : 'none'}
          onMove={onMove}
          lastMove={last ? { from: last.from, to: last.to } : null}
        />
      }
      below={<PlayerBar name="You" icon="🙂" detail={`playing ${lesson.side}`} />}
      panel={
        <>
          {!game ? (
            <Card title="Play the position">
              <p className="mb-3 text-sm text-cm-muted">
                The game starts where the book line ends. Use THE PLAN below to choose your moves.
              </p>
              <label className="mb-1 block text-sm font-semibold">Line</label>
              <select className="mb-3 w-full rounded-lg border p-2" value={lineId} onChange={(e) => setLineId(e.target.value)}>
                {lesson.lines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <label className="mb-1 block text-sm font-semibold">Bot strength</label>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {BOT_LEVELS.map((b) => (
                  <Button key={b.rating} size="sm" variant={b.rating === rating ? 'primary' : 'secondary'} onClick={() => setRating(b.rating)}>
                    {b.rating}
                  </Button>
                ))}
              </div>
              <p className="mb-3 font-mono text-xs text-cm-faint">{formatLine(START_FEN, bookSans)}</p>
              <Button variant="primary" size="lg" className="w-full" onClick={() => setGame({ moves: bookSans, start: bookSans.length })}>
                Play
              </Button>
            </Card>
          ) : (
            <Card title={over ? 'Game over' : chess.turn() === you ? 'Your move' : 'Bot is thinking…'}>
              {over && <p className="mb-2 text-lg font-bold">{resultText()}</p>}
              <p className="mb-3 text-sm">
                {played.length ? formatLine(bookFen, played) : 'Book position reached. Follow the plan below.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setGame(null)}>{over ? 'New game' : 'Resign / restart'}</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const { tree, last: lastId } = treeFromSans(game.moves);
                    navigate(analysisPath({ tree, current: lastId, orientation: lesson.side, title: `Play-out: ${lesson.name}` }));
                  }}
                >
                  🔬 Open in Analysis
                </Button>
              </div>
            </Card>
          )}
          <Card title="THE PLAN">
            <p className="mb-2 text-sm">{lesson.plan.summary}</p>
            <ul className="list-disc space-y-1 ps-5 text-sm text-cm-muted">
              {lesson.plan.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </Card>
        </>
      }
    />
  );
}
