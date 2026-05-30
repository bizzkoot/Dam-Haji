// =============================================
// AI BENCHMARK — Measures search performance
// and verifies AI fixes
// =============================================
//
// Run: node benchmark.js
//
// Tests positions at each difficulty level and
// reports: best move, score, depth, time

// --- Fast mock for browser globals ---
// The AI code uses Math.random only, and no DOM.
// But evaluateBoardState references AI_WEIGHTS and PST tables
// which are all in ai.js scope. We just need to load ai.js.

const fs = require('fs');
const path = require('path');

console.log('=== Dam Haji AI Benchmark ===\n');

// Load ai.js as a string and evaluate it to get the functions into scope
const aiCode = fs.readFileSync(path.join(__dirname, 'ai.js'), 'utf8');

// Wrap in a function to capture exports
const sandbox = `
(function() {
${aiCode}
return {
    AI_WEIGHTS,
    AI_TIME_LIMITS,
    MOVE_SCORES,
    KING_EVAL,
    PST_BLACK_MAN,
    PST_WHITE_MAN,
    PST_HAJI,
    ZOBRIST,
    TranspositionTable,
    transpositionTable,
    OPENING_BOOK,
    MAX_SEARCH_DEPTH,
    killerMoves,
    TT_FLAG,
    inBounds,
    cloneBoard,
    pureCheckAvailableCaptures,
    pureIsValidCapture,
    pureGetAvailableCaptureMoves,
    pureIsValidMove,
    pureGetAvailableRegularMoves,
    pureGetAllCaptureMoves,
    pureGetAllRegularMoves,
    pureApplyMove,
    evaluateBoardState,
    evaluateKingVsKing,
    evaluateEndgame,
    isKingVsKing,
    isEndgame,
    getPSTValue,
    isCapturedPieceAt,
    isPieceUnderThreat,
    countThreats,
    getCapturedPiece,
    scoreMove,
    orderMoves,
    applyDifficultyRandomness,
    getAllMovesForPlayer,
    quiescenceSearch,
    enhancedMinimax,
    detectGamePhase,
    getDynamicDepth,
    getDynamicTimeLimit,
    getTimeLimit,
    iterativeDeepeningSync,
    searchAtDepth,
    findBestMove,
    getOpeningMove,
    isStartingPosition
};
})()
`;

let api;
try {
    api = eval(sandbox);
} catch (e) {
    console.error('Failed to load ai.js:', e.message);
    process.exit(1);
}

// =============================================
// TEST POSITIONS
// =============================================

function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function cell(color, haji = false) {
    return { color, haji };
}

