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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    // Fetch actor profile and role if available
    const actor = await this.getActorProfile(user.email);
    return { ...user, actor };
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
   */
  static async signIn(identifier, password) {
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
    return { ...data, actor };
  }

  /**
   * Sign out current user
   */
  static async signOut() {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
