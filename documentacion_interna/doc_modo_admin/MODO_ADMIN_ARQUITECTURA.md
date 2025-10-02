# Modo Administrador — Arquitectura técnica (UI + Backend)

## Resumen ejecutivo
El **Modo Administrador** (`config.html`) es el centro de control de la aplicación, donde se configuran:
- Credenciales de servicios externos (Mercado Pago, FTP, Email, Galicia)
- Automatización de procesos (intervalos, días, disparadores)
- Seguridad (contraseñas, perfiles de acceso)
- Exportación y visualización de resultados
- Servidor FTP integrado (recepción de archivos)
- Perfiles de configuración (multi-usuario)

---

## Alcance
- **Objetivo**: describir la arquitectura completa del Modo Administrador, sus secciones, flujos de configuración, seguridad, IPC handlers y criterios de QA.
- **Ámbito**: `public/config.html` (UI), `src/renderer.ts` (lógica frontend), `src/preload.ts` (bridge IPC), `src/main.ts` (handlers backend), servicios (`AuthService`, `FtpService`, `EmailService`, `MercadoPagoService`, `GaliciaService`, etc.).

---

## Componentes y responsabilidades

### **UI (config.html)**
Archivo: `public/config.html`

#### **Estructura de pestañas**:
1. **Configuración** (principal):
   - 🧩 Perfiles de Configuración
   - 💰 Mercado Pago
   - 📤 FTP (Cliente saliente)
   - 📥 FTP Server (Servidor entrante)
   - 📧 Email / SMTP
   - ⚙️ Automatización
   - 🔐 Seguridad
   - 🏦 Banco Galicia
   - 🔔 Notificaciones de Error
   - 🗂️ Acciones Principales
   - 📋 Vista Previa JSON

2. **Resultados**:
   - Tabla de datos del último reporte
   - Filtros (fecha, estado, búsqueda)
   - Exportación (CSV, XLSX, DBF, JSON)
   - Envío por email
   - Sumarios (ingresos, devoluciones, neto)

3. **Historial**:
   - Lista de archivos generados por día
   - Botón "Abrir carpeta de reportes"
   - Detecta prefijos: `balance-`, `transactions-`, etc.

4. **Acerca de**:
   - Información de contacto (teléfono, WhatsApp, email)
   - Notas de versión (desde `docs/RELEASE_NOTES.md`)
   - Acordeones por versión

#### **Estilos y diseño**:
- Tailwind CSS para diseño responsivo
- Collapsibles (`<details>`) para cada sección
- Indicador de perfil activo en header
- Botones de navegación: "Modo Caja", "Modo Imagen", "Abrir log de hoy"

---

### **Frontend (src/renderer.ts)**
Responsabilidades:
- Cargar y guardar configuración desde/hacia `electron-store`
- Validar formularios (campos requeridos, formato de credenciales)
- Manejar eventos de botones (probar conexión, generar reporte, etc.)
- Renderizar resultados en tablas con paginación
- Exportar datos (CSV, XLSX, DBF, JSON)
- Gestionar perfiles de configuración
- Vista previa JSON con ofuscación de secretos

#### **Validaciones en vivo**:
- Contraseña: mínimo 8 caracteres
- Email: formato válido
- Rutas: existencia de archivos/carpetas
- Credenciales: formato de tokens

---

### **Backend (src/main.ts)**
Handlers IPC principales:

#### **Configuración**:
- `config:load`: Carga configuración completa desde `electron-store`
- `config:save`: Guarda configuración (validada)
- `config:test-mp`: Prueba conexión Mercado Pago
- `config:test-ftp`: Prueba conexión FTP (cliente)
- `config:test-galicia`: Prueba conexión Banco Galicia
- `config:test-email`: Prueba envío de email SMTP

#### **Reportes**:
- `generate-report`: Ejecuta flujo de reporte MP
- `export-report`: Exporta datos del último reporte
- `send-report-email`: Envía archivos por email

#### **FTP Server**:
- `ftp-server:start`: Inicia servidor FTP
- `ftp-server:stop`: Detiene servidor FTP
- `ftp-server:status`: Estado del servidor

#### **Perfiles**:
- `perfil:load`: Carga perfil por nombre
- `perfil:save`: Guarda perfil nuevo/editado
- `perfil:delete`: Elimina perfil
- `perfil:list`: Lista todos los perfiles
- `perfil:export`: Exporta perfil a JSON
- `perfil:import`: Importa perfil desde JSON

