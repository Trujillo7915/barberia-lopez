# 12-ux-ui — Sistema de Diseño, Wireframes y Flujos de Usuario

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Fase SDD:** 🔵 DESIGN (Experiencia de Usuario e Interfaz)  

Este directorio contiene las especificaciones visuales, componentes de interfaz y mapas de navegación para la plataforma web de **Barbería Lopez**.

---

## 1. Documentos en esta Sección

* **[`DESIGN.md`](./DESIGN.md):** Sistema de diseño integral (*Dark Luxury & Editorial Craft*), tokens CSS, paleta de color (obsidiana y oro), jerarquía tipográfica, transiciones a 60 fps y componentes del sistema basados en la referencia en video.

---

## 2. Mapa de Navegación del Sistema

```mermaid
flowchart TD
    subgraph Experiencia Pública (Cliente)
        L1["Inicio / Landing Page"]
        L2["Catálogo de Combos y Precios"]
        L3["Selector de Barbero y Calendario"]
        L4["Selección de Pago (Efectivo / Nequi)"]
        L5["Confirmación + Botones de Calendario (Google / .ics)"]
        L1 --> L2 --> L3 --> L4 --> L5
    end

    subgraph Experiencia Interna (Personal Autenticado)
        Login["Modal de Acceso ('Acceder')"]
        L1 -.->|Botón 'Acceder'| Login

        Login -->|Rol: PRACTICANTE| DashPracticante["Dashboard Practicante\n• Turnos asignados\n• Historial personal de cortes\n• ❌ Caja Bloqueada"]
        Login -->|Rol: JEFE| DashJefe["Dashboard Barbero Jefe\n• Agenda general (propia + ayudante)\n• Caja acumulada en tiempo real (COP)\n• Historial consolidado"]
        Login -->|Rol: ADMIN| DashAdmin["Panel Incógnito (Fabián)\n• Gestión de cuentas de barberos\n• Modificar / Cambiar contraseñas\n• Auditoría técnica total"]
    end
```

---

## 3. Principios de Interacción

1. **Inmediatez en Agendamiento:** El cliente completa la reserva en un máximo de 4 clics intuitivos.
2. **Sincronización Transparente:** La integración con el calendario nativo del cliente no requiere permisos invasivos ni instalación de aplicaciones externas.
3. **Privacidad Garantizada por Diseño:** Los componentes de métricas financieras y gestión de contraseñas no se cargan ni se exponen en el DOM para usuarios no autorizados.
