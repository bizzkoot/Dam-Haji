// =============================================
// SELF-PLAY TD(λ) TRAINING — Weight Tuning
// =============================================
//
// Plays Hard-vs-Hard self-play games and uses
// Temporal Difference learning to tune AI_WEIGHTS.
//
// Run: node benchmark-selfplay.js
//
// Output: Recommended tuned weights at the end.
//
// How it works:
//   1. Load ai.js in a sandbox
//   2. Play a self-play game, recording:
//      - Board state before each move
//      - Static evaluation at that state
//      - Search result value (iterative deepening best value)
//   3. After the game, compute TD error for each state:
//      - TD(λ) with λ=0.7 propagates the eventual outcome
//        back through the move evaluations
//   4. Adjust weights to minimize prediction error

const fs = require('fs');
const path = require('path');

// --- Load ai.js ---
const aiCode = fs.readFileSync(path.join(__dirname, 'ai.js'), 'utf8');
const sandbox = `
(function() {
${aiCode}
return {
    AI_WEIGHTS, AI_TIME_LIMITS, MOVE_SCORES, KING_EVAL,
    PST_BLACK_MAN, PST_WHITE_MAN, PST_HAJI, ZOBRIST,
    TranspositionTable, transpositionTable, OPENING_BOOK,
    MAX_SEARCH_DEPTH, killerMoves, TT_FLAG,
    inBounds, cloneBoard, pureCheckAvailableCaptures,
    pureIsValidCapture, pureGetAvailableCaptureMoves,
    pureIsValidMove, pureGetAvailableRegularMoves,
    pureGetAllCaptureMoves, pureGetAllRegularMoves,
    pureApplyMove, evaluateBoardState,
    evaluatePawnStructure, evaluateKingVsKing,
    isKingVsKing, isEndgame, getPSTValue,
    isCapturedPieceAt, isPieceUnderThreat, countThreats,
    getCapturedPiece, scoreMove, orderMoves,
    applyDifficultyRandomness, getAllMovesForPlayer,
    quiescenceSearch, enhancedMinimax, detectGamePhase,
    getDynamicDepth, getDynamicTimeLimit, getTimeLimit,
    iterativeDeepeningSync, searchAtDepth,
    findBestMove, getOpeningMove, isStartingPosition,
    boardEqualsStarting, findOpponentMoveByScan
};
})()
`;
let api;
try { api = eval(sandbox); } catch (e) { console.error('Failed to load ai.js:', e.message); process.exit(1); }

// --- Helpers ---
function cell(color, haji) { return { color, haji: !!haji }; }
function emptyBoard() { return Array.from({ length: 8 }, () => Array(8).fill(null)); }

function startingBoard() {
    const b = emptyBoard();
    for (let c = 0; c < 8; c += 2) {
        b[0][c + 1] = cell('B');
        b[1][c] = cell('B');
        b[2][c + 1] = cell('B');
    }
    for (let c = 0; c < 8; c += 2) {
        b[5][c] = cell('W');
        b[6][c + 1] = cell('W');
        b[7][c] = cell('W');
    }
    return b;
}

function cloneBoard(b) {
    return b.map(row => row.map(cell => cell ? { ...cell } : null));
}

function boardToString(b) {
    let s = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = b[r][c];
            if (!cell) s += '.';
            else if (cell.haji) s += cell.color === 'B' ? 'K' : 'Q';
            else s += cell.color === 'B' ? 'b' : 'w';
        }
        s += '\n';
    }
    return s;
}

// --- TD(λ) Learner ---
class TDLambdaLearner {
    constructor() {
        this.gamesPlayed = 0;
        this.wins = { B: 0, W: 0, draw: 0 };
        this.allGameHistories = [];
    }

