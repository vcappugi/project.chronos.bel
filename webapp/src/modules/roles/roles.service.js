/**
 * Project Chronos - Roles Service
 * Handles CRUD operations, actor counts, and object permission statistics for public.roles.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class RolesService {
  /**
   * Retrieves all roles with actor and permission counts, optionally filtering by search query
   * @param {Object} [filters={}]
   * @param {string} [filters.query]
   * @returns {Promise<Array>}
   */
  static async getAll({ query = '' } = {}) {
    const supabase = await getSupabase();

    let req = supabase
      .from('roles')
      .select(`
        *,
        actores(id),
        role_permissions(id)
      `)
      .order('name', { ascending: true });

    if (query) {
      req = req.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('[RolesService] Error fetching roles:', error);
      throw new Error('No se pudo cargar el catálogo de roles.');
    }

    return (data || []).map(r => ({
      ...r,
      actorsCount: Array.isArray(r.actores) ? r.actores.length : 0,
      permissionsCount: Array.isArray(r.role_permissions) ? r.role_permissions.length : 0
    }));
  }

  /**
   * Retrieves a single role by its UUID
   * @param {string} id
   */
  static async getById(id) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[RolesService] Error fetching role:', error);
      throw new Error('No se pudo encontrar el rol solicitado.');
    }

    return data;
  }

  /**
   * Creates a new role record
   * @param {Object} roleData
   * @param {string} roleData.name
   * @param {string} [roleData.description]
   */
  static async create(roleData) {
    const supabase = await getSupabase();

    const normalizedName = roleData.name.trim().toLowerCase().replace(/\s+/g, '_');

    if (!normalizedName) {
      throw new Error('El nombre identificador del rol es obligatorio.');
    }

    const payload = {
      name: normalizedName,
      description: roleData.description?.trim() || null
    };

    const { data, error } = await supabase
      .from('roles')
      .insert([payload])
      .select('*, actores(id), role_permissions(id)');

    if (error) {
      if (error.code === '23505') {
        throw new Error(`El rol "${normalizedName}" ya existe en el sistema.`);
      }
      console.error('[RolesService] Error creating role:', error);
      throw new Error(error.message || 'Error al registrar el rol.');
    }

    return data?.[0];
  }

  /**
   * Updates an existing role record
   * @param {string} id
   * @param {Object} roleData
   */
  static async update(id, roleData) {
    const supabase = await getSupabase();

    // Check if modifying protected system role
    const current = await this.getById(id);
    const isSysAdmin = current?.name === 'sysadmin';

    const normalizedName = isSysAdmin ? 'sysadmin' : roleData.name.trim().toLowerCase().replace(/\s+/g, '_');

    const payload = {
      name: normalizedName,
      description: roleData.description?.trim() || null
    };

    const { data, error } = await supabase
      .from('roles')
      .update(payload)
      .eq('id', id)
      .select('*, actores(id), role_permissions(id)');

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe otro rol con el nombre "${normalizedName}".`);
      }
      console.error('[RolesService] Error updating role:', error);
      throw new Error(error.message || 'Error al actualizar el rol.');
    }

    return data?.[0];
  }

  /**
   * Deletes a role by its UUID (prevents deletion of sysadmin)
   * @param {string} id
   */
  static async delete(id) {
    const supabase = await getSupabase();

    // Validate protected role
    const role = await this.getById(id);
    if (role?.name === 'sysadmin') {
      throw new Error('El rol "sysadmin" es el rol maestro del sistema y no puede ser eliminado.');
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[RolesService] Error deleting role:', error);
      throw new Error(error.message || 'Error al eliminar el rol.');
    }

    return true;
  }
}
