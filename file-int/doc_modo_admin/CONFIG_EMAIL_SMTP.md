## CONFIG – Email / SMTP

### Objetivo
Permitir el envío por correo de los archivos generados (CSV, XLSX, DBF y JSON).

### Campos
- **Email para reportes** (`EMAIL_REPORT`): destinatario principal.
- **Servidor SMTP** (`SMTP_HOST`): ej. `smtp.gmail.com`.
- **Puerto SMTP** (`SMTP_PORT`): ej. `587`.
- **Usuario/Contraseña** (`SMTP_USER` / `SMTP_PASS`).

### Uso
- En Resultados, el botón “Enviar por email” usa estos valores para adjuntar los archivos del día.

### Notas
- Se recomienda una casilla dedicada y políticas adecuadas (app passwords, 2FA, etc.).

### Referencias
- Implementación: `src/services/EmailService.ts`, `src/main.ts` (handler `send-report-email`).