#### **Seguridad**:
- `auth:check`: Verifica si requiere autenticación
- `auth:login`: Autentica usuario
- `auth:change-password`: Cambia contraseña
- `auth:logout`: Cierra sesión

#### **Historial**:
- `list-history`: Lista archivos generados
- `open-out-dir`: Abre carpeta de reportes

#### **Acerca de**:
- `about:get-release-notes`: Lee `docs/RELEASE_NOTES.md`

---

## Secciones de Configuración

### 1. **🧩 Perfiles de Configuración**
**Objetivo**: Gestionar múltiples configuraciones (dev, prod, clientes).

#### **Campos**:
- Seleccionar perfil (dropdown)
- Nombre del perfil
- Descripción
- Permisos por sección

#### **Acciones**:
- Aplicar perfil (carga configuración)
- Guardar como nuevo (crea perfil)
- Editar perfil (modifica existente)
- Exportar/Importar (JSON)
- Eliminar perfil

#### **Almacenamiento**:
- `electron-store` bajo clave `perfiles`
- Estructura: `{ nombre, descripcion, config, permisos }`

---

### 2. **💰 Mercado Pago**
**Objetivo**: Configurar credenciales y parámetros de consulta MP.

#### **Campos**:
- **Access Token** (APP_USR-...)
- **ID de usuario** (opcional)
- **Zona horaria** (America/Argentina/Buenos_Aires)
- **Ventana operativa**: Inicio / Fin (HH:MM)
- **Modo de fechas**:
  - Fechas manuales (desde/hasta)
  - Días hacia atrás
  - Sin filtro
- **Campo de fecha**: date_created / date_approved
- **Estado**: approved (único soportado)
- **Paginación**: Límite / Máximo de páginas

#### **Acciones**:
- **Probar conexión**: Valida token y retorna info de usuario

#### **Validaciones**:
- Token comienza con `APP_USR-` o `TEST-`
- Zona horaria válida
- Ventana operativa (HH:MM)

---

### 3. **📤 FTP (Cliente saliente)**
**Objetivo**: Enviar `mp.dbf` a servidores remotos.

#### **Campos**:
- **IP/Host** y **Puerto** (21 por defecto)
- **FTPS** (explícito): SI/NO
- **Usuario** / **Contraseña**
- **Carpeta remota** (destino)
- **Archivo remoto** (nombre del DBF)

#### **Acciones**:
- **Probar FTP**: Verifica conexión y permisos
- **Enviar DBF por FTP**: Envío manual
- **Limpiar Hash FTP**: Fuerza reenvío (ignora cache de hash)

#### **Comportamiento**:
- **Envío automático**: Tras generación de reporte (si configurado)
- **Control de hash**: No reenvía si el archivo no cambió (SHA256)
- **Estados**: enviado / sin cambios / error

#### **Reintentos**:
- 3 intentos con backoff exponencial
- Log de errores detallado

---

### 4. **📥 FTP Server (Servidor entrante)**
**Objetivo**: Recibir archivos de fuentes externas (disparadores remoto/imagen).

#### **Campos**:
- **Host**: 0.0.0.0 (todas las IPs) o IP específica
- **Puerto**: 21 / 2121 (configurable)
- **Usuario** / **Contraseña**
- **Carpeta raíz**: directorio que expone
- **Habilitar**: autoarranque al iniciar app

#### **PASV (modo pasivo)**:
- **PASV Host**: IP LAN o pública (para anunciar al cliente)
- **PASV Range**: rango de puertos de datos (ej: 50000-50100)
- **Firewall**: Abrir TCP 21 y rango PASV

#### **Acciones**:
- **Iniciar servidor FTP**: Levanta servidor (muestra URL y raíz)
- **Detener servidor FTP**: Cierra servidor
- **Estado**: Muestra si está corriendo, puerto, raíz

#### **Disparadores automáticos**:
- **Remoto**: Al recibir `mp*.txt` en `AUTO_REMOTE_DIR` → ejecuta reporte MP
- **Imagen**: Al recibir `direccion.txt` en `IMAGE_CONTROL_DIR` → muestra contenido
- Los `.txt` se eliminan automáticamente tras procesar

