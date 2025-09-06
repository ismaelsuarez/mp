# Acciones principales y Vista previa (Administración)

## Objetivo
Facilitar tareas frecuentes (cargar/guardar, generar, enviar por FTP) y ofrecer una vista previa no sensible del JSON de configuración, con herramientas de inspección y respaldo.

## Acciones principales
- Cargar configuración
- Guardar configuración
- Generar reporte
- Enviar DBF por FTP
- Limpiar Hash FTP

## Vista previa (no sensible)
- Filtro de texto, Copiar, Descargar .json, Restaurar .json
- Expandir/Contraer, Mostrar/Ocultar
- Ofuscación de secretos

## Referencias
- UI: `public/config.html` y `src/renderer.ts`
- FTP: `src/services/FtpService.ts`, `src/main.ts`
