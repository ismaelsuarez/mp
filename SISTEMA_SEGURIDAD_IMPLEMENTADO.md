# SISTEMA DE SEGURIDAD IMPLEMENTADO

## RESUMEN EJECUTIVO

Se ha implementado un sistema completo de autenticación y seguridad para el modo administrador del proyecto MP, siguiendo las especificaciones del archivo `Seguridad.txt`. El sistema protege el acceso a la configuración del sistema mediante un gate de autenticación robusto.

---

## ARQUITECTURA DE SEGURIDAD

### 1. COMPONENTES PRINCIPALES

#### 1.1 AuthService (`src/services/AuthService.ts`)
**Responsabilidad:** Núcleo del sistema de autenticación
- **Hash Argon2id:** Para contraseñas y frases secretas
- **Políticas de seguridad:** Validación de contraseñas robustas
- **Rate limiting:** Bloqueo temporal tras múltiples intentos fallidos
- **Throttling:** Protección contra ataques de tiempo
- **Auditoría:** Logs de todos los eventos de autenticación

#### 1.2 OtpService (`src/services/OtpService.ts`)
**Responsabilidad:** Gestión de códigos OTP por email
- **Generación:** Códigos de 6 dígitos con expiración de 10 minutos
- **Envío:** Integración con EmailService existente
- **Validación:** Verificación de códigos y limpieza automática

#### 1.3 Interfaz de Autenticación (`public/auth.html`)
**Responsabilidad:** UI de autenticación con 3 vistas
- **Login:** Autenticación estándar
- **Setup Admin:** Configuración inicial del administrador
- **Recuperación:** Reset por frase secreta o email OTP

---

## FUNCIONALIDADES IMPLEMENTADAS

### 1. GATE DE AUTENTICACIÓN

#### 1.1 Flujo de Acceso
```
Modo Caja → "Configuración" → auth.html → Verificación → config.html
```

**Proceso:**
1. Usuario selecciona "Configuración" desde modo caja
2. Sistema abre `auth.html` en lugar de `config.html`
3. Si no hay credenciales → muestra Setup Admin
4. Si hay credenciales → muestra Login
5. Login exitoso → redirige a `config.html`

#### 1.2 Estados de Autenticación
- **No inicializado:** Primer arranque, requiere setup
- **Autenticado:** Acceso completo a configuración
- **Bloqueado:** Cuenta suspendida por intentos fallidos
- **Recuperación:** Proceso de reset activo

### 2. POLÍTICAS DE SEGURIDAD

#### 2.1 Validación de Contraseñas
```typescript
const POLICY = {
  minLength: 8,           // Mínimo 8 caracteres
  requiresNumber: true,   // Debe contener número
  requiresUpper: true,    // Debe contener mayúscula
  maxAttempts: 5,         // Máximo 5 intentos fallidos
  lockoutMinutes: 5,      // Bloqueo de 5 minutos
  throttleMs: 150         // Throttle de 150ms
};
```

#### 2.2 Rate Limiting
- **5 intentos fallidos** → Bloqueo automático de 5 minutos
- **Throttle de 150ms** → Protección contra ataques de tiempo
- **Reset automático** → Contador se reinicia tras bloqueo

### 3. RECUPERACIÓN DE ACCESO

#### 3.1 Opción A: Frase Secreta
- **Obligatoria** al crear la cuenta
- **Hash Argon2id** para almacenamiento seguro
- **Permite reset** de contraseña y usuario opcional

#### 3.2 Opción B: Email OTP
- **6 dígitos** con expiración de 10 minutos
- **Integración SMTP** usando configuración existente
- **Email enmascarado** para privacidad

### 4. ALMACENAMIENTO SEGURO

#### 4.1 Estructura de Datos
```typescript
type AuthState = {
  username?: string;           // Usuario actual
  passwordHash?: string;       // Hash Argon2id de contraseña
  secretPhraseHash?: string;   // Hash Argon2id de frase secreta
  failedCount?: number;        // Contador de intentos fallidos
  lockedUntil?: number;        // Timestamp de bloqueo
};
```

#### 4.2 Persistencia
- **electron-store** con encriptación AES
- **Separación** de datos de autenticación y configuración
- **Sin datos sensibles** en logs

---

## INTERFACES DE USUARIO

### 1. auth.html - Interfaz de Autenticación

#### 1.1 Vista Login
- **Campos:** Usuario y contraseña
- **Link:** "¿Olvidaste tu contraseña?"
- **Validación:** En tiempo real
- **Feedback:** Mensajes de error claros

#### 1.2 Vista Setup Admin
- **Campos:** Usuario, contraseña, frase secreta
- **Validación:** Políticas de contraseña
- **Obligatorio:** Frase secreta para recuperación

