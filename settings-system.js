/**
 * Settings System - Handles all game settings and preferences
 * Manages: Board Size, Show Coordinates, Theme, Sound, Animations
 */

class SettingsSystem {
    constructor() {
        this.settings = {
            boardSize: 'medium',
            showCoordinates: false,
            boardTheme: 'classic',
            soundEffects: true,
            animations: true,
            aiEnabled: false,
            aiDifficulty: 'medium'
        };

        this.loadSettings();
        this.initializeEventListeners();
        this.applySettings();
    }

    initializeEventListeners() {
        // Board size selector
        const boardSizeSelect = document.getElementById('board-size');
        if (boardSizeSelect) {
            boardSizeSelect.addEventListener('change', (e) => {
                this.updateSetting('boardSize', e.target.value);
            });
        }

        // Show coordinates toggle
        const showCoordsToggle = document.getElementById('show-coords');
        if (showCoordsToggle) {
            showCoordsToggle.addEventListener('change', (e) => {
                this.updateSetting('showCoordinates', e.target.checked);
            });
        }

        // Listen for settings panel opens to refresh display
        document.addEventListener('panelOpened', (e) => {
            if (e.detail.panelId === 'settings-panel') {
                this.refreshSettingsDisplay();
            }
        });
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('damHaji_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }
        } catch (error) {
            console.warn('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('damHaji_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    updateSetting(key, value) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        // Apply the setting immediately
        this.applySetting(key, value);
        
        // Save to localStorage
        this.saveSettings();

        // Show notification
        this.showNotification(`${this.getSettingDisplayName(key)} updated`, 'success');

        // Dispatch event for other systems
        document.dispatchEvent(new CustomEvent('settingChanged', {
            detail: { key, value, oldValue }
        }));
    }

    applySetting(key, value) {
        switch (key) {
            case 'boardSize':
                this.applyBoardSize(value);
                break;
            case 'showCoordinates':
                this.applyShowCoordinates(value);
                break;
            case 'boardTheme':
                this.applyBoardTheme(value);
                break;
            case 'soundEffects':
                this.applySoundEffects(value);
                break;
            case 'animations':
                this.applyAnimations(value);
                break;
        }
    }

    applySettings() {
        // Apply all settings on initialization
        Object.keys(this.settings).forEach(key => {
            this.applySetting(key, this.settings[key]);
        });
        this.refreshSettingsDisplay();
    }

    applyBoardSize(size) {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        // Remove existing size classes
        gameBoard.classList.remove('board-small', 'board-medium', 'board-large');
        
        // Add new size class
        gameBoard.classList.add(`board-${size}`);

        // Update CSS custom property for board size
        const sizes = {
            small: '320px',
            medium: '400px',
            large: '480px'
        };

        document.documentElement.style.setProperty('--board-size', sizes[size] || sizes.medium);
    }

    applyShowCoordinates(show) {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        if (show) {
            gameBoard.classList.add('show-coordinates');
            this.addCoordinates();
        } else {
            gameBoard.classList.remove('show-coordinates');
            this.removeCoordinates();
        }
    }

    addCoordinates() {
        const gameBoard = document.getElementById('game-board');
        if (!gameBoard) return;

        // Remove existing coordinates
        this.removeCoordinates();

        // Add row labels (1-8)
        for (let row = 0; row < 8; row++) {
            const rowLabel = document.createElement('div');
            rowLabel.className = 'coordinate-label row-label';
            rowLabel.textContent = 8 - row;
            rowLabel.style.position = 'absolute';
            rowLabel.style.left = '-20px';
            rowLabel.style.top = `${row * 12.5}%`;
            rowLabel.style.height = '12.5%';
            rowLabel.style.display = 'flex';
            rowLabel.style.alignItems = 'center';
            rowLabel.style.fontSize = '12px';
            rowLabel.style.color = '#666';
            gameBoard.appendChild(rowLabel);
        }

        // Add column labels (a-h)
        for (let col = 0; col < 8; col++) {
            const colLabel = document.createElement('div');
            colLabel.className = 'coordinate-label col-label';
            colLabel.textContent = String.fromCharCode(97 + col); // a, b, c, etc.
            colLabel.style.position = 'absolute';
            colLabel.style.top = '100%';
            colLabel.style.left = `${col * 12.5}%`;
            colLabel.style.width = '12.5%';
            colLabel.style.display = 'flex';
            colLabel.style.justifyContent = 'center';
            colLabel.style.fontSize = '12px';
            colLabel.style.color = '#666';
            colLabel.style.marginTop = '2px';
            gameBoard.appendChild(colLabel);
        }
    }

    removeCoordinates() {
        const coordinateLabels = document.querySelectorAll('.coordinate-label');
        coordinateLabels.forEach(label => label.remove());
    }

    applyBoardTheme(theme) {
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('theme-classic', 'theme-modern', 'theme-dark');
        
        // Add new theme class
        body.classList.add(`theme-${theme}`);
    }

    applySoundEffects(enabled) {
        // Store sound setting for game logic to use
        window.soundEffectsEnabled = enabled;
        
        // Dispatch event for sound system
        document.dispatchEvent(new CustomEvent('soundSettingChanged', {
            detail: { enabled }
        }));
    }

    applyAnimations(enabled) {
        const body = document.body;
        
        if (enabled) {
            body.classList.remove('no-animations');
        } else {
            body.classList.add('no-animations');
        }
    }

    refreshSettingsDisplay() {
        // Update board size selector
        const boardSizeSelect = document.getElementById('board-size');
        if (boardSizeSelect) {
            boardSizeSelect.value = this.settings.boardSize;
        }

        // Update show coordinates toggle
        const showCoordsToggle = document.getElementById('show-coords');
        if (showCoordsToggle) {
            showCoordsToggle.checked = this.settings.showCoordinates;
        }
    }

    getSettingDisplayName(key) {
        const displayNames = {
            boardSize: 'Board Size',
            showCoordinates: 'Show Coordinates',
            boardTheme: 'Board Theme',
            soundEffects: 'Sound Effects',
            animations: 'Animations'
        };
        return displayNames[key] || key;
    }

    showNotification(message, type = 'info') {
        // Use the V2 UI notification system if available
        if (window.gameIntegration?.modernUI?.showNotification) {
            window.gameIntegration.modernUI.showNotification(message, type);
        } else {
            console.log(`Settings: ${message}`);
        }
    }

    // Public methods
    getSetting(key) {
        return this.settings[key];
    }

    getSettings() {
        return { ...this.settings };
    }

    resetToDefaults() {
        const defaultSettings = {
            boardSize: 'medium',
            showCoordinates: false,
            boardTheme: 'classic',
            soundEffects: true,
            animations: true,
            aiEnabled: false,
            aiDifficulty: 'medium'
        };

        this.settings = { ...defaultSettings };
        this.applySettings();
        this.saveSettings();
        this.showNotification('Settings reset to defaults', 'success');
    }

    exportSettings() {
        try {
            const settingsJson = JSON.stringify(this.settings, null, 2);
            const blob = new Blob([settingsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dam-haji-settings.json';
            a.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('Settings exported', 'success');
        } catch (error) {
            this.showNotification('Failed to export settings', 'error');
        }
    }

    importSettings(file) {
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedSettings = JSON.parse(e.target.result);
                    this.settings = { ...this.settings, ...importedSettings };
                    this.applySettings();
                    this.saveSettings();
                    this.showNotification('Settings imported successfully', 'success');
                } catch (parseError) {
                    this.showNotification('Invalid settings file', 'error');
                }
            };
            reader.readAsText(file);
        } catch (error) {
            this.showNotification('Failed to import settings', 'error');
        }
    }
}

// Global instance
window.settingsSystem = new SettingsSystem();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsSystem;
}