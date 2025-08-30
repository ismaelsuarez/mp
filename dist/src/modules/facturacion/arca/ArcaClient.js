"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArcaClient = void 0;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
class ArcaClient {
    constructor(baseUrl, certPath, keyPath) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.httpsAgent = new https_1.default.Agent({ cert: certPath, key: keyPath, rejectUnauthorized: false });
    }
    async getCotizacion(auth, monId, fecha) {
        // Endpoint de ejemplo desde documentación para homologación:
        // http://wswhomo.afip.gov.ar/wsbfev1/service.asmx?op=BFEGetCotizacion
        // Usamos axios con httpsAgent y query simple (en producción se usa SOAP/XML)
        const url = `${this.baseUrl}/BFEGetCotizacion`;
        const params = { MonId: monId };
        if (fecha)
            params.FchCotiz = fecha;
        const { data } = await axios_1.default.get(url, { httpsAgent: this.httpsAgent, params });
        return data;
    }
}
exports.ArcaClient = ArcaClient;
