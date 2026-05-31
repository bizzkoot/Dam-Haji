// =============================================
// AI.JS - ARTIFICIAL INTELLIGENCE LOGIC
// =============================================

// --- AI CONFIGURATION ---

const AI_TIME_LIMITS = {
    easy: 500,      // 0.5 seconds
    medium: 1500,   // 1.5 seconds
    hard: 15000     // 15 seconds (INCREASED: 12s→15s for SUPER HARD mode)
};

function getTimeLimit(aiDifficulty) {
    return AI_TIME_LIMITS[aiDifficulty] || 5000;
}

function getDynamicTimeLimit(aiDifficulty, board, player) {
    const baseTime = AI_TIME_LIMITS[aiDifficulty] || 5000;

    // Adjust time based on game phase
    const gamePhase = detectGamePhase(board, player);
    let timeMultiplier = 1.0;

    // Use more time in endgame
    if (gamePhase === 'endgame') {
        timeMultiplier = 1.2;
    } else if (gamePhase === 'opening') {
        timeMultiplier = 0.8;
    }

    // Use more time when there are many captures available
    const captureMoves = pureGetAllCaptureMoves(board, player);
    if (captureMoves.length > 3) {
        timeMultiplier = Math.min(timeMultiplier * 1.5, 2.0); // Cap at 2x
    }

    // Use less time when in a clearly winning position
    const boardEvaluation = evaluateBoardState(board, player, aiDifficulty);
    if (boardEvaluation > 50) {
        timeMultiplier = Math.max(timeMultiplier * 0.7, 0.5); // Floor at 0.5x
    }

    return baseTime * timeMultiplier;
}

const AI_WEIGHTS = {
    easy: {
        captureValue: 5,
        pieceValue: 5,         // Pawn = 0.5 * 10 = 5
        positionValue: 0.04,   // Tuned for 12x PST scale: 0.5 / 12 ~ 0.04 (Max bonus = 0.48 vs piece 5)
        hajiValue: 15,         // Haji = 1.5 * 10 = 15
        centerControl: 0.2
    },
    medium: {
        captureValue: 10,
        pieceValue: 10,        // Pawn = 1.0 * 10 = 10
        positionValue: 0.08,   // Tuned for 12x PST scale: 1.0 / 12 ~ 0.08 (Max bonus = 0.96 vs piece 10)
        hajiValue: 40,         // Haji = 4.0 * 10 = 40
        centerControl: 0.5
    },
    hard: {
        captureValue: 100,
        pieceValue: 100,       // Pawn = 100
        positionValue: 2.0,    // PST max bonus = 12 * 2.0 = 24 (24% of pawn)
        hajiValue: 600,        // Haji = 600 (6x pawn)
        centerControl: 15.0    // Center control max bonus = ~13 (13% of pawn)
    }
};

// === SCORING CONSTANTS ===

// Killer move heuristic: array of killer moves indexed by search depth
const MAX_SEARCH_DEPTH = 20;
let killerMoves = new Array(MAX_SEARCH_DEPTH).fill(null);

// Variables for search timing and node counts
let searchStartTime = 0;
let searchTimeLimit = 0;
let searchedNodesCount = 0;

function checkTimeout() {
    searchedNodesCount++;
    if (searchedNodesCount % 1024 === 0) {
        if (searchStartTime > 0 && searchTimeLimit > 0) {
            if (Date.now() - searchStartTime >= searchTimeLimit) {
                throw new Error("SearchTimeout");
            }
        }
    }
}

const MOVE_SCORES = {
    CAPTURE_BASE: 1000,
    MULTI_CAPTURE_PER_THREAT: 100,
    HAJI_MOVE: 100,
    PROMOTION: 200,
    THREAT_PENALTY: 120,       // INCREASED: AI more carefully avoids moving pieces into danger
    THREAT_CREATION_BONUS: 80,  // INCREASED: AI more aggressively creates threats
    CENTER_CONTROL: 10,
    POSITION_ADVANCEMENT: 80   // INCREASED: AI more strongly advances pieces toward promotion
};

const KING_EVAL = {
    HAJI_DIFF_MULTIPLIER: 1050,
    CENTER_CONTROL_MULTIPLIER: 100
};

// === PIECE-SQUARE TABLES (static position evaluation) ===

// Black man advancement: higher row = closer to promotion (row 7)
const PST_BLACK_MAN = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  2,  3,  3,  2,  0,  0],
    [0,  0,  3,  5,  5,  3,  0,  0],
    [0,  0,  5,  8,  8,  5,  0,  0],
    [0,  0,  6, 10, 10,  6,  0,  0],
    [0,  4,  8, 12, 12,  8,  4,  0],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

// White man advancement: lower row = closer to promotion (row 0)
const PST_WHITE_MAN = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0,  4,  8, 12, 12,  8,  4,  0],
    [0,  0,  6, 10, 10,  6,  0,  0],
    [0,  0,  5,  8,  8,  5,  0,  0],
    [0,  0,  3,  5,  5,  3,  0,  0],
    [0,  0,  2,  3,  3,  2,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

// Haji PST: strong center control, avoid edges
const PST_HAJI = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [0,  2,  4,  4,  4,  4,  2,  0],
    [0,  0,  6,  8,  8,  6,  0,  0],
    [0,  4,  8, 12, 12,  8,  4,  0],
    [0,  4,  8, 12, 12,  8,  4,  0],
    [0,  0,  6,  8,  8,  6,  0,  0],
    [0,  2,  4,  4,  4,  4,  2,  0],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

// Fast PST lookup: given board, player, r, c returns position score contribution
function getPSTValue(board, r, c, player, cell) {
    if (!cell) return 0;
    if (cell.haji) {
        return cell.color === player ? PST_HAJI[r][c] : -PST_HAJI[r][c];
    }
    const pst = cell.color === 'B' ? PST_BLACK_MAN : PST_WHITE_MAN;
    return cell.color === player ? pst[r][c] : -pst[r][c];
}

// === TRANSPOSITION TABLE ===

const TT_FLAG = { EXACT: 0, LOWERBOUND: 1, UPPERBOUND: 2 };

// Zobrist hashing for efficient board position hashing
const ZOBRIST = {
    table: null,
    playerHash: 0n,
    activePieceTable: null,

    init() {
        const random64 = () => {
            const high = BigInt(Math.floor(Math.random() * 4294967296));
            const low = BigInt(Math.floor(Math.random() * 4294967296));
            return (high << 32n) | low;
        };
        
        this.table = [];
        for (let r = 0; r < 8; r++) {
            this.table[r] = [];
            for (let c = 0; c < 8; c++) {
                this.table[r][c] = [];
                for (let t = 0; t < 5; t++) {
                    this.table[r][c][t] = random64();
                }
            }
        }

        this.playerHash = random64();

        this.activePieceTable = [];
        for (let r = 0; r < 8; r++) {
            this.activePieceTable[r] = [];
            for (let c = 0; c < 8; c++) {
                this.activePieceTable[r][c] = random64();
            }
        }
    },

    getPieceType(piece) {
        if (!piece) return 0;
        if (piece.color === 'B') return piece.haji ? 3 : 1;
        return piece.haji ? 4 : 2;
    },

    hash(board, player, activePiece = null) {
        if (!this.table) this.init();
        let h = 0n;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const t = this.getPieceType(board[r][c]);
                h ^= this.table[r][c][t];
            }
        }

        if (player === 'W') {
            h ^= this.playerHash;
        }

        if (activePiece) {
            h ^= this.activePieceTable[activePiece.row][activePiece.col];
        }

        return h;
    },

    getUpdatedHash(parentHash, board, move, player, nextPlayer, activePiece, nextActivePiece) {
        if (!this.table) this.init();
        let nextHash = parentHash;
        const { startRow, startCol, endRow, endCol, isCapture } = move;
        const piece = board[startRow][startCol];
        if (!piece) return nextHash;

        const oldPieceType = this.getPieceType(piece);

        nextHash ^= this.table[startRow][startCol][oldPieceType];
        nextHash ^= this.table[startRow][startCol][0];

        const isPromotion = !piece.haji && ((endRow === 0 && piece.color === 'W') || (endRow === 7 && piece.color === 'B'));
        const newPieceType = isPromotion ? (piece.color === 'B' ? 3 : 4) : oldPieceType;
        
        nextHash ^= this.table[endRow][endCol][0];
        nextHash ^= this.table[endRow][endCol][newPieceType];

        if (isCapture) {
            let capRow, capCol;
            if (piece.haji) {
                const rowStep = endRow > startRow ? 1 : -1;
                const colStep = endCol > startCol ? 1 : -1;
                let r = startRow + rowStep, c = startCol + colStep;
                while (r !== endRow) {
                    if (board[r][c]) {
                        capRow = r; capCol = c;
                        break;
                    }
                    r += rowStep; c += colStep;
                }
            } else {
                capRow = (startRow + endRow) / 2;
                capCol = (startCol + endCol) / 2;
            }

            if (capRow !== undefined && capCol !== undefined) {
                const capPiece = board[capRow][capCol];
                if (capPiece) {
                    const capPieceType = this.getPieceType(capPiece);
                    nextHash ^= this.table[capRow][capCol][capPieceType];
                    nextHash ^= this.table[capRow][capCol][0];
                }
            }
        }

        if (player !== nextPlayer) {
            nextHash ^= this.playerHash;
        }

        if (activePiece) {
            nextHash ^= this.activePieceTable[activePiece.row][activePiece.col];
        }
        if (nextActivePiece) {
            nextHash ^= this.activePieceTable[nextActivePiece.row][nextActivePiece.col];
        }

        return nextHash;
    }
};

