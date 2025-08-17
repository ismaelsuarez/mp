## CONFIG – Acciones principales

### Objetivo
Ejecutar operaciones clave sin cambiar de sección y verificar la configuración guardada.

### Botones
- **Cargar configuración**: obtiene la configuración persistida.
- **Guardar configuración**: persiste los campos actuales.
- **Generar reporte**: ejecuta consulta/generación, intenta FTP de `mp.dbf` y lleva a Resultados.
- **Enviar DBF por FTP**: reenvía manualmente `mp.dbf` del día.
- **Limpiar Hash FTP**: fuerza que el próximo envío no sea “sin cambios”.

### Vista previa (no sensible)
- Muestra JSON con valores guardados, enmascarando secretos (token/contraseña). Sirve para verificación rápida.

### Referencias
- Implementación: `src/renderer.ts` (handlers de botones) y `src/main.ts` (handlers IPC).
