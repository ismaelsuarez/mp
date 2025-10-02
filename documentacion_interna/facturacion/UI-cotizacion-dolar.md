# 💵 INDICADOR DE COTIZACIÓN DÓLAR EN LA UI

## 📍 **UBICACIÓN**

El indicador de cotización del dólar aparece en **"Modo Caja"** (`caja.html`):

```
┌─────────────────────────────────────────────────┐
│  🏠  💰  🧾  [Tabs de navegación]        ⚙️    │  ← Barra superior
├─────────────────────────────────────────────────┤
│                                                 │
│  [Contenido principal de la pestaña actual]    │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  🟢                          ┌───────────────┐  │
│  ARCA                        │ 🟢 Dólar AFIP:│  │  ← Esquina inferior derecha
│                              │ $1,345.50 —   │  │
│                              │ 14:30    🔄   │  │
└──────────────────────────────└───────────────┘──┘
     ↑                              ↑
  Indicador ARCA              INDICADOR DÓLAR
  (Izquierda)                 (Derecha) - NUEVO
```

---

## 🎨 **ASPECTO VISUAL**

El indicador aparece como una **"pill" (cápsula)** en la esquina inferior derecha:

### **Estado: OK (Verde)**
```
┌────────────────────────────┐
│ 🟢 Dólar AFIP: $1,345.50   │
│    14:30              🔄    │
└────────────────────────────┘
```

### **Estado: Cache (Amarillo)**
```
┌────────────────────────────┐
│ 🟡 Dólar AFIP: $1,345.50   │
│    cache              🔄    │
└────────────────────────────┘
```

### **Estado: Error (Gris)**
```
┌────────────────────────────┐
│ ⚪ Dólar AFIP: ERROR        │
│                       🔄    │
└────────────────────────────┘
```

---

## 🔄 **FUNCIONALIDAD**

### **Actualización automática:**
- ✅ Consulta a AFIP al cargar la página
- ✅ Se actualiza **cada 10 minutos** automáticamente
- ✅ Muestra la hora de la última actualización

### **Botón de refresh manual:**
- ✅ Click en el icono 🔄 para forzar una actualización inmediata
- ✅ Muestra "Consultando..." mientras carga

### **Caché inteligente:**
- ✅ Guarda la última cotización en `localStorage`
- ✅ Si AFIP no responde, muestra el valor en caché (estado amarillo)
- ✅ Incluye rango tolerado para validaciones posteriores

---

## 🔧 **CÓMO USARLO**

### **Para ver la cotización:**
1. Abrir la aplicación
2. Ir a **"Modo Caja"** (icono 💰)
3. Esperar 1-2 segundos mientras consulta a AFIP
4. Ver el valor en la esquina inferior derecha

### **Para actualizar manualmente:**
1. Click en el icono **🔄** dentro del indicador
2. Esperar la nueva cotización

### **Para copiar el valor:**
1. Ver la cotización en el indicador
2. Usar ese valor en tu archivo `.fac`:
   ```
   MONEDA:DOLARES
   COTIZADOL:1345.50    ← Copiar este valor
   ```

---

## 📊 **DATOS QUE MUESTRA**

| **Campo**       | **Descripción**                                      | **Ejemplo**       |
|-----------------|------------------------------------------------------|-------------------|
| Cotización      | Valor oficial de AFIP para el dólar                  | `$1,345.50`       |
| Hora            | Momento de la última actualización exitosa           | `14:30`           |
| Estado          | Visual: 🟢 OK, 🟡 Cache, ⚪ Error                    | 🟢                |
| Botón refresh   | Icono 🔄 para actualizar manualmente                 | 🔄                |

---

## 💾 **DATOS GUARDADOS EN CACHE**

Cuando la consulta es exitosa, se guarda en `localStorage`:

```javascript
{
  "v": 1345.50,         // Valor cotización
  "t": 1727884800000,   // Timestamp (ms)
  "f": "20251002",      // Fecha cotización (YYYYMMDD)
  "min": 1278.225,      // Rango mínimo tolerado (-5%)
  "max": 2421.90        // Rango máximo tolerado (+80%)
}
```

**Uso del caché:**
- ✅ Si AFIP está caído, muestra el último valor conocido
- ✅ Permite validar si una cotización custom está en rango
- ✅ Persiste entre reinicios de la aplicación

---

## 🚀 **PRÓXIMAS MEJORAS SUGERIDAS**

### **Tooltip al pasar el mouse:**
```
Cotización oficial AFIP
━━━━━━━━━━━━━━━━━━━━━
Valor: $1,345.50
Fecha: 02/10/2025
Hora: 14:30

Rango tolerado:
  Min: $1,278.23 (-5%)
  Max: $2,421.90 (+80%)

🔄 Click para actualizar
```

### **Click para copiar:**
```javascript
// Al hacer click en el valor:
navigator.clipboard.writeText('1345.50');
// Mostrar toast: "Cotización copiada: $1,345.50"
```

### **Selector de moneda:**
```
┌────────────────────────────┐
│ [DOL ▼] $1,345.50   14:30 │
│              🔄            │
└────────────────────────────┘
```

---

## 📝 **CÓDIGO DE IMPLEMENTACIÓN**

### **HTML (public/caja.html - línea 83-91):**
```html
<!-- Indicador de cotización Dólar AFIP -->
<div id="pillDol" class="fixed bottom-4 right-4 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-lg hidden">
    <div class="flex items-center gap-2">
        <span id="pillDolState" class="inline-block w-2 h-2 rounded-full bg-slate-500"></span>
        <span id="pillDolText" class="text-xs font-mono text-slate-200">Dólar (AFIP) = -- — --:--</span>
        <button id="pillDolRefresh" class="text-slate-400 hover:text-slate-200 text-xs ml-2" title="Actualizar cotización">
            🔄
        </button>
    </div>
</div>
```

### **JavaScript (public/caja.html - línea 104-157):**
```javascript
async function fetchDol(){
    const result = await window.electron.ipcRenderer.invoke('facturacion:cotizacion:consultar', {
        moneda: 'DOL',
        canMisMonExt: 'N'  // Cotización del día (para operaciones en pesos)
    });
    
    if (result.ok && result.data) {
        const { cotizOficial } = result.data;
        pillText.textContent = `Dólar AFIP: $${fmt(cotizOficial)} — ${hhmm}`;
        setState('ok');
        pill.classList.remove('hidden');
    }
}

// Actualización automática cada 10 minutos
setInterval(fetchDol, 10*60*1000);
```

---

## ✅ **VALIDACIÓN**

Para verificar que funciona:

1. **Abrir la aplicación:** `npm start`
2. **Ir a "Modo Caja"**
3. **Abrir la consola del desarrollador** (F12)
4. **Buscar el log:**
   ```javascript
   [caja] consultando cotización DOL a AFIP...
   [caja] cotización OK: 1345.5
   ```
5. **Verificar que aparece el indicador** en la esquina inferior derecha

---

**Documento actualizado:** 02/10/2025  
**Ubicación:** `public/caja.html`  
**IPC utilizado:** `facturacion:cotizacion:consultar`

