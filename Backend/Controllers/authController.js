// controllers/authController.js - Controlador de autenticación
const db = require('../config/database');
const bcrypt = require('bcryptjs');

class AuthController {
    
    // Login de usuario
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }
            
            // Buscar usuario
            const usuario = await db.get(`
                SELECT u.*, c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.email = ? AND u.estado = 'activo'
            `, [email]);
            
            if (!usuario) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales incorrectas'
                });
            }
            
            // Verificar contraseña
            const passwordValido = await bcrypt.compare(password, usuario.password);
            
            if (!passwordValido) {
                return res.status(401).json({
                    success: false,
                    message: 'Credenciales incorrectas'
                });
            }
            
            // Actualizar último acceso
            await db.run(
                'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
                [usuario.id]
            );
            
            // Preparar datos de sesión (sin contraseña) - Convertir BigInt a Number
            const sesion = {
                id: Number(usuario.id),
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                rol: usuario.rol,
                cliente_id: usuario.cliente_id ? Number(usuario.cliente_id) : null,
                telefono: usuario.telefono
            };
            
            res.json({
                success: true,
                message: 'Login exitoso',
                data: sesion
            });
            
        } catch (error) {
            console.error('Error en login:', error);
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
                'SELECT id FROM usuarios WHERE email = ?',
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
                'SELECT id FROM clientes WHERE telefono = ?',
                [telefono]
            );
            
            if (telefonoExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'El teléfono ya está registrado'
                });
            }
            
            // Hashear contraseña
            const passwordHash = await bcrypt.hash(password, 10);
            
            // Crear usuario y cliente en una transacción
            const resultado = await db.transaction(async (conn) => {
                // Crear cliente SIN email (para evitar duplicados)
                const clienteResult = await conn.query(`
                    INSERT INTO clientes (nombre, apellido, telefono, tipo_cliente_id)
                    VALUES (?, ?, ?, 1)
                `, [nombre, apellido, telefono]);
                
                const clienteId = Number(clienteResult.insertId);
                
                // Crear usuario
                const usuarioResult = await conn.query(`
                    INSERT INTO usuarios (email, password, nombre, apellido, rol, cliente_id)
                    VALUES (?, ?, ?, ?, 'cliente', ?)
                `, [email, passwordHash, nombre, apellido, clienteId]);
                
                return {
                    usuarioId: Number(usuarioResult.insertId),
                    clienteId: clienteId
                };
            });
            
            // Preparar datos de sesión
            const sesion = {
                id: resultado.usuarioId,
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
            console.error('Error en registro:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor' + error.message
            });
        }
    }
    
    // Verificar sesión
    async verificarSesion(req, res) {
        try {
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de usuario requerido'
                });
            }
            
            const usuario = await db.get(`
                SELECT u.id, u.email, u.nombre, u.apellido, u.rol, u.cliente_id, c.telefono
                FROM usuarios u
                LEFT JOIN clientes c ON u.cliente_id = c.id
                WHERE u.id = ? AND u.estado = 'activo'
            `, [userId]);
            
            if (!usuario) {
                return res.status(401).json({
                    success: false,
                    message: 'Sesión inválida'
                });
            }
            
            res.json({
                success: true,
                data: usuario
            });
            
        } catch (error) {
            console.error('Error verificando sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new AuthController();