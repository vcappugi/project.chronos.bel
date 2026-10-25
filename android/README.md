# Chronos - Módulo Android Híbrido (Capacitor / WebView)

Este directorio contiene el proyecto nativo Android generado y gestionado con **Capacitor**, integrando el núcleo de Chronos (HTML5, CSS moderno, ES Modules) con capacidades y acceso nativo al hardware del dispositivo.

---

## ⚡ Capacidades Nativas de Hardware Integradas

1. **Retroalimentación Háptica / Vibración (`@capacitor/haptics`)**:
   - Resonancia táctil nativa al presionar botones (iniciar, pausar, reset).
   - Patrón vibratorio de confirmación (`SUCCESS` / `ERROR`) al guardar registros de tiempo en Supabase.
   - Permiso configurado en Android: `android.permission.VIBRATE`.

2. **Notificaciones Locales y Alarmas (`@capacitor/local-notifications`)**:
   - Notificaciones nativas en la barra de estado de Android al culminar tareas o intervalos.
   - Permiso configurado en Android: `android.permission.POST_NOTIFICATIONS`.

3. **Control de Barra de Estado y Tema (`@capacitor/status-bar`)**:
   - Configuración de color `#0A0D14` y estilo de texto claro para armonizar con el tema oscuro de Chronos.

4. **Ciclo de Vida y Botón Atrás (`@capacitor/app`)**:
   - Intercepta el botón físico "Atrás" de Android para navegar entre pestañas en lugar de cerrar intempestivamente la app mientras el cronómetro esté activo.

5. **Detección de Conectividad de Red (`@capacitor/network`)**:
   - Monitoreo en tiempo real del estado de internet para activar el modo offline / online y sincronizar registros pendientes.

---

## 🚀 Comandos de Flujo de Trabajo

* **Sincronizar cambios web con Android**:
  ```bash
  npm run cap:sync
  ```
* **Copiar archivos web a assets nativos**:
  ```bash
  npm run cap:copy
  ```
* **Abrir el proyecto en Android Studio**:
  ```bash
  npm run cap:open
  ```