const positions = {
    // Opening position: standard Dam Haji setup
    opening: {
        name: 'Opening (Standard Setup)',
        board: (() => {
            const b = emptyBoard();
            // Black pieces on rows 0-2
            for (let c = 0; c < 8; c += 2) {
                b[0][c + 1] = cell('B');
                b[1][c] = cell('B');
                b[2][c + 1] = cell('B');
            }
            // White pieces on rows 5-7
            for (let c = 0; c < 8; c += 2) {
                b[5][c] = cell('W');
                b[6][c + 1] = cell('W');
                b[7][c] = cell('W');
            }
            return b;
        })()
    },

    // Endgame: few pieces, no kings
    endgame_simple: {
        name: 'Endgame (Few Pieces)',
        board: (() => {
            const b = emptyBoard();
            b[2][1] = cell('B');
            b[3][2] = cell('B');
            b[5][4] = cell('W');
            b[6][5] = cell('W');
            return b;
        })()
    },

    // Capture chain position: AI can take multiple pieces
    capture_chain: {
        name: 'Capture Chain (AI Multi-capture)',
        board: (() => {
            const b = emptyBoard();
            // Black piece at (2, 3) with two white pieces to capture in sequence
            b[2][3] = cell('B');
            b[3][4] = cell('W');
            // After capturing (2,3)->(4,5), the piece at (4,5) can capture (5,6)
            // Wait, that's not right. Let me set up a proper chain.
            b[1][2] = cell('B');
            b[2][3] = cell('B');  // This piece can capture
            b[3][4] = cell('W');  // Capture this first -> lands at (4,5)
            b[5][6] = cell('W');  // From (4,5), can capture this -> lands at (6,7)
            // Additional white pieces to make material count realistic
            b[5][2] = cell('W');
            b[6][3] = cell('W');
            return b;
        })()
    },

    // AI under pressure: opponent has threats
    under_threat: {
        name: 'Under Threat (AI piece endangered)',
        board: (() => {
            const b = emptyBoard();
            b[3][2] = cell('B');
            b[4][3] = cell('W');  // White can capture black at (3,2) -> lands at (2,1)
            b[4][5] = cell('W');
            b[5][4] = cell('B');
            b[6][5] = cell('W');
            return b;
        })()
    },

    // King dominance: AI has a Haji vs opponent regular pieces
    haji_dominance: {
        name: 'Haji Dominance (AI King vs Pieces)',
        board: (() => {
            const b = emptyBoard();
            b[3][3] = cell('B', true);  // Black Haji in center
            b[5][2] = cell('W');
            b[5][4] = cell('W');
            b[6][1] = cell('W');
            b[6][5] = cell('W');
            b[2][5] = cell('B');  // Black regular for support
            return b;
        })()
    },

    // King vs King endgame
    king_vs_king: {
        name: 'King Vs King (Haji only)',
        board: (() => {
            const b = emptyBoard();
            b[3][3] = cell('B', true);  // Black Haji
            b[5][5] = cell('W', true);  // White Haji
            return b;
        })()
    },

    // Forced capture: AI MUST capture
    forced_capture: {
        name: 'Forced Capture (Mandatory)',
        board: (() => {
            const b = emptyBoard();
            b[3][2] = cell('B');  // Black must capture
            b[4][3] = cell('W');  // White piece to capture
            b[5][4] = cell('W');  // Another white piece
            b[3][4] = cell('B');  // Black backup
            b[2][1] = cell('B');
            return b;
        })()
    },

    // Midgame: balanced forces with positional play
    midgame: {
        name: 'Midgame (Balanced)',
        board: (() => {
            const b = emptyBoard();
            // Black
            b[2][1] = cell('B');
            b[2][3] = cell('B');
            b[3][2] = cell('B');
            b[3][6] = cell('B');
            b[4][1] = cell('B', true);  // Black Haji
            // White
            b[5][2] = cell('W');
            b[5][4] = cell('W');
            b[5][6] = cell('W');
            b[6][3] = cell('W');
            b[6][7] = cell('W', true);  // White Haji
            return b;
        })()
    }
};

// =============================================
// BENCHMARK RUNNER
// =============================================

