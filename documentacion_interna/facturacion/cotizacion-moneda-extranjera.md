# 💱 CONSULTA DE COTIZACIÓN AFIP/ARCA ANTES DE GENERAR .FAC

## 📋 **INTRODUCCIÓN**

Para facturación en **moneda extranjera** (DÓLARES o EUROS), es crítico usar la cotización correcta **ANTES** de generar el archivo `.fac`. AFIP/ARCA tiene reglas estrictas sobre qué cotización usar según el tipo de operación.

---

## 🎯 **ESCENARIOS DE USO**

### **Escenario A: Cliente cancela en PESOS (N)**
```
CANCELA_MISMA_MONEDA:N
```
- **Cotización:** Del día de emisión (HOY)
- **Flexibilidad:** AFIP tolera desviaciones de **-5% a +80%** respecto a la oficial
- **Uso típico:** Mayoría de las operaciones

### **Escenario B: Cliente cancela en DÓLARES (S)**
```
CANCELA_MISMA_MONEDA:S
```
- **Cotización:** Del **día hábil anterior** a la fecha del comprobante
- **Flexibilidad:** **NINGUNA** - Debe ser exactamente la oficial de AFIP
- **Uso típico:** Exportaciones, operaciones internacionales

---

## 🔧 **MÉTODOS DE CONSULTA**

### **1️⃣ DESDE LÍNEA DE COMANDOS (CLI)**

```bash
# Consultar dólar para operación de HOY (cancela en pesos)
npm run cotizacion -- --moneda DOL

# Consultar dólar para operación del 02/10/2025 que cancela en dólares
npm run cotizacion -- --moneda DOL --fecha 20251002 --cancela-misma-moneda S

# Consultar euro
npm run cotizacion -- --moneda EUR
```

**Salida esperada:**
```
🔄 Consultando cotización a AFIP/ARCA...

✅ COTIZACIÓN AFIP/ARCA

Moneda:                  DOL
Cotización Oficial:      1345.50
Fecha Cotización:        20251002
Cancela en misma moneda: N

📊 RANGO TOLERADO (para CanMisMonExt=N):
  Mínimo: 1278.23 (-5%)
  Máximo: 2421.90 (+80%)

💡 RECOMENDACIÓN:
  Puede usar entre 1278.23 y 2421.90 (tolerancia: -5% / +80% sobre 1345.50). Se recomienda usar la oficial.

📝 PARA TU ARCHIVO .FAC:
  COTIZADOL:1345.50

📄 JSON (para scripts):
{
  "moneda": "DOL",
  "cotizOficial": 1345.5,
  "fechaCotiz": "20251002",
  "canMisMonExt": "N",
  "rangoTolerado": {
    "min": 1278.225,
    "max": 2421.9,
    "minPercent": -5,
    "maxPercent": 80
  },
  "recomendacion": "Puede usar entre 1278.23 y 2421.90...",
  "paraFac": {
    "linea": "COTIZADOL:1345.50"
  }
}
```

---

### **2️⃣ DESDE LA INTERFAZ DE USUARIO (IPC)**

Desde tu ventana de Electron (renderer):

```typescript
// En tu código TypeScript del renderer
const result = await window.electron.ipcRenderer.invoke(
  'facturacion:cotizacion:consultar',
  {
    moneda: 'DOL',
    fecha: '20251002',          // opcional
    canMisMonExt: 'N'            // opcional
  }
);

if (result.ok) {
  const { data } = result;
  console.log('Cotización oficial:', data.cotizOficial);
  console.log('Para el .fac:', data.paraFac.linea);
  
  // Ejemplo: rellenar campo en formulario
  document.getElementById('cotizacion').value = data.cotizOficial;
} else {
  console.error('Error:', result.error);
}
```

**Ejemplo de uso en formulario de factura:**

