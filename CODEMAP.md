# CODEMAP — Mapa Quirurgico de Navegacion y Arquitectura

> Documento oficial de orientacion rapida para agentes de IA y desarrolladores.
> **Objetivo**: Localizar de inmediato cualquier logica, funcion, modelo o endpoint sin exploraciones redundantes y con **minimo consumo de tokens**.

---

## 1. Topologia del Repositorio

```
barberia-lopez/
├── CODEMAP.md                  <- Indice maestro de navegacion quirurgica (este archivo)
├── README.md                   <- Informacion general del proyecto y ejecucion
├── package.json                <- Scripts de inicio y ejecucion de pruebas
├── server.js                   <- Backend Node.js puro (seguridad, APIs, persistencia y estaticos)
├── index.html                  <- Entrypoint raiz con preloader inmediato y redireccion a /src/
├── logo_barberia_lopez_hd.jpg  <- Asset oficial de marca para favicons y precarga
│
├── src/                        <- Frontend de produccion (SPA activa)
│   ├── index.html              <- Markup principal y pantalla de carga (preloader)
│   ├── bundle.js               <- SPA transaccional completa (Onion Architecture consolidada)
│   ├── logo_barberia_lopez_hd.jpg <- Logo oficial en alta definicion
│   ├── logo_barberia_lopez.png    <- Logo oficial en PNG
│   └── ui/styles/              <- Hojas de estilo cargadas por index.html
│       ├── theme.css           <- Variables CSS, paleta Obsidian & Gold y tipografias
│       └── animations.css      <- Keyframes y micro-interacciones suaves
│
├── data/                       <- Persistencia atomica en disco (JSON protegidos)
│   ├── .auth_secret            <- Clave criptografica HMAC del servidor
│   ├── appointments.json       <- Citas reservadas, confirmadas y completadas
│   ├── barbers.json            <- Perfiles de barberos y estado de turno (onShift)
│   ├── history.json            <- Cortes finalizados y auditoria de caja
│   ├── products.json           <- Catalogo de productos e inventario
│   ├── services.json           <- Catalogo oficial de servicios
│   ├── store_orders.json       <- Pedidos de tienda, referencias unicas y entregas
│   └── users.json              <- Cuentas de usuario con scrypt/pbkdf2 y RBAC
│
├── tests/                      <- Suites de pruebas automatizadas
│   ├── run_all_tests.js        <- Orquestador maestro (npm test)
│   ├── test_security.js        <- Penetration testing defensivo y seguridad HTTP
│   ├── test_concurrency_and_barbers.js <- Idempotencia, colisiones y feeds RFC 5545
│   ├── test_cut_completion_and_cash.js <- Finalizacion de cortes y caja diaria
│   └── test_store.js           <- Catalogo, inventario, pedidos y control de turnos
│
├── docs/dossier/               <- Dossiers comerciales y presentacion del sistema
│   ├── dossier_barberia_lopez.html
│   └── Dossier_Plataforma_Barberia_Lopez.pdf
│
├── archive/v1-legacy-scaffold/ <- Codigo modular inicial archivado (NO se ejecuta en produccion)
│   └── README.md
│
├── barberia-docs/              <- Especificaciones completas de requerimientos y diseno
│   └── README.md               <- Indice maestro de requerimientos y casos de uso
│
├── media/                      <- Videos y material de archivo de la barberia
└── REGLAS-IA/                  <- Reglas mandatorias de Fabian (cero emojis, ahorro de tokens)
    └── README.md
```

---

## 2. Mapa Quirurgico de Backend (`server.js`)

Archivo monolítico blindado en Node.js puro (2221 líneas).

