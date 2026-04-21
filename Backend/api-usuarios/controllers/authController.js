// Backend/api-usuarios/controllers/authController.js
const supabase = require('../../shared/supabase');

class AuthController {

    // Login con Supabase Auth
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }

            // 1. Autenticar con Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                console.error('Error Supabase Auth:', authError);
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales incorrectas'
                });
            }

            console.log('✅ Autenticado en Supabase:', authData.user.email);

            // 2. Obtener perfil y datos de cliente desde Supabase
            const { data: perfil } = await supabase
                .from('perfiles')
                .select('*, clientes:cliente_id(id, telefono, nombre, apellido)')
                .eq('id', authData.user.id)
                .single();

            // 3. Preparar datos de sesión
            const sesion = {
                id: authData.user.id,
                email: authData.user.email,
                nombre: perfil?.nombre || authData.user.user_metadata?.nombre || 'Usuario',
                apellido: perfil?.apellido || authData.user.user_metadata?.apellido || 'Nuevo',
                rol: perfil?.rol || 'cliente',
                cliente_id: perfil?.cliente_id || null,
                telefono: perfil?.clientes?.telefono || null,
                access_token: authData.session.access_token
            };

            console.log('✅ Login exitoso:', sesion.email);

            res.json({
                success: true,
                message: 'Login exitoso',
                data: sesion
            });

        } catch (error) {
            console.error('💥 Error en login:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Registro con Supabase Auth
    async registro(req, res) {
        try {
            const { nombre, apellido, email, telefono, password } = req.body;

            console.log('📝 Intentando registrar:', { nombre, apellido, email, telefono });

            // Validaciones
            if (!nombre || !apellido || !email || !telefono || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos son requeridos'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La contraseña debe tener al menos 6 caracteres'
                });
            }

            // Verificar si el teléfono ya existe
            const { data: telExiste } = await supabase
                .from('clientes')
                .select('id')
                .eq('telefono', telefono)
                .maybeSingle();

            if (telExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'El teléfono ya está registrado'
                });
            }

            // 1. Crear usuario en Supabase Auth
            // El trigger fn_crear_perfil_nuevo_usuario() crea automáticamente
            // las entradas en perfiles y clientes
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
                console.error('❌ Error Supabase Auth:', authError);
                return res.status(400).json({
                    success: false,
                    message: authError.message === 'User already registered'
                        ? 'El email ya está registrado'
                        : authError.message
                });
            }

            console.log('✅ Usuario creado en Supabase:', authData.user.id);

            // 2. Esperar un momento para que el trigger cree las tablas
            await new Promise(resolve => setTimeout(resolve, 500));

            // 3. Obtener el perfil y cliente creados por el trigger
            const { data: perfil } = await supabase
                .from('perfiles')
                .select('*, clientes:cliente_id(id, telefono)')
                .eq('id', authData.user.id)
                .single();

            // 4. Preparar sesión
            const sesion = {
                id: authData.user.id,
                email: email,
                nombre: nombre,
                apellido: apellido,
                rol: 'cliente',
                cliente_id: perfil?.cliente_id || null,
                telefono: telefono
            };

            res.status(201).json({
                success: true,
                message: 'Usuario creado exitosamente',
                data: sesion
            });

        } catch (error) {
            console.error('💥 Error en registro:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor: ' + error.message
            });
        }
    }

    // Verificar sesión
    async verificarSesion(req, res) {
        try {
            const { access_token } = req.body;

            if (!access_token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token requerido'
                });
            }

            // Verificar token con Supabase
            const { data: { user }, error } = await supabase.auth.getUser(access_token);

            if (error || !user) {
                return res.status(401).json({
                    success: false,
                    message: 'Sesión inválida'
                });
            }

            // Obtener perfil desde Supabase
            const { data: perfil } = await supabase
                .from('perfiles')
                .select('*, clientes:cliente_id(id, telefono)')
                .eq('id', user.id)
                .single();

            res.json({
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    nombre: perfil?.nombre,
                    apellido: perfil?.apellido,
                    rol: perfil?.rol || 'cliente',
                    cliente_id: perfil?.cliente_id
                }
            });

        } catch (error) {
            console.error('Error verificando sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cerrar sesión
    async logout(req, res) {
        try {
            const { access_token } = req.body;

            if (access_token) {
                await supabase.auth.admin.signOut(access_token);
            }

            res.json({
                success: true,
                message: 'Sesión cerrada'
            });

        } catch (error) {
            console.error('Error cerrando sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new AuthController();
