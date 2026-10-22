// A tree of moves with variations. The first child of a node is its main
// line; the others are side lines. Plain data, so it can be saved as JSON.

import { Chess } from 'chess.js';
import { START_FEN, moveToUci, parseUci } from './utils';

export interface TreeNode {
  id: string;
  parent: string | null;
  /** Empty for the root. */
  san: string;
  uci: string;
  /** Position after this move. */
  fen: string;
  children: string[];
  comment?: string;
}

export interface MoveTree {
  nodes: Record<string, TreeNode>;
  nextId: number;
}

export const ROOT = 'root';

export function createTree(fen = START_FEN): MoveTree {
  return {
    nodes: { [ROOT]: { id: ROOT, parent: null, san: '', uci: '', fen, children: [] } },
    nextId: 1,
  };
}

/**
 * Play a move (UCI like "e2e4" or SAN like "e4") after `parentId`.
 * If that move already exists there, returns the existing node.
 * Returns null if the move is illegal.
 */
export function addMove(
  tree: MoveTree,
  parentId: string,
  move: string,
): { tree: MoveTree; id: string } | null {
  const parent = tree.nodes[parentId];
  if (!parent) return null;
  const c = new Chess(parent.fen);
  let m;
  try {
    m = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? c.move(parseUci(move)) : c.move(move);
  } catch {
    return null;
  }
  const uci = moveToUci(m);
  const existing = parent.children.find((id) => tree.nodes[id].uci === uci);
  if (existing) return { tree, id: existing };
  const id = `n${tree.nextId}`;
  const node: TreeNode = { id, parent: parentId, san: m.san, uci, fen: c.fen(), children: [] };
  return {
    tree: {
      nextId: tree.nextId + 1,
      nodes: {
        ...tree.nodes,
        [parentId]: { ...parent, children: [...parent.children, id] },
        [id]: node,
      },
    },
    id,
  };
}

/** Node ids from the root to `id` (root first). */
export function pathTo(tree: MoveTree, id: string): string[] {
  const out: string[] = [];
  let cur: string | null = id;
  while (cur) {
    out.unshift(cur);
    cur = tree.nodes[cur]?.parent ?? null;
  }
  return out;
}

/** Follow main-line children from `id` to the end. */
export function lineEnd(tree: MoveTree, id: string): string {
  let cur = id;
  while (tree.nodes[cur].children.length) cur = tree.nodes[cur].children[0];
  return cur;
}

export function deleteNode(tree: MoveTree, id: string): MoveTree {
  if (id === ROOT) return tree;
  const nodes = { ...tree.nodes };
  const parent = nodes[nodes[id].parent!];
  nodes[parent.id] = { ...parent, children: parent.children.filter((c) => c !== id) };
  const drop = (n: string) => {
    for (const c of nodes[n].children) drop(c);
    delete nodes[n];
  };
  drop(id);
  return { ...tree, nodes };
}

/** Make the variation containing `id` the main line at its branch point. */
export function promote(tree: MoveTree, id: string): MoveTree {
  const node = tree.nodes[id];
  if (!node.parent) return tree;
  const parent = tree.nodes[node.parent];
  const children = [id, ...parent.children.filter((c) => c !== id)];
  return { ...tree, nodes: { ...tree.nodes, [parent.id]: { ...parent, children } } };
}

export function setComment(tree: MoveTree, id: string, comment: string): MoveTree {
  return {
    ...tree,
    nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], comment: comment || undefined } },
  };
}

/** Full-move number and side for the move that leads to `node`. */
function moveLabel(tree: MoveTree, id: string, force: boolean): string {
  const parentFen = tree.nodes[tree.nodes[id].parent!].fen.split(' ');
  const no = parentFen[5] ?? '1';
  if (parentFen[1] === 'w') return `${no}. `;
  return force ? `${no}... ` : '';
}

const escapeComment = (s: string) => s.replace(/[{}]/g, '');

export function toPgn(tree: MoveTree, headers: Record<string, string> = {}): string {
  const root = tree.nodes[ROOT];
  const h: Record<string, string> = { Event: 'ChessMaster analysis', Result: '*', ...headers };
  if (root.fen !== START_FEN) {
    h.SetUp = '1';
    h.FEN = root.fen;
  }
  const out: string[] = [];
  const walk = (id: string, forceLabel: boolean) => {
    // Writes the main line from `id`, with side lines in brackets.
    let cur: string | null = id;
    let force = forceLabel;
    while (cur) {
      const node: TreeNode = tree.nodes[cur];
      out.push(moveLabel(tree, cur, force) + node.san);
      if (node.comment) out.push(`{ ${escapeComment(node.comment)} }`);
      force = !!node.comment;
      const parent = tree.nodes[node.parent!];
      if (parent.children[0] === cur) {
        for (const alt of parent.children.slice(1)) {
          out.push('(');
          walk(alt, true);
          out.push(')');
          force = true;
        }
      }
      cur = node.children[0] ?? null;
    }
  };
  // Side lines of the root's first move go right after it.
  if (root.children.length) walk(root.children[0], true);
  const head = Object.entries(h)
    .map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`)
    .join('\n');
  return `${head}\n\n${out.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')')} ${h.Result}\n`;
}

/** Parse PGN text including variations and comments. Throws on an illegal move. */
export function parsePgn(text: string): { tree: MoveTree; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const body = text.replace(/^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm, (_m, k: string, v: string) => {
    headers[k] = v;
    return '';
  });
  let tree = createTree(headers.FEN || START_FEN);
  const tokens = body.match(/\{[^}]*\}|;[^\n]*|\(|\)|\$\d+|[^\s(){}]+/g) ?? [];
  // Stack of [current node, node before it] so "(" can branch from the previous position.
  let cur = ROOT;
  let prev = ROOT;
  const stack: [string, string][] = [];
  for (const tok of tokens) {
    if (tok.startsWith('{') || tok.startsWith(';')) {
      // Drop machine data like [%clk 0:09:58] that Chess.com and Lichess add.
      const comment = tok.replace(/^[{;]|}$/g, '').replace(/\[%[^\]]*\]/g, '').trim();
      if (cur !== ROOT && comment) {
        const old = tree.nodes[cur].comment;
        tree = setComment(tree, cur, old ? `${old} ${comment}` : comment);
      }
    } else if (tok === '(') {
      stack.push([cur, prev]);
      cur = prev;
    } else if (tok === ')') {
      [cur, prev] = stack.pop() ?? [cur, prev];
    } else if (/^(\$\d+|1-0|0-1|1\/2-1\/2|\*)$/.test(tok) || /^\d+\.+$/.test(tok)) {
      continue;
    } else {
      const san = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
      if (!san) continue;
      const res = addMove(tree, cur, san);
      if (!res) throw new Error(`Illegal move "${san}" in the PGN.`);
      tree = res.tree;
      prev = cur;
      cur = res.id;
    }
  }
  return { tree, headers };
}

/** Build a tree from a straight list of SAN moves. */
export function treeFromSans(sans: string[], fen = START_FEN): { tree: MoveTree; last: string } {
  let tree = createTree(fen);
  let cur = ROOT;
  for (const san of sans) {
    const res = addMove(tree, cur, san);
    if (!res) break;
    tree = res.tree;
    cur = res.id;
  }
  return { tree, last: cur };
}
