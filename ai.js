// =============================================
// AI.JS - ARTIFICIAL INTELLIGENCE LOGIC
// =============================================

// --- AI CONFIGURATION ---

const AI_WEIGHTS = {
    easy: {
        captureValue: 10,
        pieceValue: 1,
        positionValue: 0.1,
        hajiValue: 3,
        centerControl: 0.05
    },
    medium: {
        captureValue: 15,
        pieceValue: 1.5,
        positionValue: 0.2,
        hajiValue: 5,
        centerControl: 0.1
    },
    hard: {
        captureValue: 20,
        pieceValue: 2,
        positionValue: 0.3,
        hajiValue: 8,
        centerControl: 0.15
    }
};

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
    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;
    let playerPieces = 0;
    let opponentPieces = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (!cell) continue;
            
            // Count pieces for capture evaluation
            if (cell.color === player) {
                playerPieces++;
            } else {
                opponentPieces++;
            }
            
            const isPlayer = cell.color === player;
            let pieceValue = weights.pieceValue + (cell.haji ? weights.hajiValue : 0);
            const positionValue = isPlayer ? (player === 'B' ? r / 7 : (7 - r) / 7) : (player === 'B' ? (7 - r) / 7 : r / 7);
            const centerDistance = Math.abs(c - 3.5) + Math.abs(r - 3.5);
            const centerValue = (7 - centerDistance) / 7;
            const total = pieceValue + (positionValue * weights.positionValue) + (centerValue * weights.centerControl);
            score += isPlayer ? total : -total;
        }
    }
    
    // Add capture value - more captures = better score for player
    const captureValue = (playerPieces - opponentPieces) * weights.captureValue;
    score += captureValue;
    
    return score;
}

function minimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty) {
    if (depth === 0) {
        return evaluateBoardState(board, player, aiDifficulty);
    }

    // NEW: Implement forced capture logic in minimax as well
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    
    // If forced captures exist, only consider capture moves
    // If no forced captures, consider regular moves
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);

    if (moves.length === 0) {
        return isMaximizingPlayer ? -Infinity : Infinity;
    }

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, false, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, true, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function findBestMove(board, player, aiDifficulty, aiPlayer) {
    const depth = { easy: 1, medium: 3, hard: 5 }[aiDifficulty];
    let bestMove = null;
    let bestValue = -Infinity;
    
    // NEW: Implement forced capture logic like the player
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    
    // If forced captures exist, only consider capture moves
    // If no forced captures, consider regular moves
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);

    // --- AI DIAGNOSTIC LOGGING ---
    console.log(`[AI DEBUG] Board state at start of AI turn for player ${player}:`);
    console.table(board.map(row => row.map(p => p ? `${p.color}${p.haji ? 'H' : ''}` : '.')));
    console.log(`[AI DEBUG] Turn: ${player}`);
    console.log(`[AI DEBUG] Forced Capture Active: ${mustCapture}`);
    console.log(`[AI DEBUG] Found ${captureMoves.length} capture moves:`, captureMoves.map(m => `(${m.startRow},${m.startCol})->(${m.endRow},${m.endCol})`));
    console.log(`[AI DEBUG] Found ${regularMoves.length} regular moves:`, regularMoves.map(m => `(${m.startRow},${m.startCol})->(${m.endRow},${m.endCol})`));
    console.log(`[AI DEBUG] Moves being considered by AI:`, moves.map(m => `(${m.startRow},${m.startCol})->(${m.endRow},${m.endCol})`));
    // --- END AI DIAGNOSTIC LOGGING ---

    for (const move of moves) {
        const nextBoard = pureApplyMove(board, move);
        const val = minimax(nextBoard, depth - 1, false, -Infinity, Infinity, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
    }

    // --- AI DIAGNOSTIC LOGGING ---
    if (bestMove) {
        console.log(`[AI DEBUG] Best move found: (${bestMove.startRow},${bestMove.startCol})->(${bestMove.endRow},${bestMove.endCol}) with value: ${bestValue}`);
    } else {
        console.log(`[AI DEBUG] No best move found.`);
    }
    // --- END AI DIAGNOSTIC LOGGING ---
    
    return bestMove;
}
