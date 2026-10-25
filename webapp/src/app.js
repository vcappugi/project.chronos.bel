/**
 * Project Chronos - Main Application Entrypoint
 * Bootstraps modules, coordinates tab routing, and initializes Supabase client.
 */

import { getDecryptedCredentials, getSupabase } from './config/supabase.client.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { TimerController } from './modules/timer/timer.controller.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js';
import { NotificationService } from './services/notification.service.js';

class ChronosApp {
  constructor() {
    this.currentUser = null;
    this.activeTab = 'timer';
  }

  async init() {
    console.log('[Chronos] Initializing application...');

    this.bindTabNavigation();
    this.initControllers();
    await this.initVaultAndSupabase();
    await this.checkInitialSession();
  }

  bindTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Update tab views
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    // Hook refreshes
    if (tabName === 'dashboard' && this.dashboardController) {
      this.dashboardController.refresh();
    }
  }

  initControllers() {
    this.dashboardController = new DashboardController({
      getCurrentUser: () => this.currentUser
    });

    this.timerController = new TimerController({
      getCurrentUser: () => this.currentUser,
      onEntrySaved: () => {
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      }
    });

    this.authController = new AuthController({
      onAuthSuccess: (user) => {
        this.currentUser = user;
        this.switchTab('timer');
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      },
      onSignOut: () => {
        this.currentUser = null;
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      }
    });
  }

  async initVaultAndSupabase() {
    const statusText = document.getElementById('vault-status-text');
    try {
      if (statusText) statusText.textContent = 'Desencriptando Vault...';
      
      // Decrypt credentials via Web Crypto AES-GCM
      const creds = await getDecryptedCredentials();
      console.log('[Chronos Vault] Credentials decrypted successfully for URL:', creds.supabaseUrl);

      // Initialize Supabase instance
      await getSupabase();

      if (statusText) statusText.textContent = 'Vault AES-GCM Activo';
    } catch (err) {
      console.error('[Chronos Vault Error]', err);
      if (statusText) statusText.textContent = 'Error Vault';
      NotificationService.error('Error al desencriptar las credenciales del sistema.');
    }
  }

  async checkInitialSession() {
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        this.currentUser = user;
        this.authController.handleSessionEstablished(user);
      } else {
        this.authController.updateUIForAnonymous();
      }

      // Initial dashboard render
      if (this.dashboardController) {
        await this.dashboardController.refresh();
      }
    } catch (err) {
      console.warn('[Chronos] Session check fallback:', err);
    }
  }
}

// Bootstrap once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ChronosApp();
  app.init();
});
