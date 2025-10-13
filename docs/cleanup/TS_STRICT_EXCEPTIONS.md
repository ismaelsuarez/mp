# TypeScript Strict - Excepciones Fase 1

**Fecha**: Octubre 2025  
**Estado**: strict mode habilitado como `false` en esta fase

## Estrategia

En Fase 1, `strict` está configurado en `false` en tsconfig.json para evitar romper builds existentes.

La habilitación de strict mode se hará gradualmente:
1. Identificar archivos con errores si habilitamos strict
2. Categorizar errores por complejidad
3. Corregir errores simples
4. Marcar errores complejos con `// @ts-expect-error TODO(phase-1)`

## TODO: Habilitar Strict Mode

```bash
# Para probar con strict mode:
# Editar tsconfig.json: "strict": true
# Ejecutar: pnpm build:ts
# Documentar errores aquí
```

## Total de excepciones: TBD

(Se completará cuando se habilite strict mode)

## Prioridad para resolución

1. **High**: Archivos críticos (main.ts, afip, watchers)
2. **Medium**: Servicios y utilidades
3. **Low**: Scripts y helpers

