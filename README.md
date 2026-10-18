# Proyecto Barberia — Barbería Lopez (Neiva, Huila)

> Sistema de gestión de citas, turnos en tiempo real, sincronización de calendarios (Google/Apple) y control de caja, adaptado a la arquitectura empresarial de documentación basada en `resi-complex` / `C:\IA`.

---

## 🏗️ Arquitectura del Repositorio

La estructura del proyecto replica el estándar de ingeniería de `C:\IA` y `resi-complex`:

```text
C:\Proyecto Barberia\
├── .agents/                       # Skills y configuraciones para asistentes IA
│   └── skills/
│       ├── impeccable-taste/      # Eliminación de AI Slop y diseño refinado
│       ├── web-design-guidelines/ # Auditoría y estándares de interfaz web moderna
│       ├── awesome-design-md/     # Estándar de sistemas de diseño limpios sin neón
│       └── image-to-code/         # Traducción de volantes y mockups a código
├── REGLAS-IA/                     # Reglas fundamentales de trabajo con Fabián
│   └── README.md
├── barberia-docs/                 # Arquitectura de Software (Estándar SDD / resi-complex)
│   ├── 00-governance/             # Políticas de seguridad y gobernanza
│   ├── 01-context/                # Contexto del negocio y alcance (Barbería Lopez)
│   ├── 02-domain/                 # Entidades y reglas del dominio
│   ├── 03-product/                # Visión del producto y catálogo oficial de precios
│   ├── 04-requirements/           # Historias de usuario y casos de uso formales
│   ├── 05-architecture/           # Arquitectura de software y control de acceso (3 Roles)
│   ├── 06-data/                   # Modelo de datos y estructuras en memoria
│   ├── 07-api/                    # Integraciones sin costo (WhatsApp, Google, Apple)
│   ├── 08-uml/                    # Diagramas del sistema
│   ├── 10-devops/                 # Pautas de despliegue y ejecución local
│   ├── 12-ux-ui/                  # Sistema de diseño (DESIGN.md) y tokens visuales
│   └── assets/                    # Volante físico original, logos extraídos y PDFs
│       ├── logos/
│       ├── images/
│       └── pdfs/
└── src/                           # Código fuente (Arquitectura Onion concéntrica)
    ├── domain/                    # Capa 1 & 2: Entidades, Enums y Servicios de Dominio
    ├── application/               # Capa 3: Casos de Uso (Agendamiento, Auth, Gestión de Usuarios, Caja)
    ├── infrastructure/            # Capa 4: Persistencia (LocalStorage con semilla) y Calendarios (iCal RFC 5545)
    ├── ui/                        # Capa 4: Presentación Dark Luxury (Tokens, Componentes, Store reactivo)
    ├── index.html                 # Shell modular HTML5 desacoplado
    ├── logo_barberia_lopez_hd.jpg # Asset visual del logo oficial
    └── logo_barberia_lopez.png    # Asset visual original
```

---

## 👥 Modelo de Usuarios y Roles (Persistencia en Base de Datos)

El sistema opera con control de acceso RBAC estricto, persistiendo credenciales, citas e historial inmutable:

1. **`Barbero Jefe` (Maestro Lopez):**
   * Acceso a su agenda personal y a la agenda del ayudante.
   * Visualización consolidada de la caja del día en COP en tiempo real.
   * Historial de cortes y control de turnos de ambas estaciones.

2. **`Barbero Ayudante` (Carlos Junior - Practicante):**
   * Acceso exclusivo a su agenda de citas asignadas.
   * Registro de cortes finalizados en su historial personal.
   * **Bloqueado:** Sin acceso a la caja general ni a los datos del Barbero Jefe.

3. **`Administrador` (Fabián - Modo Incógnito / Superadmin):**
   * Invisible en el portal del cliente y para los barberos.
   * Gestión completa de cuentas: crear nuevos barberos, **cambiar/restablecer contraseñas** y activar/desactivar usuarios.
   * Auditoría total técnica y financiera de la base de datos.

---

## ✂️ Información Oficial Incorporada (Barbería Lopez)

* **Establecimiento:** Barbería Lopez — *"Somos los arquitectos de tu imagen"*.
* **Ubicación:** Neiva, Huila, Colombia.
* **Línea WhatsApp Oficial:** `+57 321 989 7910`.
* **TikTok Oficial:** `@barber_lopez_neiva`.
* **Servicios del Flyer:** Corte Básico (\$20.000), Combo 1 (\$25.000), Combo 2 (\$35.000), Combo 3 (\$40.000), Combi Completa VIP (\$65.000), Pigmentación Aerógrafo (\$18.000) y Manual (\$22.000 COP).
