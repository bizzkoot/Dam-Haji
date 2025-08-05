// =============================================
// GAME.JS - CORE GAME LOGIC AND STATE
// =============================================

// --- BOARD AND PIECE HELPERS ---

function getPiece(row, col) {
    const cell = document.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
    return cell ? cell.firstChild : null;
}

function initializeBoard(board) {
  if (!board) {
    console.error("Board element is null or undefined!");
    return;
  }
  const boardSize = 8;
  board.innerHTML = ''; // Clear any existing board

  for (let row = 0; row < boardSize; row++) {
    const rowElement = document.createElement("div");
    rowElement.classList.add("board-row");
    for (let col = 0; col < boardSize; col++) {
      const cell = document.createElement("div");
      cell.classList.add("board-cell");
      cell.dataset.row = row;
      cell.dataset.col = col;
      
      if ((row + col) % 2 === 0) {
        cell.classList.add("light");
      } else {
        cell.classList.add("dark");
        if (row < 3) {
          const piece = document.createElement("div");
          piece.classList.add("piece", "black");
          cell.appendChild(piece);
        } else if (row > 4) {
          const piece = document.createElement("div");
          piece.classList.add("piece", "white");
          cell.appendChild(piece);
        }
      }
      rowElement.appendChild(cell);
    }
    board.appendChild(rowElement);
  }
}

// --- MOVE VALIDATION (FOR UI AND AI) ---

