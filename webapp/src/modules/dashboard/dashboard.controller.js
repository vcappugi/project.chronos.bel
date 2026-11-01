/**
 * Project Chronos - Dashboard Controller
 * Orchestrates executive metric KPIs, project progress table, distribution bars, and audit stream.
 */

import { DashboardService } from './dashboard.service.js';
import { NativeService } from '../../services/native.service.js';
import { NotificationService } from '../../services/notification.service.js';

export class DashboardController {
  constructor({ onNavigateToProjects }) {
    this.onNavigateToProjects = onNavigateToProjects;
    this.isLoading = false;
    this.auditDebounceTimer = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // KPI Badges and values
    this.kpiTotalProjects = document.getElementById('kpi-total-projects');
    this.kpiCountPlan = document.getElementById('kpi-count-plan');
    this.kpiCountExec = document.getElementById('kpi-count-exec');
    this.kpiAvgProgress = document.getElementById('kpi-avg-progress');
    this.kpiProgressBar = document.getElementById('kpi-progress-bar');
    this.kpiTotalBudget = document.getElementById('kpi-total-budget');
    this.kpiTotalActivities = document.getElementById('kpi-total-activities');
    this.kpiTotalActors = document.getElementById('kpi-total-actors');

    // Projects summary table
    this.projectsTableBody = document.getElementById('dash-projects-table-body');
    this.projectsEmpty = document.getElementById('dash-projects-empty');

    // Distribution and Gantt
    this.statusDistributionContainer = document.getElementById('dash-status-distribution-container');
    this.ganttContainer = document.getElementById('dash-gantt-container');
    this.ganttEmpty = document.getElementById('dash-gantt-empty');
    this.ganttCountBadge = document.getElementById('dash-gantt-count-badge');

    // Controls
    this.filterProject = document.getElementById('dash-filter-project');
    this.btnRefresh = document.getElementById('btn-refresh-dashboard');
    this.refreshSpinner = document.getElementById('dash-refresh-spinner');
    this.btnNewProject = document.getElementById('btn-dash-new-project');
    this.btnViewAllProjects = document.getElementById('btn-dash-view-all-projects');
    this.btnCreateFirstProject = document.getElementById('btn-dash-create-first-project');

    // Audit Module elements (Option "Auditoría")
    this.auditModuleList = document.getElementById('audit-module-list');
    this.auditModuleEmpty = document.getElementById('audit-module-empty');
    this.auditCountBadge = document.getElementById('audit-count-badge');
    this.auditLoading = document.getElementById('audit-loading');
    this.auditSearchInput = document.getElementById('audit-search-input');
    this.auditFilterTable = document.getElementById('audit-filter-table');
    this.auditFilterAction = document.getElementById('audit-filter-action');
    this.btnRefreshAudit = document.getElementById('btn-refresh-audit');
  }

  bindEvents() {
    this.filterProject?.addEventListener('change', () => {
      NativeService.impact('light');
      this.refresh();
    });

    this.btnRefresh?.addEventListener('click', () => {
      NativeService.impact('light');
      this.refresh();
    });

    this.btnNewProject?.addEventListener('click', () => {
      NativeService.impact('light');
      if (typeof this.onNavigateToProjects === 'function') {
        this.onNavigateToProjects(true);
      }
    });

    this.btnViewAllProjects?.addEventListener('click', () => {
      NativeService.impact('light');
      if (typeof this.onNavigateToProjects === 'function') {
        this.onNavigateToProjects(false);
      }
    });

    this.btnCreateFirstProject?.addEventListener('click', () => {
      NativeService.impact('light');
      if (typeof this.onNavigateToProjects === 'function') {
        this.onNavigateToProjects(true);
      }
    });

    // Audit Module Events
    this.btnRefreshAudit?.addEventListener('click', () => {
      NativeService.impact('light');
      this.loadAuditModule();
    });

    this.auditSearchInput?.addEventListener('input', () => {
      clearTimeout(this.auditDebounceTimer);
      this.auditDebounceTimer = setTimeout(() => this.loadAuditModule(), 300);
    });

    this.auditFilterTable?.addEventListener('change', () => this.loadAuditModule());
    this.auditFilterAction?.addEventListener('change', () => this.loadAuditModule());
  }

