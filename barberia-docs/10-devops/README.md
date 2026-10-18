# 10-devops — Pautas de Despliegue, Ejecución Local y Arquitectura en Código

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Fase SDD:** 🟢 IMPL / OPS (DevOps e Implementación)  

Este documento describe la estructura modular en código, el mapa concéntrico de la **Arquitectura Onion** implementada en `src/` y las pautas para ejecutar y desplegar la plataforma a costo \$0 COP.

---

## 1. Estructura de Código: Implementación Concéntrica (Onion Architecture)

El código fuente en `src/` sigue estrictamente el principio de inversión de dependencias:

```text
src/
├── domain/                         # CAPA 1 & 2: NÚCLEO Y REGLAS DE NEGOCIO PURAS
│   ├── types/
│   │   └── Enums.js                # Roles (ADMIN, JEFE, PRACTICANTE), PaymentMethods, Status
│   ├── models/
│   │   ├── User.js                 # Entidad pura de Usuario
│   │   ├── Barber.js               # Entidad pura de Barbero
│   │   ├── Service.js              # Entidad pura de Servicio/Combo
│   │   ├── Appointment.js          # Entidad de Cita y Turno
│   │   └── CutHistory.js           # Entidad inmutable de corte realizado
│   └── services/
│       ├── AvailabilityService.js  # Validación de no solapamiento de turnos
│       ├── CashCalculatorService.js# Cálculo consolidado de caja diaria
│       └── AccessControlService.js # Matriz de roles y filtro de admin incógnito
│
├── application/                    # CAPA 3: CASOS DE USO (ORQUESTACIÓN)
│   └── use-cases/
│       ├── BookAppointmentUseCase.js   # Agenda y prepara sincronización móvil
│       ├── CompleteCutUseCase.js       # Marca completado y guarda en historial
│       ├── LoginUseCase.js             # Autenticación segura de personal
│       ├── ManageUsersUseCase.js       # Admin: crear barberos, cambiar contraseñas
│       ├── GetCashRegisterUseCase.js   # Arqueo de caja para Barbero Jefe
│       └── GetBarberHistoryUseCase.js  # Consulta de historial con aislamiento
│
├── infrastructure/                 # CAPA 4: ADAPTADORES EXTERNOS
│   ├── persistence/
│   │   ├── SeedData.js                 # Semillas oficiales de Barbería Lopez
│   │   └── LocalStorageRepository.js   # Repositorio transaccional en navegador
│   └── calendar/
│       ├── IcsCalendarAdapter.js       # Generador y descargador RFC 5545 (.ics)
│       ├── GoogleCalendarAdapter.js    # Generador de enlaces Google Calendar
│       └── CalendarGateway.js          # Fachada unificada de calendarios
│
└── ui/                             # CAPA 4: PRESENTACIÓN (DARK LUXURY)
    ├── styles/
    │   ├── theme.css                   # Tokens CSS (Obsidiana, Oro, Marfil)
    │   └── animations.css              # Transiciones a 60 fps y ticker marquee
    ├── state/
    │   └── AppState.js                 # Store reactivo desacoplado
    ├── components/
    │   ├── Navbar.js                   # Cabecera con botón sobrio "Acceder"
    │   ├── Hero.js                     # Editorial Hero con badges flotantes
    │   ├── Marquee.js                  # Ticker continuo de servicios
    │   ├── Catalog.js                  # Bento Grid de servicios y combos
    │   ├── BookingWidget.js            # Selector interactivo de barbero y pago
    │   ├── AuthModal.js                # Modal de login para personal
    │   ├── BarberDashboard.js          # Panel con caja (Jefe) o aislado (Junior)
    │   └── AdminPanel.js               # Panel incógnito para gestión de claves
    └── app.js                          # Bootstrapper y controlador principal
```

---

## 2. Ejecución Local

Dado que la arquitectura utiliza módulos nativos de JavaScript moderno (`type="module"`), se recomienda ejecutarla a través de cualquier servidor estático local para evitar restricciones de seguridad CORS en el protocolo `file://`:

### Opción A: Con Python (si estuviera disponible)
```powershell
python -m http.server 8000 --directory "c:\Proyecto Barberia\src"
```

### Opción B: Con Node / npx (si estuviera disponible)
```powershell
npx serve "c:\Proyecto Barberia\src"
```

### Opción C: VS Code Live Server / Navegador Directo
Abrir la carpeta en VS Code y hacer clic en **"Go Live"** en la barra inferior apuntando a `src/index.html`.

---

## 3. Opciones de Despliegue en Producción (\$0 COP)

1. **GitHub Pages:**
   * Crear repositorio en GitHub y apuntar la rama `main` a la carpeta `src/`.
   * Despliegue automático con certificado SSL HTTPS gratuito.
2. **Vercel / Netlify:**
   * Conectar el repositorio y configurar el directorio de publicación en `src/`.