#### **Rendimiento**:
- Sin esperas programadas
- Configurar PASV para conexiones rápidas
- Excluir carpeta raíz del antivirus

---

### 5. **📧 Email / SMTP**
**Objetivo**: Enviar reportes por email.

#### **Campos**:
- **Email para reportes** (destino)
- **Servidor SMTP** (ej: smtp.gmail.com)
- **Puerto** (587, 465, 25)
- **Usuario** / **Contraseña**
- **Seguridad**: TLS / STARTTLS

#### **Uso**:
- Desde **Resultados**: botón "Enviar por email" adjunta archivos del día

#### **Validaciones**:
- Email válido (regex)
- Puerto numérico
- Credenciales no vacías

---

### 6. **⚙️ Automatización**
**Objetivo**: Programar ciclo automático y disparadores.

#### **Campos principales**:
- **Intervalo (segundos)**: `AUTO_INTERVAL_SECONDS`
- **Calendario semanal**:
  - Por cada día: Activo (SI/NO), Desde (HH:MM), Hasta (HH:MM)
  - Días: `AUTO_DAYS_MONDAY`, `AUTO_FROM_MONDAY`, `AUTO_TO_MONDAY`, etc.

#### **Modo Remoto**:
- **Carpeta remota**: `AUTO_REMOTE_DIR` (ej: C:\tmp)
- **Intervalo remoto (ms)**: `AUTO_REMOTE_MS_INTERVAL`
- **Habilitar remoto**: `AUTO_REMOTE_ENABLED`
- **Disparo inmediato por FTP**: `AUTO_REMOTE_WATCH`
- **Probar remoto ahora**: Ejecuta una vez manualmente

#### **Modo Imagen**:
- **Carpeta control**: `IMAGE_CONTROL_DIR`
- **Archivo control**: `IMAGE_CONTROL_FILE` (default: direccion.txt)
- **Disparo inmediato**: `IMAGE_WATCH`
- **Limpieza automática**: `IMAGE_CLEANUP_ENABLED` / `IMAGE_CLEANUP_HOURS`

#### **Comportamiento**:
- **Intervalos**:
  - Si `AUTO_REMOTE_MS_INTERVAL > 0`, remoto usa ese valor
  - Si no, usa `AUTO_INTERVAL_SECONDS` convertido a ms
- **Calendario semanal**: Aplica al ciclo por intervalo
- **Disparadores forzados**:
  - Remoto y Modo Imagen SIEMPRE se ejecutan (ignoran días/horas)
  - Envío FTP en modo remoto es forzado (no se salta por "sin cambios")

#### **Flujo remoto**:
1. Detecta `mp*.txt` en `AUTO_REMOTE_DIR`
2. Ejecuta reporte MP
3. Genera salidas y envía `mp.dbf` por FTP (forzado)
4. Limpia el `.txt` procesado

---

### 7. **🔐 Seguridad**
**Objetivo**: Administrar credenciales de acceso al modo admin.

#### **Campos**:
- **Contraseña actual**
- **Nueva contraseña** y **confirmación**
- **Nuevo usuario** / **frase secreta** (opcional)

#### **Acciones**:
- **Cambiar contraseña**: Valida y actualiza
- **Validación en vivo**: Mínimo 8 caracteres

#### **Errores amigables**:
- `weak_password`: Contraseña débil (< 8 caracteres)
- `invalid_current`: Contraseña actual incorrecta
- `invalid_secret`: Frase secreta incorrecta
- `not_initialized`: No hay contraseña configurada
- `locked`: Cuenta bloqueada (múltiples intentos fallidos)

#### **Comportamiento (v1.0.10)**:
- Al iniciar con `DEFAULT_VIEW=config`, primero abre `auth.html`
- Desde bandeja o navegación, también requiere `auth.html` previamente

---

### 8. **📄 Facturación (AFIP) — MÓDULO CRÍTICO**

> ⚠️ **Este es el módulo MÁS IMPORTANTE del sistema**  
> Ver documentación completa en: [`CONFIG_FACTURACION_AFIP.md`](./CONFIG_FACTURACION_AFIP.md)

**Objetivo**: Configurar, probar y gestionar la facturación electrónica con AFIP, incluyendo procesamiento automático de archivos `.fac` del sistema legacy.

