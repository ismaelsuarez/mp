#!/usr/bin/env node

/**
 * Script de prueba para el módulo Banco Galicia
 * Simula las respuestas de la API de Galicia para testing
 */

const Store = require('electron-store');

// Configuración de prueba
const testConfig = {
    GALICIA_APP_ID: 'test_app_id',
    GALICIA_APP_KEY: 'test_app_key',
    GALICIA_CERT_PATH: './test-cert.pem',
    GALICIA_KEY_PATH: './test-key.pem',
    GALICIA_ENVIRONMENT: 'sandbox'
};

// Datos de prueba
const testSaldos = [
    {
        cuenta: '001-123456/7',
        moneda: 'ARS',
        saldoDisponible: '$ 250.000,00',
        saldoContable: '$ 260.000,00'
    },
    {
        cuenta: '001-123456/8',
        moneda: 'USD',
        saldoDisponible: '$ 1.500,00',
        saldoContable: '$ 1.500,00'
    }
];

const testMovimientos = [
    {
        fecha: '2025-01-20',
        descripcion: 'Transferencia recibida',
        importe: '+ $ 50.000,00',
        saldo: '$ 250.000,00'
    },
    {
        fecha: '2025-01-18',
        descripcion: 'Pago de servicios',
        importe: '- $ 10.000,00',
        saldo: '$ 200.000,00'
    },
    {
        fecha: '2025-01-15',
        descripcion: 'Depósito en efectivo',
        importe: '+ $ 25.000,00',
        saldo: '$ 210.000,00'
    }
];

const testCobranzas = [
    {
        id: '101',
        cliente: 'Cliente A',
        monto: 30000,
        vencimiento: '2025-02-15',
        estado: 'pendiente'
    },
    {
        id: '102',
        cliente: 'Cliente B',
        monto: 45000,
        vencimiento: '2025-02-20',
        estado: 'pagada'
    },
    {
        id: '103',
        cliente: 'Cliente C',
        monto: 15000,
        vencimiento: '2025-01-10',
        estado: 'vencida'
    }
];

// Función para simular delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para simular autenticación
async function simularAutenticacion() {
    console.log('🔐 Simulando autenticación con Banco Galicia...');
    await delay(1000);
    
    // Verificar configuración
    const store = new Store();
    const config = store.get('config') || {};
    
    if (!config.GALICIA_APP_ID || !config.GALICIA_APP_KEY) {
        throw new Error('Faltan credenciales de Galicia (AppID o AppKey)');
    }
    
    console.log('✅ Autenticación exitosa');
    return {
        access_token: 'test_token_12345',
        token_type: 'Bearer',
        expires_in: 3600
    };
}

// Función para simular obtención de saldos
async function simularGetSaldos() {
    console.log('💰 Obteniendo saldos de cuenta...');
    await delay(800);
    
    console.log('✅ Saldos obtenidos:', testSaldos.length, 'cuentas');
    return testSaldos;
}

// Función para simular obtención de movimientos
async function simularGetMovimientos() {
    console.log('📋 Obteniendo movimientos de cuenta...');
    await delay(1200);
    
    console.log('✅ Movimientos obtenidos:', testMovimientos.length, 'transacciones');
    return testMovimientos;
}

// Función para simular creación de cobranza
async function simularCrearCobranza(data) {
    console.log('📝 Creando cobranza...');
    console.log('   Cliente:', data.cliente);
    console.log('   Monto:', data.monto);
    console.log('   Vencimiento:', data.vencimiento);
    
    await delay(1500);
    
    const nuevaCobranza = {
        id: `C${Date.now()}`,
        cliente: data.cliente,
        monto: data.monto,
        vencimiento: data.vencimiento,
        estado: 'pendiente'
    };
    
    testCobranzas.push(nuevaCobranza);
    
    console.log('✅ Cobranza creada exitosamente:', nuevaCobranza.id);
    return nuevaCobranza.id;
}

// Función para simular obtención de cobranzas
async function simularGetCobranzas() {
    console.log('📊 Obteniendo listado de cobranzas...');
    await delay(600);
    
    console.log('✅ Cobranzas obtenidas:', testCobranzas.length, 'registros');
    return testCobranzas;
}

// Función para probar conexión
async function testConnection() {
    try {
        console.log('🧪 Iniciando pruebas del módulo Banco Galicia...\n');
        
        // Probar autenticación
        await simularAutenticacion();
        console.log('');
        
        // Probar obtención de saldos
        const saldos = await simularGetSaldos();
        console.log('📊 Saldos:', saldos);
        console.log('');
        
        // Probar obtención de movimientos
        const movimientos = await simularGetMovimientos();
        console.log('📋 Movimientos:', movimientos);
        console.log('');
        
        // Probar creación de cobranza
        const cobranzaId = await simularCrearCobranza({
            cliente: 'Cliente de Prueba',
            monto: 50000,
            vencimiento: '2025-03-15'
        });
        console.log('📝 Nueva cobranza ID:', cobranzaId);
        console.log('');
        
        // Probar obtención de cobranzas
        const cobranzas = await simularGetCobranzas();
        console.log('📊 Cobranzas actualizadas:', cobranzas);
        console.log('');
        
        console.log('🎉 Todas las pruebas completadas exitosamente!');
        return { success: true, message: 'Pruebas completadas exitosamente' };
        
    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
        return { success: false, message: error.message };
    }
}

// Función principal
async function main() {
    console.log('🏦 Banco Galicia - Script de Pruebas');
    console.log('=====================================\n');
    
    // Guardar configuración de prueba
    const store = new Store();
    const currentConfig = store.get('config') || {};
    const updatedConfig = { ...currentConfig, ...testConfig };
    store.set('config', updatedConfig);
    
    console.log('⚙️  Configuración de prueba guardada');
    console.log('   App ID:', testConfig.GALICIA_APP_ID);
    console.log('   Entorno:', testConfig.GALICIA_ENVIRONMENT);
    console.log('');
    
    // Ejecutar pruebas
    const result = await testConnection();
    
    console.log('\n📋 Resumen:');
    console.log('   Estado:', result.success ? '✅ Exitoso' : '❌ Fallido');
    console.log('   Mensaje:', result.message);
    
    process.exit(result.success ? 0 : 1);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}

module.exports = {
    testConnection,
    simularAutenticacion,
    simularGetSaldos,
    simularGetMovimientos,
    simularCrearCobranza,
    simularGetCobranzas
};
