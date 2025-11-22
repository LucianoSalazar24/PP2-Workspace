// Backend/controllers/authController.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = require('../config'); // Conexión unificada (MariaDB o Supabase)

// Configurar Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

console.log('🔑 Supabase URL:', process.env.SUPABASE_URL);
console.log('🔑 Service Key existe:', !!process.env.SUPABASE_SERVICE_KEY);

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
            
            // 2. Obtener datos del usuario desde TU base de datos (MariaDB)
            const usuario = await db.get(`
                SELECT u.*, c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.email = ?
            `, [email]);
            
            console.log('📊 Usuario encontrado en BD:', usuario);
            
            // Si no existe en MariaDB, crear entrada básica
            if (!usuario) {
                console.warn('⚠️ Usuario no existe en MariaDB, creando entrada básica');
                
                // Insertar usuario básico
                await db.run(`
                    INSERT INTO usuarios (email, password, nombre, apellido, rol, supabase_user_id)
                    VALUES (?, 'supabase_auth', ?, ?, 'cliente', ?)
                `, [
                    email, 
                    authData.user.user_metadata?.nombre || 'Usuario',
                    authData.user.user_metadata?.apellido || 'Nuevo',
                    authData.user.id
                ]);
            }
            
            // 3. Preparar datos de sesión
            const sesion = {
                id: authData.user.id,
                email: authData.user.email,
                nombre: usuario?.nombre || authData.user.user_metadata?.nombre || 'Usuario',
                apellido: usuario?.apellido || authData.user.user_metadata?.apellido || 'Nuevo',
                rol: usuario?.rol || 'cliente',
                cliente_id: usuario?.cliente_id || null,
                telefono: usuario?.telefono || null,
                access_token: authData.session.access_token
            };
            
            console.log('✅ Login exitoso:', sesion);
            
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
            const telefonoExiste = await db.get(
                'SELECT id FROM clientes WHERE telefono = ?',
                [telefono]
            );
            
            if (telefonoExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'El teléfono ya está registrado'
                });
            }
            
            // 1. Crear usuario en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { 
                    nombre, 
                    apellido 
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
            
            // 2. Crear cliente y usuario en MariaDB
            const resultado = await db.transaction(async (conn) => {
                // Crear cliente
                const clienteResult = await conn.query(`
                    INSERT INTO clientes (nombre, apellido, telefono, email, tipo_cliente_id)
                    VALUES (?, ?, ?, ?, 1)
                `, [nombre, apellido, telefono, email]);
                
                const clienteId = Number(clienteResult.insertId);
                
                // Crear usuario vinculado
                const usuarioResult = await conn.query(`
                    INSERT INTO usuarios (email, password, nombre, apellido, rol, cliente_id, supabase_user_id)
                    VALUES (?, 'supabase_auth', ?, ?, 'cliente', ?, ?)
                `, [email, nombre, apellido, clienteId, authData.user.id]);
                
                return {
                    usuarioId: Number(usuarioResult.insertId),
                    clienteId: clienteId
                };
            });
            
            console.log('✅ Datos guardados en MariaDB:', resultado);
            
            // 3. Preparar sesión
            const sesion = {
                id: authData.user.id,
                email: email,
                nombre: nombre,
                apellido: apellido,
                rol: 'cliente',
                cliente_id: resultado.clienteId,
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
            
            // Obtener datos de MariaDB
            const usuario = await db.get(`
                SELECT u.*, c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.email = ?
            `, [user.email]);
            
            res.json({
                success: true,
                data: {
                    id: user.id,
                    email: user.email,
                    nombre: usuario?.nombre,
                    apellido: usuario?.apellido,
                    rol: usuario?.rol || 'cliente',
                    cliente_id: usuario?.cliente_id
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