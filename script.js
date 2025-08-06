// =============================================
// SCRIPT.JS - UI AND EVENT HANDLING
// =============================================

// --- GLOBAL STATE ---
let currentPlayer = "B";
let selectedPiece = null;
let blackScore = 0;
let whiteScore = 0;
let aiEnabled = false;
let aiDifficulty = "medium";
let aiPlayer = "W";
let movesSinceCapture = 0;
const MAX_MOVES_WITHOUT_CAPTURE = 50;
let detailedDebugLoggingEnabled = false;

// --- UI UPDATE FUNCTIONS ---

function confetti(color) {
    for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti');
        piece.style.backgroundColor = color;
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = `-100vh`;
        piece.style.width = `${Math.random() * 20 + 10}px`;
        piece.style.height = `${Math.random() * 20 + 10}px`;
        document.body.appendChild(piece);
        setTimeout(() => {
            piece.remove();
        }, 3000);
    }
}

function updateCurrentPlayerDisplay() {
  const display = document.getElementById("current-player");
  if (display) {
    display.textContent = `Current Player: ${currentPlayer === "B" ? "Black" : "White"}`;
    display.className = `player-display ${currentPlayer === 'B' ? 'black-turn' : 'white-turn'}`;
  }
}

function updateScore() {
  document.getElementById('black-score').textContent = `Black: ${blackScore}`;
  document.getElementById('white-score').textContent = `White: ${whiteScore}`;
}

function updateAIDisplay() {
    const aiStatus = document.getElementById('ai-status');
    const aiDifficultyDisplay = document.getElementById('ai-difficulty');
    const aiToggleBtn = document.getElementById('ai-toggle');

    if (aiStatus) {
        aiStatus.textContent = aiEnabled ? "AI: ON" : "AI: OFF";
        aiStatus.classList.toggle('ai-on', aiEnabled);
        aiStatus.classList.toggle('ai-off', !aiEnabled);
    }
    if (aiDifficultyDisplay) aiDifficultyDisplay.textContent = `Difficulty: ${aiDifficulty.toUpperCase()}`;

    if (aiToggleBtn) {
        aiToggleBtn.textContent = aiEnabled ? "AI: ON" : "AI: OFF";
        aiToggleBtn.classList.toggle('ai-on', aiEnabled);
        aiToggleBtn.classList.toggle('ai-off', !aiEnabled);
    }
}

function clearHighlights() {
  document.querySelectorAll('.selected, .available-move, .capture-move, .no-moves').forEach(el => {
    el.classList.remove('selected', 'available-move', 'capture-move', 'no-moves');
  });
}

function highlightAvailableMoves(piece) {
    clearHighlights();
    const pieceRow = parseInt(piece.parentNode.dataset.row);
    const pieceCol = parseInt(piece.parentNode.dataset.col);
    const mustCapture = checkAvailableCaptures(currentPlayer);

    const captureMoves = getAvailableCaptureMoves(pieceRow, pieceCol);
    if (mustCapture) {
        captureMoves.forEach(move => {
            document.querySelector(`.board-cell[data-row="${move.row}"][data-col="${move.col}"]`).classList.add('capture-move');
        });
    } else {
        const regularMoves = getAvailableRegularMoves(pieceRow, pieceCol);
        regularMoves.forEach(move => {
            document.querySelector(`.board-cell[data-row="${move.row}"][data-col="${move.col}"]`).classList.add('available-move');
        });
    }
}

// --- GAME FLOW AND ACTIONS ---