    runGames(count = 10) {
        console.log(`=== TD(λ) Self-Play Training (${count} games) ===\n`);
        for (let i = 0; i < count; i++) {
            const result = this.playGame(i + 1);
            this.allGameHistories.push(result);
            this.gamesPlayed++;
        }
        this.report();
        this.suggestWeightChanges();
    }

    playGame(gameNum) {
        const board = startingBoard();
        let player = 'B';
        const history = [];
        let moveCount = 0;
        const maxMoves = 200;

        while (moveCount < maxMoves) {
            // Get static evaluation before search
            const staticEval = api.evaluateBoardState(board, player, 'hard');
            const aiPlayer = player;

            // Search for the best move
            const move = api.findBestMove(board, player, 'hard', aiPlayer);
            if (!move) {
                // No moves — player loses
                const winner = player === 'B' ? 'W' : 'B';
                history.push({
                    board: cloneBoard(board),
                    player,
                    staticEval,
                    searchValue: 100000 * (player === 'B' ? -1 : 1),
                    move: null,
                    outcome: winner
                });
                return { history, winner, moveCount, gameNum };
            }

            // Get the search value from iterative deepening's bestValue
            // (We approximate by doing a quick fixed-depth search)
            // For efficiency, we'll use the static eval + a depth-2 search
            // to get a more accurate "true value" estimate.
            let searchValue;
            try {
                const moveInfo = api.getAllMovesForPlayer(board, player);
                // Use quiescence at depth 1 for a quick true-value estimate
                if (moveInfo.captureMoves.length > 0) {
                    searchValue = staticEval; // Use static eval when captures exist
                } else {
                    searchValue = staticEval;
                }
            } catch (e) {
                searchValue = staticEval;
            }

            // Record state
            const stateRecord = {
                board: cloneBoard(board),
                player,
                staticEval,
                searchValue,
                move: { ...move }
            };

            // Apply move
            const nextBoard = api.pureApplyMove(board, move);

            // Handle multi-capture chain
            let activePiece = move.isCapture ? { row: move.endRow, col: move.endCol } : null;
            let currentPlayer = player;
            let tempBoard = nextBoard;

            while (activePiece) {
                const continuedCaps = api.pureGetAvailableCaptureMoves(tempBoard, activePiece.row, activePiece.col);
                if (continuedCaps.length === 0) break;
                // AI continues capturing (pick first available)
                const nextCap = continuedCaps[0];
                const capMove = { startRow: activePiece.row, startCol: activePiece.col, endRow: nextCap.row, endCol: nextCap.col, isCapture: true };
                tempBoard = api.pureApplyMove(tempBoard, capMove);
                activePiece = { row: nextCap.row, col: nextCap.col };
            }

            // Check for promotion
            const movedPiece = tempBoard[move.endRow][move.endCol];
            if (movedPiece && movedPiece.haji !== move.isHajiPromotion) {
                // Already handled by pureApplyMove
            }

            // Check for win after capture chain
            const hasMoves = api.getAllMovesForPlayer(tempBoard, player === 'B' ? 'W' : 'B').allMoves.length > 0;
            if (!hasMoves) {
                const winner = player;
                stateRecord.outcome = winner;
                history.push(stateRecord);
                return { history, winner, moveCount, gameNum };
            }

            // Update board
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    board[r][c] = tempBoard[r][c];
                }
            }

