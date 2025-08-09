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

// --- PHASE 1: MOVE HISTORY AND STATE MANAGEMENT FUNCTIONS ---

function addMoveToHistory(move) {
    // Remove any moves after current index (for undo/redo)
    moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    
    const gameMove = new GameMove(
        move.piece,
        move.startRow,
        move.startCol,
        move.endRow,
        move.endCol,
        move.isCapture,
        move.capturedPieces,
        move.isHajiPromotion
    );
    
    moveHistory.push(gameMove);
    currentMoveIndex = moveHistory.length - 1;
    
    // Make sure moveHistory is accessible on window object for panels
    window.moveHistory = moveHistory;
    
    updateMoveHistoryDisplay();
}

function updateMoveHistoryDisplay() {
    const moveList = document.getElementById('move-list');
    if (!moveList) return;
    
    moveList.innerHTML = '';
    
    moveHistory.forEach((move, index) => {
        const moveEntry = createMoveEntry(move, index);
        moveList.appendChild(moveEntry);
    });
    
    // Scroll to latest move
    moveList.scrollTop = moveList.scrollHeight;
}

function createMoveEntry(move, index) {
    const entry = document.createElement('div');
    entry.className = `move-entry ${move.player === 'B' ? 'black' : 'white'}`;
    if (index === currentMoveIndex) {
        entry.classList.add('current');
    }
    
    const moveNumber = document.createElement('span');
    moveNumber.className = 'move-number';
    moveNumber.textContent = move.moveNumber;
    
    const description = document.createElement('span');
    description.className = 'move-description';
    description.innerHTML = formatMoveDescription(move);
    
    entry.appendChild(moveNumber);
    entry.appendChild(description);
    
    // Add click handler for move review
    entry.addEventListener('click', () => reviewMove(index));
    
    return entry;
}

function formatMoveDescription(move) {
    const startPos = `${String.fromCharCode(97 + move.startCol)}${8 - move.startRow}`;
    const endPos = `${String.fromCharCode(97 + move.endCol)}${8 - move.endRow}`;
    let description = `${startPos} → ${endPos}`;
    
    if (move.isCapture) {
        description += ` <span class="move-capture">(×${move.capturedPieces.length})</span>`;
    }
    
    if (move.isHajiPromotion) {
        description += ` <span class="move-haji">(Haji)</span>`;
    }
    
    return description;
}

function reviewMove(moveIndex) {
    if (moveIndex >= 0 && moveIndex < moveHistory.length) {
        // Highlight the move in history
        document.querySelectorAll('.move-entry').forEach(entry => entry.classList.remove('current'));
        document.querySelectorAll('.move-entry')[moveIndex]?.classList.add('current');
        
        // Could implement move replay here in future
        showNotification(`Reviewing move ${moveIndex + 1}`, 'info');
    }
}

// --- UNDO/REDO FUNCTIONALITY ---

function saveGameState() {
    // Remove states after current index
    gameStates = gameStates.slice(0, currentStateIndex + 1);
    
    const newState = new GameState(null, currentPlayer, { blackScore, whiteScore }, moveHistory);
    
    gameStates.push(newState);
    currentStateIndex = gameStates.length - 1;
    
    // Game state saved successfully
    
    // Limit states to prevent memory issues
    if (gameStates.length > MAX_STATES) {
        gameStates.shift();
        currentStateIndex--;
    }
    
    updateUndoRedoButtons();
}

function undoMove() {
    console.log(`[UNDO] Starting undo, currentStateIndex: ${currentStateIndex}, total states: ${gameStates.length}`);
    
    if (currentStateIndex > 0) {
        // Undo one move
        currentStateIndex--;
        console.log(`[UNDO] About to restore state ${currentStateIndex}`);
        
        restoreGameState(currentStateIndex);
        console.log(`[UNDO] State restored, updating UI`);
        
        updateCurrentPlayerDisplay();
        updateScore();
        updateMoveHistoryDisplay();
        updateUndoRedoButtons();
        
        // Update Move History panel if it's open
        if (window.menuSystem) {
            window.menuSystem.updateMoveHistory();
        }
        
        showNotification('Move undone', 'info');
        
        // Clear any ongoing selections
        clearHighlights();
        selectedPiece = null;
        
        console.log(`[UNDO] Undo completed successfully`);
        return true; // Success
    }
    
    console.log(`[UNDO] No moves to undo`);
    return false; // No more moves to undo
}