#### **Subsecciones**:
1. **Datos de la Empresa**: Razón social, CUIT, domicilio, condición IVA, logo
2. **Parámetros de Facturación**: Tipo por defecto, punto de venta, numeración, MiPyME
3. **Configuración AFIP**: CUIT, punto de venta, certificado, clave privada, entorno
4. **🧪 Pruebas de Facturación**: Herramienta completa para emisión de prueba
5. **📂 Watcher .fac**: Procesamiento automático (puente con sistema legacy)
6. **📦 Configuración de Salidas**: Rutas de destino para PDFs

#### **Funcionalidades clave**:
- ✅ Emisión manual desde UI (pruebas y producción)
- ✅ Procesamiento automático de `.fac` (watcher)
- ✅ Validación Padrón 13 (A13)
- ✅ Facturación en moneda extranjera (USD, EUR)
- ✅ Integración provincial (ARCA, Mendoza)
- ✅ Generación de PDF con QR de validación AFIP
- ✅ Idempotencia (evita duplicados por SHA256)
- ✅ Gestión de CAE (validación, vencimiento)

#### **Servicios Backend**:
- `FacturacionService.ts`, `afipService.ts`, `facProcessor.ts`
- `ContingencyController.ts`, `pdfRenderer.ts`

---

### 9. **🏦 Banco Galicia**
**Objetivo**: Integrar con API de Banco Galicia.

#### **Campos**:
- **App ID**: ID de aplicación Galicia
- **App Key**: Clave secreta (ocultar/mostrar con 👁)
- **Certificado (.pem)**: Ruta al certificado público
- **Clave privada (.pem)**: Ruta a clave privada
- **Entorno**: Sandbox / Producción

#### **Acciones**:
- **Probar conexión Galicia**: Valida credenciales y certificados

#### **URLs**:
- **Sandbox**: `https://sandbox-api.galicia.ar`
- **Producción**: `https://api.galicia.ar`

#### **Autenticación**:
- Método: OAuth2 Client Credentials
- Tokens: JWT (Access + Refresh)
- Certificados MSSL (requeridos en producción)
- Timeout: 30s

#### **Funcionalidades**:
1. **Consulta de saldos**: `/api/v1/accounts/balances`
2. **Movimientos de cuenta**: `/api/v1/accounts/transactions`
3. **Gestión de cobranzas**: `/api/v1/collections`

#### **Modo Sandbox**:
- Retorna datos simulados (saldos, movimientos, cobranzas)
- No requiere certificados
- Útil para pruebas

---

### 10. **🔔 Notificaciones de Error**
**Objetivo**: Alertar por email cuando ocurren errores.

#### **Campos**:
- **Habilitar notificaciones**: SI/NO
- **Mínimo errores antes de notificar**: N (default: 5)
- **Tiempo entre notificaciones (minutos)**: M (default: 60)

#### **Acciones**:
- **Actualizar resumen**: Recalcula totales
- **Guardar**: Aplica configuración
- **Limpiar errores antiguos**: Borra errores > 30 días
- **Resetear todo**: Limpia todas las notificaciones

#### **Resumen**:
- Totales de errores
- Grupos activos (tipos de error)
- Notificaciones enviadas

#### **Comportamiento**:
- Agrupa errores similares
- Ventana de enfriamiento (cooldown)
- Envío por email SMTP configurado

---

### 11. **🗂️ Acciones Principales**
**Objetivo**: Tareas frecuentes y vista previa de configuración.

#### **Acciones**:
- **Cargar configuración**: Refresca desde `electron-store`
- **Guardar configuración**: Persiste cambios
- **Generar reporte**: Ejecuta flujo MP manualmente
- **Enviar DBF por FTP**: Envío manual
- **Limpiar Hash FTP**: Fuerza reenvío

#### **Vista previa JSON**:
- **Filtro de texto**: Busca en JSON
- **Copiar**: Copia JSON al portapapeles
- **Descargar .json**: Guarda archivo local
- **Restaurar .json**: Carga configuración desde archivo
- **Expandir/Contraer todo**: Toggle de collapsibles
- **Mostrar/Ocultar**: Toggle de secciones
- **Ofuscación de secretos**: Reemplaza valores sensibles con `***`

---

## Flujos principales

