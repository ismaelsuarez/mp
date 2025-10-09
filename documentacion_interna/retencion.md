Retenciones – Especificación funcional y técnica

1) Objetivo
Procesar archivos retencion*.txt depositados en la carpeta observada (por defecto C:\tmp) y generar un PDF monoespaciado con fondo, guardarlo en la estructura de salida configurada, copiar a rutas de red opcionales y limpiar el .txt original.

2) Nombres y ubicación de entrada
- Carpeta observada: configurable; por defecto C:\tmp (clave FACT_FAC_DIR).
- Patrones aceptados: cualquier nombre que cumpla retencion*.txt (insensible a mayúsculas/minúsculas). Ejemplos:
  - retencion.txt
  - retencion_2025_01.txt
  - RETENCION-ABC.txt

Nota: El watcher de .fac existente también integra retencion*.txt para mantener la cola secuencial única.

3) Watcher y cola (detalles)
- Archivos: src/main.ts y src/modules/facturacion/facWatcher.ts.
- Estabilidad del archivo: el watcher espera hasta que el archivo esté estable (tamaño sin cambios) y reintenta lectura (manejo de EBUSY/EACCES/EPERM) antes de encolarlo.
- Cola secuencial: cada archivo detectado se encola y se procesa en orden (evita carreras y dobles procesos).
- Enrutamiento: si el nombre cumple retencion*.txt, se invoca processRetencionTxt(fullPath) del módulo Retenciones.

4) Configuración persistente
- Archivo: config/retencion.config.json (semilla) con migración a app.getPath('userData')/config/retencion.config.json en instalación.
- Estructura base:
{
  "outLocal": "C:\\RETENCIONES",
  "outRed1": "",
  "outRed2": ""
}
- UI (Renderer): public/config.html → Comprobantes → Retenciones
  - Campos: Ruta Local (obligatoria), Ruta Red 1 (opcional), Ruta Red 2 (opcional).
  - Guardado: window.api.retencion.saveConfig → IPC retencion:save-config.

5) Procesamiento (módulo principal)
- Archivo: src/modules/retenciones/retencionProcessor.ts
- Pasos:
  1. Leer .txt en UTF-8.
  2. Extraer número para nombre de salida:
     - Regla: primera coincidencia de NUMERO: <valor> usando /NUMERO:\s*([0-9\-]+)/i.
     - Si no hay número: usar SINNUM.
  3. Nombre: `B<NUMERO>.pdf` (sin guión bajo) y guardar directo en la raíz de cada ruta configurada (sin subcarpetas).
  4. Generar PDF local con layout central y monoespaciado.
  5. Copiar el PDF a outRed1 y outRed2 (si están configuradas) en su raíz.
  6. Limpieza: borrar el .txt original si todo salió bien.
  7. Error: mover el .txt a subcarpeta errores/ con timestamp.

Nombrado del PDF
- Formato: `B<NUMERO>.pdf`. Ejemplos:
  - Entrada: NUMERO: 2025-00002800 → B2025-00002800.pdf
  - Entrada sin NUMERO: → BSINNUM.pdf

6) Render del PDF (monoespaciado con fondo)
- Archivo: src/modules/retenciones/retencionRenderer.ts (usa layout central).
- Motor: pdfkit.
- Fondo: templates/FirmaDa.jpg (fallback public/Noimage.jpg).
- Fuentes: CONSOLA.TTF / CONSOLAB.TTF.
- Layout centralizado: invoiceLayout.mendoza.ts → `invoiceLayout.retencion.blocks.body { x,y,width,lineGap,fontSize }`.
- Render sin cortes: respeta líneas del `.txt` (sin word-wrap); normaliza CRLF→LF; `paragraphGap:0`.

7) Salidas
- Local: outLocal\B<NUMERO>.pdf
- Red 1 (opcional): outRed1\B<NUMERO>.pdf
- Red 2 (opcional): outRed2\B<NUMERO>.pdf

8) Limpieza y manejo de errores
- Éxito: se elimina el .txt original tras generar/copiar el PDF.
- Falla: se mueve el .txt a errores/ con prefijo de timestamp YYYYMMDD_HHmmss_.
- Faltante de Ruta Local: el procesador aborta con error claro ("Ruta Local (retenciones) es obligatoria").

9) Interfaz, IPC y persistencia
- UI Renderer: public/config.html (sección Retenciones) para ver/guardar rutas.
- Preload: src/preload.ts
  - retencion.getConfig() → ipcRenderer.invoke('retencion:get-config')
  - retencion.saveConfig(cfg) → ipcRenderer.invoke('retencion:save-config', cfg)
- Main (IPC): src/main.ts
  - ipcMain.handle('retencion:get-config', ...)
  - ipcMain.handle('retencion:save-config', ...)

10) Ejemplo paso a paso
1. Abrir la app y en Configuración → Comprobantes → Retenciones:
   - Completar "Ruta Local" (ej. C:\1_AFIP) y Guardar.
2. Verificar carpeta observada (por defecto C:\tmp).
3. Depositar un archivo retencion.txt con el siguiente contenido mínimo:
NUMERO: 2025-00002800
Texto libre de varias líneas...
Otra línea...
4. Esperado:
   - PDF local en C:\1_AFIP\Retenciones\FYYYYMM\RET_2025-00002800.pdf.
   - Copias a Red si están configuradas.
   - El retencion.txt deja de estar en C:\tmp (borrado) o, si falla, aparece en C:\tmp\errores\YYYYMMDD_HHmmss_retencion.txt.

11) Logs y diagnóstico
- Vista Caja: muestra mensajes como "✅ RET retencion.txt → Nº <NUMERO> Completado" y persiste 24 h (CajaLogStore).
- Consola principal: logs "RETENCION finalizado" con metadatos.
- Si no genera PDF: revisar que outLocal exista y tenga permisos; validar que el archivo tenga NUMERO: y esté en UTF-8; verificar fondo templates/FirmaDa.jpg (hay fallback a public/Noimage.jpg).

12) Limitaciones (versión inicial)
- Sin impresión, email ni WhatsApp.
- Procesamiento secuencial (no paraleliza intencionalmente).
- No remaqueta el texto: render crudo monoespaciado.

13) Resumen de archivos implicados
- UI: public/config.html (sección Retenciones)
- Preload: src/preload.ts (APIs retencion.*)
- Main/IPC + Watcher: src/main.ts (handlers y cola; inclusión de retencion*.txt en escaneo y detección)
- Watcher base: src/modules/facturacion/facWatcher.ts (soporta retencion*.txt)
- Procesador: src/modules/retenciones/retencionProcessor.ts
- Renderer: src/modules/retenciones/retencionRenderer.ts
- Config: config/retencion.config.json


