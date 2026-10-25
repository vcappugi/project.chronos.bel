/**
 * Project Chronos - Storage Service
 * Local offline storage wrapper with JSON serialization and fallback handling.
 */

const STORAGE_PREFIX = 'chronos_';

export class StorageService {
  /**
   * Save item to localStorage
   * @param {string} key 
   * @param {any} value 
   */
  static set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
    } catch (e) {
      console.warn('[StorageService] Error saving to storage:', e);
    }
  }

  /**
   * Retrieve item from localStorage
   * @param {string} key 
   * @param {any} [defaultValue=null] 
   */
  static get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[StorageService] Error reading from storage:', e);
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key 
   */
  static remove(key) {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  }

  /**
   * Clear all Chronos related storage keys
   */
  static clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}
