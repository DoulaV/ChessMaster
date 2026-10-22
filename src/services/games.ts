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
  for (const url of [...archives].reverse().slice(0, 3)) {
    const r = await fetch(url);
    if (!r.ok) continue;
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
  return out;
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
