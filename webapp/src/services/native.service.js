/**
 * Project Chronos - Native Hardware Service (Capacitor Bridge)
 * Provides unified access to native device hardware:
 * - Haptics / Vibration feedback
 * - Local Notifications & Alarms
 * - Status Bar & Dark Theme integration
 * - Android Hardware Back Button
 * - Network connectivity state & offline synchronization
 */

export class NativeService {
  static #isCapacitor = null;
  static #haptics = null;
  static #localNotifications = null;
  static #statusBar = null;
  static #app = null;
  static #network = null;

  /**
   * Checks if running inside Capacitor native container
   */
  static isNative() {
    if (this.#isCapacitor === null) {
      this.#isCapacitor = typeof globalThis.Capacitor !== 'undefined' && globalThis.Capacitor.isNativePlatform();
    }
    return this.#isCapacitor;
  }

  /**
   * Initializes native plugins dynamically
   */
  static async init() {
    if (this.isNative()) {
      try {
        // Load plugins from Capacitor global or imports
        const cap = globalThis.Capacitor;
        this.#haptics = cap.Plugins?.Haptics;
        this.#localNotifications = cap.Plugins?.LocalNotifications;
        this.#statusBar = cap.Plugins?.StatusBar;
        this.#app = cap.Plugins?.App;
        this.#network = cap.Plugins?.Network;

        // Configure Android Status Bar
        if (this.#statusBar) {
          await this.#statusBar.setBackgroundColor({ color: '#0A0D14' });
        }

        // Request notification permissions
        if (this.#localNotifications) {
          const perm = await this.#localNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await this.#localNotifications.requestPermissions();
          }
        }
      } catch (err) {
        console.warn('[NativeService] Native plugins initialization warning:', err);
      }
    }
  }

  /**
   * Haptic vibration on button interactions
   * @param {'light' | 'medium' | 'heavy'} [style='medium']
   */
  static async impact(style = 'medium') {
    if (this.isNative() && this.#haptics) {
      try {
        const styleMap = {
          light: 'LIGHT',
          medium: 'MEDIUM',
          heavy: 'HEAVY'
        };
        await this.#haptics.impact({ style: styleMap[style] || 'MEDIUM' });
        return;
      } catch (e) {
        // Fallback below
      }
    }

    // Web Fallback: HTML5 Vibration API
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const msMap = { light: 15, medium: 35, heavy: 60 };
      navigator.vibrate(msMap[style] || 30);
    }
  }

  /**
   * Haptic notification feedback (Success, Warning, Error)
   * @param {'success' | 'warning' | 'error'} type
   */
  static async hapticNotification(type = 'success') {
    if (this.isNative() && this.#haptics) {
      try {
        const typeMap = {
          success: 'SUCCESS',
          warning: 'WARNING',
          error: 'ERROR'
        };
        await this.#haptics.notification({ type: typeMap[type] || 'SUCCESS' });
        return;
      } catch (e) {
        // Fallback below
      }
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'success') {
        navigator.vibrate([40, 60, 40]);
      } else if (type === 'error') {
        navigator.vibrate([80, 50, 80, 50, 100]);
      } else {
        navigator.vibrate([50, 50, 50]);
      }
    }
  }

  /**
   * Schedules a local device notification
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.body
   * @param {number} [options.delaySeconds=0]
   */
  static async scheduleNotification({ title, body, delaySeconds = 0 }) {
    if (this.isNative() && this.#localNotifications) {
      try {
        const scheduleAt = delaySeconds > 0 
          ? new Date(Date.now() + delaySeconds * 1000) 
          : new Date();

        await this.#localNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: title,
              body: body,
              schedule: { at: scheduleAt },
              sound: 'beep.wav'
            }
          ]
        });
        return;
      } catch (e) {
        console.warn('[NativeService] Local notification schedule warning:', e);
      }
    }

    // Web Notification API Fallback
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification(title, { body, icon: './assets/icons/icon-192.png' });
      }, delaySeconds * 1000);
    }
  }

  /**
   * Registers a callback for the Android hardware Back Button
   * @param {() => void} callback
   */
  static registerBackButton(callback) {
    if (this.isNative() && this.#app) {
      this.#app.addListener('backButton', callback);
    }
  }

  /**
   * Registers a listener for network connectivity changes
   * @param {(isOnline: boolean) => void} callback
   */
  static onNetworkStatusChange(callback) {
    if (this.isNative() && this.#network) {
      this.#network.addListener('networkStatusChange', (status) => {
        callback(status.connected);
      });
    } else if (typeof window !== 'undefined') {
      window.addEventListener('online', () => callback(true));
      window.addEventListener('offline', () => callback(false));
    }
  }
}
