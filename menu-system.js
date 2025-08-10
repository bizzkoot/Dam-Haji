/**
 * Menu System - Handles all slide-out panels and menu interactions
 * Manages: Game Menu, Move History Panel, Settings Panel
 */

class MenuSystem {
    constructor() {
        this.activePanel = null;
        this.overlay = document.getElementById('overlay');
        
        this.initializeEventListeners();
        this.initializePanels();
    }

    initializeEventListeners() {
        // Top navigation buttons
        document.getElementById('menu-btn')?.addEventListener('click', () => {
            console.log('MenuSystem: Menu button clicked');
            this.togglePanel('menu-panel');
        });

        document.getElementById('history-btn')?.addEventListener('click', () => {
            console.log('MenuSystem: History button clicked');
            this.togglePanel('history-panel');
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => {
            console.log('MenuSystem: Settings button clicked');
            this.togglePanel('settings-panel');
        });

        // Close buttons on panels
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('MenuSystem: Close button clicked');
                const targetPanel = e.target.getAttribute('data-target');
                console.log('MenuSystem: Target panel:', targetPanel);
                if (targetPanel) {
                    this.closePanel(targetPanel);
                } else {
                    // If no specific target, close active panel
                    this.closeAllPanels();
                }
            });
        });

        // Overlay click to close
        this.overlay?.addEventListener('click', () => {
            this.closeAllPanels();
        });

        // ESC key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activePanel) {
                this.closeAllPanels();
            }
        });

        // Debug logging
        console.log('MenuSystem: Event listeners initialized');
    }

    initializePanels() {
        // Ensure all panels start hidden
        const panels = ['menu-panel', 'history-panel', 'settings-panel'];
        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('hidden');
            }
        });
    }

    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        if (this.activePanel === panelId) {
            // Close if already open
            this.closePanel(panelId);
        } else {
            // Close any other open panel first
            if (this.activePanel) {
                this.closePanel(this.activePanel);
            }
            // Open the requested panel
            this.openPanel(panelId);
        }
    }

    openPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        // Show overlay
        this.overlay?.classList.remove('hidden');
        this.overlay?.classList.add('active');
        
        // Show panel with animation
        panel.classList.remove('hidden');
        panel.style.display = 'block';
        
        // Trigger slide-in animation (CSS will handle this)
        requestAnimationFrame(() => {
            panel.classList.add('slide-in');
            panel.classList.add('active');
        });

        this.activePanel = panelId;

        // Populate panel content if needed
        this.populatePanelContent(panelId);
    }

    closePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        // Trigger slide-out animation
        panel.classList.remove('slide-in');
        panel.classList.remove('active');
        panel.classList.add('slide-out');

        // Hide panel after animation
        setTimeout(() => {
            panel.classList.add('hidden');
            panel.classList.remove('slide-out');
            panel.style.display = 'none';
        }, 300); // Match CSS transition duration

        // Hide overlay if no panels are open
        this.overlay?.classList.add('hidden');
        this.overlay?.classList.remove('active');
        this.activePanel = null;
    }

    closeAllPanels() {
        if (this.activePanel) {
            this.closePanel(this.activePanel);
        }
    }

    populatePanelContent(panelId) {
        switch (panelId) {
            case 'menu-panel':
                this.setupMenuActions();
                break;
            case 'history-panel':
                this.updateMoveHistory();
                break;
            case 'settings-panel':
                this.updateSettingsDisplay();
                break;
        }
    }

    setupMenuActions() {
        // Get all menu items and attach event listeners
        const menuItems = document.querySelectorAll('#menu-panel .menu-item');
        
        menuItems.forEach(item => {
            // Remove existing listeners to prevent duplicates
            item.replaceWith(item.cloneNode(true));
        });

        // Re-select after cloning
        const refreshedMenuItems = document.querySelectorAll('#menu-panel .menu-item');
        
        refreshedMenuItems.forEach(item => {
            const text = item.textContent.trim();
            
            item.addEventListener('click', () => {
                this.handleMenuAction(text);
                this.closePanel('menu-panel');
            });
        });
    }

    handleMenuAction(action) {
        switch (action) {
            case 'New Game':
                if (typeof window.resetGame === 'function') {
                    if (confirm('Start a new game? Current progress will be lost.')) {
                        window.resetGame();
                        this.showNotification('New game started!', 'success');
                    }
                }
                break;
                
            case 'Save Game':
                if (typeof window.openSaveLoadModal === 'function') {
                    window.openSaveLoadModal('save');
                } else {
                    this.showNotification('Save functionality not available', 'error');
                }
                break;
                
            case 'Load Game':
                if (typeof window.openSaveLoadModal === 'function') {
                    window.openSaveLoadModal('load');
                } else {
                    this.showNotification('Load functionality not available', 'error');
                }
                break;
                
            case 'Board Theme':
                this.showNotification('Theme settings coming soon!', 'info');
                break;
                
            case 'Sound Effects':
                this.showNotification('Sound settings coming soon!', 'info');
                break;
                
            case 'Animations':
                this.showNotification('Animation settings coming soon!', 'info');
                break;
                
            default:
                console.log('Unknown menu action:', action);
        }
    }

    updateMoveHistory() {
        const historyList = document.getElementById('move-history-list');
        if (!historyList) return;

        // Clear existing content
        historyList.innerHTML = '';

        // Get move history from game
        const moveHistory = window.moveHistory || [];
        
        if (moveHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">No moves yet</div>';
            return;
        }

        // Create history entries
        moveHistory.forEach((move, index) => {
            const moveEntry = document.createElement('div');
            moveEntry.className = 'history-entry';
            
            const playerClass = move.player === 'B' ? 'black' : 'white';
            // Each move gets its own sequential number
            const moveNumber = index + 1;
            
            moveEntry.innerHTML = `
                <div class="move-number ${playerClass}">
                    ${moveNumber}.
                </div>
                <div class="move-notation ${playerClass}">
                    ${move.notation || this.generateMoveNotation(move)}
                    ${move.isCapture ? ' ✕' : ''}
                    ${move.isHajiPromotion ? ' ♔' : ''}
                </div>
                <div class="move-timestamp">
                    ${move.timestamp ? new Date(move.timestamp).toLocaleTimeString() : ''}
                </div>
            `;

            historyList.appendChild(moveEntry);
        });

        // Scroll to bottom
        historyList.scrollTop = historyList.scrollHeight;
    }
    
    generateMoveNotation(move) {
        if (!move) return '';
        
        // Convert row/col numbers to chess notation (A1, B2, etc.)
        const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const from = `${colLabels[move.startCol]}${move.startRow + 1}`;
        const to = `${colLabels[move.endCol]}${move.endRow + 1}`;
        
        return `${from} → ${to}`;
    }

    updateSettingsDisplay() {
        // This will be handled by the settings system
        // Just ensure the panel is ready
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.classList.add('settings-ready');
        }
        
        // Trigger settings system to refresh if available
        if (window.settingsSystem?.refreshSettingsDisplay) {
            window.settingsSystem.refreshSettingsDisplay();
        }
    }

    showNotification(message, type = 'info') {
        // Use the V2 UI notification system if available
        if (window.gameIntegration?.modernUI?.showNotification) {
            window.gameIntegration.modernUI.showNotification(message, type);
        } else {
            // Fallback to simple alert
            alert(message);
        }
    }

    // Public method to refresh move history from external calls
    refreshMoveHistory() {
        if (this.activePanel === 'history-panel') {
            this.updateMoveHistory();
        }
    }

    // Public method to check if any panel is open
    isPanelOpen() {
        return this.activePanel !== null;
    }
}

// Global instance
// window.menuSystem = new MenuSystem();
// console.log("MenuSystem disabled to prevent conflict with ModernUI");

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuSystem;
}