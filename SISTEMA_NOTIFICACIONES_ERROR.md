# 🚨 **Sistema de Notificaciones de Error Inteligente**

## 🎯 **Descripción General**

El sistema de notificaciones de error implementa una lógica inteligente para evitar el spam de emails y proporcionar información útil sobre errores recurrentes del sistema.

## 🔧 **Características Principales**

### **1. Agrupación Inteligente de Errores**
- **Agrupa errores similares** por tipo y mensaje
- **Evita duplicados** en las notificaciones
- **Mantiene contadores** de ocurrencias

### **2. Escalación Progresiva**
- **1er Aviso**: Error detectado (después de X ocurrencias)
- **2do Aviso**: Error persiste (después de 1 hora)
- **3er Aviso**: Error crítico (después de 2 horas)
- **Máximo 3 avisos** por tipo de error

### **3. Configuración Flexible**
- **Habilitar/Deshabilitar** notificaciones
- **Mínimo de errores** antes de notificar (1-10)
- **Tiempo entre notificaciones** (15-1440 minutos)

## 📧 **Formato del Email**

### **Asunto del Email**
```
🚨 Sistema MP - Alertas de Error - [Primer/Segundo/Tercer] Aviso
```

### **Contenido del Email**
```
🚨 **SISTEMA MP - REPORTE DE ERRORES**

⚠️ **PRIMER AVISO:** Se han detectado errores recurrentes en el sistema que requieren atención.

📊 **RESUMEN DEL ERROR:**
• **Tipo de Error:** MP_CONFIG
• **Ocurrencias:** 5 veces
• **Período:** 2 horas
• **Notificación:** 1 de 3

📋 **DETALLES DE LOS ERRORES:**
1. Error de configuración Mercado Pago | {"message":"❌ Error: Comprobar la cuenta..."}
2. Error de configuración Mercado Pago | {"message":"❌ Error: Comprobar la cuenta..."}

⏰ **INFORMACIÓN TEMPORAL:**
• **Primera ocurrencia:** 15/01/2024, 10:30:15
• **Última ocurrencia:** 15/01/2024, 12:30:45
• **Tiempo transcurrido:** 2 horas, 0 minutos

🔧 **ACCIONES RECOMENDADAS:**
1. Revisar los logs del sistema en C:\2_mp\logs\
2. Verificar la configuración de Mercado Pago
3. Comprobar la conectividad de red
4. Revisar el estado del servidor FTP

📞 **CONTACTO:**
Si el problema persiste después del tercer aviso, contacte al soporte técnico.

---
*Este es un mensaje automático del Sistema MP*
*Generado el: 15/01/2024, 12:30:45*
```

## ⚙️ **Configuración en Modo Administración**

### **Ubicación**
- **Sección**: "🚨 Notificaciones de Error"
- **Acceso**: Modo Administración → Configuración

### **Opciones Disponibles**

#### **1. Configuración Básica**
- ✅ **Habilitar notificaciones de error por email**
- 📊 **Mínimo errores antes de notificar** (1-10)
- ⏰ **Tiempo entre notificaciones** (15-1440 minutos)

#### **2. Estado Actual**
- 📈 **Errores totales**: Contador de errores registrados
- 📊 **Grupos activos**: Tipos de errores diferentes
- 📧 **Notificaciones enviadas**: Emails enviados

#### **3. Acciones de Mantenimiento**
- 💾 **Guardar Configuración**: Aplicar cambios
- 🧹 **Limpiar Errores Antiguos**: Eliminar errores >24h
- 🔄 **Resetear Todo**: Limpiar todo el historial

## 🔍 **Tipos de Errores Registrados**

### **1. Errores de Mercado Pago**
- **Tipo**: `MP_CONFIG`
- **Descripción**: Problemas con Access Token o configuración
- **Ejemplo**: "Error de configuración Mercado Pago"

### **2. Errores de FTP**
- **Tipo**: `FTP_CONFIG`
- **Descripción**: Configuración FTP incompleta
- **Ejemplo**: "Configuración FTP incompleta"

### **3. Errores de Archivos**
- **Tipo**: `FTP_FILE`
- **Descripción**: Archivos DBF no encontrados
- **Ejemplo**: "Archivo DBF no encontrado"