class TranspositionTable {
    constructor() {
        this.table = new Map();
        this.maxSize = 500000;
        this.hits = 0;
        this.total = 0;
    }

    get(hash) {
        return this.table.get(hash);
    }

    set(hash, depth, score, flag, bestMove) {
        if (this.table.size >= this.maxSize) {
            this.table.clear(); // Simple eviction strategy
        }
        this.table.set(hash, { depth, score, flag, bestMove });
    }

    reset() {
        this.table.clear();
        this.hits = 0;
        this.total = 0;
    }
}

// Global transposition table instance
let transpositionTable = new TranspositionTable();

// === OPENING BOOK ===

// Simple opening book: check if position matches known opening patterns
// and suggest good moves without spending search time
const OPENING_BOOK = {
    // Black's first move options (center advancement from starting position)
    blackFirstMoves: [
        { startRow: 2, startCol: 1, endRow: 3, endCol: 2 },
        { startRow: 2, startCol: 3, endRow: 3, endCol: 4 },
        { startRow: 2, startCol: 5, endRow: 3, endCol: 6 },
        { startRow: 2, startCol: 7, endRow: 3, endCol: 6 },
        { startRow: 2, startCol: 1, endRow: 3, endCol: 0 }
    ],
    // White's first move options
    whiteFirstMoves: [
        { startRow: 5, startCol: 0, endRow: 4, endCol: 1 },
        { startRow: 5, startCol: 2, endRow: 4, endCol: 3 },
        { startRow: 5, startCol: 4, endRow: 4, endCol: 5 },
        { startRow: 5, startCol: 6, endRow: 4, endCol: 7 },
        { startRow: 5, startCol: 2, endRow: 4, endCol: 1 }
    ]
};

function isStartingPosition(board) {
    let count = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            count++;
            // All pieces should be in starting rows
            if (cell.color === 'B' && r > 2) return false;
            if (cell.color === 'W' && r < 5) return false;
        }
    }
    return count === 24; // Full starting position
}

function getOpeningMove(board, player) {
    // Check if we're in the starting position or very early opening
    if (isStartingPosition(board)) {
        const moves = player === 'B' ? OPENING_BOOK.blackFirstMoves : OPENING_BOOK.whiteFirstMoves;
        // Pick a random opening move from the book for variety
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // Early opening: check for standard responses
    // If not in a known position, return null to use search
    return null;
}

// --- PURE (STATE-BASED) AI LOGIC ---

// This function should NOT be used by the AI during thinking
// It's only for converting DOM state to AI state at the beginning of AI turn
// Note: This function reads the current DOM state, so it should be called after
// any DOM animations or updates have completed
function buildBoardFromDOM() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = getPiece(r, c);
            if (piece) {
                board[r][c] = {
                    color: piece.classList.contains('black') ? 'B' : 'W',
                    haji: piece.classList.contains('haji')
                };
            }
        }
    }
    return board;
}

function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// NEW: Pure version of checkAvailableCaptures for AI
function pureCheckAvailableCaptures(board, player) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === player) {
                if (pureGetAvailableCaptureMoves(board, r, c).length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function pureIsValidCapture(board, startRow, startCol, endRow, endCol) {
    if (!inBounds(endRow, endCol)) return false;
    const piece = board[startRow][startCol];
    if (!piece || board[endRow][endCol] !== null) return false;

    const rowDiff = endRow - startRow;
    const colDiff = Math.abs(endCol - startCol);

    if (piece.haji) {
        if (colDiff !== Math.abs(rowDiff)) return false;
        const rowStep = rowDiff > 0 ? 1 : -1;
        const colStep = endCol > startCol ? 1 : -1;
        let r = startRow + rowStep, c = startCol + colStep;
        let capturedCount = 0;
        while (r !== endRow) {
            const jumped = board[r][c];
            if (jumped) {
                if (jumped.color !== piece.color) capturedCount++;
                else return false; // Blocked by own piece
            }
            r += rowStep; c += colStep;
        }
        return capturedCount === 1;
    } else {
        if (colDiff !== 2) return false;
        if (piece.color === 'B' && rowDiff !== 2) return false;
        if (piece.color === 'W' && rowDiff !== -2) return false;
        const midRow = (startRow + endRow) / 2;
        const midCol = (startCol + endCol) / 2;
        const midPiece = board[midRow][midCol];
        return midPiece && midPiece.color !== piece.color;
    }
}

function pureGetAvailableCaptureMoves(board, row, col) {
    const res = [];
    const piece = board[row][col];
    if (!piece) return res;

    if (piece.haji) {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
            for (let d = 2; d <= 7; d++) {
                const nr = row + dr * d;
                const nc = col + dc * d;
                if (pureIsValidCapture(board, row, col, nr, nc)) {
                    res.push({ row: nr, col: nc });
                }
            }
        }
    } else {
        const dirs = piece.color === 'B' ? [[2, -2], [2, 2]] : [[-2, -2], [-2, 2]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr;
            const nc = col + dc;
            if (pureIsValidCapture(board, row, col, nr, nc)) {
                res.push({ row: nr, col: nc });
            }
        }
    }
    return res;
}

function pureIsValidMove(board, startRow, startCol, endRow, endCol) {
    if (!inBounds(endRow, endCol) || board[endRow][endCol] !== null) return false;
    const piece = board[startRow][startCol];
    if (!piece) return false;

    const rowDiff = endRow - startRow;
    const colDiff = Math.abs(endCol - startCol);

    if (piece.haji) {
        if (colDiff !== Math.abs(rowDiff)) return false;
        const rowStep = rowDiff > 0 ? 1 : -1;
        const colStep = endCol > startCol ? 1 : -1;
        let r = startRow + rowStep, c = startCol + colStep;
        while (r !== endRow) {
            if (board[r][c] !== null) return false; // Path is blocked
            r += rowStep; c += colStep;
        }
        return true;
    } else {
        if (colDiff !== 1) return false;
        if (piece.color === 'B' && rowDiff !== 1) return false;
        if (piece.color === 'W' && rowDiff !== -1) return false;
        return true;
    }
}

function pureGetAvailableRegularMoves(board, row, col) {
    const res = [];
    const piece = board[row][col];
    if (!piece) return res;

    if (piece.haji) {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
            for (let d = 1; d <= 7; d++) {
                const nr = row + dr * d;
                const nc = col + dc * d;
                if (pureIsValidMove(board, row, col, nr, nc)) {
                    res.push({ row: nr, col: nc });
                } else {
                    // Stop searching in this direction if move is invalid (blocked or out of bounds)
                    break;
                }
            }
        }
    } else {
        const dirs = piece.color === 'B' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr;
            const nc = col + dc;
            if (pureIsValidMove(board, row, col, nr, nc)) {
                res.push({ row: nr, col: nc });
            }
        }
    }
    return res;
}

