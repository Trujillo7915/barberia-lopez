@echo off
title Barberia Lopez - Respaldo de Base de Datos
color 02

echo ========================================================
echo     BARBERIA LOPEZ - COPIA DE SEGURIDAD AUTOMATICA
echo ========================================================

set FECHA=%date:~6,4%-%date:~3,2%-%date:~0,2%
set HORA=%time:~0,2%-%time:~3,2%
set HORA=%HORA: =0%
set DESTINO=respaldos\copia_%FECHA%_%HORA%

echo Creando carpeta de respaldo en: %DESTINO%
mkdir "%DESTINO%\data" 2>nul
mkdir "%DESTINO%\products" 2>nul

xcopy "data\*" "%DESTINO%\data\" /Y /Q >nul
xcopy "src\assets\products\*" "%DESTINO%\products\" /Y /Q >nul

echo.
echo ========================================================
echo  RESPALDO COMPLETADO EXITOSAMENTE
echo  Todos los datos (citas, clientes, tienda, fotos)
echo  quedaron respaldados en la carpeta: %DESTINO%
echo ========================================================
echo.
pause
