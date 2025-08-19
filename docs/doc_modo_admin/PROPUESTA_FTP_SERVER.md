# PROPUESTA: Implementación de Servidor FTP

## Resumen Ejecutivo

Se solicita la implementación de un **servidor FTP** como complemento al cliente FTP existente, para establecer una arquitectura de comunicación bidireccional que permita la recepción automática de archivos desde múltiples fuentes externas.

## Situación Actual

### Cliente FTP Implementado
- ✅ Envío automático de `mp.dbf` a servidores remotos
- ✅ Control de integridad mediante hash
- ✅ Configuración FTPS (FTP sobre SSL/TLS)
- ✅ Monitoreo de estados de transferencia

### Limitación Identificada
- ❌ **Solo envío unidireccional**: No puede recibir archivos
- ❌ **Dependencia externa**: Requiere servidores FTP de terceros
- ❌ **Falta de autonomía**: No puede operar como hub de datos

## Propuesta de Ampliación

### Objetivo Principal
Implementar un **servidor FTP** que permita la recepción automática de archivos desde múltiples fuentes, complementando la funcionalidad de envío existente.

### Arquitectura Propuesta

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Proveedores   │    │   Servidor FTP  │    │   Procesador    │
│   Externos      │───▶│   (Nuevo)       │───▶│   Automático    │
│                 │    │                 │    │                 │
│ • Bancos        │    │ • Recepción     │    │ • Análisis      │
│ • MercadoPago   │    │ • Validación    │    │ • Integración   │
│ • Sistemas      │    │ • Almacenamiento│    │ • Actualización │
│   Contables     │    │ • Seguridad     │    │   de Base       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Justificación Técnica

### 1. **Integración Empresarial Completa**
- **Estándar de la industria**: FTP es el protocolo más utilizado para intercambio de archivos empresariales
- **Compatibilidad universal**: Funciona con sistemas legacy y modernos
- **Seguridad probada**: FTPS garantiza transferencias seguras

### 2. **Automatización de Procesos**
- **Recepción 24/7**: Disponibilidad continua para recibir archivos
- **Procesamiento automático**: Análisis inmediato de archivos recibidos
- **Notificaciones**: Alertas automáticas sobre nuevos archivos

### 3. **Escalabilidad del Sistema**
- **Múltiples fuentes**: Soporte para varios proveedores simultáneos
- **Procesamiento paralelo**: Múltiples archivos procesados en paralelo
- **Monitoreo centralizado**: Control unificado de todas las transferencias

## Casos de Uso Específicos

### Caso 1: Integración con MercadoPago
```
Proveedor: MercadoPago
Archivos: reportes_diarios.csv, conciliacion.xml
Frecuencia: Diaria
Acción: Actualización automática de base de datos
```

### Caso 2: Conciliación Bancaria
```
Proveedor: Banco
Archivos: movimientos_bancarios.txt, extractos.dbf
Frecuencia: Semanal
Acción: Conciliación automática de transacciones
```

### Caso 3: Integración Contable
```
Proveedor: Sistema Contable
Archivos: asientos_contables.csv, facturas.xml
Frecuencia: Mensual
Acción: Generación automática de reportes
```

### Caso 4: Visualización Remota de Contenido
```
Proveedor: Dispositivo Remoto
Archivos: direccion.txt (contiene URL/ruta de imagen/documento)
Frecuencia: Bajo demanda
Acción: Descarga y visualización automática del contenido
```

## Especificaciones Técnicas

### Requisitos del Servidor FTP

#### Configuración de Seguridad
- **Protocolo**: FTPS (FTP sobre SSL/TLS explícito)
- **Puerto**: 990 (FTPS) / 21 (FTP estándar)
- **Autenticación**: Usuario/contraseña por proveedor
- **Cifrado**: TLS 1.2 o superior

#### Estructura de Directorios
```
/ftp_root/
├── /incoming/           # Archivos recibidos
│   ├── /mercadopago/    # Archivos de MercadoPago
│   ├── /banco/          # Archivos bancarios
│   └── /contabilidad/   # Archivos contables
├── /processed/          # Archivos procesados
├── /failed/             # Archivos con errores
└── /logs/               # Logs de transferencia
```

#### Funcionalidades Requeridas
- **Recepción de archivos**: Upload automático
- **Validación**: Verificación de integridad
- **Clasificación**: Organización por proveedor
- **Notificación**: Alertas de recepción
- **Procesamiento**: Trigger automático post-recepción
- **Visualización remota**: Descarga y visualización de contenido desde URLs

