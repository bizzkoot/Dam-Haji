// Integration script to connect existing game logic with V2 UI
// This bridges the gap between the new modern UI and existing game mechanics

class GameUIIntegration {
    constructor() {
        this.modernUI = null;
        this.init();
    }

    init() {
        // Wait for both ModernUI and game elements to be ready
        if (window.modernUI && document.getElementById('game-board')) {
            this.modernUI = window.modernUI;
            this.setupIntegration();
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    setupIntegration() {
        console.log('Setting up game logic integration with V2 UI...');
        
        // Override existing UI update functions to work with V2
        this.overrideUIFunctions();
        
        // Connect existing game controls to new UI
        this.connectGameControls();
        
        // Connect AI system
        this.connectAISystem();
        
        // Connect save/load system
        this.connectSaveLoadSystem();
        
        // Connect move history system
        this.connectMoveHistorySystem();
        
        // Initialize game board with existing logic
        this.initializeGameBoard();
        
        console.log('V2 UI integration complete!');
    }

    overrideUIFunctions() {
        // Override updateCurrentPlayerDisplay to work with V2 UI
        const originalUpdateCurrentPlayerDisplay = window.updateCurrentPlayerDisplay;
        window.updateCurrentPlayerDisplay = () => {
            // Update V2 UI
            if (this.modernUI) {
                this.modernUI.updateCurrentPlayer(currentPlayer === "B" ? "Black" : "White");
            }
            
            // Update any legacy elements that might still exist
            const display = document.getElementById("current-player");
            if (display) {
                display.textContent = `Current Player: ${currentPlayer === "B" ? "Black" : "White"}`;
                display.className = `player-display ${currentPlayer === 'B' ? 'black-turn' : 'white-turn'}`;
            }
        };

        // Override updateScore to work with V2 UI
        const originalUpdateScore = window.updateScore;
        window.updateScore = () => {
            // Update V2 UI
            if (this.modernUI) {
                this.modernUI.updateScore(blackScore, whiteScore);
            }
            
            // Update legacy elements
            const blackScoreEl = document.getElementById('black-score');
            const whiteScoreEl = document.getElementById('white-score');
            if (blackScoreEl) blackScoreEl.textContent = blackScore;
            if (whiteScoreEl) whiteScoreEl.textContent = whiteScore;
        };

        // Override updateAIDisplay to work with V2 UI
        const originalUpdateAIDisplay = window.updateAIDisplay;
        window.updateAIDisplay = (isThinking = false) => {
            // Prevent recursive calls
            if (window.updatingAIDisplay) {
                return;
            }
            window.updatingAIDisplay = true;
            
            try {
                // Get the actual global aiEnabled value
                let actualAiEnabled = false;
                try {
                    actualAiEnabled = window.eval('aiEnabled');
                } catch (e) {
                    actualAiEnabled = window.aiEnabled || false;
                }
                
                // Don't log every call to reduce console spam
                // console.log('updateAIDisplay called with isThinking:', isThinking, 'actualAiEnabled:', actualAiEnabled);
                
                // Respect AI thinking state - don't override if AI is actually thinking
                let actualIsThinking = isThinking;
                if (window.aiThinking && !isThinking) {
                    // If AI is actually thinking but this call says it's not, preserve thinking state
                    actualIsThinking = true;
                }
                
                // Update V2 UI AI switch - but don't override user's manual toggle
                const aiSwitch = document.getElementById('ai-switch');
                if (aiSwitch && !actualIsThinking) {
                    // Only update switch if it's not currently being toggled
                    if (aiSwitch.checked !== actualAiEnabled) {
                        console.log('updateAIDisplay: updating switch from', aiSwitch.checked, 'to', actualAiEnabled);
                        aiSwitch.checked = actualAiEnabled;
                    }
                }
                
                // Update V2 UI AI status
                const aiStatusText = document.getElementById('ai-status-text');
                if (aiStatusText) {
                    if (actualIsThinking) {
                        aiStatusText.textContent = 'AI Thinking...';
                    } else {
                        aiStatusText.textContent = actualAiEnabled ? 'AI On' : 'AI Off';
                    }
                }
                
                // Get actual difficulty
                let actualAiDifficulty = 'medium';
                try {
                    actualAiDifficulty = window.eval('aiDifficulty') || 'medium';
                } catch (e) {
                    actualAiDifficulty = window.aiDifficulty || 'medium';
                }
                
                // Update difficulty buttons
                document.querySelectorAll('.diff-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.level === actualAiDifficulty) {
                        btn.classList.add('active');
                    }
                    btn.disabled = !actualAiEnabled;
                    btn.style.opacity = actualAiEnabled ? '1' : '0.5';
                });
                
                // Note: Not calling original function to prevent infinite recursion
                // originalUpdateAIDisplay would create recursive loop
            } finally {
                window.updatingAIDisplay = false;
            }
        };

        // Override addMoveToHistory to work with V2 UI
        const originalAddMoveToHistory = window.addMoveToHistory;
        window.addMoveToHistory = (move) => {
            // Call original function
            if (originalAddMoveToHistory) {
                originalAddMoveToHistory(move);
            }
            
            // Update V2 UI recent moves
            if (this.modernUI) {
                const moveDescription = this.formatMoveForV2(move);
                this.modernUI.addRecentMove(move.moveNumber || moveHistory.length, moveDescription);
                
                // Update statistics
                const captures = moveHistory.filter(m => m.isCapture).length;
                const hajis = document.querySelectorAll('.piece.haji').length;
                this.modernUI.updateStats(moveHistory.length, captures, hajis);
            }
            
            // Update Move History panel if it's open
            if (window.menuSystem) {
                window.menuSystem.updateMoveHistory();
            }
        };

        // Override showWinMessage to work with V2 UI
        const originalShowWinMessage = window.showWinMessage;
        const gameIntegration = this;
        window.showWinMessage = (winner) => {
            console.log('showWinMessage called with winner:', winner);
            
            const winModal = document.getElementById('win-modal');
            const winMessage = document.getElementById('win-message');
            
            if (!winModal || !winMessage) {
                console.error('Win modal elements not found!', { winModal, winMessage });
                alert(`${winner === "Draw" ? "It's a Draw!" : winner + " wins!"}`);
                return;
            }
            
            // Call original function
            if (originalShowWinMessage) {
                originalShowWinMessage(winner);
            }
            
            // Show notification in V2 UI
            if (gameIntegration.modernUI) {
                const message = winner === "Draw" ? "It's a Draw!" : `${winner} wins!`;
                gameIntegration.modernUI.showNotification(message, 'success', 0); // 0 = persistent
            }
            
            console.log('Win modal should now be visible');
        };
    }

