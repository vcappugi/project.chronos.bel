/**
 * Project Chronos - Actors Service
 * Handles CRUD operations, role assignments and directory search for public.actores.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class ActorsService {
  /**
   * Retrieves all actors with role information and assigned activities count
   * @param {Object} [filters={}]
   * @param {string} [filters.roleId]
   * @param {string|boolean} [filters.isActive]
   * @param {string} [filters.query]
   * @returns {Promise<Array>}
   */
  static async getAll({ roleId = '', isActive = '', query = '' } = {}) {
    const supabase = await getSupabase();

    let req = supabase
      .from('actores')
      .select(`
        *,
        roles(id, name, description),
        actividad_actores(id)
      `)
      .order('first_name', { ascending: true });

    if (roleId) {
      req = req.eq('role_id', roleId);
    }

    if (isActive !== '' && isActive !== undefined) {
      const boolVal = isActive === 'true' || isActive === true;
      req = req.eq('is_active', boolVal);
    }

    if (query) {
      req = req.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('[ActorsService] Error fetching actors:', error);
      throw new Error('No se pudo cargar el directorio de colaboradores.');
    }

    return (data || []).map(actor => ({
      ...actor,
      activitiesCount: Array.isArray(actor.actividad_actores) ? actor.actividad_actores.length : 0
    }));
  }

  /**
   * Retrieves a single actor by its UUID
   * @param {string} id
   */
  static async getById(id) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('actores')
      .select('*, roles(id, name, description)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[ActorsService] Error fetching actor:', error);
      throw new Error('No se pudo encontrar al colaborador especificado.');
    }

    return data;
  }

  /**
   * Computes SHA-256 hash prefixed with sha256: for password verification
   * @param {string} plainPassword
   * @returns {Promise<string>}
   */
  static async hashPassword(plainPassword) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }

  /**
   * Creates a new actor
   * @param {Object} actorData
   */
  static async create(actorData) {
    const supabase = await getSupabase();

    const payload = {
      first_name: actorData.first_name.trim(),
      last_name: actorData.last_name.trim(),
      email: actorData.email.trim().toLowerCase(),
      phone: actorData.phone?.trim() || null,
      role_id: actorData.role_id || null,
      is_active: actorData.is_active !== undefined ? Boolean(actorData.is_active) : true,
      acceso_actividades: actorData.acceso_actividades !== undefined ? Boolean(actorData.acceso_actividades) : false,
      updated_at: new Date().toISOString()
    };

    if (actorData.password) {
      payload.password_hash = await this.hashPassword(actorData.password);
    }

    const { data, error } = await supabase
      .from('actores')
      .insert([payload])
      .select('*, roles(id, name, description)');

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe un colaborador registrado con este correo electrónico.');
      }
      console.error('[ActorsService] Error creating actor:', error);
      throw new Error(error.message || 'Error al registrar al colaborador.');
    }

    return data?.[0];
  }

  /**
   * Updates an existing actor
   * @param {string} id
   * @param {Object} actorData
   */
  static async update(id, actorData) {
    const supabase = await getSupabase();

    const payload = {
      first_name: actorData.first_name.trim(),
      last_name: actorData.last_name.trim(),
      email: actorData.email.trim().toLowerCase(),
      phone: actorData.phone?.trim() || null,
      role_id: actorData.role_id || null,
      is_active: actorData.is_active !== undefined ? Boolean(actorData.is_active) : true,
      acceso_actividades: actorData.acceso_actividades !== undefined ? Boolean(actorData.acceso_actividades) : false,
      updated_at: new Date().toISOString()
    };

    if (actorData.password) {
      payload.password_hash = await this.hashPassword(actorData.password);

      // If the updated actor matches the currently authenticated Supabase user, also sync Supabase Auth password
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentAuthEmail = sessionData?.session?.user?.email?.toLowerCase();
        if (currentAuthEmail && currentAuthEmail === payload.email && actorData.password.length >= 6) {
          await supabase.auth.updateUser({ password: actorData.password });
        }
      } catch (syncErr) {
        console.warn('[ActorsService] Note: Supabase Auth password sync skipped:', syncErr);
      }
    }

    const { data, error } = await supabase
      .from('actores')
      .update(payload)
      .eq('id', id)
      .select('*, roles(id, name, description)');

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe otro colaborador registrado con este correo electrónico.');
      }
      console.error('[ActorsService] Error updating actor:', error);
      throw new Error(error.message || 'Error al actualizar al colaborador.');
    }

    const updatedActor = data?.[0];

    // Sync cached session if the updated actor is the currently logged-in actor
    try {
      ['localStorage', 'sessionStorage'].forEach(storeKey => {
        const storage = globalThis[storeKey];
        const raw = storage?.getItem('chronos_cached_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.actor && (parsed.actor.id === id || parsed.actor.email?.toLowerCase() === payload.email)) {
            parsed.actor = { ...parsed.actor, ...updatedActor };
            storage.setItem('chronos_cached_session', JSON.stringify(parsed));
          }
        }
      });
    } catch {
      // Ignore storage sync errors
    }

    return updatedActor;
  }

  /**
   * Toggles the active status of an actor
   * @param {string} id
   * @param {boolean} newStatus
   */
  static async toggleActive(id, newStatus) {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('actores')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, roles(id, name, description)');

    if (error) {
      console.error('[ActorsService] Error toggling actor status:', error);
      throw new Error('Error al cambiar el estado del colaborador.');
    }

    return data?.[0];
  }

  /**
   * Deletes an actor by its UUID
   * @param {string} id
   */
  static async delete(id) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('actores')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[ActorsService] Error deleting actor:', error);
      throw new Error(error.message || 'Error al eliminar al colaborador.');
    }

    return true;
  }

  /**
   * Retrieves all available roles from public.roles
   */
  static async getRolesList() {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[ActorsService] Error fetching roles list:', err);
      return [];
    }
  }
}
