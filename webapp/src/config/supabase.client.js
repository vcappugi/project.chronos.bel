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

  attachAuditUserHook(supabaseInstance);

  return supabaseInstance;
}

const AUDITED_TABLES = new Set([
  'proyectos',
  'actividades',
  'recursos',
  'actividad_recursos',
  'actores',
  'roles',
  'role_permissions',
  'system_objects'
]);

function getActiveAuditUser() {
  try {
    const raw = localStorage.getItem('chronos_cached_session') || sessionStorage.getItem('chronos_cached_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      const actor = parsed?.actor;
      if (actor) {
        return {
          id: actor.id || null,
          name: `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.email || 'Usuario',
          email: actor.email || ''
        };
      }
      if (parsed?.user?.email) {
        return {
          id: parsed.user.id || null,
          name: parsed.user.email,
          email: parsed.user.email
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function wrapFilterBuilderForAudit(builder, rawFrom, tableName) {
  if (!builder || typeof builder.then !== 'function') return builder;

  const originalThen = builder.then.bind(builder);
  builder.then = function (onFulfilled, onRejected) {
    return originalThen(async (res) => {
      if (res && !res.error) {
        const auditUser = getActiveAuditUser();
        if (auditUser) {
          try {
            const { data: logs } = await rawFrom('audit_logs')
              .select('id, new_data, old_data')
              .eq('table_name', tableName)
              .order('created_at', { ascending: false })
              .limit(1);

            const latestLog = logs?.[0];
            if (latestLog && !latestLog.new_data?._audit_user && !latestLog.old_data?._audit_user) {
              const patchPayload = latestLog.new_data
                ? { new_data: { ...latestLog.new_data, _audit_user: auditUser } }
                : { old_data: { ...(latestLog.old_data || {}), _audit_user: auditUser } };
              await rawFrom('audit_logs').update(patchPayload).eq('id', latestLog.id);
            }
          } catch {
            // Non-blocking audit enrichment
          }
        }
      }
      return typeof onFulfilled === 'function' ? onFulfilled(res) : res;
    }, onRejected);
  };
  return builder;
}

function attachAuditUserHook(client) {
  const rawFrom = client.from.bind(client);
  client.from = function (tableName) {
    const queryBuilder = rawFrom(tableName);
    if (!AUDITED_TABLES.has(tableName)) {
      return queryBuilder;
    }

    ['insert', 'update', 'delete'].forEach(method => {
      if (typeof queryBuilder[method] === 'function') {
        const origMethod = queryBuilder[method].bind(queryBuilder);
        queryBuilder[method] = function (...args) {
          const filterBuilder = origMethod(...args);
          return wrapFilterBuilderForAudit(filterBuilder, rawFrom, tableName);
        };
      }
    });

    return queryBuilder;
  };
}