  /**
   * Refreshes all dashboard statistics, tables, and Gantt chart
   */
  async refresh() {
    if (this.isLoading) return;
    this.setLoading(true);

    try {
      const selectedProjectId = this.filterProject?.value || '';
      const data = await DashboardService.getDashboardSummary({ projectId: selectedProjectId });
      this.populateProjectFilter(data.allProjects, selectedProjectId);
      this.renderKPIs(data);
      this.renderProjectsTable(data.projects);
      this.renderStatusDistribution(data.statusCounts, data.totalProjects);
      this.renderGanttChart(data.activities, data.projects);
    } catch (err) {
      console.error('[DashboardController] Error refreshing dashboard:', err);
      NotificationService.error('No se pudieron actualizar todas las métricas del dashboard.');
    } finally {
      this.setLoading(false);
    }
  }

  populateProjectFilter(allProjects = [], selectedProjectId = '') {
    if (!this.filterProject) return;

    this.filterProject.innerHTML = `
      <option value="">📁 Todos los Proyectos</option>
      ${allProjects.map(p => `<option value="${p.id}" ${p.id === selectedProjectId ? 'selected' : ''}>${this.escapeHtml(p.name)}</option>`).join('')}
    `;
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
    if (this.refreshSpinner) {
      this.refreshSpinner.classList.toggle('d-none', !isLoading);
    }
    if (this.btnRefresh) {
      this.btnRefresh.disabled = isLoading;
    }
  }

