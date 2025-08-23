const TestSequencer = require('@jest/test-sequencer').default;

class CustomTestSequencer extends TestSequencer {
  sort(tests) {
    // Ordenar tests para que se ejecuten en el orden correcto
    return tests.sort((testA, testB) => {
      const pathA = testA.path;
      const pathB = testB.path;
      
      // Priorizar tests de setup y configuración
      if (pathA.includes('setup') && !pathB.includes('setup')) return -1;
      if (pathB.includes('setup') && !pathA.includes('setup')) return 1;
      
      // Priorizar tests unitarios antes que integración
      if (pathA.includes('/unit/') && pathB.includes('/integration/')) return -1;
      if (pathB.includes('/unit/') && pathA.includes('/integration/')) return 1;
      
      // Priorizar tests de homologación al final
      if (pathA.includes('/homologacion/') && !pathB.includes('/homologacion/')) return 1;
      if (pathB.includes('/homologacion/') && !pathA.includes('/homologacion/')) return -1;
      
      // Orden alfabético para tests del mismo tipo
      return pathA.localeCompare(pathB);
    });
  }
}

module.exports = CustomTestSequencer;
