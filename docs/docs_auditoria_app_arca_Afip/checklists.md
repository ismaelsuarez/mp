# Checklists de Cumplimiento - Módulo de Facturación AFIP/ARCA

## 🧪 Checklist de Cumplimiento AFIP

### Configuración y Certificados
- [ ] **Certificados válidos**: Certificado AFIP vigente con mínimo 30 días de validez
- [ ] **Clave privada**: Archivo de clave privada correspondiente al certificado
- [ ] **Permisos de archivos**: Certificados con permisos 600 (solo propietario)
- [ ] **Rutas configuradas**: Rutas de certificados configuradas correctamente
- [ ] **Entorno configurado**: Homologación vs Producción configurado correctamente

### Autenticación WSAA
- [ ] **Manejo correcto de WSAA**: TA cacheado y renovación antes de vencimiento
- [ ] **Reloj sincronizado**: Sistema con reloj sincronizado (NTP)
- [ ] **Renovación proactiva**: Renovación automática de tokens antes de vencimiento
- [ ] **Time skew**: Manejo de desvíos de tiempo del sistema
- [ ] **Cache de credenciales**: Gestión eficiente del cache de Token & Sign

### Conmutación de Ambientes
- [ ] **Conmutación homologación/producción**: Sin mezclar credenciales
- [ ] **Endpoints separados**: URLs de homologación y producción separadas
- [ ] **Configuración por ambiente**: Variables de entorno específicas por ambiente
- [ ] **Validación de ambiente**: Verificación del ambiente antes de operaciones
- [ ] **Logs diferenciados**: Logs separados por ambiente

### Estructura de Comprobantes
- [ ] **Armado completo de FECAESolicitar**: Todos los parámetros requeridos
- [ ] **Tipos de comprobante**: Mapeo correcto de tipos internos a códigos AFIP
- [ ] **Concepto**: Concepto configurado correctamente (1=Productos, 2=Servicios, 3=Productos y Servicios)
- [ ] **Documento receptor**: Tipo y número de documento configurados
- [ ] **IVA**: Alícuotas, exentos, no gravados configurados correctamente
- [ ] **Moneda y cotización**: Manejo correcto cuando no es ARS
- [ ] **Importes**: Netos gravados, exentos, IVA discriminado, total

### Parámetros AFIP
- [ ] **Uso de FEParamGetTiposCbte**: Validación de tipos de comprobante
- [ ] **Uso de FEParamGetTiposIva**: Validación de alícuotas de IVA
- [ ] **Uso de FEParamGetTiposConcepto**: Validación de conceptos
- [ ] **Uso de FEParamGetTiposMonedas**: Validación de monedas
- [ ] **Uso de FEParamGetPtosVenta**: Validación de puntos de venta
- [ ] **Uso de FEParamGetTiposDoc**: Validación de tipos de documento
- [ ] **Uso de FEParamGetCotizacion**: Obtención de cotizaciones

### Numeración y Sincronización
- [ ] **Idempotencia**: Evitar duplicados en reintentos
- [ ] **Sincronización con FECompUltimoAutorizado**: Antes de emitir
- [ ] **Numeración correlativa**: Números de comprobante secuenciales
- [ ] **Punto de venta**: Validación de punto de venta autorizado
- [ ] **Concurrencia**: Protección contra emisiones simultáneas

### CAE/CAEA
- [ ] **Persistencia**: Almacenamiento de CAE en base de datos
- [ ] **Vencimientos**: Campo de vencimiento almacenado
- [ ] **Reimpresión**: Generación de PDF con CAE válido
- [ ] **Validación de vencimiento**: Verificación automática de vencimiento
- [ ] **Renovación automática**: Proceso de renovación de CAE

### Manejo de Errores
- [ ] **Tratamiento de Errors**: Manejo de errores de AFIP
- [ ] **Tratamiento de Observaciones**: Manejo de observaciones de AFIP
- [ ] **Mapeo a mensajes de negocio**: Mensajes claros para el usuario
- [ ] **Logs con contexto**: Información de comprobante en logs
- [ ] **Reintentos**: Estrategia de reintentos con backoff

### Seguridad
- [ ] **Certificados y claves seguros**: Rutas seguras y permisos correctos
- [ ] **No log de secretos**: Certificados y claves no en logs
- [ ] **Logs con contexto**: Información útil sin datos sensibles
- [ ] **Validación de entrada**: Validación de datos de entrada
- [ ] **Sanitización**: Limpieza de datos sensibles en logs

### Observabilidad
- [ ] **Logs estructurados**: Logs en formato JSON
- [ ] **Niveles de log**: Configuración de niveles de log
- [ ] **Rotación de logs**: Rotación automática de archivos de log
- [ ] **Métricas**: Métricas de operaciones AFIP
- [ ] **Alertas**: Alertas para errores críticos

### Plan de Pruebas
- [ ] **Pruebas de homologación**: Casos de prueba en ambiente de homologación
- [ ] **Datos de prueba**: Datos válidos para pruebas
- [ ] **Validación de resultados**: Verificación de CAE y PDF
- [ ] **Casos edge**: Pruebas de casos límite
- [ ] **Documentación de pruebas**: Documentación de casos de prueba

---

