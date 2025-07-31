console.log("Dam Haji game loaded!");

let currentPlayer = "B"; // Black starts first
let selectedPiece = null; // Track the selected piece
let blackScore = 0;
let whiteScore = 0;

function generateTransactionId() {
    return 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function logStep(txId, step, status, data) {
    console.log(JSON.stringify({
        transactionId: txId,
        timestamp: new Date().toISOString(),
        step: step,
        status: status,
        data: data
    }, null, 2));
}

function initializeBoard(board) {
  console.log("initializeBoard called with board:", board);
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

function getPiece(row, col) {
    const cell = document.querySelector(`.board-cell[data-row="${row}"][data-col="${col}"]`);
    return cell ? cell.firstChild : null;
}

function highlightAvailableMoves(piece, txId) {
    logStep(txId, 'highlightAvailableMoves', 'START', { piece: piece ? piece.outerHTML : null });
    clearAvailableMoves();
    const pieceRow = parseInt(piece.parentNode.dataset.row);
    const pieceCol = parseInt(piece.parentNode.dataset.col);

    const mustCapture = checkAvailableCaptures(txId);
    logStep(txId, 'highlightAvailableMoves', 'INFO', { mustCapture: mustCapture });

    if (mustCapture) {
        const captureMoves = getAvailableCaptureMoves(pieceRow, pieceCol, txId);
        logStep(txId, 'highlightAvailableMoves', 'INFO', { captureMoves: captureMoves });
        captureMoves.forEach(move => {
            const cell = document.querySelector(`.board-cell[data-row="${move.row}"][data-col="${move.col}"]`);
            if (cell) cell.classList.add('capture-move');
        });
    } else {
        const regularMoves = getAvailableRegularMoves(pieceRow, pieceCol, txId);
        logStep(txId, 'highlightAvailableMoves', 'INFO', { regularMoves: regularMoves });
        regularMoves.forEach(move => {
            const cell = document.querySelector(`.board-cell[data-row="${move.row}"][data-col="${move.col}"]`);
            if (cell) cell.classList.add('available-move');
        });
    }
    logStep(txId, 'highlightAvailableMoves', 'SUCCESS', {});
}

function getAvailableCaptureMoves(row, col, txId) {
    logStep(txId, 'getAvailableCaptureMoves', 'START', { row: row, col: col });
    const moves = [];
    const piece = getPiece(row, col);
    if (!piece) {
        logStep(txId, 'getAvailableCaptureMoves', 'SUCCESS', { moves: moves });
        return moves;
    }

    const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    
    directions.forEach(dir => {
        const newRow = row + dir[0];
        const newCol = col + dir[1];
        if (isValidCapture(row, col, newRow, newCol, txId)) {
            moves.push({ row: newRow, col: newCol });
        }
    });
    logStep(txId, 'getAvailableCaptureMoves', 'SUCCESS', { moves: moves });
    return moves;
}

function getAvailableRegularMoves(row, col, txId) {
    logStep(txId, 'getAvailableRegularMoves', 'START', { row: row, col: col });
    const moves = [];
    const piece = getPiece(row, col);
    if (!piece) {
        logStep(txId, 'getAvailableRegularMoves', 'SUCCESS', { moves: moves });
        return moves;
    }

    const player = piece.classList.contains('black') ? 'B' : 'W';
    const isHaji = piece.classList.contains('haji');
    
    let directions = [];
    if (isHaji) {
        directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    } else if (player === 'B') {
        directions = [[1, -1], [1, 1]];
    } else {
        directions = [[-1, -1], [-1, 1]];
    }

    directions.forEach(dir => {
        const newRow = row + dir[0];
        const newCol = col + dir[1];
        if (isValidMove(row, col, newRow, newCol, txId)) {
            moves.push({ row: newRow, col: newCol });
        }
    });
    logStep(txId, 'getAvailableRegularMoves', 'SUCCESS', { moves: moves });
    return moves;
}


function clearAvailableMoves() {
  document.querySelectorAll('.available-move').forEach(square => {
    square.classList.remove('available-move');
  });
  document.querySelectorAll('.capture-move').forEach(square => {
    square.classList.remove('capture-move');
  });
}

function isValidMove(startRow, startCol, endRow, endCol, txId) {
  logStep(txId, 'isValidMove', 'START', { startRow, startCol, endRow, endCol });
  if (endRow < 0 || endRow >= 8 || endCol < 0 || endCol >= 8) {
    logStep(txId, 'isValidMove', 'FAILURE', { reason: 'out of bounds' });
    return false;
  }
  const piece = getPiece(startRow, startCol);
  if (!piece) {
    logStep(txId, 'isValidMove', 'FAILURE', { reason: 'no piece at start' });
    return false;
  }

  const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);
  if (!endCell || endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    logStep(txId, 'isValidMove', 'FAILURE', { reason: 'invalid end cell' });
    return false;
  }

  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  if (piece.classList.contains("haji")) {
    if (colDiff !== Math.abs(rowDiff)) {
        logStep(txId, 'isValidMove', 'FAILURE', { reason: 'haji not diagonal' });
        return false;
    }
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;
    while (currentRow !== endRow) {
      if (getPiece(currentRow, currentCol)) {
        logStep(txId, 'isValidMove', 'FAILURE', { reason: 'haji path not clear' });
        return false;
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    logStep(txId, 'isValidMove', 'SUCCESS', {});
    return true;
  } else {
    if (colDiff !== 1) {
        logStep(txId, 'isValidMove', 'FAILURE', { reason: 'not 1 col diff' });
        return false;
    }
    if (piece.classList.contains("black") && rowDiff !== 1) {
        logStep(txId, 'isValidMove', 'FAILURE', { reason: 'black cannot move backward' });
        return false;
    }
    if (piece.classList.contains("white") && rowDiff !== -1) {
        logStep(txId, 'isValidMove', 'FAILURE', { reason: 'white cannot move backward' });
        return false;
    }
    logStep(txId, 'isValidMove', 'SUCCESS', {});
    return true;
  }
}

function isValidCapture(startRow, startCol, endRow, endCol, txId) {
  logStep(txId, 'isValidCapture', 'START', { startRow, startCol, endRow, endCol });
  if (endRow < 0 || endRow >= 8 || endCol < 0 || endCol >= 8) {
    logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'out of bounds' });
    return false;
  }
  const piece = getPiece(startRow, startCol);
  if (!piece) {
    logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'no piece at start' });
    return false;
  }

  const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);
  if (!endCell || endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'invalid end cell' });
    return false;
  }

  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  if (piece.classList.contains("haji")) {
    if (colDiff !== Math.abs(rowDiff)) {
        logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'haji not diagonal' });
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
          logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'haji cannot jump own piece' });
          return false; // Can't jump own piece
        }
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    if (capturedCount === 1) {
        logStep(txId, 'isValidCapture', 'SUCCESS', {});
        return true;
    } else {
        logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'haji captured wrong number of pieces' });
        return false;
    }
  } else {
    if (colDiff !== 2 || Math.abs(rowDiff) !== 2) {
        logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'not 2 diff' });
        return false;
    }
    const capturedRow = (startRow + endRow) / 2;
    const capturedCol = (startCol + endCol) / 2;
    const capturedPiece = getPiece(capturedRow, capturedCol);
    if (!capturedPiece || capturedPiece.classList.contains(piece.classList.contains("black") ? "black" : "white")) {
      logStep(txId, 'isValidCapture', 'FAILURE', { reason: 'no piece to capture' });
      return false;
    }
    logStep(txId, 'isValidCapture', 'SUCCESS', {});
    return true;
  }
}

