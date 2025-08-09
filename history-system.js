/**
 * History System - Enhanced move history display and management
 * Manages: Move History Panel, Navigation, Analysis, Export
 */

class HistorySystem {
    constructor() {
        this.moves = [];
        this.currentMoveIndex = -1;
        this.isAnalysisMode = false;
        
        this.initializeEventListeners();
        this.initializeHistoryPanel();
    }

    initializeEventListeners() {
        // Listen for move updates from game
        document.addEventListener('moveAdded', (e) => {
            this.addMove(e.detail);
        });

        document.addEventListener('gameReset', () => {
            this.clearHistory();
        });

        document.addEventListener('gameStateChanged', (e) => {
            this.updateCurrentMove(e.detail.moveIndex);
        });

        // Panel specific events
        document.addEventListener('panelOpened', (e) => {
            if (e.detail.panelId === 'history-panel') {
                this.refreshHistoryDisplay();
            }
        });
    }

    initializeHistoryPanel() {
        const historyPanel = document.getElementById('history-panel');
        if (!historyPanel) return;

        // Add history controls
        const historyControls = document.createElement('div');
        historyControls.className = 'history-controls';
        historyControls.innerHTML = `
            <div class="history-toolbar">
                <button id="history-first" class="history-nav-btn" title="First Move">⏮</button>
                <button id="history-prev" class="history-nav-btn" title="Previous Move">⏪</button>
                <button id="history-next" class="history-nav-btn" title="Next Move">⏩</button>
                <button id="history-last" class="history-nav-btn" title="Last Move">⏭</button>
                <div class="history-divider"></div>
                <button id="history-export" class="history-action-btn" title="Export History">📤</button>
                <button id="history-analysis" class="history-action-btn" title="Analysis Mode">🔍</button>
            </div>
            <div class="history-info">
                <span id="history-move-counter">Move: 0/0</span>
                <span id="history-position-info"></span>
            </div>
        `;

        // Insert controls at the top of slide-content
        const slideContent = historyPanel.querySelector('.slide-content');
        if (slideContent) {
            slideContent.insertBefore(historyControls, slideContent.firstChild);
        }

        // Attach event listeners to new controls
        this.attachHistoryControlListeners();
    }

    attachHistoryControlListeners() {
        // Navigation buttons
        document.getElementById('history-first')?.addEventListener('click', () => {
            this.goToMove(0);
        });

        document.getElementById('history-prev')?.addEventListener('click', () => {
            this.goToMove(this.currentMoveIndex - 1);
        });

        document.getElementById('history-next')?.addEventListener('click', () => {
            this.goToMove(this.currentMoveIndex + 1);
        });

        document.getElementById('history-last')?.addEventListener('click', () => {
            this.goToMove(this.moves.length - 1);
        });

        // Action buttons
        document.getElementById('history-export')?.addEventListener('click', () => {
            this.exportHistory();
        });

        document.getElementById('history-analysis')?.addEventListener('click', () => {
            this.toggleAnalysisMode();
        });
    }

    addMove(moveData) {
        const move = {
            ...moveData,
            timestamp: new Date().toISOString(),
            moveNumber: this.moves.length + 1,
            notation: this.generateNotation(moveData),
            position: this.capturePosition()
        };

        this.moves.push(move);
        this.currentMoveIndex = this.moves.length - 1;
        
        // Update displays
        this.updateHistoryList();
        this.updateMoveCounter();
        this.updateRecentMoves();
    }

    generateNotation(moveData) {
        if (!moveData.from || !moveData.to) return '';

        const fromSquare = this.coordsToNotation(moveData.from);
        const toSquare = this.coordsToNotation(moveData.to);
        
        let notation = `${fromSquare}-${toSquare}`;
        
        if (moveData.isCapture) {
            notation += 'x';
        }
        
        if (moveData.isHaji) {
            notation += '♔';
        }
        
        return notation;
    }

    coordsToNotation(coords) {
        if (typeof coords === 'string') return coords;
        if (Array.isArray(coords)) {
            const [row, col] = coords;
            return String.fromCharCode(97 + col) + (8 - row);
        }
        return coords;
    }

