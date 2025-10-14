import { getDb } from '@infra/database';
import type { Perfil } from './types';

export class PerfilService {
  static list(): Perfil[] {
    return getDb().listPerfiles();
  }

  static get(id: number): Perfil | null {
    return getDb().getPerfil(id);
  }

  static save(perfil: Perfil): number {
    return getDb().savePerfil(perfil);
  }

  static remove(id: number): boolean {
    return getDb().deletePerfil(id);
  }

  static export(perfil: Perfil): string {
    return JSON.stringify(perfil, null, 2);
  }

  static import(json: string): Perfil {
    const obj = JSON.parse(json);
    return obj as Perfil;
  }
}


