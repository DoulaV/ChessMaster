# Progress

## Plan (build order)
1. ✅ Project setup, board, chess.js, Stockfish in a Web Worker, **Analysis Mode**
2. ✅ Opening Library (first 3 openings) + dark chess-site style UI
   ✅ Blunder Check Trainer
3. ✅ Practice Mode with coaching levels
4. ✅ Tactics, Planning, Endgames, Game Review
5. ✅ Dashboard and the remaining openings

## Done
### Phase 1: Foundations and Analysis Mode
- React + Vite + TypeScript + Tailwind, installable as a phone app (PWA, works offline).
- Board: drag or tap-tap to move, legal-move dots, arrows, highlights, promotion picker.
- Stockfish 19 (lite, single-threaded) in a Web Worker. Two engines: one for live
  analysis, one for side jobs (threat view, explanations).
- Analysis board:
  - Set up a position by tapping pieces, paste a FEN or PGN, or upload a .pgn file.
  - Engine on/off (off by default), eval bar, top 3 lines as arrows, adjustable depth.
  - Move tree with side lines, comments, "make main line", delete.
  - "Explain this move": plain-language verdict using engine + detectors
    (hanging pieces, forks, pins, mate threats).
  - Threat view: what the opponent would play if it were their move.
  - Show hanging pieces for both sides.
  - Think first: guess the evaluation and best move, then compare with the engine.
  - Opening name and ECO code for every position (Lichess open opening list).
  - Lichess explorer stats at your level (needs an optional free Lichess token in Settings).
  - Save to "My studies", export FEN/PGN, download PGN, copy/open Lichess link.
  - Other screens can open any position or game here (`analysisPath()` in
    `src/modules/analysis/handoff.ts`).
- Saved data goes through `src/progress/store.ts` (versioned slots, localStorage today).

### Phase 2: Opening Library
- New look: dark theme in the style of popular chess sites (green board, 3D green buttons,
  dark sidebar, numbered move list). No third-party logos or names.
- Opening data format (`src/data/openings/types.ts`): lines of [move, why], merged into a tree.
- Full lessons for the first 3 openings in the path:
  - Italian Game (5 lines: Giuoco Piano, Pianissimo, Evans, Two Knights 4.Ng5, Fried Liver)
  - 1...e5 for Black (9 lines: Petrov main, 3.d4, Four Knights, Philidor, and answers to
    2.Qh5, 2.Bc4, 2.Nc3/f4, 2.d4, 2.f4)
  - Queen's Gambit Declined (4 lines: Orthodox, Exchange, 5.Bf4, against the London)
  - Each has character, THE PLAN, piece placement, goals, off-book advice, traps, model games.
- Depth by rating: 8 moves under 1000, 10 under 1300, 12 above.
- Modes: Learn, Drill (SM-2 cards), Play-out vs human-like bot, Recognize quiz (all 24
  openings), Review queue. Mastery = 90%+ full drill on 3 separate days.
- Learning path of 15 steps, reorderable; one step at a time; locked openings are read-only.
- Library map of all 24 openings (mastered / studying / locked / lesson coming soon).
- Human-like bot (`src/engine/humanBot.ts`) with 6 levels (600 to 1600).
- Tests check every line is legal, every move is explained, and every line's ECO code and
  name match the official Lichess list exactly.

### Phase 2b: All 24 openings
- Full lessons for every opening in the library (24), written in parallel and checked by
  `src/data/openings/validate.ts`: legal moves, a real explanation for every move, official
  ECO code and name for every line, plan, off-book tips, traps, model games, no em dashes.
- Extra engine audit: Stockfish replayed every line and flagged any book move losing more
  than 1.5 pawns. One flawed London line was found and shortened; the re-run was clean.