    capturePosition() {
        // Capture current board state
        const pieces = [];
        const board = document.getElementById('game-board');
        if (board) {
            const pieceElements = board.querySelectorAll('.piece');
            pieceElements.forEach(piece => {
                const cell = piece.closest('.board-cell');
                if (cell) {
                    const row = parseInt(cell.dataset.row);
                    const col = parseInt(cell.dataset.col);
                    const color = piece.classList.contains('black') ? 'black' : 'white';
                    const isHaji = piece.classList.contains('haji');
                    
                    pieces.push({ row, col, color, isHaji });
                }
            });
        }
        return pieces;
    }

    refreshHistoryDisplay() {
        this.updateHistoryList();
        this.updateMoveCounter();
    }

    updateHistoryList() {
        const historyList = document.getElementById('move-history-list');
        if (!historyList) return;

        // Find or create the actual list container
        let listContainer = historyList.querySelector('.history-moves-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.className = 'history-moves-list';
            historyList.appendChild(listContainer);
        }

        listContainer.innerHTML = '';

        if (this.moves.length === 0) {
            listContainer.innerHTML = '<div class="no-history">No moves yet</div>';
            return;
        }

        // Group moves by pairs (white and black)
        for (let i = 0; i < this.moves.length; i += 2) {
            const moveGroup = document.createElement('div');
            moveGroup.className = 'move-group';
            
            const moveNumber = Math.floor(i / 2) + 1;
            const blackMove = this.moves[i];
            const whiteMove = this.moves[i + 1];

            moveGroup.innerHTML = `
                <div class="move-number">${moveNumber}.</div>
                <div class="move-pair">
                    <div class="move-entry black ${i === this.currentMoveIndex ? 'current' : ''}" 
                         data-move-index="${i}">
                        ${blackMove.notation}
                        ${blackMove.isCapture ? ' ✕' : ''}
                        ${blackMove.isHaji ? ' ♔' : ''}
                    </div>
                    ${whiteMove ? `
                        <div class="move-entry white ${i + 1 === this.currentMoveIndex ? 'current' : ''}" 
                             data-move-index="${i + 1}">
                            ${whiteMove.notation}
                            ${whiteMove.isCapture ? ' ✕' : ''}
                            ${whiteMove.isHaji ? ' ♔' : ''}
                        </div>
                    ` : '<div class="move-entry empty">...</div>'}
                </div>
            `;

            listContainer.appendChild(moveGroup);
        }

        // Add click listeners to move entries
        const moveEntries = listContainer.querySelectorAll('.move-entry:not(.empty)');
        moveEntries.forEach(entry => {
            entry.addEventListener('click', () => {
                const moveIndex = parseInt(entry.dataset.moveIndex);
                this.goToMove(moveIndex);
            });
        });

        // Scroll to current move
        this.scrollToCurrentMove();
    }

    updateRecentMoves() {
        // Recent moves are handled by integration-v2.js to avoid conflicts
        // This function is kept for future use but disabled to prevent duplicate calls
        // updateRecentMoves skipped to avoid conflicts (log disabled for performance)
    }

    updateMoveCounter() {
        const counter = document.getElementById('history-move-counter');
        if (counter) {
            counter.textContent = `Move: ${this.currentMoveIndex + 1}/${this.moves.length}`;
        }
    }

    scrollToCurrentMove() {
        const currentMoveElement = document.querySelector('.move-entry.current');
        if (currentMoveElement) {
            currentMoveElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }
    }

    goToMove(moveIndex) {
        if (moveIndex < -1 || moveIndex >= this.moves.length) return;

        const oldIndex = this.currentMoveIndex;
        this.currentMoveIndex = moveIndex;

        // Update display
        this.updateHistoryList();
        this.updateMoveCounter();

        // If in analysis mode, restore position
        if (this.isAnalysisMode) {
            this.restorePosition(moveIndex);
        }

        // Dispatch event for other systems
        document.dispatchEvent(new CustomEvent('historyNavigated', {
            detail: { moveIndex, oldIndex, move: this.moves[moveIndex] }
        }));
    }

