/**
 * Project Chronos - Main Application Entrypoint
 * Bootstraps modules, coordinates tab routing, and initializes background services.
 */

import { getDecryptedCredentials, getSupabase } from './config/supabase.client.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { TimerController } from './modules/timer/timer.controller.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js?v=mobile9';
import { ProjectsController } from './modules/projects/projects.controller.js?v=mobile9';
import { ActivitiesController } from './modules/activities/activities.controller.js?v=mobile9';
import { ActorsController } from './modules/actors/actors.controller.js?v=mobile9';
import { RolesController } from './modules/roles/roles.controller.js';
import { ResourcesController } from './modules/resources/resources.controller.js?v=mobile9';
import { NotificationService } from './services/notification.service.js';
import { NativeService } from './services/native.service.js';

class ChronosApp {
  constructor() {
    this.currentUser = null;
    this.currentActor = null;
    this.activeTab = 'dashboard';
  }

  async init() {
    console.log('[Chronos] Initializing application...');

    // Detect mobile device or Android platform
    this.detectDevicePlatform();

    // Initialize native device hardware features (Capacitor Bridge)
    await NativeService.init();
    this.setupNativeHardwareListeners();

    this.bindTabNavigation();
    this.initControllers();
    await this.initVaultAndSupabase();
    await this.checkInitialSession();
  }