  renderKPIs(data) {
    if (this.kpiTotalProjects) {
      this.kpiTotalProjects.textContent = data.totalProjects;
    }

    if (this.kpiCountPlan) {
      this.kpiCountPlan.textContent = `${data.statusCounts.PLANIFICACION || 0} Plan`;
    }

    if (this.kpiCountExec) {
      this.kpiCountExec.textContent = `${data.statusCounts.EN_EJECUCION || 0} Ejecución`;
    }

    if (this.kpiAvgProgress) {
      this.kpiAvgProgress.textContent = `${data.averageProgress}%`;
    }

    if (this.kpiProgressBar) {
      this.kpiProgressBar.style.width = `${Math.min(100, Math.max(0, data.averageProgress))}%`;
      this.kpiProgressBar.setAttribute('aria-valuenow', data.averageProgress);
    }

    if (this.kpiTotalBudget) {
      const formattedUSD = (data.totalBudgetUSD || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      this.kpiTotalBudget.textContent = `$${formattedUSD}`;
    }

    if (this.kpiTotalActivities) {
      this.kpiTotalActivities.textContent = data.totalActivities;
    }

    if (this.kpiTotalActors) {
      this.kpiTotalActors.textContent = data.totalActors;
    }
  }

  renderProjectsTable(projects = []) {
    if (!this.projectsTableBody) return;

    if (!projects || projects.length === 0) {
      this.projectsTableBody.innerHTML = '';
      if (this.projectsEmpty) this.projectsEmpty.classList.remove('d-none');
      return;
    }

    if (this.projectsEmpty) this.projectsEmpty.classList.add('d-none');

    this.projectsTableBody.innerHTML = projects.slice(0, 5).map(proj => {
      const statusBadge = this.getStatusBadge(proj.status);
      const progress = Math.round(Number(proj.calculated_progress_percentage) || 0);
      const spentUSD = (Number(proj.total_spent_usd) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      let progressColor = 'bg-info';
      if (progress >= 80) progressColor = 'bg-success';
      else if (progress >= 40) progressColor = 'bg-primary';
      else if (progress > 0) progressColor = 'bg-warning';

      return `
        <tr>
          <td class="td-dash-name">
            <div class="fw-bold text-dark">${this.escapeHtml(proj.name)}</div>
            <div class="text-muted small text-truncate dash-proj-desc" style="max-width: 280px;">${this.escapeHtml(proj.description || 'Sin descripción')}</div>
          </td>
          <td class="td-dash-status text-center">${statusBadge}</td>
          <td class="td-dash-progress">
            <div class="d-flex align-items-center gap-2">
              <div class="table-progress-box flex-grow-1 d-none d-sm-block">
                <div class="table-progress-bar">
                  <div class="table-progress-fill ${progressColor}" style="width: ${progress}%"></div>
                </div>
              </div>
              <span class="small fw-bold font-monospace text-dark">${progress}%</span>
            </div>
          </td>
          <td class="td-dash-spent dash-proj-spent">
            <span class="font-monospace small fw-bold text-dark">$${spentUSD}</span>
          </td>
          <td class="td-dash-action text-end">
            <button class="btn btn-sm btn-outline-primary py-0.5 px-2 btn-dash-manage" data-id="${proj.id}">
              Ver →
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to "Ver →"
    this.projectsTableBody.querySelectorAll('.btn-dash-manage').forEach(btn => {
      btn.addEventListener('click', () => {
        NativeService.impact('light');
        if (typeof this.onNavigateToProjects === 'function') {
          this.onNavigateToProjects(false);
        }
      });
    });
  }

  renderStatusDistribution(counts = {}, total = 0) {
    if (!this.statusDistributionContainer) return;

    const statuses = [
      { key: 'PLANIFICACION', label: 'Planificación', color: '#5bc0de', count: counts.PLANIFICACION || 0 },
      { key: 'EN_EJECUCION', label: 'En Ejecución', color: '#008cba', count: counts.EN_EJECUCION || 0 },
      { key: 'SUSPENDIDO', label: 'Suspendidos', color: '#f0ad4e', count: counts.SUSPENDIDO || 0 },
      { key: 'FINALIZADO', label: 'Finalizados', color: '#43ac6a', count: counts.FINALIZADO || 0 }
    ];

    this.statusDistributionContainer.innerHTML = statuses.map(st => {
      const pct = total > 0 ? Math.round((st.count / total) * 100) : 0;
      return `
        <div class="status-dist-item">
          <div class="status-dist-header">
            <span class="fw-semibold text-dark">${st.label}</span>
            <span class="text-muted small">${st.count} (${pct}%)</span>
          </div>
          <div class="status-dist-bar-wrapper">
            <div class="status-dist-bar" style="width: ${pct}%; background-color: ${st.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders the Gantt Chart of Activities grouped by Project
   * @param {Array} activities
   * @param {Array} projects
   */
  renderGanttChart(activities = [], projects = []) {
    if (this.ganttCountBadge) {
      const count = activities.length;
      this.ganttCountBadge.textContent = `${count} ${count === 1 ? 'actividad' : 'actividades'}`;
    }

    if (!this.ganttContainer) return;

    if (!activities || activities.length === 0) {
      this.ganttContainer.innerHTML = '';
      if (this.ganttEmpty) this.ganttEmpty.classList.remove('d-none');
      return;
    }

    if (this.ganttEmpty) this.ganttEmpty.classList.add('d-none');

    const DAY_MS = 86400000;
    const projectMap = new Map(projects.map(p => [p.id, p]));

    // Normalize start/end timestamps for each activity
    const normalized = activities.map(act => {
      const proj = projectMap.get(act.project_id) || act.proyectos || {};
      const fallbackBase = act.created_at ? new Date(act.created_at) : new Date();
      const rawStartStr = act.start_date || proj.start_date || fallbackBase.toISOString().slice(0, 10);
      const startMs = this.parseDateLocal(rawStartStr);

      let endMs;
      if (act.end_date) {
        endMs = this.parseDateLocal(act.end_date);
      } else if (proj.end_date && this.parseDateLocal(proj.end_date) >= startMs) {
        endMs = this.parseDateLocal(proj.end_date);
      } else {
        endMs = startMs + (7 * DAY_MS);
      }

      if (endMs < startMs) {
        endMs = startMs + DAY_MS;
      }

      return {
        ...act,
        projectName: proj.name || act.proyectos?.name || 'Sin Proyecto',
        startMs,
        endMs: endMs + DAY_MS, // inclusive end day
        displayStart: act.start_date ? this.formatShortDate(act.start_date) : this.formatShortDateFromMs(startMs),
        displayEnd: act.end_date ? this.formatShortDate(act.end_date) : this.formatShortDateFromMs(endMs)
      };
    });

    let minMs = Math.min(...normalized.map(a => a.startMs));
    let maxMs = Math.max(...normalized.map(a => a.endMs));

    if (maxMs - minMs < 5 * DAY_MS) {
      minMs -= DAY_MS;
      maxMs += 4 * DAY_MS;
    }

    const totalSpanMs = Math.max(DAY_MS, maxMs - minMs);

    // Generate 5 timeline scale ticks
    const ticks = [];
    const tickCount = 5;
    for (let i = 0; i < tickCount; i++) {
      const ratio = i / (tickCount - 1);
      const tickMs = minMs + ratio * totalSpanMs;
      ticks.push({
        pct: Math.round(ratio * 100),
        label: this.formatShortDateFromMs(tickMs)
      });
    }

    // Group activities by project
    const groupedByProject = new Map();
    normalized.forEach(act => {
      const key = act.project_id || 'unassigned';
      if (!groupedByProject.has(key)) {
        groupedByProject.set(key, {
          projectName: act.projectName,
          items: []
        });
      }
      groupedByProject.get(key).items.push(act);
    });

    const statusBarColor = {
      'PENDIENTE': 'bg-secondary',
      'EN_PROCESO': 'bg-primary',
      'SUSPENDIDA': 'bg-warning',
      'FINALIZADA': 'bg-success'
    };

    const groupsHtml = Array.from(groupedByProject.values()).map(group => {
      const rowsHtml = group.items.map(act => {
        const leftPct = Math.max(0, Math.min(96, ((act.startMs - minMs) / totalSpanMs) * 100));
        const rawWidthPct = ((act.endMs - act.startMs) / totalSpanMs) * 100;
        const widthPct = Math.max(4, Math.min(100 - leftPct, rawWidthPct));
        const progress = Math.round(Number(act.progress_percentage) || 0);
        const barClass = statusBarColor[act.status] || 'bg-primary';

        return `
          <div class="gantt-row">
            <div class="gantt-label-col">
              <div class="gantt-act-name fw-semibold text-dark" title="${this.escapeHtml(act.name)}">${this.escapeHtml(act.name)}</div>
              <div class="gantt-act-meta text-muted">
                <span>📅 ${act.displayStart} - ${act.displayEnd}</span>
                <span class="fw-bold text-dark font-monospace">${progress}%</span>
              </div>
            </div>
            <div class="gantt-track-col">
              <div class="gantt-grid-lines">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <div
                class="gantt-bar-outer ${barClass}"
                style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;"
                title="${this.escapeHtml(act.name)} (${act.displayStart} - ${act.displayEnd}) | Avance: ${progress}%"
              >
                <div class="gantt-bar-progress" style="width: ${progress}%;"></div>
                <span class="gantt-bar-label">${progress}%</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="gantt-project-group">
          <div class="gantt-project-header">
            <span>📁 ${this.escapeHtml(group.projectName)}</span>
            <span class="badge bg-white text-dark border small">${group.items.length} ${group.items.length === 1 ? 'actividad' : 'actividades'}</span>
          </div>
          ${rowsHtml}
        </div>
      `;
    }).join('');

    this.ganttContainer.innerHTML = `
      <div class="gantt-timeline-header">
        <div class="gantt-header-label-col">Actividad / Plazo</div>
        <div class="gantt-header-scale-col">
          ${ticks.map(t => `<span class="gantt-scale-tick">${t.label}</span>`).join('')}
        </div>
      </div>
      <div class="gantt-body-rows">
        ${groupsHtml}
      </div>
    `;
  }

  parseDateLocal(dateStr) {
    if (!dateStr) return Date.now();
    const parts = String(dateStr).slice(0, 10).split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
    return new Date(dateStr).getTime() || Date.now();
  }

  formatShortDate(dateStr) {
    if (!dateStr) return '';
    const [, m, d] = String(dateStr).slice(0, 10).split('-');
    return (d && m) ? `${d}/${m}` : dateStr;
  }

  formatShortDateFromMs(ms) {
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  // =========================================================================
  // MÓDULO DEDICADO DE AUDITORÍA (OPCIÓN "AUDITORÍA")
  // =========================================================================

  async loadAuditModule() {
    if (this.auditLoading) this.auditLoading.classList.remove('d-none');

    try {
      const table = this.auditFilterTable?.value || '';
      const action = this.auditFilterAction?.value || '';
      const query = this.auditSearchInput?.value?.trim() || '';

      const logs = await DashboardService.getAuditLogs({ table, action, query });
      this.renderAuditModuleList(logs);
    } catch (err) {
      console.error('[DashboardController] Error loading audit module:', err);
      NotificationService.error('Error al cargar los registros de auditoría.');
    } finally {
      if (this.auditLoading) this.auditLoading.classList.add('d-none');
    }
  }

  renderAuditModuleList(logs = []) {
    if (this.auditCountBadge) {
      const count = logs.length;
      this.auditCountBadge.textContent = `${count} ${count === 1 ? 'evento' : 'eventos'}`;
    }

    if (!this.auditModuleList) return;

    if (!logs || logs.length === 0) {
      this.auditModuleList.innerHTML = '';
      if (this.auditModuleEmpty) this.auditModuleEmpty.classList.remove('d-none');
      return;
    }

    if (this.auditModuleEmpty) this.auditModuleEmpty.classList.add('d-none');

    this.auditModuleList.innerHTML = logs.map(log => `
      <div class="audit-stream-item">
        <span class="audit-stream-badge ${log.badgeClass}">${log.badgeLabel}</span>
        <div class="flex-grow-1">
          <div class="audit-stream-desc fw-semibold text-dark">${this.escapeHtml(log.title)}</div>
          <div class="audit-stream-time d-flex align-items-center gap-2 mt-0.5">
            <span>🕒 ${log.timeFormatted}</span>
            <span class="badge bg-light text-muted border font-monospace" style="font-size: 0.68rem;">${this.escapeHtml(log.table)}</span>
          </div>
        </div>
      </div>
    `).join('');
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

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
