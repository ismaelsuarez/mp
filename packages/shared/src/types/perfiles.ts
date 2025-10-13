/**
 * @package @shared/types/perfiles
 * @description Tipos para perfiles de usuario y permisos
 */

export type PerfilPermisos = {
  facturacion: boolean;
  caja: boolean;
  administracion: boolean;
  configuracion: boolean;
  consulta?: boolean;
};

export type PerfilParametros = Record<string, unknown>;

export interface Perfil {
  id?: number;
  nombre: string;
  permisos: PerfilPermisos;
  parametros: PerfilParametros;
  created_at?: string;
}

