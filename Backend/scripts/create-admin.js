// Backend/scripts/create-admin.js
const supabase = require('../shared/supabase');

async function createAdmin() {
    const email = 'admin@canchas.com';
    const password = 'admin1234';
    const nombre = 'Admin';
    const apellido = 'Sistema';
    const telefono = '000000000';

    console.log(`🚀 Iniciando creación de usuario administrador: ${email}...`);

    try {
        // 1. Verificar si ya existe
        const { data: existingUser, error: checkError } = await supabase
            .from('perfiles')
            .select('id')
            .eq('nombre', nombre) // O mejor por email si tuviéramos acceso a auth.users select
            .maybeSingle();

        // Nota: supabase.auth.admin.listUsers() sería mejor pero requiere paginación si hay muchos.
        // Vamos a intentar crearlo y manejar el error si ya existe.

        // 2. Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { 
                nombre, 
                apellido, 
                telefono 
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('ℹ️ El usuario ya existe en Auth. Buscando ID para actualizar rol...');
                // Si ya existe, intentamos buscarlo en perfiles para asegurar que sea admin
                const { data: perfil } = await supabase
                    .from('perfiles')
                    .select('id')
                    .eq('nombre', nombre) // Asumimos que el nombre es único para el admin o buscamos por email si perfiles tiene email
                    // En el esquema, perfiles NO tiene email, pero clientes SI.
                    .single();
                
                if (perfil) {
                    const { error: updateError } = await supabase
                        .from('perfiles')
                        .update({ rol: 'admin' })
                        .eq('id', perfil.id);
                    
                    if (updateError) console.error('❌ Error actualizando:', updateError);
                    else console.log('✅ Rol actualizado a admin para el usuario existente.');
                    return;
                }
            }
            console.error('❌ Error Supabase Auth:', authError.message);
            return;
        }

        const userId = authData.user.id;
        console.log(`✅ Usuario creado en Auth con ID: ${userId}`);

        // 3. Esperar a que el trigger fn_crear_perfil_nuevo_usuario cree el perfil
        console.log('⏳ Esperando que el trigger de base de datos cree el perfil...');
        await new Promise(r => setTimeout(r, 3000));

        // 4. Actualizar rol a 'admin' en la tabla perfiles
        const { error: updateError } = await supabase
            .from('perfiles')
            .update({ rol: 'admin' })
            .eq('id', userId);

        if (updateError) {
            console.error('❌ Error actualizando rol en tabla perfiles:', updateError.message);
            
            // Reintento por si el trigger tardó más
            console.log('🔄 Reintentando actualización de rol...');
            await new Promise(r => setTimeout(r, 2000));
            const { error: retryError } = await supabase
                .from('perfiles')
                .update({ rol: 'admin' })
                .eq('id', userId);
            
            if (retryError) console.error('❌ Falló el reintento:', retryError.message);
            else console.log('✅ Rol de administrador asignado exitosamente (en el reintento).');
        } else {
            console.log(`⭐ Rol de administrador asignado exitosamente a ${email}`);
        }

    } catch (err) {
        console.error('💥 Error inesperado:', err);
    } finally {
        process.exit();
    }
}

createAdmin();
