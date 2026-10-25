/**
 * Project Chronos - Auth Service
 * Coordinates user sessions and authentication logic.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class AuthService {
  /**
   * Retrieves active session
   */
  static async getSession() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  /**
   * Retrieves current authenticated user
   */
  static async getCurrentUser() {
    const supabase = await getSupabase();
    
    // Check active session from storage first
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return null;
    }

    const user = sessionData.session.user;

    // Fetch actor profile and role if available
    try {
      const actor = await this.getActorProfile(user.email);
      return { ...user, actor };
    } catch {
      return user;
    }
  }

  /**
   * Retrieves actor profile information including role
   * @param {string} email
   */
  static async getActorProfile(email) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('actores')
        .select('id, first_name, last_name, email, role_id, roles(name, description)')
        .eq('email', email)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Sign in using username or email along with password
   * @param {string} identifier Username or email
   * @param {string} password Password
   * @param {Object} [options={}]
   * @param {boolean} [options.rememberMe=true]
   */
  static async signIn(identifier, password, { rememberMe = true } = {}) {
    const supabase = await getSupabase();
    let emailToUse = identifier.trim();

    // If identifier doesn't contain '@', look up email in actores
    if (!emailToUse.includes('@')) {
      const { data } = await supabase
        .from('actores')
        .select('email')
        .or(`email.ilike.${emailToUse}%,first_name.ilike.${emailToUse}%`)
        .limit(1);

      if (data && data.length > 0) {
        emailToUse = data[0].email;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: password
    });

    if (error) {
      throw new Error('Credenciales inválidas. Verifica tu usuario y clave.');
    }

    // Attach actor details
    const actor = await this.getActorProfile(data.user.email);
    const result = { ...data, actor };

    // Persist or clear session preference based on "Mantener Iniciado"
    if (rememberMe) {
      localStorage.setItem('chronos_remember_session', 'true');
      localStorage.setItem('chronos_cached_session', JSON.stringify({ user: data.user, actor }));
    } else {
      localStorage.setItem('chronos_remember_session', 'false');
      sessionStorage.setItem('chronos_session_active', 'true');
      localStorage.removeItem('chronos_cached_session');
    }
    localStorage.setItem('chronos_last_username', identifier.trim());

    return result;
  }

  /**
   * Sign out current user and clear persistent session flags
   */
  static async signOut() {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } finally {
      localStorage.removeItem('chronos_remember_session');
      localStorage.removeItem('chronos_cached_session');
      sessionStorage.removeItem('chronos_session_active');
    }
  }

  /**
   * Subscribes to auth state changes
   * @param {(event: string, session: any) => void} callback 
   */
  static async onAuthStateChange(callback) {
    const supabase = await getSupabase();
    return supabase.auth.onAuthStateChange(callback);
  }
}
