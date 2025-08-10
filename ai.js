// =============================================
// AI.JS - ARTIFICIAL INTELLIGENCE LOGIC
// =============================================

// --- AI CONFIGURATION ---

const AI_TIME_LIMITS = {
    easy: 1000,    // 1 second for more responsive AI
    medium: 3000,  // 3 seconds for balanced play
    hard: 10000    // 10 seconds for maximum difficulty
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
        captureValue: 5,       // Reduced emphasis on captures
        pieceValue: 0.5,       // Reduced piece value
        positionValue: 0.05,   // Less concerned about position
        hajiValue: 1,          // Haji less important
        centerControl: 0.02    // Minimal center control
    },
    medium: {
        captureValue: 10,      // Balanced capture value
        pieceValue: 1,         // Standard piece value
        positionValue: 0.1,    // Moderate position awareness
        hajiValue: 3,          // Reasonable haji value
        centerControl: 0.05    // Some center control
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
    
    // Add positional pattern bonuses
    score += evaluatePositionalPatterns(board, player, aiDifficulty);
    
    return score;
}

function scoreMove(board, move, player, aiDifficulty) {
    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;
    
    // Capture moves get highest priority
    if (move.isCapture) {
        score += 1000;
        
        // Multiple captures get bonus
        const nextBoard = pureApplyMove(board, move);
        const nextCaptures = pureGetAllCaptureMoves(nextBoard, player);
        score += nextCaptures.length * 100;
    }
    
    // Haji moves get priority
    const piece = board[move.startRow][move.startCol];
    if (piece && piece.haji) {
        score += 100;
    }
    
    // Center control
    const centerDistance = Math.abs(move.endCol - 3.5) + Math.abs(move.endRow - 3.5);
    score += (7 - centerDistance) * 10;
    
    // Promotion moves
    if ((move.endRow === 0 && player === 'W') || (move.endRow === 7 && player === 'B')) {
        score += 200;
    }
    
    // Position value
    const positionValue = player === 'B' ? move.endRow / 7 : (7 - move.endRow) / 7;
    score += positionValue * 50;
    
    // Threat assessment - penalize moves that put piece under threat
    const nextBoard = pureApplyMove(board, move);
    const opponent = player === 'B' ? 'W' : 'B';
    if (isPieceUnderThreat(nextBoard, move.endRow, move.endCol, player, opponent)) {
        score -= 50; // Penalize unsafe moves
    }
    
    // Threat creation - reward moves that threaten opponent pieces
    const threats = countThreats(nextBoard, move.endRow, move.endCol, player, opponent);
    score += threats * 30;
    
    return score;
}

