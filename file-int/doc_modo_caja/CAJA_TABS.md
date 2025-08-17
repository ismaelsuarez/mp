## CAJA – Pestañas Inicio y Movimientos

### Objetivo
Separar acciones principales de la visualización de movimientos en una UI compacta y clara.

### Pestañas
- **Inicio**: botón “Descargar MP”, panel de logs e indicadores inferiores (auto, contador, “Hoy”).
- **Movimientos**: tabla con últimos registros curados (ver `CAJA_MOVIMIENTOS.md`).

### Navegación
- Las pestañas alternan visibilidad de secciones (`selectPane('home'|'table')`).
- La pestaña activa queda resaltada para claridad visual.

### Referencias
- Implementación: `public/caja.html`, `src/caja.ts`.