function isValidMove(startRow, startCol, endRow, endCol) {
  if (endRow < 0 || endRow >= 8 || endCol < 0 || endCol >= 8) {
    return false;
  }
  const piece = getPiece(startRow, startCol);
  if (!piece) {
    return false;
  }

  if (endRow === startRow && endCol === startCol) {
    return false;
  }

  const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);
  if (!endCell || endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    return false;
  }
  
  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  if (piece.classList.contains("haji")) {
    if (colDiff !== Math.abs(rowDiff)) {
        return false;
    }
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;
    while (currentRow !== endRow) {
      if (getPiece(currentRow, currentCol)) {
        return false;
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    return true;
  } else {
    if (colDiff !== 1) {
        return false;
    }
    if (piece.classList.contains("black") && rowDiff !== 1) {
        return false;
    }
    if (piece.classList.contains("white") && rowDiff !== -1) {
        return false;
    }
    return true;
  }
}

function isValidCapture(startRow, startCol, endRow, endCol) {
  if (endRow < 0 || endRow >= 8 || endCol < 0 || endCol >= 8) {
    return false;
  }
  const piece = getPiece(startRow, startCol);
  if (!piece) {
    return false;
  }

  const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);
  // Landing must be an empty dark square
  if (!endCell || endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    return false;
  }

  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  if (piece.classList.contains("haji")) {
    if (colDiff !== Math.abs(rowDiff)) {
        return false;
    }
    
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;
    let capturedCount = 0;
    
    while (currentRow !== endRow) {
      const jumpedPiece = getPiece(currentRow, currentCol);
      if (jumpedPiece) {
        if (jumpedPiece.classList.contains(piece.classList.contains("black") ? "white" : "black")) {
          capturedCount++;
        } else {
          return false; // Can't jump own piece
        }
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return capturedCount === 1;
  } else {
    if (colDiff !== 2 || Math.abs(rowDiff) !== 2) {
        return false;
    }
    const capturedRow = (startRow + endRow) / 2;
    const capturedCol = (startCol + endCol) / 2;
    const capturedPiece = getPiece(capturedRow, capturedCol);
    if (!capturedPiece || capturedPiece.classList.contains(piece.classList.contains("black") ? "black" : "white")) {
      return false;
    }
    return true;
  }
}

// --- MOVE GENERATION (FOR UI AND AI) ---

function getAvailableCaptureMoves(row, col) {
    const moves = [];
    const piece = getPiece(row, col);
    if (!piece) return moves;

    const isHaji = piece.classList.contains('haji');
    
    if (isHaji) {
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        directions.forEach(dir => {
            for (let distance = 2; distance <= 7; distance++) { // Haji captures jump at least one piece
                const newRow = row + (dir[0] * distance);
                const newCol = col + (dir[1] * distance);
                if (isValidCapture(row, col, newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        });
    } else {
        const player = piece.classList.contains('black') ? 'B' : 'W';
        let directions = [];
        if (player === 'B') {
            directions = [[2, -2], [2, 2]];
        } else {
            directions = [[-2, -2], [-2, 2]];
        }
        
        directions.forEach(dir => {
            const newRow = row + dir[0];
            const newCol = col + dir[1];
            if (isValidCapture(row, col, newRow, newCol)) {
                moves.push({ row: newRow, col: newCol });
            }
        });
    }
    return moves;
}

function getAvailableRegularMoves(row, col) {
    const moves = [];
    const piece = getPiece(row, col);
    if (!piece) return moves;

    const isHaji = piece.classList.contains('haji');
    
    if (isHaji) {
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        directions.forEach(dir => {
            for (let distance = 1; distance <= 7; distance++) {
                const newRow = row + (dir[0] * distance);
                const newCol = col + (dir[1] * distance);
                if (isValidMove(row, col, newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    break; 
                }
            }
        });
    } else {
        const player = piece.classList.contains('black') ? 'B' : 'W';
        let directions = [];
        if (player === 'B') {
            directions = [[1, -1], [1, 1]];
        } else {
            directions = [[-1, -1], [-1, 1]];
        }

        directions.forEach(dir => {
            const newRow = row + dir[0];
            const newCol = col + dir[1];
            if (isValidMove(row, col, newRow, newCol)) {
                moves.push({ row: newRow, col: newCol });
            }
        });
    }
    return moves;
}

function checkAvailableCaptures(player) {
  const pieces = document.querySelectorAll(`.piece.${player === "B" ? "black" : "white"}`);
  for (const piece of pieces) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    if (getAvailableCaptureMoves(row, col).length > 0) {
      return true;
    }
  }
  return false;
}

function hasAvailableMoves(player) {
  const pieces = document.querySelectorAll(`.piece.${player === "B" ? "black" : "white"}`);
  for (const piece of pieces) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    if (getAvailableCaptureMoves(row, col).length > 0) {
      return true;
    }
    if (getAvailableRegularMoves(row, col).length > 0) {
      return true;
    }
  }
  return false;
}

function canCaptureAgain(row, col) {
    // Defensive check: ensure the piece still exists at the given coordinates.
    const piece = getPiece(row, col);
    if (!piece) return false;

    const moves = getAvailableCaptureMoves(row, col);

    // Extra safety: for each candidate capture, validate the intermediate jumped square
    // is occupied by an opponent NOW (prevents stale/chained jumps over an already removed piece).
    const enemyClass = piece.classList.contains('black') ? 'white' : 'black';
    const filtered = moves.filter(m => {
        const midRow = (row + m.row) / 2;
        const midCol = (col + m.col) / 2;
        // For Haji, there can be variable distance; compute along diagonal and require exactly one enemy.
        if (piece.classList.contains('haji')) {
            const rowStep = m.row > row ? 1 : -1;
            const colStep = m.col > col ? 1 : -1;
            let r = row + rowStep, c = col + colStep;
            let capturedCount = 0;
            while (r !== m.row) {
                const jumped = getPiece(r, c);
                if (jumped) {
                    if (jumped.classList.contains(enemyClass)) {
                        capturedCount++;
                    } else {
                        // Own piece blocks — invalid continuation
                        return false;
                    }
                }
                r += rowStep;
                c += colStep;
            }
            return capturedCount === 1;
        } else {
            // Regular piece: must be exactly one step over a single enemy and land on empty
            if (!Number.isInteger(midRow) || !Number.isInteger(midCol)) return false;
            const jumped = getPiece(midRow, midCol);
            return !!(jumped && jumped.classList.contains(enemyClass));
        }
    });

    return filtered.length > 0;
}

function checkWinCondition() {
  const blackPieces = document.querySelectorAll(".piece.black");
  const whitePieces = document.querySelectorAll(".piece.white");

  if (blackPieces.length === 0) {
    showWinMessage("White");
    return true;
  }

  if (whitePieces.length === 0) {
    showWinMessage("Black");
    return true;
  }

  // Stalemate check: If the current player has no moves, they lose.
  if (!hasAvailableMoves(currentPlayer)) {
      const winner = currentPlayer === "B" ? "White" : "Black";
      showWinMessage(winner);
      return true;
  }

  // Draw condition check
  if (movesSinceCapture >= MAX_MOVES_WITHOUT_CAPTURE) {
      showWinMessage("Draw");
      return true;
  }

  return false;
}