## 🧪 Checklist de Cumplimiento ARCA / AT Provincial

### Configuración ARCA
- [ ] **Endpoints configurados**: URLs de servicios ARCA configuradas
- [ ] **Autenticación**: Método de autenticación implementado
- [ ] **Credenciales**: Credenciales de ARCA configuradas
- [ ] **Certificados**: Certificados específicos de ARCA (si aplica)
- [ ] **Ambiente**: Homologación vs Producción configurado

### Documentación
- [ ] **Endpoints documentados**: Documentación de endpoints ARCA
- [ ] **Autenticación documentada**: Proceso de autenticación documentado
- [ ] **Tipos de comprobante**: Tipos específicos de ARCA documentados
- [ ] **Tributos provinciales**: Tributos adicionales documentados
- [ ] **Manuales técnicos**: Manuales de integración disponibles

### Tipos de Comprobante
- [ ] **Tipos específicos**: Tipos de comprobante de ARCA implementados
- [ ] **Tributos provinciales**: IIBB, tasas municipales implementadas
- [ ] **Percepciones**: Percepciones provinciales implementadas
- [ ] **Retenciones**: Retenciones provinciales implementadas
- [ ] **Mapeo de tipos**: Mapeo de tipos AFIP a tipos ARCA

### Consistencia de Datos
- [ ] **Consistencia con AFIP**: Datos consistentes entre AFIP y ARCA
- [ ] **Cliente**: Información del cliente sincronizada
- [ ] **Totales**: Totales consistentes entre sistemas
- [ ] **Alícuotas**: Alícuotas válidas para ambos sistemas
- [ ] **Validación cruzada**: Validación entre AFIP y ARCA

### Homologación Provincial
- [ ] **Ambiente de homologación**: Ambiente de pruebas disponible
- [ ] **Pruebas documentadas**: Casos de prueba documentados
- [ ] **Evidencias**: Evidencias de pruebas exitosas
- [ ] **Certificación**: Certificación oficial de ARCA
- [ ] **Documentación de homologación**: Documentación del proceso

### Integración Técnica
- [ ] **APIs implementadas**: APIs de ARCA implementadas
- [ ] **Manejo de errores**: Manejo de errores específicos de ARCA
- [ ] **Timeouts**: Timeouts configurados para servicios ARCA
- [ ] **Reintentos**: Estrategia de reintentos para ARCA
- [ ] **Logs específicos**: Logs específicos para operaciones ARCA

### Cumplimiento Normativo
- [ ] **Requisitos legales**: Cumplimiento de requisitos provinciales
- [ ] **Formatos requeridos**: Formatos de comprobante requeridos
- [ ] **Plazos**: Plazos de presentación cumplidos
- [ ] **Validaciones**: Validaciones específicas de ARCA
- [ ] **Reportes**: Reportes requeridos por ARCA

### Monitoreo y Mantenimiento
- [ ] **Monitoreo de servicios**: Monitoreo de disponibilidad de ARCA
- [ ] **Alertas**: Alertas para fallos de ARCA
- [ ] **Métricas**: Métricas de operaciones ARCA
- [ ] **Mantenimiento**: Plan de mantenimiento de integración
- [ ] **Actualizaciones**: Proceso de actualización de integración

---

## 📋 Checklist de Validación General

### Antes de Producción
- [ ] **Certificados vigentes**: Certificados con validez suficiente
- [ ] **Configuración validada**: Configuración probada en homologación
- [ ] **Logs configurados**: Sistema de logs funcionando
- [ ] **Backup configurado**: Backup de configuración y datos
- [ ] **Monitoreo activo**: Sistema de monitoreo activo

### Validación Continua
- [ ] **Pruebas periódicas**: Pruebas regulares de funcionalidad
- [ ] **Validación de certificados**: Verificación periódica de vencimientos
- [ ] **Revisión de logs**: Revisión regular de logs de errores
- [ ] **Actualización de documentación**: Documentación actualizada
- [ ] **Capacitación del equipo**: Equipo capacitado en el sistema

### Incidentes y Recuperación
- [ ] **Plan de incidentes**: Plan de respuesta a incidentes
- [ ] **Procedimientos de recuperación**: Procedimientos de recuperación documentados
- [ ] **Contactos de soporte**: Contactos de soporte AFIP/ARCA
- [ ] **Escalación**: Proceso de escalación definido
- [ ] **Post-mortem**: Proceso de análisis post-incidente

---

## ✅ Criterios de Aceptación

### AFIP
- [ ] Todos los items del checklist AFIP marcados como completados
- [ ] Pruebas de homologación exitosas
- [ ] Documentación completa y actualizada
- [ ] Sistema de logs funcionando correctamente
- [ ] Certificados válidos y configurados

### ARCA (si aplica)
- [ ] Todos los items del checklist ARCA marcados como completados
- [ ] Homologación provincial exitosa
- [ ] Integración técnica funcionando
- [ ] Cumplimiento normativo verificado
- [ ] Documentación específica disponible

### General
- [ ] Checklist de validación general completado
- [ ] Plan de incidentes documentado
- [ ] Equipo capacitado
- [ ] Monitoreo activo
- [ ] Procedimientos de mantenimiento definidos
