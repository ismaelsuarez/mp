# Acciones principales y Vista previa (Administración)

## Objetivo
Facilitar tareas frecuentes (cargar/guardar, generar, enviar por FTP) y ofrecer una vista previa no sensible del JSON de configuración, con herramientas de inspección y respaldo.

## Ubicación
- Archivo: `public/config.html`
- Sección: parte inferior de la pestaña `Configuración`.

## Acciones principales
- Cargar configuración: lee desde disco y aplica al formulario.
- Guardar configuración: persiste todos los campos visibles de la pestaña Configuración.
- Generar reporte: ejecuta el flujo de consulta y muestra resultados en la pestaña `Resultados`.
- Enviar DBF por FTP: envía `mp.dbf` al servidor configurado.
- Limpiar Hash FTP: borra el hash local para forzar nuevo envío.

## Vista previa (no sensible)
- Filtrar: campo de texto que muestra solo claves/valores que coincidan.
- Copiar: copia el JSON visible al portapapeles.
- Descargar .json: exporta el JSON visible a un archivo (útil para respaldo/soporte).
- Restaurar: importa un `.json` y propone sobrescribir la configuración actual.
- Expandir/Contraer: alterna el alto del panel para facilitar lectura.
- Mostrar/Ocultar: permite ocultar temporalmente la vista para ganar espacio.

Notas:
- Los campos sensibles se ofuscan en la vista (por ejemplo, `MP_ACCESS_TOKEN`, `SMTP_PASS`).
- La restauración realiza un merge superficial: las claves del archivo importado sobrescriben las actuales.

## Referencias
- Lógica UI: `src/renderer.ts` (renderPreview, controles de filtro/copia/exportación/restauración).
- Envío FTP: `src/services/FtpService.ts` y `src/main.ts` (flujo de reporte/FTP).
