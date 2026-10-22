# ChessMaster

A personal chess trainer to go from 800 to 1500: openings, blunder checks,
tactics, planning, endgames, game review and practice games against human-like bots.

## Run it
```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

Every push to the working branch is built and published to GitHub Pages by
`.github/workflows/deploy.yml`.

## Credits and licenses
- [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL-3.0)
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
- [react-chessboard](https://github.com/Clariity/react-chessboard) (MIT)
- Opening names: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0)
