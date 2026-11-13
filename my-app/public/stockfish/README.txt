Stockfish.js 19 (lite, single-threaded), copied unmodified from the npm
package "stockfish" (node_modules/stockfish/bin). Used by the Skeetmate
review (src/games/chess/stockfish.js) and loaded only when Analysis is on.

License: GNU GPL v3 (COPYING.txt).
Source: https://github.com/nmrugg/stockfish.js
        https://github.com/official-stockfish/Stockfish

To update: npm install stockfish@latest, then copy
bin/stockfish-<version>-lite-single.js and .wasm here and change ENGINE_URL
in src/games/chess/stockfish.js if the file name changed.
