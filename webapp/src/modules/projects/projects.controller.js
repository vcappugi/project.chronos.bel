/**
 * Project Chronos - Projects Controller
 * Orchestrates CRUD interactions, modals, filters, and rendering for Projects.
 */

import { ProjectsService } from './projects.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class ProjectsController {
  constructor() {
    this.projects = [];
    this.currentEditingId = null;
    this.projectToDelete = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Buttons & Filter controls
    this.btnNewProject = document.getElementById('btn-new-project');
    this.searchInput = document.getElementById('project-search-input');
    this.filterStatus = document.getElementById('project-filter-status');
    this.projectsCountBadge = document.getElementById('projects-count-badge');

    // Table elements
    this.tableBody = document.getElementById('projects-table-body');
    this.emptyState = document.getElementById('projects-empty-state');
    this.loadingIndicator = document.getElementById('projects-loading');

    // Form modal elements
    this.modal = document.getElementById('modal-project');
    this.modalTitle = document.getElementById('modal-project-title');
    this.form = document.getElementById('form-project');
    this.inputId = document.getElementById('project-id');
    this.inputName = document.getElementById('project-name');
    this.inputDescription = document.getElementById('project-description');
    this.inputStartDate = document.getElementById('project-start-date');
    this.inputEndDate = document.getElementById('project-end-date');
    this.inputStatus = document.getElementById('project-status');
    this.btnSave = document.getElementById('btn-save-project');
    this.btnCloseModal = document.getElementById('btn-close-project-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-project-modal');

    // Delete confirmation modal
    this.deleteModal = document.getElementById('modal-delete-project');
    this.deleteProjectNameText = document.getElementById('delete-project-name');
    this.btnConfirmDelete = document.getElementById('btn-confirm-delete-project');
    this.btnCancelDelete = document.getElementById('btn-cancel-delete-modal');
    this.btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
  }

  bindEvents() {
    // New project button
    this.btnNewProject?.addEventListener('click', () => {
      NativeService.impact('light');
      this.openCreateModal();
    });

    // Search and filter inputs
    this.searchInput?.addEventListener('input', () => this.debounceLoad());
    this.filterStatus?.addEventListener('change', () => this.loadProjects());

    // Project form submit
    this.form?.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Close form modal
    this.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.btnCancelModal?.addEventListener('click', () => this.closeModal());

    // Delete modal events
    this.btnConfirmDelete?.addEventListener('click', () => this.handleConfirmDelete());
    this.btnCancelDelete?.addEventListener('click', () => this.closeDeleteModal());
    this.btnCloseDeleteModal?.addEventListener('click', () => this.closeDeleteModal());
  }

  debounceLoad() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.loadProjects();
    }, 300);
  }

  /**
   * Loads projects from Supabase and renders them
   */
  async loadProjects() {
    this.setLoading(true);

    try {
      const status = this.filterStatus?.value || '';
      const query = this.searchInput?.value?.trim() || '';

      this.projects = await ProjectsService.getAll({ status, query });
      this.render();
    } catch (err) {
      console.error('[ProjectsController] Load error:', err);
      NotificationService.error(err.message || 'Error al cargar los proyectos.');
    } finally {
      this.setLoading(false);
    }
  }

  render() {
    if (this.projectsCountBadge) {
      this.projectsCountBadge.textContent = `${this.projects.length} ${this.projects.length === 1 ? 'proyecto' : 'proyectos'}`;
    }

    if (!this.tableBody) return;

    if (this.projects.length === 0) {
      this.tableBody.innerHTML = '';
      this.emptyState?.classList.remove('d-none');
      return;
    }

    this.emptyState?.classList.add('d-none');

    this.tableBody.innerHTML = this.projects.map(proj => {
      const statusBadge = this.getStatusBadge(proj.status);
      const rawStart = proj.start_date ? this.formatDate(proj.start_date) : '';
      const rawEnd = proj.end_date ? this.formatDate(proj.end_date) : '';
      const startDate = rawStart || '<span class="text-muted">No definida</span>';
      const endDate = rawEnd || '<span class="text-muted">No definida</span>';
      const dateRangeText = (rawStart && rawEnd)
        ? `📅 ${rawStart} - ${rawEnd}`
        : (rawStart ? `📅 Desde ${rawStart}` : (rawEnd ? `📅 Hasta ${rawEnd}` : ''));

      return `
        <tr>
          <td class="td-project-info">
            <a href="#" class="fw-bold text-primary text-decoration-none project-row-name btn-edit-project d-inline-block" data-id="${proj.id}" title="Editar Proyecto">${this.escapeHtml(proj.name)}</a>
            <div class="text-muted small project-row-desc">${this.escapeHtml(proj.description || 'Sin descripción')}</div>
            ${dateRangeText ? `<div class="project-row-dates-mobile d-none">${dateRangeText}</div>` : ''}
          </td>
          <td class="td-project-status text-center">${statusBadge}</td>
          <td class="td-project-dates">
            <div class="small"><strong>Inicio:</strong> ${startDate}</div>
            <div class="small"><strong>Fin:</strong> ${endDate}</div>
          </td>
          <td class="td-project-actions text-end">
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-danger btn-delete-project" data-id="${proj.id}" title="Eliminar">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach dynamic click listeners to Edit and Delete buttons
    this.tableBody.querySelectorAll('.btn-edit-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openDeleteModal(id);
      });
    });
  }

  getStatusBadge(status) {
    const config = {
      'PLANIFICACION': { label: 'Planificación', class: 'badge bg-info text-dark' },
      'EN_EJECUCION': { label: 'En Ejecución', class: 'badge bg-primary' },
      'SUSPENDIDO': { label: 'Suspendido', class: 'badge bg-warning text-dark' },
      'FINALIZADO': { label: 'Finalizado', class: 'badge bg-success' }
    };

    const current = config[status] || { label: status || 'Desconocido', class: 'badge bg-secondary' };
    return `<span class="${current.class} px-2 py-1">${current.label}</span>`;
  }

  openCreateModal() {
    this.currentEditingId = null;
    if (this.modalTitle) this.modalTitle.textContent = 'Nuevo Proyecto';
    if (this.form) this.form.reset();
    if (this.inputId) this.inputId.value = '';
    if (this.inputStatus) this.inputStatus.value = 'PLANIFICACION';

    this.showModal();
  }

  openEditModal(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    this.currentEditingId = id;
    if (this.modalTitle) this.modalTitle.textContent = 'Editar Proyecto';

    if (this.inputId) this.inputId.value = project.id;
    if (this.inputName) this.inputName.value = project.name || '';
    if (this.inputDescription) this.inputDescription.value = project.description || '';
    if (this.inputStartDate) this.inputStartDate.value = project.start_date || '';
    if (this.inputEndDate) this.inputEndDate.value = project.end_date || '';
    if (this.inputStatus) this.inputStatus.value = project.status || 'PLANIFICACION';

    NativeService.impact('light');
    this.showModal();
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

  openDeleteModal(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    this.projectToDelete = project;
    if (this.deleteProjectNameText) {
      this.deleteProjectNameText.textContent = project.name;
    }

    if (this.deleteModal) {
      this.deleteModal.classList.add('show');
      this.deleteModal.style.display = 'block';
      document.body.classList.add('modal-open');
    }
  }

  closeDeleteModal() {
    this.projectToDelete = null;
    if (this.deleteModal) {
      this.deleteModal.classList.remove('show');
      this.deleteModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  }

  async handleFormSubmit(event) {
    event.preventDefault();

    const name = this.inputName?.value?.trim();
    if (!name) {
      NotificationService.warning('El nombre del proyecto es obligatorio.');
      return;
    }

    const payload = {
      name: name,
      description: this.inputDescription?.value?.trim() || null,
      start_date: this.inputStartDate?.value || null,
      end_date: this.inputEndDate?.value || null,
      status: this.inputStatus?.value || 'PLANIFICACION'
    };

    this.setSubmitting(true);

    try {
      if (this.currentEditingId) {
        await ProjectsService.update(this.currentEditingId, payload);
        NativeService.hapticNotification('success');
        NotificationService.success('Proyecto actualizado con éxito.');
      } else {
        await ProjectsService.create(payload);
        NativeService.hapticNotification('success');
        NotificationService.success('Proyecto creado correctamente.');
      }

      this.closeModal();
      await this.loadProjects();
    } catch (err) {
      NativeService.hapticNotification('error');
      NotificationService.error(err.message || 'Error al guardar el proyecto.');
    } finally {
      this.setSubmitting(false);
    }
  }

  async handleConfirmDelete() {
    if (!this.projectToDelete) return;

    const projectId = this.projectToDelete.id;
    const projectName = this.projectToDelete.name;

    try {
      await ProjectsService.delete(projectId);
      NativeService.hapticNotification('success');
      NotificationService.success(`Proyecto "${projectName}" eliminado.`);
      this.closeDeleteModal();
      await this.loadProjects();
    } catch (err) {
      NativeService.hapticNotification('error');
      NotificationService.error(err.message || 'Error al eliminar el proyecto.');
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
      this.btnSave.textContent = isSubmitting ? 'Guardando...' : 'Guardar Proyecto';
    }
  }

  formatDate(dateString) {
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
