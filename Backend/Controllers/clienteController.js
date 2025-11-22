// src/controllers/clienteController.js - Lógica para manejo de clientes
const db = require('../config');

class ClienteController {
    
    // Obtener todos los clientes
    async obtenerClientes(req, res) {
        try {
            const { limite = 50, buscar = '' } = req.query;
            
            let sql = `
                SELECT 
                    c.id,
                    c.nombre,
                    c.apellido,
                    c.telefono,
                    c.email,
                    c.total_reservas,
                    c.no_shows,
                    c.ultima_reserva,
                    c.estado,
                    c.created_at,
                    tc.nombre as tipo_cliente,
                    tc.descuento_porcentaje
                FROM clientes c
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (buscar) {
                sql += ` AND (
                    c.nombre LIKE ? OR 
                    c.apellido LIKE ? OR 
                    c.telefono LIKE ? OR 
                    c.email LIKE ?
                )`;
                const searchTerm = `%${buscar}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }
            
            sql += ' ORDER BY c.created_at DESC LIMIT ?';
            params.push(parseInt(limite));
            
            const clientes = await db.all(sql, params);
            
            res.json({
                success: true,
                data: clientes,
                total: clientes.length
            });
            
        } catch (error) {
            console.error('Error obteniendo clientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener cliente por ID
    async obtenerClientePorId(req, res) {
        try {
            const { id } = req.params;
            
            const cliente = await db.get(`
                SELECT 
                    c.*,
                    tc.nombre as tipo_cliente,
                    tc.descuento_porcentaje
                FROM clientes c
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
                WHERE c.id = ?
            `, [id]);
            
            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            // Obtener historial de reservas del cliente
            const reservas = await db.all(`
                SELECT 
                    r.id,
                    r.fecha,
                    r.hora_inicio,
                    r.hora_fin,
                    r.precio_total,
                    c.nombre as cancha_nombre,
                    er.nombre as estado
                FROM reservas r
                JOIN canchas c ON r.cancha_id = c.id
                JOIN estados_reserva er ON r.estado_id = er.id
                WHERE r.cliente_id = ?
                ORDER BY r.fecha DESC, r.hora_inicio DESC
                LIMIT 10
            `, [id]);
            
            res.json({
                success: true,
                data: {
                    ...cliente,
                    reservas_recientes: reservas
                }
            });
            
        } catch (error) {
            console.error('Error obteniendo cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Crear nuevo cliente
    async crearCliente(req, res) {
        try {
            const { nombre, apellido, telefono, email } = req.body;
            
            // Verificar si el teléfono ya existe
            const telefonoExistente = await db.get(
                'SELECT id FROM clientes WHERE telefono = ?',
                [telefono]
            );
            
            if (telefonoExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con ese número de teléfono'
                });
            }
            
            // Verificar si el email ya existe (si se proporcionó)
            if (email) {
                const emailExistente = await db.get(
                    'SELECT id FROM clientes WHERE email = ?',
                    [email]
                );
                
                if (emailExistente) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese email'
                    });
                }
            }
            
            const resultado = await db.run(`
                INSERT INTO clientes (nombre, apellido, telefono, email, tipo_cliente_id)
                VALUES (?, ?, ?, ?, 1)
            `, [nombre, apellido, telefono, email || null]);
            
            const clienteCreado = await db.get(`
                SELECT 
                    c.*,
                    tc.nombre as tipo_cliente,
                    tc.descuento_porcentaje
                FROM clientes c
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
                WHERE c.id = ?
            `, [resultado.id]);
            
            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                data: clienteCreado
            });
            
        } catch (error) {
            console.error('Error creando cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Actualizar cliente
    async actualizarCliente(req, res) {
        try {
            const { id } = req.params;
            const { nombre, apellido, telefono, email, tipo_cliente_id } = req.body;
            
            const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
            
            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            // Verificar conflictos de teléfono
            if (telefono && telefono !== cliente.telefono) {
                const telefonoExistente = await db.get(
                    'SELECT id FROM clientes WHERE telefono = ? AND id != ?',
                    [telefono, id]
                );
                
                if (telefonoExistente) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese número de teléfono'
                    });
                }
            }
            
            // Verificar conflictos de email
            if (email && email !== cliente.email) {
                const emailExistente = await db.get(
                    'SELECT id FROM clientes WHERE email = ? AND id != ?',
                    [email, id]
                );
                
                if (emailExistente) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese email'
                    });
                }
            }
            
            await db.run(`
                UPDATE clientes 
                SET nombre = ?, apellido = ?, telefono = ?, email = ?, tipo_cliente_id = ?
                WHERE id = ?
            `, [
                nombre || cliente.nombre,
                apellido || cliente.apellido,
                telefono || cliente.telefono,
                email || cliente.email,
                tipo_cliente_id || cliente.tipo_cliente_id,
                id
            ]);
            
            const clienteActualizado = await db.get(`
                SELECT 
                    c.*,
                    tc.nombre as tipo_cliente,
                    tc.descuento_porcentaje
                FROM clientes c
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
                WHERE c.id = ?
            `, [id]);
            
            res.json({
                success: true,
                message: 'Cliente actualizado exitosamente',
                data: clienteActualizado
            });
            
        } catch (error) {
            console.error('Error actualizando cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Buscar cliente por teléfono (para reservas rápidas)
    async buscarPorTelefono(req, res) {
        try {
            const { telefono } = req.query;
            
            if (!telefono) {
                return res.status(400).json({
                    success: false,
                    message: 'Teléfono es requerido'
                });
            }
            
            const cliente = await db.get(`
                SELECT 
                    c.*,
                    tc.nombre as tipo_cliente,
                    tc.descuento_porcentaje
                FROM clientes c
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id
                WHERE c.telefono = ?
            `, [telefono]);
            
            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado con ese teléfono'
                });
            }
            
            res.json({
                success: true,
                data: cliente
            });
            
        } catch (error) {
            console.error('Error buscando cliente por teléfono:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Suspender/activar cliente
    async cambiarEstadoCliente(req, res) {
        try {
            const { id } = req.params;
            const { estado, razon = '' } = req.body;
            
            const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
            
            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }
            
            await db.run('UPDATE clientes SET estado = ? WHERE id = ?', [estado, id]);
            
            res.json({
                success: true,
                message: `Cliente ${estado === 'suspendido' ? 'suspendido' : 'activado'} exitosamente`
            });
            
        } catch (error) {
            console.error('Error cambiando estado del cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener estadísticas del cliente
    async obtenerEstadisticas(req, res) {
        try {
            const { id } = req.params;
            
            const stats = {};
            
            // Estadísticas generales
            const general = await db.get(`
                SELECT 
                    COUNT(*) as total_reservas,
                    SUM(CASE WHEN estado_id = 4 THEN 1 ELSE 0 END) as completadas,
                    SUM(CASE WHEN estado_id = 5 THEN 1 ELSE 0 END) as no_shows,
                    SUM(CASE WHEN estado_id = 3 THEN 1 ELSE 0 END) as canceladas,
                    AVG(precio_total) as gasto_promedio,
                    SUM(precio_total) as gasto_total
                FROM reservas 
                WHERE cliente_id = ?
            `, [id]);
            
            stats.general = general;
            
            // Reservas por mes (últimos 6 meses)
            const reservasPorMes = await db.all(`
                SELECT 
                    DATE_FORMAT(fecha, '%Y-%m') as mes,
                    COUNT(*) as cantidad,
                    SUM(precio_total) as total_gastado
                FROM reservas 
                WHERE cliente_id = ? 
                AND fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY DATE_FORMAT(fecha, '%Y-%m')
                ORDER BY mes DESC
            `, [id]);
            
            stats.reservasPorMes = reservasPorMes;
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Error obteniendo estadísticas del cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new ClienteController();