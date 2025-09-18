// src/routes/canchas.js - Rutas para el manejo de canchas
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

// Middleware para validar errores
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: errors.array()
        });
    }
    next();
};

// GET /api/canchas - Obtener todas las canchas
router.get('/', async (req, res) => {
    try {
        const db = require('../Config/dataBase');
        
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
});

// GET /api/canchas/:id - Obtener una cancha específica
router.get('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../Config/dataBase');
        
        const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
        if (!cancha) {
            return res.status(404).json({
                success: false,
                message: 'Cancha no encontrada'
            });
        }
        
        // Obtener estadísticas de la cancha
        const estadisticas = await db.get(`
            SELECT 
                COUNT(*) as total_reservas,
                SUM(CASE WHEN estado_id = 4 THEN 1 ELSE 0 END) as reservas_completadas,
                AVG(precio_total) as ingreso_promedio,
                SUM(precio_total) as ingresos_totales
            FROM reservas 
            WHERE cancha_id = ?
        `, [id]);
        
        res.json({
            success: true,
            data: {
                ...cancha,
                estadisticas: estadisticas
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo cancha:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/canchas - Crear nueva cancha
router.post('/', [
    body('nombre').notEmpty().isLength({ min: 3, max: 100 })
        .withMessage('Nombre es requerido y debe tener entre 3 y 100 caracteres'),
    body('capacidad').isInt({ min: 1, max: 50 }).withMessage('Capacidad debe ser entre 1 y 50'),
    body('precio_por_hora').isFloat({ min: 0 }).withMessage('Precio por hora debe ser un número positivo'),
    body('descripcion').optional().isString().isLength({ max: 500 })
        .withMessage('Descripción no puede exceder 500 caracteres'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { nombre, capacidad, precio_por_hora, descripcion = '' } = req.body;
        const db = require('../Config/dataBase');
        
        // Verificar si ya existe una cancha con ese nombre
        const nombreExistente = await db.get('SELECT id FROM canchas WHERE nombre = ?', [nombre]);
        
        if (nombreExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una cancha con ese nombre'
            });
        }
        
        const resultado = await db.run(`
            INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion)
            VALUES (?, ?, ?, ?)
        `, [nombre, capacidad, precio_por_hora, descripcion]);
        
        const canchaCreada = await db.get('SELECT * FROM canchas WHERE id = ?', [resultado.id]);
        
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
});

// PUT /api/canchas/:id - Actualizar cancha
router.put('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('nombre').optional().isLength({ min: 3, max: 100 })
        .withMessage('Nombre debe tener entre 3 y 100 caracteres'),
    body('capacidad').optional().isInt({ min: 1, max: 50 }).withMessage('Capacidad debe ser entre 1 y 50'),
    body('precio_por_hora').optional().isFloat({ min: 0 }).withMessage('Precio por hora debe ser positivo'),
    body('descripcion').optional().isString().isLength({ max: 500 })
        .withMessage('Descripción no puede exceder 500 caracteres'),
    body('estado').optional().isIn(['disponible', 'mantenimiento', 'fuera_servicio'])
        .withMessage('Estado inválido'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, capacidad, precio_por_hora, descripcion, estado } = req.body;
        const db = require('../Config/dataBase');
        
        const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
        if (!cancha) {
            return res.status(404).json({
                success: false,
                message: 'Cancha no encontrada'
            });
        }
        
        // Verificar conflicto de nombre (si se está cambiando)
        if (nombre && nombre !== cancha.nombre) {
            const nombreExistente = await db.get(
                'SELECT id FROM canchas WHERE nombre = ? AND id != ?',
                [nombre, id]
            );
            
            if (nombreExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una cancha con ese nombre'
                });
            }
        }
        
        await db.run(`
            UPDATE canchas 
            SET nombre = ?, capacidad = ?, precio_por_hora = ?, descripcion = ?, estado = ?, updated_at = NOW()
            WHERE id = ?
        `, [
            nombre || cancha.nombre,
            capacidad || cancha.capacidad,
            precio_por_hora || cancha.precio_por_hora,
            descripcion !== undefined ? descripcion : cancha.descripcion,
            estado || cancha.estado,
            id
        ]);
        
        const canchaActualizada = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
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
});

// PUT /api/canchas/:id/estado - Cambiar estado de la cancha
router.put('/:id/estado', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('estado').isIn(['disponible', 'mantenimiento', 'fuera_servicio'])
        .withMessage('Estado debe ser: disponible, mantenimiento o fuera_servicio'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        const db = require('../Config/dataBase');
        
        const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
        if (!cancha) {
            return res.status(404).json({
                success: false,
                message: 'Cancha no encontrada'
            });
        }
        
        await db.run('UPDATE canchas SET estado = ?, updated_at = NOW() WHERE id = ?', [estado, id]);
        
        res.json({
            success: true,
            message: `Estado de cancha cambiado a: ${estado}`
        });
        
    } catch (error) {
        console.error('Error cambiando estado de cancha:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/canchas/:id/disponibilidad - Ver disponibilidad específica de una cancha
router.get('/:id/disponibilidad', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    query('fecha').notEmpty().isISO8601().withMessage('Fecha es requerida (formato YYYY-MM-DD)'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha } = req.query;
        const db = require('../Config/dataBase');
        
        const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
        if (!cancha) {
            return res.status(404).json({
                success: false,
                message: 'Cancha no encontrada'
            });
        }
        
        // Obtener reservas del día
        const reservas = await db.all(`
            SELECT hora_inicio, hora_fin, 
                   CONCAT(c.nombre, ' ', c.apellido) as cliente
            FROM reservas r
            JOIN clientes c ON r.cliente_id = c.id
            WHERE r.cancha_id = ? AND r.fecha = ? AND r.estado_id IN (1, 2)
            ORDER BY r.hora_inicio ASC
        `, [id, fecha]);
        
        res.json({
            success: true,
            data: {
                cancha: cancha,
                fecha: fecha,
                reservas: reservas,
                total_reservas: reservas.length
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo disponibilidad de cancha:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// DELETE /api/canchas/:id - Eliminar cancha (solo admin)
router.delete('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../Config/dataBase');
        
        const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [id]);
        
        if (!cancha) {
            return res.status(404).json({
                success: false,
                message: 'Cancha no encontrada'
            });
        }
        
        // Verificar si tiene reservas futuras
        const reservasFuturas = await db.get(`
            SELECT COUNT(*) as cantidad
            FROM reservas 
            WHERE cancha_id = ? AND fecha >= CURDATE() AND estado_id IN (1, 2)
        `, [id]);
        
        if (reservasFuturas.cantidad > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar la cancha: tiene reservas futuras activas'
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
});

module.exports = router;