# Configuración del Módulo Facturación AFIP

## 📋 **Descripción General**

El **módulo de Facturación AFIP** es el **componente más crítico** del sistema, ya que:
- Procesa archivos `.fac` del sistema legacy
- Se conecta con AFIP WSFE para emisión de CAE
- Genera PDFs con QR de validación
- Gestiona certificados y credenciales AFIP
- Integra con provincias (ARCA, Mendoza)

> ⚠️ **Este módulo es el puente entre el sistema viejo y el nuevo**

---

## 🏗️ **Arquitectura del Módulo**

```
┌─────────────────────────────────────────────────────────────┐
│                  Módulo Facturación AFIP                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [Sistema Legacy]                                            │
│         ↓                                                     │
│    .fac files  →  [Watcher]  →  [facProcessor]              │
│                        ↓                                      │
│                   [FacturacionService]                       │
│                        ↓                                      │
│                   [afipService]  ←→  AFIP WSFE              │
│                        ↓                                      │
│                   [pdfRenderer]  →  PDF + QR                 │
│                        ↓                                      │
│                   Rutas configuradas (local + red)           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ **Subsecciones del Módulo (UI)**

> 💡 **Todas las subsecciones son colapsables** (cerradas por defecto) para una interfaz más limpia y organizada.

### **1. 🏢 Datos de la Empresa** *(Colapsable)*
Información fiscal y comercial del emisor.

**Estado por defecto**: Cerrada

**Campos**:
- **Razón social**: Nombre legal de la empresa
- **CUIT**: CUIT del emisor (11 dígitos)
- **Domicilio**: Dirección fiscal
- **Condición IVA**: Responsable Inscripto (RI) / Consumidor Final (CF)
- **Logo**: Ruta al archivo de logo (ej: `C:\ruta\logo.png`)

**Acción**:
- **Guardar empresa**: Persiste datos en `electron-store`

**IPC**: `facturacion:empresa:get` / `facturacion:empresa:save`

---

### **2. ⚙️ Parámetros de Facturación** *(Colapsable)*
Valores por defecto para emisión.

**Estado por defecto**: Cerrada

**Campos**:
- **Tipo por defecto**: FA, FB, FC, NC, NC_C, RECIBO
- **Punto de venta**: Número (1-9999)
- **Numeración**: Número inicial
- **Emisor es MiPyME**: Checkbox (habilita FCE)
- **Umbral FCE**: Monto mínimo para Factura de Crédito Electrónica (default: $3.958.316)

**Acción**:
- **Guardar parámetros**: Persiste configuración

**IPC**: `facturacion:param:get` / `facturacion:param:save`

---

### **3. 🔐 Configuración AFIP** *(Colapsable)*
Credenciales y certificados para WSFE.

**Estado por defecto**: Cerrada

**Campos**:
- **CUIT Emisor**: Debe coincidir con certificado
- **Punto de Venta**: Habilitado en AFIP
- **Certificado (.crt/.pem)**: Ruta al archivo público
- **Clave privada (.key)**: Ruta a la clave privada
- **Entorno**:
  - **Homologación**: wswhomo.afip.gov.ar (pruebas)
  - **Producción**: servicios1.afip.gov.ar (real)

**Validaciones**:
- CUIT: 11 dígitos
- Certificado y clave: Archivos deben existir
- Entorno: Cambia URLs de conexión

**IPC**: `facturacion:afip:get` / `facturacion:afip:save`

---

### **4. 📋 Emisión de Facturas**
Herramienta completa para emisión de comprobantes electrónicos AFIP.

> 📝 **Cambio de terminología**: Anteriormente llamado "Pruebas de Facturación", ahora usa terminología profesional apropiada para entorno de producción.

#### **Configuración del Comprobante**:
- **Tipo**: 1 (FA), 6 (FB), 2 (NDA), 7 (NDB), 3 (NCA), 8 (NCB), 4 (Recibo)
- **Concepto**: 1 (Productos), 2 (Servicios), 3 (Ambos)
- **Tipo de Documento**: 80 (CUIT), 96 (DNI), 99 (CF)
- **Moneda**: PES, DOL, EUR
- **MiPyME – ModoFin**: ADC, SCA, (vacío=No FCE)

#### **Datos del Cliente**:
- **CUIT Cliente**: 11 dígitos
- **Razón Social**: Nombre
- **Condición IVA**: RI (1), CF (5)
- **Código ARCA**: Autocalculado (readonly)

#### **Validaciones**:
- **Validar Padrón 13**: Verifica habilitación del receptor
- **Previsualizar MiPyME**: Consulta obligación FCE
- **Panel de Estado Visual**: Chips con estado (Padrón, MiPyME, Items, Listo)

#### **Tabla de Items**:
- **Columnas**: Descripción, Cantidad, Precio Unit., IVA %, Subtotal, Acción
- **Estado inicial**: Vacía (sin items de ejemplo)
- **Botones**: + Agregar Item, Limpiar Items
- **Totales**: Neto, IVA, Final (auto-calculados)

#### **Grupos de Acciones** *(Organizadas y Colapsables)*:

Los botones están organizados en **4 grupos lógicos** con colores temáticos:

##### **🚀 Acciones Principales** *(Azul - Cerrado por defecto)*
- **📄 Emitir Factura**: Envía comprobante a AFIP y genera PDF
- **🔗 Asociar Comprobante**: Para NC/ND (oculto por defecto)
- **🗑️ Limpiar Items**: Vacía la tabla de items

##### **✅ Validaciones AFIP** *(Verde - Cerrado por defecto)*
- **🌐 Verificar Estado AFIP**: Consulta estado de servidores WSFE
- **🔐 Validar Certificado**: Valida cert/key y obtiene TA
- **📋 Listar Puntos de Venta**: Consulta puntos de venta habilitados

##### **🔧 Administración y Mantenimiento** *(Naranja - Cerrado por defecto)*
- **🔄 Borrar TA / Relogin**: Fuerza nuevo login WSAA
- **⚠️ Borrar Config AFIP**: Resetea configuración AFIP
- **🔥 Resetear Base**: Elimina `facturacion.db`
- **📊 Listar pendientes**: Muestra comprobantes en idempotencia
- **🧹 Limpiar idempotencia**: Libera bloqueos SHA256

##### **📊 Estado y Checklist** *(Gris - SIEMPRE VISIBLE)*
- **🔍 Revisar**: Ejecuta todas las validaciones
- **Chips de estado**: • Padrón • MiPyME • Items • Listo

> 🎨 **Diseño**: Cada grupo usa colores temáticos (azul=acciones, verde=validaciones, naranja=administración) con bordes semitransparentes y fondos sutiles para una interfaz profesional.

**IPC**: `facturacion:emitir`, `afip:validar-certificado`, `afip:check-server-status`

---

### **5. 📂 Watcher .fac (Procesamiento Automático)** *(No colapsable)*

> 🔥 **Puente crítico entre sistema legacy y nuevo**

**Campos**:
- **Carpeta a observar**: Ej: `C:\tmp`
- **Activar**: Checkbox

**Comportamiento**:
1. Detecta `.fac` en carpeta
2. Parse: extrae `TIPO:`, `CLIENTE:`, `ITEM:`, `TOTALES:`
3. Inferencia de IVA (multi-alícuota)
4. Emisión: `.fac` → `afipService.solicitarCAE()`
5. Genera PDF con QR
6. Crea `.res` con CAE
7. Mueve `.fac` a `done/` o `error/`

**Etiquetas clave en `.fac`**:
```
TIPO: 6 (FB), 1 (FA), 3 (NCA), 8 (NCB)
CLIENTE: Nombre
TIPODOC: 96 (DNI), 80 (CUIT)
NRODOC: 12345678
CONDICION: CF, RI
IVARECEPTOR: 1, 5
MONEDA: PESOS, DOLARES, EUROS
COTIZADOL: 1423.00
ITEM: Descripción|Cantidad|Precio|IVA%|Bonif%
TOTALES:
  NETO 21%: 100.00
  IVA 21%: 21.00
  TOTAL: 121.00
