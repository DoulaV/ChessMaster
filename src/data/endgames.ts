// Essential endgames: the checkmates and pawn endings every player needs.
// Every start position was checked with Stockfish (winning positions are
// clearly winning for the student, "hold" positions are draws with best play).

import { Chess } from 'chess.js';

export type EndgameGoal = 'mate' | 'promote' | 'hold';

export interface EndgameDemo {
  fen: string;
  /** SAN moves from `fen`. */
  moves: string[];
  /** Comments keyed by move index (0 = first move). */
  comments: Record<number, string>;
}

export interface Endgame {
  id: 'kqk' | 'krk' | 'king-6th' | 'opposition' | 'square-rule' | 'lucena' | 'philidor';
  title: string;
  icon: string;
  summary: string;
  points: string[];
  goal: EndgameGoal;
  studentColor: 'w' | 'b';
  /** Student moves allowed. */
  maxMoves: number;
  /** Start positions, student to move. */
  positions: string[];
  demo?: EndgameDemo;
  /**
   * Optional second exercise with the other side: e.g. for the opposition,
   * defending a king and pawn ending as Black and holding the draw.
   */
  defense?: { goal: 'hold'; studentColor: 'b'; maxMoves: number; positions: string[]; points: string[] };
}

export const ENDGAMES: Endgame[] = [
  {
    id: 'kqk',
    title: 'King and queen vs king',
    icon: '♛',
    summary: 'Push the lone king to the edge with your queen, then bring your king to help and checkmate.',
    points: [
      'Use the queen like a fence: put it a knight’s move away from the enemy king to shrink its box.',
      'Keep shrinking the box until the king is stuck on the edge.',
      'Careful: when the king has no moves but is not in check, it is stalemate, a draw. Always leave it a square until you can mate.',
      'Once the king is on the edge, stop moving the queen and walk your king over.',
      'Mate with the queen right next to the enemy king, protected by your king, or along the edge.',
    ],
    goal: 'mate',
    studentColor: 'w',
    maxMoves: 25,
    positions: ['8/8/8/4k3/8/8/8/4K2Q w - - 0 1', '8/8/3k4/8/8/8/1Q6/6K1 w - - 0 1', '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1'],
  },
  {
    id: 'krk',
    title: 'King and rook vs king',
    icon: '♜',
    summary: 'The rook cuts the king off line by line, and your king helps push it back to the edge.',
    points: [
      'Use the rook to cut off the enemy king along a rank or a file.',
      'Bring your king up so the two kings face each other (opposition), then check with the rook to push the king back one line.',
      'If the enemy king attacks your rook, move the rook far away along the same line.',
      'Make a waiting move with the rook when you need the enemy king to step into opposition.',
      'On the edge, check from the side while your king stands opposite the enemy king: that is mate.',
    ],
    goal: 'mate',
    studentColor: 'w',
    maxMoves: 40,
    positions: ['8/8/8/4k3/8/8/8/R3K3 w - - 0 1', '8/8/2k5/8/8/8/8/4K2R w - - 0 1', '8/4k3/8/8/8/8/8/1R4K1 w - - 0 1'],
  },
  {
    id: 'king-6th',
    title: 'King on the 6th rank',
    icon: '👑',
    summary: 'With your king in front of your pawn on the 6th rank, you always win (unless it is an edge pawn).',
    points: [
      'The king leads, the pawn follows. Never push the pawn in front of your king too early.',
      'With your king on the 6th rank in front of the pawn, you win no matter who moves.',
      'Step your king sideways or forward to make room, then push the pawn behind it.',
      'Watch out for stalemate when the enemy king is in the corner.',
      'This rule does not work with a pawn on the a- or h-file: those are often draws.',
    ],
    goal: 'promote',
    studentColor: 'w',
    maxMoves: 20,
    positions: ['4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', '3k4/8/3K4/3P4/8/8/8/8 w - - 0 1', '5k2/8/5K2/5P2/8/8/8/8 w - - 0 1', '2k5/8/2K5/2P5/8/8/8/8 w - - 0 1'],
  },
  {
    id: 'opposition',
    title: 'The opposition',
    icon: '🤜',
    summary: 'When the kings stand face to face with one square between them, the side that does NOT have to move wins the fight.',
    points: [
      'Opposition: kings on the same line with one empty square between them. The side that just moved “has the opposition”.',
      'Your king must get in front of your pawn, the pawn comes later.',
      'Having a spare pawn move is a secret weapon: it hands the move to your opponent.',
      'Take the opposition, and when the enemy king steps aside, go around it with your king.',
      'Once your king reaches the 6th rank in front of the pawn, the win is automatic.',
    ],
    goal: 'promote',
    studentColor: 'w',
    maxMoves: 20,
    positions: [
      '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
      '8/8/3k4/8/3K4/8/3P4/8 w - - 0 1',
      '8/8/2k5/8/2K5/8/2P5/8 w - - 0 1',
      '3k4/8/8/3K4/3P4/8/8/8 w - - 0 1',
      '4k3/8/8/4K3/4P3/8/8/8 w - - 0 1',
      '5k2/8/8/5K2/5P2/8/8/8 w - - 0 1',
    ],
    demo: {
      fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
      moves: ['e3', 'Kd6', 'Kf5', 'Ke7', 'Ke5', 'Kf7', 'Kd6', 'Kf6', 'e4', 'Kf7', 'e5', 'Ke8', 'Ke6', 'Kf8', 'Kd7', 'Kf7', 'e6+', 'Kf8', 'e7+', 'Kf7', 'e8=Q+'],
      comments: {
        0: 'A spare pawn move! Now Black has to move and give way.',
        2: 'Your king goes forward first, the pawn stays back.',
        4: 'Kings face to face with Black to move: you have the opposition.',
        6: 'Black stepped aside, so your king walks around and in front of the pawn.',
        12: 'King on the 6th rank in front of the pawn: the win is now automatic.',
        14: 'The king controls the queening square e8. The pawn just walks in.',
        20: 'A new queen. That is how the opposition wins.',
      },
    },
    defense: {
      goal: 'hold',
      studentColor: 'b',
      maxMoves: 20,
      positions: ['8/8/4k3/8/4PK2/8/8/8 b - - 0 1', '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1', '8/8/3k4/8/3PK3/8/8/8 b - - 0 1', '4k3/8/4P3/4K3/8/8/8/8 b - - 0 1'],
      points: [
        'Keep your king in front of the pawn.',
        'When the white king comes forward, step straight back, so you can take the opposition when it arrives.',
        'If the pawn reaches the 7th rank with check, step to the square in front of it or to the side that leads to stalemate.',
        'Never walk away from the pawn: the draw comes from blocking it.',
      ],
    },
  },
  {
    id: 'square-rule',
    title: 'The rule of the square',
    icon: '⬜',
    summary: 'Draw an imaginary square from the pawn to its queening row: if the enemy king can step into it, it catches the pawn.',
    points: [
      'Count the squares from the pawn to the last row, then draw a square with that side length toward the enemy king.',
      'If the king is inside the square, or can step into it on its move, it catches the pawn.',
      'If the king is outside, the pawn runs and promotes. Count, don’t guess!',
      'Who is to move matters: if it is the pawn’s side to move, the square shrinks by one before the king can step in.',
      'From the starting square a pawn can jump two squares, so count it as if it already stood one square further.',
    ],
    goal: 'promote',
    studentColor: 'w',
    maxMoves: 20,
    positions: ['8/8/8/P7/8/8/5k2/7K w - - 0 1', '8/8/8/8/1P6/8/6k1/K7 w - - 0 1', '8/8/8/7P/8/8/2k5/K7 w - - 0 1', '8/8/8/6P1/8/k7/8/K7 w - - 0 1'],
    demo: {
      fen: '8/8/8/P7/8/8/5k2/7K w - - 0 1',
      moves: ['a6', 'Ke3', 'a7', 'Kd4', 'a8=Q'],
      comments: {
        0: 'The pawn on a5 needed 3 moves, so its square was a5 to d8, and Black’s king on f2 is far outside it.',
        2: 'The king tries, but it is too slow.',
        4: 'Queen! The king never got inside the square.',
      },
    },
  },
  {
    id: 'lucena',
    title: 'Lucena position (simplified)',
    icon: '🌉',
    summary: 'With rook and pawn against rook, build a bridge with your rook so your king can come out from in front of the pawn.',
    points: [
      'Your king is in front of your pawn on the 7th, but it is stuck there.',
      'First check the enemy king one more file away, so it cannot come back.',
      'Then put your rook on the 4th rank: this is the “bridge”.',
      'Walk your king out. When the checks come, block with the rook on the bridge.',
      'Once the checks stop, the pawn promotes.',
    ],
    goal: 'promote',
    studentColor: 'w',
    maxMoves: 20,
    positions: ['1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', '2K5/2P1k3/8/8/8/8/1r6/3R4 w - - 0 1', '3K4/3P1k2/8/8/8/8/2r5/4R3 w - - 0 1'],
    demo: {
      fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
      moves: ['Rd1+', 'Ke7', 'Rd4', 'Ra1', 'Kc7', 'Rc1+', 'Kb6', 'Rb1+', 'Kc6', 'Rc1+', 'Kb5', 'Rb1+', 'Rb4'],
      comments: {
        0: 'Check first: push the black king away from the pawn.',
        2: 'The bridge: the rook goes to the 4th rank.',
        4: 'Now your king leaves the queening square.',
        6: 'Walk toward your rook while Black keeps checking.',
        12: 'The bridge blocks the last check. Nothing stops b8=Q now.',
      },
    },
  },
  {
    id: 'philidor',
    title: 'Philidor position (simplified)',
    icon: '🛡️',
    summary: 'Defending rook against rook and pawn: keep your rook on your 3rd rank (the 6th from White’s side) until the pawn steps onto it, then check from behind.',
    points: [
      'Keep your king on the queening square or right next to it.',
      'Put your rook on the 6th rank (seen from White) and keep it there. The white king cannot come forward.',
      'Do not move your rook off that rank while the pawn is still behind it.',
      'When the pawn moves to the 6th rank, the white king has no shelter: drop your rook to the 1st rank.',
      'Then check from behind, again and again. It is a draw.',
    ],
    goal: 'hold',
    studentColor: 'b',
    maxMoves: 20,
    positions: ['4k3/R7/1r6/4K3/4P3/8/8/8 b - - 0 1', '3k4/R7/2r5/3K4/3P4/8/8/8 b - - 0 1', '5k2/R7/2r5/5K2/5P2/8/8/8 b - - 0 1'],
    demo: {
      fen: '4k3/R7/1r6/4K3/4P3/8/8/8 b - - 0 1',
      moves: ['Rh6', 'Kf5', 'Rb6', 'e5', 'Rc6', 'e6', 'Rc1', 'Kf6', 'Rf1+', 'Ke5', 'Re1+', 'Kd6', 'Rd1+', 'Ke5', 'Re1+'],
      comments: {
        0: 'Stay on the 6th rank: the white king cannot step to e6, d6 or f6.',
        2: 'Just wait on the same rank.',
        5: 'The pawn steps onto the 6th rank. Now the white king has no shelter from checks.',
        6: 'Drop the rook all the way back.',
        8: 'Checks from behind. The king can never hide.',
        14: 'Endless checks: a draw.',
      },
    },
  },
];