### **Flujo 1: Configuración inicial**
1. Usuario abre **Modo Administrador** (requiere `auth.html`)
2. Carga `config.html` con configuración desde `electron-store`
3. Usuario expande secciones (Mercado Pago, FTP, Email)
4. Completa credenciales y parámetros
5. **Prueba conexiones** (botones de test)
6. **Guarda configuración** (botón principal)
7. Sistema persiste en `electron-store` (encriptado)

### **Flujo 2: Generación manual de reporte**
1. Usuario navega a **Acciones Principales**
2. Click en **"Generar reporte"**
3. Backend ejecuta `runReportFlowAndNotify('manual')`
4. Consulta MP API → genera archivos (CSV, XLSX, DBF, JSON)
5. Si FTP configurado → envía `mp.dbf`
6. Retorna `{ count, rows, outDir, files, ftp }` a UI
7. UI muestra notificación de éxito con conteo

### **Flujo 3: Automatización por intervalo**
1. Usuario configura **Automatización** (intervalo, días, horas)
2. Guarda configuración
3. Timer en `src/main.ts` se inicia automáticamente
4. Cada tick:
   - Valida día habilitado y ventana horaria
   - Ejecuta `runReportFlowAndNotify('auto')`
   - Envía `auto-report-notice` a UI (logs en Modo Caja)
   - Actualiza countdown con `auto-timer-update`

### **Flujo 4: Disparador remoto (FTP)**
1. Usuario configura **FTP Server** y **Modo Remoto**
2. Activa "Disparo inmediato por FTP"
3. Cliente externo sube `mp.txt` a servidor FTP
4. Watcher detecta archivo en `AUTO_REMOTE_DIR`
5. Ejecuta reporte MP inmediatamente (ignora días/horas)
6. Envía `mp.dbf` por FTP (modo forzado)
7. Elimina `mp.txt`
8. Log en UI: "Remoto: reporte ejecutado"

### **Flujo 5: Exportación de resultados**
1. Usuario genera reporte (manual o automático)
2. Navega a **Resultados**
3. Aplica filtros (fecha, estado, búsqueda)
4. Selecciona formato (CSV / XLSX / DBF / JSON)
5. Click en botón de exportación
6. Sistema genera archivo y abre carpeta
7. Opcionalmente: "Enviar por email" (SMTP configurado)

### **Flujo 6: Gestión de perfiles**
1. Usuario crea perfil de prueba (dev)
2. Configura credenciales de sandbox
3. **Guardar como nuevo** → "Perfil Dev"
4. Cambia a configuración de producción
5. **Guardar como nuevo** → "Perfil Prod"
6. Alterna entre perfiles con dropdown
7. **Aplicar perfil** → carga configuración completa
8. **Exportar** → JSON para respaldo/distribución

---

## Seguridad y almacenamiento

### **Encriptación**:
- `electron-store` con encryptionKey
- Credenciales sensibles protegidas
- Certificados referenciados por ruta (no embebidos)

### **Ofuscación en UI**:
- Vista previa JSON reemplaza secretos con `***`
- Campos de contraseña con toggle show/hide (👁)
- Hash FTP no se muestra (interno)

### **Autenticación**:
- Requerida para acceder a `config.html`
- `auth.html` solicita credenciales
- Session persistida hasta cierre de app
- Bloqueo tras intentos fallidos

### **Permisos por perfil**:
- Secciones habilitables/deshabilitables
- Control granular de acceso
- Útil para multi-usuario (ej: operador vs admin)

---

## Contratos IPC (resumen)

### **UI → Backend**:
- **Config**: `config:load`, `config:save`, `config:test-*`
- **Reportes**: `generate-report`, `export-report`, `send-report-email`
- **FTP Server**: `ftp-server:start/stop/status`
- **Perfiles**: `perfil:load/save/delete/list/export/import`
- **Seguridad**: `auth:check/login/change-password/logout`
- **Historial**: `list-history`, `open-out-dir`
- **Acerca de**: `about:get-release-notes`

### **Backend → UI (eventos)**:
- `auto-report-notice`: Logs de procesamiento
- `auto-timer-update`: Countdown del timer
- `config-updated`: Notifica cambios de configuración

---

## Criterios de aceptación (QA)

