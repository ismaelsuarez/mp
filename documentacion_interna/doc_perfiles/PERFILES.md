## Perfiles de Configuración – Definición y alcances

Esta app permite administrar conjuntos de configuración y permisos como “perfiles”. Cada perfil puede aplicarse en cualquier momento, sobrescribiendo la configuración activa y modificando qué módulos están visibles o editables.

### Modelo de datos

- id: número autoincremental (DB `perfiles_config`).
- nombre: etiqueta visible (ej. Administrador, Cajero, Vendedor).
- permisos: objeto booleano con flags:
  - facturacion: acceso a “Mercado Pago” y “📄 Facturación (AFIP)”.
  - caja: acceso al modo Caja desde la UI y desde el menú de bandeja.
  - administracion: acceso administrativo general (informativo; hoy se usa junto con `configuracion`).
  - configuracion: permiso para editar y guardar configuración. Cuando es false la UI queda en solo lectura.
  - consulta (opcional): pensado para perfiles de solo lectura. Actualmente funciona como indicador y se complementa con `configuracion=false`.
- parametros: JSON con valores a aplicar a la configuración (por ejemplo claves de Modo Imagen y FTP Server).

Persistencia: SQLite embebido (`better-sqlite3`) en tabla `perfiles_config` con serialización JSON de `permisos` y `parametros`.

### Perfiles base (semilla)

- Administrador
  - permisos: facturacion=true, caja=true, administracion=true, configuracion=true.
  - uso: acceso completo; edición habilitada.

- Cajero
  - permisos: facturacion=true, caja=true, administracion=false, configuracion=false.
  - uso: operar Caja y Facturación; no modifica configuración.

- Vendedor
  - permisos: facturacion=false, caja=true, administracion=false, configuracion=false, consulta=true.
  - uso: visualizar Imagen/FTP Server y consultar; no accede a Facturación.

Nota: se pueden crear perfiles adicionales o editar los existentes.

### Efectos actuales de cada permiso en la UI

- facturacion=false
  - Oculta las secciones “Mercado Pago” y “📄 Facturación (AFIP)”.

- caja=false
  - Deshabilita el botón “Modo Caja” en Configuración.
  - Deshabilita “Ir a Caja” en el menú del icono de bandeja (se muestra “(bloqueado por perfil)”).

- configuracion=false (y/o administracion=false)
  - Muestra un aviso amarilo en la parte superior: “Este perfil limita acciones…”.
  - Deshabilita el botón “Guardar configuración”.
  - Coloca el formulario en solo lectura (inputs y selects deshabilitados), dejando operativos los controles de Perfiles y navegación.

- consulta=true
  - Indicador de orientación de solo lectura. Se combina normalmente con `configuracion=false`.

Adicionales de UX:
- La cabecera muestra “Perfil activo: <nombre>” con color distintivo.
- El menú de bandeja muestra el estado arriba: “Perfil: <nombre>”.

### Parámetros típicos dentro de `parametros`

Suele incluir claves de Modo Imagen y FTP Server para que cada perfil tenga su propio preset:

```json
{
  "IMAGE_CONTROL_DIR": "C:\\tmp",
  "IMAGE_CONTROL_FILE": "direccion.txt",
  "IMAGE_WINDOW_SEPARATE": false,
  "IMAGE_WATCH": true,
  "IMAGE_PUBLICIDAD_ALLOWED": true,
  "IMAGE_PRODUCTO_NUEVO_ENABLED": true,
  "IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS": 10,
  "FTP_SRV_HOST": "0.0.0.0",
  "FTP_SRV_PORT": 2121,
  "FTP_SRV_USER": "user",
  "FTP_SRV_PASS": "pass",
  "FTP_SRV_ROOT": "C:\\tmp\\ftp_share",
  "FTP_SRV_ENABLED": true
}
```

### Consideraciones técnicas

- IPC expuesto: `perfiles:list|get|save|delete` vía `preload.ts` → `DbService`.
- Edición: modal propio con nombre, checkboxes de permisos y área de parámetros JSON.
- Aplicación de perfil: fusiona `parametros` con la configuración activa y guarda `ACTIVE_PERFIL_*` para re-aplicar permisos sin recargar.


