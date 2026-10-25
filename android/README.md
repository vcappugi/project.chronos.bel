# Chronos - Módulo Android

Este directorio contiene la arquitectura y estructura física para la vertiente **Android** del proyecto Chronos.

## 📁 Estructura Modular

```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── AndroidManifest.xml          # Permisos, actividades y servicios de Chronos
│   │       ├── assets/
│   │       │   └── config/
│   │       │       └── supabase.config.json # Configuración encriptada (AES-GCM)
│   │       ├── res/
│   │       │   ├── values/                  # Strings, colores, temas
│   │       │   └── layout/                  # Layouts XML principales
│   │       └── modules/
│   │           ├── auth/                    # Gestión de sesiones y tokens Supabase Auth
│   │           ├── timer/                   # Lógica de cronómetro de alta precisión y foreground service
│   │           ├── security/                # Desencriptado dinámico mediante Android Keystore / Cipher AES-GCM
│   │           └── network/                 # Cliente HTTP y llamadas a la API REST/Realtime de Supabase
└── config/
    └── supabase.config.json                 # Copia de configuración encriptada de respaldo
```

## 🔒 Mecanismo de Seguridad y Desencriptado
Al igual que en la vertiente web, las credenciales de Supabase se encuentran almacenadas de forma encriptada bajo el estándar **AES-GCM (256-bit)** con derivación de clave **PBKDF2**.
- El módulo `security/` se encarga de leer el archivo `supabase.config.json` de `assets/` y desencriptar las credenciales en memoria en tiempo de ejecución.
- Nunca se almacenan las llaves en texto plano en el repositorio.