function executeMove(move) {
    const { piece, startRow, startCol, endRow, endCol, isCapture } = move;
    console.log(`MOVE: Player ${currentPlayer} moves from [${startRow},${startCol}] to [${endRow},${endCol}] (Capture: ${isCapture})`);
    
    if (detailedDebugLoggingEnabled) {
        console.log(`[DEBUG] Current Player: ${currentPlayer}`);
        console.log(`[DEBUG] Piece moved: ${piece.classList.contains('black') ? 'Black' : 'White'} ${piece.classList.contains('haji') ? 'Haji' : 'Regular'}`);
        console.log(`[DEBUG] Start Position: (${startRow}, ${startCol})`);
        console.log(`[DEBUG] End Position: (${endRow}, ${endCol})`);
        console.log(`[DEBUG] Is Capture: ${isCapture}`);
    }

    const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);

    if (isCapture) {
        movesSinceCapture = 0; // Reset counter on capture
        if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Moves since last capture reset to 0.`);
        let capturedRow, capturedCol;
        if (piece.classList.contains("haji")) {
            const rowStep = endRow > startRow ? 1 : -1;
            const colStep = endCol > startCol ? 1 : -1;
            let r = startRow + rowStep, c = startCol + colStep;
            while (r !== endRow) {
                if (getPiece(r, c)) {
                    capturedRow = r; capturedCol = c;
                    break;
                }
                r += rowStep; c += colStep;
            }
        } else {
            capturedRow = (startRow + endRow) / 2;
            capturedCol = (startCol + endCol) / 2;
        }
        const capturedCell = document.querySelector(`.board-cell[data-row="${capturedRow}"][data-col="${capturedCol}"]`);
        if (capturedCell && capturedCell.firstChild) {
            if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Captured piece at (${capturedRow}, ${capturedCol})`);
            if (currentPlayer === 'B') blackScore++; else whiteScore++;
            updateScore();
            capturedCell.firstChild.classList.add('capture-animation');
            setTimeout(() => { if(capturedCell) capturedCell.innerHTML = "" }, 500);
        }
    } else {
        movesSinceCapture++; // Increment counter on regular move
        if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Moves since last capture incremented to ${movesSinceCapture}.`);
    }

    // Check for Haji promotion
    if ((endRow === 0 && piece.classList.contains("white")) || (endRow === 7 && piece.classList.contains("black"))) {
        if (!piece.classList.contains("haji")) { // Only log if it's a new promotion
            if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Piece promoted to Haji at (${endRow}, ${endCol})`);
        }
        piece.classList.add("haji");
    }

    endCell.appendChild(piece);
    
    if (isCapture && canCaptureAgain(endRow, endCol)) {
        if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Multiple capture possible. Remaining piece at (${endRow}, ${endCol})`);
        selectedPiece = endCell.firstChild;
        highlightAvailableMoves(selectedPiece);
        if (aiEnabled && currentPlayer === aiPlayer) {
            // Wait for the captured piece to be removed before making the next AI move
            setTimeout(makeAIMove, 600);
        }
    } else {
        selectedPiece = null;
        clearHighlights();
        currentPlayer = currentPlayer === "B" ? "W" : "B";
        updateCurrentPlayerDisplay();
        if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Turn switched to ${currentPlayer}.`);
        if (!checkWinCondition() && aiEnabled && currentPlayer === aiPlayer) {
            // Use a more robust delay that waits for the DOM to be ready
            requestAnimationFrame(() => setTimeout(makeAIMove, 600));
        }
    }
    if (detailedDebugLoggingEnabled) console.log(`[DEBUG] Current movesSinceCapture: ${movesSinceCapture}/${MAX_MOVES_WITHOUT_CAPTURE}`);
}

function handleClick(event) {
    if (aiEnabled && currentPlayer === aiPlayer) return;

    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedPiece) {
        const startCell = selectedPiece.parentNode;
        const startRow = parseInt(startCell.dataset.row);
        const startCol = parseInt(startCell.dataset.col);

        if (startRow === row && startCol === col) {
            selectedPiece = null;
            clearHighlights();
            return;
        }

        const mustCapture = checkAvailableCaptures(currentPlayer);
        const isCapture = isValidCapture(startRow, startCol, row, col);
        const isRegular = !mustCapture && isValidMove(startRow, startCol, row, col);

        if (isCapture || isRegular) {
            executeMove({ piece: selectedPiece, startRow, startCol, endRow: row, endCol: col, isCapture });
        } else {
            alert(mustCapture ? "You must capture when possible!" : "Invalid move!");
            selectedPiece = null;
            clearHighlights();
        }
    } else if (square.hasChildNodes()) {
        const piece = square.firstChild;
        if ((piece.classList.contains("black") ? "B" : "W") === currentPlayer) {
            selectedPiece = piece;
            square.classList.add("selected");
            highlightAvailableMoves(piece);
        }
    }
}

function makeAIMove() {
    if (!aiEnabled || currentPlayer !== aiPlayer) return;
    const aiStatus = document.getElementById('ai-status');
    if (aiStatus) aiStatus.textContent = "AI: Thinking...";

    setTimeout(() => {
        const board = buildBoardFromDOM();
        const bestMove = findBestMove(board, aiPlayer, aiDifficulty, aiPlayer);
        if (aiStatus) aiStatus.textContent = aiEnabled ? "AI: ON" : "AI: OFF";

        if (bestMove) {
            const piece = getPiece(bestMove.startRow, bestMove.startCol);
            executeMove({ ...bestMove, piece });
        } else {
            // AI has no moves, which means it loses.
            console.log(`[DEBUG] AI (${aiPlayer}) has no moves available. Checking win condition...`);
            const winConditionResult = checkWinCondition();
            console.log(`[DEBUG] checkWinCondition() returned: ${winConditionResult}`);
            if (!winConditionResult) {
                console.log(`[DEBUG] Win condition not detected, manually checking hasAvailableMoves...`);
                const hasMoves = hasAvailableMoves(currentPlayer);
                console.log(`[DEBUG] hasAvailableMoves(${currentPlayer}) returned: ${hasMoves}`);
            }
        }
    }, 100);
}

