/**
 * Project Chronos - Activities Controller
 * Orchestrates full CRUD for public.actividades and sub-CRUDs for
 * public.actividad_actores (team assignments) and public.actividad_recursos (allocated resources/costs).
 */

import { ActivitiesService } from './activities.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class ActivitiesController {
  constructor({ onActivityChanged } = {}) {
    this.onActivityChanged = onActivityChanged;
    this.activities = [];
    this.projects = [];
    this.availableActors = [];
    this.availableResources = [];

    this.currentEditingId = null;
    this.activityToDelete = null;
    this.currentActivityForActors = null;
    this.currentActivityForResources = null;
    this.returnToActivityModal = false;
    this.searchDebounceTimer = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Buttons & Filters
    this.btnNewActivity = document.getElementById('btn-new-activity');
    this.searchInput = document.getElementById('activity-search-input');
    this.filterProject = document.getElementById('activity-filter-project');
    this.filterStatus = document.getElementById('activity-filter-status');
    this.activitiesCountBadge = document.getElementById('activities-count-badge');
    this.loadingIndicator = document.getElementById('activities-loading');

    // Table elements
    this.tableBody = document.getElementById('activities-table-body');
    this.emptyState = document.getElementById('activities-empty-state');

    // 1. Activity Modal (Create / Edit)
    this.modal = document.getElementById('modal-activity');
    this.modalTitle = document.getElementById('modal-activity-title');
    this.form = document.getElementById('form-activity');
    this.inputId = document.getElementById('activity-id');
    this.inputProjectId = document.getElementById('activity-project-id');
    this.inputName = document.getElementById('activity-name');
    this.inputDescription = document.getElementById('activity-description');
    this.inputWeight = document.getElementById('activity-weight');
    this.inputProgress = document.getElementById('activity-progress');
    this.progressValueDisplay = document.getElementById('activity-progress-val');
    this.inputStartDate = document.getElementById('activity-start-date');
    this.inputEndDate = document.getElementById('activity-end-date');
    this.inputStatus = document.getElementById('activity-status');
    this.btnSave = document.getElementById('btn-save-activity');
    this.btnCloseModal = document.getElementById('btn-close-activity-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-activity-modal');
    this.btnModalActActors = document.getElementById('btn-modal-act-actors');
    this.btnModalActResources = document.getElementById('btn-modal-act-resources');
    this.modalActActorsBadge = document.getElementById('modal-act-actors-badge');
    this.modalActResourcesBadge = document.getElementById('modal-act-resources-badge');

    // 2. Delete Activity Modal
    this.deleteModal = document.getElementById('modal-delete-activity');
    this.deleteNameText = document.getElementById('delete-activity-name');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-activity');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-activity');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-activity-modal');

    // 3. Sub-CRUD Modal: Actividad Actores (Equipo Asignado)
    this.modalActors = document.getElementById('modal-activity-actors');
    this.modalActorsTitle = document.getElementById('modal-act-actors-title');
    this.modalActorsProject = document.getElementById('modal-act-actors-project');
    this.formAssignActor = document.getElementById('form-assign-actor');
    this.selectAssignActor = document.getElementById('select-assign-actor');
    this.inputAssignActorRole = document.getElementById('input-assign-actor-role');
    this.btnSubmitAssignActor = document.getElementById('btn-submit-assign-actor');
    this.tableActivityActorsBody = document.getElementById('table-activity-actors-body');
    this.emptyActivityActors = document.getElementById('empty-activity-actors');
    this.btnCloseActorsModal = document.getElementById('btn-close-act-actors-modal');
    this.btnDismissActorsModal = document.getElementById('btn-dismiss-act-actors-modal');

    // 4. Sub-CRUD Modal: Actividad Recursos (Costos e Insumos)
    this.modalResources = document.getElementById('modal-activity-resources');
    this.modalResourcesTitle = document.getElementById('modal-act-res-title');
    this.modalResourcesProject = document.getElementById('modal-act-res-project');
    this.actResTotalCostDisplay = document.getElementById('act-res-total-cost');
    this.formAssignResource = document.getElementById('form-assign-resource');
    this.selectAssignResource = document.getElementById('select-assign-resource');
    this.inputAssignResQty = document.getElementById('input-assign-res-qty');
    this.inputAssignResOverride = document.getElementById('input-assign-res-override');
    this.btnSubmitAssignResource = document.getElementById('btn-submit-assign-resource');
    this.tableActivityResourcesBody = document.getElementById('table-activity-resources-body');
    this.emptyActivityResources = document.getElementById('empty-activity-resources');
    this.btnCloseResourcesModal = document.getElementById('btn-close-act-res-modal');
    this.btnDismissResourcesModal = document.getElementById('btn-dismiss-act-res-modal');
  }

  bindEvents() {
    // Activity Form Events
    this.btnNewActivity?.addEventListener('click', () => {
      NativeService.impact('light');
      this.openCreateModal();
    });

    this.searchInput?.addEventListener('input', () => this.debounceLoad());
    this.filterProject?.addEventListener('change', () => this.loadActivities());
    this.filterStatus?.addEventListener('change', () => this.loadActivities());

    this.inputProgress?.addEventListener('input', (e) => {
      if (this.progressValueDisplay) {
        this.progressValueDisplay.textContent = `${e.target.value}%`;
      }
    });

    this.form?.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.btnCancelModal?.addEventListener('click', () => this.closeModal());
    this.btnModalActActors?.addEventListener('click', () => this.handleOpenSubModalFromActivityModal('actors'));
    this.btnModalActResources?.addEventListener('click', () => this.handleOpenSubModalFromActivityModal('resources'));

    this.btnConfirmDelete?.addEventListener('click', () => this.handleConfirmDelete());
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());

    // Sub-CRUD 1: Actores Events
    this.selectAssignActor?.addEventListener('change', () => this.handleActorSelectionChange());
    this.formAssignActor?.addEventListener('submit', (e) => this.handleAssignActor(e));
    this.btnCloseActorsModal?.addEventListener('click', () => this.closeActorsModal());
    this.btnDismissActorsModal?.addEventListener('click', () => this.closeActorsModal());

    // Sub-CRUD 2: Recursos Events
    this.formAssignResource?.addEventListener('submit', (e) => this.handleAssignResource(e));
    this.btnCloseResourcesModal?.addEventListener('click', () => this.closeResourcesModal());
    this.btnDismissResourcesModal?.addEventListener('click', () => this.closeResourcesModal());
  }

  debounceLoad() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.loadActivities();
    }, 300);
  }

  async loadProjectsOptions() {
    try {
      this.projects = await ActivitiesService.getProjectsList();

      if (this.filterProject) {
        const currentVal = this.filterProject.value;
        this.filterProject.innerHTML = `
          <option value="">Todos los Proyectos</option>
          ${this.projects.map(p => `<option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}
        `;
      }

      if (this.inputProjectId) {
        const currentVal = this.inputProjectId.value;
        this.inputProjectId.innerHTML = `
          <option value="">-- Selecciona un Proyecto * --</option>
          ${this.projects.map(p => `<option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}
        `;
      }
    } catch (err) {
      console.error('[ActivitiesController] Error loading project options:', err);
    }
  }

  async loadActivities() {
    this.setLoading(true);

    try {
      if (this.projects.length === 0) {
        await this.loadProjectsOptions();
      }

      const projectId = this.filterProject?.value || '';
      const status = this.filterStatus?.value || '';
      const query = this.searchInput?.value?.trim() || '';

      this.activities = await ActivitiesService.getAll({ projectId, status, query });
      this.render();
    } catch (err) {
      console.error('[ActivitiesController] Load error:', err);
      NotificationService.error(err.message || 'Error al cargar las actividades.');
    } finally {
      this.setLoading(false);
    }
  }

  render() {
    if (this.activitiesCountBadge) {
      const count = this.activities.length;
      this.activitiesCountBadge.textContent = `${count} ${count === 1 ? 'actividad' : 'actividades'}`;
    }

    if (!this.tableBody) return;

    if (this.activities.length === 0) {
      this.tableBody.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('d-none');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('d-none');

    this.tableBody.innerHTML = this.activities.map(act => {
      const statusBadge = this.getStatusBadge(act.status);
      const projectName = act.proyectos?.name || 'Sin Proyecto';
      const progress = Math.round(Number(act.progress_percentage) || 0);
      const weight = Number(act.weight) || 1.00;
      const rawStart = act.start_date ? this.formatDate(act.start_date) : '';
      const rawEnd = act.end_date ? this.formatDate(act.end_date) : '';
      const startDate = rawStart || '<span class="text-muted">No definida</span>';
      const endDate = rawEnd || '<span class="text-muted">No definida</span>';

      let progressClass = 'bg-info';
      if (progress === 100) progressClass = 'bg-success';
      else if (progress >= 50) progressClass = 'bg-primary';
      else if (progress > 0) progressClass = 'bg-warning';

      const dateRangeShort = (rawStart && rawEnd)
        ? `${rawStart} - ${rawEnd}`
        : (rawStart || rawEnd || '');

      return `
        <tr>
          <!-- 1. Info Principal (Actividad, Proyecto, y resumen compacto para móvil) -->
          <td class="td-act-info">
            <div class="d-flex align-items-center gap-1 mb-1">
              <span class="badge bg-light text-primary border act-row-project" title="${this.escapeHtml(projectName)}">📁 ${this.escapeHtml(projectName)}</span>
            </div>
            <a href="#" class="fw-bold text-primary text-decoration-none act-row-name btn-edit-activity d-inline-block" data-id="${act.id}" title="Editar Actividad">${this.escapeHtml(act.name)}</a>
            <div class="text-muted small act-row-desc">${this.escapeHtml(act.description || 'Sin descripción')}</div>

            <!-- Resumen compacto para versión móvil web y Android -->
            <div class="act-mobile-summary d-none">
              <span class="badge ${progressClass} act-mobile-progress">${progress}%</span>
              ${dateRangeShort ? `<span class="act-mobile-dates">📅 ${dateRangeShort}</span>` : ''}
            </div>
          </td>

          <!-- 2. Estado -->
          <td class="td-act-status text-center">${statusBadge}</td>

          <!-- 3. Avance (Desktop) -->
          <td class="td-act-progress">
            <div class="d-flex align-items-center gap-2 mb-1">
              <div class="progress flex-grow-1" style="height: 6px; width: 100px;">
                <div class="progress-bar ${progressClass}" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <span class="small font-monospace fw-bold text-dark">${progress}%</span>
            </div>
            <div class="small text-muted" style="font-size: 0.75rem;">
              Peso: <strong>${weight.toFixed(2)}</strong>
            </div>
          </td>

          <!-- 4. Plazos (Desktop) -->
          <td class="td-act-dates">
            <div class="small"><strong>Inicio:</strong> ${startDate}</div>
            <div class="small"><strong>Fin:</strong> ${endDate}</div>
          </td>

          <!-- 5. Acciones -->
          <td class="td-act-actions text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-danger btn-delete-activity" data-id="${act.id}" title="Eliminar Actividad">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners
    this.tableBody.querySelectorAll('.btn-edit-activity').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete-activity').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openDeleteModal(id);
      });
    });
  }

  getStatusBadge(status) {
    const config = {
      'PENDIENTE': { label: 'Pendiente', class: 'badge bg-secondary' },
      'EN_PROCESO': { label: 'En Proceso', class: 'badge bg-primary' },
      'SUSPENDIDA': { label: 'Suspendida', class: 'badge bg-warning text-dark' },
      'FINALIZADA': { label: 'Finalizada', class: 'badge bg-success' }
    };

    const current = config[status] || { label: status || 'Pendiente', class: 'badge bg-secondary' };
    return `<span class="${current.class} px-2 py-1">${current.label}</span>`;
  }

  // =========================================================================
  // SUB-CRUD 1: GESTIÓN DE EQUIPO (ACTIVIDAD_ACTORES)
  // =========================================================================

  async openActorsModal(activityId) {
    const activity = this.activities.find(a => a.id === activityId);
    if (!activity) return;

    this.currentActivityForActors = activity;
    NativeService.impact('light');

    if (this.modalActorsTitle) {
      this.modalActorsTitle.textContent = activity.name;
    }
    if (this.modalActorsProject) {
      this.modalActorsProject.textContent = `Proyecto: ${activity.proyectos?.name || 'General'}`;
    }

    if (this.formAssignActor) this.formAssignActor.reset();
    if (this.inputAssignActorRole) this.inputAssignActorRole.value = '';

    // Load available actors catalog
    await this.populateAvailableActorsSelect();
    await this.loadActivityActors(activityId);

    this.showActorsModal();
  }

  async populateAvailableActorsSelect() {
    if (!this.selectAssignActor) return;
    try {
      this.availableActors = await ActivitiesService.getAvailableActores();
      this.selectAssignActor.innerHTML = `
        <option value="">-- Selecciona un Colaborador / Actor * --</option>
        ${this.availableActors.map(a => {
          const roleLabel = this.formatRoleName(a.roles?.name);
          return `<option value="${a.id}">${this.escapeHtml(a.first_name)} ${this.escapeHtml(a.last_name)} - ${this.escapeHtml(roleLabel)} (${this.escapeHtml(a.email)})</option>`;
        }).join('')}
      `;
    } catch (err) {
      console.error('[ActivitiesController] Error populating actors select:', err);
    }
  }

  handleActorSelectionChange() {
    const actorId = this.selectAssignActor?.value;
    if (!actorId) {
      if (this.inputAssignActorRole) {
        this.inputAssignActorRole.value = '';
      }
      return;
    }

    const selected = this.availableActors?.find(a => a.id === actorId);
    const roleName = selected?.roles?.name;
    const formatted = this.formatRoleName(roleName);

    if (this.inputAssignActorRole) {
      this.inputAssignActorRole.value = formatted;
    }
  }

  formatRoleName(str = '') {
    if (!str) return 'Colaborador';
    if (str.toLowerCase() === 'sysadmin') return 'SysAdmin';
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async loadActivityActors(activityId) {
    if (!this.tableActivityActorsBody) return;

    try {
      const assigned = await ActivitiesService.getActorsByActivity(activityId);

      if (assigned.length === 0) {
        this.tableActivityActorsBody.innerHTML = '';
        if (this.emptyActivityActors) this.emptyActivityActors.classList.remove('d-none');
        return;
      }

      if (this.emptyActivityActors) this.emptyActivityActors.classList.add('d-none');

      this.tableActivityActorsBody.innerHTML = assigned.map(item => {
        const actorName = item.actores ? `${item.actores.first_name} ${item.actores.last_name}` : 'Actor no encontrado';
        const actorEmail = item.actores?.email || '';
        const role = item.assigned_role || this.formatRoleName(item.actores?.roles?.name) || 'Colaborador';

        return `
          <tr>
            <td>
              <div class="fw-bold text-dark">${this.escapeHtml(actorName)}</div>
              <small class="text-muted">${this.escapeHtml(actorEmail)}</small>
            </td>
            <td>
              <span class="badge bg-light text-dark border font-monospace">${this.escapeHtml(role)}</span>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-danger py-0.5 px-2 btn-remove-activity-actor" data-assignment-id="${item.id}" title="Desvincular">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Bind unassign buttons
      this.tableActivityActorsBody.querySelectorAll('.btn-remove-activity-actor').forEach(btn => {
        btn.addEventListener('click', async () => {
          const assignmentId = btn.getAttribute('data-assignment-id');
          await this.handleRemoveActor(assignmentId);
        });
      });
    } catch (err) {
      console.error('[ActivitiesController] Error loading activity actors:', err);
      NotificationService.error(err.message || 'Error al cargar los actores de la actividad.');
    }
  }

  async handleAssignActor(event) {
    event.preventDefault();
    if (!this.currentActivityForActors) return;

    const actorId = this.selectAssignActor?.value;
    const selectedActor = this.availableActors?.find(a => a.id === actorId);
    const assignedRole = this.inputAssignActorRole?.value?.trim() || this.formatRoleName(selectedActor?.roles?.name) || 'Colaborador';

    if (!actorId) {
      NotificationService.warning('Selecciona un colaborador para asignarlo a la actividad.');
      this.selectAssignActor?.focus();
      return;
    }

    try {
      await ActivitiesService.assignActor({
        activityId: this.currentActivityForActors.id,
        actorId,
        assignedRole
      });

      NotificationService.success('Colaborador asignado a la actividad exitosamente.');
      if (this.formAssignActor) this.formAssignActor.reset();
      if (this.inputAssignActorRole) this.inputAssignActorRole.value = '';

      await this.loadActivityActors(this.currentActivityForActors.id);
      await this.loadActivities(); // Refresh row counts
      this.syncCurrentEditingBadges();
    } catch (err) {
      console.error('[ActivitiesController] Error assigning actor:', err);
      NotificationService.error(err.message || 'Error al asignar colaborador.');
    }
  }

  async handleRemoveActor(assignmentId) {
    if (!this.currentActivityForActors) return;

    try {
      await ActivitiesService.removeActor(assignmentId);
      NotificationService.success('Colaborador desvinculado de la actividad.');
      await this.loadActivityActors(this.currentActivityForActors.id);
      await this.loadActivities();
      this.syncCurrentEditingBadges();
    } catch (err) {
      console.error('[ActivitiesController] Error removing actor:', err);
      NotificationService.error(err.message || 'Error al desvincular colaborador.');
    }
  }

  showActorsModal() {
    if (this.modalActors) {
      this.modalActors.classList.add('show');
      this.modalActors.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  }

  closeActorsModal() {
    if (this.modalActors) {
      this.modalActors.classList.remove('show');
      this.modalActors.style.display = 'none';
      document.body.classList.remove('modal-open');
      this.currentActivityForActors = null;
    }

    if (this.returnToActivityModal && this.currentEditingId) {
      this.returnToActivityModal = false;
      this.syncCurrentEditingBadges();
      this.showModal();
    }
  }

  // =========================================================================
  // SUB-CRUD 2: GESTIÓN DE RECURSOS Y COSTOS (ACTIVIDAD_RECURSOS)
  // =========================================================================

  async openResourcesModal(activityId) {
    const activity = this.activities.find(a => a.id === activityId);
    if (!activity) return;

    this.currentActivityForResources = activity;
    NativeService.impact('light');

    if (this.modalResourcesTitle) {
      this.modalResourcesTitle.textContent = activity.name;
    }
    if (this.modalResourcesProject) {
      this.modalResourcesProject.textContent = `Proyecto: ${activity.proyectos?.name || 'General'}`;
    }

    if (this.formAssignResource) this.formAssignResource.reset();
    if (this.inputAssignResQty) this.inputAssignResQty.value = '1';
    if (this.inputAssignResOverride) this.inputAssignResOverride.value = '';

    await this.populateAvailableResourcesSelect();
    await this.loadActivityResources(activityId);

    this.showResourcesModal();
  }

  async populateAvailableResourcesSelect() {
    if (!this.selectAssignResource) return;
    try {
      this.availableResources = await ActivitiesService.getAvailableRecursos();
      this.selectAssignResource.innerHTML = `
        <option value="">-- Selecciona un Recurso del Catálogo * --</option>
        ${this.availableResources.map(r => {
          const cost = Number(r.unit_cost_usd || 0).toFixed(2);
          return `<option value="${r.id}" data-cost="${cost}">${this.escapeHtml(r.name)} ($${cost} USD / ${r.unit_type})</option>`;
        }).join('')}
      `;
    } catch (err) {
      console.error('[ActivitiesController] Error populating resources select:', err);
    }
  }

  async loadActivityResources(activityId) {
    if (!this.tableActivityResourcesBody) return;

    try {
      const assigned = await ActivitiesService.getResourcesByActivity(activityId);

      // Compute total activity cost
      let totalCost = 0;
      assigned.forEach(item => {
        totalCost += (item.subtotalUSD || 0);
      });

      if (this.actResTotalCostDisplay) {
        this.actResTotalCostDisplay.textContent = `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
      }

      if (assigned.length === 0) {
        this.tableActivityResourcesBody.innerHTML = '';
        if (this.emptyActivityResources) this.emptyActivityResources.classList.remove('d-none');
        return;
      }

      if (this.emptyActivityResources) this.emptyActivityResources.classList.add('d-none');

      this.tableActivityResourcesBody.innerHTML = assigned.map(item => {
        const resName = item.recursos?.name || 'Recurso desconocido';
        const unitType = item.recursos?.unit_type || 'UNIDAD';
        const qty = item.quantity != null && !isNaN(Number(item.quantity)) ? Number(item.quantity) : 1;
        const unitCost = Number(item.effectiveUnitCost || 0).toFixed(2);
        const subtotal = Number(item.subtotalUSD || 0).toFixed(2);
        const isOverridden = item.unit_cost_usd_override != null;

        return `
          <tr>
            <td>
              <div class="fw-bold text-dark">${this.escapeHtml(resName)}</div>
              <small class="badge bg-light text-muted border">${unitType}</small>
            </td>
            <td>
              <span class="font-monospace fw-bold text-dark">${qty.toFixed(2)}</span>
            </td>
            <td>
              <span class="font-monospace">$${unitCost}</span>
              ${isOverridden ? '<span class="badge bg-warning text-dark small ms-1" title="Costo personalizado">Modificado</span>' : ''}
            </td>
            <td>
              <strong class="font-monospace text-primary">$${subtotal}</strong>
            </td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-danger py-0.5 px-2 btn-remove-activity-resource" data-assignment-id="${item.id}" title="Desvincular">
                🗑️
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Bind unassign buttons
      this.tableActivityResourcesBody.querySelectorAll('.btn-remove-activity-resource').forEach(btn => {
        btn.addEventListener('click', async () => {
          const assignmentId = btn.getAttribute('data-assignment-id');
          await this.handleRemoveResource(assignmentId);
        });
      });
    } catch (err) {
      console.error('[ActivitiesController] Error loading activity resources:', err);
      NotificationService.error(err.message || 'Error al cargar los recursos de la actividad.');
    }
  }

  async handleAssignResource(event) {
    event.preventDefault();
    if (!this.currentActivityForResources) return;

    const resourceId = this.selectAssignResource?.value;
    const quantity = this.inputAssignResQty?.value;
    const unitCostOverride = this.inputAssignResOverride?.value;

    if (!resourceId) {
      NotificationService.warning('Selecciona un recurso del catálogo para asignarlo.');
      this.selectAssignResource?.focus();
      return;
    }

    if (quantity === '' || quantity === null || isNaN(parseFloat(quantity))) {
      NotificationService.warning('Ingresa una cantidad válida.');
      this.inputAssignResQty?.focus();
      return;
    }

    try {
      await ActivitiesService.assignResource({
        activityId: this.currentActivityForResources.id,
        resourceId,
        quantity,
        unitCostOverride: unitCostOverride ? parseFloat(unitCostOverride) : null
      });

      NotificationService.success('Recurso asignado a la actividad exitosamente.');
      if (this.formAssignResource) this.formAssignResource.reset();
      if (this.inputAssignResQty) this.inputAssignResQty.value = '1';
      if (this.inputAssignResOverride) this.inputAssignResOverride.value = '';

      await this.loadActivityResources(this.currentActivityForResources.id);
      await this.loadActivities();
      this.syncCurrentEditingBadges();

      // Notify parent to recalculate dashboard budget metrics
      if (typeof this.onActivityChanged === 'function') {
        this.onActivityChanged();
      }
    } catch (err) {
      console.error('[ActivitiesController] Error assigning resource:', err);
      NotificationService.error(err.message || 'Error al asignar el recurso.');
    }
  }

  async handleRemoveResource(assignmentId) {
    if (!this.currentActivityForResources) return;

    try {
      await ActivitiesService.removeResource(assignmentId);
      NotificationService.success('Recurso desvinculado de la actividad.');
      await this.loadActivityResources(this.currentActivityForResources.id);
      await this.loadActivities();
      this.syncCurrentEditingBadges();

      if (typeof this.onActivityChanged === 'function') {
        this.onActivityChanged();
      }
    } catch (err) {
      console.error('[ActivitiesController] Error removing resource:', err);
      NotificationService.error(err.message || 'Error al desvincular el recurso.');
    }
  }

  showResourcesModal() {
    if (this.modalResources) {
      this.modalResources.classList.add('show');
      this.modalResources.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  }

  closeResourcesModal() {
    if (this.modalResources) {
      this.modalResources.classList.remove('show');
      this.modalResources.style.display = 'none';
      document.body.classList.remove('modal-open');
      this.currentActivityForResources = null;
    }

    if (this.returnToActivityModal && this.currentEditingId) {
      this.returnToActivityModal = false;
      this.syncCurrentEditingBadges();
      this.showModal();
    }
  }

  // =========================================================================
  // MODAL CREAR / EDITAR ACTIVIDAD
  // =========================================================================

  updateModalSubCrudBadges(activity = null) {
    const actorsCount = activity?.actorsCount || 0;
    const totalCostUSD = (activity?.totalCostUSD || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (this.modalActActorsBadge) {
      this.modalActActorsBadge.textContent = `${actorsCount} ${actorsCount === 1 ? 'actor' : 'actores'}`;
    }

    if (this.modalActResourcesBadge) {
      this.modalActResourcesBadge.textContent = `$${totalCostUSD}`;
    }
  }

  syncCurrentEditingBadges() {
    if (!this.currentEditingId) {
      this.updateModalSubCrudBadges(null);
      return;
    }
    const act = this.activities.find(a => a.id === this.currentEditingId);
    this.updateModalSubCrudBadges(act || null);
  }

  async handleOpenSubModalFromActivityModal(type) {
    // If creating a new activity, validate and save it first so it has an ID
    if (!this.currentEditingId) {
      const projectId = this.inputProjectId?.value;
      const name = this.inputName?.value?.trim();

      if (!projectId) {
        NotificationService.warning('Selecciona primero el proyecto asociado para gestionar participantes y costos.');
        this.inputProjectId?.focus();
        return;
      }

      if (!name) {
        NotificationService.warning('Ingresa primero el nombre de la actividad para gestionar participantes y costos.');
        this.inputName?.focus();
        return;
      }

      const payload = {
        project_id: projectId,
        name,
        description: this.inputDescription?.value || '',
        weight: parseFloat(this.inputWeight?.value) || 1.00,
        progress_percentage: parseFloat(this.inputProgress?.value) || 0.00,
        start_date: this.inputStartDate?.value || null,
        end_date: this.inputEndDate?.value || null,
        status: this.inputStatus?.value || 'PENDIENTE'
      };

      this.setSubmitting(true);
      try {
        const created = await ActivitiesService.create(payload);
        if (!created?.id) {
          throw new Error('No se pudo crear la actividad.');
        }
        this.currentEditingId = created.id;
        if (this.inputId) this.inputId.value = created.id;
        if (this.modalTitle) this.modalTitle.textContent = 'Editar Actividad';
        await this.loadActivities();
        this.syncCurrentEditingBadges();

        if (typeof this.onActivityChanged === 'function') {
          this.onActivityChanged();
        }
      } catch (err) {
        console.error('[ActivitiesController] Auto-save before sub-modal error:', err);
        NotificationService.error(err.message || 'Error al guardar la actividad.');
        return;
      } finally {
        this.setSubmitting(false);
      }
    }

    const activityId = this.currentEditingId;
    if (!activityId) return;

    this.returnToActivityModal = true;
    if (this.modal) {
      this.modal.classList.remove('show');
      this.modal.style.display = 'none';
    }

    if (type === 'actors') {
      await this.openActorsModal(activityId);
    } else if (type === 'resources') {
      await this.openResourcesModal(activityId);
    }
  }

  async openCreateModal(defaultProjectId = '') {
    this.currentEditingId = null;
    this.returnToActivityModal = false;
    if (this.modalTitle) this.modalTitle.textContent = 'Nueva Actividad';
    if (this.form) this.form.reset();
    if (this.inputId) this.inputId.value = '';

    await this.loadProjectsOptions();

    if (this.inputProjectId && defaultProjectId) {
      this.inputProjectId.value = defaultProjectId;
    }
    if (this.inputWeight) this.inputWeight.value = '1.00';
    if (this.inputProgress) this.inputProgress.value = '0';
    if (this.progressValueDisplay) this.progressValueDisplay.textContent = '0%';
    if (this.inputStatus) this.inputStatus.value = 'PENDIENTE';

    this.updateModalSubCrudBadges(null);
    this.showModal();
  }

  async openEditModal(id) {
    const activity = this.activities.find(a => a.id === id);
    if (!activity) return;

    this.currentEditingId = id;
    this.returnToActivityModal = false;
    if (this.modalTitle) this.modalTitle.textContent = 'Editar Actividad';

    await this.loadProjectsOptions();

    if (this.inputId) this.inputId.value = activity.id;
    if (this.inputProjectId) this.inputProjectId.value = activity.project_id || '';
    if (this.inputName) this.inputName.value = activity.name || '';
    if (this.inputDescription) this.inputDescription.value = activity.description || '';
    if (this.inputWeight) this.inputWeight.value = activity.weight || '1.00';
    
    const progress = Math.round(Number(activity.progress_percentage) || 0);
    if (this.inputProgress) this.inputProgress.value = progress;
    if (this.progressValueDisplay) this.progressValueDisplay.textContent = `${progress}%`;
    
    if (this.inputStartDate) this.inputStartDate.value = activity.start_date || '';
    if (this.inputEndDate) this.inputEndDate.value = activity.end_date || '';
    if (this.inputStatus) this.inputStatus.value = activity.status || 'PENDIENTE';

    this.updateModalSubCrudBadges(activity);

    NativeService.impact('light');
    this.showModal();
  }

  async handleFormSubmit(event) {
    event.preventDefault();

    const projectId = this.inputProjectId?.value;
    const name = this.inputName?.value?.trim();

    if (!projectId) {
      NotificationService.warning('Debes asociar la actividad a un proyecto.');
      this.inputProjectId?.focus();
      return;
    }

    if (!name) {
      NotificationService.warning('El nombre de la actividad es obligatorio.');
      this.inputName?.focus();
      return;
    }

    const payload = {
      project_id: projectId,
      name,
      description: this.inputDescription?.value || '',
      weight: parseFloat(this.inputWeight?.value) || 1.00,
      progress_percentage: parseFloat(this.inputProgress?.value) || 0.00,
      start_date: this.inputStartDate?.value || null,
      end_date: this.inputEndDate?.value || null,
      status: this.inputStatus?.value || 'PENDIENTE'
    };

    this.setSubmitting(true);

    try {
      if (this.currentEditingId) {
        await ActivitiesService.update(this.currentEditingId, payload);
        NotificationService.success('Actividad actualizada correctamente.');
      } else {
        await ActivitiesService.create(payload);
        NotificationService.success('Actividad registrada exitosamente.');
      }

      this.closeModal();
      await this.loadActivities();

      if (typeof this.onActivityChanged === 'function') {
        this.onActivityChanged();
      }
    } catch (err) {
      console.error('[ActivitiesController] Save error:', err);
      NotificationService.error(err.message || 'Error al guardar la actividad.');
    } finally {
      this.setSubmitting(false);
    }
  }

  openDeleteModal(id) {
    const activity = this.activities.find(a => a.id === id);
    if (!activity) return;

    this.activityToDelete = activity;
    if (this.deleteNameText) {
      this.deleteNameText.textContent = `"${activity.name}"`;
    }

    NativeService.impact('medium');
    this.showDeleteModal();
  }

  async handleConfirmDelete() {
    if (!this.activityToDelete) return;

    const id = this.activityToDelete.id;
    const name = this.activityToDelete.name;

    try {
      await ActivitiesService.delete(id);
      NotificationService.success(`La actividad "${name}" ha sido eliminada.`);
      this.closeDeleteModal();
      await this.loadActivities();

      if (typeof this.onActivityChanged === 'function') {
        this.onActivityChanged();
      }
    } catch (err) {
      console.error('[ActivitiesController] Delete error:', err);
      NotificationService.error(err.message || 'Error al eliminar la actividad.');
    }
  }

  showModal() {
    if (this.modal) {
      this.modal.classList.add('show');
      this.modal.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('show');
      this.modal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  }

  showDeleteModal() {
    if (this.deleteModal) {
      this.deleteModal.classList.add('show');
      this.deleteModal.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  }

  closeDeleteModal() {
    if (this.deleteModal) {
      this.deleteModal.classList.remove('show');
      this.deleteModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      this.activityToDelete = null;
    }
  }

  setLoading(isLoading) {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.toggle('d-none', !isLoading);
    }
  }

  setSubmitting(isSubmitting) {
    if (this.btnSave) {
      this.btnSave.disabled = isSubmitting;
      this.btnSave.textContent = isSubmitting ? 'Guardando...' : 'Guardar Actividad';
    }
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
