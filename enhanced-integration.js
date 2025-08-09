/**
 * Enhanced Integration - Connects all new UI systems with existing game logic
 * Manages cross-system communication and event coordination
 */

class EnhancedIntegration {
    constructor() {
        this.systems = {};
        this.initialized = false;
        
        // Wait for DOM and all systems to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        if (this.initialized) return;
        
        // Wait a moment for all systems to initialize
        setTimeout(() => {
            this.registerSystems();
            this.setupEventBridge();
            this.integrateWithGameLogic();
            this.initialized = true;
            console.log('Enhanced UI Integration initialized successfully');
        }, 500);
    }

    registerSystems() {
        // Register all available systems with retries
        this.systems = {
            notifications: window.notificationSystem,
            menu: window.menuSystem,
            settings: window.settingsSystem,
            history: window.historySystem,
            modernUI: window.gameIntegration?.modernUI
        };

        // Wait for gameIntegration to be ready
        if (!this.systems.modernUI && window.gameIntegration) {
            this.systems.modernUI = window.gameIntegration.modernUI;
        }

        // Verify systems are available
        Object.entries(this.systems).forEach(([name, system]) => {
            if (!system) {
                console.warn(`System '${name}' not available`);
            } else {
                console.log(`System '${name}' registered successfully`);
            }
        });
    }

    setupEventBridge() {
        // Bridge game events to new systems
        this.bridgeGameEvents();
        this.bridgeUIEvents();
        this.bridgeSystemEvents();
    }

    bridgeGameEvents() {
        // Don't override functions that are already overridden by integration-v2.js
        // This prevents cascading override loops that cause performance issues
        
        // Only add event listeners without overriding existing functions
        document.addEventListener('moveAdded', (e) => {
            // Handle move events
            if (this.systems.notifications) {
                const { player, moveDesc, isCapture, isHaji } = e.detail;
                this.systems.notifications.moveNotification(
                    player, 
                    moveDesc, 
                    isCapture, 
                    isHaji
                );
            }
        });

        // Listen for game events instead of overriding functions
        document.addEventListener('gameReset', (e) => {
            // Notify all systems
            if (this.systems.notifications) {
                this.systems.notifications.gameStatusNotification('New game started!', 'success');
            }
        });
        
        document.addEventListener('aiThinking', (e) => {
            if (this.systems.notifications) {
                this.systems.notifications.aiNotification('AI is thinking...', true);
            }
        });
        
        document.addEventListener('aiMoveCompleted', (e) => {
            if (this.systems.notifications) {
                this.systems.notifications.aiNotification('AI move completed', false);
            }
        });
    }

    bridgeUIEvents() {
        // Bridge panel events
        const originalTogglePanel = this.systems.menu?.togglePanel;
        if (originalTogglePanel && this.systems.menu) {
            const menuSystem = this.systems.menu;
            const originalMethod = originalTogglePanel.bind(menuSystem);
            
            menuSystem.togglePanel = function(panelId) {
                const wasOpen = this.activePanel;
                originalMethod(panelId);
                
                // Dispatch panel events
                if (this.activePanel && this.activePanel !== wasOpen) {
                    document.dispatchEvent(new CustomEvent('panelOpened', {
                        detail: { panelId: this.activePanel }
                    }));
                }
                
                if (!this.activePanel && wasOpen) {
                    document.dispatchEvent(new CustomEvent('panelClosed', {
                        detail: { panelId: wasOpen }
                    }));
                }
            };
        }
    }

    bridgeSystemEvents() {
        // Listen for setting changes and update game
        document.addEventListener('settingChanged', (e) => {
            const { key, value } = e.detail;
            
            switch (key) {
                case 'aiEnabled':
                    if (typeof window.toggleAI === 'function') {
                        window.toggleAI(value);
                    }
                    break;
                    
                case 'aiDifficulty':
                    if (typeof window.setAIDifficulty === 'function') {
                        window.setAIDifficulty(value);
                    }
                    break;
            }
        });

        // Listen for history navigation in analysis mode
        document.addEventListener('historyNavigated', (e) => {
            if (this.systems.history?.isAnalysisMode) {
                // Update UI to show we're in analysis mode
                if (this.systems.notifications) {
                    const moveNumber = e.detail.moveIndex + 1;
                    this.systems.notifications.info(`Viewing move ${moveNumber}`, {
                        duration: 1000,
                        id: 'analysis_position'
                    });
                }
            }
        });

        // Listen for notification clicks to close panels
        document.addEventListener('click', (e) => {
            if (e.target.closest('.notification') && this.systems.menu?.isPanelOpen()) {
                // Auto-close panels when user interacts with notifications
                // This prevents UI conflicts
            }
        });
    }

