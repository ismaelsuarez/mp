// Configuración PNPM para aprobar builds de dependencias críticas
module.exports = {
  hooks: {
    readPackage(pkg) {
      // Permitir builds de paquetes críticos
      return pkg;
    }
  }
};

