# DESIGN.md — Sistema de Diseño Visual (Barbería Lopez · Luxury Obsidian & Imperial Gold)

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial (Neiva, Huila)  
> **Paleta Oficial:** Extraída directamente del Emblema de Marca (`logo_barberia_lopez_hd.jpg`)  
> **Tema:** Luxury Dark Obsidian (`#0a0b0d` / `#12151b`) + Acentos Oro Imperial Pulido (`#d4af37` / `#f3e5ab`) + Tipografía Editorial Dual (Editorial Serif + UI Chrome Sans + Tech Mono)

---

## 1. Filosofía Estética: Luxury Obsidian & Imperial Gold

La identidad visual de **Barbería Lopez** se fundamenta en la herencia de su emblema oficial: una atmósfera nocturna, sobria y de alta alcurnia, donde la profundidad del **negro obsidiana y grafito** contrasta con el brillo y la prestancia del **oro imperial bruñido**. Cada interacción evoca exclusividad, precisión artesanal y prestigio.

### Principios Rectores:
1. **Lienzo de Obsidiana Profunda (`#0a0b0d`):** 
   - El fondo principal del sistema adopta el negro obsidiana del fondo nativo del logotipo, garantizando que el emblema se integre con una fusión óptica perfecta.
   - Las tarjetas y módulos interactivos se elevan en **Charcoal Profundo (`#12151b`)** con bordes hairline de 1px en oro (`rgba(212, 175, 55, 0.22)`).
2. **Emblema de Fondo en el Hero (Área Destacada):**
   - El logotipo oficial de Barbería Lopez se sitúa como marca de agua arquitectónica en el fondo de la sección Hero y los 3 Pilares.
   - **Cero Deformación:** Se preserva de forma estricta la relación de aspecto 1:1 mediante `object-contain` y dimensiones cuadradas balanceadas (480px a 800px).
   - **Cero Pixelación:** Se emplea el activo maestro en alta resolución super-muestreado a densidad Retina, con modo de mezcla `mix-blend-screen`, resplandor áureo ambiental y máscara radial difusa (`radial-gradient`).
3. **Acento Primario en Oro Imperial Pulido (`#d4af37`):**
   - Los botones de llamada a la acción (*Call to Action*), insignias de estatus y franjas horarias seleccionadas utilizan un gradiente metálico de oro pulido (`#d4af37` a `#ebd382`) con texto en contraste negro obsidiana `#0a0b0d` en negrita.
4. **Tipografía Dual de Máxima Legibilidad:**
   - **Voz Editorial (Source Serif 4):** Titulares display, nombres de secciones y lemas de maestría.
   - **Voz Funcional (Inter):** Textos descriptivos en platino suave (`#c5c0b6`), formularios, controles de navegación y tablas del historial.
   - **Voz de Precisión (JetBrains Mono):** Horarios de turnos, precios en pesos colombianos (`$25.000 COP`) e identificadores de corte.

---

## 2. Tokens de Color del Emblema Oficial

| Nombre | Hex / RGBA | Token CSS | Rol en Barbería Lopez |
|---|---|---|---|
| **Obsidian Black** | `#0a0b0d` | `--color-obsidian` | Lienzo principal del body y fondo nativo del logotipo |
| **Charcoal Surface** | `#12151b` | `--color-charcoal` | Superficie de tarjetas estándar de 24px, celdas y modales |
| **Charcoal Light** | `#181c24` | `--color-charcoal-light` | Superficie elevada en hover y contenedores secundarios |
| **Charcoal Deep** | `#07080a` | `--color-charcoal-deep` | Fondo del footer y áreas de máximo anclaje visual |
| **Imperial Gold** | `#d4af37` | `--color-gold` | Oro primario de la marca (tipografía de LOPEZ en logo y botones CTA) |
| **Champagne Light** | `#f3e5ab` | `--color-gold-light` | Iluminaciones doradas, enlaces editoriales y badges |
| **Deep Bronze Gold** | `#b38828` | `--color-gold-deep` | Sombra metálica y estado presionado de botones dorados |
| **Gold Hairline Border** | `rgba(212, 175, 55, 0.22)` | `--color-gold-border` | Bordes sutiles de 1px en tarjetas, tablas y cuadrícula |
| **Luminous Off-White** | `#fbfaf7` | `--color-text-primary` | Titulares y textos principales de lectura |
| **Soft Platinum** | `#c5c0b6` | `--color-text-secondary` | Párrafos, descripciones de servicios y etiquetas de formularios |
| **Muted Bronze** | `#8a8275` | `--color-text-muted` | Metadatos secundarios, horas inactivas y notas técnicas |

