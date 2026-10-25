/**
 * Project Chronos - Auth Service
 * Manages user authentication sessions and Supabase Auth API calls.
 */

import { getSupabase } from '../../config/supabase.client.js';

export class AuthService {
  /**
   * Retrieves active Supabase session
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
    if (error) return null;
    return user;
  }

  /**
   * Sign up new user
   * @param {string} email 
   * @param {string} password 
   * @param {Object} [metadata={}] 
   */
  static async signUp(email, password, metadata = {}) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  }

  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   */
  static async signIn(email, password) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
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
