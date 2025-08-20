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

### Cambio de comportamiento (v1.0.10)
- Al iniciar la app con `DEFAULT_VIEW=config`, la primera pantalla es siempre `auth.html` para solicitar credenciales antes de abrir `config.html`.
- Desde la bandeja o navegación, cuando se elige “Ir a Configuración”, también se abre `auth.html` previamente.