---

## 3. Escala Tipográfica (Dual System)

```css
:root {
  /* Familias Tipográficas */
  --font-editorial-serif: 'Source Serif 4', Georgia, Charter, serif;
  --font-ui-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono-tech: 'JetBrains Mono', SFMono-Regular, Menlo, monospace;

  /* Voz Editorial: Source Serif 4 */
  --text-display: clamp(38px, 6vw, 68px); /* Titular hero (leading 1.1) */
  --text-heading: 46px;                   /* Títulos de secciones principales */
  --text-subheading: 26px;                /* Nombres de servicios y tarjetas */
  --text-body: 19px;                      /* Párrafos principales (leading 1.5) */

  /* Voz Funcional: Inter */
  --text-body-sm: 15px;                   /* Formularios, inputs y descripciones */
  --text-caption: 12px;                   /* Navegación y microcopy uppercase */

  /* Voz de Precisión: JetBrains Mono */
  --text-mono-data: 13px;                 /* Horarios, precios COP y timestamps */
}
```

---

## 4. Radios y Geometría de Componentes

* **24px (`--radius-cards`):** Tarjetas estándar (`.anthropic-card`), marcos de estadísticas, cuadrícula del calendario y modales.
* **8px (`--radius-buttons-full`):** Botón principal Oro Imperial (`.btn-clay`, `.btn-gold`), campos de entrada (`.input-parchment`), celdas horarias (`.slot-journal-btn`) y botones de filtro por mes.
* **12px (`--radius-buttons-outlined`):** Botones con borde de oro (`.btn-stone-outline`, `.btn-gold-outline`) y celdas individuales de días del calendario (`.cal-journal-cell`).
* **9999px (Pill):** Insignias de metadatos, estado de estación y avatar circular del emblema oficial.

---

## 5. Componentes Principales

### 5.1. Barra de Navegación Obsidiana (`.anthropic-nav`)
- Fondo `rgba(10, 11, 13, 0.88)` con efecto translúcido `backdrop-blur(20px)` y borde inferior de 1px en oro.
- Logotipo oficial circular con marco hairline en oro, acompañado de *"Barbería Lopez"* en blanco luminoso y *"NEIVA, HUILA · 2026"* en oro imperial.
- Enlaces de navegación en mayúsculas sans (`12px`) en platino suave con hover en oro, y enlace a WhatsApp con subrayado áureo continuo.
- Botones de acción: *"Acceder"* en botón outlined con sutil brillo dorado y *"Reservar cita →"* en oro pulido.

### 5.2. Hero con Logotipo de Fondo en Fusión Óptica
- **Fondo con Logotipo Oficial:** El emblema maestro se proyecta en el fondo del hero ocupando de 480px a 800px de ancho con `mix-blend-screen`, filtro de opacidad suave (35%–40%), resplandor de oro ambiental y gradiente radial difuso. El logo nunca se deforma ni se pixela.
- **Titular de Maestría:** *"Arquitectos de tu imagen. / Maestría en cada corte."* en serif editorial de gran impacto.
- **Acciones:** Botón de oro imperial *"Reservar turno →"* emparejado con botón outlined de WhatsApp.

### 5.3. Pilares de Excelencia en Obsidiana
- 3 tarjetas en `bg-[#12151b]/85` con radio de 22px y bordes en oro:
  - **Puntualidad rigurosa:** `100%` en oro luminoso — Cero esperas en sala.
  - **Trayectoria y disciplina:** `+12 Años` — Maestro Lopez al frente de la alta escuela de peluquería clásica.
  - **Calificación:** `4.9 / 5.0` — Visagismo anatómico, toallas calientes y satisfacción absoluta.

### 5.4. Calendario Interactivo Grande en Obsidiana & Oro
- Grilla de 7 columnas (`cal-journal-grid`):
  - Encabezados de días: `DOM, LUN, MAR, MIÉ, JUE, VIE, SÁB` en sans 12px oro champagne.
  - Celdas de días (`cal-journal-cell`): fondo `#12151b`, bordes de 1px oro hairline, radio de 12px.
  - Día actual: borde acentuado en oro champagne.
  - Día seleccionado: fondo con tinte áureo `rgba(212, 175, 55, 0.16)` y borde de 2px en oro imperial con resplandor.
  - Franjas horarias: botones en carbón oscuro que al pasar el cursor o hacer clic se transforman en oro pulido brillante con texto negro obsidiana.