function countThreats(board, row, col, player, opponent) {
    let threatCount = 0;
    const piece = board[row][col];
    if (!piece) return 0;
    
    // Get all possible moves from this new position
    const regularMoves = pureGetAvailableRegularMoves(board, row, col);
    const captureMoves = pureGetAvailableCaptureMoves(board, row, col);
    
    // Count threatened opponent pieces
    for (const move of captureMoves) {
        const target = board[move.row][move.col];
        if (target && target.color === opponent) {
            threatCount++;
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

function predictOpponentMoves(board, player, aiDifficulty) {
    const opponent = player === 'B' ? 'W' : 'B';
    const opponentMoves = pureGetAllCaptureMoves(board, opponent);
    const regularMoves = pureGetAllRegularMoves(board, opponent);
    const allMoves = [...opponentMoves, ...regularMoves];
    
    // Score opponent moves from their perspective
    return allMoves.map(move => ({
        ...move,
        score: scoreMove(board, move, opponent, aiDifficulty)
    })).sort((a, b) => b.score - a.score);
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

function evaluateEndgame(board, player, aiDifficulty) {
    const weights = AI_WEIGHTS[aiDifficulty];
    let score = 0;
    
    if (isKingVsKing(board, player)) {
        score = evaluateKingVsKing(board, player, aiDifficulty);
    } else {
        score = evaluateBoardState(board, player, aiDifficulty);
    }
    
    return score;
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
    
    // King vs King evaluation
    let score = (playerHaji - opponentHaji) * 1000; // Haji count is crucial
    score += (playerCenterControl - opponentCenterControl) * 100; // Center control matters
    score += (playerHaji - opponentHaji) * 50; // Extra weight for Haji advantage
    
    return score;
}

function evaluatePositionalPatterns(board, player, aiDifficulty) {
    let score = 0;
    const weights = AI_WEIGHTS[aiDifficulty];
    
    // Evaluate piece mobility (more mobile pieces = better)
    const playerMoves = pureGetAllRegularMoves(board, player).length + pureGetAllCaptureMoves(board, player).length;
    const opponentMoves = pureGetAllRegularMoves(board, player === 'B' ? 'W' : 'B').length + 
                         pureGetAllCaptureMoves(board, player === 'B' ? 'W' : 'B').length;
    score += (playerMoves - opponentMoves) * weights.positionValue * 10;
    
    // Evaluate piece coordination (pieces supporting each other)
    score += evaluatePieceCoordination(board, player, weights) * weights.positionValue * 5;
    
    // Evaluate defensive patterns
    score += evaluateDefensivePatterns(board, player, weights) * weights.positionValue * 3;
    
    return score;
}

function evaluatePieceCoordination(board, player, weights) {
    let coordinationScore = 0;
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === player) {
                // Check if piece is protected by another friendly piece
                const protected = isPieceProtected(board, r, c, player);
                if (protected) coordinationScore += 1;
                
                // Check if piece is part of a coordinated attack
                const attacking = isPieceAttacking(board, r, c, player);
                if (attacking) coordinationScore += 1;
            }
        }
    }
    
    return coordinationScore;
}

function isPieceProtected(board, row, col, player) {
    // Check if any friendly piece can move to this position
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === player && !(r === row && c === col)) {
                const regularMoves = pureGetAvailableRegularMoves(board, r, c);
                const captureMoves = pureGetAvailableCaptureMoves(board, r, c);
                const allMoves = [...regularMoves, ...captureMoves];
                
                for (const move of allMoves) {
                    if (move.row === row && move.col === col) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function isPieceAttacking(board, row, col, player) {
    // Check if this piece can attack an opponent piece that is also under threat
    const captureMoves = pureGetAvailableCaptureMoves(board, row, col);
    for (const move of captureMoves) {
        const targetPiece = board[move.row][move.col];
        if (targetPiece && targetPiece.color !== player) {
            // Check if this target is also protected by another piece
            const opponent = player === 'B' ? 'W' : 'B';
            if (isPieceProtected(board, move.row, move.col, opponent)) {
                return true; // Coordinated attack
            }
        }
    }
    return false;
}

function evaluateDefensivePatterns(board, player, weights) {
    let defensiveScore = 0;
    const opponent = player === 'B' ? 'W' : 'B';
    
    // Evaluate piece safety (pieces not under threat)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === player) {
                if (!isPieceUnderThreat(board, r, c, player, opponent)) {
                    defensiveScore += 1; // Safe piece
                }
            }
        }
    }
    
    return defensiveScore;
}

function isPieceUnderThreat(board, row, col, player, opponent) {
    // Check if any opponent piece can capture this piece
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === opponent) {
                const captureMoves = pureGetAvailableCaptureMoves(board, r, c);
                for (const move of captureMoves) {
                    if (move.row === row && move.col === col) {
                        return true; // Piece is under threat
                    }
                }
            }
        }
    }
    return false;
}

function minimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty) {
    if (depth === 0) {
        if (isEndgame(board, player)) {
            return evaluateEndgame(board, player, aiDifficulty);
        }
        return evaluateBoardState(board, player, aiDifficulty);
    }
    
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);

    if (moves.length === 0) {
        return isMaximizingPlayer ? -Infinity : Infinity;
    }

    // Order moves for better pruning
    const orderedMoves = orderMoves(board, moves, player, aiDifficulty);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, false, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                // Alpha-beta cutoff (removed debug log for performance)
                break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = minimax(nextBoard, depth - 1, true, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                // Alpha-beta cutoff (removed debug log for performance)
                break;
            }
        }
        return minEval;
    }
}

