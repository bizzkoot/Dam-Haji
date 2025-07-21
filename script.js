console.log("Dam Haji game loaded!");

function initializeBoard() {
  const boardSize = 8;
  const board = document.getElementById("game-board");

  for (let row = 0; row < boardSize; row++) {
    const rowElement = document.createElement("div");
    rowElement.classList.add("board-row");
    for (let col = 0; col < boardSize; col++) {
      const cell = document.createElement("div");
      cell.classList.add("board-cell");
      if ((row + col) % 2 === 0) {
        cell.classList.add("light");
      } else {
        cell.classList.add("dark");
        if (row < 3) {
          cell.textContent = "B"; // Black pieces
        } else if (row > 4) {
          cell.textContent = "W"; // White pieces
        }
      }
      rowElement.appendChild(cell);
    }
    board.appendChild(rowElement);
  }

  let selectedPiece = null;
  let currentPlayer = "B"; // Black starts first

  function handleClick(row, col) {
    if (selectedPiece === null) {
      // Select a piece
      const cell = document.querySelector(`.board-row:nth-child(${row + 1}) .board-cell:nth-child(${col + 1})`);
      if (cell.textContent !== "") {
        selectedPiece = { row, col };
        cell.classList.add("selected");
      }
    } else {
      // Move the selected piece
      const startRow = selectedPiece.row;
      const startCol = selectedPiece.col;
      const endRow = row;
      const endCol = col;

      const startCell = document.querySelector(`.board-row:nth-child(${startRow + 1}) .board-cell:nth-child(${startCol + 1})`);
      const endCell = document.querySelector(`.board-row:nth-child(${endRow + 1}) .board-cell:nth-child(${endCol + 1})`);

      // Check if the move is valid
      if (isValidCapture(startRow, startCol, endRow, endCol)) {
        // Capture the piece
        const capturedRow = (startRow + endRow) / 2;
        const capturedCol = (startCol + endCol) / 2;
        const capturedCell = document.querySelector(`.board-row:nth-child(${capturedRow + 1}) .board-cell:nth-child(${capturedCol + 1})`);
        capturedCell.textContent = "";

        // Move the piece
        endCell.textContent = startCell.textContent;
        startCell.textContent = "";
        startCell.classList.remove("selected");
        selectedPiece = null;

        // Check for multiple captures
        if (canCaptureAgain(endRow, endCol)) {
          selectedPiece = { row: endRow, col: endCol };
          endCell.classList.add("selected");
        } else {
          // Check for Haji promotion
          if ((endRow === 0 && endCell.textContent === "W") || (endRow === 7 && endCell.textContent === "B")) {
            endCell.textContent = "H"; // Promote to Haji
          }
          checkWinCondition();
           // Switch player turns
        currentPlayer = currentPlayer === "B" ? "W" : "B";
        updateCurrentPlayerDisplay();
        }
      } else if (isValidMove(startRow, startCol, endRow, endCol)) {
        endCell.textContent = startCell.textContent;
        startCell.textContent = "";
        startCell.classList.remove("selected");
        selectedPiece = null;
        // Check for Haji promotion
        if ((endRow === 0 && endCell.textContent === "W") || (endRow === 7 && endCell.textContent === "B")) {
          endCell.textContent = "H"; // Promote to Haji
        }
        checkWinCondition();
         // Switch player turns
        currentPlayer = currentPlayer === "B" ? "W" : "B";
        updateCurrentPlayerDisplay();
      } else {
        alert("Invalid move!");
        startCell.classList.remove("selected");
        selectedPiece = null;
      }
    }
  }

  function isValidMove(startRow, startCol, endRow, endCol) {
    const piece = document.querySelector(`.board-row:nth-child(${startRow + 1}) .board-cell:nth-child(${startCol + 1})`).textContent;
    const rowDiff = endRow - startRow;
    const colDiff = Math.abs(endCol - startCol);

    // Check if the destination cell is empty and dark
    const endCell = document.querySelector(`.board-row:nth-child(${endRow + 1}) .board-cell:nth-child(${endCol + 1})`);
    if (endCell.textContent !== "" || (endRow + endCol) % 2 === 0) {
      return false;
    }

    if (piece === "H") {
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
        if (cell.textContent !== "") {
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

      if (piece === "B" && rowDiff !== 1) {
        return false;
      }

      if (piece === "W" && rowDiff !== -1) {
        return false;
      }

      return true;
    }
  }

  function isValidCapture(startRow, startCol, endRow, endCol) {
    const piece = document.querySelector(`.board-row:nth-child(${startRow + 1}) .board-cell:nth-child(${startCol + 1})`).textContent;
    const rowDiff = endRow - startRow;
    const colDiff = Math.abs(endCol - startCol);

    // Check if Haji and the move is diagonal and multiple squares away
    if (piece === "H") {
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
        if (cell.textContent !== "" ) {
          capturedCount++
        }
        currentRow += rowStep;
        currentCol += colStep;
      }
      if (capturedCount !== 1){
        return false
      }
      return true;
    } else {
      // Check if the move is diagonal and two squares away
      if (colDiff !== 2 || Math.abs(rowDiff) !== 2) {
        return false;
      }
    }

    // Check if the destination cell is empty and dark
    const endCell = document.querySelector(`.board-row:nth-child(${endRow + 1}) .board-cell:nth-child(${endCol + 1})`);
    if (endCell.textContent !== "" || (endRow + endCol) % 2 === 0) {
      return false;
    }

    // Check if there is an opponent's piece in the middle
    const capturedRow = (startRow + endRow) / 2;
    const capturedCol = (startCol + endCol) / 2;
    const capturedCell = document.querySelector(`.board-row:nth-child(${capturedRow + 1}) .board-cell:nth-child(${capturedCol + 1})`);
    if (capturedCell.textContent === "" || capturedCell.textContent === piece) {
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

  function checkWinCondition() {
    const blackPieces = Array.from(document.querySelectorAll(".board-cell")).filter(cell => cell.textContent === "B" || cell.textContent === "H");
    const whitePieces = Array.from(document.querySelectorAll(".board-cell")).filter(cell => cell.textContent === "W" || cell.textContent === "H");

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
      currentPlayerDisplay.textContent = `Current Player: ${currentPlayer}`;
    }
  }

  // Add click event listeners to the cells
  const cells = document.querySelectorAll(".board-cell");
  cells.forEach((cell, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    cell.addEventListener("click", () => handleClick(row, col));
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}

initializeBoard();