console.log("Dam Haji game loaded!");

let currentPlayer = "B"; // Black starts first
let selectedPiece = null; // Track the selected piece

function initializeBoard(board) {
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

function highlightAvailableMoves(piece) {
  clearAvailableMoves();
  const pieceRow = parseInt(piece.parentNode.dataset.row);
  const pieceCol = parseInt(piece.parentNode.dataset.col);
  const isHaji = piece.classList.contains('haji');
  const player = piece.classList.contains('black') ? 'black' : 'white';

  let moveDirections = [];
  if (isHaji) {
    moveDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // All directions for Haji
  } else if (player === 'black') {
    moveDirections = [[1, -1], [1, 1]]; // Black moves down
  } else {
    moveDirections = [[-1, -1], [-1, 1]]; // White moves up
  }

  moveDirections.forEach(direction => {
    const rowDir = direction[0];
    const colDir = direction[1];

    let currentRow = pieceRow + rowDir;
    let currentCol = pieceCol + colDir;

    if (currentRow >= 0 && currentRow < 8 && currentCol >= 0 && currentCol < 8) {
      const targetSquare = document.querySelector(`.board-cell[data-row="${currentRow}"][data-col="${currentCol}"]`);
      if (targetSquare && !targetSquare.firstChild) {
        targetSquare.classList.add('available-move');
      } else {
        // Check for capture moves
        const nextRow = currentRow + rowDir;
        const nextCol = currentCol + colDir;
        if (nextRow >= 0 && nextRow < 8 && nextCol >= 0 && nextCol < 8) {
          const captureSquare = document.querySelector(`.board-cell[data-row="${nextRow}"][data-col="${nextCol}"]`);
          if (captureSquare && !captureSquare.firstChild) {
            const capturedPiece = targetSquare.firstChild;
            if (capturedPiece && capturedPiece.classList.contains(player === 'black' ? 'white' : 'black')) {
              captureSquare.classList.add('capture-move');
            }
          }
        }
      }
    }
  });
}

function clearAvailableMoves() {
  document.querySelectorAll('.available-move').forEach(square => {
    square.classList.remove('available-move');
  });
  document.querySelectorAll('.capture-move').forEach(square => {
    square.classList.remove('capture-move');
  });
}

function isValidMove(startRow, startCol, endRow, endCol) {
  const piece = document.querySelector(`.board-row:nth-child(${startRow + 1}) .board-cell:nth-child(${startCol + 1})`).firstChild;
  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  // Check if the destination cell is empty and dark
  const endCell = document.querySelector(`.board-row:nth-child(${endRow + 1}) .board-cell:nth-child(${endCol + 1})`);
  if (endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    return false;
  }

  if (piece.classList.contains("haji")) {
    // Haji can move multiple squares diagonally
    if (colDiff !== Math.abs(rowDiff)) {
      return false;
    }

    // Check if the path is clear
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;
    while (currentRow !== endRow) {
      const cell = document.querySelector(`.board-row:nth-child(${currentRow + 1}) .board-cell:nth-child(${currentCol + 1})`);
      if (cell.hasChildNodes()) {
        return false;
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    return true;
  } else {
    // Regular pieces can only move one square diagonally forward
    if (colDiff !== 1) {
      return false;
    }

    if (piece.classList.contains("black") && rowDiff !== 1) {
      console.log("Black piece cannot move backward");
      return false;
    }

    if (piece.classList.contains("white") && rowDiff !== -1) {
      console.log("White piece cannot move backward");
      return false;
    }

    return true;
  }
}

function isValidCapture(startRow, startCol, endRow, endCol) {
  const piece = document.querySelector(`.board-row:nth-child(${startRow + 1}) .board-cell:nth-child(${startCol + 1})`).firstChild;
  if (!piece) return false;
  const rowDiff = endRow - startRow;
  const colDiff = Math.abs(endCol - startCol);

  // Check if Haji and the move is diagonal and multiple squares away
  if (piece.classList.contains("haji")) {
    if (colDiff !== Math.abs(rowDiff)) {
      return false;
    }
    // Check if the path is clear and capturing pieces
    const rowStep = rowDiff > 0 ? 1 : -1;
    const colStep = endCol > startCol ? 1 : -1;
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;
    let capturedCount = 0;
    while (currentRow !== endRow) {
      const cell = document.querySelector(`.board-row:nth-child(${currentRow + 1}) .board-cell:nth-child(${currentCol + 1})`);
      if (cell.hasChildNodes()) {
        if (cell.firstChild.classList.contains(piece.classList.contains("black") ? "white" : "black")) {
          capturedCount++;
        } else {
          return false; // blocked by own piece
        }
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    return capturedCount === 1;
  } else {
    // Check if the move is diagonal and two squares away
    if (colDiff !== 2 || Math.abs(rowDiff) !== 2) {
      return false;
    }
  }

  // Check if the destination cell is empty and dark
  const endCell = document.querySelector(`.board-row:nth-child(${endRow + 1}) .board-cell:nth-child(${endCol + 1})`);
  if (endCell.hasChildNodes() || (endRow + endCol) % 2 === 0) {
    return false;
  }

  // Check if there is an opponent's piece in the middle
  const capturedRow = (startRow + endRow) / 2;
  const capturedCol = (startCol + endCol) / 2;
  const capturedCell = document.querySelector(`.board-row:nth-child(${capturedRow + 1}) .board-cell:nth-child(${capturedCol + 1})`);
  if (!capturedCell.hasChildNodes() || capturedCell.firstChild.classList.contains(piece.classList.contains("black") ? "black" : "white")) {
    return false;
  }

  return true;
}

function canCaptureAgain(row, col) {
  // Check if there are any capturing moves available from the current position
  const possibleCaptures = [
    { row: row - 2, col: col - 2 },
    { row: row - 2, col: col + 2 },
    { row: row + 2, col: col - 2 },
    { row: row + 2, col: col + 2 },
  ];

  for (const capture of possibleCaptures) {
    if (capture.row >= 0 && capture.row < 8 && capture.col >= 0 && capture.col < 8) {
      if (isValidCapture(row, col, capture.row, capture.col)) {
        return true;
      }
    }
  }

  return false;
}

function checkAvailableCaptures() {
  // Check all pieces of current player for available captures
  const pieces = document.querySelectorAll(`.piece.${currentPlayer === "B" ? "black" : "white"}`);
  
  for (const piece of pieces) {
    const cell = piece.parentElement;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    const possibleCaptures = [
      { row: row - 2, col: col - 2 },
      { row: row - 2, col: col + 2 },
      { row: row + 2, col: col - 2 },
      { row: row + 2, col: col + 2 },
    ];

    for (const capture of possibleCaptures) {
      if (capture.row >= 0 && capture.row < 8 && capture.col >= 0 && capture.col < 8) {
        if (isValidCapture(row, col, capture.row, capture.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

function checkWinCondition() {
  const blackPieces = document.querySelectorAll(".piece.black");
  const whitePieces = document.querySelectorAll(".piece.white");

  if (blackPieces.length === 0) {
    alert("White wins!");
    return true;
  }

  if (whitePieces.length === 0) {
    alert("Black wins!");
    return true;
  }

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

function handleClick(event) {
    const square = event.currentTarget; // Use currentTarget to get the element with the listener
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        const startCell = selectedPiece.parentNode;
        startCell.classList.remove("selected");
        const startRow = parseInt(startCell.dataset.row);
        const startCol = parseInt(startCell.dataset.col);

        const hasAvailableCaptures = checkAvailableCaptures();

        if (isValidCapture(startRow, startCol, row, col)) {
            const capturedRow = (startRow + row) / 2;
            const capturedCol = (startCol + col) / 2;
            const capturedCell = document.querySelector(`.board-cell[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
            capturedCell.innerHTML = "";

            square.appendChild(selectedPiece);
            
            if ((row === 0 && selectedPiece.classList.contains("white")) || (row === 7 && selectedPiece.classList.contains("black"))) {
                selectedPiece.classList.add("haji");
            }

            if (canCaptureAgain(row, col)) {
                selectedPiece = square.firstChild;
                square.classList.add("selected");
            } else {
                selectedPiece = null;
                currentPlayer = currentPlayer === "B" ? "W" : "B";
                updateCurrentPlayerDisplay();
                checkWinCondition();
            }
        } else if (!hasAvailableCaptures && isValidMove(startRow, startCol, row, col)) {
            square.appendChild(selectedPiece);
            selectedPiece = null;

            if ((row === 0 && square.firstChild.classList.contains("white")) || (row === 7 && square.firstChild.classList.contains("black"))) {
                square.firstChild.classList.add("haji");
            }
            
            currentPlayer = currentPlayer === "B" ? "W" : "B";
            updateCurrentPlayerDisplay();
            checkWinCondition();
        } else {
            alert(hasAvailableCaptures ? "You must capture when possible!" : "Invalid move!");
            selectedPiece = null;
            clearAvailableMoves();
        }
    } else if (square.hasChildNodes()) {
        const piece = square.firstChild;
        const pieceColor = piece.classList.contains("black") ? "B" : "W";
        if (pieceColor === currentPlayer) {
            selectedPiece = piece;
            square.classList.add("selected");
            highlightAvailableMoves(piece);
        }
    }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('Service worker registration attempted.');
    navigator.serviceWorker.register('./service-worker.js');

    const board = document.getElementById("game-board");
    
    initializeBoard(board);
    updateCurrentPlayerDisplay();
    console.log("Board initialized successfully.");

    board.querySelectorAll('.board-cell').forEach(square => {
      square.addEventListener('click', handleClick);
    });
  });
}