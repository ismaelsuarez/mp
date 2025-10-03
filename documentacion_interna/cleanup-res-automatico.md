# 🗂️ Limpieza Automática de Archivos `.res`

## 📋 Resumen

Sistema de limpieza automática de archivos `.res` antiguos para liberar espacio en disco.

**✅ Compatible con Electron Build:** El script se compila a JavaScript y funciona correctamente en la aplicación empaquetada.

---

## ⚙️ Configuración

### **Parámetros por defecto:**
- **Días a retener:** 60 días
- **Carpetas afectadas:** `done/` y `out/`
- **Carpeta protegida:** `processing/` (nunca se limpia)

---

## 🔧 Uso Manual

### **Modo simulación (dry-run):**
```bash
npm run cleanup:res:dry
```
**Resultado:** Muestra qué archivos se eliminarían SIN borrarlos realmente.

### **Modo real (eliminación):**
```bash
npm run cleanup:res
```
**Resultado:** Elimina archivos `.res` mayores a 60 días.

---

## 🎯 Uso desde UI (Futuro)

Se puede agregar un botón en la UI de Administración para ejecutar la limpieza:

```typescript
// Ejemplo de uso desde renderer
const result = await window.api.caja.cleanupRes({ 
  daysToKeep: 60,  // Personalizable
  dryRun: false    // true = simulación, false = eliminación real
});

console.log(`Archivos eliminados: ${result.deleted}`);
console.log(`Espacio liberado: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
```

---

## 📊 Ejemplo de salida

### **Simulación (dry-run):**
```
[cleanup-res] Iniciando limpieza de archivos .res > 60 días
[cleanup-res] Fecha límite: 2024-12-03T00:00:00.000Z
[cleanup-res] Modo: DRY-RUN (simulación)
[cleanup-res] [DRY-RUN] Eliminando: 1116155b.res (2024-10-02, 2048 bytes)
[cleanup-res] [DRY-RUN] Eliminando: 1227122a.res (2024-10-02, 2134 bytes)
[cleanup-res] Completado: 2 archivos eliminados (0.00 MB liberados)
```

### **Ejecución real:**
```
[cleanup-res] Iniciando limpieza de archivos .res > 60 días
[cleanup-res] Fecha límite: 2024-12-03T00:00:00.000Z
[cleanup-res] Modo: ELIMINACIÓN REAL
[cleanup-res] Eliminando: 1116155b.res (2024-10-02, 2048 bytes)
[cleanup-res] Eliminando: 1227122a.res (2024-10-02, 2134 bytes)
[cleanup-res] Completado: 2 archivos eliminados (0.00 MB liberados)
```

---

## ⚠️ Consideraciones Importantes

### **✅ Seguridad:**
- Solo borra de `done/` y `out/`
- NUNCA toca `processing/` (archivos en proceso)
- Solo elimina archivos `.res` (ignora otros)
- Verifica edad por fecha de modificación

### **📁 Carpetas del sistema:**
```
C:\Users\[Usuario]\AppData\Roaming\Tc-Mp\fac\
  ├── processing\  ❌ NO SE TOCA (protegido)
  ├── done\        ✅ Se limpia (archivos > 60 días)
  └── out\         ✅ Se limpia (archivos > 60 días)
```

### **🔄 Automatización (Futuro):**
Se puede configurar para ejecutar automáticamente:
- Cada semana (recomendado)
- Al iniciar la aplicación
- Manualmente desde UI Admin

---

## 🛡️ Respaldo y Legal

### **Antes de ejecutar limpieza:**
- ✅ Verificar que el sistema legacy tiene toda la información
- ✅ Confirmar que `.res` fueron enviados por FTP exitosamente
- ✅ Mantener backups de la base de datos (obligatorio 5 años - Ley 11.683)

### **Recomendación:**
Los archivos `.res` son **redundantes** después de:
1. Envío exitoso por FTP al sistema legacy
2. Guardado en base de datos
3. Reportes descargados de ARCA/AFIP

**Por lo tanto, 60 días es un período seguro de retención.**

---

## 📈 Estimación de Espacio

| Volumen | Espacio/día | Espacio/mes | Espacio/60 días |
|---------|-------------|-------------|-----------------|
| 100 facturas/día | ~300 KB | ~9 MB | ~18 MB |
| 500 facturas/día | ~1.5 MB | ~45 MB | ~90 MB |
| 1000 facturas/día | ~3 MB | ~90 MB | ~180 MB |

---

## 🔧 Personalización

Para cambiar los días de retención:

```typescript
// Desde código
await window.api.caja.cleanupRes({ daysToKeep: 90 });

// Desde terminal
# Editar scripts/cleanup-res.ts y cambiar:
const daysToKeep = options.daysToKeep || 60;  // ← Cambiar 60 por el valor deseado
```

---

## ✅ Checklist antes de ejecutar

- [ ] Confirmar que el sistema legacy tiene todos los `.res` enviados
- [ ] Verificar que la base de datos tiene registro de todas las facturas
- [ ] Ejecutar primero en modo `dry-run` para ver qué se eliminaría
- [ ] Si es la primera vez, considerar borrar archivos > 90 días (más conservador)
- [ ] Monitorear logs durante la primera ejecución

---

## 📞 Soporte

Si hay dudas o problemas:
1. Ejecutar primero en modo `dry-run`
2. Revisar logs en consola
3. Verificar que no se estén eliminando archivos recientes
4. Consultar con el equipo de soporte si hay incertidumbre