    connectGameControls() {
        // Connect undo/redo buttons - delegate to original function
        const originalUndoMove = window.undoMove || undoMove;
        window.undoMove = () => {
            const success = originalUndoMove();
            
            // Update V2 UI with notification (original function already handles this)
            // if (this.modernUI && success) {
            //     this.modernUI.showNotification('Move undone', 'info');
            // }
            
            return success;
        };

        const originalRedoMove = window.redoMove || redoMove;
        window.redoMove = () => {
            const success = originalRedoMove();
            
            // Update V2 UI with notification (original function already handles this)
            // if (this.modernUI && success) {
            //     this.modernUI.showNotification('Move redone', 'info');
            // }
            
            return success;
        };

        // Connect reset game
        const gameIntegration = this;
        window.resetGame = () => {
            const board = document.getElementById("game-board");
            initializeBoard(board);
            board.querySelectorAll('.board-cell').forEach(square => square.addEventListener('click', handleClick));
            currentPlayer = "B";
            selectedPiece = null;
            blackScore = 0;
            whiteScore = 0;
            movesSinceCapture = 0;
            
            // Reset move history and game states
            moveHistory = [];
            currentMoveIndex = -1;
            gameStates = [];
            currentStateIndex = -1;
            
            // Update window.moveHistory as well
            window.moveHistory = moveHistory;
            
            // Update UI
            updateScore();
            updateCurrentPlayerDisplay();
            // Don't call updateAIDisplay here to prevent cascade calls
            // updateAIDisplay();
            
            // Save initial game state
            saveGameState();
            updateMoveHistoryDisplay();
            updateUndoRedoButtons();
            
            // Clear celebrations and modals
            document.querySelectorAll('.piece-celebration').forEach(piece => {
                piece.classList.remove('piece-celebration');
            });
            const winModal = document.getElementById('win-modal');
            if (winModal) {
                winModal.classList.add('hidden');
                winModal.classList.remove('win-animation-black', 'win-animation-white');
            }
            
            // Update V2 UI
            if (gameIntegration.modernUI) {
                gameIntegration.modernUI.showNotification('Game reset', 'info');
                gameIntegration.modernUI.clearRecentMoves();
                gameIntegration.modernUI.updateStats(0, 0, 0);
            }
            
            if (aiEnabled && currentPlayer === aiPlayer) {
                // Clear any pending AI moves and reset flags
                if (window.aiMoveTimeout) {
                    clearTimeout(window.aiMoveTimeout);
                }
                window.aiThinking = false;
                window.aiMoveTimeout = setTimeout(makeAIMove, 500);
            }
        };
    }

