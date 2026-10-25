/**
 * Project Chronos - Minimalist Auth Controller
 * Manages the initial login screen using Yeti.css form controls.
 */

import { AuthService } from './auth.service.js';
import { NotificationService } from '../../services/notification.service.js';

export class AuthController {
  constructor({ onAuthSuccess, onSignOut }) {
    this.onAuthSuccess = onAuthSuccess;
    this.onSignOut = onSignOut;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.loginContainer = document.getElementById('view-auth-login');
    this.mainWorkspace = document.getElementById('app-main-workspace');

    this.form = document.getElementById('login-form');
    this.userInput = document.getElementById('login-username');
    this.passwordInput = document.getElementById('login-password');
    this.rememberMeCheckbox = document.getElementById('login-remember-me');
    this.submitBtn = document.getElementById('login-submit-btn');
    this.errorAlert = document.getElementById('login-error-alert');

    this.userPill = document.getElementById('user-profile-pill');
    this.userNameText = document.getElementById('user-name-text');
    this.userRoleBadge = document.getElementById('user-role-badge');
    this.signOutBtn = document.getElementById('sign-out-btn');

    // Pre-populate last username if available
    const lastUser = localStorage.getItem('chronos_last_username');
    if (lastUser && this.userInput && !this.userInput.value) {
      this.userInput.value = lastUser;
    }
  }

  bindEvents() {
    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    if (this.signOutBtn) {
      this.signOutBtn.addEventListener('click', () => this.handleSignOut());
    }
  }

  async handleSubmit(event) {
    event.preventDefault();
    this.hideError();

    const username = this.userInput?.value?.trim();
    const password = this.passwordInput?.value;
    const rememberMe = this.rememberMeCheckbox ? this.rememberMeCheckbox.checked : true;

    if (!username || !password) {
      this.showError('Por favor ingresa tu usuario y clave.');
      return;
    }

    this.setLoading(true);

    try {
      const result = await AuthService.signIn(username, password, { rememberMe });
      this.handleSessionEstablished(result.user, result.actor);
    } catch (err) {
      this.showError(err.message || 'Usuario o clave incorrectos.');
    } finally {
      this.setLoading(false);
    }
  }

  async handleSignOut() {
    try {
      await AuthService.signOut();
      this.updateUIForAnonymous();
      if (typeof this.onSignOut === 'function') {
        this.onSignOut();
      }
    } catch {
      NotificationService.error('Error al cerrar sesión.');
    }
  }

  handleSessionEstablished(user, actor = null) {
    const displayName = actor ? `${actor.first_name} ${actor.last_name}` : user.email;
    const roleName = actor?.roles?.name || 'Usuario';

    if (this.userNameText) {
      this.userNameText.textContent = displayName;
    }
    if (this.userRoleBadge) {
      this.userRoleBadge.textContent = roleName;
    }

    if (this.userPill) {
      this.userPill.classList.remove('d-none');
    }

    // Hide login screen, display main application
    if (this.loginContainer) {
      this.loginContainer.classList.add('d-none');
    }
    if (this.mainWorkspace) {
      this.mainWorkspace.classList.remove('d-none');
    }

    if (this.form) {
      this.form.reset();
    }

    if (typeof this.onAuthSuccess === 'function') {
      this.onAuthSuccess(user, actor);
    }
  }

  updateUIForAnonymous() {
    if (this.userPill) {
      this.userPill.classList.add('d-none');
    }
    if (this.userNameText) {
      this.userNameText.textContent = '';
    }

    // Show initial login screen, hide main application
    if (this.loginContainer) {
      this.loginContainer.classList.remove('d-none');
    }
    if (this.mainWorkspace) {
      this.mainWorkspace.classList.add('d-none');
    }
  }

  showError(message) {
    if (this.errorAlert) {
      this.errorAlert.textContent = message;
      this.errorAlert.classList.remove('d-none');
    }
  }

  hideError() {
    if (this.errorAlert) {
      this.errorAlert.textContent = '';
      this.errorAlert.classList.add('d-none');
    }
  }

  setLoading(isLoading) {
    if (this.submitBtn) {
      this.submitBtn.disabled = isLoading;
      this.submitBtn.textContent = isLoading ? 'Accediendo...' : 'Iniciar Sesión';
    }
  }
}
