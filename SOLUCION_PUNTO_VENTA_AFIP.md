# 🔧 Solución: Error 400 en Punto de Venta AFIP

## 📋 **Problema Identificado**

El error `"Request failed with status code 400"` en `getLastVoucher` indica que hay un problema con la configuración del punto de venta en AFIP.

## 🔍 **Diagnóstico**

### **Paso 1: Ejecutar Diagnóstico**
1. Abre la aplicación en **Modo Administración**
2. Ve a la sección **"Facturación AFIP"**
3. Haz clic en el botón **"Diagnosticar AFIP"** (nuevo botón púrpura)
4. Revisa los resultados que mostrarán:
   - ✅ **Puntos de Venta habilitados** en AFIP
   - ✅ **Tipos de Comprobante** habilitados
   - ❌ **Errores específicos** encontrados

### **Paso 2: Verificar Configuración**
El diagnóstico mostrará:
- **CUIT configurado**: Debe coincidir con tu CUIT en AFIP
- **Entorno**: Debe ser `homologacion` para pruebas
- **Punto de Venta**: Debe estar habilitado en AFIP

## 🛠️ **Soluciones Posibles**

### **Opción 1: Punto de Venta No Habilitado**
**Síntoma**: El diagnóstico muestra que tu punto de venta no aparece en la lista de habilitados.

**Solución**:
1. Ve a [AFIP - Punto de Venta](https://www.afip.gob.ar/ws/documentacion/ws-punto-venta.asp)
2. Inicia sesión con tu CUIT
3. Ve a **"Punto de Venta"** → **"Gestionar Punto de Venta"**
4. **Habilita** el punto de venta que tienes configurado
5. **Selecciona los tipos de comprobante** que necesitas (Factura A, B, etc.)

### **Opción 2: Tipo de Comprobante No Habilitado**
**Síntoma**: El punto de venta está habilitado pero no aparece el tipo de comprobante.

**Solución**:
1. En AFIP, ve a **"Punto de Venta"**
2. Selecciona tu punto de venta
3. Ve a **"Tipos de Comprobante"**
4. **Habilita** los tipos que necesitas:
   - **1** = Factura A
   - **6** = Factura B
   - **11** = Factura C

### **Opción 3: Entorno Incorrecto**
**Síntoma**: Estás en producción pero configurado en homologación.

**Solución**:
1. En la aplicación, verifica que el **entorno** esté configurado correctamente
2. Para **pruebas**: `homologacion`
3. Para **producción**: `produccion`

### **Opción 4: Certificado No Válido**
**Síntoma**: El certificado no es válido para el punto de venta.

**Solución**:
1. Verifica que el certificado esté **asociado** al CUIT correcto
2. Asegúrate de que el certificado esté **vigente**
3. Confirma que el certificado tenga **permisos** para el punto de venta

## 📝 **Pasos de Verificación**

### **1. Verificar en AFIP Web**
```
1. Ve a https://www.afip.gob.ar/ws/documentacion/ws-punto-venta.asp
2. Inicia sesión con tu CUIT
3. Ve a "Punto de Venta" → "Gestionar Punto de Venta"
4. Verifica que tu punto de venta esté habilitado
5. Verifica que los tipos de comprobante estén habilitados
```

### **2. Verificar Configuración Local**
```
1. En la aplicación, ve a "Configuración" → "Facturación AFIP"
2. Verifica que el CUIT coincida con el de AFIP
3. Verifica que el punto de venta coincida
4. Verifica que el entorno sea correcto
```

### **3. Ejecutar Diagnóstico**
```
1. Haz clic en "Diagnosticar AFIP"
2. Revisa los resultados:
   - Puntos de venta habilitados
   - Tipos de comprobante habilitados
   - Último autorizado
   - Errores específicos
```

## 🎯 **Configuración Recomendada para Pruebas**

### **En AFIP (Homologación)**:
- **CUIT**: Tu CUIT de prueba
- **Punto de Venta**: 1 (o el que tengas configurado)
- **Tipos habilitados**: 1 (Factura A), 6 (Factura B)

### **En la Aplicación**:
- **CUIT**: Mismo CUIT de AFIP
- **Punto de Venta**: Mismo número
- **Entorno**: `homologacion`
- **Certificado**: Certificado de homologación válido

## 🔄 **Después de Hacer Cambios**

1. **Espera 5-10 minutos** para que AFIP procese los cambios
2. **Ejecuta el diagnóstico** nuevamente
3. **Prueba la emisión** de factura

## 📞 **Si el Problema Persiste**

Si después de seguir estos pasos el problema persiste:

1. **Revisa los logs** de la aplicación
2. **Verifica la conectividad** a internet
3. **Confirma que AFIP no esté en mantenimiento**
4. **Contacta soporte** con los resultados del diagnóstico

---

## 📊 **Información del Diagnóstico**

El diagnóstico mostrará información como:

```
✅ Diagnóstico completado
Configuración: CUIT: 20123456789 | Entorno: homologacion | PtoVta: 1
Puntos de Venta habilitados: 1 (Punto de Venta 1), 2 (Punto de Venta 2)
Tipos de Comprobante habilitados: 1 (Factura A), 6 (Factura B)
Último autorizado: PtoVta 1, Tipo 1: 0
```

Si ves errores específicos, estos te indicarán exactamente qué necesitas configurar en AFIP.