### Integración con Sistema Existente

#### Nuevos Componentes
```typescript
// Nuevos archivos a implementar
src/services/FtpServerService.ts    // Servidor FTP
src/services/FileProcessorService.ts // Procesador de archivos
src/services/ContentViewerService.ts // Visor de contenido multimedia
src/utils/ftpServerConfig.ts        // Configuración del servidor
src/utils/contentDownloader.ts      // Descargador de contenido remoto
```

#### Modificaciones Existentes
```typescript
// Archivos a modificar
src/main.ts              // Integración del servidor
src/renderer.ts          // Interfaz de configuración
src/services/FtpService.ts // Extensión para servidor
```

## Funcionalidad Especial: Visualización Remota

### Sistema de Visualización Automática
El servidor FTP incluirá una funcionalidad especial para la **visualización remota de contenido**:

#### Flujo de Proceso
1. **Recepción**: Dispositivo remoto envía archivo `direccion.txt` vía FTP
2. **Lectura**: Sistema lee la dirección/URL contenida en el archivo
3. **Descarga**: Descarga automática del contenido desde la URL especificada
4. **Visualización**: Apertura automática en visor multimedia integrado
5. **Limpieza**: Eliminación automática del archivo `direccion.txt`

#### Tipos de Contenido Soportados
- **Imágenes**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp`
- **Documentos**: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`
- **Presentaciones**: `.ppt`, `.pptx`
- **Hojas de cálculo**: `.xls`, `.xlsx`, `.csv`
- **Videos**: `.mp4`, `.avi`, `.mov`, `.wmv`
- **Audio**: `.mp3`, `.wav`, `.flac`, `.aac`

#### Características del Visor
- **Interfaz moderna**: Ventana dedicada con controles intuitivos
- **Navegación**: Zoom, rotación, navegación por páginas (PDFs)
- **Reproducción**: Controles de video/audio integrados
- **Responsive**: Adaptable a diferentes tamaños de contenido
- **Accesibilidad**: Atajos de teclado y controles de accesibilidad

## Beneficios del Negocio

### 1. **Eficiencia Operativa**
- **Reducción manual**: Eliminación de procesos manuales de recepción
- **Velocidad**: Procesamiento inmediato de archivos
- **Precisión**: Eliminación de errores humanos
- **Visualización automática**: Contenido remoto disponible instantáneamente

### 2. **Integración Avanzada**
- **Ecosistema completo**: Comunicación bidireccional con proveedores
- **Automatización total**: Flujo de trabajo sin intervención manual
- **Trazabilidad**: Auditoría completa de archivos

### 3. **Escalabilidad**
- **Nuevos proveedores**: Fácil incorporación de nuevas fuentes
- **Volumen**: Soporte para grandes volúmenes de archivos
- **Disponibilidad**: Operación 24/7

## Plan de Implementación

### Fase 1: Desarrollo del Servidor FTP
- **Duración**: 2-3 semanas
- **Entregables**: Servidor FTP funcional con interfaz de configuración
- **Pruebas**: Validación de recepción y seguridad

### Fase 2: Integración y Procesamiento
- **Duración**: 1-2 semanas
- **Entregables**: Procesador automático de archivos
- **Pruebas**: Validación de procesamiento automático

### Fase 2.5: Sistema de Visualización Remota
- **Duración**: 1-2 semanas
- **Entregables**: Visor multimedia y descargador de contenido
- **Pruebas**: Validación de descarga y visualización de múltiples formatos

### Fase 3: Configuración y Despliegue
- **Duración**: 1 semana
- **Entregables**: Sistema completamente operativo
- **Documentación**: Manual de configuración y uso

## Recursos Requeridos

### Desarrollo
- **Desarrollador Full-Stack**: 1 persona
- **Tiempo estimado**: 5-7 semanas (incluye visualización remota)
- **Herramientas**: Node.js, TypeScript, Electron, librerías multimedia

### Infraestructura
- **Servidor**: Configuración de puertos y firewall
- **Certificados SSL**: Para FTPS
- **Almacenamiento**: Espacio para archivos temporales

## Conclusión

La implementación del servidor FTP representa una **evolución natural** del sistema actual, transformándolo de un cliente unidireccional a un **hub de comunicación empresarial** completo. Esta ampliación permitirá:

1. **Automatización total** de la recepción de datos
2. **Integración avanzada** con múltiples proveedores
3. **Visualización remota** de contenido multimedia
4. **Escalabilidad** para futuras necesidades
5. **Competitividad** en el mercado empresarial