#### 1.3 Vista Recuperación
- **Tabs:** Frase secreta y Email OTP
- **Validación:** Códigos y frases
- **Feedback:** Estado de envío y validación

### 2. config.html - Sección Seguridad

#### 2.1 Cambio de Contraseña
- **Validación:** Contraseña actual requerida
- **Políticas:** Aplicación de reglas de seguridad
- **Opcional:** Cambio de usuario y frase secreta

---

## COMUNICACIÓN IPC

### 1. Handlers Principales

#### 1.1 Verificación y Setup
```typescript
'auth:is-initialized' → boolean
'auth:get-policy' → Policy object
'auth:setup' → { username, password, secretPhrase }
```

#### 1.2 Autenticación
```typescript
'auth:login' → { ok: boolean, reason?: string, unlockAt?: number }
'auth:change' → { current, newPw, newUser?, newSecret? }
```

#### 1.3 Recuperación
```typescript
'auth:request-otp' → { masked: string, ttl: number }
'auth:reset-by-otp' → { otp, newPw }
'auth:reset-by-secret' → { secretPhrase, newPw, newUser? }
```

#### 1.4 Navegación
```typescript
'auth:open-config' → Abre config.html tras login exitoso
```

### 2. Bridge Preload
```typescript
window.auth = {
  isInitialized, getPolicy, setup, login,
  change, requestOtp, resetByOtp, resetBySecret, openConfig
}
```

---

## AUDITORÍA Y LOGS

### 1. Eventos Registrados
- **Creación de administrador**
- **Intentos de login** (exitosos y fallidos)
- **Bloqueos de cuenta**
- **Cambios de contraseña**
- **Resets por frase secreta**
- **Envío y validación de OTP**

### 1.2 Formato de Logs
```
2024-01-15T10:30:00.000Z AUTH: Administrador creado: admin
2024-01-15T10:35:00.000Z AUTH: Login exitoso: admin
2024-01-15T10:40:00.000Z AUTH: Login fallido - intento 1/5
2024-01-15T10:45:00.000Z AUTH: OTP enviado a: a***@example.com
```

### 1.3 Seguridad de Logs
- **Sin datos sensibles** (contraseñas, tokens)
- **Enmascaramiento** de emails
- **Información contextual** para auditoría

---

## INTEGRACIÓN CON SISTEMA EXISTENTE

### 1. Compatibilidad
- **No afecta** funcionalidades de Mercado Pago
- **No interfiere** con automatización
- **Mantiene** configuración existente
- **Preserva** logs y reportes

### 2. Configuración
- **Email SMTP** reutilizado para OTP
- **electron-store** compartido con encriptación
- **LogService** integrado para auditoría

### 3. Flujo de Navegación
- **Modo Caja** → Acceso directo sin autenticación
- **Configuración** → Gate de autenticación obligatorio
- **Persistencia** → Estado mantenido entre sesiones

---

## PRUEBAS Y VALIDACIÓN

### 1. Checklist de Pruebas
- [x] **Primer arranque** → Setup Admin automático
- [x] **Creación de credenciales** → Validación de políticas
- [x] **Login exitoso** → Redirección a config.html
- [x] **5 intentos fallidos** → Bloqueo automático
- [x] **Recuperación por frase** → Reset exitoso
- [x] **OTP por email** → Envío y validación
- [x] **Cambio de contraseña** → Desde configuración
- [x] **Logs de auditoría** → Sin datos sensibles

### 2. Casos de Uso
- **Administrador único** → Control total del sistema
- **Recuperación de acceso** → Múltiples opciones
- **Auditoría completa** → Trazabilidad de acciones
- **Seguridad robusta** → Protección contra ataques

---

## CONSIDERACIONES TÉCNICAS

### 1. Dependencias
- **argon2** → Hashing seguro de contraseñas
- **electron-store** → Persistencia encriptada
- **nodemailer** → Envío de OTP (ya integrado)

### 2. Rendimiento
- **Throttling** → 150ms para evitar ataques de tiempo
- **Hash asíncrono** → No bloquea la UI
- **Validación en tiempo real** → Feedback inmediato

### 3. Seguridad
- **Argon2id** → Algoritmo recomendado para contraseñas
- **Rate limiting** → Protección contra fuerza bruta
- **Encriptación AES** → Datos sensibles protegidos
- **Logs seguros** → Sin exposición de secretos

---

## CONCLUSIÓN

El sistema de seguridad implementado proporciona:

1. **Protección robusta** del modo administrador
2. **Múltiples opciones** de recuperación de acceso
3. **Auditoría completa** de eventos de seguridad
4. **Integración transparente** con el sistema existente
5. **Experiencia de usuario** intuitiva y segura

El sistema cumple con todas las especificaciones del archivo `Seguridad.txt` y mantiene la compatibilidad total con las funcionalidades existentes del proyecto MP.
