/**
 * Project Chronos - Actors Controller
 * Orchestrates CRUD interactions, role selectors, active status toggles, and modals for Actors.
 */

import { ActorsService } from './actors.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class ActorsController {
  constructor({ onActorChanged } = {}) {
    this.onActorChanged = onActorChanged;
    this.actors = [];
    this.roles = [];
    this.currentEditingId = null;
    this.actorToDelete = null;
    this.searchDebounceTimer = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Buttons & Filters
    this.btnNewActor = document.getElementById('btn-new-actor');
    this.searchInput = document.getElementById('actor-search-input');
    this.filterRole = document.getElementById('actor-filter-role');
    this.filterStatus = document.getElementById('actor-filter-status');
    this.actorsCountBadge = document.getElementById('actors-count-badge');
    this.loadingIndicator = document.getElementById('actors-loading');

    // Table elements
    this.tableBody = document.getElementById('actors-table-body');
    this.emptyState = document.getElementById('actors-empty-state');

    // Create / Edit modal elements
    this.modal = document.getElementById('modal-actor');
    this.modalTitle = document.getElementById('modal-actor-title');
    this.form = document.getElementById('form-actor');
    this.inputId = document.getElementById('actor-id');
    this.inputFirstName = document.getElementById('actor-first-name');
    this.inputLastName = document.getElementById('actor-last-name');
    this.inputEmail = document.getElementById('actor-email');
    this.inputPhone = document.getElementById('actor-phone');
    this.selectRoleId = document.getElementById('actor-role-id');
    this.selectIsActive = document.getElementById('actor-is-active');
    this.btnSave = document.getElementById('btn-save-actor');
    this.btnCloseModal = document.getElementById('btn-close-actor-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-actor-modal');

    // Delete modal elements
    this.deleteModal = document.getElementById('modal-delete-actor');
    this.deleteNameText = document.getElementById('delete-actor-name');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-actor');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-actor');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-actor-modal');
  }

  bindEvents() {
    this.btnNewActor?.addEventListener('click', () => {
      NativeService.impact('light');
      this.openCreateModal();
    });

    this.searchInput?.addEventListener('input', () => this.debounceLoad());
    this.filterRole?.addEventListener('change', () => this.loadActors());
    this.filterStatus?.addEventListener('change', () => this.loadActors());

    this.form?.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.btnCancelModal?.addEventListener('click', () => this.closeModal());

    this.btnConfirmDelete?.addEventListener('click', () => this.handleConfirmDelete());
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());
  }

  debounceLoad() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.loadActors();
    }, 300);
  }

  async loadRolesOptions() {
    try {
      this.roles = await ActorsService.getRolesList();

      if (this.filterRole) {
        const current = this.filterRole.value;
        this.filterRole.innerHTML = `
          <option value="">Todos los Roles</option>
          ${this.roles.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${this.formatRoleName(r.name)}</option>`).join('')}
        `;
      }

      if (this.selectRoleId) {
        const current = this.selectRoleId.value;
        this.selectRoleId.innerHTML = `
          <option value="">-- Selecciona un Rol * --</option>
          ${this.roles.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${this.formatRoleName(r.name)} - ${this.escapeHtml(r.description || '')}</option>`).join('')}
        `;
      }
    } catch (err) {
      console.error('[ActorsController] Error loading roles:', err);
    }
  }

  async loadActors() {
    this.setLoading(true);

    try {
      if (this.roles.length === 0) {
        await this.loadRolesOptions();
      }

      const roleId = this.filterRole?.value || '';
      const isActive = this.filterStatus?.value || '';
      const query = this.searchInput?.value?.trim() || '';

      this.actors = await ActorsService.getAll({ roleId, isActive, query });
      this.render();
    } catch (err) {
      console.error('[ActorsController] Load error:', err);
      NotificationService.error(err.message || 'Error al cargar los actores.');
    } finally {
      this.setLoading(false);
    }
  }

  render() {
    if (this.actorsCountBadge) {
      const count = this.actors.length;
      this.actorsCountBadge.textContent = `${count} ${count === 1 ? 'colaborador' : 'colaboradores'}`;
    }

    if (!this.tableBody) return;

    if (this.actors.length === 0) {
      this.tableBody.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('d-none');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('d-none');

    this.tableBody.innerHTML = this.actors.map(actor => {
      const fullName = `${actor.first_name} ${actor.last_name}`;
      const initials = (actor.first_name[0] || '' + actor.last_name[0] || '').toUpperCase();
      const roleName = actor.roles?.name || 'Sin Rol';
      const roleBadge = this.getRoleBadge(roleName);
      const activitiesCount = actor.activitiesCount || 0;
      const statusBadge = actor.is_active 
        ? '<span class="badge bg-success px-2 py-1">Activo</span>'
        : '<span class="badge bg-light text-muted border px-2 py-1">Inactivo</span>';

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2.5">
              <div class="actor-avatar-circle">
                ${initials}
              </div>
              <div>
                <a href="#" class="fw-bold text-primary text-decoration-none fs-6 btn-edit-actor d-inline-block" data-id="${actor.id}" title="Editar Colaborador">${this.escapeHtml(fullName)}</a>
                <div class="text-muted small">${this.escapeHtml(actor.email)}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="small">${actor.phone ? `📞 ${this.escapeHtml(actor.phone)}` : '<span class="text-muted">No registrado</span>'}</div>
          </td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <span class="badge bg-light text-dark border font-monospace">
              ⚡ ${activitiesCount} ${activitiesCount === 1 ? 'actividad' : 'actividades'}
            </span>
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-secondary btn-toggle-actor-status" data-id="${actor.id}" data-active="${actor.is_active}" title="${actor.is_active ? 'Desactivar' : 'Activar'}">
                ${actor.is_active ? '⏸️' : '▶️'}
              </button>
              <button class="btn btn-outline-danger btn-delete-actor" data-id="${actor.id}" title="Eliminar">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners
    this.tableBody.querySelectorAll('.btn-toggle-actor-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const currentActive = btn.getAttribute('data-active') === 'true';
        await this.handleToggleStatus(id, !currentActive);
      });
    });

    this.tableBody.querySelectorAll('.btn-edit-actor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete-actor').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openDeleteModal(id);
      });
    });
  }

  getRoleBadge(roleName) {
    const config = {
      'sysadmin': { label: 'SysAdmin', class: 'badge bg-primary' },
      'gerente_proyecto': { label: 'Gerente Proyecto', class: 'badge bg-info text-dark' },
      'supervisor': { label: 'Supervisor', class: 'badge bg-warning text-dark' },
      'colaborador': { label: 'Colaborador', class: 'badge bg-secondary' }
    };

    const current = config[roleName] || { label: this.formatRoleName(roleName), class: 'badge bg-light text-dark border' };
    return `<span class="${current.class} px-2 py-1">${current.label}</span>`;
  }

  formatRoleName(str = '') {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async openCreateModal() {
    this.currentEditingId = null;
    if (this.modalTitle) this.modalTitle.textContent = 'Nuevo Colaborador';
    if (this.form) this.form.reset();
    if (this.inputId) this.inputId.value = '';

    await this.loadRolesOptions();

    if (this.selectIsActive) this.selectIsActive.value = 'true';
    if (this.selectRoleId && this.roles.length > 0) {
      // Default to colaborador if exists
      const colab = this.roles.find(r => r.name === 'colaborador');
      if (colab) this.selectRoleId.value = colab.id;
    }

    this.showModal();
  }

  async openEditModal(id) {
    const actor = this.actors.find(a => a.id === id);
    if (!actor) return;

    this.currentEditingId = id;
    if (this.modalTitle) this.modalTitle.textContent = 'Editar Colaborador';

    await this.loadRolesOptions();

    if (this.inputId) this.inputId.value = actor.id;
    if (this.inputFirstName) this.inputFirstName.value = actor.first_name || '';
    if (this.inputLastName) this.inputLastName.value = actor.last_name || '';
    if (this.inputEmail) this.inputEmail.value = actor.email || '';
    if (this.inputPhone) this.inputPhone.value = actor.phone || '';
    if (this.selectRoleId) this.selectRoleId.value = actor.role_id || '';
    if (this.selectIsActive) this.selectIsActive.value = String(actor.is_active);

    NativeService.impact('light');
    this.showModal();
  }

  async handleFormSubmit(event) {
    event.preventDefault();

    const firstName = this.inputFirstName?.value?.trim();
    const lastName = this.inputLastName?.value?.trim();
    const email = this.inputEmail?.value?.trim();
    const roleId = this.selectRoleId?.value;
    const phone = this.inputPhone?.value?.trim() || null;
    const isActive = this.selectIsActive?.value === 'true';

    if (!firstName || !lastName) {
      NotificationService.warning('El nombre y apellido son obligatorios.');
      return;
    }

    if (!email) {
      NotificationService.warning('El correo electrónico es obligatorio.');
      this.inputEmail?.focus();
      return;
    }

    if (!roleId) {
      NotificationService.warning('Debes seleccionar un rol para el colaborador.');
      this.selectRoleId?.focus();
      return;
    }

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      role_id: roleId,
      is_active: isActive
    };

    this.setSubmitting(true);

    try {
      if (this.currentEditingId) {
        await ActorsService.update(this.currentEditingId, payload);
        NotificationService.success('Colaborador actualizado correctamente.');
      } else {
        await ActorsService.create(payload);
        NotificationService.success('Colaborador registrado exitosamente.');
      }

      this.closeModal();
      await this.loadActors();

      if (typeof this.onActorChanged === 'function') {
        this.onActorChanged();
      }
    } catch (err) {
      console.error('[ActorsController] Save error:', err);
      NotificationService.error(err.message || 'Error al guardar los datos del colaborador.');
    } finally {
      this.setSubmitting(false);
    }
  }

  async handleToggleStatus(id, newStatus) {
    try {
      await ActorsService.toggleActive(id, newStatus);
      NotificationService.success(`Estado del colaborador cambiado a ${newStatus ? 'Activo' : 'Inactivo'}.`);
      await this.loadActors();

      if (typeof this.onActorChanged === 'function') {
        this.onActorChanged();
      }
    } catch (err) {
      console.error('[ActorsController] Toggle status error:', err);
      NotificationService.error(err.message || 'Error al cambiar estado.');
    }
  }

  openDeleteModal(id) {
    const actor = this.actors.find(a => a.id === id);
    if (!actor) return;

    this.actorToDelete = actor;
    if (this.deleteNameText) {
      this.deleteNameText.textContent = `"${actor.first_name} ${actor.last_name}"`;
    }

    NativeService.impact('medium');
    this.showDeleteModal();
  }

  async handleConfirmDelete() {
    if (!this.actorToDelete) return;

    const id = this.actorToDelete.id;
    const name = `${this.actorToDelete.first_name} ${this.actorToDelete.last_name}`;

    try {
      await ActorsService.delete(id);
      NotificationService.success(`El colaborador "${name}" ha sido eliminado.`);
      this.closeDeleteModal();
      await this.loadActors();

      if (typeof this.onActorChanged === 'function') {
        this.onActorChanged();
      }
    } catch (err) {
      console.error('[ActorsController] Delete error:', err);
      NotificationService.error(err.message || 'Error al eliminar al colaborador.');
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
      this.actorToDelete = null;
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
      this.btnSave.textContent = isSubmitting ? 'Guardando...' : 'Guardar Colaborador';
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
