# Módulo Banco Galicia - Documentación

## 📋 Descripción General

El módulo Banco Galicia permite integrar el sistema con la API del Banco Galicia para:
- Consultar saldos de cuentas
- Obtener movimientos bancarios
- Crear y gestionar cobranzas
- Monitorear el estado de las cobranzas

## 🏗️ Arquitectura

### Backend (Node.js/Electron)
- **Servicio**: `src/services/GaliciaService.ts`
- **Handlers IPC**: Integrados en `src/main.ts`
- **Configuración**: Variables de entorno en `.env`

### Frontend (HTML/JavaScript)
- **Configuración**: Sección en `public/config.html`
- **Interfaz**: `public/galicia.html`
- **Estilos**: Tailwind CSS (consistente con el proyecto)

## ⚙️ Configuración

### Variables de Entorno

Agregar al archivo `.env`:

```env
# ========================================
# CONFIGURACIÓN BANCO GALICIA
# ========================================
GALICIA_APP_ID=tu_app_id_aqui
GALICIA_APP_KEY=tu_app_key_aqui
GALICIA_CERT_PATH=C:/certs/galicia/cert.pem
GALICIA_KEY_PATH=C:/certs/galicia/key.pem
GALICIA_ENVIRONMENT=sandbox
```

### Parámetros de Configuración

| Parámetro | Descripción | Requerido | Ejemplo |
|-----------|-------------|-----------|---------|
| `GALICIA_APP_ID` | ID de aplicación proporcionado por Galicia | ✅ | `galicia_app_123` |
| `GALICIA_APP_KEY` | Clave de aplicación proporcionada por Galicia | ✅ | `secret_key_456` |
| `GALICIA_CERT_PATH` | Ruta al certificado público (.pem) | ✅ | `C:/certs/cert.pem` |
| `GALICIA_KEY_PATH` | Ruta a la clave privada (.pem) | ✅ | `C:/certs/key.pem` |
| `GALICIA_ENVIRONMENT` | Entorno de la API | ✅ | `sandbox` o `production` |

## 🔧 Instalación y Configuración

### 1. Obtener Credenciales de Galicia
- Contactar al Banco Galicia para obtener acceso a la API
- Solicitar App ID y App Key
- Obtener certificados SSL (.pem)

### 2. Configurar Certificados
```bash
# Crear directorio para certificados
mkdir -p C:/certs/galicia

# Copiar certificados
cp cert.pem C:/certs/galicia/
cp key.pem C:/certs/galicia/
```

### 3. Configurar Variables de Entorno
- Copiar `env.example` a `.env`
- Completar las variables de Galicia
- Verificar rutas de certificados

### 4. Probar Conexión
```bash
# Ejecutar script de prueba
node scripts/test-galicia.js
```

## 🚀 Uso del Módulo

### Acceso desde Configuración
1. Abrir la aplicación
2. Ir a **Configuración**
3. Buscar la sección **🏦 Banco Galicia**
4. Completar credenciales
5. Probar conexión
6. Hacer clic en **"Abrir módulo Galicia"**

### Funcionalidades Disponibles

#### 📊 Consulta de Saldos
- Muestra saldos disponibles y contables
- Soporte para múltiples cuentas
- Formato de moneda argentino

#### 📋 Movimientos de Cuenta
- Lista de transacciones de los últimos 30 días
- Scroll con encabezados fijos
- Formato de importes con signos

#### 📝 Gestión de Cobranzas
- **Crear cobranza**: Formulario con cliente, monto y vencimiento
- **Listar cobranzas**: Tabla con estado (pendiente/pagada/vencida)
- **Estados visuales**: Colores diferenciados por estado

## 🔌 API Endpoints

### Handlers IPC Disponibles

| Handler | Descripción | Parámetros | Respuesta |
|---------|-------------|------------|-----------|
| `galicia:get-saldos` | Obtener saldos de cuenta | - | `{success, data: Saldo[]}` |
| `galicia:get-movimientos` | Obtener movimientos | - | `{success, data: Movimiento[]}` |
| `galicia:crear-cobranza` | Crear nueva cobranza | `{cliente, monto, vencimiento}` | `{success, data: {id}}` |
| `galicia:get-cobros` | Obtener listado de cobranzas | - | `{success, data: Cobranza[]}` |
| `galicia:test-connection` | Probar conexión | - | `{success, message}` |

### Estructuras de Datos

#### Saldo
```typescript
interface GaliciaSaldo {
    cuenta: string;           // Número de cuenta
    moneda: string;           // Código de moneda (ARS, USD)
    saldoDisponible: string;  // Saldo disponible formateado
    saldoContable: string;    // Saldo contable formateado
}
```