    restorePosition(moveIndex) {
        if (moveIndex < 0) {
            // Restore initial position
            if (typeof window.initializeBoard === 'function') {
                const board = document.getElementById('game-board');
                window.initializeBoard(board);
            }
            return;
        }

        const move = this.moves[moveIndex];
        if (move && move.position) {
            this.applyPosition(move.position);
        }
    }

    applyPosition(position) {
        const board = document.getElementById('game-board');
        if (!board) return;

        // Clear current pieces
        board.querySelectorAll('.piece').forEach(piece => piece.remove());

        // Add pieces from position
        position.forEach(piece => {
            const cell = board.querySelector(`[data-row="${piece.row}"][data-col="${piece.col}"]`);
            if (cell) {
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${piece.color}`;
                if (piece.isHaji) {
                    pieceElement.classList.add('haji');
                }
                cell.appendChild(pieceElement);
            }
        });
    }

    toggleAnalysisMode() {
        this.isAnalysisMode = !this.isAnalysisMode;
        
        const analysisBtn = document.getElementById('history-analysis');
        if (analysisBtn) {
            analysisBtn.classList.toggle('active', this.isAnalysisMode);
            analysisBtn.title = this.isAnalysisMode ? 'Exit Analysis' : 'Analysis Mode';
        }

        if (this.isAnalysisMode) {
            this.showNotification('Analysis mode enabled. Click moves to explore positions.', 'info');
        } else {
            this.showNotification('Analysis mode disabled.', 'info');
            // Restore current game position
            this.goToMove(this.moves.length - 1);
        }
    }

    exportHistory() {
        if (this.moves.length === 0) {
            this.showNotification('No moves to export', 'warning');
            return;
        }

        try {
            const gameData = {
                moves: this.moves,
                gameInfo: {
                    date: new Date().toISOString(),
                    totalMoves: this.moves.length,
                    result: this.getGameResult()
                }
            };

            const exportData = this.formatForExport(gameData);
            this.downloadFile(exportData, 'dam-haji-game.json', 'application/json');
            
            this.showNotification('Game history exported', 'success');
        } catch (error) {
            this.showNotification('Failed to export history', 'error');
        }
    }

    formatForExport(gameData) {
        // Create both JSON and PGN-style formats
        const jsonData = JSON.stringify(gameData, null, 2);
        
        // Simple notation format
        const notationMoves = this.moves.map((move, index) => {
            const moveNumber = Math.floor(index / 2) + 1;
            const isBlackMove = index % 2 === 0;
            const prefix = isBlackMove ? `${moveNumber}.` : '';
            return `${prefix}${move.notation}`;
        }).join(' ');

        const simpleFormat = `[Dam Haji Game]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Moves "${this.moves.length}"]\n\n${notationMoves}`;

        return {
            json: jsonData,
            notation: simpleFormat
        };
    }

    downloadFile(data, filename, mimeType) {
        const content = typeof data === 'object' ? data.json : data;
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    getGameResult() {
        // Determine game result if game is finished
        return 'In Progress'; // TODO: Implement based on win condition
    }

    clearHistory() {
        this.moves = [];
        this.currentMoveIndex = -1;
        this.updateHistoryList();
        this.updateMoveCounter();
        
        // Clear recent moves in main UI
        if (window.gameIntegration?.modernUI?.clearRecentMoves) {
            window.gameIntegration.modernUI.clearRecentMoves();
        }
    }

    showNotification(message, type = 'info') {
        if (window.gameIntegration?.modernUI?.showNotification) {
            window.gameIntegration.modernUI.showNotification(message, type);
        } else {
            console.log(`History: ${message}`);
        }
    }

    // Public methods
    getMoves() {
        return [...this.moves];
    }

    getCurrentMove() {
        return this.moves[this.currentMoveIndex];
    }

    getMoveCount() {
        return this.moves.length;
    }
}

// Global instance
window.historySystem = new HistorySystem();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistorySystem;
}