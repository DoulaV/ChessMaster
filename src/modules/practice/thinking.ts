// The "Think with me" coach: the questions a strong player asks before each
// move, with answers worked out from the position. Pure functions, so they
// can be tested without the engine.

import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { exchangeGain, findForks, findPins, hangingPieces, mateInOneThreats } from '../../chess/detectors';
import { PIECE_NAME, PIECE_VALUE, other } from '../../chess/utils';

const name = (p: PieceSymbol) => PIECE_NAME[p];

export interface ThinkStep {
  id: 'last-move' | 'danger' | 'checks' | 'captures' | 'threats' | 'plan';
  question: string;
  /** Short reminder of why this question matters. */
  why: string;
  answer: string[];
  /** Squares to highlight when the answer is shown. */
  squares: Square[];
  /** Moves to draw as arrows when the answer is shown. */
  moves: { from: Square; to: Square }[];
}

/** What the opponent's last move did: what it attacks now, and anything it uncovered. */
export function lastMoveStep(fen: string, last: Move | null): ThinkStep {
  const step: ThinkStep = {
    id: 'last-move',
    question: last ? `Your opponent just played ${last.san}. What does that move want?` : 'What is your opponent aiming for?',
    why: 'Most blunders come from not asking this. Every move changes what is attacked.',
    answer: [],
    squares: [],
    moves: [],
  };
  if (!last) {
    step.answer.push('It is the start of the game: they want to develop and fight for the center, like you.');
    return step;
  }
  const c = new Chess(fen);
  const me = c.turn();
  const opp = other(me);
  if (last.captured) step.answer.push(`It captured your ${name(last.captured)} on ${last.to}. Can you take back?`);
  if (c.isCheck()) step.answer.push('It gives check: you must deal with the check first.');
  // My pieces attacked by the piece that just moved.
  const hits: string[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== me || p.type === 'k') continue;
      // Protected pawns are not worth mentioning.
      if (p.type === 'p' && c.attackers(p.square, me).length) continue;
      if (c.attackers(p.square, opp).includes(last.to)) {
        hits.push(`your ${name(p.type)} on ${p.square}`);
        step.squares.push(p.square);
      }
    }
  }
  if (hits.length) step.answer.push(`The ${name(last.piece)} on ${last.to} now attacks ${hits.join(' and ')}.`);
  // Pieces attacked by other enemy pieces that weren't attacked before (discovered attacks).
  const before = new Chess(last.before);
  const uncovered: string[] = [];
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== me || p.type === 'k' || step.squares.includes(p.square)) continue;
      const nowBy = c.attackers(p.square, opp).filter((s) => s !== last.to);
      const wasBy = before.get(p.square)?.color === me ? before.attackers(p.square, opp) : [];
      if (nowBy.some((s) => !wasBy.includes(s))) {
        uncovered.push(`your ${name(p.type)} on ${p.square}`);
        step.squares.push(p.square);
      }
    }
  }
  if (uncovered.length) step.answer.push(`Moving it also opened a line: now ${uncovered.join(' and ')} is attacked by another piece.`);
  const mates = mateInOneThreats(fen, opp);
  if (mates.length) step.answer.push(`Danger: they threaten checkmate with ${mates[0]}!`);
  if (!step.answer.length) {
    step.answer.push(`${last.san} does not attack anything new. It probably improves their position: develops, protects, or prepares a plan.`);
  }
  return step;
}

/** Is anything of mine hanging, or is there a mate threat? */
export function dangerStep(fen: string): ThinkStep {
  const me = new Chess(fen).turn();
  const step: ThinkStep = {
    id: 'danger',
    question: 'Is anything of yours in danger right now?',
    why: 'Look at every one of your pieces: is it attacked, and is it protected enough?',
    answer: [],
    squares: [],
    moves: [],
  };
  for (const h of hangingPieces(fen, me)) {
    step.answer.push(`Your ${name(h.piece)} on ${h.square} can be won with ${h.capture}. Protect it, move it, or make a bigger threat.`);
    step.squares.push(h.square);
  }
  const mates = mateInOneThreats(fen, other(me));
  if (mates.length) step.answer.push(`They threaten checkmate with ${mates[0]}. Stop that first.`);
  if (!step.answer.length) step.answer.push('Nothing of yours can be taken for free. You are free to look for your own ideas.');
  return step;
}

/** Your checks, and whether the checking piece is safe. */
export function checksStep(fen: string): ThinkStep {
  const c = new Chess(fen);
  const me = c.turn();
  const step: ThinkStep = {
    id: 'checks',
    question: 'Checks: which checks can you give?',
    why: 'Checks are the most forcing moves. Always look at them first, even the crazy ones.',
    answer: [],
    squares: [],
    moves: [],
  };
  for (const m of c.moves({ verbose: true }).filter((x) => x.san.includes('+') || x.san.includes('#'))) {
    c.move(m);
    const mate = c.isCheckmate();
    const safe = !hangingPieces(c.fen(), me).some((h) => h.square === m.to);
    c.undo();
    step.moves.push({ from: m.from, to: m.to });
    step.answer.push(mate ? `${m.san} is CHECKMATE!` : `${m.san}: ${safe ? 'safe' : `the ${name(m.piece)} can be taken there`}${m.captured ? `, and it captures a ${name(m.captured)}` : ''}.`);
  }
  if (!step.answer.length) step.answer.push('You have no checks right now.');
  return step;
}

