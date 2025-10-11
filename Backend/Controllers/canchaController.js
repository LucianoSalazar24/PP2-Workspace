// controllers/canchaController.js - Lógica para manejo de canchas
const db = require('../config/database');

class CanchaController {
    
    // Obtener todas las canchas
    async obtenerCanchas(req, res) {
        try {
            const canchas = await db.all(`
                SELECT 
                    id,
                    nombre,
                    capacidad,
                    precio_por_hora,
                    descripcion,
                    estado,
                    created_at
                FROM canchas 
                ORDER BY id ASC
            `);
            
            res.json({
                success: true,
                data: canchas,
                total: canchas.length
            });
            
        } catch (error) {
            console.error('Error obteniendo canchas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener cancha por ID
    async obtenerCanchaPorId(req, res) {
        try {
            const { id } = req.params;
            
            const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
            
            if (!cancha) {
                return res.status(404).json({
                    success: false,
                    message: 'Cancha no encontrada'
                });
            }
            
            // Obtener estadísticas
            const estadisticas = await db.get(`
                SELECT 
                    COUNT(*) as total_reservas,
                    SUM(CASE WHEN estado_id = 4 THEN 1 ELSE 0 END) as completadas,
                    AVG(precio_total) as ingreso_promedio,
                    SUM(precio_total) as ingresos_totales
                FROM reservas 
                WHERE cancha_id = ?
            `, [id]);
            
            res.json({
                success: true,
                data: {
                    ...cancha,
                    estadisticas
                }
            });
            
        } catch (error) {
            console.error('Error obteniendo cancha:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Crear nueva cancha
    async crearCancha(req, res) {
        try {
            const { nombre, capacidad, precio_por_hora, descripcion = '' } = req.body;
            
            // Verificar duplicados
            const existente = await db.get(
                'SELECT id FROM canchas WHERE nombre = ?', 
                [nombre]
            );
            
            if (existente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una cancha con ese nombre'
                });
            }
            
            const resultado = await db.run(`
                INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion)
                VALUES (?, ?, ?, ?)
            `, [nombre, capacidad, precio_por_hora, descripcion]);
            
            const canchaCreada = await db.get(
                'SELECT * FROM canchas WHERE id = ?', 
                [resultado.id]
            );
            
            res.status(201).json({
                success: true,
                message: 'Cancha creada exitosamente',
                data: canchaCreada
            });
            
        } catch (error) {
            console.error('Error creando cancha:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Actualizar cancha
    async actualizarCancha(req, res) {
        try {
            const { id } = req.params;
            const { nombre, capacidad, precio_por_hora, descripcion, estado } = req.body;
            
            const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
            
            if (!cancha) {
                return res.status(404).json({
                    success: false,
                    message: 'Cancha no encontrada'
                });
            }
            
            // Verificar conflicto de nombre
            if (nombre && nombre !== cancha.nombre) {
                const duplicado = await db.get(
                    'SELECT id FROM canchas WHERE nombre = ? AND id != ?',
                    [nombre, id]
                );
                
                if (duplicado) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe una cancha con ese nombre'
                    });
                }
            }
            
            await db.run(`
                UPDATE canchas 
                SET nombre = ?, capacidad = ?, precio_por_hora = ?, 
                    descripcion = ?, estado = ?, updated_at = NOW()
                WHERE id = ?
            `, [
                nombre || cancha.nombre,
                capacidad || cancha.capacidad,
                precio_por_hora || cancha.precio_por_hora,
                descripcion !== undefined ? descripcion : cancha.descripcion,
                estado || cancha.estado,
                id
            ]);
            
            const canchaActualizada = await db.get(
                'SELECT * FROM canchas WHERE id = ?', 
                [id]
            );
            
            res.json({
                success: true,
                message: 'Cancha actualizada exitosamente',
                data: canchaActualizada
            });
            
        } catch (error) {
            console.error('Error actualizando cancha:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cambiar estado de cancha
    async cambiarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body;
            
            const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
            
            if (!cancha) {
                return res.status(404).json({
                    success: false,
                    message: 'Cancha no encontrada'
                });
            }
            
            await db.run(
                'UPDATE canchas SET estado = ?, updated_at = NOW() WHERE id = ?',
                [estado, id]
            );
            
            res.json({
                success: true,
                message: `Estado cambiado a: ${estado}`
            });
            
        } catch (error) {
            console.error('Error cambiando estado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Eliminar cancha
    async eliminarCancha(req, res) {
        try {
            const { id } = req.params;
            
            const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
            
            if (!cancha) {
                return res.status(404).json({
                    success: false,
                    message: 'Cancha no encontrada'
                });
            }
            
            // Verificar reservas futuras
            const reservasFuturas = await db.get(`
                SELECT COUNT(*) as cantidad
                FROM reservas 
                WHERE cancha_id = ? AND fecha >= CURDATE() AND estado_id IN (1, 2)
            `, [id]);
            
            if (reservasFuturas.cantidad > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar: tiene reservas futuras activas'
                });
            }
            
            await db.run('DELETE FROM canchas WHERE id = ?', [id]);
            
            res.json({
                success: true,
                message: 'Cancha eliminada exitosamente'
            });
            
        } catch (error) {
            console.error('Error eliminando cancha:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new CanchaController();