function pureGetAllCaptureMoves(board, player) {
    const captureMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === player) {
                const caps = pureGetAvailableCaptureMoves(board, r, c);
                for (const m of caps) {
                    captureMoves.push({ startRow: r, startCol: c, endRow: m.row, endCol: m.col, isCapture: true });
                }
            }
        }
    }
    return captureMoves;
}

function pureGetAllRegularMoves(board, player) {
    const regularMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.color === player) {
                const regs = pureGetAvailableRegularMoves(board, r, c);
                for (const m of regs) {
                    regularMoves.push({ startRow: r, startCol: c, endRow: m.row, endCol: m.col, isCapture: false });
                }
            }
        }
    }
    return regularMoves;
}

function pureApplyMove(board, move) {
    const newBoard = cloneBoard(board);
    const { startRow, startCol, endRow, endCol, isCapture } = move;
    const piece = { ...newBoard[startRow][startCol] };
    newBoard[startRow][startCol] = null;

    if (isCapture) {
        if (piece.haji) {
            const rowStep = endRow > startRow ? 1 : -1;
            const colStep = endCol > startCol ? 1 : -1;
            let r = startRow + rowStep, c = startCol + colStep;
            while (r !== endRow) {
                if (newBoard[r][c]) {
                    newBoard[r][c] = null;
                    break;
                }
                r += rowStep; c += colStep;
            }
        } else {
            newBoard[(startRow + endRow) / 2][(startCol + endCol) / 2] = null;
        }
    }

    if (!piece.haji && ((endRow === 0 && piece.color === 'W') || (endRow === 7 && piece.color === 'B'))) {
        piece.haji = true;
    }

    newBoard[endRow][endCol] = piece;
    return newBoard;
}

function evaluateBoardState(board, player, aiDifficulty) {
    if (isKingVsKing(board, player)) {
        return evaluateKingVsKing(board, player, aiDifficulty);
    }

    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;

    // Track Haji diagonal control for bonus
    let playerHajiDiagonalControl = 0;
    let opponentHajiDiagonalControl = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            const isPlayer = cell.color === player;

            // Material value
            const materialValue = cell.haji ? weights.hajiValue : weights.pieceValue;

            // PST position value (fast static lookup, scaled by position weight)
            const pstValue = getPSTValue(board, r, c, player, cell) * weights.positionValue;

            // Center control bonus
            // Signed: player pieces in center ADD to score (+centerValue),
            // opponent pieces in center SUBTRACT from score (-centerValue).
            // This is the correct sign: the AI should be rewarded for holding
            // the center and penalized when the opponent does.
            const centerDistance = Math.abs(c - 3.5) + Math.abs(r - 3.5);
            const centerValue = (7 - centerDistance) / 7;
            const centerBonus = (isPlayer ? centerValue : -centerValue) * weights.centerControl;

            const total = (isPlayer ? materialValue : -materialValue) + pstValue + centerBonus;
            score += total;

            // Haji diagonal control tracking (CRITICAL for HARD mode)
            if (cell.haji) {
                const onMainDiagonal = (r === c) || (r + c === 7);
                if (onMainDiagonal) {
                    if (isPlayer) {
                        playerHajiDiagonalControl++;
                    } else {
                        opponentHajiDiagonalControl++;
                    }
                }
            }
        }
    }

    // Haji diagonal control bonus (HARD mode strategic awareness)
    if (aiDifficulty === 'hard') {
        const diagonalBonus = (playerHajiDiagonalControl - opponentHajiDiagonalControl) * 15;
        score += diagonalBonus;
    }

    // Back rank defense bonus (critical for hard difficulty)
    if (aiDifficulty === 'hard') {
        let backRankBonus = 0;
        const backRankRow = player === 'B' ? 0 : 7;
        const opponentBackRankRow = player === 'B' ? 7 : 0;

        for (let c = 0; c < 8; c++) {
            // Player's back rank
            const playerCell = board[backRankRow][c];
            if (playerCell && playerCell.color === player && !playerCell.haji) {
                backRankBonus += 25; // 25 points per pawn defending back rank
            }
            // Opponent's back rank
            const opponentCell = board[opponentBackRankRow][c];
            if (opponentCell && opponentCell.color !== player && !opponentCell.haji) {
                backRankBonus -= 25; // Penalize if opponent is defending their back rank
            }
        }
        score += backRankBonus;
    }

    return score;
}

function evaluateHajiThreatChain(nextBoard, move, player, opponent) {
    const movedPiece = nextBoard[move.endRow][move.endCol];
    if (!movedPiece || !movedPiece.haji) return 0;

    let threatChainScore = 0;

    // CRITICAL: Check if Haji lands on main diagonal (WINNING)
    const onMainDiagonal = (move.endRow === move.endCol) || (move.endRow + move.endCol === 7);
    if (onMainDiagonal) {
        // Haji on main diagonal controls entire board - MASSIVE bonus
        threatChainScore += 500;
    }

    // CRITICAL: Check threat multiplication (DOMINATING)
    const newThreats = countThreats(nextBoard, move.endRow, move.endCol, player, opponent);
    if (newThreats >= 4) {
        // Haji threatens 4+ pieces - DOMINATING position
        threatChainScore += 300;
    } else if (newThreats >= 2) {
        // Haji threatens 2-3 pieces - strong positional advantage
        threatChainScore += 150;
    }

    // CRITICAL: Check if Haji can create unavoidable capture sequences
    // A Haji on a central square often creates "you can't stop me" scenarios
    const isCentralSquare = (move.endRow >= 2 && move.endRow <= 5) && (move.endCol >= 2 && move.endCol <= 5);
    if (isCentralSquare && newThreats >= 2) {
        // Haji in center threatening multiple pieces = WINNING
        threatChainScore += 200;
    }

    return threatChainScore;
}

function evaluateDefensiveNeed(board, player, opponent, aiDifficulty) {
    if (aiDifficulty !== 'hard') return 0;

    let defensiveNeedScore = 0;

    // CRITICAL FIX: Count how many of YOUR pieces are under threat
    // This tells us how badly we need to defend
    let threatenedPieceCount = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === player) {
                // Check if this piece is under threat
                if (isPieceUnderThreat(board, r, c, player, opponent)) {
                    threatenedPieceCount++;

                    // Extra penalty if Haji is under threat
                    if (piece.haji) {
                        threatenedPieceCount += 3; // Haji safety is 3x more important
                    }
                }
            }
        }
    }

    // Base defensive need on number of threatened pieces
    defensiveNeedScore = threatenedPieceCount * 100;

    // Bonus: Check if opponent has Haji pieces creating additional threat chains
    let opponentHajiThreats = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.haji && piece.color === opponent) {
                const threats = countThreats(board, r, c, opponent, player);
                const onMainDiagonal = (r === c) || (r + c === 7);

                // CRITICAL FIX: Any Haji with 2+ threats is DEFENSIVE EMERGENCY
                if (onMainDiagonal && threats >= 1) {
                    // Opponent Haji on diagonal threatening ANY pieces = CRITICAL
                    opponentHajiThreats += 400;  // Increased from 300
                } else if (threats >= 4) {
                    // Opponent Haji threatening 4+ pieces = CRITICAL
                    opponentHajiThreats += 350;  // Increased from 250
                } else if (threats >= 2) {
                    // Opponent Haji threatening 2+ pieces = IMPORTANT
                    opponentHajiThreats += 200;  // Increased from 100
                } else if (threats >= 1) {
                    // Opponent Haji threatening even 1 piece = CONCERNING
                    opponentHajiThreats += 50;   // NEW: Any threat from Haji matters
                }
            }
        }
    }

    defensiveNeedScore += opponentHajiThreats;

    return defensiveNeedScore;
}