  detectDevicePlatform() {
    const checkMobile = () => {
      const isMobile = NativeService.isNative() || 
        /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

      if (isMobile) {
        document.documentElement.classList.add('is-mobile-device');
      } else {
        document.documentElement.classList.remove('is-mobile-device');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
  }

  setupNativeHardwareListeners() {
    // Android hardware Back Button navigation: return to dashboard if on another module
    NativeService.registerBackButton(() => {
      if (this.activeTab !== 'dashboard') {
        this.navigateToModule('dashboard');
      }
    });

    // Device online/offline network connectivity listener
    NativeService.onNetworkStatusChange((isOnline) => {
      if (isOnline) {
        NotificationService.success('Conexión reestablecida. Sincronizando datos...');
        if (this.activeTab === 'dashboard' && this.dashboardController) {
          this.dashboardController.refresh();
        } else if (this.activeTab === 'projects' && this.projectsController) {
          this.projectsController.loadProjects();
        } else if (this.activeTab === 'activities' && this.activitiesController) {
          this.activitiesController.loadActivities();
        } else if (this.activeTab === 'resources' && this.resourcesController) {
          this.resourcesController.loadResources();
        } else if (this.activeTab === 'actors' && this.actorsController) {
          this.actorsController.loadActors();
        } else if (this.activeTab === 'roles' && this.rolesController) {
          this.rolesController.loadRoles();
        } else if (this.activeTab === 'audit' && this.dashboardController) {
          this.dashboardController.loadAuditModule();
        }
      } else {
        NotificationService.warning('Modo fuera de línea: los registros se guardarán en la memoria local.');
      }
    });
  }

  bindTabNavigation() {
    // Collapsible module launcher toggle
    const btnToggleModulesNav = document.getElementById('btn-toggle-modules-nav');
    const modulesNavGrid = document.getElementById('modules-nav-grid');

    btnToggleModulesNav?.addEventListener('click', () => {
      NativeService.impact('light');
      const isCollapsed = modulesNavGrid?.classList.contains('is-collapsed');
      this.setModulesNavCollapsed(!isCollapsed);
    });

    // Module launcher cards
    const moduleCards = document.querySelectorAll('.module-nav-card');
    const configPanel = document.getElementById('config-submodules-panel');
    const configCard = document.getElementById('card-module-config');
    const closeConfigBtn = document.getElementById('btn-close-config-panel');

    moduleCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const target = card.getAttribute('data-module');
        NativeService.impact('light');

        if (target === 'config') {
          // Toggle dropdown panel
          const isCurrentlyOpen = configCard?.classList.contains('config-open');
          if (isCurrentlyOpen) {
            configCard?.classList.remove('config-open');
            configPanel?.classList.add('d-none');
          } else {
            configCard?.classList.add('config-open');
            configPanel?.classList.remove('d-none');
          }
          return;
        }

        // Close config panel if selecting any main module
        if (configCard?.classList.contains('config-open')) {
          configCard?.classList.remove('config-open');
          configPanel?.classList.add('d-none');
        }

        this.navigateToModule(target);
      });
    });

    // Close config panel button
    closeConfigBtn?.addEventListener('click', () => {
      NativeService.impact('light');
      configCard?.classList.remove('config-open');
      configPanel?.classList.add('d-none');
    });

    // Sub-module cards inside Configuración
    const subCards = document.querySelectorAll('.submodule-card');
    subCards.forEach(sub => {
      sub.addEventListener('click', () => {
        NativeService.impact('light');
        subCards.forEach(s => s.classList.remove('active'));
        sub.classList.add('active');

        const subTarget = sub.getAttribute('data-submodule');
        if (subTarget === 'roles') {
          // Close config dropdown panel and switch to Roles CRUD
          configCard?.classList.remove('config-open');
          configPanel?.classList.add('d-none');
          this.navigateToModule('roles');
          return;
        }

        const subNameMap = {
          'roles': 'Roles',
          'permissions': 'Permisología'
        };
        NotificationService.info(`Módulo de configuración seleccionado: ${subNameMap[subTarget] || subTarget}`);
      });
    });
  }

  /**
   * Collapses or expands the top module navigation cards grid
   * @param {boolean} collapsed
   */
  setModulesNavCollapsed(collapsed) {
    const modulesNavGrid = document.getElementById('modules-nav-grid');
    const btnToggleModulesNav = document.getElementById('btn-toggle-modules-nav');
    const toggleLabel = document.getElementById('modules-nav-toggle-label');
    const toggleChevron = document.getElementById('modules-nav-toggle-chevron');
    const configPanel = document.getElementById('config-submodules-panel');
    const configCard = document.getElementById('card-module-config');

    if (!modulesNavGrid) return;

    modulesNavGrid.classList.toggle('is-collapsed', collapsed);
    btnToggleModulesNav?.setAttribute('aria-expanded', String(!collapsed));

    if (toggleLabel) {
      toggleLabel.textContent = collapsed ? 'Mostrar opciones' : 'Ocultar opciones';
    }
    if (toggleChevron) {
      toggleChevron.classList.toggle('rotated', !collapsed);
    }

    if (collapsed && configCard?.classList.contains('config-open')) {
      configCard.classList.remove('config-open');
      configPanel?.classList.add('d-none');
    }
  }

  /**
   * Switches views and active card state between system modules
   * @param {string} moduleName
   */
  navigateToModule(moduleName) {
    this.activeTab = moduleName;

    const moduleCards = document.querySelectorAll('.module-nav-card');
    const activeModulePill = document.getElementById('active-module-pill');
    const sectionDashboard = document.getElementById('section-dashboard');
    const sectionProjects = document.getElementById('section-projects-crud');
    const sectionActivities = document.getElementById('section-activities-crud');
    const sectionResources = document.getElementById('section-resources-crud');
    const sectionActors = document.getElementById('section-actors-crud');
    const sectionRoles = document.getElementById('section-roles-crud');
    const sectionAudit = document.getElementById('section-audit-view');

    const pillLabels = {
      'dashboard': '📊 Dashboard General',
      'projects': '📁 Proyectos',
      'activities': '⚡ Actividades',
      'resources': '📦 Recursos',
      'actors': '👥 Actores y Roles',
      'roles': '👑 Roles',
      'audit': '🛡️ Auditoría'
    };

    if (activeModulePill && pillLabels[moduleName]) {
      activeModulePill.textContent = pillLabels[moduleName];
    }

    // Update active class on top navigation cards
    moduleCards.forEach(card => {
      if (card.getAttribute('data-module') !== 'config') {
        card.classList.toggle('active', card.getAttribute('data-module') === moduleName);
      }
    });

    // Collapse module buttons on dashboard (or on mobile after selection) to maximize workspace
    if (moduleName === 'dashboard' || document.documentElement.classList.contains('is-mobile-device')) {
      this.setModulesNavCollapsed(true);
    }

    // Hide all sections first
    sectionDashboard?.classList.add('d-none');
    sectionProjects?.classList.add('d-none');
    sectionActivities?.classList.add('d-none');
    sectionResources?.classList.add('d-none');
    sectionActors?.classList.add('d-none');
    sectionRoles?.classList.add('d-none');
    sectionAudit?.classList.add('d-none');

    // Handle module visibility
    if (moduleName === 'dashboard') {
      sectionDashboard?.classList.remove('d-none');
      if (this.dashboardController) {
        this.dashboardController.refresh();
      }
    } else if (moduleName === 'projects') {
      sectionProjects?.classList.remove('d-none');
      if (this.projectsController) {
        this.projectsController.loadProjects();
      }
    } else if (moduleName === 'activities') {
      sectionActivities?.classList.remove('d-none');
      if (this.activitiesController) {
        this.activitiesController.loadActivities();
      }
    } else if (moduleName === 'resources') {
      sectionResources?.classList.remove('d-none');
      if (this.resourcesController) {
        this.resourcesController.loadResources();
      }
    } else if (moduleName === 'actors') {
      sectionActors?.classList.remove('d-none');
      if (this.actorsController) {
        this.actorsController.loadActors();
      }
    } else if (moduleName === 'roles') {
      sectionRoles?.classList.remove('d-none');
      if (this.rolesController) {
        this.rolesController.loadRoles();
      }
    } else if (moduleName === 'audit') {
      sectionAudit?.classList.remove('d-none');
      if (this.dashboardController) {
        this.dashboardController.loadAuditModule();
      }
    } else {
      NotificationService.info(`Módulo ${moduleName} en preparación.`);
    }
  }

  initControllers() {
    this.projectsController = new ProjectsController();

    this.actorsController = new ActorsController({
      onActorChanged: () => {
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      }
    });

    this.rolesController = new RolesController({
      onRoleChanged: () => {
        if (this.actorsController) {
          this.actorsController.loadRolesOptions();
        }
      }
    });

    this.activitiesController = new ActivitiesController({
      onActivityChanged: () => {
        if (this.dashboardController) {
          this.dashboardController.refresh();
        }
      }
    });

    this.resourcesController = new ResourcesController({
      onResourceChanged: () => {
        if (this.activitiesController) {
          // Keep activity resource selectors in sync if needed
        }
      }
    });

    this.dashboardController = new DashboardController({
      onNavigateToProjects: (openModal = false) => {
        this.navigateToModule('projects');
        if (openModal && this.projectsController) {
          this.projectsController.openCreateModal();
        }
      }
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
      onAuthSuccess: async (user, actor) => {
        this.currentUser = user;
        this.currentActor = actor;
        this.navigateToModule('dashboard');
        if (this.dashboardController) {
          await this.dashboardController.refresh();
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
      const rememberPref = localStorage.getItem('chronos_remember_session');

      // If user previously unchecked "Mantener Iniciado", check if current browser session is active
      if (rememberPref === 'false') {
        const isSessionActive = sessionStorage.getItem('chronos_session_active');
        if (!isSessionActive) {
          // New window/tab and remember me was disabled: require credentials
          await AuthService.signOut();
          this.authController.updateUIForAnonymous();
          return;
        }
      }

      // Check for active Supabase session
      let user = await AuthService.getCurrentUser();

      // Fallback: If network lag or offline on mobile, but remember me is active and cache exists
      if (!user && (rememberPref === 'true' || rememberPref === null)) {
        try {
          const cachedRaw = localStorage.getItem('chronos_cached_session');
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached?.user) {
              user = { ...cached.user, actor: cached.actor };
            }
          }
        } catch (e) {
          console.warn('[Chronos] Cache restore error:', e);
        }
      }

      if (user) {
        this.currentUser = user;
        this.currentActor = user.actor;
        this.authController.handleSessionEstablished(user, user.actor);
        
        // Show dashboard as initial screen
        this.navigateToModule('dashboard');
        if (this.dashboardController) {
          await this.dashboardController.refresh();
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
