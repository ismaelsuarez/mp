# Smoke Test: Generación de PDFs

## Objetivo
Verificar que la generación de PDFs funciona igual que antes.

## Pre-requisitos
- Build compilado
- Archivo .fac de prueba en tmp/controlar/

## Pasos

### 1. Generar PDF desde .fac
```bash
pnpm pdf:example
```

**Esperado**:
- [ ] PDF generado en test-output/
- [ ] Contenido correcto (QR, datos, formato)
- [ ] Sin errores en consola

### 2. Calibración
```bash
pnpm pdf:calibrate
```

**Esperado**:
- [ ] calibration.pdf generado
- [ ] Formato correcto

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas

