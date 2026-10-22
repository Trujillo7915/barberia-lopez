# Manual de Uso – Barbería López

## Índice
1. [Visión General](#visión-general)
2. [Roles y Permisos](#roles-y-permisos)
   - [Cliente](#cliente)
   - [Barbero](#barbero)
   - [Jefe (Administrador)](#jefe-administrador)
3. [Flujos de Trabajo Principales](#flujos-de-trabajo-principales)
   - [Reserva de Cita (Cliente)]
   - [Gestión de Citas (Barbero)]
   - [Gestión de Inventario y Tienda (Jefe)]
4. [Autenticación y Seguridad](#autenticación-y-seguridad)
5. [Manejo de Errores Comunes](#manejo-de-errores-comunes)
6. [Preguntas Frecuentes (FAQ)](#faq)
7. [Apéndice: Endpoints API](#apéndice-endpoints-api)

---

## Visión General
Barbería López es una plataforma web para gestionar turnos, catálogos de productos y la relación entre clientes, barberos y el administrador (jefe).  La aplicación está construida con Node.js puro en el backend y un SPA estática en `src/` para el frontend.  Todas las comunicaciones están protegidas mediante HMAC‑JWT y se aplican cabeceras de seguridad HTTP.

---

## Roles y Permisos
| Rol | ¿Qué puede hacer? | Endpoints clave | Comentarios |
|-----|-------------------|----------------|-------------|
| **Cliente** | • Registrarse / iniciar sesión<br>• Ver catálogo de productos<br>• Reservar, ver y cancelar citas<br>• Comprar productos de la tienda | `POST /api/auth/login`, `GET /api/products`, `POST /api/appointments`, `GET /api/appointments/:id`, `DELETE /api/appointments/:id` | No tiene acceso a rutas de administración ni a la edición de barberos. |
| **Barbero** | • Ver y aceptar citas asignadas<br>• Marcar cita como **COMPLETADA**<br>• Registrar historial de cortes<br>• Ver ventas directas (si está en turno) | `GET /api/appointments`, `PUT /api/appointments/:id`, `POST /api/history` | Sólo los barberos con `onShift: true` pueden registrar ventas / cobrar. |
| **Jefe (ADMIN / JEFE)** | • Todas las operaciones de barbero<br>• Gestionar barberos (crear, editar, desactivar)<br>• Gestionar usuarios y roles<br>• Administrar inventario y pedidos de la tienda<br>• Ver reportes de caja y historial completo | `POST /api/barbers`, `PUT /api/barbers/:id`, `DELETE /api/barbers/:id`, `POST /api/products`, `PUT /api/products/:id`, `GET /api/reports/cash` | Usa token con rol `ADMIN` o `JEFE`.  Los endpoints verifican el rol con middleware de autorización. |

---

## Flujos de Trabajo Principales
### Reserva de Cita (Cliente)
1. **Login** – `POST /api/auth/login` con `username` y `password`.
2. **Obtener lista de barberos** – `GET /api/barbers` (solo los con `active:true`).
3. **Seleccionar servicio** – obtener servicios con `GET /api/services`.
4. **Crear cita** – `POST /api/appointments` con
   ```json
   {
     "barberId": "b-david-01",
     "serviceId": "s-01",
     "date": "2026-12-01",
     "startTime": "10:00",
     "clientName": "Juan Pérez",
     "clientPhone": "3001234567"
   }
   ```
   El servidor verifica colisión horaria y devuelve `201` o `409 Conflict`.
5. **Confirmación** – Se muestra QR de la cita en `GET /api/appointments/:id/qr` (usado por el barbero).

### Gestión de Citas (Barbero)
1. **Login** – Igual que cliente.
2. **Listar citas del día** – `GET /api/appointments?date=2026-12-01&barberId=b-matta-01`.
3. **Aceptar / Rechazar** – `PUT /api/appointments/:id` con `status` `ACEPTADA` o `CANCELADA`.
4. **Cerrar corte** – `PUT /api/appointments/:id` con `status` `COMPLETADA`.
5. **Registrar historial** – `POST /api/history` con `appointmentId` y notas del corte.
6. **Caja** – Al cerrar el día, el barbero puede consultar `GET /api/reports/cash?date=YYYY-MM-DD` (solo si su token tiene rol `BARBERO` y está `onShift`).

### Gestión de Inventario y Tienda (Jefe)
1. **Login** como `ADMIN` o `JEFE`.
2. **Crear/Editar productos** – `POST /api/products`, `PUT /api/products/:id`.
3. **Ajustar stock** – Cada venta reduce `stock`; las cancelaciones lo restituyen automáticamente.
4. **Crear pedidos** – `POST /api/store_orders` con referencia única, se verifica idempotencia (código `409` si se repite).
5. **Reportes de caja** – `GET /api/reports/cash?date=YYYY-MM-DD` muestra total por barbero y tienda.
6. **Gestión de barberos** – `POST /api/barbers/with-user` crea barbero + usuario atómico.

---

## Autenticación y Seguridad
- **Token JWT HMAC‑SHA256** generado con la clave persistente en `data/.auth_secret`.
- **Cabeceras de seguridad**: `X‑Content‑Type‑Options: nosniff`, `X‑Frame‑Options: SAMEORIGIN`, `Content‑Security‑Policy` con fuentes limitadas.
- **Rate limiting**: 240 peticiones/minuto por IP (excluye localhost y entorno `test`).
- **Protección contra doble‑booking** mediante mutex en memoria y respuesta `409`.
- **Validación de entrada** usando Zod‑like checks en cada endpoint (tipo, rango, formato).

---

## Manejo de Errores Comunes
| Código | Situación | Mensaje al usuario | Acción recomendada |
|--------|-----------|--------------------|-------------------|
| `401` | Token ausente o expirado | `Acceso no autorizado` | Re‑login y obtener nuevo token. |
| `403` | Rol insuficiente | `Permiso denegado` | Verificar que el usuario tiene el rol necesario. |
| `404` | Recurso no encontrado | `Recurso no encontrado` | Revisar ID y URL. |
| `409` | Conflicto (doble booking, referencia duplicada) | `Conflicto de recurso` | Seleccionar otro horario o generar nueva referencia. |
| `429` | Límite de peticiones excedido | `Demasiadas peticiones, intente luego` | Esperar el tiempo indicado en `Retry-After`. |
| `500` | Error interno | `Error inesperado, contacte soporte` | Revisar logs del servidor (`.system_generated/tasks/...`). |

---

## Preguntas Frecuentes (FAQ)
1. **¿Cómo recupero mi contraseña?** – Actualmente solo los administradores pueden resetear contraseñas vía endpoint `POST /api/users/:id/reset-password` (solo `ADMIN`).  En producción añadiría flujo de email.
2. **¿Puedo usar la app desde móvil?** – Sí, la SPA es responsiva y usa CSS variables definidas en `:root`.
3. **¿Qué pasa si el servidor se reinicia?** – Los datos están persisti­dos en `data/*.json`.  La clave de token (`.auth_secret`) se guarda en disco y se reutiliza.
4. **¿Hay límite de stock?** – El sistema impide ventas que excedan el stock actual y devuelve `409`.
5. **¿Cómo exporto los datos de citas?** – El endpoint `GET /api/calendar/appointment/:id` genera un archivo `.ics` compatible con Google Calendar y Outlook.

---

## Apéndice: Endpoints API
| Método | Ruta | Rol requerido | Descripción |
|--------|------|---------------|-------------|
| `POST` | `/api/auth/login` | Público | Devuelve JWT. |
| `GET` | `/api/barbers` | Cliente, Barbero, Admin | Lista barberos activos. |
| `POST` | `/api/appointments` | Cliente | Crear cita. |
| `PUT` | `/api/appointments/:id` | Barbero (propia) / Admin | Actualizar estado. |
| `GET` | `/api/appointments/:id/qr` | Cliente, Barbero | QR de cita. |
| `POST` | `/api/history` | Barbero | Registrar corte. |
| `GET` | `/api/reports/cash?date=YYYY‑MM‑DD` | Barbero (onShift) / Admin | Resumen de caja. |
| `POST` | `/api/products` | Admin | Añadir producto. |
| `PUT` | `/api/products/:id` | Admin | Editar producto. |
| `POST` | `/api/store_orders` | Admin | Crear pedido de tienda. |
| `GET` | `/api/users/me` | Cliente/Barbero/Admin | Información del usuario autenticado. |
| `PUT` | `/api/users/:id` | Admin | Cambiar datos de usuario o rol. |
| `DELETE` | `/api/barbers/:id` | Admin | Eliminar barbero (cascada). |

---

*Este manual está pensado para ser incluido en `docs/USER_MANUAL.md` y servir como referencia tanto para usuarios finales como para desarrolladores que deban extender la plataforma.*
