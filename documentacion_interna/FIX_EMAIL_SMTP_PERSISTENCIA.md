# Fix: Persistencia de configuración Email/SMTP

**Fecha:** 17 de octubre de 2025  
**Prioridad:** 🔴 URGENTE (Requerido por cliente)  
**Estado:** ✅ IMPLEMENTADO

---

## 📋 Problema Reportado

El cliente reportó que la configuración de Email/SMTP **NO se estaba persistiendo** en la UI de configuración (`config.html`), causando errores de autenticación al intentar enviar emails:

```
❌ Email falló | Invalid login: 535-5.7.8 Username and Password not accepted
```

**Causa raíz:**
- Los campos de Email/SMTP no tenían un botón específico para guardar
- La configuración no se cargaba automáticamente al abrir la UI
- El botón general "Guardar configuración" no incluía estos campos explícitamente

---

## ✅ Solución Implementada

### 1️⃣ **Handler IPC en `src/main.ts` (líneas 940-956)**

Agregado handler `test-email-smtp` para probar el envío de emails:

```typescript
ipcMain.handle('test-email-smtp', async () => {
    try {
        const cfg = store.get('config') as any || {};
        const to = cfg.EMAIL_REPORT;
        if (!to) return { ok: false, error: 'Email para reportes no configurado' };
        if (!cfg.SMTP_USER || !cfg.SMTP_PASS) return { ok: false, error: 'Usuario o contraseña SMTP no configurados' };
        
        // Enviar email de prueba simple
        const subject = 'Prueba de configuración SMTP - TODO-COMPUTACIÓN';
        const text = `Este es un email de prueba para verificar la configuración SMTP.\n\nFecha: ${new Date().toLocaleString('es-AR')}\n\nSi recibiste este mensaje, la configuración es correcta.`;
        const sent = await sendReportEmail(subject, text, []);
        return { ok: sent, message: sent ? 'Email de prueba enviado correctamente' : 'Error al enviar email' };
    } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
    }
});
```

**Funcionalidad:**
- Valida que `EMAIL_REPORT`, `SMTP_USER` y `SMTP_PASS` estén configurados
- Envía un email de prueba simple al destinatario configurado
- Retorna `{ ok: true/false, message/error }` para feedback en UI

---

### 2️⃣ **Exponer handler en `src/preload.ts` (líneas 20-22)**

```typescript
async testEmailSmtp() {
    return await ipcRenderer.invoke('test-email-smtp');
},
```

---

### 3️⃣ **UI en `public/config.html`**

#### **A) Botones de acción (líneas 311-316)**

```html
<!-- Botones de acción -->
<div class="flex items-center gap-2 flex-wrap">
    <button type="button" id="btnSaveSmtp" class="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white border-0 hover:bg-emerald-500">
        💾 Guardar Email/SMTP
    </button>
    <button type="button" id="btnTestSmtp" class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white border-0 hover:bg-blue-500">
        📧 Probar envío
    </button>
    <span id="smtpStatus" class="text-xs text-slate-400"></span>
</div>
```

#### **B) Código JavaScript (líneas 2156-2274)**

**Funcionalidades implementadas:**
1. **Carga automática** de configuración al abrir la UI
2. **Toggle de contraseña** (👁 / 🙈) para ver/ocultar `SMTP_PASS`
3. **Botón "Guardar Email/SMTP":** Persiste los valores en `electron-store`
4. **Botón "Probar envío":** Envía email de prueba y muestra feedback visual

**Código clave:**
```javascript
// Cargar configuración al iniciar
const res = await window.api.getConfig();
set('EMAIL_REPORT', cfg.EMAIL_REPORT);
set('SMTP_HOST', cfg.SMTP_HOST);
set('SMTP_PORT', cfg.SMTP_PORT);
set('SMTP_USER', cfg.SMTP_USER);
set('SMTP_PASS', cfg.SMTP_PASS);

// Guardar configuración
const payload = {
    EMAIL_REPORT: get('EMAIL_REPORT')?.value || '',
    SMTP_HOST: get('SMTP_HOST')?.value || '',
    SMTP_PORT: get('SMTP_PORT')?.value || '',
    SMTP_USER: get('SMTP_USER')?.value || '',
    SMTP_PASS: get('SMTP_PASS')?.value || '',
};
const base = await window.api.getConfig();
await window.api.saveConfig({ ...(base||{}), ...payload });

// Probar envío
const result = await window.api.testEmailSmtp();
if (result?.ok) {
    statusEl.textContent = '✅ Email enviado correctamente';
} else {
    statusEl.textContent = `❌ ${result?.error || 'Error al enviar'}`;
}
```

