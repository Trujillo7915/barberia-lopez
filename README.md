# Barberia Lopez — Plataforma Oficial (Neiva, Huila)

> Sistema integral de gestion de turnos en tiempo real, tienda de productos con inventario, citas, sincronizacion de calendarios RFC 5545 (Google/Apple) y control de caja diaria.
> Implementado en Node.js puro y Vanilla JavaScript de alto rendimiento bajo estandares de arquitectura limpia.

---

## 1. Guia Rapida y Ahorro de Tokens

Para localizar cualquier funcion, endpoint o logica sin gastar tokens en exploraciones redundantes, consulte:
- **[CODEMAP.md](CODEMAP.md)**: Mapa quirurgico con rangos de lineas exactos de `server.js` y `src/bundle.js`.
- **[barberia-docs/README.md](barberia-docs/README.md)**: Indice formal de requerimientos de negocio, casos de uso y diagramas UML.

---

## 2. Comandos del Proyecto

```bash
# Iniciar servidor local en http://localhost:3000
npm start

# Ejecutar suite completa de pruebas automatizadas (35/35 verificaciones)
npm test

# Ejecutar suites individuales
npm run test:security      # Penetration testing defensivo y seguridad HTTP
npm run test:concurrency   # Idempotencia, prevencion de colisiones y feeds RFC 5545
npm run test:cash          # Finalizacion de cortes y balance de caja diaria
npm run test:store         # Catalogo, inventario, pedidos y control de turnos
```

---

## 3. Arquitectura del Repositorio

```text
barberia-lopez/
├── CODEMAP.md                  # Indice maestro de navegacion quirurgica
├── README.md                   # Documentacion general del repositorio
├── package.json                # Configuracion y scripts npm
├── server.js                   # Backend Node.js puro (seguridad, APIs, persistencia y estaticos)
├── index.html                  # Entrypoint raiz con preloader y redireccion a /src/
├── logo_barberia_lopez_hd.jpg  # Asset de marca en raiz para precarga inmediata
│
├── src/                        # Frontend de produccion (SPA activa)
│   ├── index.html              # HTML shell y pantalla de carga con logo oficial
│   ├── bundle.js               # SPA cliente completa (Onion Architecture consolidada)
│   ├── logo_barberia_lopez_hd.jpg
│   ├── logo_barberia_lopez.png
│   └── ui/styles/              # Hojas de estilo CSS activas
│       ├── theme.css           # Paleta Obsidian & Imperial Gold y tipografia
│       └── animations.css      # Micro-interacciones y transiciones
│
├── data/                       # Base de datos persistente en disco (JSON blindados)
│   ├── .auth_secret            # Secreto HMAC persistente
│   ├── appointments.json       # Citas agendadas y estados
│   ├── barbers.json            # Barberos y estado de turno en estacion (onShift)
│   ├── history.json            # Historial inmutable de cortes completados
│   ├── products.json           # Catalogo de productos e inventario
│   ├── services.json           # Catalogo oficial de servicios
│   ├── store_orders.json       # Pedidos con referencia unica REF-BL-XXXXXX
│   └── users.json              # Cuentas de usuario con scrypt/pbkdf2 y RBAC
│
├── tests/                      # Suites de pruebas automatizadas
│   ├── run_all_tests.js        # Ejecutor maestro
│   ├── test_security.js        # Suite de ciberseguridad
│   ├── test_concurrency_and_barbers.js
│   ├── test_cut_completion_and_cash.js
│   └── test_store.js
│
├── docs/dossier/               # Dossiers comerciales y presentacion
│   ├── dossier_barberia_lopez.html
│   └── Dossier_Plataforma_Barberia_Lopez.pdf
│
├── archive/v1-legacy-scaffold/ # Andamiaje modular inicial archivado (NO usado en produccion)
│   └── README.md
│
├── barberia-docs/              # Especificaciones formales de negocio y diagramas
│   └── README.md
│
├── media/                      # Material multimedia de archivo
└── REGLAS-IA/                  # Reglas de trabajo de Fabian (cero emojis, rigor tecnico)
    └── README.md
```

---

## 4. Control de Acceso y Roles (RBAC)

1. **Barbero Jefe (Maestro Lopez / David):**
   - Acceso a su agenda y a la agenda de las demas estaciones.
   - Control de turno presencial (`onShift`).
   - Visualizacion consolidada de la caja del dia en COP en tiempo real.
   - Historial de cortes y entrega de pedidos presenciales en estacion.

2. **Barbero:**
   - Acceso exclusivo a su agenda y citas asignadas.
   - Activacion y desactivacion de turno en su estacion.
   - Cobro y entrega de pedidos asignados cuando se encuentra en turno.
   - Registro de cortes finalizados en su historial.
   - Restringido: sin acceso a la configuracion general ni a contrasenas de terceros.

3. **Administrador:**
   - Invisible en el portal del cliente.
   - Administracion global de cuentas: creacion de usuarios, asignacion de roles, cambio de contrasenas y eliminacion.
   - Gestion del catalogo de productos e inventario de la tienda.
   - Depuracion de registros de prueba y auditoria transaccional.

---

## 5. Informacion de Marca (Barberia Lopez)

- **Establecimiento:** Barberia Lopez — *"Somos los arquitectos de tu imagen"*.
- **Ubicacion:** Neiva, Huila, Colombia.
- **Linea WhatsApp Oficial:** `+57 321 989 7910`.
- **TikTok Oficial:** `@barber_lopez_neiva`.
- **Politica Visual:** Estetica Josh Warner (Obsidian `#0a0b0d`, Dark Metal `#14161a`, Oro Imperial `#d4af37` y Tipografia Editorial Serif con JetBrains Mono).
