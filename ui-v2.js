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
        this.initLayoutEngine(); // Use the new layout engine
    }

    initializeGameDisplay() {
        // Only initialize if there are no moves already
        const moveHistoryExists = window.moveHistory && window.moveHistory.length > 0;
        if (!moveHistoryExists) {
            this.clearRecentMoves();
            this.updateStats(0, 0, 0);
        }
    }

    setupEventListeners() {
        // Top navigation buttons
        document.getElementById('menu-btn')?.addEventListener('click', () => this.togglePanel('menu-panel'));
        document.getElementById('history-btn')?.addEventListener('click', () => this.togglePanel('history-panel'));
        document.getElementById('settings-btn')?.addEventListener('click', () => this.togglePanel('settings-panel'));

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
                this.toggleAI(e.target.checked);
                const mobileSwitch = document.getElementById('mobile-ai-switch');
                if (mobileSwitch) {
                    mobileSwitch.checked = e.target.checked;
                    this.updateMobileAIStatus(e.target.checked);
                }
            });
        }
        
        // AI toggle (mobile)
        const mobileAiSwitchElement = document.getElementById('mobile-ai-switch');
        if (mobileAiSwitchElement) {
            mobileAiSwitchElement.addEventListener('change', (e) => {
                this.toggleAI(e.target.checked);
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
        document.getElementById('mobile-undo-btn')?.addEventListener('click', () => this.handleUndo());
        document.getElementById('mobile-redo-btn')?.addEventListener('click', () => this.handleRedo());
        document.getElementById('mobile-save-btn')?.addEventListener('click', () => this.handleSave());
        document.getElementById('mobile-load-btn')?.addEventListener('click', () => this.handleLoad());
        document.getElementById('mobile-reset-btn')?.addEventListener('click', () => this.handleReset());

        // Close buttons for slide panels
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetPanel = btn.dataset.target;
                if (targetPanel) this.closePanel(targetPanel);
            });
        });

        // Overlay click to close panels
        document.getElementById('overlay')?.addEventListener('click', () => this.closeAllPanels());

        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllPanels();
        });
    }

    setupPanels() {
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
        this.closeAllPanels();
        if (!panel.isOpen) this.openPanel(panelId);
    }

    openPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        panel.element.classList.add('active');
        panel.isOpen = true;
        document.getElementById('overlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        panel.element.classList.remove('active');
        panel.isOpen = false;
        const anyOpen = Array.from(this.panels.values()).some(p => p.isOpen);
        if (!anyOpen) {
            document.getElementById('overlay').classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    closeAllPanels() {
        this.panels.forEach((panel, panelId) => {
            if (panel.isOpen) this.closePanel(panelId);
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
        const noMovesElements = Array.from(recentMoves.children).filter(el => el.textContent.trim() === 'No moves yet');
        noMovesElements.forEach(el => el.remove());
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.innerHTML = `<span class="move-num">${moveNumber}.</span><span class="move-desc">${description}</span>`;
        recentMoves.insertBefore(moveItem, recentMoves.firstChild);
        let moveItems = recentMoves.querySelectorAll('.move-item');
        while (moveItems.length > 5) {
            const lastMoveItem = recentMoves.querySelector('.move-item:last-child');
            if (lastMoveItem) {
                recentMoves.removeChild(lastMoveItem);
                moveItems = recentMoves.querySelectorAll('.move-item');
            } else {
                break;
            }
        }
    }

    clearRecentMoves() {
        document.getElementById('recent-moves').innerHTML = '<div class="no-moves">No moves yet</div>';
    }

    toggleAI(enabled) {
        const statusText = document.getElementById('ai-status-text');
        if (statusText) statusText.textContent = enabled ? 'AI On' : 'AI Off';
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
        });
        // Update global variable directly
        window.aiEnabled = enabled;
        aiEnabled = enabled; // Also update in current scope if different
        const hiddenToggle = document.getElementById('ai-toggle');
        if (hiddenToggle) hiddenToggle.checked = enabled;
        if (enabled && typeof currentPlayer !== 'undefined' && typeof aiPlayer !== 'undefined' && currentPlayer === aiPlayer && typeof makeAIMove === 'function') {
            if (window.aiMoveTimeout) clearTimeout(window.aiMoveTimeout);
            window.aiThinking = false;
            window.aiMoveTimeout = setTimeout(makeAIMove, 300);
        }
        this.showNotification(enabled ? 'AI enabled' : 'AI disabled', 'info');
    }

    setDifficulty(level) {
        document.querySelectorAll('.diff-btn, .mobile-diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) btn.classList.add('active');
        });
        // Update global variable directly
        window.aiDifficulty = level;
        aiDifficulty = level; // Also update in current scope if different
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        Object.assign(notification.style, { position: 'fixed', top: '20px', right: '20px', padding: '12px 16px', borderRadius: '6px', color: 'white', fontWeight: '600', zIndex: '9999', animation: 'slideIn 0.3s ease', maxWidth: '300px' });
        const colors = { info: '#3498db', success: '#27ae60', warning: '#f39c12', error: '#e74c3c' };
        notification.style.backgroundColor = colors[type] || colors.info;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) notification.parentNode.removeChild(notification);
            }, 300);
        }, 3000);
    }

    handleUndo() {
        if (typeof window.undoMove === 'function') {
            const success = window.undoMove();
            this.showNotification(success ? 'Move undone' : 'Nothing to undo', success ? 'info' : 'warning');
        }
    }

    handleRedo() {
        if (typeof window.redoMove === 'function') {
            const success = window.redoMove();
            this.showNotification(success ? 'Move redone' : 'Nothing to redo', success ? 'info' : 'warning');
        }
    }

    handleSave() {
        if (typeof openSaveLoadModal === 'function') openSaveLoadModal();
    }

    handleLoad() {
        if (typeof openSaveLoadModal === 'function') openSaveLoadModal('load');
    }

    handleReset() {
        if (confirm('Are you sure you want to reset the game? This will clear all progress.')) {
            if (typeof window.resetGame === 'function') {
                window.resetGame();
                this.showNotification('Game reset successfully', 'success');
            }
        }
    }
    
    updateMobileAIStatus(enabled) {
        const statusText = document.getElementById('mobile-ai-status-text');
        if (statusText) statusText.textContent = enabled ? 'AI On' : 'AI Off';
    }
    
    syncMobileDifficulty(level) {
        document.querySelectorAll('.mobile-diff-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) btn.classList.add('active');
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
        const noMovesElements = Array.from(mobileRecentMoves.children).filter(el => el.textContent.trim() === 'No moves yet');
        noMovesElements.forEach(el => el.remove());
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.innerHTML = `<span class="move-num">${moveNumber}.</span><span class="move-desc">${description}</span>`;
        mobileRecentMoves.insertBefore(moveItem, mobileRecentMoves.firstChild);
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
        if (mobileRecentMoves) mobileRecentMoves.innerHTML = '<div class="no-moves">No moves yet</div>';
    }

    updateUI() {
        this.updateCurrentPlayer('Black');
        this.updateScore(12, 12);
        this.updateStats(0, 0, 0);
    }
    
    // --- START: New Layout Engine ---
    
    setStaticMobileLayout() {
        if (window.innerWidth > 768) {
            const gameInfo = document.getElementById('mobile-game-info');
            if (gameInfo) gameInfo.style.height = '';
            return;
        }
        requestAnimationFrame(() => {
            const topNav = document.getElementById('top-nav');
            const aiControls = document.getElementById('mobile-ai-controls');
            const actionButtons = document.getElementById('mobile-action-buttons');
            const boardContainer = document.getElementById('board-container');
            const gameInfo = document.getElementById('mobile-game-info');
            if (!topNav || !aiControls || !actionButtons || !boardContainer || !gameInfo) return;
            const viewportHeight = window.innerHeight;
            const topNavHeight = topNav.offsetHeight;
            const aiControlsHeight = aiControls.offsetHeight + 8;
            const actionButtonsHeight = actionButtons.offsetHeight + 16;
            const boardHeight = boardContainer.offsetWidth;
            const remainingHeight = viewportHeight - (topNavHeight + aiControlsHeight + boardHeight + actionButtonsHeight);
            const minHeight = 60;
            gameInfo.style.height = `${Math.max(remainingHeight, minHeight)}px`;
        });
    }

    initLayoutEngine() {
        this.setStaticMobileLayout();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.setStaticMobileLayout(), 100);
        });
    }
    
    // --- END: New Layout Engine ---
}

// Add slide animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.modernUI = new ModernUI();
});

// Export for use by other scripts
window.ModernUI = ModernUI;