function enhancedMinimax(board, depth, isMaximizingPlayer, alpha, beta, player, aiPlayer, aiDifficulty, rootPlayer) {
    if (depth === 0) {
        if (isEndgame(board, player)) {
            return evaluateEndgame(board, rootPlayer, aiDifficulty);
        }
        return evaluateBoardState(board, rootPlayer, aiDifficulty);
    }
    
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);

    if (moves.length === 0) {
        return isMaximizingPlayer ? -Infinity : Infinity;
    }

    // Order moves for better pruning
    const orderedMoves = orderMoves(board, moves, player, aiDifficulty);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            
            // For root player's moves, consider opponent's likely response
            let evaluation;
            if (depth === 1 && player === rootPlayer) {
                // Predict opponent's best response
                evaluation = getPredictedOpponentResponse(nextBoard, player, aiDifficulty);
            } else {
                evaluation = enhancedMinimax(nextBoard, depth - 1, false, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty, rootPlayer);
            }
            
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) {
                break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of orderedMoves) {
            const nextBoard = pureApplyMove(board, move);
            const evaluation = enhancedMinimax(nextBoard, depth - 1, true, alpha, beta, player === "B" ? "W" : "B", aiPlayer, aiDifficulty, rootPlayer);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) {
                break;
            }
        }
        return minEval;
    }
}

function getPredictedOpponentResponse(board, aiPlayer, aiDifficulty) {
    const opponent = aiPlayer === 'B' ? 'W' : 'B';
    
    // Get opponent's possible moves
    const opponentMoves = predictOpponentMoves(board, aiPlayer, aiDifficulty);
    
    // If opponent has moves, evaluate position after their best move
    if (opponentMoves.length > 0) {
        // Apply opponent's best move
        const bestOpponentMove = opponentMoves[0];
        const boardAfterOpponentMove = pureApplyMove(board, bestOpponentMove);
        
        // Evaluate from AI's perspective after opponent's move
        return evaluateBoardState(boardAfterOpponentMove, aiPlayer, aiDifficulty);
    }
    
    // If no opponent moves, evaluate current position
    return evaluateBoardState(board, aiPlayer, aiDifficulty);
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
        easy: { opening: 1, midgame: 2, endgame: 3 },    // Reduced depths for easier play
        medium: { opening: 2, midgame: 3, endgame: 4 },  // Moderate depths
        hard: { opening: 6, midgame: 7, endgame: 8 }     // Full depths for maximum challenge
    };
    
    let depth = baseDepths[aiDifficulty][gamePhase];
    
    // Adjust depth based on game state
    const mustCapture = pureCheckAvailableCaptures(board, player);
    if (mustCapture) {
        depth += 1; // Search deeper when captures are available
    }
    
    // Reduce depth in complex positions
    const totalMoves = pureGetAllCaptureMoves(board, player).length + pureGetAllRegularMoves(board, player).length;
    if (totalMoves > 20) {
        depth = Math.max(depth - 1, 1);
    }
    
    return depth;
}

function iterativeDeepeningSync(board, player, aiDifficulty, aiPlayer, maxTime = 5000) {
    // Use dynamic time limit based on position
    const dynamicTime = getDynamicTimeLimit(aiDifficulty, board, player);
    const adjustedMaxTime = Math.min(maxTime, dynamicTime);
    
    const startTime = Date.now();
    let bestMove = null;
    let bestValue = -Infinity;
    let currentDepth = 1;
    
    const gamePhase = detectGamePhase(board, player);
    let maxDepth = getDynamicDepth(aiDifficulty, gamePhase, board, player);
    
    // Restore original live settings - no artificial depth limiting
    // The original AI worked perfectly with full depth
    
    // Debug: Game phase and max depth (disabled for performance)
    
    while (currentDepth <= maxDepth && (Date.now() - startTime) < adjustedMaxTime) {
        // Debug: Searching at depth (disabled for performance)
        
        const result = searchAtDepth(board, player, currentDepth, aiPlayer, aiDifficulty);
        
        if (result.move) {
            bestMove = result.move;
            bestValue = result.value;
            // Debug: Depth completed (disabled for performance)
        } else {
            // Debug: No move found (disabled for performance)
            break;
        }
        
        currentDepth++;
        
        // Check time limit more frequently
        if (Date.now() - startTime > adjustedMaxTime) {
            break;
        }
    }
    
    const totalTime = Date.now() - startTime;
    // Debug: Iterative deepening completed (disabled for performance)
    
    return bestMove;
}

