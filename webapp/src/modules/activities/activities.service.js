/**
 * Project Chronos - Activities Service
 * Handles CRUD operations, associations and progress tracking for public.actividades,
 * as well as sub-CRUDs for public.actividad_actores and public.actividad_recursos.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class ActivitiesService {
  /**
   * Retrieves all activities with project association, assigned actors count and resource costs
   * @param {Object} [filters={}]
   * @param {string} [filters.projectId]
   * @param {string} [filters.status]
   * @param {string} [filters.query]
   * @returns {Promise<Array>}
   */
  static async getAll({ projectId = '', status = '', query = '' } = {}) {
    const supabase = await getSupabase();

    let req = supabase
      .from('actividades')
      .select(`
        *,
        proyectos(id, name),
        actividad_actores(id),
        actividad_recursos(id, quantity, unit_cost_usd_override, recursos(unit_cost_usd))
      `)
      .order('created_at', { ascending: false });

    if (projectId) {
      req = req.eq('project_id', projectId);
    }

    if (status) {
      req = req.eq('status', status);
    }

    if (query) {
      req = req.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('[ActivitiesService] Error fetching activities:', error);
      throw new Error('No se pudo cargar la lista de actividades.');
    }

    // Compute aggregated actors count and total resource costs
    return (data || []).map(act => {
      const actorsCount = Array.isArray(act.actividad_actores) ? act.actividad_actores.length : 0;
      
      let totalCostUSD = 0;
      if (Array.isArray(act.actividad_recursos)) {
        act.actividad_recursos.forEach(ar => {
          const qty = Number(ar.quantity) || 0;
          const cost = ar.unit_cost_usd_override != null 
            ? Number(ar.unit_cost_usd_override) 
            : Number(ar.recursos?.unit_cost_usd) || 0;
          totalCostUSD += (qty * cost);
        });
      }

      return {
        ...act,
        actorsCount,
        totalCostUSD: Math.round(totalCostUSD * 100) / 100
      };
    });
  }

  /**
   * Retrieves a single activity by its UUID
   * @param {string} id
   */
  static async getById(id) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('actividades')
      .select('*, proyectos(id, name)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[ActivitiesService] Error fetching activity:', error);
      throw new Error('No se pudo encontrar la actividad solicitada.');
    }

    return data;
  }

  /**
   * Creates a new activity record
   * @param {Object} activityData
   */
  static async create(activityData) {
    const supabase = await getSupabase();

    const weightVal = parseFloat(activityData.weight);
    const progressVal = parseFloat(activityData.progress_percentage);

    const payload = {
      project_id: activityData.project_id,
      name: activityData.name.trim(),
      description: activityData.description?.trim() || null,
      weight: !isNaN(weightVal) && weightVal > 0 ? weightVal : 1.00,
      progress_percentage: !isNaN(progressVal) ? Math.min(100, Math.max(0, progressVal)) : 0.00,
      start_date: activityData.start_date || null,
      end_date: activityData.end_date || null,
      status: activityData.status || 'PENDIENTE',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('actividades')
      .insert([payload])
      .select('*, proyectos(id, name)');

    if (error) {
      console.error('[ActivitiesService] Error creating activity:', error);
      throw new Error(error.message || 'Error al registrar la actividad.');
    }

    return data?.[0];
  }

  /**
   * Updates an existing activity record
   * @param {string} id
   * @param {Object} activityData
   */
  static async update(id, activityData) {
    const supabase = await getSupabase();

    const weightVal = parseFloat(activityData.weight);
    const progressVal = parseFloat(activityData.progress_percentage);

    const payload = {
      project_id: activityData.project_id,
      name: activityData.name.trim(),
      description: activityData.description?.trim() || null,
      weight: !isNaN(weightVal) && weightVal > 0 ? weightVal : 1.00,
      progress_percentage: !isNaN(progressVal) ? Math.min(100, Math.max(0, progressVal)) : 0.00,
      start_date: activityData.start_date || null,
      end_date: activityData.end_date || null,
      status: activityData.status || 'PENDIENTE',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('actividades')
      .update(payload)
      .eq('id', id)
      .select('*, proyectos(id, name)');

    if (error) {
      console.error('[ActivitiesService] Error updating activity:', error);
      throw new Error(error.message || 'Error al actualizar la actividad.');
    }

    return data?.[0];
  }

  /**
   * Deletes an activity record by its UUID
   * @param {string} id
   */
  static async delete(id) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('actividades')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ActivitiesService] Error deleting activity:', error);
      throw new Error(error.message || 'Error al eliminar la actividad.');
    }

    return true;
  }

  /**
   * Retrieves active projects list for dropdown options
   */
  static async getProjectsList() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, name, status')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[ActivitiesService] Error fetching projects list:', err);
      return [];
    }
  }

  // =========================================================================
  // SUB-CRUD 1: ACTIVIDAD_ACTORES (Equipo y Responsables por Actividad)
  // =========================================================================

  /**
   * Retrieves all actors assigned to a specific activity
   * @param {string} activityId
   */
  static async getActorsByActivity(activityId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('actividad_actores')
      .select(`
        id,
        activity_id,
        actor_id,
        assigned_role,
        created_at,
        actores(id, first_name, last_name, email, phone, role_id, roles(id, name))
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivitiesService] Error fetching activity actors:', error);
      throw new Error('Error al obtener los participantes de la actividad.');
    }

    return data || [];
  }

  /**
   * Assigns an actor to an activity
   * @param {Object} param0
   * @param {string} param0.activityId
   * @param {string} param0.actorId
   * @param {string} param0.assignedRole
   */
  static async assignActor({ activityId, actorId, assignedRole = 'Colaborador' }) {
    const supabase = await getSupabase();

    const payload = {
      activity_id: activityId,
      actor_id: actorId,
      assigned_role: assignedRole.trim() || 'Colaborador'
    };

    const { data, error } = await supabase
      .from('actividad_actores')
      .insert([payload])
      .select(`
        id,
        activity_id,
        actor_id,
        assigned_role,
        created_at,
        actores(id, first_name, last_name, email, phone, role_id, roles(id, name))
      `);

    if (error) {
      if (error.code === '23505') {
        throw new Error('Este colaborador ya se encuentra asignado a esta actividad.');
      }
      console.error('[ActivitiesService] Error assigning actor:', error);
      throw new Error(error.message || 'Error al asignar el colaborador.');
    }

    return data?.[0];
  }

  /**
   * Updates assigned role of an actor in an activity
   * @param {string} assignmentId
   * @param {string} assignedRole
   */
  static async updateActorAssignment(assignmentId, assignedRole) {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('actividad_actores')
      .update({ assigned_role: assignedRole.trim() || 'Colaborador' })
      .eq('id', assignmentId)
      .select();

    if (error) {
      console.error('[ActivitiesService] Error updating actor assignment:', error);
      throw new Error(error.message || 'Error al actualizar el rol del colaborador.');
    }

    return data?.[0];
  }

  /**
   * Removes an actor assignment from an activity
   * @param {string} assignmentId
   */
  static async removeActor(assignmentId) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('actividad_actores')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('[ActivitiesService] Error removing actor:', error);
      throw new Error(error.message || 'Error al desvincular el colaborador.');
    }

    return true;
  }

  /**
   * Retrieves all active actors from catalog for the assignment dropdown
   */
  static async getAvailableActores() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('actores')
        .select(`
          id,
          first_name,
          last_name,
          email,
          role_id,
          roles(id, name, description)
        `)
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[ActivitiesService] Error fetching available actors:', err);
      return [];
    }
  }

  // =========================================================================
  // SUB-CRUD 2: ACTIVIDAD_RECURSOS (Insumos, Materiales y Costos USD)
  // =========================================================================

  /**
   * Retrieves all resources assigned to a specific activity
   * @param {string} activityId
   */
  static async getResourcesByActivity(activityId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('actividad_recursos')
      .select(`
        id,
        activity_id,
        resource_id,
        quantity,
        unit_cost_usd_override,
        created_at,
        updated_at,
        recursos(id, name, unit_type, unit_cost_usd)
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ActivitiesService] Error fetching activity resources:', error);
      throw new Error('Error al obtener los recursos asignados a la actividad.');
    }

    return (data || []).map(ar => {
      const qty = Number(ar.quantity) || 0;
      const baseCost = Number(ar.recursos?.unit_cost_usd) || 0;
      const effectiveUnitCost = ar.unit_cost_usd_override != null 
        ? Number(ar.unit_cost_usd_override) 
        : baseCost;
      const subtotalUSD = Math.round(qty * effectiveUnitCost * 100) / 100;

      return {
        ...ar,
        effectiveUnitCost,
        subtotalUSD
      };
    });
  }

  /**
   * Assigns a resource to an activity
   * @param {Object} param0
   * @param {string} param0.activityId
   * @param {string} param0.resourceId
   * @param {number} param0.quantity
   * @param {number|null} param0.unitCostOverride
   */
  static async assignResource({ activityId, resourceId, quantity = 1, unitCostOverride = null }) {
    const supabase = await getSupabase();

    const qty = parseFloat(quantity);
    const override = unitCostOverride !== '' && unitCostOverride != null ? parseFloat(unitCostOverride) : null;

    const payload = {
      activity_id: activityId,
      resource_id: resourceId,
      quantity: !isNaN(qty) && qty > 0 ? qty : 1.00,
      unit_cost_usd_override: !isNaN(override) && override !== null ? override : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('actividad_recursos')
      .insert([payload])
      .select(`
        id,
        activity_id,
        resource_id,
        quantity,
        unit_cost_usd_override,
        created_at,
        updated_at,
        recursos(id, name, unit_type, unit_cost_usd)
      `);

    if (error) {
      console.error('[ActivitiesService] Error assigning resource:', error);
      throw new Error(error.message || 'Error al asignar el recurso a la actividad.');
    }

    return data?.[0];
  }

  /**
   * Updates an existing resource assignment
   * @param {string} assignmentId
   * @param {Object} param1
   */
  static async updateResourceAssignment(assignmentId, { quantity, unitCostOverride }) {
    const supabase = await getSupabase();

    const qty = parseFloat(quantity);
    const override = unitCostOverride !== '' && unitCostOverride != null ? parseFloat(unitCostOverride) : null;

    const payload = {
      quantity: !isNaN(qty) && qty > 0 ? qty : 1.00,
      unit_cost_usd_override: !isNaN(override) && override !== null ? override : null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('actividad_recursos')
      .update(payload)
      .eq('id', assignmentId)
      .select(`
        id,
        activity_id,
        resource_id,
        quantity,
        unit_cost_usd_override,
        created_at,
        updated_at,
        recursos(id, name, unit_type, unit_cost_usd)
      `);

    if (error) {
      console.error('[ActivitiesService] Error updating resource assignment:', error);
      throw new Error(error.message || 'Error al actualizar el recurso asignado.');
    }

    return data?.[0];
  }

  /**
   * Removes a resource assignment from an activity
   * @param {string} assignmentId
   */
  static async removeResource(assignmentId) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('actividad_recursos')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('[ActivitiesService] Error removing resource:', error);
      throw new Error(error.message || 'Error al desvincular el recurso.');
    }

    return true;
  }

  /**
   * Retrieves all catalog resources for the dropdown options
   */
  static async getAvailableRecursos() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('recursos')
        .select('id, name, unit_type, unit_cost_usd')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[ActivitiesService] Error fetching available resources:', err);
      return [];
    }
  }
}
