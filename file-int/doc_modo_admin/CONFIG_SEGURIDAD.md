## CONFIG – Seguridad

### Objetivo
Administrar credenciales del administrador y actualizar contraseña/usuario/frase secreta de forma segura.

### Campos y acciones
- **Contraseña actual**: requerida para validar el cambio.
- **Nueva contraseña** y **Confirmación**: con validación en tiempo real (mínimo 8, al menos 1 número y 1 mayúscula).
- **Nuevo usuario** (opcional).
- **Nueva frase secreta** (opcional).
- **Cambiar contraseña**: aplica cambios si todas las validaciones son correctas.

### Errores amigables
- Mensajes comunes: `weak_password`, `invalid_current`, `invalid_secret`, `invalid_otp`, `not_initialized`, `no_email`, `locked`.
- Se muestran en la UI con textos claros y se registran en logs.

### Referencias
- Implementación: `src/services/AuthService.ts`, `src/renderer.ts` (UI de validación y mensajes).