    integrateWithGameLogic() {
        // Enhance existing V2 UI integration
        if (this.systems.modernUI) {
            this.enhanceModernUI();
        }

        // Add keyboard shortcuts
        this.addKeyboardShortcuts();
        
        // Sync initial state
        this.syncInitialState();
    }

    enhanceModernUI() {
        const modernUI = this.systems.modernUI;
        
        // Override showNotification to use new notification system
        const originalShowNotification = modernUI.showNotification;
        modernUI.showNotification = (message, type = 'info', duration = 4000) => {
            if (this.systems.notifications) {
                return this.systems.notifications.show(message, type, { duration });
            } else {
                return originalShowNotification.call(modernUI, message, type, duration);
            }
        };

        // Enhance updateStats to trigger events
        const originalUpdateStats = modernUI.updateStats;
        modernUI.updateStats = (moves, captures, haji) => {
            originalUpdateStats.call(modernUI, moves, captures, haji);
            
            document.dispatchEvent(new CustomEvent('statsUpdated', {
                detail: { moves, captures, haji }
            }));
        };
    }

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    if (this.systems.menu?.isPanelOpen()) {
                        this.systems.menu.closeAllPanels();
                    }
                    break;
                    
                case 'm':
                case 'M':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.systems.menu?.togglePanel('menu-panel');
                    }
                    break;
                    
                case 'h':
                case 'H':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.systems.menu?.togglePanel('history-panel');
                    }
                    break;
                    
                case ',':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.systems.menu?.togglePanel('settings-panel');
                    }
                    break;
                    
                case 'ArrowLeft':
                    if (e.ctrlKey && this.systems.history) {
                        e.preventDefault();
                        const currentIndex = this.systems.history.currentMoveIndex;
                        this.systems.history.goToMove(currentIndex - 1);
                    }
                    break;
                    
                case 'ArrowRight':
                    if (e.ctrlKey && this.systems.history) {
                        e.preventDefault();
                        const currentIndex = this.systems.history.currentMoveIndex;
                        this.systems.history.goToMove(currentIndex + 1);
                    }
                    break;
            }
        });
    }

    syncInitialState() {
        // Sync settings with current game state
        if (this.systems.settings && window.aiEnabled !== undefined) {
            this.systems.settings.updateSetting('aiEnabled', window.aiEnabled);
        }
        
        if (this.systems.settings && window.aiDifficulty !== undefined) {
            this.systems.settings.updateSetting('aiDifficulty', window.aiDifficulty);
        }

        // Initialize history with existing moves
        if (this.systems.history && window.moveHistory && window.moveHistory.length > 0) {
            window.moveHistory.forEach(move => {
                document.dispatchEvent(new CustomEvent('moveAdded', {
                    detail: {
                        ...move,
                        player: move.player === 'B' ? 'Black' : 'White',
                        timestamp: move.timestamp || Date.now()
                    }
                }));
            });
        }

        // Show welcome notification
        if (this.systems.notifications) {
            this.systems.notifications.info('Welcome to Dam Haji!', {
                title: 'Game Ready',
                duration: 3000
            });
        }
    }

    // Public API methods
    getSystem(name) {
        return this.systems[name];
    }

    isSystemAvailable(name) {
        return !!this.systems[name];
    }

    showNotification(message, type = 'info', options = {}) {
        if (this.systems.notifications) {
            return this.systems.notifications.show(message, type, options);
        }
    }

    openPanel(panelId) {
        if (this.systems.menu) {
            this.systems.menu.togglePanel(panelId);
        }
    }

    updateSetting(key, value) {
        if (this.systems.settings) {
            this.systems.settings.updateSetting(key, value);
        }
    }

    exportGame() {
        if (this.systems.history) {
            this.systems.history.exportHistory();
        }
    }

    // Debug methods
    debugInfo() {
        return {
            initialized: this.initialized,
            systems: Object.keys(this.systems).reduce((acc, key) => {
                acc[key] = !!this.systems[key];
                return acc;
            }, {}),
            gameState: {
                currentPlayer: window.currentPlayer,
                aiEnabled: window.aiEnabled,
                moveCount: window.moveHistory?.length || 0
            }
        };
    }
}

// Initialize the enhanced integration
window.enhancedIntegration = new EnhancedIntegration();

// Add to debug modal if available
if (window.addDebugButton) {
    window.addDebugButton('System Info', () => {
        console.log('Enhanced Integration Debug Info:', window.enhancedIntegration.debugInfo());
        window.enhancedIntegration.showNotification('Debug info logged to console', 'info');
    });
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedIntegration;
}