function blocksHajiPath(board, move, opponent) {
    // Check if this move blocks an opponent Haji's diagonal path
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.haji && piece.color === opponent) {
                // Check if move.endRow,move.endCol is on a diagonal from this Haji
                const rowDiff = Math.abs(move.endRow - r);
                const colDiff = Math.abs(move.endCol - c);
                if (rowDiff === colDiff && rowDiff > 0) {
                    // This square is on the diagonal - check if it's blocking the Haji
                    // Count how many opponent pieces are threatened past this square
                    let blockedThreats = 0;
                    const rowStep = move.endRow > r ? 1 : -1;
                    const colStep = move.endCol > c ? 1 : -1;

                    // Check all squares beyond this blocking position
                    for (let d = 1; d <= 7; d++) {
                        const checkRow = move.endRow + rowStep * d;
                        const checkCol = move.endCol + colStep * d;
                        if (!inBounds(checkRow, checkCol)) break;

                        const targetPiece = board[checkRow][checkCol];
                        if (targetPiece && targetPiece.color !== opponent) {
                            // This is a threatened piece - if we block, it's safe
                            blockedThreats++;
                        }
                    }

                    if (blockedThreats >= 2) {
                        return true; // This move blocks Haji from threatening 2+ pieces
                    }
                }
            }
        }
    }
    return false;
}

function scoreMove(board, move, player, aiDifficulty) {
    const weights = AI_WEIGHTS[aiDifficulty];
    // Difficulty scaling factor based on captureValue (5/10/20 → 0.5/1/2)
    const diffScale = weights.captureValue / 10;
    let score = 0;

    // CRITICAL for HARD mode: Check defensive need BEFORE scoring
    const opponent = player === 'B' ? 'W' : 'B';
    let currentDefensiveNeed = 0;
    let playerHajiCount = 0;
    let opponentHajiCount = 0;
    let panicMode = false;

    if (aiDifficulty === 'hard') {
        currentDefensiveNeed = evaluateDefensiveNeed(board, player, opponent, aiDifficulty);

        // Count Haji pieces for panic mode
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c]) {
                    if (board[r][c].haji && board[r][c].color === player) playerHajiCount++;
                    if (board[r][c].haji && board[r][c].color === opponent) opponentHajiCount++;
                }
            }
        }

        // PANIC MODE: Opponent has Haji, AI doesn't = DESPERATE DEFENSE NEEDED
        if (opponentHajiCount >= 1 && playerHajiCount === 0) {
            panicMode = true;
        }
    }

    // Apply move once, reuse for all checks
    const nextBoard = pureApplyMove(board, move);

    // CRITICAL: In panic mode, PROMOTION moves get MASSIVE priority
    if (panicMode) {
        if ((move.endRow === 0 && player === 'W') || (move.endRow === 7 && player === 'B')) {
            score += 2000; // MASSIVE bonus for promotion in panic mode
        }
    }

    // Capture moves get highest priority (scaled by difficulty)
    if (move.isCapture) {
        score += MOVE_SCORES.CAPTURE_BASE * diffScale;

        // Multiple captures get bonus
        const nextCaptures = pureGetAllCaptureMoves(nextBoard, player);
        score += nextCaptures.length * MOVE_SCORES.MULTI_CAPTURE_PER_THREAT * diffScale;
    }

    // Haji moves get priority
    const piece = board[move.startRow][move.startCol];
    if (piece && piece.haji) {
        score += MOVE_SCORES.HAJI_MOVE * diffScale;
    }

    // Center control
    const centerDistance = Math.abs(move.endCol - 3.5) + Math.abs(move.endRow - 3.5);
    score += (7 - centerDistance) * MOVE_SCORES.CENTER_CONTROL;

    // Promotion moves
    if ((move.endRow === 0 && player === 'W') || (move.endRow === 7 && player === 'B')) {
        score += MOVE_SCORES.PROMOTION;
    }

    // Position value
    const positionValue = player === 'B' ? move.endRow / 7 : (7 - move.endRow) / 7;
    score += positionValue * MOVE_SCORES.POSITION_ADVANCEMENT;

    const movedPiece = nextBoard[move.endRow][move.endCol];

    if (aiDifficulty === 'hard' && movedPiece) {
        // CRITICAL: PANIC MODE - DEFEND AT ALL COSTS
        if (panicMode) {
            // In panic mode, defensive moves get QUADRUPLE priority (3→4)
            score += currentDefensiveNeed * 4; // SUPER HARD: Even more defensive
        }

        // Check if moved piece is under IMMEDIATE threat
        if (isPieceUnderThreat(nextBoard, move.endRow, move.endCol, player, opponent)) {
            // SEVERE penalty: this piece will be captured next turn
            score -= MOVE_SCORES.THREAT_PENALTY * diffScale * 2;
        }

        // CRITICAL: Evaluate Haji threat chains (MISSING FEATURE - why AI loses)
        if (movedPiece.haji) {
            const threatChainBonus = evaluateHajiThreatChain(nextBoard, move, player, opponent);
            score += threatChainBonus;
        }

        // CRITICAL: Check if this move BLOCKS opponent Haji path (NEW - MISSING FEATURE)
        if (blocksHajiPath(board, move, opponent)) {
            let blockBonus = 300;
            if (panicMode) blockBonus = 600; // DOUBLE blocking bonus in panic mode
            score += blockBonus; // MASSIVE bonus for blocking Haji diagonal paths
        }

        // CRITICAL: Check if this move creates an ESCAPE route for threatened pieces
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const threatenedPiece = board[r][c];
                if (threatenedPiece && threatenedPiece.color === player) {
                    if (isPieceUnderThreat(board, r, c, player, opponent)) {
                        // This piece is currently threatened
                        // Check if our move helps it escape (blocks threat path)
                        if (blocksHajiPath(board, move, opponent)) {
                            score += 150; // Bonus for saving threatened piece
                        }
                    }
                }
            }
        }

        // Check if moved piece can be immediately recaptured after trading
        const opponentCaptures = pureGetAvailableCaptureMoves(nextBoard, move.endRow, move.endCol);
        for (const cap of opponentCaptures) {
            const afterCaptureBoard = pureApplyMove(nextBoard, { startRow: move.endRow, startCol: move.endCol, endRow: cap.row, endCol: cap.col, isCapture: true });
            // Check if player can recapture the opponent's capturing piece
            if (isPieceUnderThreat(afterCaptureBoard, cap.row, cap.col, opponent, player)) {
                // This is a good exchange - player gets their piece back
                score += MOVE_SCORES.THREAT_CREATION_BONUS * diffScale;
            } else {
                // This is a bad exchange - player loses piece for free
                score -= MOVE_SCORES.THREAT_PENALTY * diffScale * 1.5;
            }
        }

        // CRITICAL: Evaluate defensive impact
        // After making this move, how much are we still threatened?
        const newDefensiveNeed = evaluateDefensiveNeed(nextBoard, player, opponent, aiDifficulty);
        const defensiveImprovement = currentDefensiveNeed - newDefensiveNeed;

        if (defensiveImprovement > 0) {
            // This move reduces opponent's threat against us - BIG bonus
            let defensiveMultiplier = panicMode ? 6 : 3; // SUPER HARD: 6× bonus in panic (4→6)
            score += defensiveImprovement * defensiveMultiplier;
        } else if (defensiveImprovement < 0) {
            // This move increases opponent's threat against us - BIG penalty
            let penaltyMultiplier = panicMode ? 8 : 4; // SUPER HARD: 8× penalty in panic (5→8)
            score += defensiveImprovement * penaltyMultiplier;
        }
    }

    // Threat creation - reward moves that threaten opponent pieces
    const threats = countThreats(nextBoard, move.endRow, move.endCol, player, opponent);
    score += threats * MOVE_SCORES.THREAT_CREATION_BONUS * diffScale;

    return score;
}

