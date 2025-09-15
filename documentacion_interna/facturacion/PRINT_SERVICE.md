## PrintService.ts — Uso y auditoría (versión pdf-to-printer)

- Ubicación: `src/services/PrintService.ts`
- API expuesta:

```ts
export async function printPdf(filePath: string, printerName?: string, copies: number = 1): Promise<void>
```

### Propósito
- Imprimir en modo silencioso un PDF existente en disco, sin UI visible.
- Evitar el bug de Chromium/Electron que puede imprimir páginas negras al usar `webContents.print` con PDFs que tienen fondo/imagen completa.
- Selección de impresora por nombre (si no se indica, usa la predeterminada) y cantidad de copias.

### Flujo interno (actual)
1. Valida parámetros y accesibilidad del archivo.
2. Usa la librería `pdf-to-printer` para enviar el PDF directamente al spooler del sistema operativo (Windows/macOS/Linux), eludiendo el motor de render de Electron.
3. Mantiene `printerName` y `copies`.
4. Registra logs opcionales si `PRINT_DEBUG=1`.

### Parámetros
- `filePath` (string): ruta al PDF en disco. Debe existir y ser accesible desde el proceso principal.
- `printerName` (string opcional): nombre EXACTO de la impresora (coincide con `webContents.getPrintersAsync()`/`getPrinters()`). Si es vacío/`undefined`, se usa la predeterminada del sistema.
- `copies` (number opcional): entero ≥ 1. Algunos drivers pueden ignorar este campo; el llamador puede repetir la llamada para forzar copias.

### Precondiciones y supuestos
- El PDF ya fue generado y su descriptor de archivo está cerrado (no se está escribiendo).
- La ruta es válida y accesible (sin bloqueos EBUSY/EPERM).
- La función corre en el proceso principal de Electron (no renderer).

### Integración típica
- Handler IPC en `src/main.ts`:

```ts
ipcMain.handle('printers:print-pdf', async (_e, { filePath, printerName, copies }: { filePath: string; printerName?: string; copies?: number }) => {
  await printPdf(filePath, printerName, copies || 1);
  return { ok: true };
});
```

- Exposición en `src/preload.ts`:

```ts
contextBridge.exposeInMainWorld('api', {
  printers: {
    list: () => ipcRenderer.invoke('printers:list'),
    printPdf: (filePath: string, printerName?: string, copies?: number) => ipcRenderer.invoke('printers:print-pdf', { filePath, printerName, copies }),
  }
});
```

- Ejemplo de uso (tras generar PDF local en Recibos):

```ts
const pdf = path.join(outLocalDir, fileName);
await window.api.printers.printPdf(pdf, selectedPrinterName, numCopias);
```

### Confiabilidad y recomendaciones
- Algunos drivers requieren que el archivo esté 100% listo. Desde el llamador se sugiere verificar antes de imprimir:
  - `fs.existsSync(file)` y `fs.statSync(file).size > 0`.
  - Tamaño estable en 2–3 lecturas con un intervalo breve (200–300 ms).
- Si algún driver ignora `copies`, imprimir en bucle 1× por copia desde el llamador:

```ts
for (let i = 0; i < copies; i++) await printPdf(pdf, printerName, 1);
```

### Manejo de errores
- Cualquier error de `pdf-to-printer` se propaga al llamador.
- Logs opcionales (`PRINT_DEBUG=1`) muestran: ruta del PDF, impresora, copias y mensaje de error si corresponde.
- Si la dependencia no está instalada, se lanza un error claro indicando ejecutar: `npm install pdf-to-printer` (o `pnpm add pdf-to-printer`).

### Seguridad
- Solo imprime archivos locales cuya ruta es provista por el llamador.
- No se exponen rutas por UI fuera de los IPCs definidos.

### Compatibilidad
- Basado en `pdf-to-printer` (spooler nativo del SO). La UI para listar impresoras sigue usando `getPrintersAsync`/`getPrinters` para mostrar nombres válidos.

### Buenas prácticas de auditoría (sugeridas)
- Verificar archivo estable antes de imprimir (existencia + tamaño estable).
- Registrar logs antes/después de `print` (ruta, tamaño, impresora, copias, estado `success/failureReason`).
- Si el driver es problemático (página negra, bloqueos):
  - Incrementar espera previa.
  - Probar impresión en bucle 1× por copia.
  - Probar con otra impresora/driver predeterminada para aislar el problema.

### Ejemplos
- Predeterminada del sistema, 1 copia:

```ts
await printPdf('C:\\1_AFIP\\Ventas_PV16\\F202509\\REC_0016-01000032.pdf');
```

- Impresora específica, 2 copias:

```ts
await printPdf('C:\\1_AFIP\\Ventas_PV16\\F202509\\REC_0016-01000032.pdf', 'HP LaserJet M404', 2);
```

### Limitaciones conocidas
- Requiere tener instalados los drivers del sistema y permisos para imprimir.
- En Windows, `pdf-to-printer` puede necesitar componentes del spooler habilitados. Si falla, verificar el servicio de impresión.
- Si se desea forzar un flujo alternativo, existe `printPdfWithBuffer` (genera buffer con `printToPDF` y también usa `pdf-to-printer`).

### Instalación
- Dependencia:
  - `npm install pdf-to-printer`
  - o `pnpm add pdf-to-printer`

### Notas históricas
- Anteriormente se usaba `webContents.print` con una `BrowserWindow` oculta y esperas manuales.
- Ese flujo podía producir “página negra” en algunos drivers con PDFs que tenían imagen de fondo completa.
- El cambio a `pdf-to-printer` elimina ese render intermedio y envía el PDF directo al spooler del SO.


