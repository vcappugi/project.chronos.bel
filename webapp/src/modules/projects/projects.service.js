/**
 * Project Chronos - Projects Service
 * Handles CRUD operations and statistics for public.proyectos in Supabase.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class ProjectsService {
  /**
   * Retrieves all projects, optionally filtering by status and search keyword
   * @param {Object} [filters={}]
   * @param {string} [filters.status]
   * @param {string} [filters.query]
   * @returns {Promise<Array>}
   */
  static async getAll({ status = '', query = '' } = {}) {
    const supabase = await getSupabase();

    let req = supabase
      .from('proyectos')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      req = req.eq('status', status);
    }

    if (query) {
      req = req.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('[ProjectsService] Error fetching projects:', error);
      throw new Error('No se pudo cargar la lista de proyectos.');
    }

    return data || [];
  }

  /**
   * Retrieves a single project by ID
   * @param {string} id
   */
  static async getById(id) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[ProjectsService] Error fetching project:', error);
      throw new Error('No se pudo encontrar el proyecto especificado.');
    }

    return data;
  }

  /**
   * Creates a new project
   * @param {Object} projectData
   */
  static async create(projectData) {
    const supabase = await getSupabase();
    const payload = {
      name: projectData.name.trim(),
      description: projectData.description?.trim() || null,
      start_date: projectData.start_date || null,
      end_date: projectData.end_date || null,
      status: projectData.status || 'PLANIFICACION',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('proyectos')
      .insert([payload])
      .select();

    if (error) {
      console.error('[ProjectsService] Error creating project:', error);
      throw new Error(error.message || 'Error al crear el proyecto.');
    }

    return data?.[0];
  }

  /**
   * Updates an existing project
   * @param {string} id
   * @param {Object} projectData
   */
  static async update(id, projectData) {
    const supabase = await getSupabase();
    const payload = {
      name: projectData.name.trim(),
      description: projectData.description?.trim() || null,
      start_date: projectData.start_date || null,
      end_date: projectData.end_date || null,
      status: projectData.status || 'PLANIFICACION',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('proyectos')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('[ProjectsService] Error updating project:', error);
      throw new Error(error.message || 'Error al actualizar el proyecto.');
    }

    return data?.[0];
  }

  /**
   * Deletes a project by ID
   * @param {string} id
   */
  static async delete(id) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ProjectsService] Error deleting project:', error);
      throw new Error(error.message || 'Error al eliminar el proyecto.');
    }

    return true;
  }

  /**
   * Retrieves summary view data for projects (calculated progress and expenses)
   */
  static async getSummary() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('vw_proyecto_resumen')
        .select('*');

      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }
}
