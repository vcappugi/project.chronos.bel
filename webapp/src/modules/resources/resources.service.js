/**
 * Project Chronos - Resources Service
 * Handles CRUD operations, unit costs, and activity allocation statistics for public.recursos.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class ResourcesService {
  /**
   * Retrieves all resources with activity allocation counts and optional filters
   * @param {Object} [filters={}]
   * @param {string} [filters.query]
   * @param {string} [filters.unitType]
   * @returns {Promise<Array>}
   */
  static async getAll({ query = '', unitType = '' } = {}) {
    const supabase = await getSupabase();

    let req = supabase
      .from('recursos')
      .select(`
        *,
        actividad_recursos(id)
      `)
      .order('name', { ascending: true });

    if (unitType) {
      req = req.eq('unit_type', unitType);
    }

    if (query) {
      req = req.ilike('name', `%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('[ResourcesService] Error fetching resources:', error);
      throw new Error('No se pudo cargar el catálogo de recursos.');
    }

    return (data || []).map(r => ({
      ...r,
      activitiesCount: Array.isArray(r.actividad_recursos) ? r.actividad_recursos.length : 0
    }));
  }

  /**
   * Retrieves a single resource by UUID
   * @param {string} id
   */
  static async getById(id) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('recursos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[ResourcesService] Error fetching resource:', error);
      throw new Error('No se pudo encontrar el recurso especificado.');
    }

    return data;
  }

  /**
   * Creates a new resource record
   * @param {Object} resourceData
   * @param {string} resourceData.name
   * @param {string} resourceData.unit_type
   * @param {number|string} resourceData.unit_cost_usd
   */
  static async create(resourceData) {
    const supabase = await getSupabase();

    const name = resourceData.name?.trim();
    const unitType = resourceData.unit_type?.trim()?.toUpperCase() || 'UNIDAD';
    const unitCost = Number(resourceData.unit_cost_usd);

    if (!name) {
      throw new Error('El nombre del recurso es obligatorio.');
    }

    if (name.length > 100) {
      throw new Error('El nombre del recurso no puede exceder los 100 caracteres.');
    }

    if (isNaN(unitCost) || unitCost < 0) {
      throw new Error('El costo unitario en USD debe ser un valor numérico positivo o cero.');
    }

    const payload = {
      name,
      unit_type: unitType,
      unit_cost_usd: unitCost,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('recursos')
      .insert([payload])
      .select('*, actividad_recursos(id)');

    if (error) {
      console.error('[ResourcesService] Error creating resource:', error);
      throw new Error(error.message || 'Error al registrar el recurso.');
    }

    const created = data?.[0];
    return {
      ...created,
      activitiesCount: Array.isArray(created?.actividad_recursos) ? created.actividad_recursos.length : 0
    };
  }

  /**
   * Updates an existing resource record
   * @param {string} id
   * @param {Object} resourceData
   * @param {string} resourceData.name
   * @param {string} resourceData.unit_type
   * @param {number|string} resourceData.unit_cost_usd
   */
  static async update(id, resourceData) {
    const supabase = await getSupabase();

    const name = resourceData.name?.trim();
    const unitType = resourceData.unit_type?.trim()?.toUpperCase() || 'UNIDAD';
    const unitCost = Number(resourceData.unit_cost_usd);

    if (!name) {
      throw new Error('El nombre del recurso es obligatorio.');
    }

    if (name.length > 100) {
      throw new Error('El nombre del recurso no puede exceder los 100 caracteres.');
    }

    if (isNaN(unitCost) || unitCost < 0) {
      throw new Error('El costo unitario en USD debe ser un valor numérico positivo o cero.');
    }

    const payload = {
      name,
      unit_type: unitType,
      unit_cost_usd: unitCost,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('recursos')
      .update(payload)
      .eq('id', id)
      .select('*, actividad_recursos(id)');

    if (error) {
      console.error('[ResourcesService] Error updating resource:', error);
      throw new Error(error.message || 'Error al actualizar el recurso.');
    }

    const updated = data?.[0];
    return {
      ...updated,
      activitiesCount: Array.isArray(updated?.actividad_recursos) ? updated.actividad_recursos.length : 0
    };
  }

  /**
   * Deletes a resource record, preventing deletion if currently assigned to activities
   * @param {string} id
   */
  static async delete(id) {
    const supabase = await getSupabase();

    // Verify if any activity is currently using this resource
    const { data: usage, error: usageError } = await supabase
      .from('actividad_recursos')
      .select('id, actividades(name)')
      .eq('resource_id', id);

    if (usageError) {
      console.error('[ResourcesService] Error verifying resource usage:', usageError);
      throw new Error('Error al verificar dependencias del recurso.');
    }

    if (usage && usage.length > 0) {
      const count = usage.length;
      throw new Error(`No se puede eliminar este recurso porque está asignado a ${count} ${count === 1 ? 'actividad operativa' : 'actividades operativas'}. Elimina o reasigna su uso primero.`);
    }

    const { error } = await supabase
      .from('recursos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ResourcesService] Error deleting resource:', error);
      throw new Error(error.message || 'Error al eliminar el recurso.');
    }

    return true;
  }
}
