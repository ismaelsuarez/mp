# Plan de Pruebas en Homologación AFIP

## 📋 Información General

**Fecha de creación:** 2024-12-19  
**Versión del módulo:** 1.0.11  
**Ambiente de pruebas:** Homologación AFIP  
**Responsable:** Equipo de Desarrollo  

## 🎯 Objetivo

Validar el funcionamiento completo del módulo de facturación AFIP en el ambiente de homologación, asegurando que todos los casos de uso críticos funcionen correctamente antes de pasar a producción.

## ⚙️ Configuración de Pruebas

### Certificados de Homologación
```bash
# Certificado de prueba AFIP
CUIT: 20123456789
Certificado: homologacion.crt
Clave privada: homologacion.key
Punto de venta: 1
```

### Variables de Entorno
```bash
AFIP_HOMOLOGACION_CUIT=20123456789
AFIP_HOMOLOGACION_PTO_VTA=1
AFIP_HOMOLOGACION_CERT_PATH=C:/certs/homologacion.crt
AFIP_HOMOLOGACION_KEY_PATH=C:/certs/homologacion.key
AFIP_DEFAULT_ENTORNO=homologacion
AFIP_LOG_LEVEL=debug
AFIP_TIMEOUT=30000
AFIP_RETRY_ATTEMPTS=3
```

### Datos de Prueba
```json
{
  "emisor": {
    "cuit": "20123456789",
    "razon_social": "EMPRESA DE PRUEBA S.A.",
    "domicilio": "Av. Siempre Viva 123, CABA",
    "condicion_iva": "RI"
  },
  "receptores": {
    "responsable_inscripto": {
      "cuit": "20300123456",
      "razon_social": "CLIENTE RI S.A.",
      "condicion_iva": "RI"
    },
    "consumidor_final": {
      "cuit": null,
      "razon_social": "CONSUMIDOR FINAL",
      "condicion_iva": "CF"
    },
    "monotributista": {
      "cuit": "20345678901",
      "razon_social": "MONOTRIBUTISTA S.R.L.",
      "condicion_iva": "MT"
    }
  }
}
```

## 🧪 Casos de Prueba

### Caso 1: Factura B - Productos (RI → CF)

#### Datos de Entrada
```json
{
  "tipo_cbte": 6,
  "pto_vta": 1,
  "fecha": "20241219",
  "cuit_emisor": "20123456789",
  "cuit_receptor": null,
  "razon_social_receptor": "CONSUMIDOR FINAL",
  "condicion_iva_receptor": "CF",
  "neto": 1500.00,
  "iva": 315.00,
  "total": 1815.00,
  "detalle": [
    {
      "descripcion": "Servicio de reparación de PC",
      "cantidad": 1,
      "precioUnitario": 1500.00,
      "alicuotaIva": 21
    }
  ]
}
```

#### Pasos de Ejecución
1. Abrir aplicación en modo administración
2. Ir a sección "📄 Facturación (AFIP)"
3. Configurar certificados de homologación
4. Ejecutar emisión de factura con datos de prueba
5. Verificar respuesta de AFIP
6. Validar generación de PDF
7. Verificar almacenamiento en base de datos

#### Resultados Esperados
- ✅ **CAE válido**: Número de CAE de 14 dígitos
- ✅ **Vencimiento**: Fecha de vencimiento válida
- ✅ **PDF generado**: Archivo PDF creado en `Documentos/facturas/`
- ✅ **QR válido**: Código QR que redirige a AFIP
- ✅ **Base de datos**: Registro insertado en `facturas_afip`
- ✅ **Logs**: Entrada en logs de AFIP

#### Validación
```bash
# Verificar CAE
curl -s "https://www.afip.gob.ar/fe/qr/?p=..." | grep "CAE válido"

# Verificar PDF
ls -la "Documentos/facturas/factura_*.pdf"

# Verificar logs
tail -f "logs/afip/20241219.log"
```

---

### Caso 2: Factura A - Servicios (RI → RI)

#### Datos de Entrada
```json
{
  "tipo_cbte": 1,
  "pto_vta": 1,
  "fecha": "20241219",
  "cuit_emisor": "20123456789",
  "cuit_receptor": "20300123456",
  "razon_social_receptor": "CLIENTE RI S.A.",
  "condicion_iva_receptor": "RI",
  "neto": 5000.00,
  "iva": 1050.00,
  "total": 6050.00,
  "detalle": [
    {
      "descripcion": "Servicio de consultoría IT",
      "cantidad": 10,
      "precioUnitario": 500.00,
      "alicuotaIva": 21
    }
  ]
}
```

#### Pasos de Ejecución
1. Configurar certificados de homologación
2. Ejecutar emisión de Factura A
3. Verificar CAE y vencimiento
4. Validar PDF con IVA discriminado
5. Verificar datos del receptor en PDF