| Rango de Lineas | Modulo / Responsabilidad | Descripcion Tecnica |
| :--- | :--- | :--- |
| **L1 - L212** | Configuracion y Persistencia | Constantes, directorios, deteccion de Render, smart-merge y lectura/escritura atomica de JSON. |
| **L213 - L331** | Criptografia y Auth | Generacion de secretos, hash seguro `scrypt` con fallback `pbkdf2`, firma HMAC SHA-256 para tokens de sesion y RBAC. |
| **L332 - L407** | Rate Limiting Defensivo | Control de frecuencia de peticiones por IP y bloqueo de fuerza bruta en autenticacion (`maxFailedAttempts = 15`). |
| **L408 - L440** | Proteccion DoS | Lectura de cuerpos HTTP con limite estricto de tamano (`MAX_BODY_SIZE = 1MB`). |
| **L441 - L535** | Mutex y Anti-Colision | Prevencion de Double Booking, validacion transaccional y bloqueo por estacion. |
| **L536 - L749** | iCalendar RFC 5545 | Generador de feeds de calendario (`.ics`), timezone `America/Bogota`, `SEQUENCE:0` y compatibilidad Google Calendar / Apple Calendar. |
| **L750 - L770** | Cabeceras de Seguridad | CSP estricto (`default-src`, `script-src`, `style-src`), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`. |
| **L771 - L815** | Validador de Rutas | Proteccion contra Directory Traversal y lista blanca de archivos estaticos autorizados (`isPathSafeAndAllowed`). |
| **L816 - L858** | Servidor HTTP y CORS | Manejo de peticiones HTTP, preflight `OPTIONS` y normalizacion de URL. |
| **L859 - L932** | `POST /api/auth/login` | Autenticacion centralizada, verificacion de clave, migracion transparente a scrypt y emision de token HMAC. |
| **L933 - L993** | `/api/calendar/*` | Descarga de feeds de barberos, clientes y citas individuales (`.ics`). |
| **L994 - L1090** | `/api/appointments` | CRUD de citas (GET, POST con deteccion de colision, PUT status, DELETE). |
| **L1091 - L1161**| `POST /api/sync` | Sincronizacion bidireccional cliente-servidor para modo offline y backup. |
| **L1162 - L1359**| `/api/barbers` | CRUD de barberos, creacion atomica de barbero+usuario y toggle de turno (`onShift`). |
| **L1360 - L1548**| `/api/users` | Administracion de cuentas, cambio de contrasenas, saneamiento de passwordHash y eliminacion segura. |
| **L1549 - L1616**| `/api/history` | Historial de cortes completados, prevencion de duplicados y balance de caja. |
| **L1617 - L1639**| `POST /api/control/clear-tests` | Depuracion controlada de registros de prueba (citas, usuarios y cortes ficticios). |
| **L1640 - L1650**| `GET /api/services` | Catalogo oficial de servicios de la barberia. |
| **L1651 - L1812**| `/api/products` | Catalogo de la tienda, creacion, modificacion y ajuste de stock. |
| **L1813 - L2148**| `/api/store/orders` | Gestion de pedidos: apartado con referencia unica (`REF-BL-XXXXXX`), cobro/entrega presencial (`/deliver`) y cancelacion (`/cancel`). |
| **L2149 - L2215**| Servidor Estatico | Despacho seguro de archivos desde `src/`, redireccion de `index.html` y mapeo de dossiers. |
| **L2216 - L2221**| `server.listen` | Arranque del servidor en puerto configurado (default: 3000). |

---

## 3. Mapa Quirurgico de Frontend (`src/bundle.js`)

SPA reactiva construida bajo Arquitectura Onion (5127 líneas).

| Rango de Lineas | Capa Arquitectonica | Contenido y Funciones Clave |
| :--- | :--- | :--- |
| **L25 - L120** | Capa 1: Dominio | `Roles` (ADMIN, JEFE, BARBERO, PRACTICANTE), `PaymentMethods`, `AppointmentStatus`, modelos `User`, `Barber`, `Service`, `Appointment`, `CutHistory`, `Product`, `StoreOrder`. |
| **L121 - L223** | Capa 2: Servicios de Dominio | `AccessControlService` (permisos y RBAC), `AvailabilityService` (franjas horarias y slots de 30 min), `CashCalculatorService` (caja diaria por barbero y consolidado). |
| **L224 - L1179**| Capa 4: Infraestructura | `LocalStorageRepository`: almacenamiento local, cola offline, sincronizacion con el servidor, interceptor de token HMAC y purge de cache. |
| **L1180 - L1199**| Helpers de Tiempo | Formateo de fechas, cadenas locales y generadores de slots horarios. |
| **L1200 - L1442**| Capa 3: Casos de Uso | `BookAppointmentUseCase`, `CompleteCutUseCase`, `LoginUseCase`, `ManageUsersUseCase`, `GetCashRegisterUseCase`, `GetBarberHistoryUseCase`. |
| **L1443 - L1645**| Calendario Interactivo | `renderCalendarGrid()` y `renderTimeSlotsGrid()`: generacion de grilla mensual y franjas horarias continuas (08:00 a 21:30). |
| **L1646 - L1704**| Capa 4: Estado UI | Objeto `appState`: usuario autenticado, cita seleccionada, barbero activo, carrito de compras, fecha activa y filtros. |
| **L1705 - L3450**| Renderizado Principal | `renderApp()`: ensamble reactivo de la interfaz Josh Warner (Navbar, Hero, Marquee, Widget de Agendamiento, Dashboard del Barbero, Panel Administrativo, Catalogo de Tienda y Carrito). |
| **L3451 - L3708**| Modales de la Interfaz | Modal de Login/Acceso de Personal, Modal de Confirmacion de Agendamiento, Modal de Apartado de Productos con Referencia Unica, Modal de Consulta de Pedidos y Modal de Venta Directa en Estacion. |
| **L3709 - L4991**| Eventos e Interacciones | `setupEventListeners()`: delegacion de eventos del DOM, envio de formularios, toggle de turnos, confirmacion de cobros, cancelacion de citas y filtrado. |
| **L4992 - L5127**| Sincronizacion y Montaje | Modal de sincronizacion iCal/Webcal para clientes, funcion `dismissPreloader()` e inicializacion de la aplicacion (`bootApp`). |

---

## 4. Guia Rapida: ¿Donde hago mis cambios?

### Quiero modificar un Endpoint o la Base de Datos
- **Ruta**: `server.js` (consulte la tabla de la Seccion 2).
- **Archivos de datos**: `data/*.json`. Nunca modifique estos archivos manualmente con el servidor corriendo sin respetar el formato JSON existente.

### Quiero modificar la Interfaz Grafica o un Boton
- **Estructura HTML renderizada**: Busque en `src/bundle.js` dentro de la funcion `renderApp()` (L1705 - L3450).
- **Logica del clic o submit**: Busque en `src/bundle.js` dentro de `setupEventListeners()` (L3709 - L4991).
- **Estilos o colores**: Modifique `src/ui/styles/theme.css`.
- **Animaciones**: Modifique `src/ui/styles/animations.css`.

### Quiero modificar la Pantalla de Carga (Preloader)
- **Markup y estilos inline de carga 0ms**: `src/index.html` (L13 - L180) y `index.html`.
- **Desvanecimiento y transicion de cierre**: `src/bundle.js` (funcion `dismissPreloader`).

### Quiero agregar o ejecutar Pruebas Automatizadas
- **Ejecutar todas las pruebas**: `npm test`.
- **Ejecutar suite especifica**:
  - `npm run test:security`
  - `npm run test:concurrency`
  - `npm run test:cash`
  - `npm run test:store`

---

## 5. Politicas Obligatorias del Proyecto
1. **Politica Estricta Cero Emojis**: Ningun archivo de codigo, comentario, mensaje de commit o salida debe contener emojis.
2. **Node.js Nativo**: No anadir dependencias externas pesadas a `package.json`.
3. **Persistencia Segura**: Toda escritura a archivos de `data/` debe realizarse de forma atomica con `writeJsonFileAtomic`.
