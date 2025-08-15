!macro preInit
  ; Establecer carpeta de instalación fija
  StrCpy $INSTDIR "C:\\2_mp"
!macroend

!macro customInstall
  ; Crear subcarpetas requeridas
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\reportes"
  CreateDirectory "$INSTDIR\docs"
  ; Conceder permisos de modificación a Usuarios (para escribir logs/reportes)
  ; Requiere admin; icacls está presente en Windows
  nsExec::ExecToStack 'cmd /c icacls "$INSTDIR" /grant Users:(OI)(CI)M /T /C'
  ; Copiar manual si existe en recursos
  SetOutPath "$INSTDIR\docs"
  File /nonfatal /r "..\docs\manual.html"
  ; Crear acceso directo al manual en el escritorio
  CreateShortcut "$DESKTOP\Manual de Uso - Mi App MP.lnk" "$INSTDIR\docs\manual.html"
!macroend
