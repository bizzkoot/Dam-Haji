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

        // Board theme selector
        const boardThemeSelect = document.getElementById('board-theme');
        if (boardThemeSelect) {
            boardThemeSelect.addEventListener('change', (e) => {
                this.updateSetting('boardTheme', e.target.value);
            });
        }

        // Sound effects toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                this.updateSetting('soundEffects', e.target.checked);
            });
        }

        // Animations toggle
        const animationsToggle = document.getElementById('animations-toggle');
        if (animationsToggle) {
            animationsToggle.addEventListener('change', (e) => {
                this.updateSetting('animations', e.target.checked);
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
        } else {
            gameBoard.classList.remove('show-coordinates');
        }
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

        // Update board theme selector
        const boardThemeSelect = document.getElementById('board-theme');
        if (boardThemeSelect) {
            boardThemeSelect.value = this.settings.boardTheme;
        }

        // Update sound effects toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.checked = this.settings.soundEffects;
        }

        // Update animations toggle
        const animationsToggle = document.getElementById('animations-toggle');
        if (animationsToggle) {
            animationsToggle.checked = this.settings.animations;
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

// Synthetic sound effects generator using HTML5 Web Audio API
class SoundSystem {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
        }
    }

    playSound(type) {
        if (!window.soundEffectsEnabled) return;
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        switch (type) {
            case 'move': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }
            case 'capture': {
                const osc1 = this.ctx.createOscillator();
                const gain1 = this.ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(320, now);
                osc1.frequency.exponentialRampToValueAtTime(160, now + 0.08);
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc1.connect(gain1);
                gain1.connect(this.ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.08);

                const osc2 = this.ctx.createOscillator();
                const gain2 = this.ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(480, now + 0.08);
                osc2.frequency.exponentialRampToValueAtTime(240, now + 0.16);
                gain2.gain.setValueAtTime(0.25, now + 0.08);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
                osc2.connect(gain2);
                gain2.connect(this.ctx.destination);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.16);
                break;
            }
            case 'promotion': {
                const notes = [261.63, 329.63, 392.00, 523.25];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + (idx * 0.08));
                    const time = now + (idx * 0.08);
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.15, time);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time);
                    osc.stop(time + 0.25);
                });
                break;
            }
            case 'win': {
                const notes = [329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + (idx * 0.1));
                    const time = now + (idx * 0.1);
                    gain.gain.setValueAtTime(0, now);
                    gain.gain.linearRampToValueAtTime(0.2, time);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time);
                    osc.stop(time + 0.4);
                });
                break;
            }
            case 'invalid': {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.15);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
                break;
            }
        }
    }
}
window.soundSystem = new SoundSystem();
document.addEventListener('click', () => {
    if (window.soundSystem) window.soundSystem.init();
}, { once: true });

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsSystem;
}