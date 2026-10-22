// Move list in numbered rows (1. e4 e5), with side lines shown as
// indented text under the move they branch from. Tap a move to jump to it.

import { useEffect, useRef, type ReactNode } from 'react';
import { ROOT, type MoveTree, type TreeNode } from '../moveTree';

export function MoveList({ tree, current, onSelect, marks = {} }: {
  tree: MoveTree;
  current: string;
  onSelect: (id: string) => void;
  /** Optional symbols after moves, e.g. { n5: '??' }. */
  marks?: Record<string, string>;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector(`[data-node="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const isWhiteMove = (id: string) => tree.nodes[tree.nodes[id].parent!].fen.split(' ')[1] === 'w';
  const moveNo = (id: string) => tree.nodes[tree.nodes[id].parent!].fen.split(' ')[5];

  const cell = (id: string, extra = '') => {
    const n = tree.nodes[id];
    return (
      <button
        key={id}
        data-node={id}
        onClick={() => onSelect(id)}
        className={`rounded px-1.5 py-0.5 text-start font-semibold ${extra} ${
          id === current ? 'bg-cm-hover text-white shadow-[inset_0_-2px_0_0_#8b8987]' : 'text-cm-text hover:bg-cm-panel2'
        }`}
      >
        {n.san}
        {marks[id] && <span className="ms-0.5 text-cm-red">{marks[id]}</span>}
      </button>
    );
  };

  // A side line as inline text: "3. Bb5 a6 4. Ba4".
  const sideLine = (start: string): ReactNode[] => {
    const out: ReactNode[] = [];
    let cur: string | undefined = start;
    let first = true;
    while (cur) {
      const n: TreeNode = tree.nodes[cur];
      const white = isWhiteMove(cur);
      if (white || first) out.push(<span key={`${cur}-n`} className="ms-1 text-cm-faint">{moveNo(cur)}{white ? '.' : '…'}</span>);
      out.push(cell(cur, 'font-normal text-sm'));
      if (n.comment) out.push(<span key={`${cur}-c`} className="ms-1 text-sm text-cm-green-light italic">{n.comment}</span>);
      const parent = tree.nodes[n.parent!];
      if (parent.children[0] === cur && parent.children.length > 1) {
        out.push(
          <span key={`${cur}-v`} className="text-cm-faint">
            {' ('}
            {parent.children.slice(1).map((alt, i) => (
              <span key={alt}>
                {i > 0 && '; '}
                {sideLine(alt)}
              </span>
            ))}
            {') '}
          </span>,
        );
      }
      first = false;
      cur = n.children[0];
    }
    return out;
  };

  // Main line as rows; side lines and comments break the row.
  const rows: ReactNode[] = [];
  let cur: string | undefined = tree.nodes[ROOT].children[0];
  let pending: { no: string; white?: string; black?: string } | null = null;
  const flush = () => {
    if (!pending) return;
    const p = pending;
    rows.push(
      <div key={`row-${p.white ?? p.black}`} className={`grid grid-cols-[2.5rem_1fr_1fr] items-center py-0.5 ${rows.length % 2 ? 'bg-cm-panel' : 'bg-cm-bg/40'}`}>
        <span className="ps-2 text-sm text-cm-faint">{p.no}.</span>
        <span>{p.white ? cell(p.white) : <span className="px-1.5 text-cm-faint">…</span>}</span>
        <span>{p.black && cell(p.black)}</span>
      </div>,
    );
    pending = null;
  };
  while (cur) {
    const n: TreeNode = tree.nodes[cur];
    if (isWhiteMove(cur)) {
      flush();
      pending = { no: moveNo(cur), white: cur };
    } else {
      if (!pending) pending = { no: moveNo(cur) };
      pending.black = cur;
    }
    const parent = tree.nodes[n.parent!];
    const hasSide = parent.children[0] === cur && parent.children.length > 1;
    if (n.comment || hasSide) {
      flush();
      if (n.comment) rows.push(<p key={`${cur}-c`} className="px-3 py-1 text-sm text-cm-green-light italic">{n.comment}</p>);
      if (hasSide) {
        rows.push(
          <div key={`${cur}-v`} className="border-s-2 border-cm-line px-3 py-1 text-sm leading-7">
            {parent.children.slice(1).map((alt) => (
              <div key={alt}>{sideLine(alt)}</div>
            ))}
          </div>,
        );
      }
    }
    cur = n.children[0];
  }
  flush();

  if (!tree.nodes[ROOT].children.length) {
    return <p className="text-sm text-cm-faint">Make a move on the board to start.</p>;
  }
  return (
    <div ref={box} className="overflow-hidden rounded">
      {rows}
    </div>
  );
}