#### Movimiento
```typescript
interface GaliciaMovimiento {
    fecha: string;        // Fecha (YYYY-MM-DD)
    descripcion: string;  // Descripción de la transacción
    importe: string;      // Importe formateado con signo
    saldo: string;        // Saldo después de la transacción
}
```

#### Cobranza
```typescript
interface GaliciaCobranza {
    id: string;           // ID único de la cobranza
    cliente: string;      // Nombre del cliente
    monto: number;        // Monto en pesos
    vencimiento: string;  // Fecha de vencimiento
    estado: 'pendiente' | 'pagada' | 'vencida';
}
```

## 🧪 Testing

### Script de Pruebas
```bash
# Ejecutar pruebas completas
node scripts/test-galicia.js
```

### Pruebas Incluidas
- ✅ Autenticación con la API
- ✅ Obtención de saldos
- ✅ Obtención de movimientos
- ✅ Creación de cobranzas
- ✅ Listado de cobranzas
- ✅ Manejo de errores

### Datos de Prueba
El script incluye datos simulados para testing:
- 2 cuentas con saldos en ARS y USD
- 3 movimientos de ejemplo
- 3 cobranzas con diferentes estados

## 🔒 Seguridad

### Autenticación
- **Método**: OAuth2 Client Credentials
- **Certificados**: SSL mutuo (cert.pem + key.pem)
- **Tokens**: Renovación automática
- **Timeout**: 30 segundos por request

### Almacenamiento
- **Credenciales**: Encriptadas en electron-store
- **Tokens**: En memoria (no persistentes)
- **Logs**: Errores registrados en sistema de logs

## 📝 Logging

### Niveles de Log
- **Info**: Operaciones exitosas
- **Warning**: Reintentos y timeouts
- **Error**: Errores de conexión y autenticación

### Ejemplos de Logs
```
[Galicia] Autenticación exitosa
[Galicia] Saldos obtenidos: 2 cuentas
[Galicia] Movimientos obtenidos: 15 transacciones
[Galicia] Cobranza creada exitosamente: C1703123456789
[Galicia] Error de autenticación: Token expirado
```

## 🐛 Troubleshooting

### Problemas Comunes

#### Error de Autenticación
```
Error: Faltan credenciales de Galicia (AppID o AppKey)
```
**Solución**: Verificar que `GALICIA_APP_ID` y `GALICIA_APP_KEY` estén configurados.

#### Error de Certificados
```
Error: Error al leer certificados: ENOENT
```
**Solución**: Verificar que las rutas `GALICIA_CERT_PATH` y `GALICIA_KEY_PATH` sean correctas.

#### Error de Conexión
```
Error: No se pudo autenticar con Galicia
```
**Solución**: 
1. Verificar credenciales
2. Comprobar conectividad a internet
3. Verificar que el entorno sea correcto (sandbox/production)

#### Token Expirado
```
Error: Token expirado
```
**Solución**: El sistema renueva automáticamente los tokens. Si persiste, reiniciar la aplicación.

### Comandos de Diagnóstico

```bash
# Verificar configuración
node -e "const Store = require('electron-store'); const store = new Store(); console.log(store.get('config'))"

# Probar conexión
node scripts/test-galicia.js

# Ver logs
tail -f logs/today.log | grep Galicia
```

## 🔄 Actualizaciones

### Versión 1.0.0
- ✅ Integración básica con API Galicia
- ✅ Consulta de saldos y movimientos
- ✅ Gestión de cobranzas
- ✅ Interfaz de usuario completa
- ✅ Sistema de logging y errores

### Próximas Funcionalidades
- 🔄 Paginación en movimientos
- 🔄 Filtros por fecha
- 🔄 Exportación de datos
- 🔄 Notificaciones automáticas
- 🔄 Integración con facturación

## 📞 Soporte

### Contacto
- **Email**: pc@tcmza.com.ar
- **Documentación**: Ver archivos en `docs/doc_modo_admin/`

### Recursos Adicionales
- [API Documentation Galicia](https://developers.galicia.com.ar)
- [Guía de Certificados SSL](https://www.galicia.com.ar/empresas/soluciones-digitales/api)
- [Soporte Técnico Galicia](https://www.galicia.com.ar/empresas/contacto)

---

**Nota**: Este módulo requiere credenciales oficiales del Banco Galicia. Contactar al banco para obtener acceso a la API de desarrollo y producción.
