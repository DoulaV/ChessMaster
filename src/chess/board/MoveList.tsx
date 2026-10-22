// Shows a move tree: the main line in bold, side lines in brackets below.
// Tap any move to jump to it.

import type { ReactNode } from 'react';
import { ROOT, type MoveTree, type TreeNode } from '../moveTree';

export function MoveList({ tree, current, onSelect, marks = {} }: {
  tree: MoveTree;
  current: string;
  onSelect: (id: string) => void;
  /** Optional symbols after moves, e.g. { n5: '??' }. */
  marks?: Record<string, string>;
}) {
  const label = (id: string, force: boolean) => {
    const parentFen = tree.nodes[tree.nodes[id].parent!].fen.split(' ');
    if (parentFen[1] === 'w') return `${parentFen[5]}.`;
    return force ? `${parentFen[5]}…` : '';
  };

  const moveBtn = (id: string, force: boolean, main: boolean) => {
    const n = tree.nodes[id];
    const l = label(id, force);
    return (
      <span key={id} className="inline">
        {l && <span className="ms-1 text-neutral-500">{l}</span>}
        <button
          data-node={id}
          onClick={() => onSelect(id)}
          className={`ms-0.5 rounded px-1 py-0.5 ${main ? 'font-semibold' : ''} ${
            id === current ? 'bg-emerald-600 text-white' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          {n.san}
          {marks[id] && <span className="text-red-500">{marks[id]}</span>}
        </button>
        {n.comment && <span className="ms-1 text-sm text-emerald-800 italic dark:text-emerald-300">{n.comment}</span>}
      </span>
    );
  };

  // Renders a line from `start`, nesting side lines.
  const line = (start: string, main: boolean, depth: number): ReactNode[] => {
    const out: ReactNode[] = [];
    let cur: string | undefined = start;
    let force = true;
    while (cur) {
      const node: TreeNode = tree.nodes[cur];
      out.push(moveBtn(cur, force, main));
      force = !!node.comment;
      const parent = tree.nodes[node.parent!];
      if (parent.children[0] === cur && parent.children.length > 1) {
        out.push(
          <div
            key={`${cur}-vars`}
            className="my-1 ms-2 border-s-2 border-neutral-300 ps-2 text-sm dark:border-neutral-600"
          >
            {parent.children.slice(1).map((alt) => (
              <div key={alt}>{line(alt, false, depth + 1)}</div>
            ))}
          </div>,
        );
        force = true;
      }
      cur = node.children[0];
    }
    return out;
  };

  const root = tree.nodes[ROOT];
  if (!root.children.length) {
    return <p className="text-sm text-neutral-500">Make a move on the board to start.</p>;
  }
  return <div className="leading-8">{line(root.children[0], true, 0)}</div>;
}
