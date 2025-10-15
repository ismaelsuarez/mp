# 📊 TC-MP - Sistema de Gestión de Pagos y Facturación

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)]()
[![Electron](https://img.shields.io/badge/Electron-30.5-purple)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

Aplicación Electron profesional para Windows que integra **Mercado Pago**, **AFIP**, **ARCA** y procesamiento automatizado de pagos y facturación.

---

## 🌟 Características Principales

### Gestión de Pagos
- ✅ **Integración Mercado Pago**: Reportes automáticos, conciliación, procesamiento de pagos
- ✅ **Reportes automatizados**: CSV, Excel, DBF con envío por email/FTP
- ✅ **Múltiples formatos**: Exportación flexible para diferentes sistemas contables

### Facturación Electrónica
- ✅ **AFIP WSFEv1**: Facturación electrónica homologada
- ✅ **Comprobantes**: Facturas A/B/C, Notas de Crédito/Débito
- ✅ **PDF con QR**: Generación automática con código QR de AFIP
- ✅ **Recibos y Remitos**: Gestión completa de comprobantes

### Retenciones Provinciales
- ✅ **ARCA Mendoza**: Integración con sistema de retenciones
- ✅ **Procesamiento automatizado**: Watchers de archivos
- ✅ **PDFs personalizados**: Layouts configurables

### Automatización
- ✅ **File Watchers**: Procesamiento automático de archivos `.fac`, `.txt`
- ✅ **Contingencia robusta**: Sistema de colas con SQLite
- ✅ **Resiliencia**: Retry automático, circuit breaker, timeouts

### Infraestructura
- ✅ **Auto-actualización**: Actualizaciones automáticas vía GitHub Releases
- ✅ **Logging avanzado**: Logs persistentes con redacción de datos sensibles
- ✅ **Configuración segura**: Credenciales cifradas con keytar
- ✅ **Arquitectura monorepo**: Código modular y escalable

---

## 📋 Requisitos del Sistema

### Para Usuarios Finales
- **Sistema Operativo**: Windows 10/11 (x64)
- **Espacio en disco**: 500 MB disponibles
- **RAM**: 4 GB mínimo, 8 GB recomendado
- **Conexión a Internet**: Requerida para AFIP/MP

### Para Desarrolladores
- **Node.js**: 18.20.4 o superior ([.nvmrc](./.nvmrc))
- **PNPM**: 9.x o superior
- **Sistema Operativo**: Windows 10/11 (recomendado para desarrollo)
- **Editor**: Visual Studio Code (recomendado)

---

## 🚀 Instalación Rápida

### Para Usuarios

1. Descargar el instalador desde [Releases](https://github.com/ismaelsuarez/mp-updates/releases/latest)
2. Ejecutar `Tc-Mp-Setup-X.X.X.exe`
3. Seguir el asistente de instalación
4. Configurar credenciales desde Settings

### Para Desarrolladores

```bash
# 1. Clonar repositorio
git clone https://github.com/ismaelsuarez/mp.git
cd mp

# 2. Instalar dependencias
pnpm install

# 3. Compilar TypeScript
pnpm build:ts

# 4. Ejecutar aplicación
pnpm start
```

**Nota**: En desarrollo, puedes usar `SKIP_LICENSE=true` para saltear la verificación de licencia.

---

## 📁 Estructura del Proyecto

```
mp/
├── apps/
│   └── electron/           # Aplicación Electron
│       ├── src/
│       │   ├── services/   # Servicios de negocio
│       │   ├── modules/    # Módulos AFIP, ARCA, etc.
│       │   └── main.ts     # Proceso principal
│       └── package.json
│
├── packages/
│   ├── core/               # Lógica de negocio pura
│   │   ├── afip/           # Helpers, calculators, validators
│   │   ├── licencia/       # Validación de licencias
│   │   └── facturacion/    # Parsers de facturas
│   │
│   ├── infra/              # Infraestructura
│   │   ├── database/       # DbService, QueueDB
│   │   ├── logger/         # LogService
│   │   ├── afip/           # AfipService (HTTP)
│   │   ├── mercadopago/    # MercadoPagoService
│   │   ├── email/          # EmailService
│   │   └── ftp/            # FtpService
│   │
│   ├── shared/             # Código compartido
│   │   ├── types/          # Interfaces TypeScript
│   │   ├── constants/      # Constantes AFIP, etc.
│   │   └── utils/          # Utilidades
│   │
│   └── config/             # Configuraciones compartidas
│       └── tsconfig.base.json
│
├── src/                    # Código legacy (en migración)
├── public/                 # Assets estáticos (HTML, CSS, iconos)
├── templates/              # Templates de email y PDF
├── docs/                   # Documentación
├── tests/                  # Tests unitarios y E2E
└── config/                 # Configuraciones JSON
```

Ver [ARCHITECTURE.md](./docs/ARCHITECTURE.md) para detalles de arquitectura.

---

## 🛠️ Scripts Disponibles

### Desarrollo

```bash
pnpm start                  # Ejecutar app (skip license en dev)
pnpm test                   # Ejecutar tests con Vitest
pnpm test:watch             # Tests en modo watch
pnpm test:coverage          # Tests con cobertura
pnpm test:ui                # Tests con UI interactiva
```

### Build y Release

```bash
pnpm build:ts               # Compilar TypeScript (incremental)
pnpm build:clean            # Limpiar cache de build
pnpm build                  # Build completo (TS + Electron)
pnpm release                # Build y publicar en GitHub Releases
```

### Calidad de Código

```bash
pnpm typecheck              # Verificar tipos TypeScript
pnpm format                 # Formatear código con Prettier
pnpm format:check           # Verificar formateo
```

### Utilidades

```bash
pnpm db:inspect             # Inspeccionar base de datos
pnpm queue:inspect          # Inspeccionar cola de contingencia
pnpm cleanup:res            # Limpiar archivos .res antiguos
pnpm pdf:calibrate          # Calibrar generación de PDFs
```

---

## ⚙️ Configuración

La aplicación se configura **100% desde la UI** (no requiere `.env` en producción).

### Configuración desde Settings

1. Abrir aplicación
2. Ir a **Settings** (⚙️)
3. Configurar por sección:

#### AFIP
- Certificado (`.crt`)
- Clave privada (`.key`)
- CUIT
- Punto de venta
- Ambiente (Homologación/Producción)

#### Mercado Pago
- Access Token (producción)
- User ID

#### ARCA (Mendoza)
- Usuario
- Contraseña
- Ambiente

#### Rutas
- Carpeta de entrada (`ent/`)
- Carpetas de salida (Local, Red1, Red2)

**Seguridad**: Las credenciales se almacenan cifradas en `keytar` (Windows Credential Store).

---

## 📊 Uso

### Modo Caja (Principal)

Vista principal de la aplicación:

- **Logs en tiempo real**: Ver actividad de watchers, procesamiento
- **Resumen diario**: Totales de facturas emitidas
- **Estado de servicios**: AFIP, ARCA, Mercado Pago

### Modo Imagen

Visor de imágenes/videos/PDFs:

1. Colocar archivo de control `direccion.txt` en carpeta configurada
2. La aplicación muestra el contenido automáticamente
3. Opciones: ventana secundaria, fullscreen, numerador

### Modo Administración

Gestión avanzada:

- Configuración de perfiles
- Consulta de logs históricos
- Testing de conexiones AFIP/MP/ARCA
- Gestión de certificados

---

## 🔄 Procesamiento Automático

### Watchers de Archivos

La aplicación monitorea carpetas configuradas:

#### Facturación (`.fac`)

```
ent/
  └── FA_0001-00000123.fac   → Procesar factura
```

**Flujo**:
1. Archivo detectado
2. Mover a `.processing/`
3. Validar y enviar a AFIP/ARCA
4. Generar PDF con CAE
5. Distribuir a rutas configuradas
6. Mover a `.done/`

#### Reportes MP (`mp.txt`)

```
ent/
  └── mp.txt   → Generar reporte del día
```

**Flujo**:
1. Archivo detectado
2. Consultar pagos del día en Mercado Pago
3. Generar CSV, Excel, DBF
4. Enviar por email/FTP
5. Eliminar trigger

#### Cotización Dólar (`dolar.txt`)

```
ent/
  └── dolar.txt   → Scrapear BNA
```

**Flujo**:
1. Scraping de www.bna.com.ar
2. Generar `dolar.dbf/csv/xlsx`
3. Publicar por FTP
4. Eliminar trigger

#### Retenciones (`retencion*.txt`)

```
ent/
  └── retencion001.txt   → Generar PDF
```

**Flujo**:
1. Archivo detectado
2. Generar PDF con layout configurable
3. Guardar como `B001.pdf` en rutas
4. Eliminar trigger

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
pnpm test

# Con cobertura
pnpm test:coverage

# En modo watch
pnpm test:watch

# UI interactiva
pnpm test:ui
```

### Smoke Tests

```bash
# Smoke tests manuales
1. Build: pnpm build:ts (verificar 0 errores)
2. Tests: pnpm test (verificar 3/4 pasando)
3. Electron: pnpm start (verificar arranque)
4. Watchers: Colocar archivo .fac de prueba
```

Ver [docs/smokes/](./docs/smokes/) para guías detalladas.

### Cobertura Actual

- **Unitarios**: 3/4 tests pasando (75%)
- **E2E**: 1 test pasando + 1 integration test (requiere SQLite compilado)

---

## 📚 Documentación

### Documentos Principales

- [📖 ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Arquitectura del sistema
- [📖 CONFIGURACION.md](./docs/CONFIGURACION.md) - Sistema de configuración
- [📖 RESILIENCIA.md](./docs/RESILIENCIA.md) - Infraestructura resiliente
- [📝 CHANGELOG](./CHANGELOG_REFACTORIZACION.md) - Historial de cambios
- [📊 REPORTE_EJECUTIVO](./REPORTE_EJECUTIVO_REFACTORIZACION.md) - Reporte de refactorización

### Documentación Técnica

- [🔧 Optimización](./docs/optimization/) - Guías de optimización
- [🧹 Cleanup](./docs/cleanup/) - Progreso de refactorización
- [🧪 Smoke Tests](./docs/smokes/) - Pruebas manuales
- [📘 Manual de Usuario](./docs/manual.html) - Manual completo

### Documentación de Código

Ver comentarios inline en el código para detalles de implementación.

---

## 🏗️ Arquitectura

### Principios

- **Domain-Driven Design (DDD)**: Separación clara de capas
- **SOLID**: Principios de diseño orientado a objetos
- **Clean Architecture**: Independencia de frameworks

### Capas

```
┌─────────────────────────────────────┐
│           @electron/*               │  ← Aplicación Electron
│   (UI, IPC, Main Process)           │
├─────────────────────────────────────┤
│            @infra/*                 │  ← Infraestructura
│   (HTTP, DB, Logger, Email, FTP)   │
├─────────────────────────────────────┤
│             @core/*                 │  ← Lógica de Negocio
│   (AFIP, Facturación, Validación)  │
├─────────────────────────────────────┤
│            @shared/*                │  ← Compartido
│   (Types, Utils, Constants)         │
└─────────────────────────────────────┘
```

Ver [ARCHITECTURE.md](./docs/ARCHITECTURE.md) para detalles completos.

---

## 🔐 Seguridad

### Almacenamiento de Credenciales

- **Keytar**: Credenciales cifradas en Windows Credential Store
- **electron-store**: Configuración cifrada con AES-256
- **Logs**: Redacción automática de datos sensibles (tokens, passwords)

### Comunicación IPC

- **Context Isolation**: Habilitada
- **Preload Script**: API segura para renderer
- **Node Integration**: Deshabilitada en renderer

### Actualizaciones

- **Verificación de firma**: Opcional (configurar `CSC_*` para firma de código)
- **HTTPS**: Descarga segura desde GitHub Releases

---

## ⚡ Performance

### Optimizaciones Aplicadas

- **Build incremental**: TypeScript con cache (`.tsbuildinfo`)
- **ASAR comprimido**: Bundle optimizado
- **Lazy loading**: Módulos pesados cargados bajo demanda
- **Límites V8**: Prevención de OOM con `--max-old-space-size=2048`
- **Cleanup**: Liberación de recursos al cerrar

### Métricas

| Métrica | Valor |
|---------|-------|
| Build time (incremental) | ~20s |
| Instalador | ~190 MB |
| Startup time | ~2s |
| Memory (idle) | ~150 MB |

Ver [docs/optimization/](./docs/optimization/) para detalles.

---

## 🐛 Troubleshooting

### Problemas Comunes

#### No arranca la aplicación

**Síntomas**: Ventana no se abre, error en logs

**Soluciones**:
1. Verificar `pnpm build:ts` sin errores
2. Revisar logs en `%APPDATA%\Tc-Mp\logs\`
3. Verificar certificados AFIP válidos

#### Factura no se procesa

**Síntomas**: Archivo `.fac` queda en carpeta

**Soluciones**:
1. Verificar formato del archivo
2. Revisar logs de error en Modo Caja
3. Verificar conexión a AFIP/ARCA
4. Probar `afip:check-server-status` desde UI

#### Email no se envía

**Síntomas**: PDFs generados pero no llegan emails

**Soluciones**:
1. Verificar configuración SMTP en Settings
2. Verificar credenciales de email
3. Revisar logs de email
4. Verificar firewall/antivirus

#### Auto-actualización falla

**Síntomas**: "No se pudo descargar actualización"

**Soluciones**:
1. Verificar conexión a internet
2. Verificar acceso a GitHub Releases
3. Revisar logs de `electron-updater`

### Logs

**Ubicación**: `%APPDATA%\Tc-Mp\logs\`

**Formato**: `YYYY-MM-DD.log`

**Niveles**: `INFO`, `WARN`, `ERROR`, `AUTH`, `FTP`, `MP`

---

## 🤝 Contribución

Este es un proyecto **privado** de TODO-Computación.

Para contribuir:
1. Crear branch feature: `git checkout -b feature/nombre`
2. Hacer cambios con commits descriptivos
3. Asegurar tests pasan: `pnpm test`
4. Asegurar typecheck pasa: `pnpm typecheck`
5. Crear Pull Request

### Estándares de Código

- **TypeScript strict**: Habilitado
- **ESLint**: Configurado y pasando
- **Prettier**: Código formateado
- **Tests**: Cobertura ≥75%

---

## 📄 Licencia

**Propietario**: TODO-Computación

Todos los derechos reservados. Uso exclusivo de TODO-Computación.

---

## 📞 Soporte

**Email**: pc@tcmza.com.ar  
**Website**: https://tcmza.com.ar

---

## 🎉 Créditos

Desarrollado por **TODO-Computación** para gestión de pagos y facturación electrónica.

**Versión**: 2.0.0  
**Última actualización**: Octubre 2025

---

## 📖 Más Información

- [Plan de Refactorización](./plan_refactorizacion/)
- [Documentación Interna](./documentacion_interna/)
- [Release Notes](./docs/RELEASE_NOTES.md)

---

**Made with ❤️ by TODO-Computación**