function runBenchmark() {
    const difficulties = ['easy', 'medium', 'hard'];
    const players = ['B', 'W'];
    
    console.log('=== Positions ===\n');
    
    for (const [key, pos] of Object.entries(positions)) {
        console.log(`--- ${pos.name} ---`);
        
        for (const difficulty of difficulties) {
            for (const player of players) {
                const startTime = Date.now();
                const move = api.findBestMove(pos.board, player, difficulty, player);
                const elapsed = Date.now() - startTime;
                
                // Also get a quick eval of the position
                const evalScore = api.evaluateBoardState(pos.board, player, difficulty);
                
                if (move) {
                    const piece = pos.board[move.startRow][move.startCol];
                    const isHaji = piece && piece.haji ? ' (Haji)' : '';
                    const capture = move.isCapture ? ' [CAPTURE]' : '';
                    const moveStr = `${move.startRow},${move.startCol} → ${move.endRow},${move.endCol}`;
                    console.log(`  ${difficulty.toUpperCase()} ${player}: ${moveStr}${capture}${isHaji}  score=${evalScore.toFixed(1)}  ${elapsed}ms`);
                } else {
                    console.log(`  ${difficulty.toUpperCase()} ${player}: No move found  score=${evalScore.toFixed(1)}  ${elapsed}ms`);
                }
            }
        }
        console.log('');
    }
    
    console.log('=== Depth Reach Test ===\n');
    
    // Test depth reach for key positions
    const depthTestPositions = ['opening', 'endgame_simple', 'midgame', 'king_vs_king'];
    
    for (const key of depthTestPositions) {
        const pos = positions[key];
        for (const difficulty of ['medium', 'hard']) {
            const player = 'B';  // Black AI
            const maxTime = api.getTimeLimit(difficulty);
            
            const startTime = Date.now();
            const move = api.findBestMove(pos.board, player, difficulty, player);
            const elapsed = Date.now() - startTime;
            
            const depths = api.getDynamicDepth(difficulty, api.detectGamePhase(pos.board, player), pos.board, player);
            const timeLimit = api.getDynamicTimeLimit(difficulty, pos.board, player);
            
            console.log(`  ${difficulty.toUpperCase()} ${pos.name}: targetDepth=${depths} timeLimit=${(timeLimit/1000).toFixed(1)}s actual=${(elapsed/1000).toFixed(2)}s`);
        }
    }
    
    console.log('\n=== Verification Tests ===\n');
    
    // Test 1: Capture priority
    console.log('Test 1: Forced Capture Priority');
    const fcPos = positions.forced_capture;
    const fcMove = api.findBestMove(fcPos.board, 'B', 'hard', 'B');
    const foundCapture = fcMove && fcMove.isCapture;
    console.log(`  Black MUST capture: ${foundCapture ? '✓ Captures' : '✗ Does NOT capture'}  (move: ${fcMove ? `${fcMove.startRow},${fcMove.startCol}→${fcMove.endRow},${fcMove.endCol}` : 'none'})`);
    
    // Test 2: Capture chain evaluation
    console.log('Test 2: Capture Chain Detection');
    const ccPos = positions.capture_chain;
    const ccMove = api.findBestMove(ccPos.board, 'B', 'hard', 'B');
    const hasCapture = ccMove && ccMove.isCapture;
    console.log(`  AI exploits capture chain: ${hasCapture ? '✓' : '✗'}  (move: ${ccMove ? `${ccMove.startRow},${ccMove.startCol}→${ccMove.endRow},${ccMove.endCol}` : 'none'})`);
    
    // Test 3: Material priority over empty advancement
    console.log('Test 3: Material > Position');
    // Set up a position where advancing a pawn would lose it, but material is safe
    const testBoard3 = emptyBoard();
    testBoard3[2][3] = cell('B');  // Black pawn
    testBoard3[4][5] = cell('W');  // White can capture if black advances to (3,4)
    testBoard3[5][4] = cell('W');  // White support
    testBoard3[3][2] = cell('B');  // Black support
    testBoard3[6][5] = cell('B');  // Black piece deep
    const bm3 = api.findBestMove(testBoard3, 'B', 'hard', 'B');
    const safeAdvance = bm3 && bm3.endRow === 3 ? false : true;
    console.log(`  AI avoids advancing into capture: ${safeAdvance ? '✓' : '✗'}  (move: ${bm3 ? `${bm3.startRow},${bm3.startCol}→${bm3.endRow},${bm3.endCol}` : 'none'})`);
    
    // Test 4: Center control
    console.log('Test 4: Center Control Sign');
    const ccTestBoard = emptyBoard();
    // AI has piece at center, opponent has piece at center
    ccTestBoard[3][3] = cell('B');  // AI at center
    ccTestBoard[4][4] = cell('W');  // Opponent at center — should PENALIZE AI's score
    const evalWithOpponentCenter = api.evaluateBoardState(ccTestBoard, 'B', 'hard');
    
    // Remove opponent center piece and re-evaluate
    const ccTestBoard2 = emptyBoard();
    ccTestBoard2[3][3] = cell('B');  // AI at center only
    const evalWithoutOpponentCenter = api.evaluateBoardState(ccTestBoard2, 'B', 'hard');
    
    // Opponent center should REDUCE AI's score
    const centerCorrect = evalWithoutOpponentCenter > evalWithOpponentCenter;
    console.log(`  AI score higher without opponent center: ${centerCorrect ? '✓' : '✗'}`);
    console.log(`    with opponent center: ${evalWithOpponentCenter.toFixed(2)}`);
    console.log(`    without opponent center: ${evalWithoutOpponentCenter.toFixed(2)}`);
    
    // Test 5: Transposition table efficacy
    console.log('Test 5: Transposition Table (same position searched twice)');
    const ttPos = positions.opening.board;
    const startTT = Date.now();
    const ttMove1 = api.findBestMove(ttPos, 'B', 'hard', 'B');
    const ttTime1 = Date.now() - startTT;
    
    const startTT2 = Date.now();
    const ttMove2 = api.findBestMove(ttPos, 'B', 'hard', 'B');
    const ttTime2 = Date.now() - startTT2;
    
    console.log(`  First search: ${ttTime1}ms`);
    console.log(`  Second search: ${ttTime2}ms`);
    console.log(`  Same result: ${JSON.stringify(ttMove1) === JSON.stringify(ttMove2) ? '✓' : '✗'}`);
    
    console.log('\n=== Summary ===');
    console.log(`Positions tested: ${Object.keys(positions).length}`);
    console.log(`All verifications complete.\n`);
}

// Run
runBenchmark();
