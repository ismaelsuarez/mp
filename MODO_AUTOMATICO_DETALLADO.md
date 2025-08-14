# MODO AUTOMÁTICO - FUNCIONAMIENTO DETALLADO

## RESUMEN EJECUTIVO

El **Modo Automático** del proyecto MP es un sistema de programación temporal que ejecuta reportes de Mercado Pago de forma automática en intervalos configurados. Permite la generación y envío automático de reportes sin intervención manual del usuario.

---

## ARQUITECTURA DEL SISTEMA AUTOMÁTICO

### 1. COMPONENTES PRINCIPALES

#### 1.1 Configuración de Automatización
- **Variable:** `AUTO_INTERVAL_SECONDS` (segundos entre ejecuciones)
- **Ubicación:** Sección "Automatización" en la interfaz de configuración
- **Persistencia:** Almacenada en `electron-store` encriptado

#### 1.2 Control de Estado
- **Variables de Estado:**
  - `autoTimer`: Referencia al timer activo
  - `autoActive`: Estado booleano de activación
- **Ubicación:** `src/main.ts` (proceso principal)

#### 1.3 Interfaz de Usuario
- **Configuración:** `public/config.html` - Sección "Automatización"
- **Indicador:** `src/caja.ts` - Badge de estado en modo caja
- **Controles:** Botones "Activar" y "Desactivar"

---

## FLUJO DE FUNCIONAMIENTO

### 1. CONFIGURACIÓN INICIAL

```typescript
// En src/main.ts - Líneas 269-271
const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
if (!Number.isFinite(intervalSec) || intervalSec <= 0) return false;
```

**Proceso:**
1. Usuario configura `AUTO_INTERVAL_SECONDS` en la interfaz
2. Valor se valida (debe ser número positivo)
3. Configuración se guarda en `electron-store`

### 2. ACTIVACIÓN DEL MODO AUTOMÁTICO

```typescript
// En src/main.ts - Función startAutoTimer()
async function startAutoTimer() {
    stopAutoTimer();
    const cfg: any = store.get('config') || {};
    const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
    if (!Number.isFinite(intervalSec) || intervalSec <= 0) return false;
    
    autoTimer = setInterval(async () => {
        // Lógica de ejecución automática
    }, Math.max(1000, intervalSec * 1000));
    autoActive = true;
    return true;
}
```

**Proceso de Activación:**
1. **Validación:** Verifica que el intervalo sea válido
2. **Limpieza:** Detiene cualquier timer activo
3. **Creación:** Establece nuevo `setInterval`
4. **Estado:** Marca `autoActive = true`

### 3. EJECUCIÓN AUTOMÁTICA

```typescript
// En src/main.ts - Líneas 272-295
autoTimer = setInterval(async () => {
    try {
        // 1. Consulta de pagos
        const { payments, range } = await searchPaymentsWithConfig();
        const tag = new Date().toISOString().slice(0, 10);
        
        // 2. Generación de archivos
        const result = await generateFiles(payments as any[], tag, range);
        
        // 3. Notificación de FTP
        if (mainWindow) mainWindow.webContents.send('auto-report-notice', { 
            info: 'Enviando mp.dbf por FTP…' 
        });
        
        // 4. Envío FTP automático
        try {
            const mpPath = (result as any)?.files?.mpDbfPath;
            if (mpPath && fs.existsSync(mpPath)) {
                const { sendDbf } = await import('./services/FtpService');
                await sendDbf(mpPath, 'mp.dbf');
            }
        } catch (e) {
            if (mainWindow) mainWindow.webContents.send('auto-report-notice', { 
                error: `FTP: ${String((e as any)?.message || e)}` 
            });
        }
        
        // 5. Notificación a UI
        if (mainWindow) {
            const uiRows = (payments as any[]).slice(0, 1000).map((p: any) => ({
                id: p?.id,
                status: p?.status,
                amount: p?.transaction_amount,
                date: p?.date_created,
                method: p?.payment_method_id
            }));
            mainWindow.webContents.send('auto-report-notice', { 
                when: new Date().toISOString(), 
                count: (payments as any[]).length, 
                rows: uiRows.slice(0,8) 
            });
        }
    } catch (e: any) {
        if (mainWindow) mainWindow.webContents.send('auto-report-notice', { 
            error: String(e?.message || e) 
        });
    }
}, Math.max(1000, intervalSec * 1000));
```

