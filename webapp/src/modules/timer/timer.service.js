/**
 * Project Chronos - Timer Service
 * Handles precision timing, interval state, and Supabase database persistence.
 */

import { getSupabase } from '../../config/supabase.client.js';
import { StorageService } from '../../services/storage.service.js';

export class TimerService {
  /**
   * Saves a completed time entry to Supabase
   * @param {Object} entry 
   * @param {string} entry.title Task title
   * @param {string} entry.category Category or project
   * @param {number} entry.durationSeconds Total elapsed seconds
   * @param {string} entry.startedAt ISO string
   * @param {string} entry.endedAt ISO string
   * @param {string} [entry.userId] Owner user ID
   */
  static async saveEntry(entry) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('chronos_time_entries')
        .insert([{
          title: entry.title || 'Actividad sin nombre',
          category: entry.category || 'General',
          duration_seconds: entry.durationSeconds,
          started_at: entry.startedAt,
          ended_at: entry.endedAt,
          user_id: entry.userId || null
        }])
        .select();

      if (error) {
        // Fallback to local cache if table or network is not available
        console.warn('[TimerService] Supabase insert warning (saving locally):', error.message);
        this.saveToLocalCache(entry);
        return { ...entry, id: `local_${Date.now()}`, isLocal: true };
      }

      return data?.[0] || entry;
    } catch (err) {
      console.warn('[TimerService] Offline fallback active:', err);
      this.saveToLocalCache(entry);
      return { ...entry, id: `local_${Date.now()}`, isLocal: true };
    }
  }

  /**
   * Retrieves recent entries from Supabase (or local cache fallback)
   * @param {string} [userId]
   * @param {number} [limit=20]
   */
  static async getEntries(userId = null, limit = 20) {
    try {
      const supabase = await getSupabase();
      let query = supabase
        .from('chronos_time_entries')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[TimerService] Error fetching from Supabase, loading local:', error.message);
        return this.getLocalEntries();
      }

      return data || [];
    } catch (err) {
      console.warn('[TimerService] Fetch fallback to local:', err);
      return this.getLocalEntries();
    }
  }

  static saveToLocalCache(entry) {
    const list = this.getLocalEntries();
    list.unshift({ ...entry, id: `local_${Date.now()}`, created_at: new Date().toISOString() });
    StorageService.set('time_entries', list.slice(0, 100));
  }

  static getLocalEntries() {
    return StorageService.get('time_entries', []);
  }

  /**
   * Formats elapsed seconds into HH:MM:SS
   * @param {number} totalSeconds 
   * @returns {string}
   */
  static formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
}
