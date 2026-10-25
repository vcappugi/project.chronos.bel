# Project Chronos

Chronos es una plataforma modular de alta precisión para el registro, gestión y análisis de tiempo y productividad, sincronizada en la nube con Supabase.

---

## 🎯 Vertientes del Proyecto

El proyecto está diseñado con una separación física estricta en dos aplicaciones:

1. **[WebApp](./webapp/)**: 
   - Arquitectura en módulos desacoplados con JavaScript nativo (ES Modules) y CSS puro sin dependencias externas pesadas.
   - Seguridad criptográfica de credenciales mediante **AES-GCM (256-bit)** y **PBKDF2**.
   - Integración completa con Supabase Auth y base de datos en tiempo real.

2. **[Android App](./android/)**:
   - Estructura modular estándar para Android (`AndroidManifest.xml`, recursos visuales, layouts y módulos de servicio).
   - Preparada para ejecución en segundo plano y sincronización móvil.

---

## 🔒 Seguridad y Configuración de Supabase

Las credenciales del sistema (URL y publishable key de Supabase) se encuentran resguardadas en formato encriptado en:
- `webapp/src/config/supabase.config.json`
- `android/app/src/main/assets/config/supabase.config.json`

Cada vez que el sistema requiere comunicarse con Supabase, las credenciales son desencriptadas en memoria bajo demanda mediante la Web Crypto API (`VaultService`), impidiendo la exposición de claves en texto plano en el repositorio. Consulta la [Especificación del Vault](./docs/SECURITY_VAULT.md) para más detalles.

---

## 📂 Organización Modular

```
cronos/
├── docs/                   # Documentación técnica y guías de arquitectura
├── webapp/                 # Aplicación Web
│   ├── index.html          # Punto de entrada
│   ├── css/                # Variables, componentes y módulos CSS
│   └── src/                # Configuración, servicios y módulos funcionales (auth, timer, dashboard)
└── android/                # Aplicación Android
    ├── config/             # Configuración encriptada
    └── app/                # Código fuente, recursos XML y módulos Android
```

---

## 🌐 Repositorio Remoto

- **URL Remota**: `https://github.com/vcappugi/project.chronos.bel.git`
- **Política de Git**: El repositorio local está configurado con este origen remoto. Las operaciones de sincronización remota (`push`) se ejecutan única y exclusivamente bajo confirmación expresa del usuario.