function canCaptureAgain(row, col, txId) {
    logStep(txId, 'canCaptureAgain', 'START', { row, col });
    const result = getAvailableCaptureMoves(row, col, txId).length > 0;
    logStep(txId, 'canCaptureAgain', 'SUCCESS', { result });
    return result;
}

function checkAvailableCaptures(txId) {
  logStep(txId, 'checkAvailableCaptures', 'START', {});
  const pieces = document.querySelectorAll(`.piece.${currentPlayer === "B" ? "black" : "white"}`);
  for (const piece of pieces) {
    const row = parseInt(piece.parentElement.dataset.row);
    const col = parseInt(piece.parentElement.dataset.col);
    if (getAvailableCaptureMoves(row, col, txId).length > 0) {
      logStep(txId, 'checkAvailableCaptures', 'SUCCESS', { result: true });
      return true;
    }
  }
  logStep(txId, 'checkAvailableCaptures', 'SUCCESS', { result: false });
  return false;
}

function checkWinCondition(txId) {
  logStep(txId, 'checkWinCondition', 'START', {});
  const blackPieces = document.querySelectorAll(".piece.black");
  const whitePieces = document.querySelectorAll(".piece.white");

  if (blackPieces.length === 0) {
    showWinMessage("White");
    logStep(txId, 'checkWinCondition', 'SUCCESS', { winner: 'White' });
    return true;
  }

  if (whitePieces.length === 0) {
    showWinMessage("Black");
    logStep(txId, 'checkWinCondition', 'SUCCESS', { winner: 'Black' });
    return true;
  }
  logStep(txId, 'checkWinCondition', 'SUCCESS', { winner: null });
  return false;
}

