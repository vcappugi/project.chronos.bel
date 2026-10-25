/**
 * Project Chronos - Notification Service
 * Renders non-intrusive, animated toast notifications.
 */

export class NotificationService {
  static #container = null;

  static #getContainer() {
    if (!this.#container) {
      this.#container = document.getElementById('toast-container');
      if (!this.#container) {
        this.#container = document.createElement('div');
        this.#container.id = 'toast-container';
        this.#container.className = 'toast-container';
        document.body.appendChild(this.#container);
      }
    }
    return this.#container;
  }

  /**
   * Displays a toast notification
   * @param {string} message Message text
   * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] Notification type
   * @param {number} [duration=4000] Duration in milliseconds
   */
  static show(message, type = 'info', duration = 4000) {
    const container = this.#getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    toast.innerHTML = `
      <span class="toast-icon">${iconMap[type] || 'ℹ️'}</span>
      <span class="toast-text">${message}</span>
      <button class="toast-close" aria-label="Cerrar">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
      toast.classList.add('animate-fade-out');
      setTimeout(() => toast.remove(), 250);
    };

    closeBtn.addEventListener('click', removeToast);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
  }

  static success(msg, duration) {
    this.show(msg, 'success', duration);
  }

  static error(msg, duration) {
    this.show(msg, 'error', duration);
  }

  static warning(msg, duration) {
    this.show(msg, 'warning', duration);
  }

  static info(msg, duration) {
    this.show(msg, 'info', duration);
  }
}
