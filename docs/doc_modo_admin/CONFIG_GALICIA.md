# Configuración del Módulo Banco Galicia

## 📋 **Descripción General**

El módulo Banco Galicia permite integrar la aplicación con la API de Banco Galicia para:
- Consultar saldos de cuentas
- Obtener movimientos bancarios
- Crear y gestionar cobranzas
- Verificar el estado de pagos

## 🔐 **Seguridad y Almacenamiento**

### **Configuración Segura**
- Las credenciales se almacenan de forma **encriptada** usando `electron-store`
- Se utiliza la misma clave de encriptación que el resto del sistema
- Los datos sensibles **NO** se almacenan en archivos `.env`
- Todas las configuraciones se realizan desde el **modo administrador**

### **Datos Protegidos**
- `GALICIA_APP_ID`: ID de aplicación de Galicia
- `GALICIA_APP_KEY`: Clave secreta de aplicación
- `GALICIA_CERT_PATH`: Ruta al certificado público (.pem)
- `GALICIA_KEY_PATH`: Ruta a la clave privada (.pem)

## ⚙️ **Configuración desde el Modo Administrador**

### **1. Acceder a la Configuración**
1. Abrir la aplicación
2. Ir al **Modo Administrador** (config.html)
3. Buscar la sección **"🏦 Banco Galicia"**
4. Expandir la sección haciendo clic en el título

### **2. Configurar Credenciales**

#### **App ID y App Key**
- **App ID**: Ingresar el ID de aplicación proporcionado por Banco Galicia
- **App Key**: Ingresar la clave secreta (se puede mostrar/ocultar con el botón 👁)

#### **Certificados MSSL (Mutual SSL)**
- **Certificado (.pem)**: Ruta al archivo de certificado público
- **Clave privada (.pem)**: Ruta al archivo de clave privada

> **Nota**: Los certificados son **requeridos** para el entorno de producción. Para sandbox pueden estar vacíos.

#### **Entorno**
- **Sandbox**: Para pruebas y desarrollo
- **Producción**: Para uso real con clientes

### **3. Probar Conexión**
1. Hacer clic en **"Probar conexión Galicia"**
2. Verificar que aparezca **"✅ Conexión exitosa"**
3. Si hay errores, revisar las credenciales y rutas de certificados

### **4. Guardar Configuración**
1. Hacer clic en **"💾 Guardar configuración"**
2. Verificar que aparezca el mensaje de confirmación

## 🔧 **Configuración Técnica**

### **Variables de Configuración**
```typescript
interface GaliciaConfig {
    appId: string;           // GALICIA_APP_ID
    appKey: string;          // GALICIA_APP_KEY
    certPath: string;        // GALICIA_CERT_PATH
    keyPath: string;         // GALICIA_KEY_PATH
    environment: 'sandbox' | 'production';  // GALICIA_ENVIRONMENT
}
```

### **URLs de la API**
- **Sandbox**: `https://sandbox-api.galicia.ar`
- **Producción**: `https://api.galicia.ar`

### **Autenticación**
- **Método**: OAuth2 Client Credentials
- **Tokens**: JWT (Access Token + Refresh Token)
- **Certificados**: MSSL para producción
- **Timeout**: 30 segundos

## 📊 **Funcionalidades Disponibles**

### **1. Consulta de Saldos**
- **Endpoint**: `/api/v1/accounts/balances`
- **Datos**: Saldo disponible y saldo contable por cuenta
- **Moneda**: ARS (Pesos Argentinos)

### **2. Movimientos de Cuenta**
- **Endpoint**: `/api/v1/accounts/transactions`
- **Datos**: Historial de transacciones
- **Formato**: Fecha, descripción, importe, saldo

### **3. Gestión de Cobranzas**
- **Crear**: POST `/api/v1/collections`
- **Consultar**: GET `/api/v1/collections`
- **Estados**: Pendiente, Pagada, Vencida

## 🧪 **Modo Sandbox**

### **Datos Simulados**
Cuando se configura el entorno como **"Sandbox"**, el sistema devuelve datos simulados:

#### **Saldos Simulados**
```json
[
    {
        "cuenta": "001-123456/7",
        "moneda": "ARS",
        "saldoDisponible": "$ 250.000,00",
        "saldoContable": "$ 260.000,00"
    }
]
```

#### **Movimientos Simulados**
```json
[
    {
        "fecha": "2025-01-20",
        "descripcion": "Transferencia recibida",
        "importe": "+ $ 50.000,00",
        "saldo": "$ 250.000,00"
    }
]
```

#### **Cobranzas Simuladas**
```json
[
    {
        "id": "101",
        "cliente": "Cliente A",
        "monto": "$ 30.000,00",
        "estado": "pendiente",
        "fechaCreacion": "2025-01-15",
        "fechaVencimiento": "2025-02-15"
    }
]
```

## 🔍 **Solución de Problemas**

### **Error: "AppID y AppKey son requeridos"**
- Verificar que se hayan ingresado las credenciales
- Guardar la configuración antes de probar

### **Error: "Certificado no encontrado"**
- Verificar que la ruta del certificado sea correcta
- En sandbox, las rutas pueden estar vacías

### **Error: "Error de autenticación"**
- Verificar que las credenciales sean correctas
- Comprobar que el entorno esté bien configurado
- Revisar la conectividad a internet

### **Error: "Error de conexión"**
- Verificar la conectividad a internet
- Comprobar que no haya firewall bloqueando
- Revisar los logs del sistema

## 📝 **Logs y Auditoría**

### **Logs de Información**
- Autenticación exitosa
- Consultas realizadas
- Datos obtenidos

### **Logs de Error**
- Errores de autenticación
- Fallos en consultas
- Problemas de conectividad

### **Notificaciones de Error**
- Errores críticos se registran en el sistema de notificaciones
- Se pueden consultar desde el modo administrador

## 🔄 **Actualización de Configuración**

### **Cambios Inmediatos**
- Las configuraciones se aplican inmediatamente al guardar
- No requiere reiniciar la aplicación
- Los cambios se persisten automáticamente

### **Validación**
- Se valida la existencia de archivos de certificados
- Se verifica el formato de las credenciales
- Se comprueba la conectividad antes de guardar

## 📚 **Referencias**

- [Documentación Open Galicia](https://www.galicia.ar/content/dam/galicia/banco-galicia/empresas/open-galicia/catalogoopengalicia.pdf)
- [Portal de Desarrolladores](https://developers.galicia.ar)
- [Soporte Técnico](mailto:soporte@galicia.ar)

---

**Nota**: Este módulo está diseñado para funcionar de forma segura y confiable, siguiendo las mejores prácticas de seguridad y el patrón de configuración del sistema.