La inversión en esta funcionalidad se justifica por los beneficios operativos inmediatos y la preparación para futuras integraciones empresariales.

---

**Solicitud**: Se requiere autorización para proceder con el desarrollo del servidor FTP como complemento al sistema existente.


## Anexo A: Guía de diagnóstico (recepción FTP)

Cuando “no llegan los archivos desde otro servidor”, seguir este checklist en orden. Este proyecto opera por requerimiento en el **puerto 21** [[PUERTO 21]] (ver políticas internas).  

### 1) ¿El servicio está escuchando en 21?
- Windows (PowerShell):
  - `Test-NetConnection -ComputerName 127.0.0.1 -Port 21`
- Windows (cmd/bash):
  - `netstat -an | findstr :21`

Debe verse LISTENING en 0.0.0.0:21 o en la IP configurada. Si no:
- Verificar que el servidor esté arrancado desde Administración.
- Revisar logs de la app (hoy.log) por errores al iniciar el FTP.

### 2) Firewall/AV
- Crear regla de entrada para TCP 21 (perfil privado y dominio).  
- Si hay clientes a través de Internet o subredes, abrir además el **rango PASV** (ej.: 50000–50100) en el firewall y en el router/NAT hacia el equipo.
- Si hay antivirus/EDR, permitir el proceso de la app.

### 3) Modo de transferencia del cliente
- Exigir al emisor usar **PASV (Passive Mode)**.  
- Si hay NAT: el servidor debe anunciar su IP pública en PASV; caso contrario, el cliente intentará conectarse a una IP privada y fallará.  
- Validar que el emisor no esté forzando Active Mode.

### 4) Credenciales y raíz
- Usuario/contraseña exactamente como configurado.  
- Carpeta raíz configurada existente y con permisos de escritura para el usuario del servicio (la app corre en el usuario actual).  
- Probar subir un archivo pequeño (ej.: `ping.txt`).

### 5) Prueba cruzada con cliente conocido
- Desde otra PC en la misma red, probar con FileZilla/WinSCP:
  - Host: IP del servidor  
  - Puerto: 21  
  - Protocolo: FTP (no FTPS)  
  - Modo: PASV  
  - Subir `prueba.txt` y confirmar que aparece en la raíz configurada.

### 6) Logs y errores típicos
- `530 Login incorrect.` → credenciales incorrectas.
- `425/426 Can't open data connection` → problema de PASV/NAT/firewall (abrir rango PASV y anunciar IP correcta).
- `550 Permission denied` → permisos de carpeta raíz.
- `ECONNREFUSED` → servicio no está escuchando/puerto cerrado.

### 7) Validaciones adicionales
- Si el emisor es otro servidor automatizado, pedir captura/log de su lado.  
- Confirmar que apunta a la **IP correcta** (no a 127.0.0.1 ni a otra máquina).  
- Si se usa FTPS externamente, validar cert/puerto y que el cliente acepte TLS explícito.

---

## Anexo B: Plan de pruebas sugerido

1. Local (misma máquina): conectar a 127.0.0.1:21 y subir `local-ok.txt` (esperado: OK).  
2. LAN (otra PC): conectar a IP LAN:21 y subir `lan-ok.txt` (esperado: OK).  
3. NAT (Internet): desde fuera, conectar a IP pública:21 y subir `wan-ok.txt` usando PASV (esperado: OK).  
4. Emisor real: repetir el envío “productivo” y verificar archivo recibido.  

Registrar capturas y timestamps; ante falla, anotar mensaje exacto del cliente.

---

## Anexo C: Recomendaciones de configuración

- Puerto: 21 (requerimiento del cliente).  
- Modo: FTP sin TLS para LAN; considerar FTPS explícito solo si exposición WAN y ambos extremos lo soportan.  
- PASV: definir rango fijo (ej.: 50000–50100) y abrirlo en firewall/NAT; anunciar IP pública si corresponde.  
- Raíz: carpeta dedicada (p.ej. `C:\tmp\ftp_share`) con permisos adecuados.  
- Logs: activar logs de transferencia y revisar “hoy.log” de la app ante incidentes.

---

> Nota operativa: si el objetivo es alimentar el “Modo Imagen” con `direccion.txt`, validar que el archivo llegue efectivamente a la carpeta de control o a una carpeta intermedia desde la cual un proceso lo mueva; confirmar que el contenido respete el formato `URI=...@VENTANA=...@INFO=...`.
