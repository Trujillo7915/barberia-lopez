# 04-requirements — Requisitos Funcionales, No Funcionales e Historias de Usuario

> **Proyecto:** Barbería Lopez — Sistema de Citas, Turnos e Historial  
> **Fase SDD:** ⭐ FIRST (Requisitos del Sistema)  

Este documento formaliza los requisitos funcionales (RF), requisitos no funcionales (RNF) y las historias de usuario (HU) con sus correspondientes criterios de aceptación en formato Gherkin.

---

## 1. Requisitos Funcionales (RF)

| Código | Requisito Funcional | Prioridad | Actores |
| :--- | :--- | :---: | :--- |
| **RF-01** | **Agendamiento Web Autónomo:** El cliente debe poder seleccionar servicio, barbero y franja horaria disponible sin requerir registro previo. | ⭐ Alta | Cliente |
| **RF-02** | **Sincronización en Calendario del Cliente:** Al confirmar la cita, el sistema debe ofrecer la adición del evento al calendario nativo del cliente (Google Calendar / Apple iCal / `.ics`). | ⭐ Alta | Cliente |
| **RF-03** | **Asignación en Calendario del Barbero:** El sistema debe registrar la cita en el calendario del barbero asignado con los detalles del cliente y servicio. | ⭐ Alta | Barbero (Jefe/Practicante) |
| **RF-04** | **Panel Restringido del Practicante:** El practicante puede visualizar sus citas asignadas y marcar servicios completados, con bloqueo total de visualización de caja y datos del Jefe. | ⭐ Alta | Barbero Practicante |
| **RF-05** | **Supervisión y Caja del Barbero Jefe:** El Barbero Jefe puede auditar la agenda y cortes del practicante, consultar su propia agenda y visualizar la caja acumulada del día en COP. | ⭐ Alta | Barbero Jefe |
| **RF-06** | **Administrador en Modo Incógnito:** El Administrador puede supervisar todos los registros técnicos y comerciales de la barbería sin que los barberos sospechen o visualicen su existencia en el sistema. | ⭐ Alta | Administrador |
| **RF-07** | **Persistencia de Historial en Base de Datos:** Cada servicio completado debe almacenarse en base de datos con: **Nombre del Cliente, Fecha, Hora y Valor (COP)**. | ⭐ Alta | Barberos, Sistema |
| **RF-08** | **Portal Público y Selección de Pago:** El cliente puede visualizar el calendario público, seleccionar barbero, combo y método de pago (Efectivo / Transferencia), sin acceso a la administración ni al directorio de usuarios. | ⭐ Alta | Cliente |
| **RF-09** | **Botón de Acceso y Autenticación de Barberos:** La página de inicio incluye un botón `"Acceder"` para el personal; los barberos inician sesión con las credenciales entregadas por el Admin y son redirigidos a su respectivo módulo según su rol. | ⭐ Alta | Barberos, Administrador |
| **RF-10** | **Gestión de Barberos y Contraseñas por el Admin:** El Administrador dispone de un módulo para crear usuarios de barberos, modificar/restablecer sus contraseñas y activar o desactivar sus cuentas. | ⭐ Alta | Administrador |

---

## 2. Requisitos No Funcionales (RNF)

* **RNF-01 (Compatibilidad de Calendarios):** Los eventos generados deben cumplir con el estándar **RFC 5545 (iCalendar)** para garantizar compatibilidad con iOS, Android, macOS y Windows.
* **RNF-02 (Seguridad y Aislamiento de Información):** Ninguna respuesta del backend enviada al cliente del Barbero Practicante debe contener datos financieros ni información privada del Barbero Jefe (prevención de fugas en consola o red).
* **RNF-03 (Sigilo del Administrador):** El acceso del administrador se efectúa mediante una URL/parámetro reservado, sin enlaces públicos en el menú ni identificadores visibles en la UI general.
* **RNF-04 (Rendimiento Mobile-First):** La interfaz debe cargar en menos de 1.8 segundos en redes móviles 4G y adaptarse a pantallas de smartphones (desde 360px de ancho).

---

## 3. Historias de Usuario (HU) con Criterios de Aceptación (Gherkin)

### HU-01: Agendamiento de Cita y Sincronización con Calendario Móvil
**Como** cliente de Barbería Lopez,  
**Quiero** agendar una cita desde la página web y agregarla al calendario de mi celular,  
**Para** no olvidar mi turno y asegurar mi atención sin hacer filas.

* **Criterio de Aceptación 1.1:**
  * **Dado** que el cliente ingresa a la web y selecciona "Corte Básico" con el "Barbero Jefe" para el sábado a las 3:00 PM.
  * **Cuando** ingresa su nombre "Carlos Ruiz", teléfono "3101234567" y pulsa "Confirmar Cita".
  * **Entonces** el sistema reserva la franja horaria y muestra los botones de "Añadir a Google Calendar" y "Descargar evento iCal (.ics)".

