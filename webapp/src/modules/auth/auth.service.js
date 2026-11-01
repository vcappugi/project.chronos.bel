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
   * Retrieves current authenticated user
   */
  static async getCurrentUser() {
    const supabase = await getSupabase();
    
    // Check active session from storage first
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError && sessionData?.session?.user) {
      const user = sessionData.session.user;
      try {
        const actor = await this.getActorProfile(user.email);
        return { ...user, actor };
      } catch {
        return user;
      }
    }

    // Fallback to cached actor session (when authenticated via public.actores credentials)
    try {
      const cachedRaw = localStorage.getItem('chronos_cached_session') || sessionStorage.getItem('chronos_cached_session');
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.user) {
          const emailToLookup = cached.actor?.email || cached.user?.email;
          if (emailToLookup) {
            const freshActor = await this.getActorProfile(emailToLookup);
            if (freshActor) {
              cached.actor = freshActor;
              const updatedPayload = JSON.stringify(cached);
              if (localStorage.getItem('chronos_cached_session')) {
                localStorage.setItem('chronos_cached_session', updatedPayload);
              }
              if (sessionStorage.getItem('chronos_cached_session')) {
                sessionStorage.setItem('chronos_cached_session', updatedPayload);
              }
            }
          }
          return { ...cached.user, actor: cached.actor };
        }
      }
    } catch {
      // Ignore parse error
    }

    return null;
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
        .select('id, first_name, last_name, email, role_id, is_active, acceso_actividades, password_hash, roles(name, description)')
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

    // Check actor record in public.actores first for custom/updated password_hash
    const actorProfile = await this.getActorProfile(emailToUse.toLowerCase());
    if (actorProfile && actorProfile.is_active === false) {
      throw new Error('Esta cuenta de colaborador se encuentra inactiva.');
    }

    if (actorProfile?.password_hash && actorProfile.password_hash.startsWith('sha256:')) {
      const computedHash = await this.hashPassword(password);
      if (computedHash !== actorProfile.password_hash) {
        throw new Error('Credenciales inválidas. Verifica tu usuario y clave.');
      }

      // Also attempt Supabase Auth login in background if credentials match
      let authUser = null;
      try {
        const { data: authData } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: password
        });
        if (authData?.user) {
          authUser = authData.user;
        }
      } catch {
        // Ignore if Supabase Auth still holds previous password
      }

      const userObj = authUser || {
        id: actorProfile.id,
        email: actorProfile.email,
        role: 'authenticated'
      };

      const sessionPayload = JSON.stringify({ user: userObj, actor: actorProfile });
      if (rememberMe) {
        localStorage.setItem('chronos_remember_session', 'true');
        localStorage.setItem('chronos_cached_session', sessionPayload);
      } else {
        localStorage.setItem('chronos_remember_session', 'false');
        sessionStorage.setItem('chronos_session_active', 'true');
        sessionStorage.setItem('chronos_cached_session', sessionPayload);
        localStorage.removeItem('chronos_cached_session');
      }
      localStorage.setItem('chronos_last_username', identifier.trim());

      return { user: userObj, actor: actorProfile };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: password
    });

    if (error) {
      throw new Error('Credenciales inválidas. Verifica tu usuario y clave.');
    }

    // Attach actor details
    const actor = actorProfile || await this.getActorProfile(data.user.email);
    const result = { ...data, actor };

    // Persist or clear session preference based on "Mantener Iniciado"
    const sessionPayload = JSON.stringify({ user: data.user, actor });
    if (rememberMe) {
      localStorage.setItem('chronos_remember_session', 'true');
      localStorage.setItem('chronos_cached_session', sessionPayload);
    } else {
      localStorage.setItem('chronos_remember_session', 'false');
      sessionStorage.setItem('chronos_session_active', 'true');
      sessionStorage.setItem('chronos_cached_session', sessionPayload);
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
      sessionStorage.removeItem('chronos_cached_session');
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