// Find the opponent piece captured in a capture move (works for both regular and Haji)
function getCapturedPiece(board, startRow, startCol, endRow, endCol, piece) {
    if (!piece.haji) {
        // Regular piece: captured piece is at the midpoint
        const midRow = (startRow + endRow) / 2;
        const midCol = (startCol + endCol) / 2;
        return board[midRow][midCol] || null;
    }
    // Haji piece: walk along the diagonal path to find the first opponent piece
    const rowStep = endRow > startRow ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let r = startRow + rowStep;
    let c = startCol + colStep;
    while (r !== endRow) {
        if (board[r][c]) return board[r][c];
        r += rowStep;
        c += colStep;
    }
    return null;
}

function countThreats(board, row, col, player, opponent) {
    let threatCount = 0;
    const piece = board[row][col];
    if (!piece) return 0;

    // CRITICAL FIX: For Haji pieces, count ALL reachable squares (not just captures)
    // A Haji threatens any square it can reach, even if empty now (future captures)
    if (piece.haji) {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
            for (let d = 1; d <= 7; d++) {
                const nr = row + dr * d;
                const nc = col + dc * d;
                if (!inBounds(nr, nc)) break;

                // Check if path is blocked
                let pathBlocked = false;
                for (let step = 1; step < d; step++) {
                    const checkRow = row + dr * step;
                    const checkCol = col + dc * step;
                    if (board[checkRow][checkCol]) {
                        pathBlocked = true;
                        break;
                    }
                }

                if (!pathBlocked) {
                    // This square is reachable - it's a threat
                    // Count it whether there's a piece there or not
                    threatCount++;
                } else {
                    break; // Path blocked, stop searching in this direction
                }
            }
        }
    } else {
        // For regular pieces, only count capture moves (can only threaten 2 squares ahead)
        const captureMoves = pureGetAvailableCaptureMoves(board, row, col);
        for (const move of captureMoves) {
            const target = getCapturedPiece(board, row, col, move.row, move.col, piece);
            if (target && target.color === opponent) {
                threatCount++;
            }
        }
    }

    return threatCount;
}

function orderMoves(board, moves, player, aiDifficulty) {
    return moves.map(move => ({
        ...move,
        score: scoreMove(board, move, player, aiDifficulty)
    })).sort((a, b) => b.score - a.score);
}

function orderMovesLightweight(board, moves, player) {
    return moves.map(move => {
        let score = 0;
        const piece = board[move.startRow][move.startCol];
        if (piece) {
            // Capture bonus
            if (move.isCapture) {
                score += 1000;
            }
            // Promotion bonus
            if (!piece.haji && ((move.endRow === 0 && piece.color === 'W') || (move.endRow === 7 && piece.color === 'B'))) {
                score += 200;
            }
            // Haji move bonus
            if (piece.haji) {
                score += 50;
            }
            // Center control delta
            const centerDistStart = Math.abs(move.startCol - 3.5) + Math.abs(move.startRow - 3.5);
            const centerDistEnd = Math.abs(move.endCol - 3.5) + Math.abs(move.endRow - 3.5);
            score += (centerDistStart - centerDistEnd) * 10;

            // PST positional delta (signed relative to evaluating player)
            const startPST = getPSTValue(board, move.startRow, move.startCol, player, piece);
            const endPST = getPSTValue(board, move.endRow, move.endCol, player, piece);
            score += (endPST - startPST) * 5;
        }
        return {
            ...move,
            score
        };
    }).sort((a, b) => b.score - a.score);
}

function applyDifficultyRandomness(board, aiDifficulty, aiPlayer) {
    // Build ordered move list for weighted randomness
    const player = aiPlayer;
    const moveInfo = getAllMovesForPlayer(board, player);
    const moves = moveInfo.allMoves;

    if (!moves || moves.length <= 1) return null;

    // Order moves by score so we pick from scored list, not raw board-scan order
    const orderedMoves = orderMoves(board, moves, player, aiDifficulty);

    if (aiDifficulty === 'easy') {
        if (Math.random() < 0.3) {
            // Pick from top 3-5 scored moves (weakened but not purely random)
            const topN = Math.min(5, orderedMoves.length);
            const randomIndex = Math.floor(Math.random() * topN);
            return orderedMoves[randomIndex];
        }
    } else if (aiDifficulty === 'medium') {
        if (Math.random() < 0.1) {
            // Pick from middle of scored moves (avoid best and worst)
            if (orderedMoves.length > 3) {
                const midStart = 1;
                const midEnd = Math.max(2, Math.floor(orderedMoves.length * 0.7));
                const randomIndex = midStart + Math.floor(Math.random() * (midEnd - midStart));
                return orderedMoves[randomIndex];
            }
        }
    }

    return null; // Return null = use bestMove from search
}

function isEndgame(board, player) {
    let playerPieces = 0;
    let opponentPieces = 0;
    let playerHaji = 0;
    let opponentHaji = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            if (cell.color === player) {
                playerPieces++;
                if (cell.haji) playerHaji++;
            } else {
                opponentPieces++;
                if (cell.haji) opponentHaji++;
            }
        }
    }

    // Endgame conditions
    if (playerPieces + opponentPieces <= 6) return true;
    if (playerHaji + opponentHaji >= 3) return true;
    if (playerPieces <= 2 || opponentPieces <= 2) return true;

    return false;
}

function isKingVsKing(board, player) {
    let playerHaji = 0;
    let opponentHaji = 0;
    let playerRegular = 0;
    let opponentRegular = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            if (cell.color === player) {
                if (cell.haji) playerHaji++;
                else playerRegular++;
            } else {
                if (cell.haji) opponentHaji++;
                else opponentRegular++;
            }
        }
    }

    return playerRegular === 0 && opponentRegular === 0 && playerHaji > 0 && opponentHaji > 0;
}

function evaluateKingVsKing(board, player, aiDifficulty) {
    let playerHaji = 0;
    let opponentHaji = 0;
    let playerCenterControl = 0;
    let opponentCenterControl = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            const centerDistance = Math.abs(c - 3.5) + Math.abs(r - 3.5);
            const centerValue = (7 - centerDistance) / 7;

            if (cell.color === player) {
                playerHaji++;
                playerCenterControl += centerValue;
            } else {
                opponentHaji++;
                opponentCenterControl += centerValue;
            }
        }
    }

    // King vs King evaluation (consolidated redundant haji multiplier)
    let score = (playerHaji - opponentHaji) * KING_EVAL.HAJI_DIFF_MULTIPLIER;
    score += (playerCenterControl - opponentCenterControl) * KING_EVAL.CENTER_CONTROL_MULTIPLIER;

    // Distance heuristic for chasing and cornering
    if (playerHaji !== opponentHaji && playerHaji > 0 && opponentHaji > 0) {
        let minDistance = Infinity;
        const playerHajis = [];
        const opponentHajis = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = board[r][c];
                if (cell && cell.haji) {
                    if (cell.color === player) {
                        playerHajis.push({ r, c });
                    } else {
                        opponentHajis.push({ r, c });
                    }
                }
            }
        }

        for (const ph of playerHajis) {
            for (const oh of opponentHajis) {
                const dist = Math.max(Math.abs(ph.r - oh.r), Math.abs(ph.c - oh.c));
                if (dist < minDistance) {
                    minDistance = dist;
                }
            }
        }

        if (minDistance !== Infinity) {
            const distanceMultiplier = 50; // Strong incentive to close/widen gap
            const distanceSign = playerHaji > opponentHaji ? -1 : 1;
            score += distanceSign * minDistance * distanceMultiplier;
        }
    }

    return score;
}

