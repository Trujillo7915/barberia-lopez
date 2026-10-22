@echo off
title Barberia Lopez - Servidor Oficial
color 06

echo ========================================================
echo         BARBERIA LOPEZ - SISTEMA OFICIAL
echo ========================================================
echo Verificando entorno...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado en este computador.
    echo Por favor descargue e instale Node.js desde https://nodejs.org
    echo y vuelva a ejecutar este archivo.
    pause
    exit /b
)

echo Iniciando servidor seguro...
start "" http://localhost:3000
node server.js

pause
