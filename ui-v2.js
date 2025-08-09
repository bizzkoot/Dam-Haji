// Modern UI Controller for Dam Haji V2
// Handles all UI interactions and panel management

class ModernUI {
    constructor() {
        this.panels = new Map();
        this.isInfoPanelCollapsed = false; // Start expanded to show AI controls
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupPanels();
        this.updateUI();
        this.initializeGameDisplay();
    }

    initializeGameDisplay() {
        // Only initialize if there are no moves already
        const moveHistoryExists = window.moveHistory && window.moveHistory.length > 0;
        console.log('initializeGameDisplay called, moveHistory exists:', moveHistoryExists);
        
        if (!moveHistoryExists) {
            // Initialize recent moves with empty state on fresh load
            this.clearRecentMoves();
            // Initialize stats to zero
            this.updateStats(0, 0, 0);
        } else {
            console.log('Skipping initialization - game already in progress');
        }
    }

    setupEventListeners() {
        // Top navigation buttons - Let MenuSystem handle these
        // document.getElementById('menu-btn')?.addEventListener('click', () => this.togglePanel('menu-panel'));
        // document.getElementById('history-btn')?.addEventListener('click', () => this.togglePanel('history-panel'));
        // document.getElementById('settings-btn')?.addEventListener('click', () => this.togglePanel('settings-panel'));

        // Info panel toggle
        document.getElementById('panel-toggle')?.addEventListener('click', () => this.toggleInfoPanel());

        // Action bar buttons
        document.getElementById('undo-btn')?.addEventListener('click', () => this.handleUndo());
        document.getElementById('redo-btn')?.addEventListener('click', () => this.handleRedo());
        document.getElementById('save-btn')?.addEventListener('click', () => this.handleSave());
        document.getElementById('load-btn')?.addEventListener('click', () => this.handleLoad());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.handleReset());

        // AI toggle (desktop)
        const aiSwitchElement = document.getElementById('ai-switch');
        if (aiSwitchElement) {
            aiSwitchElement.addEventListener('change', (e) => {
                console.log('AI switch toggled:', e.target.checked);
                console.log('Switch element state after click:', aiSwitchElement.checked);
                this.toggleAI(e.target.checked);
                
                // Sync with mobile switch
                const mobileSwitch = document.getElementById('mobile-ai-switch');
                if (mobileSwitch) {
                    mobileSwitch.checked = e.target.checked;
                    this.updateMobileAIStatus(e.target.checked);
                }
                
                // Double-check the switch state after our toggle
                setTimeout(() => {
                    console.log('Switch state after toggleAI:', aiSwitchElement.checked);
                }, 10);
            });
        }
        
        // AI toggle (mobile)
        const mobileAiSwitchElement = document.getElementById('mobile-ai-switch');
        if (mobileAiSwitchElement) {
            mobileAiSwitchElement.addEventListener('change', (e) => {
                console.log('Mobile AI switch toggled:', e.target.checked);
                this.toggleAI(e.target.checked);
                
                // Sync with desktop switch
                const desktopSwitch = document.getElementById('ai-switch');
                if (desktopSwitch) {
                    desktopSwitch.checked = e.target.checked;
                }
                
                this.updateMobileAIStatus(e.target.checked);
            });
        }