// Unified move generation: single board scan instead of three.
// If activePiece is provided, only generate capture moves starting from that piece.
function getAllMovesForPlayer(board, player, activePiece = null) {
    const captureMoves = [];
    const regularMoves = [];

    if (activePiece) {
        // In a capture chain, we MUST capture with the active piece only.
        const caps = pureGetAvailableCaptureMoves(board, activePiece.row, activePiece.col);
        for (const m of caps) {
            captureMoves.push({ startRow: activePiece.row, startCol: activePiece.col, endRow: m.row, endCol: m.col, isCapture: true });
        }
        return {
            allMoves: captureMoves,
            captureMoves,
            regularMoves: [],
            hasCaptures: captureMoves.length > 0
        };
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p || p.color !== player) continue;

            const caps = pureGetAvailableCaptureMoves(board, r, c);
            for (const m of caps) {
                captureMoves.push({ startRow: r, startCol: c, endRow: m.row, endCol: m.col, isCapture: true });
            }

            // Only generate regular moves if captures not already found -
            // saves ~50% board scans when captures are available
            if (captureMoves.length === 0) {
                const regs = pureGetAvailableRegularMoves(board, r, c);
                for (const m of regs) {
                    regularMoves.push({ startRow: r, startCol: c, endRow: m.row, endCol: m.col, isCapture: false });
                }
            }
        }
    }

    return {
        allMoves: captureMoves.length > 0 ? captureMoves : regularMoves,
        captureMoves,
        regularMoves,
        hasCaptures: captureMoves.length > 0
    };
}

function isCapturedPieceAt(startRow, startCol, endRow, endCol, piece, targetRow, targetCol) {
    if (!piece.haji) {
        // For regular pieces, the captured piece is always at the midpoint
        return (startRow + endRow) / 2 === targetRow && (startCol + endCol) / 2 === targetCol;
    }
    // For Haji (King), the captured piece is along the diagonal path to the landing square
    const rowStep = endRow > startRow ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let r = startRow + rowStep;
    let c = startCol + colStep;
    while (r !== endRow) {
        if (r === targetRow && c === targetCol) {
            return true;
        }
        r += rowStep;
        c += colStep;
    }
    return false;
}

function isPieceUnderThreat(board, row, col, player, opponent) {
    // Check if any opponent piece can capture this piece
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === opponent) {
                const captureMoves = pureGetAvailableCaptureMoves(board, r, c);
                for (const move of captureMoves) {
                    if (isCapturedPieceAt(r, c, move.row, move.col, piece, row, col)) {
                        return true; // Piece is under threat
                    }
                }
            }
        }
    }
    return false;
}

// Quiescence search: continue searching captures at depth 0 to avoid horizon effect.
// Uses standard minimax (NOT negamax): evaluation is always from rootPlayer's perspective,
// and the search switches between maximizing (current player = rootPlayer) and
// minimizing (current player = opponent). The minimizing player correctly tries to
// minimize rootPlayer's score, so no evaluation negation is needed.
//
// In checkers/Dam Haji, capturing is mandatory. So we cannot "stand pat" if captures
// are available — the quiescence always explores all captures before evaluating.
function quiescenceSearch(board, player, aiPlayer, aiDifficulty, alpha, beta, rootPlayer, isMaximizingPlayer, activePiece = null) {
    checkTimeout();
    const moveInfo = getAllMovesForPlayer(board, player, activePiece);
    const captureMoves = moveInfo.captureMoves;

    if (captureMoves.length === 0) {
        // CRITICAL: Check for Haji threat creation before returning static eval
        if (aiDifficulty === 'hard' && activePiece === null) {
            // No active piece means we're not in a capture chain.
            // Check if the move just made by the opponent (who just moved) created a Haji threat chain.
            const justMovedPlayer = player === 'B' ? 'W' : 'B';
            const opponent = player; // Opponent of justMovedPlayer is the player about to move

            // Check if any Haji belonging to the player who just moved creates threat chains
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = board[r][c];
                    if (piece && piece.haji && piece.color === justMovedPlayer) {
                        const threats = countThreats(board, r, c, justMovedPlayer, opponent);
                        const onMainDiagonal = (r === c) || (r + c === 7);

                        // If Haji creates threat chains, continue searching
                        if (threats >= 3 || (onMainDiagonal && threats >= 2)) {
                            // This position is NOT quiet - Haji is dominating
                            // Return dynamic evaluation, not static
                            const evalScore = evaluateBoardState(board, rootPlayer, aiDifficulty);
                            const threatBonus = (threats * 50) + (onMainDiagonal ? 200 : 0);
                            
                            // If the player who just moved is the rootPlayer, it is a bonus.
                            // If they are the opponent of rootPlayer, it is a penalty.
                            const isRootPlayerMove = justMovedPlayer === rootPlayer;
                            return isRootPlayerMove ? evalScore + threatBonus : evalScore - threatBonus;
                        }
                    }
                }
            }
        }

        // Quiet position: return static evaluation from the root player's perspective
        // CRITICAL: Evaluate as rootPlayer to ensure correct perspective
        return evaluateBoardState(board, rootPlayer, aiDifficulty);
    }

    // Order captures for better pruning (lightweight inside search tree)
    const orderedMoves = orderMovesLightweight(board, captureMoves, player);

    let bestScore = isMaximizingPlayer ? -Infinity : Infinity;

    for (const move of orderedMoves) {
        const nextBoard = pureApplyMove(board, move);

        // Check for capture chain
        const continued = pureGetAvailableCaptureMoves(nextBoard, move.endRow, move.endCol);

        let nextPlayer, nextIsMaximizing, nextActivePiece;
        if (continued.length > 0) {
            nextPlayer = player;
            nextIsMaximizing = isMaximizingPlayer;
            nextActivePiece = { row: move.endRow, col: move.endCol };
        } else {
            nextPlayer = player === 'B' ? 'W' : 'B';
            nextIsMaximizing = !isMaximizingPlayer;
            nextActivePiece = null;
        }

        const score = quiescenceSearch(nextBoard, nextPlayer, aiPlayer, aiDifficulty, alpha, beta, rootPlayer, nextIsMaximizing, nextActivePiece);

        if (isMaximizingPlayer) {
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        } else {
            bestScore = Math.min(bestScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
    }

    return bestScore;
}

function enhancedMinimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty, rootPlayer, activePiece = null, currentHash = null) {
    checkTimeout();
    // Compute Zobrist hash for transposition table lookup
    const hash = currentHash !== null ? currentHash : ZOBRIST.hash(board, player, activePiece);

    // Check transposition table
    const ttEntry = transpositionTable.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.flag === TT_FLAG.EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.LOWERBOUND && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG.UPPERBOUND && ttEntry.score <= alpha) return ttEntry.score;
    }

    if (depth === 0) {
        // Use quiescence search instead of static eval to avoid horizon effect
        return quiescenceSearch(board, player, aiPlayer, aiDifficulty, alpha, beta, rootPlayer, isMaximizingPlayer, activePiece);
    }

    // Unified single board scan (restricted to activePiece if in a capture chain)
    const moveInfo = getAllMovesForPlayer(board, player, activePiece);
    const moves = moveInfo.allMoves;

    // No legal moves = player is stuck and loses.
    // Use large bounded values so arithmetic (e.g., aspiration window ±) stays valid.
    if (moves.length === 0) {
        return isMaximizingPlayer ? -1000000 : 1000000;
    }

    // Order moves for better pruning (lightweight inside search tree)
    const orderedMoves = orderMovesLightweight(board, moves, player);

    // If TT had a best move, promote it to the front
    if (ttEntry && ttEntry.bestMove) {
        const idx = orderedMoves.findIndex(m =>
            m.startRow === ttEntry.bestMove.startRow &&
            m.startCol === ttEntry.bestMove.startCol &&
            m.endRow === ttEntry.bestMove.endRow &&
            m.endCol === ttEntry.bestMove.endCol
        );
        if (idx > 0) {
            const [ttMove] = orderedMoves.splice(idx, 1);
            orderedMoves.unshift(ttMove);
        }
    }

    // Promote killer moves to front (after TT best move)
    if (killerMoves[depth]) {
        const km = killerMoves[depth];
        const kmIdx = orderedMoves.findIndex(m =>
            m.startRow === km.startRow &&
            m.startCol === km.startCol &&
            m.endRow === km.endRow &&
            m.endCol === km.endCol
        );
        if (kmIdx > 0) {
            const [kmMove] = orderedMoves.splice(kmIdx, 1);
            // Insert at index 1 (after the TT best move at index 0)
            const insertPos = Math.min(1, orderedMoves.length);
            orderedMoves.splice(insertPos, 0, kmMove);
        }
    }

    let bestMove = null;
    let bestScore;
    let cutoff = false;

    if (isMaximizingPlayer) {
        bestScore = -Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);

            // Check if the same piece can capture again (capture chain)
            const continuedCaptures = move.isCapture ? pureGetAvailableCaptureMoves(nextBoard, move.endRow, move.endCol) : [];

            // Compute rolling Zobrist hash for the child node
            const nextPlayer = continuedCaptures.length > 0 ? player : (player === "B" ? "W" : "B");
            const nextActivePiece = continuedCaptures.length > 0 ? { row: move.endRow, col: move.endCol } : null;
            const nextHash = ZOBRIST.getUpdatedHash(hash, board, move, player, nextPlayer, activePiece, nextActivePiece);

            let evaluation;
            if (continuedCaptures.length > 0) {
                evaluation = enhancedMinimax(nextBoard, depth - 1, true, alpha, beta, player, aiPlayer, aiDifficulty, rootPlayer, nextActivePiece, nextHash);
            } else {
                evaluation = enhancedMinimax(nextBoard, depth - 1, false, alpha, beta, nextPlayer, aiPlayer, aiDifficulty, rootPlayer, null, nextHash);
            }

            if (evaluation > bestScore) {
                bestScore = evaluation;
                bestMove = move;
            }
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                cutoff = true;
                // Store killer move
                if (!move.isCapture && depth < MAX_SEARCH_DEPTH) {
                    killerMoves[depth] = move;
                }
                break;
            }
        }
    } else {
        bestScore = Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);

            // Check if the same piece can capture again (capture chain)
            const continuedCaptures = move.isCapture ? pureGetAvailableCaptureMoves(nextBoard, move.endRow, move.endCol) : [];

            // Compute rolling Zobrist hash for the child node
            const nextPlayer = continuedCaptures.length > 0 ? player : (player === "B" ? "W" : "B");
            const nextActivePiece = continuedCaptures.length > 0 ? { row: move.endRow, col: move.endCol } : null;
            const nextHash = ZOBRIST.getUpdatedHash(hash, board, move, player, nextPlayer, activePiece, nextActivePiece);

            let evaluation;
            if (continuedCaptures.length > 0) {
                evaluation = enhancedMinimax(nextBoard, depth - 1, false, alpha, beta, player, aiPlayer, aiDifficulty, rootPlayer, nextActivePiece, nextHash);
            } else {
                evaluation = enhancedMinimax(nextBoard, depth - 1, true, alpha, beta, nextPlayer, aiPlayer, aiDifficulty, rootPlayer, null, nextHash);
            }

            if (evaluation < bestScore) {
                bestScore = evaluation;
                bestMove = move;
            }
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                cutoff = true;
                // Store killer move
                if (!move.isCapture && depth < MAX_SEARCH_DEPTH) {
                    killerMoves[depth] = move;
                }
                break;
            }
        }
    }

    // Store result in transposition table
    let flag;
    if (!cutoff || depth === 0) {
        flag = TT_FLAG.EXACT;
    } else if (isMaximizingPlayer) {
        // Beta cutoff - true score is at least bestScore
        flag = TT_FLAG.LOWERBOUND;
    } else {
        // Alpha cutoff - true score is at most bestScore
        flag = TT_FLAG.UPPERBOUND;
    }
    transpositionTable.set(hash, depth, bestScore, flag, bestMove);

    return bestScore;
}