function redoMove() {
    if (currentStateIndex < gameStates.length - 1) {
        // Redo debug logs disabled for performance
        currentStateIndex++;
        restoreGameState(currentStateIndex);
        updateCurrentPlayerDisplay();
        updateScore();
        updateMoveHistoryDisplay();
        updateUndoRedoButtons();
        
        // Update Move History panel if it's open
        if (window.menuSystem) {
            window.menuSystem.updateMoveHistory();
        }
        
        showNotification('Move redone', 'info');
        
        // Clear any ongoing selections
        clearHighlights();
        selectedPiece = null;
        return true; // Success
    }
    return false; // No more moves to redo
}

function restoreGameState(stateIndex) {
    if (stateIndex < 0 || stateIndex >= gameStates.length) return;
    
    const state = gameStates[stateIndex];
    
    // Restore board state by updating existing board
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
        const rowElement = document.createElement('div');
        rowElement.classList.add('board-row');
        
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.classList.add('board-cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if ((row + col) % 2 === 0) {
                cell.classList.add('light');
            } else {
                cell.classList.add('dark');
                
                const pieceData = state.boardState[row][col];
                if (pieceData) {
                    const piece = document.createElement('div');
                    piece.classList.add('piece', pieceData.color);
                    if (pieceData.isHaji) {
                        piece.classList.add('haji');
                    }
                    cell.appendChild(piece);
                }
            }
            rowElement.appendChild(cell);
        }
        board.appendChild(rowElement);
    }
    
    // Reattach event listeners to the board
    board.querySelectorAll('.board-cell').forEach(square => {
        square.addEventListener('click', handleClick);
    });
    
    // Restore game variables
    currentPlayer = state.currentPlayer;
    blackScore = state.scores.blackScore;
    whiteScore = state.scores.whiteScore;
    moveHistory = [...state.moveHistory];
    currentMoveIndex = moveHistory.length - 1;
    
    // Update window.moveHistory for panels
    window.moveHistory = moveHistory;
    
    // Update UI to reflect restored state
    updateScore();
    
    // IMPORTANT: Update Recent Moves section to match restored state
    updateRecentMovesAfterUndoRedo();
    
    // Clear any ongoing drag operations
    cleanupDragState();
}

function updateRecentMovesAfterUndoRedo() {
    // Clear and rebuild Recent Moves section to match current moveHistory state
    if (window.gameIntegration && window.gameIntegration.modernUI) {
        const modernUI = window.gameIntegration.modernUI;
        
        // Clear existing recent moves
        modernUI.clearRecentMoves();
        
        // Re-add moves from current moveHistory (last 5 moves)
        const startIndex = Math.max(0, moveHistory.length - 5);
        // Add moves in chronological order since addRecentMove adds each new one to the top
        // This will result in newest moves at top, oldest at bottom (correct order)
        for (let i = startIndex; i < moveHistory.length; i++) {
            const move = moveHistory[i];
            const moveDescription = formatMoveForRecentMoves(move);
            modernUI.addRecentMove(i + 1, moveDescription);
        }
        
        // Update statistics
        const captures = moveHistory.filter(m => m.isCapture).length;
        const hajis = document.querySelectorAll('.piece.haji').length;
        modernUI.updateStats(moveHistory.length, captures, hajis);
    }
}

function formatMoveForRecentMoves(move) {
    // Format move for Recent Moves display
    if (typeof move.startCol === 'undefined' || typeof move.startRow === 'undefined' ||
        typeof move.endCol === 'undefined' || typeof move.endRow === 'undefined') {
        return 'unknown move';
    }
    
    const startPos = `${String.fromCharCode(97 + move.startCol)}${8 - move.startRow}`;
    const endPos = `${String.fromCharCode(97 + move.endCol)}${8 - move.endRow}`;
    let description = `${startPos} → ${endPos}`;
    
    if (move.isCapture) {
        description += ` (×${move.capturedPieces?.length || 1})`;
    }
    
    if (move.isHajiPromotion) {
        description += ` (Haji!)`;
    }
    
    return description;
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn) {
        undoBtn.disabled = currentStateIndex <= 0;
        undoBtn.classList.toggle('disabled', currentStateIndex <= 0);
    }
    
    if (redoBtn) {
        redoBtn.disabled = currentStateIndex >= gameStates.length - 1;
        redoBtn.classList.toggle('disabled', currentStateIndex >= gameStates.length - 1);
    }
}