function resetGame() {
  const board = document.getElementById("game-board");
  initializeBoard(board);
  board.querySelectorAll('.board-cell').forEach(square => square.addEventListener('click', handleClick));
  currentPlayer = "B";
  selectedPiece = null;
  blackScore = 0;
  whiteScore = 0;
  movesSinceCapture = 0;
  updateScore();
  updateCurrentPlayerDisplay();
  updateAIDisplay();
  document.getElementById('win-modal').classList.add('hidden');
  if (aiEnabled && currentPlayer === aiPlayer) {
    setTimeout(makeAIMove, 500);
  }
}

function showWinMessage(winner) {
  const winModal = document.getElementById('win-modal');
  const winMessage = document.getElementById('win-message');
  if (winner === "Draw") {
      winMessage.textContent = "It's a Draw!";
  } else {
      winMessage.textContent = `${winner} wins!`;
      // Determine confetti color based on winner
      const confettiColor = winner === "Black" ? "#ffd700" : "#4ecdc4";
      confetti(confettiColor);
  }
  winModal.classList.remove('hidden');
}

// --- INITIALIZATION ---

window.addEventListener('load', () => {
    const board = document.getElementById("game-board");
    initializeBoard(board);
    updateCurrentPlayerDisplay();
    updateScore();
    updateAIDisplay();

    board.querySelectorAll('.board-cell').forEach(square => {
      square.addEventListener('click', handleClick);
    });

    document.getElementById('play-again').addEventListener('click', resetGame);
    document.getElementById('reset-game-btn').addEventListener('click', resetGame);
    document.getElementById('ai-toggle').addEventListener('click', () => {
        aiEnabled = !aiEnabled;
        updateAIDisplay();
        if (aiEnabled && currentPlayer === aiPlayer) makeAIMove();
    });

    // Helper to set active difficulty styles
    const setActiveDifficultyButton = (level) => {
        const btnEasy = document.getElementById('ai-easy');
        const btnMedium = document.getElementById('ai-medium');
        const btnHard = document.getElementById('ai-hard');
        [btnEasy, btnMedium, btnHard].forEach(btn => btn && btn.classList.remove('active'));
        if (level === 'easy' && btnEasy) btnEasy.classList.add('active');
        if (level === 'medium' && btnMedium) btnMedium.classList.add('active');
        if (level === 'hard' && btnHard) btnHard.classList.add('active');
    };

    // Initialize correct active difficulty on load
    setActiveDifficultyButton(aiDifficulty);

    document.getElementById('ai-easy').addEventListener('click', () => {
        aiDifficulty = 'easy';
        updateAIDisplay();
        setActiveDifficultyButton('easy');
    });
    document.getElementById('ai-medium').addEventListener('click', () => {
        aiDifficulty = 'medium';
        updateAIDisplay();
        setActiveDifficultyButton('medium');
    });
    document.getElementById('ai-hard').addEventListener('click', () => {
        aiDifficulty = 'hard';
        updateAIDisplay();
        setActiveDifficultyButton('hard');
    });

    // Initialize Debug Modal
    const debugMainBtn = document.getElementById('debug-main-btn');
    const debugModal = document.getElementById('debug-modal');
    const closeDebugModalBtn = document.getElementById('close-debug-modal');

    if (debugMainBtn && debugModal && closeDebugModalBtn) {
        debugMainBtn.addEventListener('click', () => {
            debugModal.classList.remove('hidden');
        });
        closeDebugModalBtn.addEventListener('click', () => {
            debugModal.classList.add('hidden');
        });
        // Also close if clicking outside the modal content
        debugModal.addEventListener('click', (event) => {
            if (event.target === debugModal) {
                debugModal.classList.add('hidden');
            }
        });
    }
    
    // Add debug button
    addDebugButton();
});

// Debug function to set up a Haji capture test scenario
const captureScenario = {
    initialBoard: [
        { row: 2, col: 1, color: 'black', isHaji: false }, // Black piece
        { row: 3, col: 2, color: 'white', isHaji: false }, // White piece to be captured
        { row: 0, col: 0, color: 'black', isHaji: false }, // Placeholder
        { row: 7, col: 7, color: 'white', isHaji: false }  // Placeholder
    ],
    startingPlayer: 'B',
    moves: [
        { startRow: 2, startCol: 1, endRow: 4, endCol: 3 } // Black captures white
    ]
};