    connectAISystem() {
        // Connect AI toggle - ensure both old and new systems work
        window.toggleAI = (enabled) => {
            // Update global variable in script.js scope
            if (typeof window.aiEnabled !== 'undefined') {
                window.aiEnabled = enabled;
            }
            // Also update in global scope
            try {
                window.eval('aiEnabled = ' + enabled);
            } catch (e) {
                console.error('Error setting global aiEnabled in toggleAI:', e);
            }
            
            // Don't call updateAIDisplay here to prevent cascade
            // updateAIDisplay();
            
            // Update new UI switch
            const aiSwitch = document.getElementById('ai-switch');
            if (aiSwitch) {
                aiSwitch.checked = enabled;
            }
            
            // Update AI status directly without triggering cascade
            const aiStatusText = document.getElementById('ai-status-text');
            if (aiStatusText) {
                aiStatusText.textContent = enabled ? 'AI On' : 'AI Off';
            }
            
            if (enabled && typeof currentPlayer !== 'undefined' && 
                typeof aiPlayer !== 'undefined' && currentPlayer === aiPlayer &&
                typeof makeAIMove === 'function') {
                // Clear any pending AI moves and use controlled timeout
                if (window.aiMoveTimeout) {
                    clearTimeout(window.aiMoveTimeout);
                }
                window.aiThinking = false;
                window.aiMoveTimeout = setTimeout(makeAIMove, 300);
            }
        };
        
        // AI switch connection is handled by ui-v2.js to avoid duplicate listeners

        // Connect difficulty setting
        window.setAIDifficulty = (level) => {
            // Update global variable in script.js scope
            if (typeof window.aiDifficulty !== 'undefined') {
                window.aiDifficulty = level;
            }
            // Also update in global scope
            try {
                window.eval('aiDifficulty = "' + level + '"');
            } catch (e) {
                console.error('Error setting global aiDifficulty:', e);
            }
            
            // Don't call updateAIDisplay here to prevent cascade
            // updateAIDisplay();
        };
    }

    connectSaveLoadSystem() {
        // Connect save/load functions
        window.saveGame = () => {
            openSaveLoadModal();
        };

        window.loadGame = () => {
            openSaveLoadModal('load');
        };

        // Override the original save/load functions to work with V2 UI
        const originalSaveGameToSlot = window.saveGameToSlot;
        window.saveGameToSlot = (slotNumber) => {
            const result = originalSaveGameToSlot(slotNumber);
            if (result && this.modernUI) {
                this.modernUI.showNotification(`Game saved to slot ${slotNumber + 1}`, 'success');
            }
            return result;
        };

        const originalLoadGameFromSlot = window.loadGameFromSlot;
        window.loadGameFromSlot = (slotNumber) => {
            const result = originalLoadGameFromSlot(slotNumber);
            if (result && this.modernUI) {
                this.modernUI.showNotification(`Game loaded from slot ${slotNumber + 1}`, 'success');
            }
            return result;
        };
    }

