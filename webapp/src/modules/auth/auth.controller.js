/**
 * Project Chronos - Auth Controller
 * Coordinates UI events with the Auth Service.
 */

import { AuthService } from './auth.service.js';
import { NotificationService } from '../../services/notification.service.js';

export class AuthController {
  constructor({ onAuthSuccess, onSignOut }) {
    this.onAuthSuccess = onAuthSuccess;
    this.onSignOut = onSignOut;
    this.isSignUpMode = false;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.form = document.getElementById('auth-form');
    this.title = document.getElementById('auth-title');
    this.subtitle = document.getElementById('auth-subtitle');
    this.submitBtn = document.getElementById('auth-submit-btn');
    this.toggleBtn = document.getElementById('auth-toggle-mode-btn');
    this.emailInput = document.getElementById('auth-email');
    this.passwordInput = document.getElementById('auth-password');
    this.userPill = document.getElementById('user-profile-pill');
    this.userEmailText = document.getElementById('user-email-text');
    this.signOutBtn = document.getElementById('sign-out-btn');
  }

  bindEvents() {
    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleMode());
    }

    if (this.signOutBtn) {
      this.signOutBtn.addEventListener('click', () => this.handleSignOut());
    }
  }

  toggleMode() {
    this.isSignUpMode = !this.isSignUpMode;
    if (this.isSignUpMode) {
      this.title.textContent = 'Crear Cuenta';
      this.subtitle.textContent = 'Regístrate para sincronizar tu tiempo en Chronos';
      this.submitBtn.textContent = 'Registrarse';
      this.toggleBtn.textContent = '¿Ya tienes cuenta? Inicia sesión';
    } else {
      this.title.textContent = 'Iniciar Sesión';
      this.subtitle.textContent = 'Ingresa tus credenciales para continuar';
      this.submitBtn.textContent = 'Acceder';
      this.toggleBtn.textContent = '¿No tienes cuenta? Regístrate aquí';
    }
  }

  async handleSubmit(event) {
    event.preventDefault();
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      NotificationService.warning('Por favor completa todos los campos.');
      return;
    }

    this.setLoading(true);

    try {
      if (this.isSignUpMode) {
        const data = await AuthService.signUp(email, password);
        NotificationService.success('¡Registro exitoso! Revisa tu correo o inicia sesión.');
        if (data.session) {
          this.handleSessionEstablished(data.session.user);
        } else {
          this.toggleMode();
        }
      } else {
        const data = await AuthService.signIn(email, password);
        NotificationService.success('Sesión iniciada correctamente.');
        this.handleSessionEstablished(data.user);
      }
    } catch (err) {
      console.error('[Auth Error]', err);
      NotificationService.error(err.message || 'Error al autenticar.');
    } finally {
      this.setLoading(false);
    }
  }

  async handleSignOut() {
    try {
      await AuthService.signOut();
      NotificationService.info('Sesión cerrada.');
      this.updateUIForAnonymous();
      if (typeof this.onSignOut === 'function') {
        this.onSignOut();
      }
    } catch (err) {
      NotificationService.error('Error al cerrar sesión.');
    }
  }

  handleSessionEstablished(user) {
    if (this.userPill && this.userEmailText) {
      this.userEmailText.textContent = user.email;
      this.userPill.classList.remove('hidden');
    }
    if (this.form) {
      this.form.reset();
    }
    if (typeof this.onAuthSuccess === 'function') {
      this.onAuthSuccess(user);
    }
  }

  updateUIForAnonymous() {
    if (this.userPill) {
      this.userPill.classList.add('hidden');
    }
    if (this.userEmailText) {
      this.userEmailText.textContent = '';
    }
  }

  setLoading(isLoading) {
    if (this.submitBtn) {
      this.submitBtn.disabled = isLoading;
      this.submitBtn.classList.toggle('btn-loading', isLoading);
    }
  }
}
