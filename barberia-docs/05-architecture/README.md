# 05-architecture — Arquitectura del Sistema, Patrones y Seguridad

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Fase SDD:** 🔵 DESIGN (Arquitectura de Software)  

---

## 1. Visión General de la Arquitectura (C4 - Nivel 2: Contenedores)

El sistema adopta una arquitectura modular desacoplada diseñada para alta velocidad, costo de infraestructura mínimo y experiencia de usuario fluida a 60 fps:

```mermaid
flowchart TD
    subgraph Clientes y Dispositivos
        ClientBrowser["🌐 Navegador Web del Cliente\n(Landing + Reserva + Pago)"]
        BarberMobile["📱 Dispositivo del Barbero\n(PWA / Dashboard + Calendario Nativo)"]
        AdminDevice["💻 Terminal del Administrador\n(Dashboard Oculto / Incógnito)"]
    end

    subgraph Plataforma Barbería Lopez
        Frontend["🎨 Frontend SPA / PWA\n(Dark Luxury UI · HTML5/Tailwind/CSS3)"]
        APIGateway["🛡️ Capa de Control y Rutas API\n(Autenticación, RBAC y Enrutamiento)"]

        subgraph Módulos de Lógica de Negocio
            AuthService["🔐 Auth & Credential Manager\n(Gestión de usuarios y contraseñas)"]
            BookingService["📅 Booking & Calendar Sync\n(Generador RFC 5545 iCal / Google Links)"]
            HistoryService["📜 History & Ledger Service\n(Registro inmutable y arqueo de caja)"]
        end

        Database[("🗄️ Base de Datos Relacional\n(users, barbers, appointments, cut_history)")]
    end

    subgraph Servicios Externos
        CalendarEcosystem["📆 Ecosistema de Calendarios\n(Google Calendar / Apple iCal / WebCal)"]
    end

    ClientBrowser -->|HTTP/HTTPS - Portal Público| Frontend
    BarberMobile -->|HTTP/HTTPS - Login y Dashboard| Frontend
    AdminDevice -->|HTTP/HTTPS - Ruta Reservada| Frontend

    Frontend -->|REST API Calls (JSON)| APIGateway
    APIGateway --> AuthService
    APIGateway --> BookingService
    APIGateway --> HistoryService

    AuthService --> Database
    BookingService --> Database
    HistoryService --> Database

    BookingService -->|Disparo de eventos .ics / URL directas| CalendarEcosystem
```

---

## 2. Decisiones de Arquitectura Registradas (ADRs)

### ADR-001: Persistencia Relacional para Historial y Credenciales
* **Contexto:** Se requiere auditar los cortes (cliente, fecha, hora, valor), calcular la caja acumulada del día y permitir al Admin crear usuarios y cambiar contraseñas para los barberos.
* **Decisión:** Utilizar un motor relacional transaccional (SQLite para desarrollo/monolito o PostgreSQL para despliegue distribuido) con claves foráneas, restricciones de unicidad e índices para garantizar consistencia ACID.
* **Consecuencias:** Integridad absoluta en las cifras financieras y control seguro de contraseñas mediante hashing (Argon2id o bcrypt).

### ADR-002: Patrón "Admin Incógnito" (Invisibilidad de Superadmin)
* **Contexto:** El Administrador técnico debe monitorear todo sin que los barberos sospechen o visualicen su presencia.
* **Decisión:** 
  1. El endpoint público `GET /api/barbers` filtra automáticamente y **nunca retorna** usuarios con rol `ADMIN`.
  2. En el frontend no existen botones, badges ni elementos en el DOM que sugieran la existencia del rol de Administrador.
  3. El acceso se realiza a través del mismo formulario `"Acceder"`, pero al autenticarse un token `ADMIN`, el frontend desbloquea dinámicamente el panel de control del propietario técnico.

### ADR-003: Sincronización Dual de Calendarios sin Fricción
* **Contexto:** El cliente debe tener la cita en su teléfono y el barbero asignado también.
* **Decisión:**
  - **Lado Cliente:** Generación instantánea en el navegador del payload `.ics` (compatible con Apple/Outlook) y enlace directo universal a Google Calendar (`calendar.google.com/render?action=TEMPLATE...`).
  - **Lado Barbero:** Feed de suscripción `webcal://` o asignación a su ID de calendario configurado en el sistema.

---

## 3. Modelo de Control de Acceso (RBAC)

| Capacidad / Endpoint | Cliente (Público) | Barbero Practicante | Barbero Jefe | Administrador (Incógnito) |
| :--- | :---: | :---: | :---: | :---: |
| Consultar Disponibilidad de Turnos | ✅ | ✅ | ✅ | ✅ |
| Agendar Cita + Elegir Pago | ✅ | ✅ | ✅ | ✅ |
| Ver Agenda Propia | ❌ | ✅ | ✅ | ✅ |
| Ver Agenda del Otro Barbero | ❌ | ❌ (Bloqueado) | ✅ | ✅ |
| Marcar Corte Completado e Historial | ❌ | ✅ (Sus clientes) | ✅ (Sus clientes) | ✅ |
| Visualizar Caja Diaria en COP | ❌ | ❌ (Bloqueado) | ✅ | ✅ |
| Crear/Eliminar Barberos | ❌ | ❌ | ❌ | ✅ (Exclusivo) |
| Cambiar Contraseñas de Barberos | ❌ | ❌ | ❌ | ✅ (Exclusivo) |
| Auditar Logs y Métricas Ocultas | ❌ | ❌ | ❌ | ✅ (Exclusivo) |
