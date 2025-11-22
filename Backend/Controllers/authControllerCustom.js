// Backend/controllers/authControllerCustom.js
// Autenticación personalizada usando la tabla 'usuarios' directamente
// NO usa Supabase Auth, solo la base de datos PostgreSQL

const db = require('../config');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Clave secreta para JWT (en producción, usar variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'tu-clave-secreta-super-segura-cambiar-en-produccion';
const JWT_EXPIRES_IN = '7d'; // Token válido por 7 días

class AuthControllerCustom {

    // Login usando tabla usuarios
    async login(req, res) {
        try {
            const { email, password } = req.body;

            console.log('🔐 Intento de login:', email);

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }

            // 1. Buscar usuario en la base de datos
            const usuario = await db.get(`
                SELECT
                    u.id,
                    u.email,
                    u.password,
                    u.nombre,
                    u.apellido,
                    u.rol,
                    u.cliente_id,
                    u.estado,
                    c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.email = $1
            `, [email]);

            if (!usuario) {
                console.log('❌ Usuario no encontrado:', email);
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales incorrectas'
                });
            }

            // 2. Verificar estado del usuario
            if (usuario.estado !== 'activo') {
                console.log('❌ Usuario inactivo:', email);
                return res.status(403).json({
                    success: false,
                    message: 'Usuario inactivo. Contacta al administrador'
                });
            }

            // 3. Verificar contraseña
            // En PostgreSQL con pgcrypto, usamos la función crypt
            const passwordValido = await db.get(`
                SELECT (password = crypt($1, password)) AS es_valido
                FROM usuarios
                WHERE email = $2
            `, [password, email]);

            if (!passwordValido || !passwordValido.es_valido) {
                console.log('❌ Contraseña incorrecta para:', email);
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales incorrectas'
                });
            }

            // 4. Actualizar último acceso
            await db.run(`
                UPDATE usuarios
                SET ultimo_acceso = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [usuario.id]);

            // 5. Generar token JWT
            const token = jwt.sign(
                {
                    id: usuario.id,
                    email: usuario.email,
                    rol: usuario.rol,
                    cliente_id: usuario.cliente_id
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // 6. Preparar datos de sesión
            const sesion = {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                rol: usuario.rol,
                cliente_id: usuario.cliente_id,
                telefono: usuario.telefono,
                access_token: token
            };

            console.log('✅ Login exitoso:', email, '- Rol:', usuario.rol);

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

    // Registro de nuevo usuario
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

            // Verificar si el email ya existe
            const emailExiste = await db.get(
                'SELECT id FROM usuarios WHERE email = $1',
                [email]
            );

            if (emailExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'El email ya está registrado'
                });
            }

            // Verificar si el teléfono ya existe
            const telefonoExiste = await db.get(
                'SELECT id FROM clientes WHERE telefono = $1',
                [telefono]
            );

            if (telefonoExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'El teléfono ya está registrado'
                });
            }

            // Crear cliente y usuario en una transacción
            const resultado = await db.transaction(async (conn) => {
                // 1. Crear cliente
                const clienteResult = await conn.query(`
                    INSERT INTO clientes (nombre, apellido, telefono, email, tipo_cliente_id, estado)
                    VALUES ($1, $2, $3, $4, 1, 'activo')
                    RETURNING id
                `, [nombre, apellido, telefono, email]);

                const clienteId = clienteResult.rows[0].id;

                // 2. Crear usuario vinculado con contraseña hasheada
                const usuarioResult = await conn.query(`
                    INSERT INTO usuarios (
                        email,
                        password,
                        nombre,
                        apellido,
                        rol,
                        cliente_id,
                        estado
                    )
                    VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4, 'cliente', $5, 'activo')
                    RETURNING id
                `, [email, password, nombre, apellido, clienteId]);

                return {
                    usuarioId: usuarioResult.rows[0].id,
                    clienteId: clienteId
                };
            });

            console.log('✅ Usuario registrado:', email);

            // Generar token JWT
            const token = jwt.sign(
                {
                    id: resultado.usuarioId,
                    email: email,
                    rol: 'cliente',
                    cliente_id: resultado.clienteId
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Preparar sesión
            const sesion = {
                id: resultado.usuarioId,
                email: email,
                nombre: nombre,
                apellido: apellido,
                rol: 'cliente',
                cliente_id: resultado.clienteId,
                telefono: telefono,
                access_token: token
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

    // Verificar sesión (validar token JWT)
    async verificarSesion(req, res) {
        try {
            const { access_token } = req.body;

            if (!access_token) {
                return res.status(400).json({
                    success: false,
                    message: 'Token requerido'
                });
            }

            // Verificar token JWT
            const decoded = jwt.verify(access_token, JWT_SECRET);

            // Obtener datos actualizados del usuario
            const usuario = await db.get(`
                SELECT
                    u.id,
                    u.email,
                    u.nombre,
                    u.apellido,
                    u.rol,
                    u.cliente_id,
                    u.estado,
                    c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.id = $1
            `, [decoded.id]);

            if (!usuario || usuario.estado !== 'activo') {
                return res.status(401).json({
                    success: false,
                    message: 'Sesión inválida'
                });
            }

            res.json({
                success: true,
                data: {
                    id: usuario.id,
                    email: usuario.email,
                    nombre: usuario.nombre,
                    apellido: usuario.apellido,
                    rol: usuario.rol,
                    cliente_id: usuario.cliente_id,
                    telefono: usuario.telefono
                }
            });

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token inválido'
                });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Sesión expirada'
                });
            }

            console.error('Error verificando sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cerrar sesión (invalidar token)
    async logout(req, res) {
        try {
            // En un sistema JWT simple, el logout se maneja en el cliente
            // eliminando el token almacenado

            // Opcional: Puedes implementar una lista negra de tokens
            // o cambiar a tokens de corta duración con refresh tokens

            res.json({
                success: true,
                message: 'Sesión cerrada. Por favor elimina el token del cliente.'
            });

        } catch (error) {
            console.error('Error cerrando sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cambiar contraseña
    async cambiarPassword(req, res) {
        try {
            const { email, password_actual, password_nueva } = req.body;

            if (!email || !password_actual || !password_nueva) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos son requeridos'
                });
            }

            if (password_nueva.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'La nueva contraseña debe tener al menos 6 caracteres'
                });
            }

            // Verificar contraseña actual
            const passwordValido = await db.get(`
                SELECT (password = crypt($1, password)) AS es_valido
                FROM usuarios
                WHERE email = $2
            `, [password_actual, email]);

            if (!passwordValido || !passwordValido.es_valido) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña actual incorrecta'
                });
            }

            // Actualizar contraseña
            await db.run(`
                UPDATE usuarios
                SET password = crypt($1, gen_salt('bf', 10)),
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = $2
            `, [password_nueva, email]);

            console.log('✅ Contraseña cambiada para:', email);

            res.json({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            });

        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new AuthControllerCustom();