// Define a scenario for testing Haji captures
const hajiCaptureScenario = {
    // Purpose: Validate Haji long-distance capture over a single opponent piece with clear landing.
    initialBoard: [
        { row: 2, col: 3, color: 'black', isHaji: true },   // Black Haji at [2,3]
        { row: 3, col: 4, color: 'white', isHaji: false },  // White at [3,4] (to be captured)
        // Ensure landing (4,5) is empty prior to capture
        { row: 1, col: 2, color: 'black', isHaji: false },  // Extra pieces for board realism
        { row: 6, col: 5, color: 'white', isHaji: false }   // Distant white that should not interfere
    ],
    startingPlayer: 'B',
    moves: [
        { startRow: 2, startCol: 3, endRow: 4, endCol: 5 } // Haji captures white at (3,4) landing at (4,5)
    ]
};

// Define a scenario for testing win animations
const winAnimationScenario = {
    // Purpose: Demonstrate a straightforward two-move sequence that results in a win state trigger.
    // Move 1: Haji from (2,3) to (4,5) capturing the white at (3,4)
    // Move 2: Black regular from (4,1) to (2,3) capturing the white at (3,2)
    initialBoard: [
        { row: 2, col: 3, color: 'black', isHaji: true },   // Black Haji at [2,3]
        { row: 4, col: 1, color: 'black', isHaji: false },  // Black regular at [4,1]
        { row: 3, col: 4, color: 'white', isHaji: false },  // White at [3,4] (capturable by Haji)
        { row: 3, col: 2, color: 'white', isHaji: false }   // White at [3,2] for second capture
        // Note: (2,3) becomes empty after the Haji moves in move 1, enabling the landing for move 2.
    ],
    startingPlayer: 'B',
    moves: [
        { startRow: 2, startCol: 3, endRow: 4, endCol: 5 }, // Haji capture
        { startRow: 4, startCol: 1, endRow: 2, endCol: 3 }  // Regular capture over (3,2)
    ]
};

// Define a scenario for testing end-game conditions
const endGameScenario = {
    // Goal: After the Haji capture, allow a legal black capture from (4,1) over a white at (5,2) landing on empty (6,3).
    initialBoard: [
        { row: 2, col: 3, color: 'black', isHaji: true },  // Black Haji
        { row: 4, col: 1, color: 'black', isHaji: false }, // Black regular (to move second)
        { row: 5, col: 2, color: 'white', isHaji: false }, // White regular at (5,2) to be captured
        { row: 3, col: 4, color: 'white', isHaji: false }, // White regular to be captured by Haji
        { row: 2, col: 1, color: 'white', isHaji: false }  // Another white regular
        // Note: Ensure (6,3) is empty for the landing square
    ],
    startingPlayer: 'B',
    moves: [
        { startRow: 2, startCol: 3, endRow: 4, endCol: 5 }, // Black Haji captures White at (3,4)
        { startRow: 4, startCol: 1, endRow: 6, endCol: 3 }  // Black regular captures White at (5,2)
    ]
};

// Test function to trigger win animation
/* Legacy win animation tester removed in favor of scenario-driven tests */
// function testWinAnimation(winner = 'Black') {
//   console.log(`Testing ${winner} win animation...`);
//   showWinMessage(winner);
// }



// Add debug button to HTML
function addDebugButton() {
  const debugButtonsContainer = document.getElementById('debug-buttons-container');
  if (debugButtonsContainer) {
    // Button factory
    const createDebugButton = (id, text, clickHandler) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = text;
        btn.addEventListener('click', clickHandler);
        return btn;
    };

    // Create buttons
    const endGameTestBtn = createDebugButton('debug-endgame-test', 'Test End Game', () => setupAndPlayScenario(endGameScenario));
    const hajiTestBtn = createDebugButton('debug-haji-test', 'Test Haji Capture', () => setupAndPlayScenario(hajiCaptureScenario));
    const winTestBtn = createDebugButton('debug-win-test', 'Test Win Animation', () => setupAndPlayScenario(winAnimationScenario));
    // Remove direct win modal triggers to standardize on scenario flows
    // const blackWinBtn = createDebugButton('debug-black-win', 'Test Black Win', () => testWinAnimation('Black'));
    // const whiteWinBtn = createDebugButton('debug-white-win', 'Test White Win', () => testWinAnimation('White'));
    const playScenarioBtn = createDebugButton('debug-play-scenario', 'Play Capture Scenario', () => setupAndPlayScenario(captureScenario));

    // Append buttons to container
    debugButtonsContainer.appendChild(endGameTestBtn);
    debugButtonsContainer.appendChild(hajiTestBtn);
    debugButtonsContainer.appendChild(winTestBtn);
    // debugButtonsContainer.appendChild(blackWinBtn);
    // debugButtonsContainer.appendChild(whiteWinBtn);
    debugButtonsContainer.appendChild(playScenarioBtn);
  }
}



