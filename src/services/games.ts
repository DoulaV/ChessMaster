// Import your recent games from Chess.com and Lichess (public APIs, no login).

export interface ImportedGame {
  id: string;
  site: 'chess.com' | 'lichess';
  url: string;
  pgn: string;
  /** ISO time (UTC). */
  playedAt: string;
  white: { name: string; rating: number | null };
  black: { name: string; rating: number | null };
  /** Your color in this game. */
  you: 'white' | 'black';
  result: 'win' | 'loss' | 'draw';
  timeClass: string;
}

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

interface ChessComGame {
  url: string;
  pgn?: string;
  end_time: number;
  time_class: string;
  rules: string;
  white: { username: string; rating: number; result: string };
  black: { username: string; rating: number; result: string };
}

/** The last `max` games from the most recent monthly archives. */
export async function chessComGames(user: string, max = 20): Promise<ImportedGame[]> {
  const u = user.trim().toLowerCase();
  const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  if (res.status === 404) throw new Error(`Chess.com has no player called “${user}”.`);
  if (!res.ok) throw new Error('Chess.com did not answer. Try again in a minute.');
  const { archives } = (await res.json()) as { archives: string[] };
  const out: ImportedGame[] = [];
  let failed = 0;
  const months = [...archives].reverse().slice(0, 3);
  for (const url of months) {
    let r: Response;
    try {
      r = await fetch(url);
    } catch {
      failed++;
      continue;
    }
    if (!r.ok) {
      failed++;
      continue;
    }
    const { games } = (await r.json()) as { games: ChessComGame[] };
    for (const g of [...games].reverse()) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      const you = g.white.username.toLowerCase() === u ? 'white' : 'black';
      const mine = you === 'white' ? g.white.result : g.black.result;
      out.push({
        id: `cc:${g.url.split('/').pop()}`,
        site: 'chess.com',
        url: g.url,
        pgn: g.pgn,
        playedAt: new Date(g.end_time * 1000).toISOString(),
        white: { name: g.white.username, rating: g.white.rating },
        black: { name: g.black.username, rating: g.black.rating },
        you,
        result: mine === 'win' ? 'win' : DRAWS.has(mine) ? 'draw' : 'loss',
        timeClass: g.time_class,
      });
      if (out.length >= max) return out;
    }
  }
  if (!out.length && months.length && failed === months.length) {
    throw new Error('Chess.com found your account but refused to send the games right now. Try again in a minute, or paste a game below.');
  }
  return out;
}

/** Your result from a PGN result tag. Unfinished games ("*") count as draws. */
export function resultFor(res: string, you: 'white' | 'black'): 'win' | 'loss' | 'draw' {
  if (res === '1-0') return you === 'white' ? 'win' : 'loss';
  if (res === '0-1') return you === 'black' ? 'win' : 'loss';
  return 'draw';
}

/** A single game pasted as PGN (e.g. from Chess.com: Share, then PGN). */
export function pastedGame(pgn: string, username: string): ImportedGame {
  const tag = (k: string) => pgn.match(new RegExp(`\\[${k} "([^"]*)"\\]`))?.[1] ?? '';
  const white = tag('White') || 'White';
  const black = tag('Black') || 'Black';
  const u = username.trim().toLowerCase();
  const you: 'white' | 'black' = u && black.toLowerCase() === u ? 'black' : 'white';
  const result = resultFor(tag('Result'), you);
  const date = tag('UTCDate') || tag('Date');
  const iso = /^\d{4}\.\d{2}\.\d{2}$/.test(date) ? new Date(date.replace(/\./g, '-') + 'T12:00:00Z').toISOString() : new Date().toISOString();
  return {
    id: `pgn:${white}-${black}-${date}-${pgn.length}`,
    site: tag('Site').toLowerCase().includes('lichess') ? 'lichess' : 'chess.com',
    url: tag('Link') || tag('Site'),
    pgn,
    playedAt: iso,
    white: { name: white, rating: Number(tag('WhiteElo')) || null },
    black: { name: black, rating: Number(tag('BlackElo')) || null },
    you,
    result,
    timeClass: tag('TimeControl') || 'game',
  };
}

interface LichessGame {
  id: string;
  createdAt: number;
  speed: string;
  winner?: 'white' | 'black';
  status: string;
  pgn?: string;
  players: {
    white: { user?: { name: string }; rating?: number };
    black: { user?: { name: string }; rating?: number };
  };
}

export async function lichessGames(user: string, max = 20): Promise<ImportedGame[]> {
  const u = user.trim();
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(u)}?max=${max}&pgnInJson=true&clocks=false&evals=false`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (res.status === 404) throw new Error(`Lichess has no player called “${user}”.`);
  if (!res.ok) throw new Error('Lichess did not answer. Try again in a minute.');
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessGame)
    .filter((g) => g.pgn)
    .map((g) => {
      const you = g.players.white.user?.name.toLowerCase() === u.toLowerCase() ? 'white' : 'black';
      return {
        id: `li:${g.id}`,
        site: 'lichess' as const,
        url: `https://lichess.org/${g.id}`,
        pgn: g.pgn!,
        playedAt: new Date(g.createdAt).toISOString(),
        white: { name: g.players.white.user?.name ?? 'Anonymous', rating: g.players.white.rating ?? null },
        black: { name: g.players.black.user?.name ?? 'Anonymous', rating: g.players.black.rating ?? null },
        you,
        result: !g.winner ? 'draw' : g.winner === you ? 'win' : 'loss',
        timeClass: g.speed,
      } satisfies ImportedGame;
    });
}