// --- GAME STATE PERSISTENCE ---

function saveGameToSlot(slotNumber) {
    try {
        const currentState = gameStates[currentStateIndex];
        if (!currentState) return false;
        
        const saveData = new GameSaveData(currentState, {
            slotNumber,
            currentPlayer,
            blackScore,
            whiteScore,
            aiEnabled,
            aiDifficulty,
            gameDuration: Date.now() - gameStartTime
        });
        
        const saves = getSavedGames();
        saves[slotNumber] = saveData;
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
        
        updateSaveLoadUI();
        showNotification(`Game saved to slot ${slotNumber + 1}`, 'success');
        return true;
    } catch (error) {
        console.error('Error saving game:', error);
        showNotification('Failed to save game', 'error');
        return false;
    }
}

function loadGameFromSlot(slotNumber) {
    try {
        const saves = getSavedGames();
        const saveData = saves[slotNumber];
        
        if (!saveData) {
            showNotification('No saved game found in this slot', 'warning');
            return false;
        }
        
        // Validate save data version
        if (saveData.metadata.version !== '1.4.0') {
            showNotification('Save file version incompatible', 'error');
            return false;
        }
        
        // Restore game state
        gameStates = [saveData.gameState];
        currentStateIndex = 0;
        
        // Restore game variables
        currentPlayer = saveData.metadata.currentPlayer;
        blackScore = saveData.metadata.blackScore;
        whiteScore = saveData.metadata.whiteScore;
        aiEnabled = saveData.metadata.aiEnabled;
        aiDifficulty = saveData.metadata.aiDifficulty;
        
        // Update UI to reflect restored state
        updateScore();
        
        // Restore board by recreating it
        const board = document.getElementById('game-board');
        board.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            const rowElement = document.createElement('div');
            rowElement.classList.add('board-row');
            
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.classList.add('board-cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                if ((row + col) % 2 === 0) {
                    cell.classList.add('light');
                } else {
                    cell.classList.add('dark');
                    
                    const pieceData = saveData.gameState.boardState[row][col];
                    if (pieceData) {
                        const piece = document.createElement('div');
                        piece.classList.add('piece', pieceData.color);
                        if (pieceData.isHaji) {
                            piece.classList.add('haji');
                        }
                        cell.appendChild(piece);
                    }
                }
                rowElement.appendChild(cell);
            }
            board.appendChild(rowElement);
        }
        
        // Reattach event listeners
        board.querySelectorAll('.board-cell').forEach(square => {
            square.addEventListener('click', handleClick);
        });
        
        // Update UI
        updateCurrentPlayerDisplay();
        updateAIDisplay();
        updateSaveLoadUI();
        
        showNotification(`Game loaded from slot ${slotNumber + 1}`, 'success');
        return true;
    } catch (error) {
        console.error('Error loading game:', error);
        showNotification('Failed to load game', 'error');
        return false;
    }
}

function getSavedGames() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error('Error reading saved games:', error);
        return {};
    }
}

function deleteSavedGame(slotNumber) {
    try {
        const saves = getSavedGames();
        delete saves[slotNumber];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
        
        updateSaveLoadUI();
        showNotification(`Saved game in slot ${slotNumber + 1} deleted`, 'info');
    } catch (error) {
        console.error('Error deleting saved game:', error);
        showNotification('Failed to delete saved game', 'error');
    }
}

// Auto-save functionality
let autoSaveInterval = null;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(() => {
        if (gameStates.length > 0) {
            autoSaveGame();
        }
    }, AUTO_SAVE_INTERVAL);
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

