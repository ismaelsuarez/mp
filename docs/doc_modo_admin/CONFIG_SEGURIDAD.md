## CONFIG – Seguridad

### Objetivo
Administrar credenciales del administrador de forma segura.

### Campos y acciones
- Contraseña actual
- Nueva contraseña y confirmación (validación en vivo)
- Nuevo usuario / frase secreta (opcional)
- Cambiar contraseña

### Errores amigables
- weak_password, invalid_current, invalid_secret, invalid_otp, not_initialized, no_email, locked

### Referencias
- `src/services/AuthService.ts`, `src/renderer.ts`
