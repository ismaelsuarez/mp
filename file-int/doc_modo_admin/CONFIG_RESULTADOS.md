## CONFIG – Resultados

### Objetivo
Explorar, filtrar y exportar los datos del último reporte generado.

### Filtros
- **Desde/Hasta**: restringe por fecha visible.
- **Estado**: filtra por estado de pago.
- **Buscar**: texto libre sobre campos relevantes.
- **Generar (rango)**: re-ejecuta con el rango elegido y actualiza la vista.
- **Reset**: limpia filtros y preferencias persistidas.

### Tabla y sumarios
- Paginación configurable (10/20/50/100).
- Muestra totales de ingresos, devoluciones y neto.

### Exportaciones y envío
- **CSV**, **XLSX**, **DBF**, **JSON**.
- **Enviar por email**: adjunta los archivos del día (si SMTP configurado).

### Referencias
- Implementación: `src/renderer.ts` (renderizado/acciones), `src/main.ts` (export/email handlers).
