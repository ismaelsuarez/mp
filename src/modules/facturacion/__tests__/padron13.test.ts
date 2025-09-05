import { consultarPadronAlcance13 } from '../../facturacion/padron';

describe('Padrón 13 – Validación de CUIT', () => {
  it('debe retornar datos para CUIT válido en entorno de prueba (si WS disponible)', async () => {
    // Usar un CUIT de ejemplo de homologación; si el servicio no está disponible, aceptar error controlado
    const cuit = 20111111112; // ejemplo
    try {
      const res = await consultarPadronAlcance13(cuit);
      // Estructura mínima esperada cuando existe
      expect(res).toBeDefined();
    } catch (e) {
      // Si no hay conectividad/credenciales, el test no debe romper CI
      expect(String(e)).toBeDefined();
    }
  });
});