// New debug scenario function
function setupAndPlayScenario(scenarioConfig) {
    console.log("--- Setting up and playing scenario ---");
    detailedDebugLoggingEnabled = true;
    
    // Reset game to a clean state
    resetGame();

    // Set up the board based on scenarioConfig.initialBoard
    const boardElement = document.getElementById("game-board");
    boardElement.innerHTML = ''; // Clear board

    // Recreate board structure
    for (let row = 0; row < 8; row++) {
        const rowElement = document.createElement("div");
        rowElement.classList.add("board-row");
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement("div");
            cell.classList.add("board-cell");
            cell.dataset.row = row;
            cell.dataset.col = col;
            if ((row + col) % 2 === 0) { cell.classList.add("light"); } else { cell.classList.add("dark"); }
            rowElement.appendChild(cell);
        }
        boardElement.appendChild(rowElement);
    }

    // Place pieces based on scenarioConfig.initialBoard
    scenarioConfig.initialBoard.forEach(pieceData => {
        const cell = document.querySelector(`[data-row="${pieceData.row}"][data-col="${pieceData.col}"]`);
        if (cell) {
            const piece = document.createElement("div");
            piece.classList.add("piece", pieceData.color);
            if (pieceData.isHaji) {
                piece.classList.add("haji");
            }
            cell.appendChild(piece);
        }
    });

    currentPlayer = scenarioConfig.startingPlayer;
    updateCurrentPlayerDisplay();
    console.log(`[DEBUG] Board setup complete. ${currentPlayer === 'B' ? 'Black' : 'White'} to move.`);

    // Execute moves sequentially
    let moveIndex = 0;
    const executeNextMove = () => {
        if (moveIndex < scenarioConfig.moves.length) {
            const move = scenarioConfig.moves[moveIndex];
            console.log(`[DEBUG] Executing programmatic move: ${JSON.stringify(move)}`);

            const startCell = document.querySelector(`[data-row="${move.startRow}"][data-col="${move.startCol}"]`);
            const pieceToMove = startCell ? startCell.firstChild : null;

            if (pieceToMove && (pieceToMove.classList.contains('black') ? 'B' : 'W') === currentPlayer) {
                // Simulate selecting the piece
                selectedPiece = pieceToMove;
                startCell.classList.add("selected");
                highlightAvailableMoves(pieceToMove);

                // Simulate moving the piece
                const targetCell = document.querySelector(`[data-row="${move.endRow}"][data-col="${move.endCol}"]`);
                if (targetCell) {
                    // Directly call handleClick's logic for the second click
                    const startRow = parseInt(startCell.dataset.row);
                    const startCol = parseInt(startCell.dataset.col);
                    const endRow = parseInt(targetCell.dataset.row);
                    const endCol = parseInt(targetCell.dataset.col);

                    const mustCapture = checkAvailableCaptures(currentPlayer);
                    const isCapture = isValidCapture(startRow, startCol, endRow, endCol);
                    const isRegular = !mustCapture && isValidMove(startRow, startCol, endRow, endCol);

                    if (isCapture || isRegular) {
                        executeMove({
                            piece: selectedPiece,
                            startRow,
                            startCol,
                            endRow,
                            endCol,
                            isCapture
                        });
                    } else {
                        console.error(`[DEBUG ERROR] Invalid move in scenario: ${JSON.stringify(move)}`);
                        alert("Invalid move in scenario!");
                        selectedPiece = null;
                        clearHighlights();
                    }
                } else {
                    console.error(`[DEBUG ERROR] Target cell not found for move: ${JSON.stringify(move)}`);
                }
            } else {
                console.error(`[DEBUG ERROR] Piece not found or wrong player for move: ${JSON.stringify(move)}`);
            }

            moveIndex++;
            // Use a small delay to observe each step, especially if AI is involved
            setTimeout(executeNextMove, 700); // Adjust delay as needed
        } else {
            console.log("--- Scenario playback complete. Check console for detailed logs. ---");
            detailedDebugLoggingEnabled = false;
        }
    };

    executeNextMove();
}