**Secuencia de Ejecución:**
1. **Consulta API:** Llama a `searchPaymentsWithConfig()`
2. **Generación:** Crea archivos con `generateFiles()`
3. **FTP:** Envía automáticamente `mp.dbf` si está configurado
4. **Notificación:** Informa a la UI del resultado
5. **Logs:** Registra actividad en logs diarios

### 4. DESACTIVACIÓN

```typescript
// En src/main.ts - Función stopAutoTimer()
function stopAutoTimer() {
    if (autoTimer) { 
        clearInterval(autoTimer); 
        autoTimer = null; 
    }
    autoActive = false;
}
```

**Proceso de Desactivación:**
1. **Limpieza:** Cancela el timer activo
2. **Estado:** Marca `autoActive = false`
3. **Memoria:** Libera referencia del timer

---

## INTERFACES DE USUARIO

### 1. CONFIGURACIÓN (config.html)

```html
<!-- En public/config.html - Líneas 90-103 -->
<details class="group mb-4 border border-slate-700 rounded-md">
    <summary class="cursor-pointer px-3 py-2 bg-slate-800 rounded-t-md text-sm font-semibold select-none">
        Automatización
    </summary>
    <div class="p-3 space-y-2">
        <label>Intervalo (segundos)
            <input id="AUTO_INTERVAL_SECONDS" type="number" placeholder="3600" />
        </label>
        <div class="row">
            <button type="button" id="btnAutoStart">Activar</button>
            <button type="button" id="btnAutoStop">Desactivar</button>
            <span id="autoStatus"></span>
        </div>
    </div>
</details>
```

**Elementos de Interfaz:**
- **Input:** `AUTO_INTERVAL_SECONDS` - Intervalo en segundos
- **Botón Activar:** `btnAutoStart` - Inicia automatización
- **Botón Desactivar:** `btnAutoStop` - Detiene automatización
- **Indicador:** `autoStatus` - Muestra estado actual

### 2. MODO CAJA (caja.ts)

```typescript
// En src/caja.ts - Función setAutoIndicator()
function setAutoIndicator(active: boolean) {
    const el = document.getElementById('autoIndicatorCaja');
    if (!el) return;
    el.textContent = active ? 'Modo automático: ON' : 'Modo automático: OFF';
    el.className = 'px-3 py-1 rounded text-sm border ' + 
        (active ? 'bg-emerald-700/30 text-emerald-300 border-emerald-600' : 
                 'bg-rose-700/30 text-rose-300 border-rose-600');
}
```

**Indicador Visual:**
- **ON:** Verde con texto "Modo automático: ON"
- **OFF:** Rojo con texto "Modo automático: OFF"
- **Ubicación:** Esquina inferior izquierda en modo caja

---

## COMUNICACIÓN IPC

### 1. HANDLERS EN MAIN PROCESS

```typescript
// En src/main.ts - Líneas 297-310
ipcMain.handle('auto-start', async () => {
    const ok = await startAutoTimer();
    return { ok };
});

ipcMain.handle('auto-stop', async () => {
    stopAutoTimer();
    return { ok: true };
});

ipcMain.handle('auto-status', async () => {
    return { active: autoActive };
});
```

**Handlers Disponibles:**
- **`auto-start`:** Activa el modo automático
- **`auto-stop`:** Desactiva el modo automático
- **`auto-status`:** Consulta estado actual

### 2. PRELOAD BRIDGE

```typescript
// En src/preload.ts - Líneas 25-33
async autoStart() {
    return await ipcRenderer.invoke('auto-start');
},
async autoStop() {
    return await ipcRenderer.invoke('auto-stop');
},
async autoStatus() {
    return await ipcRenderer.invoke('auto-status');
},
onAutoNotice(callback: (payload: any) => void) {
    ipcRenderer.on('auto-report-notice', (_e, payload) => callback(payload));
},
```

**API Expuesta:**
- **`autoStart()`:** Inicia automatización
- **`autoStop()`:** Detiene automatización
- **`autoStatus()`:** Obtiene estado
- **`onAutoNotice()`:** Escucha notificaciones automáticas

### 3. NOTIFICACIONES AUTOMÁTICAS