```html
<!-- Formulario de emisión de factura -->
<form id="formFactura">
  <label>Moneda:</label>
  <select id="moneda" onchange="consultarCotizacion()">
    <option value="PES">Pesos</option>
    <option value="DOL">Dólares</option>
    <option value="EUR">Euros</option>
  </select>
  
  <label>Cancela en misma moneda:</label>
  <select id="canMisMonExt">
    <option value="N">NO - Cancela en pesos</option>
    <option value="S">SÍ - Cancela en dólares/euros</option>
  </select>
  
  <label>Cotización:</label>
  <input type="number" id="cotizacion" readonly>
  <button type="button" onclick="consultarCotizacion()">Consultar AFIP</button>
  
  <div id="rangoTolerado" style="display:none; color: #666; font-size: 12px;">
    Rango tolerado: <span id="rangoMin"></span> - <span id="rangoMax"></span>
  </div>
</form>

<script>
async function consultarCotizacion() {
  const moneda = document.getElementById('moneda').value;
  if (moneda === 'PES') {
    document.getElementById('cotizacion').value = '';
    document.getElementById('rangoTolerado').style.display = 'none';
    return;
  }
  
  const canMisMonExt = document.getElementById('canMisMonExt').value;
  
  try {
    const result = await window.electron.ipcRenderer.invoke(
      'facturacion:cotizacion:consultar',
      { moneda, canMisMonExt }
    );
    
    if (result.ok) {
      document.getElementById('cotizacion').value = result.data.cotizOficial.toFixed(2);
      
      if (canMisMonExt === 'N') {
        document.getElementById('rangoTolerado').style.display = 'block';
        document.getElementById('rangoMin').textContent = result.data.rangoTolerado.min.toFixed(2);
        document.getElementById('rangoMax').textContent = result.data.rangoTolerado.max.toFixed(2);
      } else {
        document.getElementById('rangoTolerado').style.display = 'none';
      }
      
      alert(`Cotización AFIP: $${result.data.cotizOficial.toFixed(2)}\n\n${result.data.recomendacion}`);
    } else {
      alert(`Error al consultar cotización: ${result.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
</script>
```

---

### **3️⃣ DESDE CÓDIGO TypeScript (Módulo)**

```typescript
import { consultarCotizacionAfip, validarCotizacion } from './modules/facturacion/cotizacionHelper';

// Ejemplo: obtener cotización para factura de hoy
const cotiz = await consultarCotizacionAfip({ moneda: 'DOL' });
console.log(`Usar: ${cotiz.paraFac.linea}`);

// Ejemplo: validar si una cotización custom es aceptable
const { valida, razon } = validarCotizacion(
  1400,        // Cotización que quiero usar
  1345.50,     // Cotización oficial de AFIP
  'N'          // Cancela en pesos (tolerante)
);

if (valida) {
  console.log('✅ Cotización aceptable');
} else {
  console.error('❌ Cotización rechazada:', razon);
}
```

---

## 📝 **EJEMPLO COMPLETO: GENERAR .FAC CON COTIZACIÓN CORRECTA**

```typescript
import { consultarCotizacionAfip } from './modules/facturacion/cotizacionHelper';
import * as fs from 'fs';

async function generarFacEnDolares() {
  // 1) Consultar cotización oficial de AFIP
  const cotiz = await consultarCotizacionAfip({
    moneda: 'DOL',
    fecha: '20251002',  // Fecha del comprobante
    canMisMonExt: 'N'   // Cancela en pesos
  });
  
  console.log(`Usando cotización: ${cotiz.cotizOficial}`);
  console.log(`Rango tolerado: [${cotiz.rangoTolerado.min}, ${cotiz.rangoTolerado.max}]`);
  
  // 2) Construir archivo .fac
  const facContent = `DIAHORA:02/10/25 12:00:00 yp52
IP:192.168.48.190
TIPO:6
FONDO:C:\\1_OLDFacturador\\MiFondo-pagado.jpg
COPIAS:0
CLIENTE:(000000)CONSUMIDOR FINAL
TIPODOC:99
NRODOC:
CONDICION:CONSUMIDOR FINAL
IVARECEPTOR:5
DOMICILIO:MENDOZA(CIUDAD) Tel:
MONEDA:DOLARES
${cotiz.paraFac.linea}
${cotiz.paraFac.cancelaMismaMoneda || ''}
ITEM:
     1  PRODUCTO DE EJEMPLO                     10.00                  10.00
TOTALES:
NETO 21%  :        8.26
NETO 10.5%:        0.00
EXENTO    :        0.00
IVA 21%   :        1.74
IVA 10.5% :        0.00
TOTAL     :       10.00
OBS.FISCAL:
Comprobante expresado en DOLARES, cotizacion: ${cotiz.cotizOficial.toFixed(2)}
OBS.PIE:
** GRACIAS POR SU COMPRA **
`;
  
  // 3) Guardar .fac
  const facPath = 'C:\\tmp\\25100212000000.fac';
  fs.writeFileSync(facPath, facContent, 'utf8');
  
  console.log(`✅ Archivo .fac generado: ${facPath}`);
  console.log(`Total en pesos: USD 10.00 × $${cotiz.cotizOficial} = $${(10 * cotiz.cotizOficial).toFixed(2)}`);
}

generarFacEnDolares().catch(console.error);
```

---

## ⚠️ **VALIDACIONES Y ERRORES COMUNES**

### **Error 1: Cotización fuera de rango (CanMisMonExt=N)**

```javascript
// AFIP oficial: $1,345.50
// Intentas usar: $1,200.00 (5.4% menos que la oficial)

// ❌ ERROR: PERMANENT_COTIZ_OUT_OF_RANGE
// Rango permitido: [1278.23, 2421.90]
// $1,200 < $1,278.23 → RECHAZADO
```

**Solución:** Usar cotización dentro del rango tolerado o la oficial directamente.

---

### **Error 2: Cotización inexacta (CanMisMonExt=S)**

```javascript
// AFIP oficial día hábil anterior: $1,340.00
// Intentas usar: $1,345.50

// ❌ ERROR: PERMANENT_COTIZ_EXACT_MISMATCH
// Para CANCELA_MISMA_MONEDA:S debe usar EXACTAMENTE $1,340.00
```

**Solución:** Usar **exactamente** la cotización del día hábil anterior.

---

### **Error 3: Moneda no válida**

```javascript
// Intentas usar: 'USD' (código incorrecto)

// ❌ ERROR: MonId inválido
// Monedas válidas: 'PES', 'DOL', 'EUR'
```

**Solución:** Usar código correcto (`DOL` no `USD`).

---

## 📊 **DIAGRAMA DE FLUJO**

```
┌─────────────────────────────────────────┐
│  Usuario quiere facturar en dólares    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ¿Cancela en misma moneda?              │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
   SÍ (S)          NO (N)
       │               │
       │               │
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ Cotización   │  │ Cotización   │
│ día hábil    │  │ del DÍA      │
│ ANTERIOR     │  │ (HOY)        │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Política:    │  │ Política:    │
│ EXACTA       │  │ TOLERANTE    │
│ (±0%)        │  │ (-5%, +80%)  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Consultar AFIP        │
    │ FEParamGetCotizacion  │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Generar .fac con      │
    │ COTIZADOL:xxxxx       │
    └───────────┬───────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Sistema procesa .fac  │
    │ y emite a AFIP        │
    └───────────────────────┘
```

---

## 🎯 **RESUMEN EJECUTIVO**

| **Escenario**           | **Tag .fac**                  | **Cotización a usar**          | **Flexibilidad**      |
|-------------------------|-------------------------------|--------------------------------|-----------------------|
| Cancela en **PESOS**    | `CANCELA_MISMA_MONEDA:N`      | Del **DÍA de emisión**         | -5% a +80%            |
| Cancela en **DÓLARES**  | `CANCELA_MISMA_MONEDA:S`      | Del **día hábil ANTERIOR**     | Exacta (±0%)          |

---

## 📞 **SOPORTE**

Si tienes dudas sobre qué cotización usar:

1. **Consulta PRIMERO con el comando CLI** antes de generar el `.fac`
2. **Valida que tu cotización esté en el rango** usando `validarCotizacion()`
3. **Revisa los logs** `[FACT] FE Moneda` para confirmar qué cotización usó el sistema

**Logs clave:**
```javascript
[FACT] FE Moneda {
  monId: 'DOL',
  canMisMonExt: 'N',
  policy: { selection: 'tolerant', maxUpPercent: 80, maxDownPercent: 5 },
  monCotiz: 1400,        // La que se usó finalmente
  oficial: 1345.50,      // La que informó AFIP
  fuente: 'COTIZADOL',   // 'COTIZADOL' (del .fac) o 'WSFE' (de AFIP)
  fchOficial: '20251002'
}
```

---

## ✅ **VALIDACIÓN FINAL**

Antes de emitir, verificar:

- ✅ Cotización consultada a AFIP antes de generar `.fac`
- ✅ `COTIZADOL:` tiene valor dentro del rango tolerado
- ✅ Si `CANCELA_MISMA_MONEDA:S`, cotización es del día hábil anterior
- ✅ Log `[FACT] FE Moneda` muestra `fuente: 'COTIZADOL'` o `fuente: 'WSFE'`
- ✅ AFIP acepta el comprobante y devuelve CAE

---

**Documento actualizado:** 02/10/2025  
**Autor:** Sistema de facturación MP  
**Versión:** 1.0