OBS.FISCAL: Observación
```

**IPC**: `facturacion:config:get-watcher-dir`, `facturacion:config:set-watcher-dir`

**Evento**: `facturacion:fac:detected` (Backend → UI)

---

### **6. 📦 Configuración de Salidas (Rutas)** *(No colapsable)*
Define dónde se copian los PDFs generados.

**Facturas A/B y Notas**:
- **Local**: `C:\1_AFIP`
- **Red 1**: `\\correo\backup\...\FACTURAS`
- **Red 2**: `\\server2008\backup\...\FACTURAS`

**Recibos / Remitos**: (mismas rutas)

**Comportamiento**:
- PDF se copia a todas las rutas configuradas
- Si una falla, continúa con las demás

---

## 🔑 **Contratos IPC (Resumen)**

### **Configuración**:
- `facturacion:afip:get/save`
- `facturacion:empresa:get/save`
- `facturacion:param:get/save`
- `facturacion:config:get-watcher-dir/set-watcher-dir`

### **Emisión**:
- `facturacion:emitir`: Emite comprobante
- `facturacion:emitir-con-provincias`: Con ARCA

### **Consultas**:
- `facturacion:listar`: Facturas emitidas
- `facturacion:abrir-pdf`: Abre PDF
- `facturacion:pdfs`: Lista PDFs locales
- `facturacion:listar-ptos-vta`: Puntos de venta AFIP

### **Validaciones**:
- `facturacion:padron13:consulta`: Padrón A13
- `facturacion:padron13:ping`: Ping A13
- `facturacion:fce:consultar-obligado`: MiPyME obligado FCE
- `afip:validar-certificado`: Valida cert/key y obtiene TA
- `afip:check-server-status`: Estado servidores WSFE

### **Idempotencia y CAE**:
- `facturacion:idempotency:list/cleanup`
- `facturacion:validate-cae`
- `facturacion:get-cae-status`
- `facturacion:find-expiring-cae`
- `facturacion:find-expired-cae`

### **Cotización**:
- `facturacion:cotizacion:consultar`: DOL/EUR

### **Administración**:
- `afip:clear-ta`: Elimina TA
- `afip:clear-config`: Resetea config
- `db:reset`: Regenera DB

### **Eventos**:
- `facturacion:fac:detected`: `.fac` detectado

---

## 🛠️ **Servicios Backend (Arquitectura)**

### **FacturacionService** (`src/services/FacturacionService.ts`):
- Orquesta emisión completa
- Métodos:
  - `emitirFacturaYGenerarPdf(params)`
  - `emitirFacturaConProvincias(params)`
  - `abrirPdf(filePath)`

### **afipService** (`src/modules/facturacion/afipService.ts`):
- Comunicación con AFIP WSFE
- Autenticación WSAA
- Solicitud de CAE
- Validación Padrón 13
- Cotización monedas
- Idempotencia (SHA256)
- Circuit breaker

### **facProcessor** (`src/modules/facturacion/facProcessor.ts`):
- Parser de `.fac`
- Inferencia IVA multi-alícuota
- Conversión `.fac` → `ComprobanteInput`
- Usa `TOTALES:` como "biblia" (no recalcula)

### **ContingencyController** (`src/contingency/ContingencyController.ts`):
- Watcher de carpeta
- Cola SQLite
- Circuit breaker
- Movimiento archivos

### **pdfRenderer** (`src/pdfRenderer.ts`):
- PDFKit
- QR validación AFIP
- Plantillas dinámicas
- Moneda extranjera ("SON DÓLARES:")

---

## 🚀 **Flujos Críticos**

### **Flujo 1: Emisión Manual desde UI**
1. Usuario expande grupo "🚀 Acciones Principales"
2. Click en "📄 Emitir Factura"
3. `facturacion:emitir` → `FacturacionService`
4. `afipService.solicitarCAE()` → WSFE
5. AFIP retorna CAE + número
6. `pdfRenderer` genera PDF con QR
7. Copia a rutas configuradas (local + red1 + red2)
8. UI muestra éxito con CAE

### **Flujo 2: Procesamiento Automático `.fac`**
1. Sistema legacy → `25100211161552.fac` → `C:\tmp`
2. Watcher detecta
3. `facProcessor` parsea
4. Extrae `TIPO:`, `CLIENTE:`, `ITEM:`, `TOTALES:`
5. Infiere IVA
6. `ComprobanteInput` con `totales_fac`
7. `afipService.solicitarCAE()`
8. AFIP valida y retorna CAE
9. Genera PDF
10. Crea `.res`
11. Mueve `.fac` a `done/`
12. Copia PDF

### **Flujo 3: Facturación en USD**
1. `.fac` con `MONEDA:DOLARES` + `COTIZADOL:1423.00`
2. `facProcessor` lee `COTIZADOL` → `cotiza_hint`
3. `afipService` usa `cotiza_hint` (no consulta AFIP)
4. `MonId: 'DOL'`, `MonCotiz: 1423.00`
5. AFIP valida tolerancia (±2% a ±400%)
6. PDF: "SON DÓLARES:"

---

## ✅ **Criterios de Aceptación (QA)**

### **Configuración**:
- ✅ Guardar persiste cert/key/cuit/pto_vta
- ✅ Entorno Homologación usa URLs test
- ✅ Validar certificado retorna TA

### **Emisión Manual**:
- ✅ FA con 1 item retorna CAE en < 5s
- ✅ PDF con QR de validación
- ✅ PDF en todas las rutas configuradas (local + red)
- ✅ Padrón 13: CF no permite FA
- ✅ Tabla de items inicia vacía (sin ejemplos)
- ✅ Grupos de botones organizados por categoría

### **Procesamiento `.fac`**:
- ✅ Detecta en < 2s
- ✅ Extrae todas las etiquetas
- ✅ Inferencia IVA multi-alícuota
- ✅ `TOTALES:` como biblia
- ✅ `.res` con CAE
- ✅ Mueve a `done/`

### **Moneda Extranjera**:
- ✅ `DOLARES` + `COTIZADOL` emite con MonId=DOL
- ✅ PDF: "SON DÓLARES:"
- ✅ Tolerancia AFIP

### **Idempotencia**:
- ✅ SHA256 evita duplicados
- ✅ Listar pendientes
- ✅ Limpiar > 24h

---

## ⚠️ **Errores Comunes y Soluciones**

### **"Certificado inválido"**:
- Verificar validez en AFIP
- "Validar Certificado" → TA

### **"Punto de venta no habilitado"**:
- "Listar Puntos de Venta" → consulta AFIP

### **"Padrón 13: Cliente no habilitado"**:
- Cliente no inscripto
- Usar FB (papel) o solicitar inscripción

### **"CAE vencido"**:
- Validez: 10 días
- "Listar CAE próximos a vencer"

### **"Error 10056 — ImpTotal decimal overflow"**:
- Rounding error
- **SOLUCIÓN**: Usar `TOTALES:` del `.fac`

### **"Error 10119 — Cotización fuera de tolerancia"**:
- Cotización fuera de rango
- **SOLUCIÓN**: Usar `COTIZADOL:` del `.fac`

### **".fac no se procesa"**:
- Verificar watcher activo
- Permisos de carpeta
- Formato `.fac` (etiquetas)
- Ver logs `#facWatcherLog`

