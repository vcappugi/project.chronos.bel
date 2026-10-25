/**
 * Project Chronos - Supabase Client Factory
 * Decrypts credentials on demand before initializing the Supabase client.
 */

import { VaultService } from './vault.service.js';

let supabaseInstance = null;
let credentialsPromise = null;

/**
 * Loads encrypted configuration and decrypts credentials
 * @returns {Promise<{ supabaseUrl: string, supabaseKey: string }>}
 */
export async function getDecryptedCredentials() {
  if (!credentialsPromise) {
    credentialsPromise = (async () => {
      // Fetch the encrypted configuration payload
      const configUrl = new URL('./supabase.config.json', import.meta.url);
      const response = await fetch(configUrl);
      if (!response.ok) {
        throw new Error(`Failed to load encrypted config: ${response.statusText}`);
      }
      const encryptedPayload = await response.json();

      // Decrypt credentials on demand
      const credentials = await VaultService.decryptConfig(encryptedPayload);
      return credentials;
    })();
  }
  return credentialsPromise;
}

/**
 * Initializes and returns the Supabase client on demand
 * @returns {Promise<any>} Supabase client instance
 */
export async function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const { supabaseUrl, supabaseKey } = await getDecryptedCredentials();

  // Support both CDN/ESM imports and window.supabase (if script tag is loaded)
  let createClientFn = globalThis.supabase?.createClient;

  if (!createClientFn) {
    // Dynamically import Supabase JS ESM client
    const supabaseModule = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    createClientFn = supabaseModule.createClient;
  }

  if (typeof createClientFn !== 'function') {
    throw new Error('Supabase client library could not be loaded.');
  }

  supabaseInstance = createClientFn(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseInstance;
}