function autoSaveGame() {
    try {
        const autoSaveData = new GameSaveData(gameStates[currentStateIndex], {
            slotNumber: -1, // Auto-save slot
            currentPlayer,
            blackScore,
            whiteScore,
            aiEnabled,
            aiDifficulty,
            gameDuration: Date.now() - gameStartTime,
            isAutoSave: true
        });
        
        localStorage.setItem('dam_haji_autosave', JSON.stringify(autoSaveData));
    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}

function checkForAutoSave() {
    try {
        const autoSaveData = localStorage.getItem('dam_haji_autosave');
        if (autoSaveData) {
            const saveData = JSON.parse(autoSaveData);
            const saveDate = new Date(saveData.metadata.saveDate);
            const now = new Date();
            const hoursSinceSave = (now - saveDate) / (1000 * 60 * 60);
            
            if (hoursSinceSave < 24) { // Only offer recovery for saves less than 24 hours old
                showAutoSaveRecoveryDialog(saveData);
            } else {
                localStorage.removeItem('dam_haji_autosave');
            }
        }
    } catch (error) {
        console.error('Error checking auto-save:', error);
    }
}

function showAutoSaveRecoveryDialog(saveData) {
    if (confirm('An auto-saved game was found. Would you like to restore it?')) {
        // Restore auto-save
        gameStates = [saveData.gameState];
        currentStateIndex = 0;
        currentPlayer = saveData.metadata.currentPlayer;
        blackScore = saveData.metadata.blackScore;
        whiteScore = saveData.metadata.whiteScore;
        aiEnabled = saveData.metadata.aiEnabled;
        aiDifficulty = saveData.metadata.aiDifficulty;
        
        // Update UI to reflect restored state
        updateScore();
        
        // Restore board by recreating it
        const board = document.getElementById('game-board');
        board.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            const rowElement = document.createElement('div');
            rowElement.classList.add('board-row');
            
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.classList.add('board-cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                if ((row + col) % 2 === 0) {
                    cell.classList.add('light');
                } else {
                    cell.classList.add('dark');
                    
                    const pieceData = saveData.gameState.boardState[row][col];
                    if (pieceData) {
                        const piece = document.createElement('div');
                        piece.classList.add('piece', pieceData.color);
                        if (pieceData.isHaji) {
                            piece.classList.add('haji');
                        }
                        cell.appendChild(piece);
                    }
                }
                rowElement.appendChild(cell);
            }
            board.appendChild(rowElement);
        }
        
        // Reattach event listeners
        board.querySelectorAll('.board-cell').forEach(square => {
            square.addEventListener('click', handleClick);
        });
        updateCurrentPlayerDisplay();
        updateAIDisplay();
        showNotification('Auto-saved game restored', 'success');
    } else {
        localStorage.removeItem('dam_haji_autosave');
    }
}

// --- UI HELPER FUNCTIONS ---

function cleanupDragState() {
    // Clear any ongoing drag operations
    selectedPiece = null;
    clearHighlights();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function updateSaveLoadUI() {
    const saveSlots = document.getElementById('save-slots');
    const loadSlots = document.getElementById('load-slots');
    
    if (saveSlots) {
        saveSlots.innerHTML = '';
        for (let i = 0; i < SAVE_SLOTS; i++) {
            const slot = createSaveSlot(i);
            saveSlots.appendChild(slot);
        }
    }
    
    if (loadSlots) {
        loadSlots.innerHTML = '';
        for (let i = 0; i < SAVE_SLOTS; i++) {
            const slot = createLoadSlot(i);
            loadSlots.appendChild(slot);
        }
    }
}

function createSaveSlot(slotNumber) {
    const slot = document.createElement('div');
    const saves = getSavedGames();
    const saveData = saves[slotNumber];
    
    slot.className = `save-slot ${saveData ? '' : 'empty'}`;
    
    const info = document.createElement('div');
    info.className = 'slot-info';
    
    if (saveData) {
        const saveDate = new Date(saveData.metadata.saveDate);
        info.innerHTML = `
            <strong>Slot ${slotNumber + 1}</strong><br>
            <small>${saveDate.toLocaleString()}</small><br>
            <small>Player: ${saveData.metadata.currentPlayer === 'B' ? 'Black' : 'White'}</small>
        `;
    } else {
        info.innerHTML = `<strong>Slot ${slotNumber + 1}</strong><br><small>Empty</small>`;
    }
    
    const actions = document.createElement('div');
    actions.className = 'slot-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => saveGameToSlot(slotNumber);
    
    actions.appendChild(saveBtn);
    
    if (saveData) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteSavedGame(slotNumber);
        actions.appendChild(deleteBtn);
    }
    
    slot.appendChild(info);
    slot.appendChild(actions);
    
    return slot;
}