function detectGamePhase(board, player) {
    let playerPieces = 0;
    let opponentPieces = 0;
    let playerHaji = 0;
    let opponentHaji = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;

            if (cell.color === player) {
                playerPieces++;
                if (cell.haji) playerHaji++;
            } else {
                opponentPieces++;
                if (cell.haji) opponentHaji++;
            }
        }
    }

    const totalPieces = playerPieces + opponentPieces;

    if (totalPieces <= 6) return 'endgame';
    if (totalPieces <= 12) return 'midgame';
    return 'opening';
}

function getDynamicDepth(aiDifficulty, gamePhase, board, player) {
    const baseDepths = {
        easy: { opening: 2, midgame: 3, endgame: 4 },
        medium: { opening: 5, midgame: 6, endgame: 8 },
        hard: { opening: 16, midgame: 20, endgame: 24 }  // SUPER HARD: 14/18/22 → 16/20/24 plies
    };

    let depth = baseDepths[aiDifficulty][gamePhase];

    // Adjust depth based on game state using unified move generation
    const moveInfo = getAllMovesForPlayer(board, player);
    if (moveInfo.hasCaptures) {
        depth += 2; // Search MUCH deeper when captures are available (HARD mode only)
    }

    // Count Haji pieces - increase depth for Haji endgames
    let hajiCount = 0;
    let opponentHajiCount = 0;
    const opponent = player === 'B' ? 'W' : 'B';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c]) {
                if (board[r][c].haji && board[r][c].color === player) hajiCount++;
                if (board[r][c].haji && board[r][c].color === opponent) opponentHajiCount++;
            }
        }
    }

    // CRITICAL: PANIC MODE - Opponent has Haji, AI doesn't
    if (aiDifficulty === 'hard' && opponentHajiCount >= 1 && hajiCount === 0) {
        depth += 8; // SUPER DESPERATE: Even deeper search (6→8)
    }

    // CRITICAL: Increase depth significantly when opponent has Haji
    if (opponentHajiCount >= 1) {
        depth += 6; // Even more desperate (5→6)
    }
    if (hajiCount >= 1) {
        depth += 4; // Use own Haji more effectively (3→4)
    }

    // For HARD mode: INCREASE depth in complex positions, not reduce!
    // Complex positions with many moves need deeper search to find tactical sequences
    if (aiDifficulty === 'hard' && (moveInfo.captureMoves.length + moveInfo.regularMoves.length) > 25) {
        depth += 4; // Search deeper in complex positions (3→4)
    } else if ((moveInfo.captureMoves.length + moveInfo.regularMoves.length) > 25) {
        depth = Math.max(depth - 1, 3); // Only reduce for easy/medium
    }

    return Math.min(depth, 32); // Cap at 32 for SUPER HARD mode (28→32)
}

