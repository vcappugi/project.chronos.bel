/**
 * Project Chronos - Main Application Entrypoint
 * Bootstraps modules, coordinates tab routing, and initializes background services.
 */

import { getDecryptedCredentials, getSupabase } from './config/supabase.client.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { TimerController } from './modules/timer/timer.controller.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js';
import { ProjectsController } from './modules/projects/projects.controller.js';
import { NotificationService } from './services/notification.service.js';
import { NativeService } from './services/native.service.js';

class ChronosApp {
  constructor() {
    this.currentUser = null;
    this.currentActor = null;
    this.activeTab = 'projects';
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
      if (this.activeTab !== 'projects') {
        this.switchTab('projects');
      }
    });

    // Device online/offline network connectivity listener
    NativeService.onNetworkStatusChange((isOnline) => {
      if (isOnline) {
        NotificationService.success('Conexión reestablecida. Sincronizando datos...');
        if (this.projectsController) {
          this.projectsController.loadProjects();
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

    // Module launcher cards
    const moduleCards = document.querySelectorAll('.module-nav-card');
    moduleCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const target = card.getAttribute('data-module');
        if (target) {
          NativeService.impact('light');
          moduleCards.forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          if (target === 'projects' && this.projectsController) {
            this.projectsController.loadProjects();
          }
        }
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('d-none', view.id !== `view-${tabName}`);
    });

    if (tabName === 'projects' && this.projectsController) {
      this.projectsController.loadProjects();
    }
  }

  initControllers() {
    this.projectsController = new ProjectsController();

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
        if (this.projectsController) {
          this.projectsController.loadProjects();
        }
      },
      onSignOut: () => {
        this.currentUser = null;
        this.currentActor = null;
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
        if (this.projectsController) {
          await this.projectsController.loadProjects();
        }
      } else {
        this.authController.updateUIForAnonymous();
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
