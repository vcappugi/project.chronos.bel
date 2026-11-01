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

    // Distribution and Audit
    this.statusDistributionContainer = document.getElementById('dash-status-distribution-container');
    this.auditRecentList = document.getElementById('dash-audit-recent-list');
    this.auditEmpty = document.getElementById('dash-audit-empty');

    // Controls
    this.btnRefresh = document.getElementById('btn-refresh-dashboard');
    this.refreshSpinner = document.getElementById('dash-refresh-spinner');
    this.btnNewProject = document.getElementById('btn-dash-new-project');
    this.btnViewAllProjects = document.getElementById('btn-dash-view-all-projects');
    this.btnCreateFirstProject = document.getElementById('btn-dash-create-first-project');
  }

  bindEvents() {
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
  }

  /**
   * Refreshes all dashboard statistics, tables, and streams
   */
  async refresh() {
    if (this.isLoading) return;
    this.setLoading(true);

    try {
      const data = await DashboardService.getDashboardSummary();
      this.renderKPIs(data);
      this.renderProjectsTable(data.projects);
      this.renderStatusDistribution(data.statusCounts, data.totalProjects);
      this.renderAuditStream(data.auditLogs);
    } catch (err) {
      console.error('[DashboardController] Error refreshing dashboard:', err);
      NotificationService.error('No se pudieron actualizar todas las métricas del dashboard.');
    } finally {
      this.setLoading(false);
    }
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

  renderAuditStream(logs = []) {
    if (!this.auditRecentList) return;

    if (!logs || logs.length === 0) {
      this.auditRecentList.innerHTML = '';
      if (this.auditEmpty) this.auditEmpty.classList.remove('d-none');
      return;
    }

    if (this.auditEmpty) this.auditEmpty.classList.add('d-none');

    this.auditRecentList.innerHTML = logs.map(log => `
      <div class="audit-stream-item">
        <span class="audit-stream-badge ${log.badgeClass}">${log.badgeLabel}</span>
        <div class="flex-grow-1">
          <div class="audit-stream-desc">${this.escapeHtml(log.title)}</div>
          <div class="audit-stream-time">${log.timeFormatted}</div>
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
