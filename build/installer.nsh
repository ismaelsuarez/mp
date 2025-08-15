!macro preInit
  ; Establecer carpeta de instalación fija
  StrCpy $INSTDIR "C:\\2_mp"
!macroend

!macro customInstall
  ; Crear subcarpetas requeridas
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
