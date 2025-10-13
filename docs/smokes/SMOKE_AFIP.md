# Smoke Test: Integración AFIP

## Objetivo
Verificar que la integración con AFIP funciona igual.

## Pre-requisitos
- Credenciales de homologación configuradas
- Certificados válidos

## Pasos

### 1. Autenticación
```bash
pnpm diagnostico:afip
```

**Esperado**:
- [ ] Login exitoso
- [ ] Ticket de acceso obtenido
- [ ] Sin errores

### 2. Consulta de padrón (si aplica)
- [ ] Consulta exitosa
- [ ] Datos correctos

### 3. Facturación (ambiente homo)
- [ ] Generar factura de prueba
- [ ] CAE obtenido
- [ ] PDF generado correctamente

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas

