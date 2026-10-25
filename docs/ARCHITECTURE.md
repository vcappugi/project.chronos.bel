# Arquitectura del Proyecto Chronos

Chronos es una solución integral para el seguimiento y gestión de tiempo y productividad en dos vertientes:
1. **WebApp**: Aplicación web desarrollada con JavaScript moderno (ES Modules), CSS nativo con arquitectura modular y cliente oficial de Supabase.
2. **Android App**: Aplicación móvil orientada a Android con estructura modular preparada para sincronización en segundo plano.

---

## 🏛️ Estructura del Proyecto

```
c:/xampp/htdocs/cronos/
├── .gitignore                          # Exclusiones de Git (node_modules, builds, OS files)
├── README.md                           # Documentación general del proyecto
├── docs/                               # Documentación técnica paso a paso
│   ├── ARCHITECTURE.md                 # Arquitectura de módulos y diseño
│   └── SECURITY_VAULT.md               # Especificación del cifrado y desencriptado AES-GCM
│
├── webapp/                             # Vertiente Web
│   ├── index.html                      # Punto de entrada HTML5 semántico
│   ├── css/                            # Sistema de diseño CSS nativo
│   │   ├── variables.css               # Tokens de diseño, paleta de colores y gradientes
│   │   ├── base.css                    # Reseteo, tipografía y contenedor principal
│   │   ├── components.css              # Componentes UI (Cards, Botones, Inputs, Toasts)
│   │   └── modules/                    # Estilos encapsulados por módulo
│   │       ├── timer.css               # Estilos del cronómetro y dígitos brillantes
│   │       ├── dashboard.css           # Estilos de tarjetas métricas e historial
│   │       └── auth.css                # Estilos de formulario de autenticación
│   └── src/                            # Código fuente modular en JavaScript
│       ├── config/                     # Configuración y seguridad
│       │   ├── supabase.config.json    # Credenciales cifradas con AES-GCM
│       │   ├── vault.service.js        # Servicio de desencriptado dinámico en memoria
│       │   └── supabase.client.js      # Inicializador y fábrica del cliente Supabase
│       ├── modules/                    # Módulos funcionales desacoplados
│       │   ├── auth/                   # Módulo de Autenticación
│       │   │   ├── auth.service.js     # Servicios de sesión con Supabase Auth
│       │   │   └── auth.controller.js  # Controlador de interacción UI
│       │   ├── timer/                  # Módulo Cronómetro / Tareas
│       │   │   ├── timer.service.js    # Lógica de conteo y persistencia Supabase/Local
│       │   │   └── timer.controller.js # Controlador de botones y UI de tiempo
│       │   └── dashboard/              # Módulo Estadísticas / Dashboard
│       │       ├── dashboard.service.js# Cálculo de métricas agregadas
│       │       └── dashboard.controller.js # Renderizado de tarjetas e historial
│       ├── services/                   # Servicios transversales
│       │   ├── notification.service.js # Sistema de notificaciones toast animadas
│       │   └── storage.service.js      # Almacenamiento local seguro de respaldo
│       └── app.js                      # Orquestador principal y enrutador de tabs
│
└── android/                            # Vertiente Android
    ├── README.md                       # Especificación de la app Android
    ├── config/
    │   └── supabase.config.json        # Configuración cifrada de respaldo
    └── app/
        └── src/
            └── main/
                ├── AndroidManifest.xml # Manifiesto de Android con permisos
                ├── assets/
                │   └── config/
                │       └── supabase.config.json # Credenciales encriptadas para Android
                ├── res/
                │   ├── layout/         # Layout XML de la actividad principal
                │   └── values/         # Strings, colores y estilos
                └── modules/            # Módulos funcionales de Android
                    ├── auth/           # Módulo de autenticación móvil
                    ├── timer/          # Cronómetro móvil y Foreground Service
                    ├── security/       # Motor de desencriptado AES-GCM en Android
                    └── network/        # Cliente REST / Realtime de Supabase
```

---

## 🔄 Separación Física de Módulos

Cada módulo agrupa exclusivamente sus responsabilidades:
- **Service**: Maneja la lógica de negocio, cálculos y comunicación con Supabase o almacenamiento local.
- **Controller**: Responde a eventos del DOM / UI, actualiza la vista y gestiona las transiciones.
- **CSS Module**: Contiene solo las reglas de presentación que competen al módulo respectivo, evitando colisiones de estilo.
