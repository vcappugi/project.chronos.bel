/**
 * Project Chronos - Dashboard Service
 * Computes metrics, aggregates session statistics and categorizes time.
 */

import { TimerService } from '../timer/timer.service.js';

export class DashboardService {
  /**
   * Calculates metric cards data from entries
   * @param {Array} entries 
   */
  static calculateMetrics(entries = []) {
    let totalSeconds = 0;
    let todaySeconds = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const categoryTotals = {};

    entries.forEach(item => {
      const duration = Number(item.duration_seconds || item.durationSeconds) || 0;
      totalSeconds += duration;

      const startedAt = item.started_at || item.startedAt || '';
      if (startedAt.startsWith(todayStr)) {
        todaySeconds += duration;
      }

      const cat = item.category || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + duration;
    });

    return {
      totalTimeFormatted: TimerService.formatTime(totalSeconds),
      todayTimeFormatted: TimerService.formatTime(todaySeconds),
      totalSessions: entries.length,
      categoryBreakdown: categoryTotals
    };
  }
}