        // Difficulty buttons (desktop)
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setDifficulty(btn.dataset.level);
                // Sync with mobile buttons
                this.syncMobileDifficulty(btn.dataset.level);
            });
        });
        
        // Difficulty buttons (mobile)
        document.querySelectorAll('.mobile-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setDifficulty(btn.dataset.level);
            });
        });

        // Mobile action buttons
        const mobileUndoBtn = document.getElementById('mobile-undo-btn');
        if (mobileUndoBtn) {
            mobileUndoBtn.addEventListener('click', () => this.handleUndo());
        }
        
        const mobileRedoBtn = document.getElementById('mobile-redo-btn');
        if (mobileRedoBtn) {
            mobileRedoBtn.addEventListener('click', () => this.handleRedo());
        }
        
        const mobileSaveBtn = document.getElementById('mobile-save-btn');
        if (mobileSaveBtn) {
            mobileSaveBtn.addEventListener('click', () => this.handleSave());
        }
        
        const mobileLoadBtn = document.getElementById('mobile-load-btn');
        if (mobileLoadBtn) {
            mobileLoadBtn.addEventListener('click', () => this.handleLoad());
        }
        
        const mobileResetBtn = document.getElementById('mobile-reset-btn');
        if (mobileResetBtn) {
            mobileResetBtn.addEventListener('click', () => this.handleReset());
        }

        // Close buttons for slide panels
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPanel = btn.dataset.target;
                if (targetPanel) {
                    this.closePanel(targetPanel);
                }
            });
        });

        // Overlay click to close panels
        document.getElementById('overlay')?.addEventListener('click', () => this.closeAllPanels());

        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllPanels();
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => this.handleResize());
    }

    setupPanels() {
        // Register all slide panels
        const panels = ['menu-panel', 'history-panel', 'settings-panel'];
        panels.forEach(panelId => {
            this.panels.set(panelId, {
                element: document.getElementById(panelId),
                isOpen: false
            });
        });
    }

    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        // Close other panels first
        this.closeAllPanels();

        // Toggle the requested panel
        if (!panel.isOpen) {
            this.openPanel(panelId);
        }
    }

    openPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        panel.element.classList.add('active');
        panel.isOpen = true;
        
        // Show overlay
        const overlay = document.getElementById('overlay');
        overlay.classList.add('active');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        panel.element.classList.remove('active');
        panel.isOpen = false;
        
        // Check if any panels are still open
        const anyOpen = Array.from(this.panels.values()).some(p => p.isOpen);
        
        if (!anyOpen) {
            // Hide overlay
            const overlay = document.getElementById('overlay');
            overlay.classList.remove('active');
            
            // Restore body scroll
            document.body.style.overflow = '';
        }
    }

    closeAllPanels() {
        this.panels.forEach((panel, panelId) => {
            if (panel.isOpen) {
                this.closePanel(panelId);
            }
        });
    }

    toggleInfoPanel() {
        const infoPanel = document.getElementById('info-panel');
        const toggleBtn = document.getElementById('panel-toggle');
        
        this.isInfoPanelCollapsed = !this.isInfoPanelCollapsed;
        
        if (this.isInfoPanelCollapsed) {
            infoPanel.classList.add('collapsed');
            toggleBtn.textContent = '→';
        } else {
            infoPanel.classList.remove('collapsed');
            toggleBtn.textContent = '←';
        }
    }

    updateCurrentPlayer(player) {
        const indicator = document.getElementById('current-player-indicator');
        const text = document.getElementById('current-player-text');
        
        indicator.className = `player-indicator ${player.toLowerCase()}-turn`;
        text.textContent = `${player}'s Turn`;
    }

    updateScore(blackScore, whiteScore) {
        document.getElementById('black-score').textContent = blackScore;
        document.getElementById('white-score').textContent = whiteScore;
    }

    updateStats(moves, captures, haji) {
        document.getElementById('move-count').textContent = moves;
        document.getElementById('capture-count').textContent = captures;
        document.getElementById('haji-count').textContent = haji;
    }

    addRecentMove(moveNumber, description) {
        const recentMoves = document.getElementById('recent-moves');
        
        // Clear the "No moves yet" placeholder if this is the first move
        // Look for any element containing "No moves yet" text, regardless of class
        const noMovesElements = Array.from(recentMoves.children).filter(el => 
            el.textContent.trim() === 'No moves yet'
        );
        noMovesElements.forEach(el => {
            el.remove();
        });
        
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.innerHTML = `
            <span class="move-num">${moveNumber}.</span>
            <span class="move-desc">${description}</span>
        `;
        
        // Add to top
        recentMoves.insertBefore(moveItem, recentMoves.firstChild);
        
        // Keep only last 5 moves (excluding the no-moves placeholder)
        let moveItems = recentMoves.querySelectorAll('.move-item');
        while (moveItems.length > 5) {
            const lastMoveItem = recentMoves.querySelector('.move-item:last-child');
            if (lastMoveItem) {
                recentMoves.removeChild(lastMoveItem);
                moveItems = recentMoves.querySelectorAll('.move-item'); // Refresh the list
            } else {
                break; // Safety break if no more move items
            }
        }
        

    }

    clearRecentMoves() {
        const recentMoves = document.getElementById('recent-moves');
        recentMoves.innerHTML = '<div class="no-moves">No moves yet</div>';
    }

    toggleAI(enabled) {
        console.log('toggleAI called with:', enabled);
        
        const statusText = document.getElementById('ai-status-text');
        if (statusText) {
            statusText.textContent = enabled ? 'AI On' : 'AI Off';
        }
        
        // Enable/disable difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
        });
        
        // Update global AI state - access the actual global variable from script.js
        try {
            window.aiEnabled = enabled;
            // Also update the global scope variable directly
            if (typeof window.eval !== 'undefined') {
                window.eval('aiEnabled = ' + enabled);
            }
            console.log('Global aiEnabled set to:', enabled);
        } catch (e) {
            console.error('Error setting global aiEnabled:', e);
        }
        
        // Update hidden AI toggle button for script.js compatibility
        const hiddenToggle = document.getElementById('ai-toggle');
        if (hiddenToggle) {
            hiddenToggle.checked = enabled;
        }
        
        // Update AI display but preserve our switch state
        const switchState = enabled;
        // Don't call updateAIDisplay here to prevent cascade calls
        // if (typeof window.updateAIDisplay === 'function') {
        //     window.updateAIDisplay();
        // }
        
        // Ensure switch state is preserved after updateAIDisplay
        setTimeout(() => {
            const aiSwitchElement = document.getElementById('ai-switch');
            if (aiSwitchElement && aiSwitchElement.checked !== switchState) {
                console.log('Restoring switch state from', aiSwitchElement.checked, 'to', switchState);
                aiSwitchElement.checked = switchState;
            }
        }, 0);
        
        // Trigger AI move if it's AI's turn
        if (enabled && typeof currentPlayer !== 'undefined' && 
            typeof aiPlayer !== 'undefined' && 
            currentPlayer === aiPlayer &&
            typeof makeAIMove === 'function') {
            console.log('Triggering AI move for player:', currentPlayer, 'AI player:', aiPlayer);
            // Clear any pending AI moves and use controlled timeout
            if (window.aiMoveTimeout) {
                clearTimeout(window.aiMoveTimeout);
            }
            window.aiThinking = false;
            window.aiMoveTimeout = setTimeout(makeAIMove, 300);
        }
        
        // Show notification
        this.showNotification(enabled ? 'AI enabled' : 'AI disabled', 'info');
    }

    setDifficulty(level) {
        // Update desktop difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });
        
        // Update mobile difficulty buttons
        document.querySelectorAll('.mobile-diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });
        
        // Update global AI difficulty
        if (typeof window.aiDifficulty !== 'undefined') {
            window.aiDifficulty = level;
        }
        
        // Update AI display
        // Don't call updateAIDisplay here to prevent cascade calls
        // if (typeof window.updateAIDisplay === 'function') {
        //     window.updateAIDisplay();
        // }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '600',
            zIndex: '9999',
            animation: 'slideIn 0.3s ease',
            maxWidth: '300px'
        });
        
        // Set background color based on type
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    handleUndo() {
        if (typeof window.undoMove === 'function') {
            const success = window.undoMove();
            if (success) {
                this.showNotification('Move undone', 'info');
            } else {
                this.showNotification('Nothing to undo', 'warning');
            }
        }
    }

    handleRedo() {
        if (typeof window.redoMove === 'function') {
            const success = window.redoMove();
            if (success) {
                this.showNotification('Move redone', 'info');
            } else {
                this.showNotification('Nothing to redo', 'warning');
            }
        }
    }

    handleSave() {
        // Trigger save functionality
        if (typeof window.saveGame === 'function') {
            window.saveGame();
        } else if (typeof openSaveLoadModal === 'function') {
            openSaveLoadModal();
        }
    }

    handleLoad() {
        // Trigger load functionality  
        if (typeof window.loadGame === 'function') {
            window.loadGame();
        } else if (typeof openSaveLoadModal === 'function') {
            openSaveLoadModal('load');
        }
    }

    handleReset() {
        // Trigger reset game functionality with confirmation
        if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
            if (typeof window.resetGame === 'function') {
                window.resetGame();
                this.showNotification('Game reset successfully', 'success');
            }
        }
    }



    handleResize() {
        // Close panels on mobile orientation change
        if (window.innerWidth <= 768) {
            this.closeAllPanels();
        }
    }
    
    updateMobileAIStatus(enabled) {
        const statusText = document.getElementById('mobile-ai-status-text');
        if (statusText) {
            statusText.textContent = enabled ? 'AI On' : 'AI Off';
        }
    }
    
    syncMobileDifficulty(level) {
        // Update mobile difficulty buttons
        document.querySelectorAll('.mobile-diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });
    }
    
    syncDesktopDifficulty(level) {
        // Update desktop difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });
    }
    
    updateMobileStats(moves, captures, haji) {
        document.getElementById('mobile-move-count').textContent = moves;
        document.getElementById('mobile-capture-count').textContent = captures;
        document.getElementById('mobile-haji-count').textContent = haji;
    }
    
    addMobileRecentMove(moveNumber, description) {
        const mobileRecentMoves = document.getElementById('mobile-moves-list');
        if (!mobileRecentMoves) return;
        
        // Clear the "No moves yet" placeholder
        const noMovesElements = Array.from(mobileRecentMoves.children).filter(el => 
            el.textContent.trim() === 'No moves yet'
        );
        noMovesElements.forEach(el => el.remove());
        
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.innerHTML = `
            <span class="move-num">${moveNumber}.</span>
            <span class="move-desc">${description}</span>
        `;
        
        // Add to top
        mobileRecentMoves.insertBefore(moveItem, mobileRecentMoves.firstChild);
        
        // Keep only last 3 moves (mobile has less space)
        let moveItems = mobileRecentMoves.querySelectorAll('.move-item');
        while (moveItems.length > 3) {
            const lastMoveItem = mobileRecentMoves.querySelector('.move-item:last-child');
            if (lastMoveItem) {
                mobileRecentMoves.removeChild(lastMoveItem);
                moveItems = mobileRecentMoves.querySelectorAll('.move-item');
            } else {
                break;
            }
        }
    }
    
    clearMobileRecentMoves() {
        const mobileRecentMoves = document.getElementById('mobile-moves-list');
        if (mobileRecentMoves) {
            mobileRecentMoves.innerHTML = '<div class="no-moves">No moves yet</div>';
        }
    }

    // Duplicate methods removed to prevent conflicts

    updateUI() {
        // Initial UI state
        this.updateCurrentPlayer('Black');
        this.updateScore(12, 12);
        this.updateStats(0, 0, 0);
    }
}

// Add slide animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modernUI = new ModernUI();
});

// Export for use by other scripts
window.ModernUI = ModernUI;