* **Criterio de Aceptación 1.2:**
  * **Dado** que se confirma la cita de Carlos Ruiz.
  * **Cuando** el evento se guarda en el sistema.
  * **Entonces** la cita queda inmediatamente reflejada en el calendario asignado al Barbero Jefe.

---

### HU-02: Aislamiento Operativo del Barbero Practicante
**Como** Barbero Practicante,  
**Quiero** visualizar únicamente mis clientes asignados y mis propios cortes,  
**Para** enfocarme en mi trabajo diario sin acceder a información confidencial del negocio.

* **Criterio de Aceptación 2.1:**
  * **Dado** que el practicante ingresa a su sesión de trabajo.
  * **Cuando** revisa el panel de control.
  * **Entonces** solo visualiza las citas correspondientes a su estación de trabajo y no tiene visible ningún indicador de caja general ni de citas del Barbero Jefe.

---

### HU-03: Supervisión y Arqueo de Caja del Barbero Jefe
**Como** Barbero Jefe,  
**Quiero** consultar los cortes elaborados por el practicante y el total acumulado en caja,  
**Para** llevar el control financiero exacto y la auditoría del personal del día.

* **Criterio de Aceptación 3.1:**
  * **Dado** que el Barbero Jefe inicia sesión en su módulo de control.
  * **Cuando** consulta la pestaña de supervisión del día.
  * **Entonces** visualiza: (1) listado de clientes atendidos por el practicante, (2) clientes atendidos por él mismo, y (3) la suma total de caja en pesos colombianos (\$ COP).

---

### HU-04: Modo Incógnito del Administrador
**Como** Administrador del software,  
**Quiero** entrar al sistema de forma encubierta y auditar las operaciones de los barberos,  
**Para** garantizar el soporte técnico sin alterar la dinámica de trabajo ni revelar mi supervisión.

* **Criterio de Aceptación 4.1:**
  * **Dado** que el Administrador accede a través de la ruta segura reservada.
  * **Cuando** navega por el sistema.
  * **Entonces** puede auditar todos los cortes, historiales y configuraciones sin que aparezca ninguna etiqueta o notificación en la pantalla de los barberos.

---

### HU-05: Registro Inmutable de Historial en Base de Datos
**Como** Barbero (Jefe o Practicante),  
**Quiero** que al finalizar un corte se guarde el registro en la base de datos,  
**Para** mantener un historial auditable de mi trabajo realizado.

* **Criterio de Aceptación 5.1:**
  * **Dado** que un barbero atiende una cita programada.
  * **Cuando** presiona "Finalizar Corte".
  * **Entonces** el sistema persiste en la base de datos un registro con:
    1. **Nombre del Cliente**
    2. **Fecha**
    3. **Hora de atención**
    4. **Valor del servicio cobrado en COP**

---

### HU-06: Selección de Pago y Acceso Restringido a Barberos
**Como** cliente de Barbería Lopez,  
**Quiero** ver los horarios disponibles, escoger mi barbero, el combo y la forma de pago, sin ver la gestión interna del negocio,  
**Para** reservar de manera transparente y clara.

* **Criterio de Aceptación 6.1:**
  * **Dado** que el cliente ingresa a la página de inicio.
  * **Cuando** realiza el agendamiento.
  * **Entonces** puede seleccionar el combo (o servicio individual) y el medio de pago (Efectivo o Transferencia bancaria/Nequi).
  * **Y** no tiene acceso visual ni funcional a la lista interna de usuarios de la barbería.

* **Criterio de Aceptación 6.2:**
  * **Dado** que un barbero o el administrador ingresa a la web.
  * **Cuando** hace clic en el botón `"Acceder"` en la parte superior.
  * **Entonces** se despliega el formulario de autenticación para ingresar su usuario y contraseña.

---

### HU-07: Gestión de Barberos y Contraseñas por el Administrador
**Como** Administrador del software,  
**Quiero** crear usuarios para los barberos, cambiar sus contraseñas y dar de baja usuarios,  
**Para** controlar quién tiene acceso a la plataforma sin depender de soporte externo.

* **Criterio de Aceptación 7.1:**
  * **Dado** que el Administrador está autenticado en su módulo de control.
  * **Cuando** crea un nuevo barbero asignándole usuario, rol (`JEFE` o `PRACTICANTE`) y contraseña temporal.
  * **Entonces** el nuevo barbero puede iniciar sesión inmediatamente con esas credenciales.

* **Criterio de Aceptación 7.2:**
  * **Dado** que un barbero olvidó su contraseña o el Administrador desea renovarla.
  * **Cuando** el Administrador ingresa al módulo de personal y pulsa "Cambiar contraseña" para dicho barbero.
  * **Entonces** la contraseña se actualiza en el sistema y el barbero puede ingresar con la nueva clave asignada.

