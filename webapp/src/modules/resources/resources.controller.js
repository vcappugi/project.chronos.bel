/**
 * Project Chronos - Resources Controller
 * Manages full CRUD operations, validations, activity link checks, and modals for public.recursos.
 */

import { ResourcesService } from './resources.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class ResourcesController {
  constructor({ onResourceChanged } = {}) {
    this.onResourceChanged = onResourceChanged;
    this.resources = [];
    this.currentEditingId = null;
    this.resourceToDelete = null;
    this.searchDebounceTimer = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Buttons & Filters
    this.btnNewResource = document.getElementById('btn-new-resource');
    this.searchInput = document.getElementById('resource-search-input');
    this.filterUnitType = document.getElementById('resource-filter-unit-type');
    this.countBadge = document.getElementById('resources-count-badge');
    this.loadingIndicator = document.getElementById('resources-loading');

    // Table elements
    this.tableBody = document.getElementById('resources-table-body');
    this.emptyState = document.getElementById('resources-empty-state');

    // Create / Edit modal elements
    this.modal = document.getElementById('modal-resource');
    this.modalTitle = document.getElementById('modal-resource-title');
    this.form = document.getElementById('form-resource');
    this.inputId = document.getElementById('resource-id');
    this.inputName = document.getElementById('resource-name');
    this.inputUnitType = document.getElementById('resource-unit-type');
    this.inputUnitCost = document.getElementById('resource-unit-cost');
    this.btnSave = document.getElementById('btn-save-resource');
    this.btnCloseModal = document.getElementById('btn-close-resource-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-resource-modal');

    // Delete modal elements
    this.deleteModal = document.getElementById('modal-delete-resource');
    this.deleteResourceNameText = document.getElementById('delete-resource-name');
    this.deleteResourceWarning = document.getElementById('delete-resource-warning');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-resource');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-resource');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-resource-modal');
  }

  bindEvents() {
    this.btnNewResource?.addEventListener('click', () => {
      NativeService.impact('light');
      this.openCreateModal();
    });

    this.searchInput?.addEventListener('input', () => this.debounceLoad());
    this.filterUnitType?.addEventListener('change', () => this.loadResources());

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
      this.loadResources();
    }, 300);
  }

  /**
   * Loads resources and renders them
   */
  async loadResources() {
    this.setLoading(true);

    try {
      const query = this.searchInput?.value?.trim() || '';
      const unitType = this.filterUnitType?.value || '';

      this.resources = await ResourcesService.getAll({ query, unitType });
      this.render();
    } catch (err) {
      console.error('[ResourcesController] Load error:', err);
      NotificationService.error(err.message || 'Error al cargar los recursos.');
    } finally {
      this.setLoading(false);
    }
  }

  render() {
    if (this.countBadge) {
      const count = this.resources.length;
      this.countBadge.textContent = `${count} ${count === 1 ? 'recurso' : 'recursos'}`;
    }

    if (!this.tableBody) return;

    if (this.resources.length === 0) {
      this.tableBody.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('d-none');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('d-none');

    this.tableBody.innerHTML = this.resources.map(res => {
      const unitCost = Number(res.unit_cost_usd || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const unitBadge = this.getUnitTypeBadge(res.unit_type);
      const activitiesCount = res.activitiesCount || 0;
      const usageBadge = activitiesCount > 0
        ? `<span class="badge bg-light text-primary border small fw-semibold">⚡ ${activitiesCount} ${activitiesCount === 1 ? 'actividad' : 'actividades'}</span>`
        : `<span class="badge bg-light text-muted border small">Sin asignar</span>`;

      return `
        <tr>
          <!-- 1. Nombre del Recurso -->
          <td class="td-res-name">
            <a href="#" class="fw-bold text-primary text-decoration-none res-row-title btn-edit-resource d-inline-block" data-id="${res.id}" title="Editar Recurso">${this.escapeHtml(res.name)}</a>
            <!-- Subtítulo resumen para versión móvil / Android -->
            <div class="res-mobile-meta d-none">
              ${unitBadge}
              <span class="font-monospace fw-bold text-success small">$${unitCost}</span>
              ${activitiesCount > 0 ? `<span class="small text-muted">⚡ ${activitiesCount} act.</span>` : ''}
            </div>
          </td>

          <!-- 2. Tipo de Unidad (Desktop) -->
          <td class="td-res-type text-center">
            ${unitBadge}
          </td>

          <!-- 3. Costo Unitario en USD -->
          <td class="td-res-cost text-center font-monospace fw-bold text-dark">
            <span class="text-success">$${unitCost}</span>
            <span class="small text-muted fw-normal">/ ${this.escapeHtml(res.unit_type || 'UND')}</span>
          </td>

          <!-- 4. Uso en Actividades (Desktop) -->
          <td class="td-res-usage text-center">
            ${usageBadge}
          </td>

          <!-- 5. Acciones -->
          <td class="td-res-actions text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-danger btn-delete-resource" data-id="${res.id}" title="Eliminar Recurso">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners to dynamic buttons
    this.tableBody.querySelectorAll('.btn-edit-resource').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete-resource').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openDeleteModal(id);
      });
    });
  }

  getUnitTypeBadge(unitType) {
    const typeUpper = (unitType || 'UNIDAD').toUpperCase();
    const styleMap = {
      'HORA': 'bg-primary',
      'UNIDAD': 'bg-info text-dark',
      'GLOBAL': 'bg-secondary',
      'METRO': 'bg-warning text-dark',
      'KG': 'bg-warning text-dark',
      'LITRO': 'bg-info text-dark',
      'DIA': 'bg-primary',
      'MES': 'bg-dark text-white',
      'SERVICIO': 'bg-success'
    };

    const badgeClass = styleMap[typeUpper] || 'bg-light text-dark border';
    return `<span class="badge ${badgeClass} text-uppercase px-2 py-1">${this.escapeHtml(typeUpper)}</span>`;
  }

  openCreateModal() {
    this.currentEditingId = null;
    if (this.modalTitle) this.modalTitle.textContent = 'Nuevo Recurso';
    this.form?.reset();
    if (this.inputId) this.inputId.value = '';
    if (this.inputUnitType) this.inputUnitType.value = 'UNIDAD';
    if (this.inputUnitCost) this.inputUnitCost.value = '0.00';

    this.modal?.classList.add('show');
    this.modal?.setAttribute('style', 'display: block;');
    this.inputName?.focus();
  }

  async openEditModal(id) {
    this.currentEditingId = id;
    if (this.modalTitle) this.modalTitle.textContent = 'Editar Recurso';

    const res = this.resources.find(r => r.id === id);
    if (!res) return;

    if (this.inputId) this.inputId.value = res.id;
    if (this.inputName) this.inputName.value = res.name || '';
    if (this.inputUnitType) this.inputUnitType.value = res.unit_type || 'UNIDAD';
    if (this.inputUnitCost) this.inputUnitCost.value = Number(res.unit_cost_usd || 0).toFixed(2);

    this.modal?.classList.add('show');
    this.modal?.setAttribute('style', 'display: block;');
    this.inputName?.focus();
  }

  closeModal() {
    this.modal?.classList.remove('show');
    this.modal?.setAttribute('style', 'display: none;');
    this.currentEditingId = null;
    this.form?.reset();
  }

  async handleFormSubmit(e) {
    e.preventDefault();

    const name = this.inputName?.value?.trim();
    const unitType = this.inputUnitType?.value?.trim()?.toUpperCase() || 'UNIDAD';
    const unitCost = Number(this.inputUnitCost?.value);

    if (!name) {
      NotificationService.warning('Por favor ingresa el nombre del recurso.');
      this.inputName?.focus();
      return;
    }

    if (isNaN(unitCost) || unitCost < 0) {
      NotificationService.warning('El costo unitario debe ser un monto positivo o cero.');
      this.inputUnitCost?.focus();
      return;
    }

    if (this.btnSave) {
      this.btnSave.disabled = true;
      this.btnSave.textContent = 'Guardando...';
    }

    try {
      const payload = {
        name,
        unit_type: unitType,
        unit_cost_usd: unitCost
      };

      if (this.currentEditingId) {
        await ResourcesService.update(this.currentEditingId, payload);
        NotificationService.success('Recurso actualizado con éxito.');
        NativeService.hapticNotification('success');
      } else {
        await ResourcesService.create(payload);
        NotificationService.success('Recurso registrado con éxito.');
        NativeService.hapticNotification('success');
      }

      this.closeModal();
      await this.loadResources();

      if (typeof this.onResourceChanged === 'function') {
        this.onResourceChanged();
      }
    } catch (err) {
      console.error('[ResourcesController] Submit error:', err);
      NotificationService.error(err.message || 'Error al guardar el recurso.');
      NativeService.hapticNotification('error');
    } finally {
      if (this.btnSave) {
        this.btnSave.disabled = false;
        this.btnSave.textContent = 'Guardar Recurso';
      }
    }
  }

  openDeleteModal(id) {
    const res = this.resources.find(r => r.id === id);
    if (!res) return;

    this.resourceToDelete = res;
    if (this.deleteResourceNameText) {
      this.deleteResourceNameText.textContent = res.name;
    }

    // Inform user if resource has activity dependencies
    if (this.deleteResourceWarning) {
      const count = res.activitiesCount || 0;
      if (count > 0) {
        this.deleteResourceWarning.textContent = `Atención: Este recurso está asignado a ${count} ${count === 1 ? 'actividad' : 'actividades'}. El sistema protegerá la integridad referencial.`;
        this.deleteResourceWarning.classList.remove('d-none');
        if (this.btnConfirmDelete) this.btnConfirmDelete.disabled = true;
      } else {
        this.deleteResourceWarning.textContent = '';
        this.deleteResourceWarning.classList.add('d-none');
        if (this.btnConfirmDelete) this.btnConfirmDelete.disabled = false;
      }
    }

    this.deleteModal?.classList.add('show');
    this.deleteModal?.setAttribute('style', 'display: block;');
  }

  closeDeleteModal() {
    this.deleteModal?.classList.remove('show');
    this.deleteModal?.setAttribute('style', 'display: none;');
    this.resourceToDelete = null;
  }

  async handleConfirmDelete() {
    if (!this.resourceToDelete) return;

    const id = this.resourceToDelete.id;
    if (this.btnConfirmDelete) {
      this.btnConfirmDelete.disabled = true;
      this.btnConfirmDelete.textContent = 'Eliminando...';
    }

    try {
      await ResourcesService.delete(id);
      NotificationService.success('Recurso eliminado satisfactoriamente.');
      NativeService.hapticNotification('success');

      this.closeDeleteModal();
      await this.loadResources();

      if (typeof this.onResourceChanged === 'function') {
        this.onResourceChanged();
      }
    } catch (err) {
      console.error('[ResourcesController] Delete error:', err);
      NotificationService.error(err.message || 'Error al eliminar el recurso.');
      NativeService.hapticNotification('error');
    } finally {
      if (this.btnConfirmDelete) {
        this.btnConfirmDelete.disabled = false;
        this.btnConfirmDelete.textContent = 'Sí, Eliminar';
      }
    }
  }

  setLoading(isLoading) {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.toggle('d-none', !isLoading);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