- Queen's Gambit Accepted is a bonus opening, unlocked when the QGD is mastered.
- Model games: real historical games where every move is certain (Greco 1620, Opera Game,
  Legal's Mate, Immortal Game); all others are clearly labelled teaching games.

### Phase 2c: Blunder Check Trainer
- The 4-question checklist as a habit card (reused later in Practice Mode).
- Spot the threat, Is it safe? and timed Hanging pieces, 10 positions per round.
- Positions come from all opening lessons (realistic), pre-built into
  `src/data/blunder.json` by `npm run gen:blunder` and checked with Stockfish:
  - threats count only if "passing" lets the opponent win 2+ pawns more;
  - "safe" = loses at most 0.6 pawns, "blunder" = loses 2+ pawns vs the best move;
  - explanations that blame the wrong capture are replaced by an always-true sentence.
- Rounds of Is it safe? are 5 safe + 5 blunder moves, so guessing doesn't work.
- Stats saved per day (for the streak and dashboard), best hanging-pieces time.
- Pattern detectors made about 4x faster (only look at pieces that attack a square).

### Phase 3: Practice Mode
- Setup: bot 600 to 1600, color (white/black/random), normal start / an opening from the
  library / custom FEN, time control (none, 10, 15+10, 30), coach (Full, Light, None).
- Bots play real book moves from the 24 lessons (weighted to main lines), then the
  human-like engine. "In book" banner; alert when you or the bot leave the book.
- Full coach: checklist, your hanging pieces in red, mate threats in yellow, and a warning
  with explanation + takeback when a move loses about 1.5+ pawns. Light coach: only big
  blunders (2+ pawns or allowing mate).
- Hints: 3 per game; each hint goes words -> piece highlight -> arrow.
- Takebacks counted; wins with takebacks don't count toward levelling up.
- After the game: Stockfish review (accuracy like Lichess, blunder/mistake counts, top 3
  mistakes with tags and explanations, turning point), mistakes saved as personal puzzles
  (`src/progress/puzzles.ts`), Open in Analysis, results per bot level, level-up
  suggestion after 3 wins in the last 5 games.
- Navigation: Play added to the bottom bar; Studies and Settings are buttons on Home (phone).

### Phase 4: Tactics, Planning, Think-with-me coach
- Tactics: 22,500 Lichess puzzles (CC0) rated 800 to 1600 in 9 themes (built by
  `scripts/build-puzzles.mjs`), adaptive Elo-style puzzle rating, daily set of 15 (due
  personal puzzles first, then weakest themes), theme practice, optional "only openings I've
  studied" filter, personal puzzles from practice games with spaced repetition.
- Planning: 7 lessons with 2 examples each, 36 "What's the plan?" positions from the ends of
  real lines in all 24 openings (first moves checked with Stockfish), Candidate moves
  (enter 3 moves, Stockfish ranks them).
- Practice Mode, coaching modes: unlimited "Think with me" coach: 6 questions answered from
  the position (opponent's last move, danger, checks, captures with exchange counting,
  threats, worst piece / opening plan), a plan that carries over to the next move, a safety
  check that tests a move before it counts, "show the best move" with a reason, and a meter
  of moves found without help (suggests Light coach / No help when you're ready).
  The 3-hint limit now only applies to No help games.
- Phone navigation: Home, Openings, Play, Train (Tactics, Blunder Check, Planning), Analysis.

### Phase 5: Endgames, Game Review, Dashboard
- Endgames (`src/data/endgames.ts`, every position verified with Stockfish at depth 22+):
  KQ vs K, KR vs K (with random starts), king on the 6th, opposition (win, plus a defense
  exercise), square rule (+ 8-question quiz), Lucena, Philidor. Practice vs Stockfish's
  best defense with hints; results judged by `src/modules/endgames/judge.ts`; mastered
  after 3 successes.
- Game Review: import recent games from Chess.com or Lichess (public APIs, no login),
  Stockfish review, blunders tagged by reason, where you left the opening book (or that you
  followed it to the end of a lesson line), mistakes added to personal puzzles, Open in
  Analysis at any move, link back to the game.
- Dashboard (Home): daily streak, today's plan (opening drill, blunder check, 15 puzzles,
  one game) with automatic ticks, current opening and library map, roadmap to 1500 in 4
  stages with checklists computed from your progress, charts (puzzle rating, blunders per
  game, win rate per bot, most common mistakes) with hover tooltips and table view.

## Next
- Everything in the original spec is built. Ideas: more puzzles per theme, more model
  games, Arabic/RTL, a backend for syncing between devices.

## Known issues / notes
- Queen's Gambit Accepted is not in the 15-step path; it unlocks as a bonus after the QGD.
- The QGD model game is a teaching game (the Elephant Trap), not a famous historical game.
- Most model games are teaching games, not famous games (only used famous games whose
  every move was certain).
- The Lichess explorer requires a personal token since 2025; without one the stats panel
  just shows how to add it.
- Ratings: the user's rating is Chess.com. Explorer uses Lichess bands about 350 higher.
- Eco data (`src/data/eco.json`) is generated by `node scripts/build-eco.mjs`.
