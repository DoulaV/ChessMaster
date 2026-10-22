import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Board, ARROW, HIGHLIGHT, type Arrow } from '../../chess/board/Board';
import { EvalBar } from '../../chess/board/EvalBar';
import { MoveList } from '../../chess/board/MoveList';
import { PositionEditor } from '../../chess/board/PositionEditor';
import { hangingPieces } from '../../chess/detectors';
import {
  ROOT,
  addMove,
  createTree,
  deleteNode,
  lineEnd,
  parsePgn,
  pathTo,
  promote,
  setComment,
  toPgn,
  type MoveTree,
} from '../../chess/moveTree';
import { START_FEN, isValidFen, turnOf } from '../../chess/utils';
import { useEngineLines } from '../../engine/useEngine';
import { useSlot } from '../../progress/store';
import { studiesSlot } from '../../progress/slots';
import { lichessAnalysisUrl } from '../../services/lichess';
import { Button, Card, Modal, Toggle, copyText } from '../../ui/kit';
import { takeHandoff } from './handoff';
import {
  EngineLines,
  ExplainPanel,
  OpeningPanel,
  ThinkFirstPanel,
  ThreatPanel,
  useThreat,
  type ThinkGuess,
} from './panels';

export function AnalysisPage() {
  const [params, setParams] = useSearchParams();
  const [tree, setTree] = useState<MoveTree>(() => createTree());
  const [current, setCurrent] = useState(ROOT);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [title, setTitle] = useState('');
  const [engineOn, setEngineOn] = useState(false);
  const [depth, setDepth] = useState(18);
  const [threatOn, setThreatOn] = useState(false);
  const [showHanging, setShowHanging] = useState(false);
  const [thinkFirst, setThinkFirst] = useState(false);
  const [guess, setGuess] = useState<ThinkGuess | null>(null);
  const [modal, setModal] = useState<null | 'import' | 'setup' | 'export' | 'save' | 'comment'>(null);
  const [toast, setToast] = useState('');
  const [, updateStudies] = useSlot(studiesSlot);

  // Load whatever another screen asked us to open.
  useEffect(() => {
    const fen = params.get('fen');
    const studyJson = params.get('handoff') ? takeHandoff() : null;
    if (studyJson) {
      if (studyJson.tree) {
        setTree(studyJson.tree);
        setCurrent(studyJson.current ?? ROOT);
      } else if (studyJson.pgn) {
        try {
          const { tree: t } = parsePgn(studyJson.pgn);
          setTree(t);
          setCurrent(studyJson.current ?? lineEnd(t, ROOT));
        } catch {
          /* bad pgn; keep empty board */
        }
      } else if (studyJson.fen && isValidFen(studyJson.fen)) {
        setTree(createTree(studyJson.fen));
        setCurrent(ROOT);
      }
      if (studyJson.orientation) setOrientation(studyJson.orientation);
      if (studyJson.title) setTitle(studyJson.title);
      setParams({}, { replace: true });
    } else if (fen && isValidFen(fen)) {
      setTree(createTree(fen));
      setCurrent(ROOT);
      const o = params.get('o');
      setOrientation(o === 'black' ? 'black' : o === 'white' ? 'white' : turnOf(fen) === 'b' ? 'black' : 'white');
      setParams({}, { replace: true });
    }
  }, []);

  const node = tree.nodes[current];
  const fen = node.fen;
  const parentFen = node.parent ? tree.nodes[node.parent].fen : null;
  const path = useMemo(() => pathTo(tree, current), [tree, current]);
  const pathFens = useMemo(() => path.map((id) => tree.nodes[id].fen), [path, tree]);
  const showEngine = engineOn && !(thinkFirst && !(guess?.uci));

  const { lines, running } = useEngineLines(showEngine ? fen : null, { depth, multipv: 3 });
  const threat = useThreat(fen, threatOn);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const play = useCallback(
    (uci: string) => {
      const res = addMove(tree, current, uci);
      if (!res) return false;
      if (thinkFirst && guess && guess.fen === fen && !guess.uci) {
        setGuess({ ...guess, uci });
      } else if (thinkFirst) {
        setGuess(null);
      }
      setTree(res.tree);
      setCurrent(res.id);
      return true;
    },
    [tree, current, thinkFirst, guess, fen],
  );

  const go = useCallback(
    (dir: 'start' | 'back' | 'fwd' | 'end') => {
      if (dir === 'start') setCurrent(ROOT);
      if (dir === 'back' && node.parent) setCurrent(node.parent);
      if (dir === 'fwd' && node.children[0]) setCurrent(node.children[0]);
      if (dir === 'end') setCurrent(lineEnd(tree, current));
    },
    [node, tree, current],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') go('back');
      if (e.key === 'ArrowRight') go('fwd');
      if (e.key === 'ArrowUp') go('start');
      if (e.key === 'ArrowDown') go('end');
      if (e.key === 'f') setOrientation((o) => (o === 'white' ? 'black' : 'white'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const arrows: Arrow[] = [];
  if (showEngine) {
    const colors = [ARROW.engine, ARROW.engine2, ARROW.engine3];
    lines.slice(0, 3).forEach((l, i) => {
      const uci = l.pv[0];
      if (uci) arrows.push({ startSquare: uci.slice(0, 2), endSquare: uci.slice(2, 4), color: colors[i] });
    });
  }
  if (threatOn && threat) {
    arrows.push({ startSquare: threat.uci.slice(0, 2), endSquare: threat.uci.slice(2, 4), color: ARROW.threat });
  }

  const highlights: Record<string, string> = {};
  if (showHanging) {
    for (const color of ['w', 'b'] as const) {
      for (const h of hangingPieces(fen, color)) highlights[h.square] = color === turnOf(fen) ? HIGHLIGHT.danger : HIGHLIGHT.warn;
    }
  }

  const lastMove = node.uci ? { from: node.uci.slice(0, 2), to: node.uci.slice(2, 4) } : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <div className="flex gap-2">
          {showEngine && <EvalBar score={lines[0]?.score ?? null} orientation={orientation} />}
          <div className="min-w-0 flex-1">
            <Board
              fen={fen}
              orientation={orientation}
              onMove={play}
              lastMove={lastMove}
              arrows={arrows}
              highlights={highlights}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex gap-1">
            <Button aria-label="First move" onClick={() => go('start')}>⏮</Button>
            <Button aria-label="Previous move" onClick={() => go('back')}>◀</Button>
            <Button aria-label="Next move" onClick={() => go('fwd')}>▶</Button>
            <Button aria-label="Last move" onClick={() => go('end')}>⏭</Button>
          </div>
          <Button aria-label="Flip board" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
            ⇅ Flip
          </Button>
        </div>
        <p className="text-sm text-cm-faint">
          {title && <b className="me-2 text-white">{title}</b>}
          {turnOf(fen) === 'w' ? 'White' : 'Black'} to move.
        </p>
      </div>

      <div className="space-y-3">
        <Card>
          <Toggle
            checked={engineOn}
            onChange={setEngineOn}
            label="Engine"
            hint="Off by default so you think first."
          />
          <Toggle checked={threatOn} onChange={setThreatOn} label="Threat view" hint="What would your opponent play if it were their move?" />
          <Toggle checked={showHanging} onChange={setShowHanging} label="Show hanging pieces" hint="Red: side to move. Yellow: the other side." />
          <Toggle
            checked={thinkFirst}
            onChange={(v) => {
              setThinkFirst(v);
              setGuess(null);
            }}
            label="Think first"
            hint="Guess the evaluation and best move, then compare with the engine."
          />
        </Card>

        {thinkFirst && (
          <ThinkFirstPanel
            fen={guess?.uci ? guess.fen : fen}
            guess={guess}
            onGuess={setGuess}
            onReveal={() => {
              setGuess(null);
              setThinkFirst(false);
              setEngineOn(true);
            }}
          />
        )}
        {showEngine && (
          <EngineLines fen={fen} lines={lines} running={running} depth={depth} onDepth={setDepth} onPlay={play} />
        )}
        {threatOn && <ThreatPanel threat={threat} />}
        {!thinkFirst && <ExplainPanel parentFen={parentFen} uci={node.uci || null} auto={engineOn} />}

        <Card title="Moves">
          <div className="max-h-72 overflow-y-auto">
            <MoveList tree={tree} current={current} onSelect={setCurrent} />
          </div>
          {current !== ROOT && (
            <div className="mt-2 flex flex-wrap gap-1 border-t border-cm-line pt-2">
              <Button size="sm" variant="ghost" onClick={() => setModal('comment')}>💬 Comment</Button>
              <Button size="sm" variant="ghost" onClick={() => setTree(promote(tree, current))}>⬆ Make main line</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const parent = node.parent!;
                  setTree(deleteNode(tree, current));
                  setCurrent(parent);
                }}
              >
                🗑 Delete from here
              </Button>
            </div>
          )}
        </Card>

        <OpeningPanel pathFens={pathFens} fen={fen} onPlay={play} />

        <Card title="Position">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModal('setup')}>Set up position</Button>
            <Button size="sm" onClick={() => setModal('import')}>Paste FEN / PGN</Button>
            <Button size="sm" onClick={() => setModal('export')}>Export</Button>
            <Button size="sm" onClick={() => setModal('save')}>Save to studies</Button>
            <Button
              size="sm"
              onClick={() => {
                setTree(createTree());
                setCurrent(ROOT);
                setTitle('');
              }}
            >
              New board
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={modal === 'setup'} onClose={() => setModal(null)} title="Set up a position">
        <PositionEditor
          initialFen={fen}
          onCancel={() => setModal(null)}
          onDone={(f) => {
            setTree(createTree(f));
            setCurrent(ROOT);
            setOrientation(turnOf(f) === 'w' ? 'white' : 'black');
            setModal(null);
          }}
        />
      </Modal>

      <ImportModal
        open={modal === 'import'}
        onClose={() => setModal(null)}
        onLoad={(t, cur, hdr) => {
          setTree(t);
          setCurrent(cur);
          setTitle(hdr ?? '');
          setModal(null);
        }}
      />

      <Modal open={modal === 'export'} onClose={() => setModal(null)} title="Export">
        <div className="space-y-3">
          <label className="block text-sm font-medium">FEN (this position)</label>
          <textarea readOnly className="w-full rounded border p-2 font-mono text-xs" rows={2} value={fen} />
          <label className="block text-sm font-medium">PGN (all moves and side lines)</label>
          <textarea readOnly className="w-full rounded border p-2 font-mono text-xs" rows={6} value={toPgn(tree)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={async () => flash((await copyText(fen)) ? 'FEN copied' : 'Could not copy')}>Copy FEN</Button>
            <Button size="sm" onClick={async () => flash((await copyText(toPgn(tree))) ? 'PGN copied' : 'Could not copy')}>Copy PGN</Button>
            <Button
              size="sm"
              onClick={() => {
                const blob = new Blob([toPgn(tree)], { type: 'application/x-chess-pgn' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${title || 'analysis'}.pgn`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Download PGN
            </Button>
            <Button size="sm" onClick={async () => flash((await copyText(lichessAnalysisUrl(fen, orientation))) ? 'Lichess link copied' : 'Could not copy')}>
              Copy Lichess link
            </Button>
            <a className="inline-flex items-center px-2 text-sm underline" href={lichessAnalysisUrl(fen, orientation)} target="_blank" rel="noreferrer">
              Open on Lichess ↗
            </a>
          </div>
        </div>
      </Modal>

      <SaveModal
        open={modal === 'save'}
        defaultTitle={title}
        onClose={() => setModal(null)}
        onSave={(t) => {
          updateStudies((s) => [
            { id: crypto.randomUUID(), title: t, savedAt: new Date().toISOString(), tree, current, orientation },
            ...s,
          ]);
          setTitle(t);
          setModal(null);
          flash('Saved to your studies');
        }}
      />

      <CommentModal
        open={modal === 'comment'}
        initial={node.comment ?? ''}
        onClose={() => setModal(null)}
        onSave={(c) => {
          setTree(setComment(tree, current, c));
          setModal(null);
        }}
      />

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto w-fit rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function ImportModal({ open, onClose, onLoad }: {
  open: boolean;
  onClose: () => void;
  onLoad: (tree: MoveTree, current: string, title?: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const load = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (isValidFen(t)) {
      onLoad(createTree(t), ROOT);
      setText('');
      return;
    }
    try {
      const { tree, headers } = parsePgn(t);
      const name = headers.White && headers.Black ? `${headers.White} vs ${headers.Black}` : headers.Event;
      onLoad(tree, ROOT, name);
      setText('');
      setError('');
    } catch (e) {
      setError(`That doesn't look like a valid FEN or PGN. ${(e as Error).message}`);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Paste a FEN or PGN">
      <textarea
        className="w-full rounded border p-2 font-mono text-xs"
        rows={8}
        placeholder={`${START_FEN}\n\nor\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="cursor-pointer text-sm underline">
          Upload a .pgn file
          <input
            type="file"
            accept=".pgn,.txt,application/x-chess-pgn"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) load(await f.text());
            }}
          />
        </label>
        <Button variant="primary" onClick={() => load(text)}>Load</Button>
      </div>
    </Modal>
  );
}

function SaveModal({ open, defaultTitle, onClose, onSave }: {
  open: boolean;
  defaultTitle: string;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [t, setT] = useState(defaultTitle);
  useEffect(() => setT(defaultTitle), [defaultTitle, open]);
  return (
    <Modal open={open} onClose={onClose} title="Save to your studies">
      <input
        className="w-full rounded border p-2"
        placeholder="Name, e.g. 'Fork idea from my game'"
        value={t}
        onChange={(e) => setT(e.target.value)}
        autoFocus
      />
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={() => onSave(t.trim() || 'Untitled study')}>Save</Button>
      </div>
    </Modal>
  );
}

function CommentModal({ open, initial, onClose, onSave }: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (c: string) => void;
}) {
  const [c, setC] = useState(initial);
  useEffect(() => setC(initial), [initial, open]);
  return (
    <Modal open={open} onClose={onClose} title="Comment on this move">
      <textarea className="w-full rounded border p-2" rows={4} value={c} onChange={(e) => setC(e.target.value)} autoFocus />
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={() => onSave(c.trim())}>Save comment</Button>
      </div>
    </Modal>
  );
}