function updateCurrentPlayerDisplay() {
  const currentPlayerDisplay = document.getElementById("current-player");
  if (currentPlayerDisplay) {
    currentPlayerDisplay.textContent = `Current Player: ${currentPlayer === "B" ? "Black" : "White"}`;
    
    if (currentPlayer === 'B') {
      currentPlayerDisplay.classList.remove('white-turn');
      currentPlayerDisplay.classList.add('black-turn');
    } else {
      currentPlayerDisplay.classList.remove('black-turn');
      currentPlayerDisplay.classList.add('white-turn');
    }
  }
}

function updateScore() {
  document.getElementById('black-score').textContent = `Black: ${blackScore}`;
  document.getElementById('white-score').textContent = `White: ${whiteScore}`;
}

function showWinMessage(winner) {
  const winModal = document.getElementById('win-modal');
  const winMessage = document.getElementById('win-message');
  winMessage.textContent = `${winner} wins!`;
  winModal.classList.remove('hidden');
}

function handleClick(event) {
    const txId = generateTransactionId();
    logStep(txId, 'handleClick', 'START', { target: event.currentTarget.outerHTML });
    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        logStep(txId, 'handleClick', 'INFO', { action: 'move piece' });
        const startCell = selectedPiece.parentNode;
        const startRow = parseInt(startCell.dataset.row);
        const startCol = parseInt(startCell.dataset.col);

        const mustCapture = checkAvailableCaptures(txId);

        if (isValidCapture(startRow, startCol, row, col, txId)) {
            logStep(txId, 'handleClick', 'INFO', { moveType: 'capture' });
            const capturedRow = (startRow + row) / 2;
            const capturedCol = (startCol + col) / 2;
            const capturedCell = document.querySelector(`.board-cell[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
            if (currentPlayer === 'B') {
              whiteScore++;
            } else {
              blackScore++;
            }
            updateScore();
            capturedCell.innerHTML = "";

            square.appendChild(selectedPiece);
            
            if ((row === 0 && selectedPiece.classList.contains("white")) || (row === 7 && selectedPiece.classList.contains("black"))) {
                selectedPiece.classList.add("haji");
            }

            if (canCaptureAgain(row, col, txId)) {
                selectedPiece = square.firstChild;
                startCell.classList.remove("selected");
                square.classList.add("selected");
                highlightAvailableMoves(selectedPiece, txId);
            } else {
                selectedPiece = null;
                startCell.classList.remove("selected");
                clearAvailableMoves();
                currentPlayer = currentPlayer === "B" ? "W" : "B";
                updateCurrentPlayerDisplay();
                checkWinCondition(txId);
            }
        } else if (!mustCapture && isValidMove(startRow, startCol, row, col, txId)) {
            logStep(txId, 'handleClick', 'INFO', { moveType: 'regular' });
            square.appendChild(selectedPiece);
            selectedPiece = null;
            startCell.classList.remove("selected");
            clearAvailableMoves();

            if ((row === 0 && square.firstChild.classList.contains("white")) || (row === 7 && square.firstChild.classList.contains("black"))) {
                square.firstChild.classList.add("haji");
            }
            
            currentPlayer = currentPlayer === "B" ? "W" : "B";
            updateCurrentPlayerDisplay();
            checkWinCondition(txId);
        } else {
            logStep(txId, 'handleClick', 'FAILURE', { reason: 'invalid move' });
            alert(mustCapture ? "You must capture when possible!" : "Invalid move!");
            selectedPiece = null;
            startCell.classList.remove("selected");
            clearAvailableMoves();
        }
    } else if (square.hasChildNodes()) {
        logStep(txId, 'handleClick', 'INFO', { action: 'select piece' });
        const piece = square.firstChild;
        const pieceColor = piece.classList.contains("black") ? "B" : "W";
        if (pieceColor === currentPlayer) {
            selectedPiece = piece;
            square.classList.add("selected");
            highlightAvailableMoves(piece, txId);
        }
    }
    logStep(txId, 'handleClick', 'SUCCESS', {});
}

function resetGame() {
  const board = document.getElementById("game-board");
  if (!board) {
    console.error("Game board element not found in resetGame!");
    return;
  }
  initializeBoard(board);
  currentPlayer = "B";
  selectedPiece = null;
  blackScore = 0;
  whiteScore = 0;
  updateScore();
  updateCurrentPlayerDisplay();
  document.getElementById('win-modal').classList.add('hidden');
}

window.addEventListener('load', () => {
    const board = document.getElementById("game-board");
    
    if (!board) {
        console.error("Game board element not found!");
        return;
    }
    
    initializeBoard(board);
    updateCurrentPlayerDisplay();
    updateScore();
    console.log("Board initialized successfully.");

    board.querySelectorAll('.board-cell').forEach(square => {
      square.addEventListener('click', handleClick);
    });

    document.getElementById('play-again').addEventListener('click', resetGame);
});