export interface SquareQuizItem {
  fen: string;
  question: string;
  /** True: the king catches the pawn (draw). False: the pawn promotes. */
  answer: boolean;
  explanation: string;
}

export const SQUARE_QUIZ: SquareQuizItem[] = [
  {
    fen: '8/8/8/P7/8/8/5k2/7K b - - 0 1',
    question: 'Black to move. Can the black king catch the a-pawn?',
    answer: false,
    explanation: 'The pawn needs 3 moves. Its square goes from a5 to d8. Even after one step, Black’s king on f2 can’t reach it. The pawn promotes.',
  },
  {
    fen: '8/8/8/P7/8/4k3/8/7K b - - 0 1',
    question: 'Black to move. Can the black king catch the a-pawn?',
    answer: false,
    explanation: 'The square of the a5 pawn is a5 to d8. From e3 the king can only reach d4, which is one row too low. The pawn runs.',
  },
  {
    fen: '8/8/8/P7/4k3/8/8/7K b - - 0 1',
    question: 'Black to move. Can the black king catch the a-pawn?',
    answer: true,
    explanation: 'The square is a5 to d8. Black plays Kd5 and steps inside the square, so the king catches the pawn in time.',
  },
  {
    fen: '8/8/8/P7/4k3/8/8/7K w - - 0 1',
    question: 'Same position, but White to move. Can the black king catch the pawn now?',
    answer: false,
    explanation: 'White plays a6 first, so the square shrinks to a6 to c8. The king on e4 can’t step into it any more. Who moves first changes everything.',
  },
  {
    fen: '8/8/8/8/1P6/5k2/8/K7 b - - 0 1',
    question: 'Black to move. Can the black king catch the b-pawn?',
    answer: true,
    explanation: 'The b4 pawn needs 4 moves, so its square is b4 to f8. Black plays Ke4 or Kf4 and is inside. The pawn is caught.',
  },
  {
    fen: '8/8/8/8/1P6/5k2/8/K7 w - - 0 1',
    question: 'Same position, White to move. Can the black king catch the pawn?',
    answer: false,
    explanation: 'After b5 the square is b5 to e8. The king on f3 can’t step into it in one move. White wins the race.',
  },
  {
    fen: '8/8/8/6P1/8/2k5/8/K7 b - - 0 1',
    question: 'Black to move. Can the black king catch the g-pawn?',
    answer: false,
    explanation: 'The g5 pawn’s square is d5 to g8. From c3 the king reaches at most d4, which is outside. The pawn queens.',
  },
  {
    fen: '8/8/8/8/2P5/6k1/8/K7 b - - 0 1',
    question: 'Black to move. Can the black king catch the c-pawn?',
    answer: true,
    explanation: 'The c4 pawn needs 4 moves, so its square is c4 to g8. Black plays Kf4 or Kg4 and is inside the square in time.',
  },
];

