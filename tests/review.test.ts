import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROOT, lineEnd, parsePgn } from '../src/chess/moveTree';
import { START_FEN } from '../src/chess/utils';
import { bookDeparture } from '../src/modules/practice/book';
import { chessComGames, lichessGames, pastedGame, resultFor } from '../src/services/games';

afterEach(() => vi.unstubAllGlobals());

const PGN = '[Event "Live Chess"]\n[White "me"]\n[Black "you"]\n\n1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Nf3 2... Nc6 3. h3 1-0';

describe('importing games', () => {
  it('reads Chess.com games and works out my color and result', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/archives')) return new Response(JSON.stringify({ archives: ['https://api.chess.com/pub/player/me/games/2026/10'] }));
      return new Response(JSON.stringify({ games: [
        { url: 'https://www.chess.com/game/live/1', pgn: PGN, end_time: 1760000000, time_class: 'rapid', rules: 'chess', white: { username: 'Me', rating: 810, result: 'win' }, black: { username: 'you', rating: 790, result: 'resigned' } },
        { url: 'https://www.chess.com/game/live/2', pgn: PGN, end_time: 1760000100, time_class: 'blitz', rules: 'chess960', white: { username: 'x', rating: 1, result: 'win' }, black: { username: 'me', rating: 1, result: 'checkmated' } },
      ] }));
    }));
    const games = await chessComGames('me');
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ you: 'white', result: 'win', site: 'chess.com', timeClass: 'rapid' });
  });

  it('says clearly when a Chess.com player does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(chessComGames('nobody')).rejects.toThrow(/no player/);
  });

  it('reads Lichess games (one JSON per line)', async () => {
    const line = JSON.stringify({ id: 'abc', createdAt: 1760000000000, speed: 'rapid', winner: 'black', status: 'mate', pgn: PGN, players: { white: { user: { name: 'Bob' }, rating: 1500 }, black: { user: { name: 'Me' }, rating: 1200 } } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(line + '\n')));
    const games = await lichessGames('me');
    expect(games[0]).toMatchObject({ you: 'black', result: 'win', url: 'https://lichess.org/abc' });
  });
});

describe('Chess.com problems and pasted games', () => {
  it('explains when Chess.com refuses to send the games', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/archives') ? new Response(JSON.stringify({ archives: ['a/2026/09', 'a/2026/10'] })) : new Response('', { status: 403 }),
    ));
    await expect(chessComGames('me')).rejects.toThrow(/refused to send the games/);
  });

  it('reads a pasted Chess.com PGN and finds me by username', () => {
    const g = pastedGame('[White "Rival"]\n[Black "Me"]\n[Result "0-1"]\n[UTCDate "2026.10.20"]\n\n1. e4 e5 0-1', 'me');
    expect(g).toMatchObject({ you: 'black', result: 'win', playedAt: '2026-10-20T12:00:00.000Z' });
  });

  it('works out results, with unfinished games as draws', () => {
    expect(resultFor('1-0', 'white')).toBe('win');
    expect(resultFor('1-0', 'black')).toBe('loss');
    expect(resultFor('0-1', 'black')).toBe('win');
    expect(resultFor('*', 'black')).toBe('draw');
  });
});

describe('reading game PGNs', () => {
  it('drops clock data from comments', () => {
    const { tree } = parsePgn(PGN);
    const end = lineEnd(tree, ROOT);
    expect(tree.nodes[end].san).toBe('h3');
    expect(Object.values(tree.nodes).some((n) => n.comment)).toBe(false);
  });
});

describe('opening book departure', () => {
  it('finds where I left the book and the book move', () => {
    const d = bookDeparture(START_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'h3'], 'w')!;
    expect(d.index).toBe(4);
    expect(d.byYou).toBe(true);
    expect(d.book.map((b) => b.san)).toEqual(expect.arrayContaining(['Bc4', 'Bb5', 'd4']));
    expect(d.line).toMatch(/Nc6|Italian|Ruy|Scotch|1\.\.\.e5/);
  });

  it('says when a game followed the book to the end of a lesson line', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3', 'Nb4'];
    const d = bookDeparture(START_FEN, moves, 'w')!;
    expect(d.ended).toBe(true);
    expect(d.line).toMatch(/Fried Liver/);
  });

  it('notices when the opponent leaves the book', () => {
    const d = bookDeparture(START_FEN, ['e4', 'a6'], 'w')!;
    expect(d.byYou).toBe(false);
  });
});
