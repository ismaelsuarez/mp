@echo off
echo ========================================
echo    PRUEBAS DE VENTANAS - MODO IMAGEN
echo ========================================
echo.
echo Este script permite probar los tres modos de ventana:
echo - VENTANA=comun
echo - VENTANA=nueva  
echo - VENTANA=comun12
echo.

REM Crear carpeta temporal si no existe
if not exist "C:\tmp" mkdir "C:\tmp"

REM Crear imagen de prueba
echo Creando imagen de prueba...
copy "C:\Windows\System32\oobe\images\background.bmp" "C:\tmp\test.jpg" >nul 2>&1
if exist "C:\tmp\test.jpg" (
    echo ✓ Imagen de prueba creada: C:\tmp\test.jpg
) else (
    echo ✗ Error: No se pudo crear imagen de prueba
    echo Usando imagen alternativa...
    echo "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" > "C:\tmp\test.txt"
)

echo.
echo ========================================
echo    MENU DE PRUEBAS
echo ========================================
echo.
echo 1. Probar VENTANA=comun
echo 2. Probar VENTANA=nueva
echo 3. Probar VENTANA=comun12
echo 4. Probar reutilización (Producto Nuevo)
echo 5. Probar modo publicidad
echo 6. Probar archivo inexistente
echo 7. Limpiar archivos de prueba
echo 8. Salir
echo.
set /p opcion="Seleccione una opción (1-8): "

if "%opcion%"=="1" goto test_comun
if "%opcion%"=="2" goto test_nueva
if "%opcion%"=="3" goto test_comun12
if "%opcion%"=="4" goto test_reutilizacion
if "%opcion%"=="5" goto test_publicidad
if "%opcion%"=="6" goto test_inexistente
if "%opcion%"=="7" goto limpiar
if "%opcion%"=="8" goto salir

echo Opción inválida
goto menu

:test_comun
echo.
echo ========================================
echo    PROBANDO VENTANA=comun
echo ========================================
echo.
echo Enviando contenido a ventana principal...
echo "URI=C:\tmp\test.jpg@VENTANA=comun@INFO=Prueba Comun" > "C:\tmp\direccion.txt"
echo ✓ Archivo de control creado
echo.
echo Verificando que la aplicación procese el archivo...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivo procesado correctamente
) else (
    echo ✗ Archivo no fue procesado
)
echo.
echo Prueba completada. Verifique que:
echo - La ventana principal fue al frente
echo - Se mostró la imagen de prueba
echo - La ventana no permanece siempre al frente
echo.
pause
goto menu

:test_nueva
echo.
echo ========================================
echo    PROBANDO VENTANA=nueva
echo ========================================
echo.
echo Enviando contenido a ventana nueva...
echo "URI=C:\tmp\test.jpg@VENTANA=nueva@INFO=Prueba Nueva" > "C:\tmp\direccion.txt"
echo ✓ Archivo de control creado
echo.
echo Verificando que la aplicación procese el archivo...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivo procesado correctamente
) else (
    echo ✗ Archivo no fue procesado
)
echo.
echo Prueba completada. Verifique que:
echo - Se creó una nueva ventana
echo - La ventana fue al frente automáticamente
echo - Se muestra la imagen de prueba
echo - Puede cerrar la ventana con ESC
echo.
pause
goto menu

:test_comun12
echo.
echo ========================================
echo    PROBANDO VENTANA=comun12
echo ========================================
echo.
echo Enviando contenido a modo espejo...
echo "URI=C:\tmp\test.jpg@VENTANA=comun12@INFO=Prueba Espejo" > "C:\tmp\direccion.txt"
echo ✓ Archivo de control creado
echo.
echo Verificando que la aplicación procese el archivo...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivo procesado correctamente
) else (
    echo ✗ Archivo no fue procesado
)
echo.
echo Prueba completada. Verifique que:
echo - Ambas ventanas (principal y espejo) fueron al frente
echo - Se muestra la misma imagen en ambas ventanas
echo - Las ventanas están sincronizadas
echo.
pause
goto menu

:test_reutilizacion
echo.
echo ========================================
echo    PROBANDO REUTILIZACION (Producto Nuevo)
echo ========================================
echo.
echo Enviando primer contenido...
echo "URI=C:\tmp\test.jpg@VENTANA=nueva@INFO=Primera Imagen" > "C:\tmp\direccion.txt"
echo ✓ Primer archivo enviado
echo.
echo Esperando 2 segundos...
timeout /t 2 /nobreak >nul
echo.
echo Enviando segundo contenido (debe reutilizar ventana)...
echo "URI=C:\tmp\test.jpg@VENTANA=nueva@INFO=Segunda Imagen" > "C:\tmp\direccion.txt"
echo ✓ Segundo archivo enviado
echo.
echo Verificando procesamiento...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivos procesados correctamente
) else (
    echo ✗ Archivos no fueron procesados
)
echo.
echo Prueba completada. Verifique que:
echo - Solo se creó una ventana nueva
echo - La ventana se reutilizó para el segundo contenido
echo - No se crearon ventanas duplicadas
echo.
pause
goto menu