/** Squares are adjacent (kings can’t stand next to each other). */
const adjacent = (a: string, b: string) =>
  Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) <= 1 && Math.abs(Number(a[1]) - Number(b[1])) <= 1;

/**
 * A random start for the checkmate drills: White king plus queen or rook
 * against the black king, White to move. The black king starts away from the
 * edge, isn't in check, and the white piece isn't hanging.
 */
export function randomStart(id: 'kqk' | 'krk', rng: () => number = Math.random): string {
  const sq = () => `${'abcdefgh'[Math.floor(rng() * 8)]}${1 + Math.floor(rng() * 8)}`;
  const piece = id === 'kqk' ? 'Q' : 'R';
  for (let tries = 0; tries < 1000; tries++) {
    const wk = sq();
    const p = sq();
    const bk = sq();
    if (new Set([wk, p, bk]).size < 3) continue;
    if (adjacent(wk, bk)) continue;
    // Not already on the edge: the drill is to drive it there.
    if ('ah'.includes(bk[0]) || '18'.includes(bk[1])) continue;
    // The black king must not be able to take the piece for free.
    if (adjacent(bk, p) && !adjacent(wk, p)) continue;
    const board: Record<string, string> = { [wk]: 'K', [p]: piece, [bk]: 'k' };
    const rows: string[] = [];
    for (let r = 8; r >= 1; r--) {
      let row = '';
      let empty = 0;
      for (const f of 'abcdefgh') {
        const x = board[`${f}${r}`];
        if (!x) empty++;
        else {
          if (empty) row += empty;
          empty = 0;
          row += x;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    const fen = `${rows.join('/')} w - - 0 1`;
    // Black must not be in check (White is to move).
    const c = new Chess(fen.replace(' w ', ' b '));
    if (c.isCheck()) continue;
    const w = new Chess(fen);
    if (w.isGameOver()) continue;
    return fen;
  }
  return id === 'kqk' ? ENDGAMES[0].positions[0] : ENDGAMES[1].positions[0];
}

export function endgame(id: Endgame['id']): Endgame | undefined {
  return ENDGAMES.find((e) => e.id === id);
}