#### Resultados Esperados
- ✅ **Tipo correcto**: Factura A (tipo 1)
- ✅ **IVA discriminado**: IVA 21% discriminado en PDF
- ✅ **Datos receptor**: CUIT y razón social correctos
- ✅ **CAE válido**: CAE de 14 dígitos
- ✅ **Numeración**: Número secuencial correcto

---

### Caso 3: Nota de Crédito A (Referenciando Factura A)

#### Prerequisito
- Factura A emitida exitosamente (Caso 2)

#### Datos de Entrada
```json
{
  "tipo_cbte": 3,
  "pto_vta": 1,
  "fecha": "20241219",
  "cuit_emisor": "20123456789",
  "cuit_receptor": "20300123456",
  "razon_social_receptor": "CLIENTE RI S.A.",
  "condicion_iva_receptor": "RI",
  "neto": 500.00,
  "iva": 105.00,
  "total": 605.00,
  "detalle": [
    {
      "descripcion": "Descuento aplicado - Servicio de consultoría IT",
      "cantidad": 1,
      "precioUnitario": -500.00,
      "alicuotaIva": 21
    }
  ]
}
```

#### Pasos de Ejecución
1. Emitir Nota de Crédito referenciando Factura A anterior
2. Verificar CAE específico para NC
3. Validar PDF con referencia a factura original
4. Verificar totales negativos

#### Resultados Esperados
- ✅ **Tipo correcto**: Nota de Crédito A (tipo 3)
- ✅ **Referencia**: Referencia a factura original en PDF
- ✅ **CAE válido**: CAE específico para NC
- ✅ **Totales negativos**: Importes negativos en PDF

---

### Caso 4: Factura C - Monotributo (MT → CF)

#### Datos de Entrada
```json
{
  "tipo_cbte": 11,
  "pto_vta": 1,
  "fecha": "20241219",
  "cuit_emisor": "20123456789",
  "cuit_receptor": null,
  "razon_social_receptor": "CONSUMIDOR FINAL",
  "condicion_iva_receptor": "CF",
  "neto": 1000.00,
  "iva": 0.00,
  "total": 1000.00,
  "detalle": [
    {
      "descripcion": "Servicio de limpieza",
      "cantidad": 1,
      "precioUnitario": 1000.00,
      "alicuotaIva": 0
    }
  ]
}
```

#### Pasos de Ejecución
1. Configurar emisor como Monotributista
2. Emitir Factura C
3. Verificar sin IVA discriminado
4. Validar CAE específico para MT

#### Resultados Esperados
- ✅ **Tipo correcto**: Factura C (tipo 11)
- ✅ **Sin IVA**: Sin discriminación de IVA
- ✅ **CAE válido**: CAE específico para MT
- ✅ **PDF correcto**: Formato de Factura C

---

### Caso 5: Múltiples Alícuotas de IVA

#### Datos de Entrada
```json
{
  "tipo_cbte": 1,
  "pto_vta": 1,
  "fecha": "20241219",
  "cuit_emisor": "20123456789",
  "cuit_receptor": "20300123456",
  "razon_social_receptor": "CLIENTE RI S.A.",
  "condicion_iva_receptor": "RI",
  "neto": 2000.00,
  "iva": 420.00,
  "total": 2420.00,
  "detalle": [
    {
      "descripcion": "Producto con IVA 21%",
      "cantidad": 1,
      "precioUnitario": 1000.00,
      "alicuotaIva": 21
    },
    {
      "descripcion": "Producto con IVA 10.5%",
      "cantidad": 1,
      "precioUnitario": 1000.00,
      "alicuotaIva": 10.5
    }
  ]
}
```

#### Pasos de Ejecución
1. Emitir factura con múltiples alícuotas
2. Verificar agrupación correcta de IVA
3. Validar PDF con desglose de alícuotas

#### Resultados Esperados
- ✅ **Agrupación IVA**: IVA agrupado por alícuota
- ✅ **Totales correctos**: Suma correcta de alícuotas
- ✅ **PDF detallado**: Desglose en PDF

---

### Caso 6: Validación de Errores

#### Caso 6.1: Certificado Inválido
```bash
# Usar certificado expirado o inválido
AFIP_HOMOLOGACION_CERT_PATH=C:/certs/invalid.crt
```

**Resultado esperado:**
- ❌ Error: "Certificado inválido: [detalle del error]"
- ❌ No se genera PDF
- ✅ Log del error en archivo de logs

#### Caso 6.2: Datos Inválidos
```json
{
  "tipo_cbte": 1,
  "pto_vta": 999,  // Punto de venta inválido
  "fecha": "20241219",
  "neto": -1000,   // Importe negativo
  "total": 0       // Total cero
}
```

**Resultado esperado:**
- ❌ Error de validación antes de enviar a AFIP
- ❌ No se genera PDF
- ✅ Mensaje de error claro para el usuario

#### Caso 6.3: AFIP No Responde
```bash
# Simular timeout o error de red
AFIP_TIMEOUT=1000  # Timeout muy corto
```