---

## 🎯 Flujo de Usuario

### **1. Configurar Email/SMTP**
1. Abrir **Modo Administrador** → **Email / SMTP**
2. Completar:
   - **Email para reportes:** `correo@dominio.com`
   - **Servidor SMTP:** `smtp.gmail.com` (o el que corresponda)
   - **Puerto:** `587` (STARTTLS) o `465` (SSL)
   - **Usuario:** `tu_email@dominio.com`
   - **Contraseña:** Tu contraseña o **App Password** (Gmail requiere App Password si tienes 2FA)
3. Click en **💾 Guardar Email/SMTP**
4. Verificar mensaje: `✅ Guardado correctamente`

### **2. Probar configuración**
1. Click en **📧 Probar envío**
2. Esperar mensaje: `Enviando email de prueba...`
3. Verificar resultado:
   - ✅ **Éxito:** `✅ Email enviado correctamente`
   - ❌ **Error:** `❌ Invalid login: 535-5.7.8...` (revisar usuario/contraseña)

### **3. Revisar email de prueba**
El email enviado tendrá:
- **Asunto:** "Prueba de configuración SMTP - TODO-COMPUTACIÓN"
- **Cuerpo:**
  ```
  Este es un email de prueba para verificar la configuración SMTP.

  Fecha: 17/10/2025 11:30:45

  Si recibiste este mensaje, la configuración es correcta.
  ```

---

## 🔧 Configuraciones SMTP Comunes

### **Gmail (con App Password recomendado)**
- **Host:** `smtp.gmail.com`
- **Puerto:** `587` (STARTTLS)
- **Usuario:** `tu_email@gmail.com`
- **Contraseña:** App Password generado en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### **Outlook/Hotmail**
- **Host:** `smtp-mail.outlook.com`
- **Puerto:** `587`
- **Usuario:** `tu_email@outlook.com`
- **Contraseña:** Tu contraseña de Outlook

### **Gmail (usuario/contraseña directo - menos seguro)**
- **Host:** `smtp.gmail.com`
- **Puerto:** `587`
- **Usuario:** `tu_email@gmail.com`
- **Contraseña:** Tu contraseña (requiere "Acceso a apps menos seguras" habilitado)
- ⚠️ **Nota:** Gmail puede bloquear esto si tienes 2FA

### **Servidor SMTP personalizado**
- **Host:** IP o dominio del servidor SMTP
- **Puerto:** Consultar con proveedor (común: `25`, `587`, `465`)
- **Usuario:** Según proveedor
- **Contraseña:** Según proveedor

---

## ✅ Validaciones Implementadas

1. ✅ **Persistencia:** Los valores se guardan en `electron-store` encriptado
2. ✅ **Carga automática:** Se cargan al abrir la UI de configuración
3. ✅ **Toggle de contraseña:** Permite ver/ocultar la contraseña SMTP
4. ✅ **Prueba de envío:** Valida la configuración con un email real
5. ✅ **Feedback visual:** Muestra estado de guardado y envío en tiempo real
6. ✅ **Compatible con Electron compilado:** Funciona en desarrollo y producción

---

## 📊 Archivos Modificados

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `src/main.ts` | Handler IPC `test-email-smtp` | 940-956 |
| `src/preload.ts` | Exponer `testEmailSmtp()` | 20-22 |
| `public/config.html` | Botones + Script de carga/guardado/prueba | 311-316, 2156-2274 |

---

## 🚀 Próximos Pasos

1. ✅ Compilar con Electron Builder
2. ✅ Desplegar actualización al cliente
3. ⏳ Cliente configura Email/SMTP
4. ⏳ Cliente prueba envío
5. ⏳ Confirmar que los reportes automáticos funcionan correctamente

---

**Estado:** ✅ LISTO PARA PRODUCCIÓN  
**Responsable:** AI Assistant  
**Revisado por:** Usuario (Ismael)  
**Versión:** 1.0.26+