### **4. Errores de Autenticación**
- **Tipo**: `AUTH_ERROR`
- **Descripción**: Problemas de login o configuración
- **Ejemplo**: "Error en inicio de sesión"

## 📊 **Lógica de Funcionamiento**

### **Flujo de Notificación**

```
1. Error ocurre → Se registra en el sistema
2. Se agrupa con errores similares
3. Se incrementa el contador
4. Si alcanza el mínimo configurado:
   - Verifica tiempo desde última notificación
   - Si es la primera vez → Envía 1er aviso
   - Si ya se envió → Espera el tiempo configurado
5. Si persiste → Envía 2do aviso (después de 1 hora)
6. Si continúa → Envía 3er aviso (después de 2 horas)
7. Después del 3er aviso → No envía más
```

### **Condiciones para Enviar Email**

```typescript
const shouldNotify = 
  group.count >= config.minErrorsBeforeNotify &&           // Mínimo errores alcanzado
  group.notificationCount < config.maxNotificationsPerError && // No exceder máximo
  timeSinceLastNotification >= minTimeMs;                  // Tiempo suficiente transcurrido
```

## 🛠️ **Configuración por Defecto**

```typescript
{
  enabled: true,                    // Habilitado por defecto
  minErrorsBeforeNotify: 3,         // 3 errores antes de notificar
  minTimeBetweenNotifications: 60,  // 1 hora entre notificaciones
  maxNotificationsPerError: 3,      // Máximo 3 emails por error
  emailSubject: '🚨 Sistema MP - Alertas de Error'
}
```

## 📁 **Almacenamiento de Datos**

### **Ubicación**
- **Archivo**: `error-notifications.json`
- **Directorio**: `%APPDATA%/error-notifications/`

### **Estructura de Datos**
```json
{
  "config": {
    "enabled": true,
    "minErrorsBeforeNotify": 3,
    "minTimeBetweenNotifications": 60,
    "maxNotificationsPerError": 3,
    "emailSubject": "🚨 Sistema MP - Alertas de Error"
  },
  "errorGroups": {
    "MP_CONFIG:Error de configuración Mercado Pago": {
      "count": 5,
      "firstSeen": 1705312215000,
      "lastSeen": 1705319445000,
      "messages": ["Error de configuración Mercado Pago | {...}"],
      "notificationCount": 1,
      "lastNotification": 1705319445000
    }
  }
}
```

## 🔄 **Limpieza Automática**

### **Errores Antiguos**
- **Criterio**: Errores no vistos en las últimas 24 horas
- **Acción**: Eliminación automática
- **Frecuencia**: Al limpiar manualmente o cada 10 logs

### **Reseteo Manual**
- **Acción**: Elimina todo el historial de errores
- **Uso**: Para reiniciar el sistema de notificaciones
- **Confirmación**: Requiere confirmación del usuario

## 🎯 **Beneficios del Sistema**

### **Para Administradores**
- **Alertas proactivas** sobre problemas del sistema
- **Información estructurada** y fácil de entender
- **Escalación automática** sin intervención manual
- **Prevención de spam** con límites inteligentes

### **Para Soporte Técnico**
- **Contexto completo** de los errores
- **Historial temporal** de ocurrencias
- **Acciones recomendadas** incluidas
- **Información de contacto** para escalación

### **Para el Sistema**
- **Monitoreo automático** de errores críticos
- **Agrupación inteligente** para evitar ruido
- **Persistencia de datos** para análisis
- **Configuración flexible** según necesidades

## 🔧 **Integración con el Sistema**

### **Registro Automático**
El sistema registra automáticamente errores en:
- **Generación de reportes** (errores de MP)
- **Operaciones FTP** (errores de conexión/archivos)
- **Autenticación** (errores de login/configuración)
- **Sistema general** (errores críticos)

### **Logs Integrados**
- **Logs de error** se escriben en `C:\2_mp\logs\errors.log`
- **Notificaciones** se registran en el log principal
- **Configuración** se persiste en `electron-store`

---

**✅ El sistema de notificaciones de error está diseñado para ser inteligente, útil y no intrusivo, proporcionando información valiosa sin saturar el email del administrador.**
