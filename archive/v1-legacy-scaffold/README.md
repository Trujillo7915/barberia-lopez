# Andamiaje Modular Inicial (Scaffold v1 — Archivado)

Este directorio contiene los archivos modulares originales creados al inicio del proyecto (15 de octubre de 2026).

### Aclaracion de Arquitectura y Ahorro de Tokens:
1. **Codigo en Produccion**: La aplicacion web cliente se ejecuta de manera canónica y completa en `src/bundle.js`. El navegador NO carga ni ejecuta los archivos de este directorio.
2. **Ubicacion de Cambios**:
   - Para modificar la logica de interfaz, reservas, tienda o autenticacion en el cliente: editar directamente `src/bundle.js`.
   - Para modificar estilos visuales: editar `src/ui/styles/theme.css` y `src/ui/styles/animations.css`.
   - Para modificar el markup inicial o la pantalla de carga: editar `src/index.html`.
   - Para modificar el backend, APIs, seguridad o persistencia: editar `server.js`.
3. **Consulte el Mapa del Proyecto**: Para localizar cualquier funcion o componente sin gastar tokens, revise el archivo `CODEMAP.md` en la raiz del repositorio.