**Resultado esperado:**
- ❌ Error: "AFIP no respondió o error de emisión"
- ✅ Comprobante marcado como pendiente
- ✅ Log del error con contexto

---

### Caso 7: Reintentos y Idempotencia

#### Pasos de Ejecución
1. Emitir factura exitosamente
2. Intentar emitir factura con mismos datos
3. Verificar que no se duplique
4. Verificar numeración correcta

#### Resultados Esperados
- ✅ **No duplicación**: No se genera CAE duplicado
- ✅ **Numeración correcta**: Números secuenciales
- ✅ **Logs de reintento**: Logs de intentos de reintento

---

### Caso 8: Validación de CAE

#### Pasos de Ejecución
1. Emitir factura y obtener CAE
2. Verificar CAE en sitio web de AFIP
3. Validar QR code
4. Verificar vencimiento

#### Resultados Esperados
- ✅ **CAE válido**: CAE verificado en AFIP
- ✅ **QR funcional**: QR redirige a AFIP correctamente
- ✅ **Vencimiento**: Fecha de vencimiento válida
- ✅ **Datos consistentes**: Datos en AFIP coinciden con PDF

## 📊 Métricas de Pruebas

### Criterios de Éxito
- **Tasa de éxito**: > 95% de casos exitosos
- **Tiempo de respuesta**: < 30 segundos por factura
- **Precisión de datos**: 100% de datos correctos
- **Cobertura de casos**: 100% de casos críticos probados

### Métricas a Capturar
```json
{
  "casos_ejecutados": 8,
  "casos_exitosos": 7,
  "casos_fallidos": 1,
  "tiempo_promedio": "15.2s",
  "errores_detectados": [
    "Certificado inválido",
    "Timeout AFIP"
  ],
  "cobertura": "87.5%"
}
```

## 🔍 Validación de Resultados

### Verificación Automática
```bash
# Script de validación
#!/bin/bash

echo "=== Validación de Pruebas AFIP ==="

# Verificar certificados
echo "1. Validando certificados..."
openssl x509 -in homologacion.crt -noout -text | grep "Not After"

# Verificar logs
echo "2. Verificando logs..."
tail -n 50 logs/afip/$(date +%Y%m%d).log

# Verificar PDFs generados
echo "3. Verificando PDFs..."
ls -la Documentos/facturas/*.pdf

# Verificar base de datos
echo "4. Verificando base de datos..."
sqlite3 facturas.db "SELECT COUNT(*) FROM facturas_afip WHERE fecha = '$(date +%Y-%m-%d)';"

echo "=== Validación completada ==="
```

### Verificación Manual
1. **Revisar PDFs**: Verificar formato y contenido
2. **Validar QR**: Escanear códigos QR
3. **Verificar CAE**: Consultar en sitio AFIP
4. **Revisar logs**: Analizar logs de errores
5. **Validar base de datos**: Verificar registros

## 📝 Documentación de Resultados

### Plantilla de Reporte
```markdown
# Reporte de Pruebas AFIP - [FECHA]

## Resumen
- **Casos ejecutados**: X/Y
- **Tasa de éxito**: XX%
- **Tiempo promedio**: XXs
- **Errores encontrados**: X

## Casos Exitosos
- [ ] Caso 1: Factura B - Productos
- [ ] Caso 2: Factura A - Servicios
- [ ] ...

## Casos Fallidos
- [ ] Caso X: [Descripción del error]

## Observaciones
- [Observaciones importantes]

## Recomendaciones
- [Recomendaciones para producción]

## Evidencias
- [Enlaces a PDFs, logs, screenshots]
```

## 🚨 Procedimientos de Emergencia

### Si AFIP No Responde
1. Verificar conectividad de red
2. Consultar estado de servicios AFIP
3. Revisar logs de error
4. Contactar soporte AFIP si es necesario

### Si Certificados Expirados
1. Generar nuevos certificados
2. Actualizar configuración
3. Probar en homologación
4. Actualizar en producción

### Si Errores Críticos
1. Detener emisión de facturas
2. Documentar error
3. Contactar equipo de desarrollo
4. Implementar solución

## ✅ Criterios de Aprobación

### Para Pasar a Producción
- [ ] Todos los casos críticos exitosos
- [ ] Tasa de éxito > 95%
- [ ] Tiempo de respuesta < 30s
- [ ] Sin errores críticos
- [ ] Documentación completa
- [ ] Evidencias de pruebas
- [ ] Aprobación del equipo

### Para Rechazar
- [ ] Tasa de éxito < 90%
- [ ] Errores críticos sin resolver
- [ ] Tiempo de respuesta > 60s
- [ ] Falta de documentación
- [ ] Sin evidencias de pruebas

---

**Nota**: Este plan debe ser ejecutado en cada versión del módulo antes de pasar a producción. Los resultados deben ser documentados y archivados para auditoría.
