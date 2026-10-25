/**
 * Project Chronos - Vault Security Service
 * Handles client-side decryption of sensitive application configuration
 * utilizing standard Web Crypto API (AES-GCM 256-bit + PBKDF2).
 */

const VAULT_MASTER_KEY = 'CHRONOS_PROJECT_SECURE_VAULT_KEY_2026';

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class VaultService {
  static #cachedCredentials = null;

  /**
   * Decrypts encrypted configuration payload
   * @param {Object} encryptedPayload Encrypted config object
   * @param {string} [passphrase] Master passphrase for PBKDF2 derivation
   * @returns {Promise<{ supabaseUrl: string, supabaseKey: string }>}
   */
  static async decryptConfig(encryptedPayload, passphrase = VAULT_MASTER_KEY) {
    if (this.#cachedCredentials) {
      return this.#cachedCredentials;
    }

    const cryptoObj = globalThis.crypto;
    if (!cryptoObj || !cryptoObj.subtle) {
      throw new Error('Web Crypto API is not available in the current runtime environment.');
    }

    try {
      const enc = new TextEncoder();
      const dec = new TextDecoder();

      const salt = base64ToUint8Array(encryptedPayload.salt);
      const iv = base64ToUint8Array(encryptedPayload.iv);
      const ciphertext = base64ToUint8Array(encryptedPayload.ciphertext);

      // 1. Import raw passphrase as key material
      const keyMaterial = await cryptoObj.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      // 2. Derive AES-GCM 256-bit key using PBKDF2
      const derivedKey = await cryptoObj.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: encryptedPayload.iterations || 100000,
          hash: encryptedPayload.hash || 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // 3. Decrypt ciphertext using AES-GCM
      const decryptedBuffer = await cryptoObj.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        ciphertext
      );

      const decryptedJson = dec.decode(decryptedBuffer);
      const credentials = JSON.parse(decryptedJson);

      this.#cachedCredentials = credentials;
      return credentials;
    } catch (error) {
      console.error('[Chronos Vault] Decryption failed:', error);
      throw new Error('Security Error: Unable to decrypt configuration payload.');
    }
  }

  /**
   * Clears the decrypted credentials cache in memory
   */
  static clearCache() {
    this.#cachedCredentials = null;
  }
}