:test_publicidad
echo.
echo ========================================
echo    PROBANDO MODO PUBLICIDAD
echo ========================================
echo.
echo IMPORTANTE: Asegúrese de que IMAGE_PUBLICIDAD_ALLOWED=true
echo en la configuración de la aplicación.
echo.
echo Enviando contenido con modo publicidad...
echo "URI=C:\tmp\test.jpg@VENTANA=comun12@INFO=Modo Publicidad" > "C:\tmp\direccion.txt"
echo ✓ Archivo de control creado
echo.
echo Verificando que la aplicación procese el archivo...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivo procesado correctamente
) else (
    echo ✗ Archivo no fue procesado
)
echo.
echo Prueba completada. Verifique que:
echo - La ventana espejo entra en modo pantalla completa
echo - Se aplica el modo kiosco
echo - La ventana está siempre al frente
echo.
pause
goto menu

:test_inexistente
echo.
echo ========================================
echo    PROBANDO ARCHIVO INEXISTENTE
echo ========================================
echo.
echo Enviando ruta de archivo inexistente...
echo "URI=C:\ruta\inexistente\archivo.jpg@VENTANA=comun@INFO=Archivo Inexistente" > "C:\tmp\direccion.txt"
echo ✓ Archivo de control creado
echo.
echo Verificando que la aplicación procese el archivo...
timeout /t 3 /nobreak >nul
if not exist "C:\tmp\direccion.txt" (
    echo ✓ Archivo procesado correctamente
) else (
    echo ✗ Archivo no fue procesado
)
echo.
echo Prueba completada. Verifique que:
echo - Se mostró la imagen de fallback (Noimage.jpg)
echo - El archivo de control fue eliminado
echo - Se registró el error en los logs
echo.
pause
goto menu

:limpiar
echo.
echo ========================================
echo    LIMPIANDO ARCHIVOS DE PRUEBA
echo ========================================
echo.
if exist "C:\tmp\direccion.txt" (
    del "C:\tmp\direccion.txt"
    echo ✓ Archivo de control eliminado
)
if exist "C:\tmp\test.jpg" (
    del "C:\tmp\test.jpg"
    echo ✓ Imagen de prueba eliminada
)
if exist "C:\tmp\test.txt" (
    del "C:\tmp\test.txt"
    echo ✓ Archivo de prueba eliminado
)
echo.
echo Limpieza completada.
pause
goto menu

:menu
cls
echo ========================================
echo    PRUEBAS DE VENTANAS - MODO IMAGEN
echo ========================================
echo.
echo Este script permite probar los tres modos de ventana:
echo - VENTANA=comun
echo - VENTANA=nueva  
echo - VENTANA=comun12
echo.

REM Crear carpeta temporal si no existe
if not exist "C:\tmp" mkdir "C:\tmp"

REM Crear imagen de prueba
echo Creando imagen de prueba...
copy "C:\Windows\System32\oobe\images\background.bmp" "C:\tmp\test.jpg" >nul 2>&1
if exist "C:\tmp\test.jpg" (
    echo ✓ Imagen de prueba creada: C:\tmp\test.jpg
) else (
    echo ✗ Error: No se pudo crear imagen de prueba
    echo Usando imagen alternativa...
    echo "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" > "C:\tmp\test.txt"
)

echo.
echo ========================================
echo    MENU DE PRUEBAS
echo ========================================
echo.
echo 1. Probar VENTANA=comun
echo 2. Probar VENTANA=nueva
echo 3. Probar VENTANA=comun12
echo 4. Probar reutilización (Producto Nuevo)
echo 5. Probar modo publicidad
echo 6. Probar archivo inexistente
echo 7. Limpiar archivos de prueba
echo 8. Salir
echo.
set /p opcion="Seleccione una opción (1-8): "

if "%opcion%"=="1" goto test_comun
if "%opcion%"=="2" goto test_nueva
if "%opcion%"=="3" goto test_comun12
if "%opcion%"=="4" goto test_reutilizacion
if "%opcion%"=="5" goto test_publicidad
if "%opcion%"=="6" goto test_inexistente
if "%opcion%"=="7" goto limpiar
if "%opcion%"=="8" goto salir

echo Opción inválida
goto menu

:salir
echo.
echo Gracias por usar el script de pruebas.
echo.
exit /b 0
