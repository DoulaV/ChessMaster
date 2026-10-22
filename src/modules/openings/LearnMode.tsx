import { Chess } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Board, ARROW } from '../../chess/board/Board';
import { treeFromSans } from '../../chess/moveTree';
import { START_FEN } from '../../chess/utils';
import { buildTree, depthForRating, isStudentMove, lineNodes } from '../../data/openings/build';
import type { OpeningLesson, OpeningNode } from '../../data/openings/types';
import { markLineLearned } from '../../progress/openings';
import { useSlot } from '../../progress/store';
import { settingsSlot } from '../../progress/slots';
import { explorer, type ExplorerResult } from '../../services/lichess';
import { BoardLayout } from '../../ui/BoardLayout';
import { Badge, Button, Card, Toggle } from '../../ui/kit';
import { analysisPath } from '../analysis/handoff';

export function LearnMode({ lesson }: { lesson: OpeningLesson }) {
  const [settings] = useSlot(settingsSlot);
  const navigate = useNavigate();
  const [lineId, setLineId] = useState(lesson.lines.find((l) => l.main)?.id ?? lesson.lines[0].id);
  const [index, setIndex] = useState(0);
  const [deeper, setDeeper] = useState(false);
  const depth = depthForRating(settings.rating);
  const line = lesson.lines.find((l) => l.id === lineId)!;
  const nodes = useMemo(() => lineNodes(lesson, lineId, deeper ? 999 : depth), [lesson, lineId, deeper, depth]);
  const root = buildTree(lesson);
  const node: OpeningNode = index === 0 ? root : nodes[index - 1];
  const next = nodes[index];
  const orientation = lesson.side;

  useEffect(() => {
    if (index === nodes.length && nodes.length > 0) markLineLearned(lesson.id, lineId);
  }, [index, nodes.length, lesson.id, lineId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(nodes.length, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes.length]);

  // Other book moves from this position (side lines branching off here).
  const branches = node.children.filter((c) => !c.lines.includes(lineId));

  const arrows = next
    ? [{ startSquare: uciFrom(node.fen, next.san).from, endSquare: uciFrom(node.fen, next.san).to, color: ARROW.good }]
    : [];
  const lastMove = index > 0 ? uciFrom(nodes[index - 2]?.fen ?? root.fen, node.san) : null;
  const moveLabel = (n: OpeningNode) => `${Math.ceil(n.ply / 2)}${n.ply % 2 ? '.' : '...'} ${n.san}`;

  return (
    <BoardLayout
      board={<Board fen={node.fen} orientation={orientation} movable="none" arrows={arrows} lastMove={lastMove} />}
      below={
        <div className="mt-2 flex items-center gap-1">
          <Button aria-label="Start" onClick={() => setIndex(0)}>⏮</Button>
          <Button aria-label="Back" onClick={() => setIndex((i) => Math.max(0, i - 1))}>◀</Button>
          <Button variant="primary" className="flex-1" onClick={() => setIndex((i) => Math.min(nodes.length, i + 1))} disabled={!next}>
            {next ? `Play ${moveLabel(next)} ▶` : 'End of line'}
          </Button>
        </div>
      }
      panel={
        <>
          <Card title="Line">
            <div className="flex flex-wrap gap-1.5">
              {lesson.lines.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLineId(l.id);
                    setIndex(0);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${l.id === lineId ? 'bg-cm-green text-white' : 'bg-cm-panel2 text-cm-muted hover:text-white'}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-cm-faint">
              <Badge>{line.eco}</Badge> {line.ecoName}
            </p>
          </Card>

          <Card>
            {index === 0 ? (
              <p>Tap <b>Play</b> to step through the line. The green arrow shows the next move.</p>
            ) : (
              <>
                <p className="mb-1 text-lg font-bold">
                  {moveLabel(node)}{' '}
                  <span className="text-sm font-normal text-cm-faint">
                    {isStudentMove(lesson, node.ply) ? '(your move)' : '(opponent)'}
                  </span>
                </p>
                <p className="text-[15px]">{node.why}</p>
              </>
            )}
            {!next && index > 0 && (
              <div className="mt-3 rounded-lg bg-cm-green/15 p-3 text-sm">
                ✅ End of this line at your level. Try the next line, or practice it in <b>Drill</b>.
              </div>
            )}
            {branches.length > 0 && (
              <div className="mt-3 border-t border-cm-line pt-2">
                <p className="mb-1 text-xs text-cm-faint">Other book moves here:</p>
                <div className="flex flex-wrap gap-1.5">
                  {branches.map((b) => (
                    <button
                      key={b.key}
                      className="rounded bg-cm-panel2 px-2 py-1 text-sm hover:bg-cm-hover"
                      onClick={() => {
                        setLineId(b.lines[0]);
                        setIndex(b.ply);
                      }}
                    >
                      <b>{b.san}</b> <span className="text-cm-faint">{lesson.lines.find((l) => l.id === b.lines[0])?.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <ExplorerMini fen={node.fen} bookSan={next?.san} />

          <Card>
            <Toggle
              checked={deeper}
              onChange={setDeeper}
              label="Show deeper moves"
              hint={`At your rating you learn about ${depth / 2} moves. Turn on to see the rest.`}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const { tree, last } = treeFromSans(nodes.slice(0, index).map((n) => n.san));
                navigate(analysisPath({ tree, current: last, orientation, title: line.name }));
              }}
            >
              🔬 Open in Analysis
            </Button>
          </Card>
        </>
      }
    />
  );
}

function uciFrom(fen: string, san: string) {
  const m = new Chess(fen || START_FEN).move(san);
  return { from: m.from, to: m.to };
}

/** How often players at your level choose each move here (needs a Lichess token). */
export function ExplorerMini({ fen, bookSan }: { fen: string; bookSan?: string }) {
  const [data, setData] = useState<ExplorerResult | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'none'>('loading');
  useEffect(() => {
    let alive = true;
    setState('loading');
    explorer(fen).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setData(r.data);
        setState('ok');
      } else setState('none');
    });
    return () => {
      alive = false;
    };
  }, [fen]);
  if (state !== 'ok' || !data) return null;
  const total = data.white + data.draws + data.black;
  if (!total) return null;
  return (
    <Card title="What players at your level play here">
      <table className="w-full text-sm">
        <tbody>
          {data.moves.slice(0, 5).map((m) => {
            const t = m.white + m.draws + m.black;
            const pct = (n: number) => `${Math.round((n / t) * 100)}%`;
            return (
              <tr key={m.uci} className={m.san === bookSan ? 'text-cm-green-light' : ''}>
                <td className="py-0.5 font-bold">{m.san}{m.san === bookSan && ' 📖'}</td>
                <td className="text-end">{Math.round((t / total) * 100)}%</td>
                <td className="w-1/2 ps-2">
                  <div className="flex h-3.5 overflow-hidden rounded text-[9px] leading-[14px]">
                    <div className="bg-white text-center text-black" style={{ width: pct(m.white) }}>{pct(m.white)}</div>
                    <div className="bg-cm-faint" style={{ width: pct(m.draws) }} />
                    <div className="bg-black text-center text-white" style={{ width: pct(m.black) }}>{pct(m.black)}</div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-xs text-cm-faint">Win rates: White / draw / Black, from Lichess games at your level.</p>
    </Card>
  );
}
