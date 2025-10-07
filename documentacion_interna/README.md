### Documentación interna — Índice y lineamientos

Este índice reúne la documentación vigente. Si un archivo no aparece aquí, se considera obsoleto o de referencia histórica y puede archivarse en `docs_varios/` o eliminarse si corresponde.

#### 1) Facturación (AFIP/WSFE, .fac, contingencia)
- `facturacion-auditoria.md` (canónico): arquitectura y flujos UI/.fac, cola de contingencia, logs, criterios de aceptación, MTXCA, moneda y cotización.
- `NC-plan-378e165.md`: guía de portado de Notas de Crédito (NC) desde el commit estable; reglas de `CbtesAsoc`, consolidado de IVA y delegación en `FacturacionService`.

#### 2) Arquitectura de la app
- `ui-architecture.md`: estructura del proceso Electron (main/renderer), IPC y módulos UI.
- `code-architecture-audit.md`: principios y dependencias a alto nivel.
- `INFORME_TECNICO_MERCADO_PAGO.md`: flujo Mercado Pago (consulta → reportes → FTP mp.dbf).

#### 3) Base de datos y performance
- `sqlite-usage.md`: pautas de uso de SQLite (PRAGMAs, WAL, concurrencia) y buenas prácticas.

#### 4) Moneda y cotización (AFIP)
- `cotizacion-usd-tecnico.md`: consulta y políticas de cotización (WSFE), rangos y tolerancias.

#### 5) Notificaciones y representación
- `INFORME_TECNICO_PDF_SMS.md`: envío y representación PDF/SMS.

#### 6) Carpetas temáticas (vigentes)
- `doc_afip/`: referencias y notas específicas de AFIP.
- `doc_modo_admin/`, `doc_modo_caja/`, `doc_modo_imagen/`: documentación por modo de operación (mantener actualizada según releases).
- `docs_auditoria_app_arca_Afip/`: insumos de auditoría y ARCA.

#### 7) Organización y mantenimiento
- Este README es el índice canónico. Al agregar o deprecar documentos, actualice este índice.
- Duplicados o documentos antiguos deben moverse a `docs_varios/` o eliminarse si ya están cubiertos por los archivos canónicos arriba listados.
- Para .fac y NC, use siempre `facturacion-auditoria.md` y `NC-plan-378e165.md` como referencia.


