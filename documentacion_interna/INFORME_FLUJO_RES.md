# 📊 INFORME TÉCNICO: Flujo de generación y envío del archivo `.res`

## 🎯 Resumen Ejecutivo

El archivo `.res` se genera y envía **DESPUÉS** de completar exitosamente todo el procesamiento del archivo `.fac`, incluyendo:
1. Parseo del `.fac`
2. Validación de datos
3. Solicitud y obtención de CAE/Número de AFIP
4. Generación del PDF
5. **Escritura del `.res` con datos del CAE**
6. **Envío por FTP con reintentos**
7. Limpieza de archivos temporales

---

## 📂 Flujo por tipo de comprobante

### **1️⃣ FACTURAS (A/B) y NOTAS (NC A/B, ND A/B)**
**Archivo:** `src/modules/facturacion/facProcessor.ts` → función `processFacturaFacFile()`

#### **Etapas del procesamiento:**

```
.fac detectado
    ↓
1. PARSEO (líneas 628-791)
   - Leer contenido del .fac
   - Detectar tipo (FA/FB/NCA/NCB/NDA/NDB)
   - Parsear cliente, fecha, items RAW, totales
   - Parsear observaciones fiscales
    ↓
2. VALIDACIÓN NTP (líneas 794-800)
   - Validar hora del sistema contra servidor NTP
   - Si falla → return { ok: false, reason: 'NTP_INVALID' }
    ↓
3. CONFIGURACIÓN (líneas 808-825)
   - Cargar config AFIP (CUIT, PV, certificados)
   - Validar que existe outLocal
    ↓
4. SOLICITUD CAE AFIP (líneas 893-913)
   - Construir request con totales_fac (NO items)
   - Llamar a AfipService.emitirFactura()
   - Obtener CAE + Vencimiento + Número AFIP
   - Si falla → retry hasta 3 intentos
   - Si error permanente → generar .res de error
    ↓
5. GENERACIÓN PDF (líneas 967-1058)
   - Llamar a generateInvoicePdf()
   - Guardar en outLocal (C:\1_AFIP\...)
   - Copias adicionales según config (outRed1, outRed2)
   - Enviar por email si corresponde
   - Enviar por WhatsApp si corresponde
   - Imprimir copias si corresponde
    ↓
6. 📝 GENERACIÓN .RES (líneas 1060-1063)
   ✅ Estado: PDF generado exitosamente + CAE obtenido
   
   Contenido del .res:
   ```
   RESPUESTA AFIP    :
   CUIT EMPRESA      :
   MODO              : 0
   PUNTO DE VENTA    : 00016
   NUMERO COMPROBANTE: 00009207
   FECHA COMPROBANTE : 05/10/2025
   NUMERO CAE        : 72345678901234
   VENCIMIENTO CAE   : 15/10/2025
   IMPORTE TOTAL     : 63.500,00
   ARCHIVO REFERENCIA: 25100517123456A.fac
   ARCHIVO PDF       : FA_0016-00009207.pdf
   ```
   
   - Sufijo según tipo: 'a'=FA, 'b'=FB, 'c'=NCA, 'd'=NCB, 'e'=NDA, 'f'=NDB
   - Se guarda en el mismo directorio que el .fac original
   - Copia persistente en userData/fac/out/ (para resumen diario)
    ↓
7. 📤 ENVÍO FTP CON REINTENTOS (líneas 1065-1078)
   ✅ Estado: .res generado correctamente
   
   Función: sendWithRetries()
   - Intento 1: Inmediato (delay: 0ms)
   - Intento 2: Después de 1 segundo (delay: 1000ms)
   - Intento 3: Después de 3 segundos (delay: 3000ms)
   
   Si envío exitoso:
     ✅ Log: "└─ .res OK → FTP"
     ✅ Borrar archivo .res local
     ✅ Borrar archivo .fac original
     ✅ Mover .fac a done/
   
   Si falla todos los intentos:
     ❌ Log: "└─ .res ❌ → FTP (reintentos agotados)"
     ⚠️  El .res y .fac NO se borran (quedan para revisión)
    ↓
8. FINALIZACIÓN
   - Retornar { ok: true, pdfPath, numero, cae, caeVto }
   - Contingency ACK del job
```

---

### **2️⃣ RECIBOS**
**Archivo:** `src/modules/facturacion/facProcessor.ts` → función `processFacFile()`

#### **Etapas del procesamiento:**