async function iterativeDeepening(board, player, aiDifficulty, aiPlayer, maxTime = 5000) {
    // Use dynamic time limit based on position
    const dynamicTime = getDynamicTimeLimit(aiDifficulty, board, player);
    const adjustedMaxTime = Math.min(maxTime, dynamicTime);
    
    const startTime = Date.now();
    let bestMove = null;
    let bestValue = -Infinity;
    let currentDepth = 1;
    
    const gamePhase = detectGamePhase(board, player);
    let maxDepth = getDynamicDepth(aiDifficulty, gamePhase, board, player);
    
    // Restore original live settings - no browser-specific limitations
    // The original code worked fine across all browsers
    
    // Debug: Game phase and max depth (disabled for performance)
    
    while (currentDepth <= maxDepth && (Date.now() - startTime) < adjustedMaxTime) {
        // Debug: Searching at depth (disabled for performance)
        
        const result = await searchAtDepthAsync(board, player, currentDepth, aiPlayer, aiDifficulty, startTime, adjustedMaxTime);
        
        if (result.move) {
            bestMove = result.move;
            bestValue = result.value;
            // Debug: Depth completed (disabled for performance)
        } else {
            // Debug: No move found (disabled for performance)
            break;
        }
        
        currentDepth++;
        
        // Yield to browser every depth level to prevent freezing
        if (currentDepth <= maxDepth) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    const totalTime = Date.now() - startTime;
    // Debug: Iterative deepening completed (disabled for performance)
    
    return bestMove;
}

async function searchAtDepthAsync(board, player, depth, aiPlayer, aiDifficulty, startTime, maxTime) {
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);
    
    if (moves.length === 0) return { move: null, value: -Infinity };
    
    // Introduce mistakes for easier difficulties
    if (aiDifficulty === 'easy' && moves.length > 1) {
        // For easy mode, sometimes pick a random move instead of the best
        if (Math.random() < 0.3) { // 30% chance of making a random move
            const randomIndex = Math.floor(Math.random() * moves.length);
            return { move: moves[randomIndex], value: 0 };
        }
    } else if (aiDifficulty === 'medium' && moves.length > 1) {
        // For medium mode, sometimes pick a suboptimal move
        if (Math.random() < 0.1) { // 10% chance of making a suboptimal move
            // Pick a move that's not the best but not the worst either
            if (moves.length > 2) {
                const suboptimalIndex = 1 + Math.floor(Math.random() * (moves.length - 2));
                return { move: moves[suboptimalIndex], value: 0 };
            }
        }
    }
    
    let bestMove = null;
    let bestValue = -Infinity;
    let moveCount = 0;
    
    for (const move of moves) {
        // Check time limit
        if (Date.now() - startTime > maxTime) {
            break;
        }
        
        const nextBoard = pureApplyMove(board, move);
        const val = enhancedMinimax(nextBoard, depth - 1, false, -Infinity, Infinity, player === "B" ? "W" : "B", aiPlayer, aiDifficulty, aiPlayer);
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
        
        moveCount++;
        // Yield every 5 moves to prevent browser freezing
        if (moveCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    return { move: bestMove, value: bestValue };
}

// Sync version for compatibility
function searchAtDepth(board, player, depth, aiPlayer, aiDifficulty) {
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);
    
    if (moves.length === 0) return { move: null, value: -Infinity };
    
    // Introduce mistakes for easier difficulties
    if (aiDifficulty === 'easy' && moves.length > 1) {
        // For easy mode, sometimes pick a random move instead of the best
        if (Math.random() < 0.3) { // 30% chance of making a random move
            const randomIndex = Math.floor(Math.random() * moves.length);
            return { move: moves[randomIndex], value: 0 };
        }
    } else if (aiDifficulty === 'medium' && moves.length > 1) {
        // For medium mode, sometimes pick a suboptimal move
        if (Math.random() < 0.1) { // 10% chance of making a suboptimal move
            // Pick a move that's not the best but not the worst either
            if (moves.length > 2) {
                const suboptimalIndex = 1 + Math.floor(Math.random() * (moves.length - 2));
                return { move: moves[suboptimalIndex], value: 0 };
            }
        }
    }
    
    let bestMove = null;
    let bestValue = -Infinity;
    
    for (const move of moves) {
        const nextBoard = pureApplyMove(board, move);
        const val = enhancedMinimax(nextBoard, depth - 1, false, -Infinity, Infinity, player === "B" ? "W" : "B", aiPlayer, aiDifficulty, aiPlayer);
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
    }
    
    return { move: bestMove, value: bestValue };
}

async function findBestMoveAsync(board, player, aiDifficulty, aiPlayer) {
    // Use async iterative deepening to prevent browser freezing
    const maxTime = getTimeLimit(aiDifficulty);
    return await iterativeDeepening(board, player, aiDifficulty, aiPlayer, maxTime);
}

function findBestMove(board, player, aiDifficulty, aiPlayer) {
    // Use iterative deepening instead of fixed depth (sync version like original)
    const maxTime = getTimeLimit(aiDifficulty);
    return iterativeDeepeningSync(board, player, aiDifficulty, aiPlayer, maxTime);
}

function findBestMoveFirefoxCompat(board, player, aiDifficulty, aiPlayer) {
    const startTime = Date.now();
    const maxTime = 1000; // 1 second max for Firefox
    
    const mustCapture = pureCheckAvailableCaptures(board, player);
    const captureMoves = pureGetAllCaptureMoves(board, player);
    const regularMoves = pureGetAllRegularMoves(board, player);
    const moves = mustCapture ? captureMoves : (captureMoves.length > 0 ? captureMoves : regularMoves);
    
    if (moves.length === 0) return null;
    
    // Introduce mistakes for easier difficulties
    if (aiDifficulty === 'easy' && moves.length > 1) {
        // For easy mode, sometimes pick a random move instead of the best
        if (Math.random() < 0.3) { // 30% chance of making a random move
            const randomIndex = Math.floor(Math.random() * moves.length);
            return moves[randomIndex];
        }
    } else if (aiDifficulty === 'medium' && moves.length > 1) {
        // For medium mode, sometimes pick a suboptimal move
        if (Math.random() < 0.1) { // 10% chance of making a suboptimal move
            // Pick a move that's not the best but not the worst either
            if (moves.length > 2) {
                const suboptimalIndex = 1 + Math.floor(Math.random() * (moves.length - 2));
                return moves[suboptimalIndex];
            }
        }
    }
    
    // Use very reduced depth for Firefox compatibility
    const depth = aiDifficulty === 'easy' ? 1 : aiDifficulty === 'medium' ? 2 : 3;
    
    let bestMove = moves[0]; // Fallback to first move
    let bestValue = -Infinity;
    let moveCount = 0;
    
    for (const move of moves) {
        // Check time limit frequently
        if (Date.now() - startTime > maxTime) {
            console.log('Firefox: Time limit reached, returning best move found so far');
            break;
        }
        
        const nextBoard = pureApplyMove(board, move);
        
        // Use simplified evaluation for Firefox
        let val;
        if (depth <= 1) {
            // Direct evaluation without minimax for very fast response
            val = evaluateBoardState(nextBoard, player, aiDifficulty);
        } else {
            val = enhancedMinimax(nextBoard, depth - 1, false, -Infinity, Infinity, player === "B" ? "W" : "B", aiPlayer, aiDifficulty, aiPlayer);
        }
        
        if (val > bestValue) {
            bestValue = val;
            bestMove = move;
        }
        
        moveCount++;
        // Early break if we've evaluated enough moves and have a good move
        if (moveCount >= 10 && bestValue > -100) {
            console.log('Firefox: Early break after evaluating', moveCount, 'moves');
            break;
        }
    }
    
    return bestMove;
}
