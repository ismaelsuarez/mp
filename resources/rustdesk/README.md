# Binarios RustDesk

Este directorio debe contener los binarios de RustDesk necesarios para el módulo de Control Remoto.

## Archivos Requeridos

- `rustdesk.exe` - Binario principal de RustDesk para Windows

## Instrucciones de Instalación

1. **Descargar RustDesk**:
   - Ve a [RustDesk Releases](https://github.com/rustdesk/rustdesk/releases)
   - Descarga la versión más reciente para Windows (rustdesk-X.X.X-x86_64.exe)

2. **Instalar en este directorio**:
   ```bash
   # Renombrar el archivo descargado
   mv rustdesk-X.X.X-x86_64.exe resources/rustdesk/rustdesk.exe
   ```

3. **Verificar instalación**:
   ```bash
   # El directorio debe contener
   resources/rustdesk/
   ├── rustdesk.exe        # Binario principal
   └── README.md          # Este archivo
   ```

## Configuración de Build

Los binarios en este directorio serán automáticamente incluidos en el instalador de MP Reports gracias a la configuración `extraResources` en `package.json`.

## Permisos

Asegúrate de que `rustdesk.exe` tenga permisos de ejecución:

```bash
chmod +x resources/rustdesk/rustdesk.exe
```

## Verificación

Para verificar que el binario funciona correctamente:

```bash
# Probar ejecución básica
./resources/rustdesk/rustdesk.exe --help
```

## Notas Importantes

- **Tamaño**: RustDesk es un binario relativamente grande (~15-20MB)
- **Versión**: Usar siempre la versión estable más reciente
- **Arquitectura**: Solo se soporta x64 (64-bit)
- **Sistema**: Solo Windows está configurado actualmente

## Troubleshooting

### Error: "rustdesk.exe no encontrado"
- Verificar que el archivo existe en `resources/rustdesk/rustdesk.exe`
- Verificar permisos de lectura/ejecución

### Error: "Acceso denegado"
- Ejecutar como administrador si es necesario
- Verificar antivirus (puede bloquear ejecutables externos)

### Error de dependencias
- Instalar Visual C++ Redistributable si es requerido
- Verificar que Windows está actualizado

---

**Nota**: Los binarios de RustDesk están sujetos a sus propios términos de licencia. Ver [RustDesk License](https://github.com/rustdesk/rustdesk/blob/master/LICENSE) para más información.