```typescript
// En src/main.ts - Evento auto-report-notice
mainWindow.webContents.send('auto-report-notice', payload);
```

**Tipos de Notificación:**
- **`{ info: string }`:** Información general
- **`{ error: string }`:** Error ocurrido
- **`{ count: number, rows: array }`:** Resultado de ejecución
- **`{ when: string }`:** Timestamp de ejecución

---

## CONFIGURACIÓN Y PERSISTENCIA

### 1. ALMACENAMIENTO

```typescript
// En src/renderer.ts - buildConfigFromForm()
AUTO_INTERVAL_SECONDS: (el.AUTO_INTERVAL_SECONDS as HTMLInputElement)?.value ? 
    Number((el.AUTO_INTERVAL_SECONDS as HTMLInputElement).value) : undefined,
```

**Configuración Guardada:**
- **`AUTO_INTERVAL_SECONDS`:** Intervalo en segundos
- **Ubicación:** `electron-store` encriptado
- **Persistencia:** Entre sesiones de la aplicación

### 2. RESTAURACIÓN AUTOMÁTICA

```typescript
// En src/main.ts - Líneas 318-320
const cfg0: any = store.get('config') || {};
if (Number(cfg0.AUTO_INTERVAL_SECONDS || 0) > 0) {
    startAutoTimer().catch(()=>{});
}
```

**Comportamiento:**
- Al iniciar la aplicación, verifica si hay automatización configurada
- Si `AUTO_INTERVAL_SECONDS > 0`, inicia automáticamente
- Maneja errores silenciosamente para no bloquear el inicio

---

## MANEJO DE ERRORES

### 1. VALIDACIÓN DE CONFIGURACIÓN

```typescript
// Validación de intervalo
const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
if (!Number.isFinite(intervalSec) || intervalSec <= 0) return false;
```

**Validaciones:**
- **Tipo:** Debe ser número válido
- **Rango:** Debe ser mayor a 0
- **Mínimo:** Intervalo mínimo de 1 segundo

### 2. MANEJO DE EXCEPCIONES

```typescript
// En el setInterval - try/catch principal
try {
    // Lógica de ejecución
} catch (e: any) {
    if (mainWindow) mainWindow.webContents.send('auto-report-notice', { 
        error: String(e?.message || e) 
    });
}
```

**Manejo de Errores:**
- **Captura:** Errores en consulta API
- **Captura:** Errores en generación de archivos
- **Captura:** Errores en envío FTP
- **Notificación:** Informa errores a la UI
- **Continuidad:** No detiene el timer por errores

### 3. LOGS DE ERRORES

```typescript
// En src/main.ts - Logs automáticos
appendLogLine('auto-execution', { 
    success: true, 
    count: payments.length, 
    error: null 
});
```

**Registro de Actividad:**
- **Éxito:** Cantidad de transacciones procesadas
- **Error:** Mensaje de error específico
- **Timestamp:** Fecha y hora de ejecución
- **Ubicación:** Archivo de log diario

---

## INTEGRACIÓN CON SERVICIOS

### 1. SERVICIO MERCADO PAGO

```typescript
// Llamada a searchPaymentsWithConfig()
const { payments, range } = await searchPaymentsWithConfig();
```

**Integración:**
- **Configuración:** Usa configuración guardada
- **Filtros:** Aplica filtros de fecha y estado
- **Paginación:** Maneja grandes volúmenes de datos
- **Zona Horaria:** Respeta configuración de TZ

### 2. SERVICIO DE REPORTES

```typescript
// Generación de archivos
const result = await generateFiles(payments as any[], tag, range);
```

**Archivos Generados:**
- **CSV:** `transactions-YYYY-MM-DD.csv`
- **XLSX:** `transactions-full-YYYY-MM-DD.xlsx`
- **DBF:** `transactions-detailed-YYYY-MM-DD.dbf`
- **JSON:** `balance-YYYY-MM-DD.json`

### 3. SERVICIO FTP

```typescript
// Envío automático de DBF
const mpPath = (result as any)?.files?.mpDbfPath;
if (mpPath && fs.existsSync(mpPath)) {
    const { sendDbf } = await import('./services/FtpService');
    await sendDbf(mpPath, 'mp.dbf');
}
```

**Envío Automático:**
- **Archivo:** `mp.dbf` (versión simplificada)
- **Condición:** Solo si FTP está configurado
- **Error Handling:** No detiene ejecución si falla

