/**
 * Notifications System - Enhanced user feedback and messaging
 * Manages: Toast notifications, Progress indicators, Status messages
 */

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 4000; // 4 seconds
        
        this.createNotificationContainer();
        this.initializeStyles();
    }

    createNotificationContainer() {
        // Create notification container if it doesn't exist
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        this.container = container;
    }

    initializeStyles() {
        // Add CSS styles for notifications if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification-container {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    z-index: 1000;
                    pointer-events: none;
                }

                .notification {
                    background: white;
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    border-left: 4px solid #ccc;
                    min-width: 280px;
                    max-width: 400px;
                    pointer-events: auto;
                    transform: translateX(100%);
                    opacity: 0;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .notification.show {
                    transform: translateX(0);
                    opacity: 1;
                }

                .notification.success {
                    border-left-color: #4caf50;
                    background: #f1f8e9;
                }

                .notification.error {
                    border-left-color: #f44336;
                    background: #ffebee;
                }

                .notification.warning {
                    border-left-color: #ff9800;
                    background: #fff3e0;
                }

                .notification.info {
                    border-left-color: #2196f3;
                    background: #e3f2fd;
                }

                .notification-icon {
                    font-size: 18px;
                    flex-shrink: 0;
                }

                .notification-content {
                    flex: 1;
                }

                .notification-title {
                    font-weight: bold;
                    margin-bottom: 2px;
                    font-size: 14px;
                }

                .notification-message {
                    font-size: 13px;
                    color: #666;
                    line-height: 1.4;
                }

                .notification-close {
                    background: none;
                    border: none;
                    font-size: 16px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                }

                .notification-close:hover {
                    background: rgba(0, 0, 0, 0.1);
                }

                .notification-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 2px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 0 0 8px 8px;
                    transition: width linear;
                }

                .notification.success .notification-progress {
                    background: #4caf50;
                }

                .notification.error .notification-progress {
                    background: #f44336;
                }

                .notification.warning .notification-progress {
                    background: #ff9800;
                }

                .notification.info .notification-progress {
                    background: #2196f3;
                }

                /* Mobile adjustments */
                @media (max-width: 768px) {
                    .notification-container {
                        left: 20px;
                        right: 20px;
                        top: 70px;
                    }

                    .notification {
                        min-width: auto;
                        max-width: none;
                    }
                }

                /* Animation for removal */
                .notification.removing {
                    transform: translateX(100%);
                    opacity: 0;
                    margin-bottom: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                    max-height: 0;
                }
            `;
            document.head.appendChild(style);
        }
    }

    show(message, type = 'info', options = {}) {
        const config = {
            duration: options.duration ?? this.defaultDuration,
            title: options.title,
            persistent: options.persistent || false,
            icon: options.icon,
            onClick: options.onClick,
            onClose: options.onClose,
            id: options.id || this.generateId()
        };

        // Remove existing notification with same ID if provided
        if (config.id) {
            this.remove(config.id);
        }

        // Create notification element
        const notification = this.createElement(message, type, config);
        
        // Manage notification count
        this.manageNotificationCount();
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push({ element: notification, config });

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-remove if not persistent
        if (!config.persistent && config.duration > 0) {
            this.scheduleRemoval(notification, config.duration);
        }

        return notification;
    }

    createElement(message, type, config) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = config.id;

        // Icon mapping
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = config.icon || icons[type] || icons.info;

        notification.innerHTML = `
            ${icon ? `<div class="notification-icon">${icon}</div>` : ''}
            <div class="notification-content">
                ${config.title ? `<div class="notification-title">${config.title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" title="Close">×</button>
            ${!config.persistent ? '<div class="notification-progress"></div>' : ''}
        `;

        // Add event listeners
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.remove(config.id);
            if (config.onClose) config.onClose();
        });

        if (config.onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', (e) => {
                if (!e.target.classList.contains('notification-close')) {
                    config.onClick();
                }
            });
        }

        return notification;
    }

    scheduleRemoval(notification, duration) {
        const progressBar = notification.querySelector('.notification-progress');
        
        if (progressBar) {
            // Animate progress bar
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0%';
                progressBar.style.transition = `width ${duration}ms linear`;
            }, 50);
        }

        setTimeout(() => {
            this.removeElement(notification);
        }, duration);
    }

    remove(id) {
        const notification = this.container.querySelector(`[data-id="${id}"]`);
        if (notification) {
            this.removeElement(notification);
        }
    }

    removeElement(notification) {
        notification.classList.add('removing');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            // Remove from tracking array
            this.notifications = this.notifications.filter(n => n.element !== notification);
        }, 300);
    }

    manageNotificationCount() {
        // Remove oldest notifications if exceeding limit
        while (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications[0];
            if (oldest) {
                this.removeElement(oldest.element);
            }
        }
    }

    generateId() {
        return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Convenience methods
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', options);
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    // Game-specific notification methods
    moveNotification(player, move, isCapture = false, isHaji = false) {
        let message = `${player} moves ${move}`;
        let icon = player === 'Black' ? '⚫' : '⚪';
        
        if (isCapture) {
            message += ' (Capture!)';
            icon += '✨';
        }
        
        if (isHaji) {
            message += ' (Haji!)';
            icon += '👑';
        }

        return this.show(message, 'info', { 
            icon, 
            duration: 2000,
            title: 'Move Made'
        });
    }

    gameStatusNotification(message, type = 'info') {
        return this.show(message, type, {
            title: 'Game Status',
            duration: 3000
        });
    }

    aiNotification(message, isThinking = false) {
        const options = {
            title: 'AI Player',
            icon: '🤖',
            duration: isThinking ? 0 : 2000, // Persistent while thinking
            persistent: isThinking,
            id: 'ai_status'
        };

        return this.show(message, 'info', options);
    }

    // Clear all notifications
    clear() {
        this.notifications.forEach(notification => {
            this.removeElement(notification.element);
        });
    }

    // Progress notifications for long operations
    showProgress(message, progress = 0) {
        const id = 'progress_notification';
        
        const notification = this.show(message, 'info', {
            id,
            persistent: true,
            title: 'Processing...'
        });

        // Add progress bar
        const progressContainer = document.createElement('div');
        progressContainer.innerHTML = `
            <div style="margin-top: 8px; background: #e0e0e0; border-radius: 4px; height: 6px; overflow: hidden;">
                <div class="progress-fill" style="background: #2196f3; height: 100%; width: ${progress}%; transition: width 0.3s ease;"></div>
            </div>
        `;
        
        const content = notification.querySelector('.notification-content');
        content.appendChild(progressContainer);

        return {
            update: (newProgress, newMessage) => {
                const progressFill = notification.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = `${newProgress}%`;
                }
                if (newMessage) {
                    const messageElement = notification.querySelector('.notification-message');
                    if (messageElement) {
                        messageElement.textContent = newMessage;
                    }
                }
            },
            complete: (finalMessage = 'Complete!') => {
                this.remove(id);
                this.success(finalMessage, { duration: 2000 });
            },
            error: (errorMessage = 'Operation failed') => {
                this.remove(id);
                this.error(errorMessage);
            }
        };
    }
}

// Global instance
window.notificationSystem = new NotificationSystem();

// Integrate with existing V2 UI system
if (window.gameIntegration?.modernUI) {
    // Override the existing showNotification method to use the new system
    const originalShowNotification = window.gameIntegration.modernUI.showNotification;
    
    window.gameIntegration.modernUI.showNotification = function(message, type = 'info', duration = 4000) {
        return window.notificationSystem.show(message, type, { duration });
    };
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}