function createLoadSlot(slotNumber) {
    const slot = document.createElement('div');
    const saves = getSavedGames();
    const saveData = saves[slotNumber];
    
    slot.className = `load-slot ${saveData ? '' : 'empty'}`;
    
    const info = document.createElement('div');
    info.className = 'slot-info';
    
    if (saveData) {
        const saveDate = new Date(saveData.metadata.saveDate);
        info.innerHTML = `
            <strong>Slot ${slotNumber + 1}</strong><br>
            <small>${saveDate.toLocaleString()}</small><br>
            <small>Player: ${saveData.metadata.currentPlayer === 'B' ? 'Black' : 'White'}</small>
        `;
    } else {
        info.innerHTML = `<strong>Slot ${slotNumber + 1}</strong><br><small>Empty</small>`;
    }
    
    const actions = document.createElement('div');
    actions.className = 'slot-actions';
    
    if (saveData) {
        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load';
        loadBtn.onclick = () => {
            loadGameFromSlot(slotNumber);
            closeSaveLoadModal();
        };
        actions.appendChild(loadBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteSavedGame(slotNumber);
        actions.appendChild(deleteBtn);
    }
    
    slot.appendChild(info);
    slot.appendChild(actions);
    
    return slot;
}

function openSaveLoadModal(defaultTab = 'save') {
    const modal = document.getElementById('save-load-modal');
    if (modal) {
        modal.classList.remove('hidden');
        updateSaveLoadUI();
        
        // Set the active tab based on the parameter
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // Clear all active states first
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            // Reset inline styles that might override CSS
            btn.style.color = '#666';
            btn.style.borderBottom = 'none';
        });
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });
        
        // Activate the specified tab
        const targetTabBtn = document.querySelector(`[data-tab="${defaultTab}"]`);
        const targetTabContent = document.getElementById(`${defaultTab}-tab`);
        
        if (targetTabBtn && targetTabContent) {
            targetTabBtn.classList.add('active');
            // Apply inline styles to ensure visibility over existing inline styles
            targetTabBtn.style.color = '#8B4513';
            targetTabBtn.style.borderBottom = '3px solid #8B4513';
            
            targetTabContent.classList.add('active');
            targetTabContent.style.display = 'block';
        }
    }
}

function closeSaveLoadModal() {
    const modal = document.getElementById('save-load-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function toggleMoveHistory() {
    const panel = document.getElementById('move-history-panel');
    const toggleBtn = document.getElementById('toggle-move-history');
    
    if (panel) {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !isHidden);
        if (toggleBtn) {
            toggleBtn.textContent = isHidden ? '−' : '+';
        }
    }
}

// Phase 1: Initialize all Phase 1 features
function initializePhase1Features() {
    // Initialize move history panel
    const moveHistoryPanel = document.getElementById('move-history-panel');
    const toggleMoveHistoryBtn = document.getElementById('toggle-move-history');
    
    if (moveHistoryPanel && toggleMoveHistoryBtn) {
        toggleMoveHistoryBtn.addEventListener('click', toggleMoveHistory);
    }
    
    // Undo/redo buttons handled by V2 UI system - original listeners disabled
    // const undoBtn = document.getElementById('undo-btn');
    // const redoBtn = document.getElementById('redo-btn');
    // 
    // if (undoBtn) {
    //     undoBtn.addEventListener('click', undoMove);
    // }
    // 
    // if (redoBtn) {
    //     redoBtn.addEventListener('click', redoMove);
    // }
    
    // Initialize save/load buttons
    const saveGameBtn = document.getElementById('save-game-btn');
    const loadGameBtn = document.getElementById('load-game-btn');
    
    if (saveGameBtn) {
        saveGameBtn.addEventListener('click', openSaveLoadModal);
    }
    
    if (loadGameBtn) {
        loadGameBtn.addEventListener('click', openSaveLoadModal);
    }
    
    // Initialize move history button
    const showMoveHistoryBtn = document.getElementById('show-move-history-btn');
    if (showMoveHistoryBtn) {
        showMoveHistoryBtn.addEventListener('click', toggleMoveHistory);
    }
    
    // Initialize save/load modal
    const saveLoadModal = document.getElementById('save-load-modal');
    const closeSaveLoadModalBtn = document.getElementById('close-save-load-modal');
    
    if (saveLoadModal && closeSaveLoadModalBtn) {
        closeSaveLoadModalBtn.addEventListener('click', closeSaveLoadModal);
        
        // Close modal when clicking outside
        saveLoadModal.addEventListener('click', (event) => {
            if (event.target === saveLoadModal) {
                closeSaveLoadModal();
            }
        });
    }
    
    // Initialize tab switching in save/load modal
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => {
                b.classList.remove('active');
                // Reset inline styles
                b.style.color = '#666';
                b.style.borderBottom = 'none';
            });
            btn.classList.add('active');
            // Apply inline styles to ensure visibility
            btn.style.color = '#8B4513';
            btn.style.borderBottom = '3px solid #8B4513';
            
            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none';
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                    content.style.display = 'block';
                }
            });
        });
    });
    
    // Initialize keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'z':
                    event.preventDefault();
                    undoMove();
                    break;
                case 'y':
                    event.preventDefault();
                    redoMove();
                    break;
            }
        }
    });
    
    // Initialize initial game state
    saveGameState();
    updateUndoRedoButtons();
    updateMoveHistoryDisplay();
}

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

