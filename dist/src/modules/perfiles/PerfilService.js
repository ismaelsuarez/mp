"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerfilService = void 0;
const DbService_1 = require("../../services/DbService");
class PerfilService {
    static list() {
        return (0, DbService_1.getDb)().listPerfiles();
    }
    static get(id) {
        return (0, DbService_1.getDb)().getPerfil(id);
    }
    static save(perfil) {
        return (0, DbService_1.getDb)().savePerfil(perfil);
    }
    static remove(id) {
        return (0, DbService_1.getDb)().deletePerfil(id);
    }
    static export(perfil) {
        return JSON.stringify(perfil, null, 2);
    }
    static import(json) {
        const obj = JSON.parse(json);
        return obj;
    }
}
exports.PerfilService = PerfilService;
