// Turns engine numbers plus the pattern detectors into short, plain sentences
// like "This leaves your knight on c3 undefended, and Bxc3 wins it."

import { Chess, type Color } from 'chess.js';
import type { Score } from '../engine/engine';
import { findForks, findPins, hangingPieces, mateInOneThreats } from './detectors';
import { PIECE_NAME, PIECE_VALUE, other, parseUci, winChance } from './utils';

export type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveExplanation {
  quality: MoveQuality;
  /** Win chance lost by this move for the side that played it (0 to 1). */
  winLoss: number;
  sentences: string[];
}

export function formatScore(s: Score): string {
  if (s.mate !== null) return s.mate > 0 ? `M${s.mate}` : `-M${-s.mate}`;
  const v = s.cp / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

export function classify(winLoss: number, isBest: boolean): MoveQuality {
  if (isBest) return 'best';
  if (winLoss >= 0.15) return 'blunder';
  if (winLoss >= 0.1) return 'mistake';
  if (winLoss >= 0.05) return 'inaccuracy';
  return 'good';
}

export const QUALITY_LABEL: Record<MoveQuality, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

const name = (p: string) => PIECE_NAME[p as keyof typeof PIECE_NAME];

/** Positive things a move does, from the mover's point of view. */
export function moveIdeas(fenBefore: string, uci: string): string[] {
  const c = new Chess(fenBefore);
  const mover: Color = c.turn();
  const m = c.move(parseUci(uci));
  const after = c.fen();
  const out: string[] = [];
  if (c.isCheckmate()) return ['This is checkmate!'];
  if (m.captured) {
    const before = hangingPieces(fenBefore, other(mover)).find((h) => h.square === m.to);
    if (before) out.push(`Wins material: the ${name(m.captured)} on ${m.to} was not safely protected.`);
    else out.push(`Captures the ${name(m.captured)} on ${m.to}.`);
  }
  const fork = findForks(after, mover).find((f) => f.from === m.to);
  if (fork) {
    const targets = fork.targets.map((t) => `the ${name(c.get(t)!.type)} on ${t}`).join(' and ');
    out.push(`Forks ${targets}: your ${name(m.piece)} attacks both at once.`);
  }
  const pin = findPins(after, mover).find((p) => p.by === m.to);
  if (pin) {
    const behind = c.get(pin.behind)!;
    out.push(
      `Pins the ${name(c.get(pin.pinned)!.type)} on ${pin.pinned} to the ${name(behind.type)} behind it.`,
    );
  }
  const mates = mateInOneThreats(after, mover);
  if (mates.length && !c.isCheck()) out.push(`Threatens checkmate with ${mates[0]}.`);
  if (c.isCheck() && !out.length) out.push('Gives check.');
  return out;
}

/** Problems a move creates, from the mover's point of view. */
export function moveProblems(fenBefore: string, uci: string): string[] {
  const c = new Chess(fenBefore);
  const mover: Color = c.turn();
  const m = c.move(parseUci(uci));
  const after = c.fen();
  const out: string[] = [];
  const mates = mateInOneThreats(after, other(mover));
  if (mates.length && !c.isCheckmate()) {
    out.push(`This allows checkmate: your opponent plays ${mates[0]}.`);
    return out;
  }
  const hangBefore = new Map(hangingPieces(fenBefore, mover).map((h) => [h.square, h]));
  const hangAfter = hangingPieces(after, mover);
  for (const h of hangAfter) {
    const wasHanging = hangBefore.get(h.square === m.to ? m.from : h.square);
    if (wasHanging && wasHanging.loss >= h.loss) {
      out.push(
        `Your ${name(h.piece)} on ${h.square} was already under attack and is still not safe: ${h.capture} wins it.`,
      );
    } else if (h.square === m.to) {
      out.push(`Your ${name(h.piece)} on ${h.square} can be taken: ${h.capture} wins material.`);
    } else {
      out.push(
        `This leaves your ${name(h.piece)} on ${h.square} undefended, and ${h.capture} wins it.`,
      );
    }
    if (out.length >= 2) break;
  }
  // A fork the opponent can make with their next move.
  if (!out.length) {
    const reply = new Chess(after);
    for (const rm of reply.moves({ verbose: true })) {
      reply.move(rm);
      const f = findForks(reply.fen(), other(mover)).find((x) => x.from === rm.to);
      const safe = !hangingPieces(reply.fen(), other(mover)).some((h) => h.square === rm.to);
      reply.undo();
      if (f && safe && f.targets.some((t) => PIECE_VALUE[c.get(t)?.type ?? 'p'] >= 3)) {
        out.push(`This allows a fork: ${rm.san} attacks two of your pieces at once.`);
        break;
      }
    }
  }
  return out;
}

export interface ExplainInput {
  fenBefore: string;
  uci: string;
  /** Best line before the move (engine). */
  bestBefore: { score: Score; uci: string } | null;
  /** Evaluation after the move (engine), and the engine's best reply. */
  after: { score: Score; replyUci?: string } | null;
}

export function explainMove(input: ExplainInput): MoveExplanation {
  const { fenBefore, uci, bestBefore, after } = input;
  const mover = new Chess(fenBefore).turn();
  const sign = mover === 'w' ? 1 : -1;
  let winLoss = 0;
  if (bestBefore && after) {
    winLoss = Math.max(
      0,
      sign * (winChance(bestBefore.score.cp) - winChance(after.score.cp)),
    );
  }
  const isBest = bestBefore?.uci === uci;
  const quality = bestBefore && after ? classify(winLoss, isBest) : 'good';
  const sentences: string[] = [];
  const ideas = moveIdeas(fenBefore, uci);
  const problems = moveProblems(fenBefore, uci);

  if (quality === 'best' || quality === 'good') {
    sentences.push(...ideas);
    if (!ideas.length) sentences.push('A solid move that keeps the position under control.');
  } else {
    sentences.push(...problems);
    if (!problems.length && after?.replyUci) {
      const c = new Chess(fenBefore);
      c.move(parseUci(uci));
      try {
        const reply = c.move(parseUci(after.replyUci));
        sentences.push(`After this, your opponent's strongest answer is ${reply.san}.`);
      } catch {
        /* engine line no longer legal; skip */
      }
    }
  }
  if (bestBefore && !isBest && quality !== 'good') {
    const c = new Chess(fenBefore);
    try {
      const best = c.move(parseUci(bestBefore.uci));
      const why = moveIdeas(fenBefore, bestBefore.uci)[0];
      sentences.push(`Better was ${best.san}.${why ? ' ' + why : ''}`);
    } catch {
      /* ignore */
    }
  }
  if (bestBefore && after && quality !== 'best' && quality !== 'good') {
    sentences.push(
      `The evaluation went from ${formatScore(bestBefore.score)} to ${formatScore(after.score)}.`,
    );
  }
  return { quality, winLoss, sentences };
}
