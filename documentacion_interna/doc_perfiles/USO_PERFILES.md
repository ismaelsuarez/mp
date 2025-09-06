## Cómo usar Perfiles de Configuración

Este instructivo describe los pasos para crear, editar, aplicar, exportar e importar perfiles.

### 1) Abrir la sección

En Configuración, arriba del todo aparece el bloque “🧩 Perfiles de Configuración”. Todos los demás bloques vienen plegados por defecto.

### 2) Seleccionar / Ver

- Usa el desplegable “Seleccionar Perfil” para elegir uno.
- Debajo se muestra una vista previa JSON del perfil (nombre, permisos, parámetros).

### 3) Aplicar un perfil

- Botón “Aplicar perfil”. Confirma el mensaje.
- La app fusiona los `parametros` del perfil con la configuración activa y aplica los permisos:
  - Oculta módulos si corresponde (Facturación/Mercado Pago).
  - Deshabilita “Modo Caja” y el menú de bandeja si `caja=false`.
  - Pone el formulario en solo lectura si `configuracion=false`.
  - La cabecera indica el estado (“Perfil activo: …”) y el menú de bandeja lo muestra arriba.

### 4) Editar un perfil

- Botón “Editar”. En el modal:
  - Cambia el nombre si lo deseas.
  - Tilda/destilda permisos: Facturación, Caja, Administración, Configuración, Consulta.
  - Parámetros (JSON):
    - “Cargar desde configuración (Imagen + FTP Server)” trae las claves actuales de Imagen/FTP.
    - Puedes ajustar valores y guardar.

### 5) Guardar como nuevo

- Toma la configuración actual de la app y crea un nuevo perfil. Útil para “fotografiar” una instalación.

### 6) Exportar / Importar

- Exportar descarga `perfil-<nombre>.json` para respaldo o traslado a otra PC.
- Importar permite subir el `.json` y lo guarda como perfil en la base local.

### 7) Buenas prácticas

- Mantener “Administrador” como perfil master con edición habilitada.
- “Cajero”: facturación y caja activas; configuración deshabilitada.
- “Vendedor”: solo consulta/imagen/FTP; sin facturación ni configuración.
- Si el perfil cambia a menudo por puesto, usar “Guardar como nuevo” para registrar variantes.

### 8) Recuperación / Diagnóstico

- “Vista previa no sensible” permite auditar la configuración vigente sin exponer secretos.
- Si algo no se refleja, aplicar el perfil nuevamente y reabrir el menú de bandeja para refrescar.


