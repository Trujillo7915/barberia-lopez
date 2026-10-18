# 08-uml — Diagramas de Secuencia y Casos de Uso del Sistema

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Fase SDD:** 🔵 DESIGN (Diagramas UML)  

Este documento reúne los diagramas de interacción y secuencia para los flujos críticos del sistema.

---

## 1. Diagrama de Secuencia: Reserva de Cita y Sincronización Dual de Calendario

Ilustra la interacción cuando el cliente reserva, selecciona el método de pago y el sistema asigna el evento al calendario del cliente y al del barbero:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Cliente Web
    participant UI as 💻 Frontend (Landing)
    participant API as 🛡️ API Backend
    participant DB as 🗄️ Base de Datos
    participant CalBarbero as 📱 Calendario del Barbero
    participant CalCliente as 📱 Dispositivo del Cliente

    Cliente->>UI: 1. Selecciona Combo, Barbero, Fecha y Hora
    Cliente->>UI: 2. Escoge Pago (Efectivo / Transferencia) y datos
    Cliente->>UI: 3. Clic en "Confirmar Cita"
    UI->>API: POST /api/v1/appointments
    API->>DB: Verificar disponibilidad del barbero (Solapamiento)
    alt Barbero disponible
        API->>DB: INSERT INTO citas (...) VALUES (...)
        API->>CalBarbero: Notificar/Asignar evento a la agenda del Barbero
        API-->>UI: 201 Created (Payload .ics + Google Calendar URL)
        UI->>CalCliente: Ofrece botón "Añadir a Google Calendar" o descarga .ics
        CalCliente-->>Cliente: Cita agendada en la app de calendario nativa
        UI-->>Cliente: Pantalla de Confirmación de Turno
    else Barbero ocupado
        API-->>UI: 409 Conflict ("Horario no disponible")
        UI-->>Cliente: Muestra sugerencia de horario alternativo
    end
```

---

## 2. Diagrama de Secuencia: Finalización del Servicio e Inserción en Historial

Ilustra la inmutabilidad del historial cuando un barbero atiende a un cliente y se actualiza la caja del día:

```mermaid
sequenceDiagram
    autonumber
    actor Barbero as 💈 Barbero (Jefe o Practicante)
    participant UI as 💻 Dashboard del Barbero
    participant API as 🛡️ API Backend
    participant DB as 🗄️ Base de Datos
    actor Jefe as 👑 Barbero Jefe

    Barbero->>UI: Clic en "Finalizar Corte" (Cita terminada)
    UI->>API: POST /api/v1/barber/appointments/{id}/complete
    API->>DB: UPDATE citas SET estado = 'COMPLETADA' WHERE id = {id}
    API->>DB: INSERT INTO historial_cortes (cliente_nombre, fecha, hora, valor_cop, barbero_id)
    API-->>UI: 200 OK (Corte registrado)
    UI-->>Barbero: Muestra corte en su historial personal

    opt Si el Barbero Jefe consulta la caja
        Jefe->>UI: Consulta módulo "Caja del Día"
        UI->>API: GET /api/v1/barber/cash-register
        API->>DB: SELECT SUM(valor_cop) FROM historial_cortes WHERE fecha = TODAY
        DB-->>API: Total recaudado (Jefe + Practicante)
        API-->>UI: Retorna total en COP
        UI-->>Jefe: Muestra \$ acumulado en tiempo real
    end
```

---

## 3. Diagrama de Secuencia: Administración y Cambio de Contraseñas (Admin Incógnito)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 🕵️ Admin Incógnito (Fabián)
    participant UI as 💻 Frontend (Modal "Acceder")
    participant API as 🛡️ API Backend
    participant DB as 🗄️ Base de Datos
    actor Barbero as 💈 Barbero

    Admin->>UI: Clic en botón "Acceder" + Credenciales de Superadmin
    UI->>API: POST /api/v1/auth/login
    API->>DB: Valida credenciales con hash Argon2id/bcrypt
    API-->>UI: Token JWT con rol 'ADMIN'
    UI->>UI: Desbloquea módulo oculto de Gestión de Personal
    Admin->>UI: Selecciona barbero y envía "Cambiar Contraseña"
    UI->>API: PUT /api/v1/admin/users/{id}/password
    API->>DB: UPDATE usuarios SET password_hash = new_hash WHERE id = {id}
    API-->>UI: 200 OK ("Contraseña actualizada")
    UI-->>Admin: Notificación de confirmación

    Barbero->>UI: Intenta ingresar con su nueva contraseña
    UI->>API: POST /api/v1/auth/login
    API->>DB: Valida nueva credencial
    API-->>UI: Acceso permitido al panel de su rol
```
