# Retenciones

## Flujo
- Detección de archivos `retencion*.txt` en la carpeta observada (misma del watcher `.fac`).
- Procesamiento secuencial: se genera un PDF con fondo `templates/FirmaDa.jpg` (fallback `public/Noimage.jpg`) y texto crudo monoespaciado.
- Guardado local en `outLocal/Retenciones/FYYYYMM/RET_<NUMERO>.pdf`; copias a `outRed1/2` si están configuradas; se elimina el `.txt` original.

## Dependencias
- `pdfkit` (ya presente)
- Fuentes: `src/modules/fonts/CONSOLA.TTF` y `CONSOLAB.TTF`.

## Configuración
- Archivo: `config/retencion.config.json` (migrado a `appData/userData/config` en producción)
```json
{
  "outLocal": "C:\\1_AFIP",
  "outRed1": "",
  "outRed2": ""
}
```
- UI: `public/config.html` → Comprobantes → Retenciones

## Ejemplo de salida
- Entrada: `retencion.txt` con línea `NUMERO: 2025-00002800`
- Salida: `RET_2025-00002800.pdf` en `C:\1_AFIP\Retenciones\FYYYYMM\`

## Check-list de pruebas
- Configurar `Ruta Local` y guardar.
- Dejar un `retencion.txt` válido en la carpeta observada.
- Verificar PDF generado y borrado del `.txt`.
- Configurar Red1/Red2 y verificar copias.
- Eliminar/renombrar `templates/FirmaDa.jpg` y verificar fallback.


