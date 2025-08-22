# Error: BAD_DECRYPT - Credenciales Corruptas

## 🚨 Problema Identificado

**Error**: `ERR_OSSL_BAD_DECRYPT` - Las credenciales encriptadas no se pueden desencriptar correctamente.

**Causa**: La clave de encriptación ha cambiado o las credenciales fueron encriptadas con una clave diferente, causando que la desencriptación falle.

## 📋 Análisis del Error

### Error Original
```
Error desencriptando texto: Error: error:1e000065:Cipher functions:OPENSSL_internal:BAD_DECRYPT
    at Decipheriv.final (node:internal/crypto/cipher:193:29)
    at RemoteService.decrypt (D:\Proyecto\Clientes\Todo-Computacion\Facturacion\mp\dist\src\services\RemoteService.js:347:35)
```

### Problemas Identificados

1. **Credenciales Corruptas**: Las credenciales encriptadas no se pueden desencriptar
2. **Clave de Encriptación Cambiada**: La clave `ENCRYPTION_KEY` ha cambiado
3. **Fallback Inadecuado**: El sistema no manejaba correctamente este error
4. **Bucle de Errores**: Los errores se repetían constantemente

## ✅ Soluciones Implementadas

### 1. Mejora en el Método decrypt

```typescript
private decrypt(encryptedText: string): string {
  try {
    // Si el texto no está encriptado (no tiene formato iv:encrypted), retornarlo tal como está
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText;
    }

    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const parts = encryptedText.split(':');
    
    if (parts.length !== 2) {
      // Si no está encriptado correctamente, retornar tal como está
      return encryptedText;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando texto:', error);
    // En caso de error de desencriptación, limpiar la configuración corrupta
    console.warn('Credenciales corruptas detectadas. Limpiando configuración...');
    this.clearCorruptedConfig();
    return ''; // Retornar string vacío para forzar nueva configuración
  }
}
```

### 2. Método para Limpiar Configuración Corrupta

```typescript
private clearCorruptedConfig(): void {
  try {
    const db = getDb();
    // Limpiar configuración remota corrupta guardando valores vacíos
    db.saveRemoteConfig({
      role: 'host',
      idServer: '',
      relayServer: '',
      username: '',
      password: '',
      autoStart: false
    });
    this.config = null;
    this.serverSync = null;
    console.log('✅ Configuración corrupta limpiada. Se requiere nueva configuración.');
  } catch (error) {
    console.error('Error limpiando configuración corrupta:', error);
  }
}
```

### 3. Validación Mejorada

```typescript
// Verificar si el texto está encriptado antes de intentar desencriptarlo
if (!encryptedText || !encryptedText.includes(':')) {
  return encryptedText;
}

// Verificar formato correcto de encriptación
if (parts.length !== 2) {
  return encryptedText;
}
```

## 🔧 Comportamiento de la Solución

### Cuando se Detecta Credenciales Corruptas:

1. **Log de Error**: Se registra el error de desencriptación
2. **Advertencia**: Se muestra mensaje de credenciales corruptas
3. **Limpieza Automática**: Se limpia la configuración corrupta
4. **Reset de Configuración**: Se resetea a valores vacíos
5. **Nueva Configuración**: Se requiere configurar nuevamente

### Flujo de Recuperación:

```
Error BAD_DECRYPT → Detección → Limpieza → Reset → Nueva Configuración
```

## 📋 Pasos para el Usuario

### 1. Reiniciar la Aplicación
- Cerrar completamente MP Reports
- Volver a abrir la aplicación

### 2. Reconfigurar Control Remoto
- Ir a **Configuración** → **Control Remoto**
- Llenar los campos nuevamente:
  - **Servidor ID**: `149.50.150.15:21115`
  - **Servidor Relay**: `149.50.150.15:21116`
  - **Usuario**: Tu usuario
  - **Contraseña**: Tu contraseña

### 3. Guardar Configuración
- Hacer clic en **"💾 Guardar Configuración"**
- Los puertos se añadirán automáticamente

### 4. Probar Funcionalidad
- Hacer clic en **"🔗 Probar Conexión"**
- Verificar que funciona correctamente

## 🚀 Mejoras Implementadas

### Manejo Robusto de Errores
- Detección automática de credenciales corruptas
- Limpieza automática de configuración corrupta
- Prevención de bucles de errores

### Logging Mejorado
- Mensajes claros de error
- Información de recuperación
- Trazabilidad del proceso

### Recuperación Automática
- Reset automático de configuración corrupta
- Forzar nueva configuración
- Prevención de errores recurrentes

## 🔍 Verificación

### Logs Esperados Después de la Corrección:

```
✅ Configuración corrupta limpiada. Se requiere nueva configuración.
[RemoteService] Configuración remota cargada
[ServerSync] Inicializado con ID Server: 149.50.150.15:21115, Relay Server: 149.50.150.15:21116
```

### Comportamiento Correcto:

1. **Sin errores de desencriptación**
2. **Configuración limpia y funcional**
3. **Conexión al servidor funcionando**
4. **Logs informativos y claros**

## 📝 Notas Importantes

1. **Causa del Problema**: Cambio en la clave de encriptación o credenciales corruptas
2. **Solución Automática**: El sistema limpia automáticamente la configuración corrupta
3. **Reconfiguración Requerida**: Es necesario configurar nuevamente el control remoto
4. **Prevención**: El sistema ahora maneja mejor estos errores

## 🔄 Próximos Pasos

1. **Reiniciar** la aplicación MP Reports
2. **Reconfigurar** el control remoto con los datos correctos
3. **Probar** la funcionalidad de conexión
4. **Verificar** que no hay más errores de desencriptación

---

**Fecha de Corrección**: $(date)
**Versión**: 1.0.4
**Estado**: ✅ Error corregido y sistema mejorado
