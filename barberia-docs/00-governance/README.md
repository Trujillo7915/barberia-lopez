# 00-governance — Gobernanza y Estándares de Ingeniería

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Ubicación:** Neiva, Huila, Colombia  
> **Fase SDD:** ⭐ FIRST (Gobernanza)  

Este directorio define las reglas de ingeniería, políticas de seguridad, acuerdos de calidad y control de acceso que rigen el desarrollo de la plataforma de **Barbería Lopez**.

---

## 1. Reglas Primordiales de Desarrollo (`REGLAS-IA`)

1. **Alineación Estricta:** Todo desarrollo debe adherirse sin excepción a [`REGLAS-IA/README.md`](../../REGLAS-IA/README.md).
2. **Eficiencia en Recursos:** Optimización de respuestas, código limpio, sin redundancias ni dependencias infladas (*Zero AI-Slop*).
3. **Calidad y Rigor Técnico:** Arquitectura trazable de especificación a código (SDD: *Documentation before Code*).
4. **Principio de Autorización:** Ningún cambio de alcance o modificación arquitectónica se implementa sin la confirmación explícita de Fabián.

---

## 2. Matriz de Gobernanza de Roles y Confidencialidad

| Rol del Sistema | Nivel de Visibilidad | Restricciones de Gobernanza |
| :--- | :--- | :--- |
| **Cliente Web** | Público / Exterior | Solo agenda citas y sincroniza eventos de calendario. No ve métricas ni paneles internos. |
| **Barbero Practicante** | Restringido (Nivel 1) | Acceso únicamente a sus citas asignadas y a su propio historial. Bloqueo total de visualización de caja, ingresos globales y métricas del Barbero Jefe. |
| **Barbero Jefe** | Operativo Maestro (Nivel 2) | Control total de la operación: visualiza su agenda, la del practicante, caja diaria acumulada, historial de cortes y rendimiento. |
| **Administrador (Fabián)** | **Modo Incógnito / Invisible (Nivel 3)** | Superusuario técnico. Tiene visibilidad global de registros, auditoría y configuraciones. **Invisible para los barberos y en el frontend público** (sin badges, sin listados públicos de usuarios ni credenciales expuestas). |

---

## 3. Criterios de Aceptación (DoD & DoR)

### Definition of Ready (DoR)
Una funcionalidad solo se inicia si:
- Tiene requerimiento funcional formalizado en `04-requirements/`.
- Tiene definidas las reglas de negocio y restricciones de roles en `02-domain/`.
- Tiene definido el impacto en la base de datos de historial en `06-data/`.

### Definition of Done (DoD)
Una funcionalidad se considera terminada cuando:
- La UI cumple con los estándares estéticos modernos y responsivos.
- Se verifica el aislamiento de datos (el practicante no tiene acceso en DOM ni en API a la información del jefe).
- La sincronización de calendarios (dispositivo del cliente y barbero) genera los eventos válidos (.ics / enlaces estándar).
- El historial registra con exactitud: **Cliente, Fecha, Hora y Valor**.
- La documentación correspondiente se encuentra actualizada y sincronizada.
