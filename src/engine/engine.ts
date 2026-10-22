// Talks to Stockfish over the UCI text protocol. Stockfish runs in its own
// Web Worker so the page never freezes while it thinks.
//
// Only one search runs at a time. Starting a new search stops the old one,
// so screens can just ask for "analyse this position" whenever it changes.

export interface Score {
  /** Centipawns from White's point of view (100 = one pawn). */
  cp: number;
  /** Moves to mate from White's point of view (+ White mates, - Black mates). */
  mate: number | null;
}

export interface EngineLine {
  multipv: number;
  depth: number;
  score: Score;
  /** Moves in UCI form, e.g. "e2e4". */
  pv: string[];
}

export interface AnalyseOptions {
  depth?: number;
  multipv?: number;
  /** Called with the lines found so far, each time the engine goes one level deeper. */
  onUpdate?: (lines: EngineLine[]) => void;
}

/** Something that can send UCI commands and receive output lines. */
export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

export function workerTransport(url: string): UciTransport {
  const worker = new Worker(url);
  return {
    send: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (e: MessageEvent) => cb(String(e.data));
    },
    terminate: () => worker.terminate(),
  };
}

const MATE_CP = 100000;

/** A single number for sorting and eval bars: mate scores become huge. */
export function scoreToCp(s: Score): number {
  if (s.mate !== null) return s.mate > 0 ? MATE_CP - s.mate : -MATE_CP - s.mate;
  return s.cp;
}

export function parseInfo(line: string, whiteToMove: boolean): EngineLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ')) return null;
  const t = line.split(' ');
  const get = (k: string) => {
    const i = t.indexOf(k);
    return i >= 0 ? t[i + 1] : undefined;
  };
  const depth = Number(get('depth'));
  const multipv = Number(get('multipv') ?? 1);
  const si = t.indexOf('score');
  if (si < 0) return null;
  const kind = t[si + 1];
  const val = Number(t[si + 2]);
  // Stockfish scores from the side to move; we always store White's view.
  const sign = whiteToMove ? 1 : -1;
  const score: Score =
    kind === 'mate' ? { cp: 0, mate: val * sign } : { cp: val * sign, mate: null };
  if (kind === 'mate') score.cp = scoreToCp(score);
  const pv = t.slice(t.indexOf('pv') + 1);
  return { depth, multipv, score, pv };
}

interface Job {
  fen: string;
  opts: AnalyseOptions;
  resolve: (lines: EngineLine[]) => void;
  lines: Map<number, EngineLine>;
  cancelled: boolean;
}

export class Engine {
  private transport: UciTransport;
  private ready: Promise<void>;
  private current: Job | null = null;
  private queue: Job[] = [];
  private lastDepth = 0;

  constructor(transport: UciTransport) {
    this.transport = transport;
    let markReady: () => void = () => {};
    this.ready = new Promise((r) => (markReady = r));
    transport.onLine((line) => {
      if (line === 'readyok') markReady();
      else this.handle(line);
    });
    transport.send('uci');
    transport.send('setoption name Hash value 32');
    transport.send('isready');
  }

  private handle(line: string) {
    const job = this.current;
    if (!job) return;
    if (line.startsWith('bestmove')) {
      this.current = null;
      job.resolve(this.sorted(job));
      this.next();
      return;
    }
    const info = parseInfo(line, job.fen.split(' ')[1] === 'w');
    if (!info || job.cancelled) return;
    if (info.multipv === 1 && info.depth !== this.lastDepth && job.lines.size > 0) {
      // A new depth started; report the completed previous depth.
      job.opts.onUpdate?.(this.sorted(job));
    }
    this.lastDepth = info.depth;
    job.lines.set(info.multipv, info);
  }

  private sorted(job: Job): EngineLine[] {
    return [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
  }

  private async next() {
    const job = this.queue.shift();
    if (!job) return;
    await this.ready;
    this.current = job;
    this.lastDepth = 0;
    this.transport.send(`setoption name MultiPV value ${job.opts.multipv ?? 1}`);
    this.transport.send(`position fen ${job.fen}`);
    this.transport.send(`go depth ${job.opts.depth ?? 14}`);
  }

  /** Analyse a position. Resolves with the final lines when the search ends. */
  analyse(fen: string, opts: AnalyseOptions = {}): Promise<EngineLine[]> {
    return new Promise((resolve) => {
      const job: Job = { fen, opts, resolve, lines: new Map(), cancelled: false };
      this.queue.push(job);
      if (!this.current) this.next();
    });
  }

  /** Stop everything running or waiting. Pending promises resolve with what they have. */
  stopAll() {
    for (const j of this.queue) j.resolve([]);
    this.queue = [];
    if (this.current) {
      this.current.cancelled = true;
      this.transport.send('stop');
    }
  }

  /** Stop current work, then analyse. Use for live analysis that follows the board. */
  analyseLatest(fen: string, opts: AnalyseOptions = {}): Promise<EngineLine[]> {
    this.stopAll();
    return this.analyse(fen, opts);
  }

  terminate() {
    this.transport.terminate();
  }
}

let shared: Engine | null = null;
let background: Engine | null = null;

const engineUrl = () => `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`;

/** The main engine (analysis board, bot moves). */
export function getEngine(): Engine {
  shared ??= new Engine(workerTransport(engineUrl()));
  return shared;
}

/** A second engine for side jobs (threat view, move explanations) so they don't interrupt the main one. */
export function getBackgroundEngine(): Engine {
  background ??= new Engine(workerTransport(engineUrl()));
  return background;
}
