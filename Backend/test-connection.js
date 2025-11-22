// Script para probar la conexión a Supabase
require('dotenv').config();

async function testConnection() {
    console.log('='.repeat(50));
    console.log('🔍 PRUEBA DE CONEXIÓN A SUPABASE');
    console.log('='.repeat(50));
    console.log('');

    // Verificar variables de entorno
    console.log('1️⃣ Verificando variables de entorno...');
    console.log('   DB_TYPE:', process.env.DB_TYPE || 'NO CONFIGURADO');
    console.log('   SUPABASE_HOST:', process.env.SUPABASE_HOST ? '✅ Configurado' : '❌ NO CONFIGURADO');
    console.log('   SUPABASE_PASSWORD:', process.env.SUPABASE_PASSWORD ? '✅ Configurado' : '❌ NO CONFIGURADO');
    console.log('   SUPABASE_USER:', process.env.SUPABASE_USER || 'postgres');
    console.log('   SUPABASE_PORT:', process.env.SUPABASE_PORT || '5432');
    console.log('   SUPABASE_DB:', process.env.SUPABASE_DB || 'postgres');
    console.log('');

    if (!process.env.SUPABASE_HOST || !process.env.SUPABASE_PASSWORD) {
        console.error('❌ ERROR: Faltan variables de entorno');
        console.log('');
        console.log('📝 Crea un archivo .env en Backend/ con:');
        console.log('');
        console.log('DB_TYPE=supabase');
        console.log('SUPABASE_HOST=db.xxxxxxxxxxxxx.supabase.co');
        console.log('SUPABASE_PASSWORD=tu-contraseña');
        console.log('SUPABASE_USER=postgres');
        console.log('SUPABASE_PORT=5432');
        console.log('SUPABASE_DB=postgres');
        console.log('');
        process.exit(1);
    }

    // Intentar conectar
    console.log('2️⃣ Intentando conectar a Supabase...');
    try {
        const db = require('./config/supabase');
        await db.initialize();
        console.log('');
        console.log('3️⃣ Probando consulta simple...');

        const result = await db.query('SELECT NOW() as current_time');
        console.log('   ✅ Consulta exitosa');
        console.log('   Hora del servidor:', result[0].current_time);
        console.log('');

        console.log('4️⃣ Verificando tabla dias_bloqueados...');
        const diasBloqueados = await db.query('SELECT COUNT(*) as total FROM dias_bloqueados');
        console.log('   ✅ Tabla encontrada');
        console.log('   Total de registros:', diasBloqueados[0].total);
        console.log('');

        console.log('='.repeat(50));
        console.log('✅ CONEXIÓN EXITOSA');
        console.log('='.repeat(50));
        console.log('');
        console.log('Tu proyecto está correctamente conectado a Supabase.');
        console.log('Puedes iniciar el servidor con: npm start');
        console.log('');

        await db.close();
        process.exit(0);

    } catch (error) {
        console.error('');
        console.error('❌ ERROR AL CONECTAR:');
        console.error('   ', error.message);
        console.error('');
        console.error('💡 Posibles soluciones:');
        console.error('   1. Verifica que las credenciales sean correctas');
        console.error('   2. Asegúrate de que el proyecto de Supabase esté activo');
        console.error('   3. Verifica que ejecutaste el script SQL en Supabase');
        console.error('   4. Revisa que la contraseña no tenga caracteres especiales problemáticos');
        console.error('');
        process.exit(1);
    }
}

testConnection();