function iterativeDeepeningSync(board, player, aiDifficulty, aiPlayer, maxTime = 5000) {
    // Reset transposition table for new search
    transpositionTable.reset();

    // Reset killer moves for new search
    killerMoves = new Array(MAX_SEARCH_DEPTH).fill(null);

    // Use dynamic time limit based on position
    const dynamicTime = getDynamicTimeLimit(aiDifficulty, board, player);
    const adjustedMaxTime = dynamicTime;

    const startTime = Date.now();
    let bestMove = null;
    let bestValue = -Infinity;
    let currentDepth = 1;

    const gamePhase = detectGamePhase(board, player);
    let maxDepth = getDynamicDepth(aiDifficulty, gamePhase, board, player);

    // Initialize search timing and node counts
    searchStartTime = startTime;
    searchTimeLimit = adjustedMaxTime;
    searchedNodesCount = 0;

    // Aspiration window: difficulty-aware sizing
    // Use wider windows for harder difficulties (larger material values mean larger score swings)
    const ASPIRATION_WINDOWS = { easy: 30, medium: 60, hard: 200 };  // INCREASED hard: 120→200 for deeper search accuracy
    const ASPIRATION_WINDOW = ASPIRATION_WINDOWS[aiDifficulty] || 50;
    let aspirate = false;

    try {
        while (currentDepth <= maxDepth && (Date.now() - startTime) < adjustedMaxTime) {
            let alpha = -Infinity;
            let beta = Infinity;

            // Use aspiration windows from depth 3 onwards (depth 1 & 2 always get full search for baseline)
            // Guard: clamp bestValue before computing aspiration window.
            // Prevents Infinity or extreme values from corrupting window arithmetic.
            if (aspirate && currentDepth >= 3 && isFinite(bestValue)) {
                const clamped = Math.max(-100000, Math.min(100000, bestValue));
                alpha = Math.max(alpha, clamped - ASPIRATION_WINDOW);
                beta = Math.min(beta, clamped + ASPIRATION_WINDOW);
            }

            const result = searchAtDepth(board, player, currentDepth, aiPlayer, aiDifficulty, alpha, beta);

            // If aspiration window failed, research with full window
            if (result.failHigh || result.failLow) {
                const fullResult = searchAtDepth(board, player, currentDepth, aiPlayer, aiDifficulty, -Infinity, Infinity);
                if (fullResult.move) {
                    bestMove = fullResult.move;
                    bestValue = fullResult.value;
                }
            } else if (result.move) {
                bestMove = result.move;
                bestValue = result.value;
                aspirate = true; // Enable aspiration for next depth
            } else {
                break;
            }

            currentDepth++;

            // Check time limit more frequently
            if (Date.now() - startTime > adjustedMaxTime) {
                break;
            }
        }
    } catch (e) {
        if (e.message !== "SearchTimeout") {
            throw e;
        }
        // Timeout caught - keep bestMove and bestValue from the last fully completed depth
    }

    const totalTime = Date.now() - startTime;
    // Debug: Iterative deepening completed (disabled for performance)
    
    // Safety: if bestValue somehow remained non-finite, fall back to null
    // so the caller can handle the absence of a move gracefully.
    if (!isFinite(bestValue)) {
        bestValue = 0;
        bestMove = null;
    }
    
    // Apply difficulty-based randomness to final result (not overwritten by deeper search)
    const finalMove = applyDifficultyRandomness(board, aiDifficulty, aiPlayer);
    return finalMove || bestMove;
}

function searchAtDepth(board, player, depth, aiPlayer, aiDifficulty, alpha = -Infinity, beta = Infinity) {
    const moveInfo = getAllMovesForPlayer(board, player);
    const moves = moveInfo.allMoves;

    if (moves.length === 0) return { move: null, value: isFinite(alpha) ? alpha : -Infinity, failLow: false, failHigh: false };

    // Save original alpha for aspiration window failure detection
    // (alpha gets mutated in the loop below to tighten windows for siblings)
    const originalAlpha = alpha;
    const originalBeta = beta;

    // Order root moves so promising captures/promotions are checked first.
    // This prevents tiebreaking errors when multiple moves lead to a win (1000000):
    // the first-evaluated winning move is kept, so we want the BEST one first.
    const orderedMoves = orderMoves(board, moves, player, aiDifficulty);

    let bestMove = null;
    let bestValue = -Infinity;
    // Track the pruning window separately from the original aspiration bounds
    let pruningAlpha = alpha;

    for (const move of orderedMoves) {
        const nextBoard = pureApplyMove(board, move);

        // Check for capture chain - if the AI's capture continues, don't toggle player
        const continued = move.isCapture ? pureGetAvailableCaptureMoves(nextBoard, move.endRow, move.endCol) : [];
        let nextPlayer, nextIsMaximizing, nextActivePiece;
        if (continued.length > 0) {
            // Capture chain: same player continues maximizing
            nextPlayer = player;
            nextIsMaximizing = true;
            nextActivePiece = { row: move.endRow, col: move.endCol };
        } else {
            // Chain ended: opponent gets turn (minimizing for AI)
            nextPlayer = player === 'B' ? 'W' : 'B';
            nextIsMaximizing = false;
            nextActivePiece = null;
        }

        // Use pruningAlpha (raised by earlier siblings) to enable cutoffs,
        // but the fail detection compares against originalAlpha to detect
        // aspiration window misses correctly.
        const val = enhancedMinimax(nextBoard, depth - 1, nextIsMaximizing, pruningAlpha, beta, nextPlayer, aiPlayer, aiDifficulty, aiPlayer, nextActivePiece);
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
        if (val > pruningAlpha) {
            pruningAlpha = val; // Tighten window for remaining siblings
        }
        if (beta <= pruningAlpha) {
            break;
        }
    }

    // Detect aspiration window failures:
    // - failLow: true score is BELOW the aspiration window (no move reached originalAlpha)
    // - failHigh: true score is ABOVE the aspiration window (best move exceeded originalBeta)
    // Use originalAlpha/originalBeta (not mutated pruningAlpha) for correct detection
    const failLow = bestValue <= originalAlpha && depth > 1;
    const failHigh = bestValue >= originalBeta && depth > 1;

    return { move: bestMove, value: bestValue, failLow, failHigh };
}

// Debug mode flag
const AI_DEBUG = true;  // ENABLING DEBUG MODE to identify why AI still loses

function findBestMove(board, player, aiDifficulty, aiPlayer) {
    // Check opening book first (avoids wasting search time on trivial early moves)
    const bookMove = getOpeningMove(board, player);
    if (bookMove) {
        if (AI_DEBUG) {
            console.log(`[AI ${aiDifficulty}] Using opening book move`);
        }
        return bookMove;
    }

    // Use iterative deepening (sync version for compatibility with script.js)
    const maxTime = getTimeLimit(aiDifficulty);
    const bestMove = iterativeDeepeningSync(board, player, aiDifficulty, aiPlayer, maxTime);

    // Debug: Log AI decision-making
    if (AI_DEBUG && bestMove) {
        const opponent = player === 'B' ? 'W' : 'B';

        // Analyze current position
        let playerHaji = 0, opponentHaji = 0;
        let playerThreats = 0, opponentThreats = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece) {
                    if (piece.color === player) {
                        if (piece.haji) playerHaji++;
                        playerThreats += countThreats(board, r, c, player, opponent);
                    } else {
                        if (piece.haji) opponentHaji++;
                        opponentThreats += countThreats(board, r, c, opponent, player);
                    }
                }
            }
        }

        const defensiveNeed = evaluateDefensiveNeed(board, player, opponent, aiDifficulty);
        const panicMode = (opponentHaji >= 1 && playerHaji === 0);

        console.log(`[AI ${aiDifficulty} as ${player}] DECISION:`);
        console.log(`  Best move: ${bestMove.startRow},${bestMove.startCol} → ${bestMove.endRow},${bestMove.endCol} ${bestMove.isCapture ? '(×)' : ''}`);
        console.log(`  Position analysis:`);
        console.log(`    Your Haji: ${playerHaji}, Opponent Haji: ${opponentHaji}`);
        console.log(`    Your threats: ${playerThreats}, Opponent threats: ${opponentThreats}`);
        console.log(`    Defensive need: ${defensiveNeed}`);
        console.log(`    Panic mode: ${panicMode ? 'YES' : 'NO'}`);

        // Show top 3 alternative moves with scores
        const moveInfo = getAllMovesForPlayer(board, player);
        const allMoves = moveInfo.allMoves;
        const scoredMoves = allMoves.map(move => ({
            move,
            score: scoreMove(board, move, player, aiDifficulty)
        })).sort((a, b) => b.score - a.score);

        console.log(`  Top 3 moves considered:`);
        for (let i = 0; i < Math.min(3, scoredMoves.length); i++) {
            const { move, score } = scoredMoves[i];
            console.log(`    ${i + 1}. ${move.startRow},${move.startCol} → ${move.endRow},${move.endCol} ${move.isCapture ? '(×)' : ''} (score: ${score.toFixed(1)})`);
        }
    }

    return bestMove;
}


