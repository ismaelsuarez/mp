// src/auth.ts - Renderer process para auth.html
import { appendLogLine } from './services/LogService';

// Tipos para window.auth
declare global {
  interface Window {
    auth: {
      isInitialized(): Promise<boolean>;
      getPolicy(): Promise<any>;
      setup(data: { username: string; password: string; secretPhrase: string }): Promise<void>;
      login(creds: { username: string; password: string }): Promise<{ ok: boolean; reason?: string; unlockAt?: number }>;
      change(data: { current: string; newPw: string; newUser?: string; newSecret?: string }): Promise<void>;
      requestOtp(): Promise<{ masked: string; ttl: number }>;
      resetByOtp(data: { otp: string; newPw: string }): Promise<void>;
      resetBySecret(data: { secretPhrase: string; newPw: string; newUser?: string }): Promise<void>;
    };
  }
}

// Función para mostrar errores de forma más amigable
function showError(message: string) {
  const errorMessages: { [key: string]: string } = {
    'weak_password': 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
    'invalid_current': 'Contraseña actual incorrecta',
    'invalid_secret': 'Frase secreta incorrecta',
    'invalid_otp': 'Código OTP inválido o expirado',
    'not_initialized': 'Sistema no inicializado',
    'no_email': 'Email no configurado para envío de códigos',
    'locked': 'Cuenta bloqueada temporalmente por múltiples intentos fallidos'
  };
  
  return errorMessages[message] || message;
}

// Función para validar contraseña en tiempo real
function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Mínimo 8 caracteres' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Debe contener un número' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Debe contener una mayúscula' };
  }
  return { valid: true, message: 'Contraseña válida' };
}

// Función para mostrar feedback de contraseña
function setupPasswordValidation(inputId: string, feedbackId?: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!input) return;
  
  input.addEventListener('input', () => {
    const validation = validatePassword(input.value);
    input.style.borderColor = validation.valid ? '#10b981' : '#ef4444';
    
    if (feedbackId) {
      const feedback = document.getElementById(feedbackId);
      if (feedback) {
        feedback.textContent = validation.message;
        feedback.className = validation.valid ? 'text-green-400 text-xs' : 'text-red-400 text-xs';
      }
    }
  });
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Configurar validación de contraseñas
    setupPasswordValidation('setup-pass');
    setupPasswordValidation('rec-secret-newpass');
    setupPasswordValidation('rec-email-newpass');
    
    // Verificar si el sistema está inicializado
    const isInit = await window.auth.isInitialized();
    
    if (!isInit) {
      // Mostrar formulario de setup
      document.getElementById('login-form')?.classList.add('hidden');
      document.getElementById('setup-form')?.classList.remove('hidden');
      document.getElementById('form-title')!.textContent = 'Configurar Administrador';
      document.getElementById('form-subtitle')!.textContent = 'Cree el usuario y contraseña';
    }
    
    appendLogLine('AUTH: Interfaz de autenticación cargada');
    
  } catch (error) {
    console.error('Error al inicializar auth:', error);
    alert('Error al cargar la interfaz de autenticación');
  }
});

// Exportar funciones para uso global
(window as any).authUtils = {
  showError,
  validatePassword
};