### 4. SERVICIO DE EMAIL

**Nota:** El modo automático NO envía emails automáticamente. Solo genera archivos y envía DBF por FTP.

---

## CONFIGURACIÓN RECOMENDADA

### 1. INTERVALOS SUGERIDOS

| Uso | Intervalo | Descripción |
|-----|-----------|-------------|
| **Pruebas** | 300 segundos (5 min) | Desarrollo y testing |
| **Parciales** | 3600 segundos (1 hora) | Reportes intermedios |
| **Diario** | 86400 segundos (24 horas) | Reporte diario completo |

### 2. CONFIGURACIÓN COMPLETA

```typescript
// Configuración recomendada
{
    AUTO_INTERVAL_SECONDS: 3600,  // 1 hora
    MP_TZ: "America/Argentina/Buenos_Aires",
    MP_RANGE: "date_last_updated",
    MP_STATUS: "approved",
    FTP_IP: "servidor.ftp.com",
    FTP_USER: "usuario",
    FTP_PASS: "contraseña",
    FTP_DIR: "/reportes"
}
```

### 3. MONITOREO

**Indicadores de Funcionamiento:**
- **Badge en Caja:** Verde = Activo, Rojo = Inactivo
- **Logs:** Archivo diario con ejecuciones
- **Archivos:** Generación en `C:\2_mp\reportes\`
- **FTP:** Envío automático de `mp.dbf`

---

## TROUBLESHOOTING

### 1. PROBLEMAS COMUNES

#### Automatización no inicia
```bash
# Verificar configuración
- AUTO_INTERVAL_SECONDS > 0
- Configuración guardada correctamente
- Logs sin errores críticos
```

#### Errores de FTP
```bash
# Verificar configuración FTP
- FTP_IP, FTP_USER, FTP_PASS configurados
- Servidor FTP accesible
- Permisos de escritura en directorio
```

#### Archivos no se generan
```bash
# Verificar API Mercado Pago
- MP_ACCESS_TOKEN válido
- Conexión a internet
- Filtros de fecha apropiados
```

### 2. DIAGNÓSTICO

```typescript
// Verificar estado actual
const status = await window.api.autoStatus();
console.log('Estado automático:', status.active);

// Verificar configuración
const config = await window.api.getConfig();
console.log('Intervalo configurado:', config.AUTO_INTERVAL_SECONDS);
```

### 3. LOGS DE DIAGNÓSTICO

```bash
# Ubicación de logs
logs/YYYY-MM-DD.log

# Contenido relevante
[timestamp] auto-execution: { success: true, count: 150 }
[timestamp] auto-execution: { success: false, error: "API timeout" }
```

---

## CONSIDERACIONES TÉCNICAS

### 1. RENDIMIENTO

**Optimizaciones:**
- **Intervalo mínimo:** 1 segundo (previene sobrecarga)
- **Paginación:** Máximo 100 páginas por consulta
- **Memoria:** Limpieza automática de timers
- **UI:** Notificaciones asíncronas

### 2. SEGURIDAD

**Medidas:**
- **Configuración encriptada:** `electron-store` con clave AES
- **Validación de entrada:** Números positivos únicamente
- **Manejo de errores:** No expone información sensible
- **Permisos:** Acceso limitado a directorios específicos

### 3. CONFIABILIDAD

**Características:**
- **Persistencia:** Restauración automática al reiniciar
- **Recuperación:** Continúa funcionando tras errores
- **Logs:** Registro completo de actividad
- **Notificaciones:** Feedback en tiempo real

---

## CONCLUSIÓN

El **Modo Automático** del proyecto MP proporciona una solución robusta para la generación programada de reportes de Mercado Pago. Su arquitectura modular, manejo de errores robusto y integración completa con los servicios del sistema lo convierten en una herramienta confiable para automatizar procesos de reportes.

**Puntos Clave:**
- **Configuración flexible:** Intervalos personalizables
- **Integración completa:** API, archivos, FTP
- **Monitoreo en tiempo real:** UI y logs
- **Recuperación automática:** Persistencia entre sesiones
- **Manejo robusto de errores:** Continuidad operativa

El sistema está diseñado para funcionar de manera autónoma, requiriendo mínima intervención manual una vez configurado correctamente.
