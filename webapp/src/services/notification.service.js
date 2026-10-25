/**
 * Project Chronos - Notification Service
 * Toast alerts styled with Yeti.css / Bootstrap alerts.
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
   * @param {string} message 
   * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] 
   * @param {number} [duration=3500] 
   */
  static show(message, type = 'info', duration = 3500) {
    const container = this.#getContainer();
    const toast = document.createElement('div');

    const typeClassMap = {
      info: 'alert-info',
      success: 'alert-success',
      warning: 'alert-warning',
      error: 'alert-danger'
    };

    const alertClass = typeClassMap[type] || 'alert-info';
    toast.className = `alert ${alertClass} toast-alert fade show mb-0`;

    toast.innerHTML = `
      <span>${message}</span>
      <button type="button" class="btn-close ms-2" aria-label="Cerrar"></button>
    `;

    const closeBtn = toast.querySelector('.btn-close');
    const removeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 200);
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
