# Formato e interpretación de archivos `.fac`

Este documento describe la estructura observada de los archivos `.fac` recibidos por FTP y la propuesta de normalización para su uso en el módulo de Facturación (AFIP) y en documentos no AFIP (p. ej. Recibo).

## 1) Resumen
- Fuente: sistema externo que deposita archivos `.fac` en una carpeta local (ej. `C:\\tmp`).
- Detección: watcher en `main` dispara al crear un `.fac` y lee el contenido UTF-8.
- Objetivo: normalizar el contenido a una estructura intermedia y, según `TIPO`, mapear a:
  - Comprobantes AFIP (Factura A/B/C, Nota de Crédito/Débito) → `ComprobanteRequest` consolidado.
  - Documentos no AFIP (Recibo) → sólo PDF con plantilla.

## 2) Estructura general del `.fac`
Bloques típicos por orden de aparición:
- Encabezado
- Receptor (cliente)
- Ítems (o conceptos de cobro en Recibo)
- Totales
- Observaciones (cabecera/pie)

Claves conocidas por bloque:

- Encabezado:
  - `DIAHORA:` fecha y hora. Ej: `11/09/25 14:43:31 yp49` (el sufijo suele ser la terminal)
  - `IP:` ip de origen
  - `TIPO:` código numérico (AFIP) o `RECIBO` para no AFIP
  - `FONDO:` ruta de fondo/plantilla PDF
  - `COPIAS:` cantidad de copias a imprimir
  - `MONEDA:` (opcional; visto en recibo) `PESOS`, etc.

- Receptor:
  - `CLIENTE:` formato `(<codigo>)<razon social>`
  - `TIPODOC:` 80=CUIT, 96=DNI, 99=Consumidor final, etc.
  - `NRODOC:` número (puede venir vacío si CF)
  - `CONDICION:` condición IVA en texto ("RESPONSABLE INSCRIPTO", "CONSUMIDOR FINAL", ...)
  - `IVARECEPTOR:` código numérico de condición IVA (mapeo ARCA)
  - `DOMICILIO:` texto libre (incluye Tel/CP)

- Ítems / conceptos:
  - Comienza con la línea `ITEM:`
  - Facturas: líneas con patrón `cantidad  descripcion  ...  <precio?>  <IVA%>  <importe>`
  - Recibo: líneas con patrón `cantidad  <MEDIO>:<detalle>  <importe>`
  - Pueden existir líneas decorativas sin importes (se ignoran en el consolidado)

- Totales (bloque `TOTALES:`):
  - `NETO 21%`, `NETO 10.5%`, `EXENTO`, `IVA 21%`, `IVA 10.5%`, `TOTAL`
  - Pueden sumarse otras tasas o tributos en futuros archivos

- Observaciones:
  - `OBS.CABCERA1:` / `OBS.CABCERA2:` / `OBS.PIE:` (texto libre, múltiples líneas hasta la siguiente etiqueta)

## 3) Normalización propuesta (estructura intermedia)
```json
{
  "tipo": "FACTURA" | "RECIBO" | "NC" | "ND",
  "fechaHora": "2025-09-11T14:43:31",
  "plantilla": "factura_a" | "factura_b" | "factura_c" | "recibo" | "nota_credito" | "nota_debito",
  "copias": 1,
  "receptor": {
    "codigo": "016544",
    "nombre": "SUAREZ ISMAEL",
    "docTipo": 96,
    "docNro": "31747074",
    "condicionIvaTxt": "CONSUMIDOR FINAL",
    "ivaReceptor": 5,
    "domicilio": "..."
  },
  "moneda": "PESOS",
  "items": [
    { "cantidad": 1, "descripcion": "PRUEBA 1", "alicuota": 21.00, "importe": 0.083 }
  ],
  "pagos": [
    { "medio": "EFECTIVO", "importe": 0.10 }
  ],
  "totales": {
    "neto21": 0.08,
    "neto105": 0.09,
    "exento": 0.00,
    "iva21": 0.02,
    "iva105": 0.01,
    "total": 0.20
  },
  "observaciones": { "cabecera1": "...", "cabecera2": "...", "pie": "..." },
  "metadatos": { "ip": "192.168.48.88", "fondo": "C:\\1_OLDFacturador\\MiFondo.jpg" }
}
```
Notas:
- `items` se usa para PDF; AFIP recibe consolidado por alícuota en `totales` (Iva[]).
- En Recibo, se usa `pagos` (no hay IVA ni consolidado AFIP).

## 4) Mapeo a AFIP (`ComprobanteRequest` consolidado)
- `TIPO` → `CbteTipo` (1=A, 6=B, 11=C, 3/8/13=NC, 2/7/12=ND, 19=E si aplica). Para `RECIBO` no AFIP → sin request AFIP.
- `DIAHORA` → `CbteFch` (AAAAMMDD) y fecha de emisión.
- Receptor → `DocTipo`, `DocNro`. Si CF sin documento: `DocTipo=99`, `DocNro=0`.
- Consolidado IVA → `Iva[]`:
  - `NETO 21%` + `IVA 21%` → `{ Id: 5, BaseImp: neto21, Importe: iva21 }`
  - `NETO 10.5%` + `IVA 10.5%` → `{ Id: 4, BaseImp: neto105, Importe: iva105 }`
- Exento → `ImpOpEx` (exento)
- Total → `ImpTotal`
- Moneda → `MonId`/`MonCotiz` (siempre `PES` y `1` salvo indicación contraria)
- Ítems no se envían a AFIP (solo PDF); `ImpNeto` = suma de netos por alícuota; `ImpTrib` si en el futuro aparece bloque de tributos.

## 5) Reglas de parsing
- `CLIENTE:(<codigo>)<razon>`: extraer `codigo` y `razon` con expresión regular.
- `ITEM:`: tomar solo líneas que terminen en importe numérico. En facturas, detectar `alicuota` por columna `%` o inferir por bloque de totales si la línea no lo muestra.
- `TOTALES:`: cada línea `CLAVE: <monto>` trim y parseo decimal con punto.
- En CF (`TIPODOC=99` y `NRODOC` vacío) → `DocNro=0`.
- `IVARECEPTOR` se conserva para PDF/ARCA; no afecta el request AFIP estándar.
- `RECIBO`: 
  - `items` → `pagos` (medio: texto a la izquierda de `:`; importe al final).
  - El `TOTAL` debe ser igual a la suma de `pagos`.

## 6) Plantillas PDF
- `FONDO` sugiere fondo/plantilla a usar (ej.: `MiFondo.jpg`, `MiFondo-pagado.jpg`, `MiFondoRe.jpg`).
- Para recibo, la plantilla por defecto es `MiFondoRe.jpg`.

## 7) Pendientes / Extensiones
- Nota de Crédito/Débito: definir claves adicionales para comprobantes asociados (`CbtesAsoc`), motivo, etc.
- Moneda extranjera: si `MONEDA` != `PESOS`, contemplar `MonId` y cotización.
- Tributos varios: si aparecen líneas tipo `TRIBUTO: ...`, mapear a `Tributos` e `ImpTrib`.
- Validación robusta y reporter de errores de parseo (líneas ignoradas, totales inconsistentes, etc.).

## 8) Ejemplos reales (del proyecto)
- Factura A (TIPO:1) → `src/modules/facturacion/plantilla/25082311322347.fac`
- Factura B (TIPO:6) → `src/modules/facturacion/plantilla/25082311335147.fac`
- Recibo (TIPO:RECIBO) → `src/modules/facturacion/plantilla/25091114433149Q.fac`
