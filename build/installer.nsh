!macro preInit
  ; No forzar ruta fija. Se respetará la carpeta elegida por el usuario
  ; (electron-builder + NSIS usarán el directorio seleccionado en el asistente)
!macroend

!macro customInstall
  ; Crear subcarpetas requeridas dentro de la carpeta elegida por el usuario
  ; Estructura final: <carpeta elegida>\logs, \reportes y los archivos del programa
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\reportes"
  ; Conceder permisos de modificación a Usuarios (para escribir logs/reportes)
  ; Requiere admin; icacls está presente en Windows
  nsExec::ExecToStack 'cmd /c icacls "$INSTDIR" /grant Users:(OI)(CI)M /T /C'
  ; Copiar manual desde recursos de build al directorio de instalación
  SetOutPath "$INSTDIR"
  File "${BUILD_RESOURCES_DIR}\manual.html"
  ; Crear acceso directo al manual en el escritorio (apunta al archivo instalado)
  CreateShortcut "$DESKTOP\Manual de Uso - Mi App MP.lnk" "$INSTDIR\manual.html"
!macroend
