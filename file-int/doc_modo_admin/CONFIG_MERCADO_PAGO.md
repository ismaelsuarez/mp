## CONFIG – Mercado Pago

### Objetivo
Configurar credenciales y parámetros para consultar `payments/search` del SDK oficial.

### Campos
- **Access Token** (`MP_ACCESS_TOKEN`): token de producción `APP_USR-...`.
- **ID de usuario** (`MP_USER_ID`, opcional): id o alias de cuenta.
- **Zona horaria** (`MP_TZ`): ej. `America/Argentina/Buenos_Aires`.
- **Hora de inicio/fin** (`MP_WINDOW_START` / `MP_WINDOW_END`): define el día operativo en la TZ configurada.
- **Desde/Hasta** (`MP_DATE_FROM` / `MP_DATE_TO`): rango manual (días completos). 
- **Sin filtro de fechas** (`MP_NO_DATE_FILTER`): consulta sin acotar por fechas (diagnóstico; usar con cautela).
- **Días hacia atrás** (`MP_DAYS_BACK`): fallback si no hay fechas (hoy - N días).
- **Campo de fecha** (`MP_RANGE`): `date_created` | `date_approved` | `date_last_updated`.
- **Estado** (`MP_STATUS`): ej. `approved` o `approved,refunded`.
- **Paginación** (`MP_LIMIT`, `MP_MAX_PAGES`): ítems por página y cantidad de páginas.

### Acciones
- **Probar conexión**: valida credenciales y permisos contra MP.

### Notas
- Errores por token inválido se transforman en mensajes amigables y se registran en logs.
- La ventana diaria usa TZ para evitar desfasajes en límites del día.

### Referencias
- Implementación: `src/services/MercadoPagoService.ts`, `src/main.ts` (handlers), `src/renderer.ts` (UI).
