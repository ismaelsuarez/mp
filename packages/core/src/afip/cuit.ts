/**
 * @package @core/afip/cuit
 * @description Validadores y helpers adicionales para CUIT/CUIL/DNI
 * 
 * Lógica pura para validación y formato de documentos fiscales argentinos.
 * 
 * Nota: Las funciones principales (calcularDigitoVerificadorCUIT, validarCUITCompleto, formatCUIT)
 * están en @core/afip/helpers por razones históricas.
 */

/**
 * Valida formato básico de CUIT (solo formato, no dígito verificador)
 * 
 * @param cuit - CUIT a validar (con o sin guiones)
 * @returns true si el formato es válido
 */
export function isValidCUITFormat(cuit: string): boolean {
  const cleaned = cuit.replace(/[^0-9]/g, '');
  return /^\d{11}$/.test(cleaned);
}

/**
 * Limpia un CUIT (remueve guiones y espacios)
 * 
 * @param cuit - CUIT con formato
 * @returns CUIT limpio (solo dígitos)
 */
export function cleanCUIT(cuit: string): string {
  return cuit.replace(/[^0-9]/g, '');
}

/**
 * Valida formato de DNI argentino
 * 
 * @param dni - DNI a validar
 * @returns true si el formato es válido (7-8 dígitos)
 */
export function isValidDNIFormat(dni: string): boolean {
  const cleaned = dni.replace(/[^0-9]/g, '');
  return /^\d{7,8}$/.test(cleaned);
}

/**
 * Formatea DNI con puntos (separador de miles)
 * 
 * Formato: XX.XXX.XXX
 * 
 * @param dni - DNI sin formato
 * @returns DNI formateado con puntos
 */
export function formatDNI(dni: string): string {
  const cleaned = dni.replace(/[^0-9]/g, '');
  
  if (cleaned.length < 7 || cleaned.length > 8) {
    return dni; // Retornar sin formato si es inválido
  }
  
  // Formatear con puntos de derecha a izquierda
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Detecta el tipo de documento fiscal
 * 
 * @param documento - Documento a analizar
 * @returns 'CUIT' | 'CUIL' | 'DNI' | 'DESCONOCIDO'
 */
export function detectarTipoDocumento(documento: string): 'CUIT' | 'CUIL' | 'DNI' | 'DESCONOCIDO' {
  const cleaned = cleanCUIT(documento);
  
  // CUIT/CUIL tiene 11 dígitos
  if (cleaned.length === 11) {
    const tipo = cleaned.slice(0, 2);
    
    // CUIT: empresas (30, 33, 34)
    if (['30', '33', '34'].includes(tipo)) {
      return 'CUIT';
    }
    
    // CUIL: personas (20, 23, 24, 27)
    if (['20', '23', '24', '27'].includes(tipo)) {
      return 'CUIL';
    }
    
    // Otros tipos de CUIT/CUIL
    return 'CUIT';
  }
  
  // DNI tiene 7-8 dígitos
  if (cleaned.length >= 7 && cleaned.length <= 8) {
    return 'DNI';
  }
  
  return 'DESCONOCIDO';
}