### 5.5. Panel de Control de Barberos y Auditoría de Historial
- **Agenda de Turnos Sectorizada por Estación:**
  - Separación visual en contenedores independientes (Sectores de Estación) para cada barbero, con avatar, nombre, especialidad y contador individual de turnos.
  - Elimina la aglomeración de citas agrupando los turnos de cada estación de trabajo en su propia grilla organizada.
  - **Barra de Filtros Interactiva por Estación:** Permite alternar entre *"Todas las estaciones"* o enfocar la vista exclusivamente en un barbero específico de forma instantánea.
  - Tarjetas de turnos con servicio, valor en COP, teléfono del cliente, estado y botón de acción: *"Finalizar corte y guardar en historial →"*.
- **Historial de Cortes Sectorizado por Estación:**
  - Desglose independiente de cortes archivados por barbero con su respectivo avatar, especialidad, total de clientes atendidos y subtotal recaudado en COP por estación.
  - **Selector de Estación en Historial:** Pestañas interactivas para alternar entre *"Todas las estaciones"* o auditar únicamente la estación de un barbero en particular.
  - Tabla de cortes con cliente, fecha formateada, hora exacta y valor cobrado en COP.
  - **Filtro del Historial por Mes:**
    - Botones rápidos: *"Todos"*, *"Este mes"*, *"Mes pasado"*.
    - Selector desplegable de mes específico para auditorías históricas.
    - Buscador reactivo en vivo por cliente o fecha con KPI consolidado.

### 5.6. Gestión de Barberos, Roles y Eliminación de Cuentas (Superadmin)
- **Roles del Sistema:**
  - **Superadministrador (`ADMIN`):** Control invisible de credenciales, contraseñas, activación y eliminación.
  - **Barbero Jefe (`JEFE`):** Supervisión de caja consolidada y agenda general de ambas estaciones.
  - **Barbero (`BARBERO`):** Profesional titular con vista aislada de sus turnos programados e historial propio.
  - **Practicante (`PRACTICANTE`):** Barbero aprendiz con vista aislada de su propia estación.
- **Eliminación Permanente de Cuentas:**
  - Acción en la tabla administrativa con confirmación nativa de seguridad.
  - Eliminación atómica del usuario y su perfil de barbero asociado.

### 5.7. Modales de Agendamiento y Sincronización
- Fondo difuminado `bg-[#0a0b0d]/80 backdrop-blur-sm`.
- Contenedores en Charcoal `#12151b` con bordes en oro.
- Sin selector de métodos de pago en el modal de cliente (proceso de reserva ágil e inmediato).
- Selección de barbero y servicio reactiva en el DOM sin saltos de scroll.
- Modal de confirmación con sincronización instantánea a Google Calendar, Apple Calendar (RFC 5545) y confirmación por WhatsApp.

### 5.8. Suscripción Automática a Calendarios Móviles (iCalendar / Webcal Feed RFC 5545)
- **Cero Intervención del Barbero:**
  - El barbero realiza una vinculación única de 1 toque desde su teléfono (`webcal://` en iPhone o suscripción en Google Calendar).
  - Cada vez que un cliente reserva en la web, el backend (`server.js`) actualiza automáticamente el feed `/api/calendar/:barberId.ics`.
  - El sistema operativo del celular (iOS o Android) sincroniza en segundo plano y muestra la cita con nombre, servicio, teléfono, valor en COP y alarma sonora recordatoria 15 minutos antes.
- **Acceso Directo en Dashboard:**
  - Banner interactivo de vinculación en la parte superior de la agenda de turnos.
  - Botón directo *"Sincronizar celular"* en el encabezado de cada estación de trabajo.
  - Modal con enlace `webcal://` directo para iPhone (Apple Calendar) y enlace para Android (Google Calendar).

---

## 6. Verificación de Accesibilidad y Rendimiento

- Texto Blanco Luminoso (`#ffffff`) sobre Obsidiana (`#0a0b0d`): **Ratio de contraste > 18:1** (Supera ampliamente el estándar AAA de 7:1).
- Texto Platino (`#c5c0b6`) sobre Charcoal (`#12151b`): **Ratio de contraste > 10:1** (Lectura óptima sin fatiga ocular).
- Botón Oro Imperial (`#d4af37`) con texto Negro Obsidiana (`#0a0b0d`): **Ratio de contraste > 9.5:1** (Claridad impecable).
- Grilla responsive fluida probada en iPhone (Safari iOS), Android (Chrome) y navegadores de escritorio.