### **"Comprobante bloqueado"**:
- SHA256 en proceso
- "Limpiar idempotencia"

---

## 📚 **Referencias**

### **Archivos principales**:
- **UI**: `public/config.html` (líneas 564-889)
- **Frontend**: `src/renderer.ts` (líneas 1272-2655)
- **Preload**: `src/preload.ts` (líneas 143-182)
- **Backend**: `src/main.ts` (handlers IPC)

### **Servicios**:
- `src/services/FacturacionService.ts`
- `src/modules/facturacion/afipService.ts`
- `src/modules/facturacion/facProcessor.ts`
- `src/contingency/ContingencyController.ts`
- `src/pdfRenderer.ts`

### **Documentación relacionada**:
- `documentacion_interna/facturacion/facturacion-auditoria.md`
- `documentacion_interna/facturacion/cotizacion-moneda-extranjera.md`

---

## 📊 **Mejoras de UX (Octubre 2025)**

### **Interfaz Organizada**:
1. ✅ **Subsecciones colapsables**: Datos Empresa, Parámetros, Config AFIP
2. ✅ **Grupos de botones temáticos**: 4 categorías con colores coherentes
3. ✅ **Terminología profesional**: Eliminadas referencias a "prueba", "construcción"
4. ✅ **Tabla limpia**: Items inician vacíos (sin ejemplos molestos)
5. ✅ **Secciones eliminadas**: Facturas Emitidas e Historial PDFs (innecesarios)

### **Colores Temáticos**:
- 🔵 **Azul**: Acciones principales (emisión, gestión)
- 🟢 **Verde**: Validaciones (certificados, estado AFIP)
- 🟠 **Naranja**: Administración (limpieza, reinicio)
- ⚪ **Gris**: Información permanente (checklist)

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0.20+

