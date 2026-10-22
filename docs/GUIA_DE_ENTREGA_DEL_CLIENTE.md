# Manual de Entrega Oficial y Autonomia del Negocio
## Barberia Lopez

Este documento contiene toda la informacion operativa necesaria para que el propietario y el personal de **Barberia Lopez** operen, administren y mantengan el sistema de forma 100% autonoma e independiente, sin requerir soporte tecnico externo.

---

### 1. Como Iniciar el Sistema (En 1 Solo Clic)

Si el sistema esta instalado en el computador de la barberia:
1. Abra la carpeta del proyecto `Proyecto Barberia`.
2. Haga doble clic en el archivo:
   `INICIAR_BARBERIA.bat`
3. El sistema se encendera de forma automatica y abrira la pagina de la barberia en su navegador web (`http://localhost:3000`).
4. **Para apagar el sistema:** Simplemente cierre la ventana negra de la consola.

> **Requisito minimo:** El computador debe tener instalado Node.js (descarga gratuita desde https://nodejs.org).

---

### 2. Cuentas de Acceso y Credenciales Maestras

El sistema cuenta con tres niveles de acceso protegidos con cifrado de seguridad:

| Rol | Usuario | Clave Inicial | Descripcion y Alcance |
| :--- | :--- | :--- | :--- |
| **Administrador General (Dueno)** | `admin` | `admin2026` | Control total del negocio: catalogo de productos, inventario, precios, creacion y eliminacion de barberos, reportes de caja e historial completo. |
| **Barbero Jefe (Encargado)** | `david.barber` | `david2026` | Gestion de citas, apertura/cierre de turnos de estaciones, recepcion de pagos en efectivo de la tienda y liquidacion. |
| **Barbero de Estacion** | `matta.barber` | `matta2026` | Visualizacion de su agenda personal de turnos, confirmacion de citas atendidas y registro de servicios. |

*Recomendacion:* Una vez que el dueno reciba el sistema, puede cambiar las contrasenas ingresando con la cuenta de Administrador.

---

### 3. Operaciones del Dia a Dia (Sin Saber Programacion)

#### A. Gestion de Productos y Fotos de la Tienda
1. Inicie sesion con el usuario `admin` o `david.barber`.
2. Ingrese al apartado de administracion en el panel superior.
3. Para crear un producto nuevo:
   * Escriba el nombre, categoria, precio en efectivo (COP) y stock disponible.
   * Haga clic en **Subir o tomar foto**: puede tomar la foto directamente con la camara de su celular o seleccionarla de sus archivos.
   * Presione **Publicar producto en Tienda**.
4. Para modificar precios, stock o cambiar la foto de un producto existente:
   * En la tabla de inventario, haga clic en el boton **Editar precio / foto / stock**.
   * Puede cambiar el precio, sumar o restar unidades, o subir una nueva foto con el boton correspondiente.
   * Presione **Guardar cambios**.

#### B. Cobro y Entrega de Productos en Efectivo
1. Cuando un cliente llegue a la barberia con su codigo de apartado (ejemplo: `REF-BL-A8K29P`):
2. Inicie sesion como barbero activo en turno o administrador.
3. Busque la referencia en la seccion de pedidos de la tienda.
4. Verifique el monto exacto en efectivo recibido.
5. Presione el boton **Confirmar pago en efectivo y entregar**.
6. El sistema cerrara el pedido, lo registrara en el reporte de caja del dia y asignara el recaudo al barbero que atendio.

#### C. Control de Barberos y Personal
* Para agregar un nuevo barbero: desde el panel de administracion, use el formulario de creacion de barberos asignando su nombre, foto y numero de WhatsApp.
* Para dar de baja a un barbero que ya no trabaje en la barberia: desactive su casilla en la lista de personal para revocar su acceso y que los clientes ya no puedan reservar turnos con el.

---

### 4. Como Respaldar la Informacion del Negocio (Backups)

Toda la base de datos (citas, clientes, productos, inventario, fotos y cuentas) se almacena localmente de forma segura en las carpetas `data/` y `src/assets/products/`.

Para hacer una copia de seguridad completa:
1. Haga doble clic en el archivo:
   `CREAR_COPIA_DE_SEGURIDAD.bat`
2. El script creara automaticamente una carpeta dentro de `respaldos/` con la fecha y hora exacta del respaldo.
3. Puede copiar esa carpeta a una memoria USB o subirla a Google Drive para maxima seguridad.

---

### 5. Opciones para Tener la Pagina en Internet 24/7 (Acceso Publico)

Si en lugar de tenerla solo en la red local de la barberia desea que cualquier cliente reserve por internet las 24 horas del dia:
1. **Opcion en la Nube (Gratis o Bajo Costo):**
   * El proyecto esta construido en Node.js puro sin dependencias externas pesadas.
   * Se puede vincular a plataformas en la nube como Render.com o Railway.app en menos de 10 minutos.
   * Comando de ejecucion: `node server.js`
   * Puerto: `3000` (o la variable `PORT` del servidor).
2. **Dominio Propio:**
   * Puede adquirir un dominio personalizado (ejemplo: `barberialopezneiva.com`) en cualquier registrador (Namecheap, GoDaddy, Porkbun) y apuntarlo al servidor en la nube.

---

### 6. Politica de Alcance, Cambios y Nuevas Funcionalidades

Para garantizar una relacion comercial transparente y definir claramente los limites del servicio prestado:

1. **Alcance Cubierto por el Pago Anterior:**
   El valor acordado y cancelado previamente cubrio de forma exclusiva el diseno, desarrollo, pruebas, configuracion y entrega formal del sistema con las funcionalidades actuales (agenda de turnos, catalogo de tienda, gestion de inventario, perfiles de barberos, comprobantes con codigo unico, reproductor de video en movil y reportes de caja).

2. **Exclusion Explicita de Cambios y Modificaciones Futuras:**
   Cualquier solicitud posterior a esta entrega que involucre:
   * Desarrollo de nuevas funciones o modulos adicionales.
   * Pasarelas de pago electronico online (Wompi, Mercado Pago, ePayco, tarjetas de credito/debito).
   * Modificaciones en el diseno visual, flujos de navegacion o logica de negocio preexistente.
   * Integraciones con sistemas de terceros, facturacion electronica DIAN o mensajeria SMS/WhatsApp automatizada con APIs de pago.
   * Migraciones de servidor, configuraciones de dominios personalizados o mantenimiento de infraestructura externa.
   * Reparaciones derivadas de manipulacion indebida del codigo fuente, borrado accidental de archivos o fallas en el hardware del cliente.
   
   **NO estan incluidas en el pago anterior bajo ninguna circunstancia.**

3. **Procedimiento para Nuevas Solicitudes:**
   Toda nueva necesidad, ajuste estetico o funcionalidad adicional debera solicitarse formalmente para ser cotizada como un servicio independiente. Dicho trabajo solo se iniciara una vez acordado y cancelado el anticipo correspondiente del nuevo presupuesto.

---

### 7. Cierre de Entrega y Acta de Conformidad

Con la entrega de este documento, los accesos administrativos y los scripts de ejecucion incluidos, **Barberia Lopez** declara recibir el software en estado operativo y a entera satisfaccion, asumiendo la propiedad, operacion y custodia plena del sistema y sus bases de datos. El sistema no requiere pagos recurrentes obligatorios al desarrollador para continuar operando en su estado actual.