    connectMoveHistorySystem() {
        // Connect move history display to V2 UI
        const originalUpdateMoveHistoryDisplay = window.updateMoveHistoryDisplay;
        window.updateMoveHistoryDisplay = () => {
            // Call original function for legacy elements
            if (originalUpdateMoveHistoryDisplay) {
                originalUpdateMoveHistoryDisplay();
            }

            // Update V2 history panel
            this.updateV2MoveHistory();
        };
    }

    updateV2MoveHistory() {
        const historyList = document.getElementById('move-history-list');
        if (!historyList) return;

        historyList.innerHTML = '';
        
        moveHistory.forEach((move, index) => {
            const moveEntry = document.createElement('div');
            moveEntry.className = `move-item ${move.player === 'B' ? 'black' : 'white'}`;
            if (index === currentMoveIndex) {
                moveEntry.classList.add('current');
            }
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'move-num';
            moveNumber.textContent = `${move.moveNumber}.`;
            
            const description = document.createElement('span');
            description.className = 'move-desc';
            description.innerHTML = this.formatMoveForV2(move);
            
            moveEntry.appendChild(moveNumber);
            moveEntry.appendChild(description);
            
            // Add click handler for move review
            moveEntry.addEventListener('click', () => {
                reviewMove(index);
            });
            
            historyList.appendChild(moveEntry);
        });
    }

    formatMoveForV2(move) {
        // Check if move has the expected properties
        if (typeof move.startCol === 'undefined' || typeof move.startRow === 'undefined' ||
            typeof move.endCol === 'undefined' || typeof move.endRow === 'undefined') {
            console.warn('formatMoveForV2: Move object missing coordinate properties', move);
            console.log('Available properties:', Object.keys(move));
            return 'invalid move';
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

    initializeGameBoard() {
        // Initialize the game board with existing logic
        const board = document.getElementById("game-board");
        if (board) {
            initializeBoard(board);
            board.querySelectorAll('.board-cell').forEach(square => {
                square.addEventListener('click', handleClick);
            });
            
            // Update initial UI state
            updateCurrentPlayerDisplay();
            updateScore();
            // Don't call updateAIDisplay here to prevent cascade
            // updateAIDisplay();
            
            // Initialize game state tracking
            if (typeof saveGameState === 'function') {
                saveGameState();
            }
            if (typeof updateUndoRedoButtons === 'function') {
                updateUndoRedoButtons();
            }
            
            // Initialize AI controls with current game state
            if (typeof window.aiEnabled !== 'undefined') {
                const aiSwitch = document.getElementById('ai-switch');
                if (aiSwitch) {
                    aiSwitch.checked = window.aiEnabled;
                    console.log('AI switch initialized to:', window.aiEnabled);
                }
                if (this.modernUI) {
                    // Set initial state without triggering the full toggle logic
                    const statusText = document.getElementById('ai-status-text');
                    if (statusText) {
                        statusText.textContent = window.aiEnabled ? 'AI On' : 'AI Off';
                    }
                    
                    // Enable/disable difficulty buttons
                    document.querySelectorAll('.diff-btn').forEach(btn => {
                        btn.disabled = !window.aiEnabled;
                        btn.style.opacity = window.aiEnabled ? '1' : '0.5';
                    });
                }
            }
            
            if (typeof window.aiDifficulty !== 'undefined' && this.modernUI) {
                this.modernUI.setDifficulty(window.aiDifficulty);
            }
        }
    }
}

// Initialize integration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all scripts are loaded
    setTimeout(() => {
        window.gameIntegration = new GameUIIntegration();
    }, 200);
});

// Export for use by other scripts
window.GameUIIntegration = GameUIIntegration;