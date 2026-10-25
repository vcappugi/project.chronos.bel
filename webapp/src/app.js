/**
 * Project Chronos - Main Application Entrypoint
 * Bootstraps modules, coordinates tab routing, and initializes background services.
 */

import { getDecryptedCredentials, getSupabase } from './config/supabase.client.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { TimerController } from './modules/timer/timer.controller.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js';
import { NotificationService } from './services/notification.service.js';
import { NativeService } from './services/native.service.js';

class ChronosApp {
  constructor() {
    this.currentUser = null;
    this.currentActor = null;
    this.activeTab = 'timer';
  }

  async init() {
    console.log('[Chronos] Initializing application...');

    // Initialize native device hardware features (Capacitor Bridge)
    await NativeService.init();
    this.setupNativeHardwareListeners();

    this.bindTabNavigation();
    this.initControllers();
    await this.initVaultAndSupabase();
    await this.checkInitialSession();
  }

  setupNativeHardwareListeners() {
    // Android hardware Back Button navigation
    NativeService.registerBackButton(() => {
      if (this.activeTab !== 'timer') {
        this.switchTab('timer');
      }
    });

    // Device online/offline network connectivity listener
    NativeService.onNetworkStatusChange((isOnline) => {
      if (isOnline) {
        NotificationService.success('Conexión reestablecida. Sincronizando datos...');
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      } else {
        NotificationService.warning('Modo fuera de línea: los registros se guardarán en la memoria local.');
      }
    });
  }

  bindTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        NativeService.impact('light');
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
      view.classList.toggle('d-none', view.id !== `view-${tabName}`);
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
      onAuthSuccess: (user, actor) => {
        this.currentUser = user;
        this.currentActor = actor;
        this.switchTab('timer');
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      },
      onSignOut: () => {
        this.currentUser = null;
        this.currentActor = null;
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      }
    });
  }

  async initVaultAndSupabase() {
    try {
      // Decrypt credentials in background via Web Crypto AES-GCM
      await getDecryptedCredentials();
      await getSupabase();
    } catch (err) {
      console.error('[Chronos Vault Error]', err);
      NotificationService.error('Error al inicializar los servicios seguros del sistema.');
    }
  }

  async checkInitialSession() {
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        this.currentUser = user;
        this.currentActor = user.actor;
        this.authController.handleSessionEstablished(user, user.actor);
      } else {
        this.authController.updateUIForAnonymous();
      }

      if (this.dashboardController) {
        await this.dashboardController.refresh();
      }
    } catch (err) {
      console.warn('[Chronos] Session check fallback:', err);
      this.authController.updateUIForAnonymous();
    }
  }
}

// Bootstrap once DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ChronosApp();
  app.init();
});
