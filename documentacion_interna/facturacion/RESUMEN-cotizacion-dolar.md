# 📋 RESUMEN: CONSULTA DE COTIZACIÓN DEL DÓLAR

## 🚨 **SITUACIÓN ACTUAL**

El SDK de AFIP que usas (`sdk/afip.ts-main`) **NO tiene implementado** el método para consultar cotizaciones de monedas extranjeras.

### ❌ **Lo que NO funciona:**
- Consulta automática desde la UI
- IPC `facturacion:cotizacion:consultar` 
- Fallback a ARCA (responde HTML vacío)

### ✅ **Lo que SÍ funciona:**
- **Facturar en dólares/euros** (solo necesitas pasar la cotización como parámetro)
- **Consulta manual por terminal** usando: `npm run cotizacion -- --moneda DOL`

---

## 💡 **CÓMO USAR AHORA**

### **Paso 1: Consultar cotización manualmente**

En la terminal, ejecuta:

```bash
cd c:\Users\Ismael\Desktop\Desarrollo\mp
npm run cotizacion -- --moneda DOL
```

**Salida esperada:**
```
🔄 Consultando cotización a AFIP/ARCA...

❌ ERROR: No se pudo obtener cotización de AFIP: getCurrencyQuotation no disponible en SDK local

Uso:
  npm run cotizacion -- --moneda DOL
  ...
```

**NOTA:** Este comando también fallará porque el SDK no lo soporta.

---

### **Paso 2: Obtener cotización de otra fuente**

Como el SDK no soporta consulta de cotización, debes obtenerla de:

1. **Banco Nación:** https://www.bna.com.ar/Cotizador/MonedasHistorico
2. **AFIP manual:** https://www.afip.gob.ar/Genericos/Cotizaciones/
3. **Tu banco/fuente confiable**

---

### **Paso 3: Generar el .fac con la cotización**

Una vez que tengas la cotización (ejemplo: $1,400.00), genera tu `.fac`:

```
DIAHORA:02/10/25 12:00:00 yp52
IP:192.168.48.190
TIPO:6
FONDO:C:\1_OLDFacturador\MiFondo-pagado.jpg
COPIAS:0
CLIENTE:(000000)CONSUMIDOR FINAL
TIPODOC:99
NRODOC:
CONDICION:CONSUMIDOR FINAL
IVARECEPTOR:5
DOMICILIO:MENDOZA(CIUDAD) Tel:
MONEDA:DOLARES
COTIZADOL:1400.00    ← ⚠️ INGRESAR MANUALMENTE
ITEM:
     1  PRODUCTO EJEMPLO                        10.00                  10.00
TOTALES:
NETO 21%  :        8.26
IVA 21%   :        1.74
TOTAL     :       10.00
```

---

## 🎯 **RANGO TOLERADO POR AFIP**

AFIP acepta cotizaciones dentro de este rango:

- **Mínimo:** Cotización oficial × 0.95 (-5%)
- **Máximo:** Cotización oficial × 1.80 (+80%)

**Ejemplo:** Si la cotización oficial es $1,345.50:
- Mínimo aceptado: $1,278.23
- Máximo aceptado: $2,421.90

---

## 📍 **INDICADOR EN LA UI**

En "Modo Caja" aparecerá un indicador que dice:

```
┌────────────────────────────────┐
│ 🟡 Dólar: Consultar manualmente│
│                           🔄   │
└────────────────────────────────┘
```

**Al pasar el mouse** verás:
```
El SDK de AFIP no soporta consulta de cotización.
Usa: npm run cotizacion -- --moneda DOL
en la terminal para consultar.
```

---

## 🔧 **SOLUCIONES FUTURAS**

### **Opción A: Actualizar el SDK**
Buscar un SDK de AFIP que SÍ tenga el método `FEParamGetCotizacion` implementado.

### **Opción B: Implementar consulta SOAP directa**
Crear un cliente SOAP custom que consulte directamente a:
```
https://servicios1.afip.gov.ar/wsfev1/service.asmx
Método: FEParamGetCotizacion
```

### **Opción C: API externa**
Usar una API externa confiable (Banco Nación, DolarAPI, etc.) para obtener la cotización.

---

## ✅ **VALIDACIÓN FINAL**

Antes de facturar en dólares:

1. ✅ Obtener cotización de fuente confiable
2. ✅ Verificar que esté dentro del rango tolerado por AFIP
3. ✅ Ingresar en `COTIZADOL:` del archivo `.fac`
4. ✅ Verificar que el sistema procese correctamente
5. ✅ Verificar que AFIP acepte el comprobante

---

## 📚 **DOCUMENTACIÓN RELACIONADA**

- `documentacion_interna/facturacion/cotizacion-moneda-extranjera.md` - Guía completa (parcialmente obsoleta)
- `scripts/get-cotizacion-afip.ts` - Script CLI (no funciona porque SDK no lo soporta)
- `src/modules/facturacion/cotizacionHelper.ts` - Helper (no funciona porque SDK no lo soporta)

---

**Fecha:** 02/10/2025  
**Estado:** SDK de AFIP NO soporta consulta de cotización  
**Workaround:** Consulta manual + ingreso manual en `.fac`

