## CONFIG – Notificaciones de Error

### Objetivo
Evitar spam y enviar alertas por email de errores agrupados con umbrales y ventana de enfriamiento.

### Campos
- **Habilitar**: activa el sistema.
- **Mínimo errores antes de notificar**: umbral por grupo de error.
- **Tiempo entre notificaciones (minutos)**: período mínimo entre envíos por el mismo grupo.

### Acciones
- **Actualizar**: refresca el resumen.
- **Guardar**: persiste la configuración.
- **Limpiar Errores Antiguos**: elimina registros > 24 horas.
- **Resetear Todo**: borra estado interno y contadores.

### Resumen
- Muestra: total de errores, grupos activos y notificaciones enviadas.

### Requisitos
- Requiere `EMAIL_REPORT`/SMTP configurado.

### Referencias
- Implementación: `src/services/ErrorNotificationService.ts`, `src/main.ts` (handlers), `src/renderer.ts` (UI de botones y resumen).
