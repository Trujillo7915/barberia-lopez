# Control de Acceso y Modelo de Roles — Barbería Lopez

> **Principio de Seguridad:** El sistema persiste usuarios, contraseñas cifradas y registros de historial en base de datos relacional. El control de acceso valida tokens de sesión en cada petición, garantizando el aislamiento estricto de visibilidad para el Barbero Practicante y la invisibilidad total del Administrador en interfaces públicas y de barberos.

---

## Matriz de Permisos (RBAC - Role-Based Access Control)

| Funcionalidad / Módulo | Cliente Web | Barbero Practicante | Barbero Jefe | Administrador (Incógnito) |
| :--- | :---: | :---: | :---: | :---: |
| **Reservar Cita y Elegir Pago** | ✅ | ✅ | ✅ | ✅ |
| **Ver Agenda Propia** | ❌ | ✅ | ✅ | ✅ |
| **Ver Agenda del Otro Barbero** | ❌ | ❌ (Oculto) | ✅ | ✅ |
| **Marcar Corte Completado e Historial** | ❌ | ✅ (Sus clientes) | ✅ (Sus clientes) | ✅ |
| **Visualizar Historial Personal** | ❌ | ✅ (Solo el suyo) | ✅ (De todos) | ✅ (De todos) |
| **Visualizar Caja Diaria en COP** | ❌ | ❌ (Bloqueado) | ✅ (Consolidado) | ✅ (Consolidado) |
| **Crear y Eliminar Barberos** | ❌ | ❌ | ❌ | ✅ (Exclusivo) |
| **Cambiar Contraseñas de Barberos** | ❌ | ❌ | ❌ | ✅ (Exclusivo) |
| **Auditoría e Inspección Técnica Encubierta** | ❌ | ❌ | ❌ | ✅ (Exclusivo) |

---

## Especificación de Perfiles

### 1. Perfil: Cliente Web (Público)
* **Objetivo:** Agendar citas, elegir servicio/combo, escoger barbero y método de pago (Efectivo o Transferencia).
* **Restricción:** No tiene acceso al módulo administrativo ni al listado de usuarios internos.

### 2. Perfil: Barbero Practicante (Junior)
* **Objetivo:** Atender a los clientes asignados en su turno y consultar su historial personal.
* **Restricción de Seguridad:** Bloqueo total de la caja y de la agenda del Barbero Jefe. Los datos de ingresos generales no son enviados al cliente ni renderizados.

### 3. Perfil: Barbero Jefe (Maestro Lopez)
* **Objetivo:** Control operativo y financiero de la barbería.
* **Capacidades:** Visualiza la caja consolidada en tiempo real en COP, audita los cortes y turnos de ambas estaciones, y gestiona su propia agenda.

### 4. Perfil: Administrador (Fabián - Incógnito / Superadmin)
* **Objetivo:** Control total, gestión de credenciales y auditoría técnica encubierta.
* **Capacidades:** Aprovisiona nuevos usuarios de barberos, cambia/restablece sus contraseñas, inhabilita cuentas y audita la base de datos sin figurar visiblemente ante los barberos.

