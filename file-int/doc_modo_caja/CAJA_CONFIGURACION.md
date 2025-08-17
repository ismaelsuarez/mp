## CAJA – Botón Configuración

### Objetivo
Permitir cambiar rápidamente a la vista de Administración para editar parámetros y luego regresar a Caja.

### Ubicación
- Navbar superior de Modo Caja → botón `Configuración`.

### Comportamiento
- Invoca `openView('config')` al proceso principal.
- Ajusta tamaño de ventana al modo Administración (amplio) y centra la ventana.
- Desde Administración, los cambios impactan en los próximos ciclos/acciones.

### Notas
- Si existen políticas de licencia o autenticación, se respeta el gateway de acceso antes de abrir Configuración.

### Referencias
- Implementación: `src/caja.ts` (UI), `src/main.ts` (handler `open-view`).
