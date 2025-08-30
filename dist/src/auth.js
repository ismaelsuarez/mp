"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/auth.ts - Renderer process para auth.html
const LogService_1 = require("./services/LogService");
// Función para mostrar errores de forma más amigable
function showError(message) {
    const errorMessages = {
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
function validatePassword(password) {
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
function setupPasswordValidation(inputId, feedbackId) {
    const input = document.getElementById(inputId);
    if (!input)
        return;
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
            document.getElementById('form-title').textContent = 'Configurar Administrador';
            document.getElementById('form-subtitle').textContent = 'Cree el usuario y contraseña';
        }
        (0, LogService_1.logSystem)('Interfaz de autenticación cargada');
    }
    catch (error) {
        console.error('Error al inicializar auth:', error);
        alert('Error al cargar la interfaz de autenticación');
    }
});
// Exportar funciones para uso global
window.authUtils = {
    showError,
    validatePassword
};
