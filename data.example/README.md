# Plantilla de Datos de Ejemplo (data.example)

Este directorio contiene estructuras de datos de demostración y semillas no sensibles para inicializar el sistema en nuevos entornos de desarrollo.

## Inicialización Automática
Al ejecutar `npm start` o `node server.js`, el backend creará automáticamente el directorio `data/` en la raíz si no existe, sembrando los datos iniciales necesarios de forma segura.

> **Importante:** El directorio `data/` en producción es privado y dinámico; nunca debe versionarse en Git para proteger la privacidad de los clientes, contraseñas y claves criptográficas HMAC.
