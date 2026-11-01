/**
 * Project Chronos - Dashboard Service
 * Aggregates enterprise metrics, project progress, budget allocations, and audit history.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class DashboardService {
  /**
   * Fetches and compiles all consolidated metrics for the executive dashboard
   * @param {Object} [options={}]
   * @param {string} [options.projectId=''] Optional project UUID filter
   * @returns {Promise<Object>}
   */
  static async getDashboardSummary({ projectId = '' } = {}) {
    try {
      const supabase = await getSupabase();

      // Query core entities concurrently with resilient error handling
      const [
        projectsResult,
        activitiesResult,
        actorsResult,
        summaryResult
      ] = await Promise.allSettled([
        supabase.from('proyectos').select('*').order('created_at', { ascending: false }),
        supabase
          .from('actividades')
          .select('id, project_id, name, description, weight, progress_percentage, start_date, end_date, status, created_at, proyectos(id, name), actividad_actores(actor_id)')
          .order('start_date', { ascending: true, nullsFirst: false }),
        supabase.from('actores').select('id, first_name, last_name, is_active'),
        supabase.from('vw_proyecto_resumen').select('*')
      ]);

      const allProjects = projectsResult.status === 'fulfilled' && !projectsResult.value.error 
        ? (projectsResult.value.data || []) 
        : [];

      const allActivities = activitiesResult.status === 'fulfilled' && !activitiesResult.value.error 
        ? (activitiesResult.value.data || []) 
        : [];

      const actors = actorsResult.status === 'fulfilled' && !actorsResult.value.error 
        ? (actorsResult.value.data || []) 
        : [];

      const summaries = summaryResult.status === 'fulfilled' && !summaryResult.value.error 
        ? (summaryResult.value.data || []) 
        : [];

      // Filter by projectId if selected
      const projects = projectId
        ? allProjects.filter(p => p.id === projectId)
        : allProjects;

      const activities = projectId
        ? allActivities.filter(a => a.project_id === projectId)
        : allActivities;

      // Map summaries by project ID for quick lookup
      const summaryMap = new Map();
      summaries.forEach(s => {
        summaryMap.set(s.project_id, s);
      });

      // Calculate status breakdown for projects
      const statusCounts = {
        PLANIFICACION: 0,
        EN_EJECUCION: 0,
        SUSPENDIDO: 0,
        FINALIZADO: 0
      };

      let sumProgress = 0;
      let totalBudgetUSD = 0;

      projects.forEach(p => {
        const status = p.status || 'PLANIFICACION';
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        } else {
          statusCounts.PLANIFICACION++;
        }

        const sumData = summaryMap.get(p.id);
        const progress = Number(sumData?.calculated_progress_percentage) || 0;
        const budget = Number(sumData?.total_spent_usd) || 0;

        sumProgress += progress;
        totalBudgetUSD += budget;
      });

      const totalProjects = projects.length;
      const averageProgress = totalProjects > 0 ? Math.round((sumProgress / totalProjects) * 10) / 10 : 0;

      // Enhance projects list with progress and spent info
      const enhancedProjects = projects.map(p => {
        const sumData = summaryMap.get(p.id);
        return {
          ...p,
          calculated_progress_percentage: Number(sumData?.calculated_progress_percentage) || 0,
          total_spent_usd: Number(sumData?.total_spent_usd) || 0
        };
      });

      // Compute actors count (unique actors in project activities if filtered, or total actors)
      let totalActorsCount = actors.length;
      if (projectId) {
        const uniqueActorIds = new Set();
        activities.forEach(act => {
          if (Array.isArray(act.actividad_actores)) {
            act.actividad_actores.forEach(aa => {
              if (aa.actor_id) uniqueActorIds.add(aa.actor_id);
            });
          }
        });
        totalActorsCount = uniqueActorIds.size;
      }

      return {
        allProjects,
        totalProjects,
        statusCounts,
        averageProgress,
        totalBudgetUSD,
        totalActivities: activities.length,
        totalActors: totalActorsCount,
        projects: enhancedProjects,
        activities
      };
    } catch (err) {
      console.error('[DashboardService] Error compiling summary:', err);
      return {
        allProjects: [],
        totalProjects: 0,
        statusCounts: { PLANIFICACION: 0, EN_EJECUCION: 0, SUSPENDIDO: 0, FINALIZADO: 0 },
        averageProgress: 0,
        totalBudgetUSD: 0,
        totalActivities: 0,
        totalActors: 0,
        projects: [],
        activities: []
      };
    }
  }

  /**
   * Retrieves audit logs for the dedicated Audit module
   * @param {Object} [filters={}]
   * @param {string} [filters.table]
   * @param {string} [filters.action]
   * @param {string} [filters.query]
   * @returns {Promise<Array>}
   */
  static async getAuditLogs({ table = '', action = '', query = '' } = {}) {
    try {
      const supabase = await getSupabase();
      let req = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (table) {
        req = req.eq('table_name', table);
      }

      if (action) {
        req = req.eq('action', action);
      }

      const { data, error } = await req;
      if (error) throw error;

      let formatted = (data || []).map(log => this.formatAuditEntry(log));

      if (query) {
        const qLower = query.toLowerCase();
        formatted = formatted.filter(item =>
          item.title.toLowerCase().includes(qLower) ||
          item.table.toLowerCase().includes(qLower) ||
          item.badgeLabel.toLowerCase().includes(qLower)
        );
      }

      return formatted;
    } catch (err) {
      console.error('[DashboardService] Error fetching audit logs:', err);
      return [];
    }
  }

  /**
   * Formats raw audit log entries into human-readable notifications
   * @param {Object} log
   * @returns {Object}
   */
  static formatAuditEntry(log) {
    const table = log.table_name || 'registro';
    const action = log.action || 'INSERT';
    const data = log.new_data || log.old_data || {};
    const name = data.name || data.first_name || `ID: ${String(log.record_id).slice(0, 8)}`;

    let title = '';
    let badgeClass = 'bg-primary text-white';
    let badgeLabel = action;

    switch (action) {
      case 'INSERT':
        badgeClass = 'bg-success text-white';
        badgeLabel = 'Creación';
        title = `Se creó ${this.translateTable(table)} "${name}"`;
        break;
      case 'UPDATE':
        badgeClass = 'bg-warning text-dark';
        badgeLabel = 'Modificación';
        title = `Se actualizó ${this.translateTable(table)} "${name}"`;
        break;
      case 'DELETE':
        badgeClass = 'bg-danger text-white';
        badgeLabel = 'Eliminación';
        title = `Se eliminó ${this.translateTable(table)} "${name}"`;
        break;
      default:
        title = `Acción ${action} en ${table}`;
    }

    const date = new Date(log.created_at || Date.now());
    const timeFormatted = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
                          date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });

    return {
      id: log.id,
      title,
      badgeLabel,
      badgeClass,
      timeFormatted,
      table
    };
  }

  static translateTable(table) {
    const map = {
      'proyectos': 'el proyecto',
      'actividades': 'la actividad',
      'recursos': 'el recurso',
      'actores': 'el actor',
      'roles': 'el rol',
      'system_objects': 'el objeto del sistema',
      'role_permissions': 'permiso de rol'
    };
    return map[table] || `en ${table}`;
  }
}