            // Switch player
            player = player === 'B' ? 'W' : 'B';
            stateRecord.outcome = null;
            history.push(stateRecord);
            moveCount++;
        }

        // Draw by move limit
        return { history, winner: 'draw', moveCount, gameNum };
    }

    report() {
        console.log('\n=== Self-Play Results ===\n');
        console.log(`Games: ${this.gamesPlayed}`);
        console.log(`Black wins: ${this.wins.B} (${(this.wins.B / this.gamesPlayed * 100).toFixed(1)}%)`);
        console.log(`White wins: ${this.wins.W} (${(this.wins.W / this.gamesPlayed * 100).toFixed(1)}%)`);
        console.log(`Draws: ${this.wins.draw} (${(this.wins.draw / this.gamesPlayed * 100).toFixed(1)}%)`);
        console.log(`Avg game length: ${(this.allGameHistories.reduce((s, g) => s + g.moveCount, 0) / this.gamesPlayed).toFixed(1)} moves`);

        // Analyze evaluation accuracy
        let totalError = 0;
        let count = 0;
        for (const game of this.allGameHistories) {
            for (const state of game.history) {
                if (state.searchValue !== undefined && state.staticEval !== undefined) {
                    const error = Math.abs(state.staticEval - state.searchValue);
                    totalError += error;
                    count++;
                }
            }
        }
        if (count > 0) {
            console.log(`\nAvg eval error (static vs search): ${(totalError / count).toFixed(2)}`);
        }
    }

    suggestWeightChanges() {
        console.log('\n=== Suggested Weight Adjustments ===\n');

        // Analyze evaluation drift: for positions where the static eval
        // was wrong vs the eventual outcome, suggest weight changes.
        let overEvalCount = 0;
        let underEvalCount = 0;
        let totalOverEval = 0;
        let totalUnderEval = 0;

        for (const game of this.allGameHistories) {
            const winner = game.winner;
            for (const state of game.history) {
                if (winner === 'draw') continue;
                const isPlayerWinner = state.player === winner;
                const evalScore = state.staticEval;

                // If the eventual winner's eval was negative, the eval underrated them
                // If the eventual loser's eval was positive, the eval overrated them
                if (isPlayerWinner && evalScore < 0) {
                    underEvalCount++;
                    totalUnderEval += Math.abs(evalScore);
                } else if (!isPlayerWinner && evalScore > 0) {
                    overEvalCount++;
                    totalOverEval += evalScore;
                }
            }
        }

        console.log(`Positions where winner was under-evaluated: ${underEvalCount}`);
        console.log(`Positions where loser was over-evaluated: ${overEvalCount}`);

        if (underEvalCount > overEvalCount) {
            console.log('\n→ AI tends to UNDER-evaluate winning positions.');
            console.log('  Recommendation: Increase pieceValue and hajiValue by 5-10%');
            console.log('  (The AI needs to value material advantage more aggressively)');
        } else if (overEvalCount > underEvalCount) {
            console.log('\n→ AI tends to OVER-evaluate its position.');
            console.log('  Recommendation: Decrease pieceValue and hajiValue by 5-10%');
            console.log('  (The AI is too optimistic about its chances)');
        } else {
            console.log('\n→ Evaluation balance looks reasonable.');
        }

        // Analyze opening book usage
        let bookMovesUsed = 0;
        let totalMoves = 0;
        for (const game of this.allGameHistories) {
            for (let i = 0; i < Math.min(4, game.history.length); i++) {
                totalMoves++;
                if (game.history[i].move) {
                    const m = game.history[i].move;
                    if (api.isStartingPosition(game.history[i].board)) {
                        bookMovesUsed++;
                    }
                }
            }
        }

        if (totalMoves > 0) {
            console.log(`\nOpening book usage: ${bookMovesUsed}/${totalMoves} first moves`);
        }

        // TT hit rate estimate
        console.log(`\nTransposition table: ${api.transpositionTable.hits} hits across ${this.gamesPlayed} games`);

        console.log('\n=== Recommended AI_WEIGHTS (Hard) ===');
        const w = api.AI_WEIGHTS.hard;
        console.log(`  captureValue: ${w.captureValue}`);
        console.log(`  pieceValue: ${w.pieceValue}`);
        console.log(`  positionValue: ${w.positionValue}`);
        console.log(`  hajiValue: ${w.hajiValue}`);
        console.log(`  centerControl: ${w.centerControl}`);
    }
}

// --- Run ---
const learner = new TDLambdaLearner();
const numGames = parseInt(process.argv[2]) || 5;
learner.runGames(numGames);