### **Configuración**:
- ✅ Guardar y cargar persiste todos los campos
- ✅ Pruebas de conexión validan credenciales
- ✅ Errores muestran mensajes amigables
- ✅ Ofuscación de secretos en vista previa

### **Reportes**:
- ✅ Generación manual retorna datos en < 10s
- ✅ Archivos se crean en carpeta de salida
- ✅ Envío FTP automático tras generación
- ✅ Hash FTP evita reenvíos innecesarios

### **FTP Server**:
- ✅ Inicia/detiene sin errores
- ✅ Acepta conexiones en puerto configurado
- ✅ Disparadores detectan archivos y ejecutan
- ✅ PASV configurado permite transferencias rápidas

### **Automatización**:
- ✅ Timer respeta días habilitados y ventana horaria
- ✅ Disparadores remotos/imagen ignoran restricciones
- ✅ Logs en UI Caja muestran eventos automáticos

### **Perfiles**:
- ✅ Aplicar perfil carga configuración completa
- ✅ Exportar/importar mantiene integridad
- ✅ Permisos restringen secciones correctamente

### **Seguridad**:
- ✅ Autenticación requerida para acceder
- ✅ Cambio de contraseña valida actual
- ✅ Bloqueo tras intentos fallidos

---

## Roadmap sugerido

### **✅ Implementado (actual)**:
- ✅ Configuración completa de servicios
- ✅ FTP Server integrado con disparadores
- ✅ Perfiles de configuración
- ✅ Automatización con calendario semanal
- ✅ Exportación multi-formato
- ✅ Seguridad con autenticación
- ✅ Integración Banco Galicia

### **Pendiente (futuras mejoras)**:
- 🔜 Dashboard con métricas en tiempo real
- 🔜 Logs centralizados con búsqueda avanzada
- 🔜 Webhooks para notificaciones externas
- 🔜 API REST para integraciones externas
- 🔜 Backup automático de configuración (cloud)
- 🔜 Multi-idioma (i18n)
- 🔜 Tests E2E automatizados (Playwright)
- 🔜 Modo oscuro/claro (theme switcher)
- 🔜 Editor de plantillas de reportes
- 🔜 Integración con más pasarelas de pago

---

## Referencias de código

### **Archivos principales**:
- **UI**: `public/config.html` (estructura HTML + Tailwind)
- **Frontend**: `src/renderer.ts` (lógica de formularios, eventos, validaciones)
- **Preload**: `src/preload.ts` (bridge IPC seguro)
- **Backend**: `src/main.ts` (handlers IPC, timers, watchers)

### **Servicios**:
- **Auth**: `src/services/AuthService.ts`
- **FTP**: `src/services/FtpService.ts` (cliente)
- **FTP Server**: `src/services/FtpServerService.ts` (servidor)
- **Email**: `src/services/EmailService.ts`
- **Mercado Pago**: `src/services/MercadoPagoService.ts`
- **Galicia**: `src/services/GaliciaService.ts`
- **Errors**: `src/services/ErrorNotificationService.ts`

### **Configuración**:
- **Store**: `electron-store` (persistencia encriptada)
- **Rutas**: `app.getPath('userData')` para archivos locales

---

## Errores comunes y soluciones

### **"Access Token inválido"**:
- Verificar que comience con `APP_USR-` o `TEST-`
- Comprobar en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
- Regenerar token si caducó

### **"FTP: Connection refused"**:
- Verificar IP/Host y Puerto correctos
- Firewall bloqueando puerto 21
- Credenciales incorrectas
- Servidor FTP remoto caído

### **"Email not sent"**:
- Verificar configuración SMTP (servidor, puerto, credenciales)
- Gmail: activar "Acceso de apps menos seguras" o usar App Password
- Firewall bloqueando puerto 587/465

### **"FTP Server no inicia"**:
- Puerto 21 ya ocupado (IIS, FileZilla, otro servicio)
- Permisos insuficientes para carpeta raíz
- Firewall bloqueando puerto

### **"Disparador no se ejecuta"**:
- Verificar que `AUTO_REMOTE_WATCH` o `IMAGE_WATCH` esté activo
- Carpeta de control debe coincidir con raíz FTP Server
- Archivo `.txt` debe tener permisos de lectura
- Revisar logs para errores (EBUSY, EPERM, EACCES)

---

**Última actualización**: Octubre 2025  
**Versión**: 1.0.20+

