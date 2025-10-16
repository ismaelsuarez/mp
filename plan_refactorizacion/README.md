# Plan de Refactorización Profesional - TC-MP

## Contexto

Este documento describe el plan completo de refactorización profesional del proyecto TC-MP, una aplicación Electron para Windows que gestiona pagos de Mercado Pago e integración con AFIP/ARCA.

**Estado del proyecto**: Producción activa - NO se puede romper funcionalidad existente.

## Repositorio

https://github.com/ismaelsuarez/mp

## Principios No Negociables

1. **Cero cambios funcionales**: Cada fase debe mantener toda la funcionalidad existente
2. **TypeScript estricto**: `"strict": true` en todo el código, sin `any`
3. **Testing con Vitest**: Framework unificado para unit/integration/E2E
4. **Monorepo PNPM**: Node 18.20.4, PNPM workspace
5. **Arquitectura limpia**: Separación frontend/backend/electron, capas core/infra
6. **Seguridad**: Secretos en keytar, logs con redacción, configuración por UI
7. **Resiliencia**: Timeout, retries, circuit-breaker, watchers robustos
8. **Calidad**: ESLint/Prettier estrictos, sin console.log en prod, coverage ≥80%

## Objetivos Generales

### Requisitos No Funcionales

- **Velocidad**: Tiempo de arranque UI, builds y tests rápidos
- **Escalabilidad**: Arquitectura modular y extensible
- **Robustez**: Reintentos/timeout/circuit-breaker, watchers a prueba de fallos
- **Seguridad**: Secretos en keytar, logs con redacción, nada sensible en web
- **Versatilidad**: Paquetes reutilizables, path-aliases, CI/CD

### Buenas Prácticas (Exigidas por Homologación)

- TS sin errores ni warnings
- ESLint sin warnings
- Prettier consistente
- Sin console.log en producción (usar logger)
- Nombres descriptivos en inglés
- Patrones Repository/Service/Controller
- Validación con Zod
- Manejador de errores centralizado

## Estructura Final del Monorepo

```
mp/
├── apps/
│   ├── electron/                # App Electron: main/preload/renderer + Settings UI
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── renderer/
│   ├── web/                     # (Opcional) Next.js frontend
│   │   ├── src/
│   │   ├── pages/
│   │   └── components/
│   └── server/                  # Backend HTTP (API REST)
│       └── src/
│           ├── app.ts
│           ├── routes/
│           ├── controllers/     # Controller (HTTP)
│           ├── services/        # Orquesta casos de uso
│           ├── repositories/    # Repository pattern
│           ├── adapters/        # Puentes server ⇆ infra/core
│           ├── middlewares/
│           └── schemas/         # Zod: DTO/validations
├── packages/
│   ├── core/                    # Dominio puro (MP/ARCA/AFIP, reglas, PDFs)
│   │   └── src/index.ts
│   ├── infra/                   # Integraciones/soporte plataforma
│   │   └── src/
│   │       ├── http/            # axios/fetch con timeout, retries, CB
│   │       ├── watchers/        # safeWatch (rename atómico, cola, dedupe)
│   │       ├── logger/          # pino con redaction + correlation-id
│   │       └── config/          # loader desde UI
│   ├── shared/                  # Tipos/utilidades/constantes puras
│   │   ├── types/
│   │   ├── utils/
│   │   └── constants/
│   ├── ui/                      # Componentes UI compartidos
│   └── config/                  # tsconfig/eslint/vitest compartidos
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── smoke/
└── docs/
```