```
.fac detectado (tipo RECIBO)
    ↓
1. PARSEO (líneas 95-283)
   - Leer contenido del .fac
   - Detectar tipo RECIBO (por prefijo 'Q' o ausencia de TIPO:)
   - Parsear cliente, fecha, items RAW, totales
    ↓
2. VALIDACIÓN NTP (líneas 284-290)
   - Validar hora del sistema
    ↓
3. CONFIGURACIÓN (líneas 291-298)
   - Cargar config de recibos (PV, contador)
    ↓
4. GENERACIÓN PDF (líneas 334-485)
   - Llamar a generateReciboPdf()
   - Guardar en outLocal
   - NO pasa por AFIP (recibo no fiscal)
    ↓
5. INCREMENTAR CONTADOR (líneas 488-490)
   - Actualizar contador de recibos
    ↓
6. 📝 GENERACIÓN .RES (líneas 492-523)
   ✅ Estado: PDF generado correctamente
   
   Contenido del .res:
   ```
   RESPUESTA AFIP    :
   FECHA COMPROBANTE : 05/10/2025
   NUMERO CAE        : (vacío para recibos)
   VENCIMIENTO CAE   : 0
   PUNTO DE VENTA    : 00016
   NUMERO COMPROBANTE: 01000082
   IMPORTE TOTAL     : 63.500,00
   ARCHIVO REFERENCIA: 25100517123456Q.fac
   ARCHIVO PDF       : REC_0016-01000082.pdf
   ```
   
   - Usa últimos 8 caracteres del nombre .fac (minúscula)
   - Se guarda en el mismo directorio que el .fac
   - Copia persistente en userData/fac/out/
    ↓
7. 📤 ENVÍO FTP (líneas 525-541)
   ✅ Estado: .res generado correctamente
   
   Función: sendArbitraryFile() (sin reintentos automáticos)
   
   Si envío exitoso:
     ✅ Log: "[recibo] Intentando enviar .res por FTP: 3373629q.res"
     ✅ Log: "└─ .res OK → FTP"
     ✅ Borrar archivo .res local
     ✅ Borrar archivo .fac original
     ✅ Log: "[recibo] .res enviado por FTP y archivos limpiados"
   
   Si falla:
     ❌ Log: "└─ .res ❌ → [error]"
     ⚠️  El .res y .fac NO se borran
    ↓
8. FINALIZACIÓN
   - Retornar pdfPath
```

---

### **3️⃣ REMITOS**
**Archivo:** `src/modules/facturacion/remitoProcessor.ts` → función `processRemitoFacFile()`

#### **Etapas del procesamiento:**

```
.fac detectado (tipo REMITO: sufijo 'R')
    ↓
1. PARSEO (líneas 106-346)
   - Leer contenido del .fac
   - Detectar tipo REMITO (por sufijo 'R')
   - Parsear cliente, fecha, items RAW
    ↓
2. VALIDACIÓN NTP (líneas 347-351)
   - Validar hora del sistema
    ↓
3. CONFIGURACIÓN (líneas 352-359)
   - Cargar config de remitos (PV, contador)
    ↓
4. GENERACIÓN PDF (líneas 391-458)
   - Llamar a generateRemitoPdf()
   - Guardar en outLocal
   - NO pasa por AFIP (remito no fiscal)
    ↓
5. INCREMENTAR CONTADOR (líneas 461-462)
   - Actualizar contador de remitos
    ↓
6. 📝 GENERACIÓN .RES (líneas 464-493)
   ✅ Estado: PDF generado correctamente
   
   Contenido del .res:
   ```
   RESPUESTA AFIP    :
   FECHA COMPROBANTE : 05/10/2025
   NUMERO CAE        : (vacío para remitos)
   VENCIMIENTO CAE   : 0
   PUNTO DE VENTA    : 00016
   NUMERO COMPROBANTE: 00001234
   IMPORTE TOTAL     : 63.500,00
   ARCHIVO REFERENCIA: 25100517123456R.fac
   ARCHIVO PDF       : REM_0016-00001234.pdf
   ```
   
   - Sufijo: última letra cambiada a 'r'
   - Se guarda en el mismo directorio que el .fac
   - Copia persistente en userData/fac/out/
    ↓
7. 📤 ENVÍO FTP (líneas 495-508)
   ✅ Estado: .res generado correctamente
   
   Función: sendArbitraryFile()
   
   Si envío exitoso:
     ✅ Log: "[remito] Intentando enviar .res por FTP: 3373629r.res"
     ✅ Log: "└─ .res OK → FTP"
     ✅ Borrar archivo .res local
     ✅ Borrar archivo .fac original
     ✅ Log: "[remito] .res enviado por FTP y archivos limpiados"
   
   Si falla:
     ❌ Log: "└─ .res ❌ → [error]"
     ⚠️  El .res y .fac NO se borran
    ↓
8. FINALIZACIÓN
   - Retornar pdfPath
```

---

## 🔑 Puntos críticos del flujo

### **✅ Condiciones para que se envíe el `.res`:**

1. **Parseo exitoso del `.fac`** → ✅ Sin errores de formato
2. **Validación NTP exitosa** → ✅ Hora del sistema sincronizada
3. **Configuración válida** → ✅ CUIT, PV, outLocal definidos
4. **CAE obtenido** (solo Facturas/Notas) → ✅ AFIP respondió OK
5. **PDF generado** → ✅ Archivo PDF creado en outLocal
6. **`.res` escrito** → ✅ Archivo .res creado con datos correctos
7. **FTP configurado** → ✅ Credenciales FTP válidas

### **❌ ¿Qué pasa si el FTP falla?**

**Facturas/Notas (con reintentos):**
- Intento 1: Inmediato
- Intento 2: Después de 1 segundo
- Intento 3: Después de 3 segundos
- Si todos fallan:
  - ❌ Log: "└─ .res ❌ → FTP (reintentos agotados)"
  - ⚠️  `.res` y `.fac` **NO se borran**
  - ⚠️  Quedan en `processing/` para revisión manual
  - ⚠️  El job se marca como ERROR en la cola

**Recibos/Remitos (sin reintentos):**
- Intento único inmediato
- Si falla:
  - ❌ Log: "└─ .res ❌ → [error]"
  - ⚠️  `.res` y `.fac` **NO se borran**
  - ⚠️  Quedan en `processing/` para revisión manual

---

## 📊 Timeline de eventos (ejemplo real)

Basado en el terminal que compartiste:

```
[20:48:38] Detectado: 25091613373629Q.fac | 1.4 KB
           ↓
[20:48:38] Movido a staging/
           ↓
[20:48:38] Encolado: job_id=42
           ↓
[20:48:38] Lock: movido a processing/
           ↓
[20:48:39] Parseando...
           ↓
[20:48:39] Validando NTP...
           ↓
[20:48:40] Generando PDF...
           ↓
[20:48:40] PDF OK: REC_0016-01000082.pdf
           ↓
[20:48:40] ✅ Generando .res: 3373629q.res
           ↓
[20:48:40] 📤 [recibo] Intentando enviar .res por FTP: 3373629q.res
           ↓
[20:48:41] ✅ .res enviado por FTP
           ↓
[20:48:41] 🗑️  Borrando .res local
           ↓
[20:48:41] 🗑️  Borrando .fac original
           ↓
[20:48:41] Movido a done/
           ↓
[20:48:41] Job ACK: id=42
           ↓
[20:48:41] ✅ PROCESO COMPLETO
```

**⏱️ Tiempo total:** ~3 segundos (desde detección hasta limpieza)

---

## 🛡️ Garantías del sistema

### **1. Atomicidad del `.res`:**
- El `.res` **SOLO se genera** si el PDF se creó exitosamente
- El `.res` **SOLO se envía** si existe en disco
- El `.res` **SOLO se borra** si el envío FTP fue exitoso

### **2. Durabilidad:**
- **Copia persistente** del `.res` en `userData/fac/out/` (para resumen diario)
- El `.fac` original **NO se borra** hasta que el `.res` se envíe exitosamente
- Si el FTP falla, los archivos quedan en `processing/` para revisión

### **3. Idempotencia:**
- El sistema verifica si ya existe un `.res` con el mismo nombre antes de procesar
- Evita duplicados por reintentos automáticos

### **4. Trazabilidad:**
- Logs detallados en cada etapa del flujo
- Logs persistentes en SQLite por 24 horas
- Logs visibles en "Modo Caja" en tiempo real

---

## 🔧 Funciones clave involucradas

### **Generación del `.res`:**
- **Facturas/Notas:** Líneas 1060-1063 en `facProcessor.ts`
- **Recibos:** Líneas 492-523 en `facProcessor.ts`
- **Remitos:** Líneas 464-493 en `remitoProcessor.ts`

### **Envío por FTP:**
- **Función:** `sendArbitraryFile()` en `src/services/FtpService.ts`
- **Con reintentos:** `sendWithRetries()` (solo Facturas/Notas)
- **Sin reintentos:** Llamada directa (Recibos/Remitos)

### **Limpieza de archivos:**
- **Facturas/Notas:** Líneas 1073-1074 en `facProcessor.ts`
- **Recibos:** Líneas 532-534 en `facProcessor.ts`
- **Remitos:** Líneas 502-503 en `remitoProcessor.ts`

---

## 📝 Notas importantes

1. **El `.res` NO se genera si hay error antes del PDF:**
   - Error de parseo → No hay .res
   - Error de NTP → No hay .res
   - Error de AFIP → Se genera `.res` de ERROR

2. **El `.res` de ERROR contiene:**
   ```
   RESPUESTA AFIP    :
   ERROR             : [mensaje del error]
   ```

3. **Archivos que quedan en `processing/` tras fallo:**
   - `.fac` original (para reprocesar)
   - `.res` no enviado (si se generó)
   - Pueden limpiarse manualmente o con `caja:cleanup-res`

4. **El `.res` es el "ticket de confirmación":**
   - Para el sistema externo que envió el `.fac`
   - Contiene CAE, número, fecha, etc.
   - Se envía por FTP para cerrar el ciclo

---

## 🎯 Conclusión

**El archivo `.res` se envía:**
- ✅ **AL FINAL** del procesamiento completo
- ✅ **DESPUÉS** de generar el PDF exitosamente
- ✅ **DESPUÉS** de obtener el CAE (si corresponde)
- ✅ **CON REINTENTOS** (Facturas/Notas) o **SIN REINTENTOS** (Recibos/Remitos)
- ✅ **SOLO SI** el envío FTP es exitoso se borran los archivos temporales

**Garantía:** Si el `.res` se envió por FTP, significa que TODO el proceso fue exitoso (PDF generado, CAE obtenido, etc.).

