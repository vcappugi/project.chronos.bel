/**
 * Project Chronos - Dashboard Controller
 * Renders statistical cards and recent activities list.
 */

import { DashboardService } from './dashboard.service.js';
import { TimerService } from '../timer/timer.service.js';

export class DashboardController {
  constructor({ getCurrentUser }) {
    this.getCurrentUser = getCurrentUser;
    this.initElements();
  }

  initElements() {
    this.statTotalTime = document.getElementById('stat-total-time');
    this.statTodayTime = document.getElementById('stat-today-time');
    this.statSessions = document.getElementById('stat-sessions-count');
    this.recentListContainer = document.getElementById('recent-entries-list');
    this.emptyState = document.getElementById('recent-entries-empty');
  }

  /**
   * Refreshes the dashboard data
   */
  async refresh() {
    let user = null;
    if (typeof this.getCurrentUser === 'function') {
      user = this.getCurrentUser();
    }

    const entries = await TimerService.getEntries(user?.id);
    this.renderMetrics(entries);
    this.renderList(entries);
  }

  renderMetrics(entries) {
    const metrics = DashboardService.calculateMetrics(entries);

    if (this.statTotalTime) this.statTotalTime.textContent = metrics.totalTimeFormatted;
    if (this.statTodayTime) this.statTodayTime.textContent = metrics.todayTimeFormatted;
    if (this.statSessions) this.statSessions.textContent = metrics.totalSessions;
  }

  renderList(entries) {
    if (!this.recentListContainer) return;

    if (!entries || entries.length === 0) {
      this.recentListContainer.innerHTML = '';
      if (this.emptyState) this.emptyState.classList.remove('hidden');
      return;
    }

    if (this.emptyState) this.emptyState.classList.add('hidden');

    this.recentListContainer.innerHTML = entries.map(entry => {
      const duration = Number(entry.duration_seconds || entry.durationSeconds) || 0;
      const formattedDuration = TimerService.formatTime(duration);
      const category = entry.category || 'General';
      const title = entry.title || 'Actividad Chronos';
      const date = new Date(entry.started_at || entry.startedAt || Date.now()).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="entry-item animate-fade-in">
          <div class="entry-left">
            <span class="badge badge-category">${this.escapeHtml(category)}</span>
            <div class="entry-details">
              <span class="entry-title">${this.escapeHtml(title)}</span>
              <span class="entry-date">${date}</span>
            </div>
          </div>
          <div class="entry-right">
            <span class="entry-duration">${formattedDuration}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