## Path Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["packages/core/src/*"],
      "@infra/*": ["packages/infra/src/*"],
      "@shared/*": ["packages/shared/src/*"],
      "@electron/*": ["apps/electron/*"]
    }
  }
}
```

## Plan de Ejecución por Fases

### [Fase 1 - Red de Seguridad + Estructura Base](./FASE_01_estructura_testing.md) ✅ EN EJECUCIÓN

**Objetivo**: Crear esqueleto monorepo, TS estricto, testing con Vitest, sin cambios funcionales.

**Duración estimada**: 2-3 días

**Entregables**:
- Estructura apps/ y packages/ (esqueletos)
- Path aliases configurados
- TypeScript strict habilitado
- Testing unificado en Vitest
- CI básica
- Reportes de limpieza

### [Fase 2 - Migración Gradual a @core/@infra/@shared](./FASE_02_migracion_gradual.md)

**Objetivo**: Mover 1 dominio por vez sin romper imports (shims/barrels).

**Duración estimada**: 1-2 semanas

**Entregables**:
- Lógica de dominio en packages/core
- Integraciones en packages/infra
- Utils/tipos en packages/shared
- Imports actualizados con path aliases
- Smokes y CI verdes

### [Fase 3 - Config por UI + Seguridad](./FASE_03_config_ui_seguridad.md)

**Objetivo**: Reemplazar .env por Settings UI + electron-store cifrado + keytar.

**Duración estimada**: 1 semana

**Entregables**:
- Settings UI implementada
- electron-store con cifrado
- Secretos en keytar
- IPC settings:get/set/test
- Perfiles homologation/production

### [Fase 4 - Infra Resiliente](./FASE_04_infra_resiliente.md)

**Objetivo**: HTTP con timeouts/retries/CB, logger con redacción, manejo de errores.

**Duración estimada**: 1 semana

**Entregables**:
- HTTP resiliente (timeout, retries, circuit-breaker)
- Logger pino con redacción y correlation-id
- Manejador de errores centralizado
- Resiliencia ante fallos transitorios

### [Fase 5 - Watchers Robustos](./FASE_05_watchers_robustos.md)

**Objetivo**: Anti archivos parciales, backpressure, restart seguro.

**Duración estimada**: 1 semana

**Entregables**:
- awaitWriteFinish + rename atómico
- Cola con p-limit
- Dedupe por hash con TTL
- 0 reprocesos, 0 lecturas parciales

### [Fase 6 - Optimización](./FASE_06_optimizacion.md)

**Objetivo**: Bundle, Next.js, Electron optimizados.

**Duración estimada**: 3-5 días

**Entregables**:
- Bundle analyzer + tree-shaking
- Next.js optimizado (si existe apps/web)
- Electron builder optimizado
- Reporte antes/después

### [Fase 7 - Testing y Cobertura](./FASE_07_testing_cobertura.md)

**Objetivo**: Coverage ≥80% con Vitest.

**Duración estimada**: 1-2 semanas

**Entregables**:
- Tests unit/integration/E2E
- Coverage ≥80%
- RTL para React (si aplica)
- Suites verdes en CI

### [Fase 8 - Build & Config Profesional](./FASE_08_build_config.md)

**Objetivo**: ESLint/Prettier estrictos, build prod sin warnings.

**Duración estimada**: 3-5 días

**Entregables**:
- .eslintrc estricto
- .prettierrc configurado
- Build Windows (exe)
- Auto-update funcional
- Sin console.log en prod

### [Fase 9 - Documentación + Homologación](./FASE_09_documentacion.md)

**Objetivo**: Docs completas + checklist de homologación.

**Duración estimada**: 3-5 días

**Entregables**:
- README.md profesional
- CHANGELOG.md
- docs/ARCHITECTURE.md
- docs/API.md
- Checklist de homologación verificado

## Duración Total Estimada

**8-12 semanas** (2-3 meses) dependiendo de complejidad y recursos.

## Estrategia de Rollback

- Cada fase en rama separada con PR
- PRs pequeños y descriptivos
- Shims/barrels para mantener compatibilidad
- Smoke tests antes de merge
- No "big bang", migración gradual

## Métricas de Éxito

| Métrica | Antes | Objetivo Final |
|---------|-------|----------------|
| TypeScript errors | ? | 0 |
| ESLint warnings | ? | 0 |
| Test coverage | ? | ≥80% |
| Build time | ? | <30s |
| Startup time | ? | <3s |
| Bundle size | ? | Optimizado |
| Console.log en prod | ? | 0 |

## Responsabilidades

- **Arquitecto/a**: Revisión de arquitectura, validación de fases
- **Dev**: Implementación según plan
- **QA**: Smoke tests, validación funcional
- **DevOps**: CI/CD, builds, despliegues

## Documentos de Referencia

- [Fase 1: Estructura + Testing](./FASE_01_estructura_testing.md)
- [Fase 2: Migración Gradual](./FASE_02_migracion_gradual.md)
- [Fase 3: Config UI + Seguridad](./FASE_03_config_ui_seguridad.md)
- [Fase 4: Infra Resiliente](./FASE_04_infra_resiliente.md)
- [Fase 5: Watchers Robustos](./FASE_05_watchers_robustos.md)
- [Fase 6: Optimización](./FASE_06_optimizacion.md)
- [Fase 7: Testing + Cobertura](./FASE_07_testing_cobertura.md)
- [Fase 8: Build + Config](./FASE_08_build_config.md)
- [Fase 9: Documentación](./FASE_09_documentacion.md)

## Contacto y Soporte

Para dudas o consultas sobre el plan de refactorización, contactar al equipo de arquitectura.

---

**Última actualización**: Octubre 2025
**Versión**: 1.0.0
**Estado**: Fase 1 en ejecución

