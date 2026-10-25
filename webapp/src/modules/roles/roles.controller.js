/**
 * Project Chronos - Roles Controller
 * Manages full CRUD operations, validations, protected role guards, and modals for Roles.
 */

import { RolesService } from './roles.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class RolesController {
  constructor({ onRoleChanged } = {}) {
    this.onRoleChanged = onRoleChanged;
    this.roles = [];
    this.currentEditingId = null;
    this.roleToDelete = null;
    this.searchDebounceTimer = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Buttons & Filters
    this.btnNewRole = document.getElementById('btn-new-role');
    this.searchInput = document.getElementById('role-search-input');
    this.rolesCountBadge = document.getElementById('roles-count-badge');
    this.loadingIndicator = document.getElementById('roles-loading');

    // Table elements
    this.tableBody = document.getElementById('roles-table-body');
    this.emptyState = document.getElementById('roles-empty-state');

    // Create / Edit modal elements
    this.modal = document.getElementById('modal-role');
    this.modalTitle = document.getElementById('modal-role-title');
    this.form = document.getElementById('form-role');
    this.inputId = document.getElementById('role-id');
    this.inputName = document.getElementById('role-name');
    this.inputDescription = document.getElementById('role-description');
    this.btnSave = document.getElementById('btn-save-role');
    this.btnCloseModal = document.getElementById('btn-close-role-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-role-modal');

    // Delete modal elements
    this.deleteModal = document.getElementById('modal-delete-role');
    this.deleteRoleNameText = document.getElementById('delete-role-name');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-role');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-role');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-role-modal');
  }

  bindEvents() {
    this.btnNewRole?.addEventListener('click', () => {
      NativeService.impact('light');
      this.openCreateModal();
    });

    this.searchInput?.addEventListener('input', () => this.debounceLoad());

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
      this.loadRoles();
    }, 300);
  }

  /**
   * Fetches roles and triggers rendering
   */
  async loadRoles() {
    this.setLoading(true);

    try {
      const query = this.searchInput?.value?.trim() || '';
      this.roles = await RolesService.getAll({ query });
      this.render();
    } catch (err) {
      console.error('[RolesController] Load error:', err);
      NotificationService.error(err.message || 'Error al cargar los roles.');
    } finally {
      this.setLoading(false);
    }
  }

  render() {
    if (this.rolesCountBadge) {
      const count = this.roles.length;
      this.rolesCountBadge.textContent = `${count} ${count === 1 ? 'rol' : 'roles'}`;
    }

    if (!this.tableBody) return;

    if (this.roles.length === 0) {
      this.tableBody.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('d-none');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('d-none');

    this.tableBody.innerHTML = this.roles.map(r => {
      const isSysAdmin = r.name === 'sysadmin';
      const roleBadge = this.getRoleBadge(r.name);
      const actorsCount = r.actorsCount || 0;
      const permissionsCount = r.permissionsCount || 0;

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2 mb-1">
              ${roleBadge}
              ${isSysAdmin ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle small py-0.5 px-1.5" title="Rol del sistema inmutable">🔒 Protegido</span>' : ''}
            </div>
            <div class="small font-monospace text-muted">clave: <code>${this.escapeHtml(r.name)}</code></div>
          </td>
          <td>
            <div class="text-dark small">${this.escapeHtml(r.description || 'Sin descripción')}</div>
          </td>
          <td>
            <span class="badge bg-light text-dark border font-monospace">
              👥 ${actorsCount} ${actorsCount === 1 ? 'colaborador' : 'colaboradores'}
            </span>
          </td>
          <td>
            <span class="badge bg-light text-dark border font-monospace">
              🔐 ${permissionsCount} ${permissionsCount === 1 ? 'permiso' : 'permisos'}
            </span>
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-primary btn-edit-role" data-id="${r.id}" title="Editar Rol">
                ✏️ Editar
              </button>
              ${isSysAdmin 
                ? '<button class="btn btn-outline-secondary disabled" title="El rol maestro no puede eliminarse" disabled>🔒</button>'
                : `<button class="btn btn-outline-danger btn-delete-role" data-id="${r.id}" title="Eliminar Rol">🗑️</button>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners
    this.tableBody.querySelectorAll('.btn-edit-role').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete-role').forEach(btn => {
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
    return `<span class="${current.class} px-2 py-1 fs-6">${current.label}</span>`;
  }

  formatRoleName(str = '') {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  openCreateModal() {
    this.currentEditingId = null;
    if (this.modalTitle) this.modalTitle.textContent = 'Nuevo Rol del Sistema';
    if (this.form) this.form.reset();
    if (this.inputId) this.inputId.value = '';
    if (this.inputName) {
      this.inputName.disabled = false;
      this.inputName.value = '';
    }

    this.showModal();
  }

  openEditModal(id) {
    const role = this.roles.find(r => r.id === id);
    if (!role) return;

    this.currentEditingId = id;
    if (this.modalTitle) this.modalTitle.textContent = 'Editar Rol';

    if (this.inputId) this.inputId.value = role.id;
    if (this.inputName) {
      this.inputName.value = role.name || '';
      // sysadmin name cannot be renamed
      this.inputName.disabled = (role.name === 'sysadmin');
    }
    if (this.inputDescription) this.inputDescription.value = role.description || '';

    NativeService.impact('light');
    this.showModal();
  }

  async handleFormSubmit(event) {
    event.preventDefault();

    const name = this.inputName?.value?.trim();
    const description = this.inputDescription?.value?.trim() || '';

    if (!name) {
      NotificationService.warning('El nombre del rol es obligatorio.');
      this.inputName?.focus();
      return;
    }

    const payload = { name, description };
    this.setSubmitting(true);

    try {
      if (this.currentEditingId) {
        await RolesService.update(this.currentEditingId, payload);
        NotificationService.success('Rol actualizado correctamente.');
      } else {
        await RolesService.create(payload);
        NotificationService.success('Rol registrado exitosamente.');
      }

      this.closeModal();
      await this.loadRoles();

      if (typeof this.onRoleChanged === 'function') {
        this.onRoleChanged();
      }
    } catch (err) {
      console.error('[RolesController] Save error:', err);
      NotificationService.error(err.message || 'Error al guardar el rol.');
    } finally {
      this.setSubmitting(false);
    }
  }

  openDeleteModal(id) {
    const role = this.roles.find(r => r.id === id);
    if (!role) return;

    if (role.name === 'sysadmin') {
      NotificationService.warning('El rol sysadmin es el rol maestro del sistema y no puede ser eliminado.');
      return;
    }

    this.roleToDelete = role;
    if (this.deleteRoleNameText) {
      this.deleteRoleNameText.textContent = `"${role.name}"`;
    }

    NativeService.impact('medium');
    this.showDeleteModal();
  }

  async handleConfirmDelete() {
    if (!this.roleToDelete) return;

    const id = this.roleToDelete.id;
    const name = this.roleToDelete.name;

    try {
      await RolesService.delete(id);
      NotificationService.success(`El rol "${name}" ha sido eliminado.`);
      this.closeDeleteModal();
      await this.loadRoles();

      if (typeof this.onRoleChanged === 'function') {
        this.onRoleChanged();
      }
    } catch (err) {
      console.error('[RolesController] Delete error:', err);
      NotificationService.error(err.message || 'Error al eliminar el rol.');
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
      this.roleToDelete = null;
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
      this.btnSave.textContent = isSubmitting ? 'Guardando...' : 'Guardar Rol';
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