/** Your captures, and whether each one wins or loses material. */
export function capturesStep(fen: string): ThinkStep {
  const c = new Chess(fen);
  const step: ThinkStep = {
    id: 'captures',
    question: 'Captures: what can you take, and is it really free?',
    why: 'Count attackers and defenders. A capture is only good if you don’t lose more back.',
    answer: [],
    squares: [],
    moves: [],
  };
  for (const m of c.moves({ verbose: true }).filter((x) => x.captured)) {
    const gain = PIECE_VALUE[m.captured!];
    c.move(m);
    const back = exchangeGain(c, m.to);
    c.undo();
    const net = gain - back;
    step.moves.push({ from: m.from, to: m.to });
    step.answer.push(
      net > 0
        ? `${m.san} wins material (about ${net} point${net > 1 ? 's' : ''}).`
        : net === 0
          ? `${m.san} is an even trade.`
          : `${m.san} loses material: they take back and you lose about ${-net} point${-net > 1 ? 's' : ''}.`,
    );
  }
  if (!step.answer.length) step.answer.push('You have no captures right now.');
  return step;
}

/** Quiet moves that create a threat: attack an unprotected or bigger piece, fork, pin, or threaten mate. */
export function threatsStep(fen: string): ThinkStep {
  const c = new Chess(fen);
  const me = c.turn();
  const step: ThinkStep = {
    id: 'threats',
    question: 'Threats: which of your moves would attack something?',
    why: 'A move that attacks makes your opponent react to you, instead of you reacting to them.',
    answer: [],
    squares: [],
    moves: [],
  };
  const found: { m: Move; text: string; score: number }[] = [];
  for (const m of c.moves({ verbose: true })) {
    if (m.captured || m.san.includes('+')) continue;
    c.move(m);
    const after = c.fen();
    const movedHangs = hangingPieces(after, me).some((h) => h.square === m.to);
    if (!movedHangs) {
      const fork = findForks(after, me).find((f) => f.from === m.to);
      const pin = findPins(after, me).find((p) => p.by === m.to);
      const mate = mateInOneThreats(after, me);
      const wins = hangingPieces(after, other(me)).filter((h) => h.loss >= 2);
      if (mate.length) found.push({ m, text: `${m.san} threatens checkmate (${mate[0]}).`, score: 10 });
      else if (fork) found.push({ m, text: `${m.san} forks two pieces.`, score: 8 });
      else if (pin) found.push({ m, text: `${m.san} pins the ${name(c.get(pin.pinned)!.type)} on ${pin.pinned}.`, score: 6 });
      else if (wins.length) found.push({ m, text: `${m.san} attacks the ${name(wins[0].piece)} on ${wins[0].square}, which isn’t protected well enough.`, score: 4 + wins[0].loss / 10 });
    }
    c.undo();
  }
  for (const f of found.sort((a, b) => b.score - a.score).slice(0, 4)) {
    step.answer.push(f.text);
    step.moves.push({ from: f.m.from, to: f.m.to });
  }
  if (!step.answer.length) step.answer.push('No strong threats right now. That’s normal: then it’s time for a plan.');
  return step;
}

/** The least active piece (fewest moves), excluding the king and pawns. */
export function worstPiece(fen: string): { square: Square; piece: PieceSymbol; moves: number } | null {
  const c = new Chess(fen);
  const me: Color = c.turn();
  let worst: { square: Square; piece: PieceSymbol; moves: number } | null = null;
  for (const row of c.board()) {
    for (const p of row) {
      if (!p || p.color !== me || p.type === 'k' || p.type === 'p') continue;
      const n = c.moves({ square: p.square }).length;
      // Prefer undeveloped minor pieces on the back rank when tied.
      const backRank = (me === 'w' && p.square[1] === '1') || (me === 'b' && p.square[1] === '8');
      const score = n - (backRank && (p.type === 'n' || p.type === 'b') ? 2 : 0);
      if (!worst || score < worst.moves) worst = { square: p.square, piece: p.type, moves: score };
    }
  }
  return worst;
}

export function planStep(fen: string, openingPlan?: string | null): ThinkStep {
  const step: ThinkStep = {
    id: 'plan',
    question: 'No tactic? Then make a plan. Which of your pieces is doing the least?',
    why: 'Improve your worst piece, or follow your opening’s plan. A plan connects your moves into a story.',
    answer: [],
    squares: [],
    moves: [],
  };
  const w = worstPiece(fen);
  if (w) {
    step.answer.push(`Your ${name(w.piece)} on ${w.square} is your least active piece. Where would it be happier?`);
    step.squares.push(w.square);
  }
  const c = new Chess(fen);
  const me = c.turn();
  const castled = (me === 'w' ? ['g1', 'c1', 'b1', 'h1'] : ['g8', 'c8', 'b8', 'h8']).includes(
    c.board().flat().find((p) => p && p.type === 'k' && p.color === me)?.square ?? '',
  );
  if (!castled && c.moves({ verbose: true }).some((m) => m.isKingsideCastle() || m.isQueensideCastle())) {
    step.answer.push('You can still castle. Getting your king safe is often the best plan.');
  }
  if (openingPlan) step.answer.push(`Your opening’s plan: ${openingPlan}`);
  return step;
}

export function allSteps(fen: string, last: Move | null, openingPlan?: string | null): ThinkStep[] {
  return [lastMoveStep(fen, last), dangerStep(fen), checksStep(fen), capturesStep(fen), threatsStep(fen), planStep(fen, openingPlan)];
}