function updateAIDisplay(isThinking = false) {
    const aiStatus = document.getElementById('ai-status');
    const aiDifficultyDisplay = document.getElementById('ai-difficulty');
    const aiToggleBtn = document.getElementById('ai-toggle');

    if (aiStatus) {
        if (isThinking) {
            aiStatus.textContent = "AI: Thinking...";
            aiStatus.classList.add('ai-thinking');
        } else {
            aiStatus.textContent = aiEnabled ? "AI: ON" : "AI: OFF";
            aiStatus.classList.remove('ai-thinking');
        }
        aiStatus.classList.toggle('ai-on', aiEnabled && !isThinking);
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

// Helper function to check if a specific piece can make any moves
function hasAvailableMovesForPiece(row, col) {
    const piece = getPiece(row, col);
    if (!piece) return false;
    
    const mustCapture = checkAvailableCaptures(currentPlayer);
    
    if (mustCapture) {
        return getAvailableCaptureMoves(row, col).length > 0;
    } else {
        return getAvailableRegularMoves(row, col).length > 0;
    }
}

// --- GAME FLOW AND ACTIONS ---

function executeMove(move) {
    const { piece, startRow, startCol, endRow, endCol, isCapture } = move;
    // All debug logging disabled for performance in production

    const endCell = document.querySelector(`.board-cell[data-row="${endRow}"][data-col="${endCol}"]`);
    let capturedPieces = [];
    let isHajiPromotion = false;

    if (isCapture) {
        movesSinceCapture = 0; // Reset counter on capture
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
            if (currentPlayer === 'B') blackScore++; else whiteScore++;
            updateScore();
            capturedPieces.push(capturedCell.firstChild);
            capturedCell.firstChild.classList.add('capture-animation');
            // Remove captured piece immediately for proper state management
            // Add a brief flash effect for visual feedback
            capturedCell.style.backgroundColor = '#ff4444';
            setTimeout(() => {
                capturedCell.style.backgroundColor = '';
            }, 200);
            capturedCell.innerHTML = "";
        }
    } else {
        movesSinceCapture++; // Increment counter on regular move
    }

    // Check for Haji promotion
    if ((endRow === 0 && piece.classList.contains("white")) || (endRow === 7 && piece.classList.contains("black"))) {
        if (!piece.classList.contains("haji")) { // Only promote if not already Haji
            isHajiPromotion = true;
        }
        piece.classList.add("haji");
    }

    endCell.appendChild(piece);
    
    // Phase 1: Add move to history
    addMoveToHistory({
        piece,
        startRow,
        startCol,
        endRow,
        endCol,
        isCapture,
        capturedPieces,
        isHajiPromotion
    });
    
    // Check if the piece can make additional moves
    // Allow additional moves for:
    // 1. Multiple captures (capture followed by more captures)
    // 2. Haji promotion through capture that can continue capturing
    // 3. Existing Haji making captures that can continue
    const canMakeAdditionalMoves = (isCapture && canCaptureAgain(endRow, endCol));
    

    
    if (canMakeAdditionalMoves) {
        selectedPiece = endCell.firstChild;
        highlightAvailableMoves(selectedPiece);
        // Don't save state here - wait for turn completion
        if (aiEnabled && currentPlayer === aiPlayer) {
            // Clear any pending AI moves to prevent stacking
            if (window.aiMoveTimeout) {
                clearTimeout(window.aiMoveTimeout);
            }
            // Wait for the captured piece to be removed before making the next AI move
            window.aiMoveTimeout = setTimeout(makeAIMove, 600);
        }
    } else {
        selectedPiece = null;
        clearHighlights();
        currentPlayer = currentPlayer === "B" ? "W" : "B";
        updateCurrentPlayerDisplay();
        // Phase 1: Save game state for undo/redo after turn is complete
        saveGameState();
        if (!checkWinCondition() && aiEnabled && currentPlayer === aiPlayer) {
            // Clear any pending AI moves to prevent stacking
            if (window.aiMoveTimeout) {
                clearTimeout(window.aiMoveTimeout);
            }
            // Use a more robust delay that waits for the DOM to be ready
            window.aiMoveTimeout = setTimeout(() => {
                // Double-check conditions before executing
                if (aiEnabled && currentPlayer === aiPlayer) {
                    makeAIMove();
                }
            }, 600);
        }
    }
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
    
    // Prevent multiple simultaneous AI moves
    if (window.aiThinking) {
        return; // Simplified - no debug logging
    }
    
    window.aiThinking = true;
    updateAIDisplay(true); // Show AI is thinking

    setTimeout(() => {
        // Double-check conditions haven't changed
        if (!aiEnabled || currentPlayer !== aiPlayer) {
            window.aiThinking = false;
            updateAIDisplay(false);
            return;
        }
        
        const board = buildBoardFromDOM();
        const bestMove = findBestMove(board, aiPlayer, aiDifficulty, aiPlayer);
        
        window.aiThinking = false;
        updateAIDisplay(false); // Reset AI status

        if (bestMove) {
            const piece = getPiece(bestMove.startRow, bestMove.startCol);
            executeMove({ ...bestMove, piece });
        } else {
            // AI has no moves, check win condition
            checkWinCondition();
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
  
  // Phase 1: Reset move history and game states
  moveHistory = [];
  currentMoveIndex = -1;
  gameStates = [];
  currentStateIndex = -1;
  
  // Update window.moveHistory as well
  window.moveHistory = moveHistory;
  
  // Phase 1: Save initial game state
  saveGameState();
  updateMoveHistoryDisplay();
  updateUndoRedoButtons();
  
  // Clear any celebration animations and hide win modal
  document.querySelectorAll('.piece-celebration').forEach(piece => {
    piece.classList.remove('piece-celebration');
  });
  const winModal = document.getElementById('win-modal');
  winModal.classList.add('hidden');
  winModal.classList.remove('win-animation-black', 'win-animation-white');
  
  if (aiEnabled && currentPlayer === aiPlayer) {
    // Clear any pending AI moves and reset flags
    if (window.aiMoveTimeout) {
        clearTimeout(window.aiMoveTimeout);
    }
    window.aiThinking = false;
    window.aiMoveTimeout = setTimeout(makeAIMove, 500);
  }
}

function showWinMessage(winner) {
  const winModal = document.getElementById('win-modal');
  const winMessage = document.getElementById('win-message');
  
  // Clear any existing animation classes
  winModal.classList.remove('win-animation-black', 'win-animation-white');
  
  if (winner === "Draw") {
      winMessage.textContent = "It's a Draw!";
      // No specific animation for draw
  } else {
      winMessage.textContent = `${winner} wins!`;
      
      // Apply appropriate win animation class using existing CSS
      if (winner === "Black") {
          winModal.classList.add('win-animation-black');
      } else if (winner === "White") {
          winModal.classList.add('win-animation-white');
      }
      
      // Add celebration animation to winning pieces using existing CSS
      const winningPieces = document.querySelectorAll(`.piece.${winner.toLowerCase()}`);
      winningPieces.forEach(piece => {
          piece.classList.add('piece-celebration');
      });
      
      // Use existing confetti animation
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
        if (aiEnabled && currentPlayer === aiPlayer) {
            // Clear any pending AI moves and reset flags
            if (window.aiMoveTimeout) {
                clearTimeout(window.aiMoveTimeout);
            }
            window.aiThinking = false;
            window.aiMoveTimeout = setTimeout(makeAIMove, 300);
        }
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
    
    // Phase 1: Initialize Phase 1 features
    initializePhase1Features();
    
    // Phase 1: Check for auto-save recovery
    checkForAutoSave();
    
    // Phase 1: Start auto-save
    startAutoSave();
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
    // Purpose: Simple scenario that results in Black winning by capturing all White pieces
    // This scenario sets up a board where Black can win in one move by capturing the last White piece
    initialBoard: [
        { row: 2, col: 1, color: 'black', isHaji: false },  // Black piece
        { row: 3, col: 2, color: 'white', isHaji: false },  // White piece to be captured (last white piece)
        { row: 5, col: 4, color: 'black', isHaji: false },  // Another black piece
        { row: 6, col: 5, color: 'black', isHaji: false }   // Another black piece
    ],
    startingPlayer: 'B',
    moves: [
        { startRow: 2, startCol: 1, endRow: 4, endCol: 3 }  // Black captures white (this should win)
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

// Test function to trigger win animation directly
function testWinAnimationDirect(winner = 'Black') {
    console.log(`Testing ${winner} win animation directly...`);
    showWinMessage(winner);
}

// Test iterative deepening with time limits
function testIterativeDeepening() {
    const testBoard = buildBoardFromDOM();
    const startTime = Date.now();
    const move = iterativeDeepening(testBoard, 'B', 'medium', 'B', 2000);
    const endTime = Date.now();
    
    console.assert(endTime - startTime <= 2500, 'Time limit exceeded');
    console.assert(move !== null, 'No move returned');
}

// Test move ordering efficiency
function testMoveOrdering() {
    const testBoard = buildBoardFromDOM();
    const moves = pureGetAllCaptureMoves(testBoard, 'B').concat(pureGetAllRegularMoves(testBoard, 'B'));
    const orderedMoves = orderMoves(testBoard, moves, 'B', 'medium');
    
    // Verify captures are prioritized
    const captures = orderedMoves.filter(m => m.isCapture);
    const regular = orderedMoves.filter(m => !m.isCapture);
    
    console.assert(captures.length === 0 || regular.length === 0 || captures[0].score > regular[0].score, 'Captures not prioritized');
}

// Test endgame detection
function testEndgameRecognition() {
    const endgameBoard = [
        [{color: 'B', haji: true}, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, {color: 'W', haji: true}, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null]
    ];
    const isEndgameResult = isEndgame(endgameBoard, 'B');
    const isKingVsKingResult = isKingVsKing(endgameBoard, 'B');
    
    console.assert(isEndgameResult === true, 'Endgame not detected');
    console.assert(isKingVsKingResult === true, 'King vs King not detected');
}



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
    const endGameTestBtn = createDebugButton('debug-endgame-test', 'Test End Game', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setupAndPlayScenario(endGameScenario);
    });
    const hajiTestBtn = createDebugButton('debug-haji-test', 'Test Haji Capture', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setupAndPlayScenario(hajiCaptureScenario);
    });
    const winTestBtn = createDebugButton('debug-win-test', 'Test Win Animation', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setupAndPlayScenario(winAnimationScenario);
    });
    // Add direct win animation test buttons
    const blackWinBtn = createDebugButton('debug-black-win', 'Test Black Win Direct', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        testWinAnimationDirect('Black');
    });
    const whiteWinBtn = createDebugButton('debug-white-win', 'Test White Win Direct', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        testWinAnimationDirect('White');
    });
    const playScenarioBtn = createDebugButton('debug-play-scenario', 'Play Capture Scenario', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        setupAndPlayScenario(captureScenario);
    });
    const runAITestsBtn = createDebugButton('debug-run-ai-tests', 'Run AI Tests', () => {
        document.getElementById('debug-modal').classList.add('hidden');
        testIterativeDeepening();
        testMoveOrdering();
        testEndgameRecognition();
        showNotification('AI tests run. Check console for results.', 'info');
    });

    // Append buttons to container
    debugButtonsContainer.appendChild(endGameTestBtn);
    debugButtonsContainer.appendChild(hajiTestBtn);
    debugButtonsContainer.appendChild(winTestBtn);
    debugButtonsContainer.appendChild(blackWinBtn);
    debugButtonsContainer.appendChild(whiteWinBtn);
    debugButtonsContainer.appendChild(playScenarioBtn);
    debugButtonsContainer.appendChild(runAITestsBtn);
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

// Test function to manually trigger win condition
window.testWinCondition = (winner = "Black") => {
    console.log('Testing win condition with winner:', winner);
    showWinMessage(winner);
};
