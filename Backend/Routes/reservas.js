// src/routes/reservas.js - Rutas para el manejo de reservas
const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
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

// GET /api/reservas - Obtener todas las reservas con filtros
router.get('/', [
    query('fecha').optional().isISO8601().withMessage('Formato de fecha inválido (YYYY-MM-DD)'),
    query('cancha_id').optional().isInt({ min: 1 }).withMessage('ID de cancha debe ser un número positivo'),
    query('cliente_id').optional().isInt({ min: 1 }).withMessage('ID de cliente debe ser un número positivo'),
    query('estado').optional().isIn(['pendiente', 'confirmada', 'cancelada', 'completada', 'no_show'])
        .withMessage('Estado inválido'),
    query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
    handleValidationErrors
], reservaController.obtenerReservas);

// GET /api/reservas/disponibilidad - Verificar disponibilidad de canchas
router.get('/disponibilidad', [
    query('fecha').notEmpty().isISO8601().withMessage('Fecha es requerida y debe tener formato YYYY-MM-DD'),
    query('cancha_id').optional().isInt({ min: 1 }).withMessage('ID de cancha debe ser un número positivo'),
    handleValidationErrors
], reservaController.obtenerDisponibilidad);

// GET /api/reservas/:id - Obtener una reserva específica
router.get('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../config/database');
        
        const reserva = await db.get(`
            SELECT 
                r.*,
                c.nombre as cancha_nombre,
                c.precio_por_hora,
                cl.nombre as cliente_nombre,
                cl.apellido as cliente_apellido,
                cl.telefono as cliente_telefono,
                cl.email as cliente_email,
                er.nombre as estado,
                er.descripcion as estado_descripcion
            FROM reservas r
            JOIN canchas c ON r.cancha_id = c.id
            JOIN clientes cl ON r.cliente_id = cl.id
            JOIN estados_reserva er ON r.estado_id = er.id
            WHERE r.id = ?
        `, [id]);
        
        if (!reserva) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada'
            });
        }
        
        // Obtener historial de pagos
        const pagos = await db.all(
            'SELECT * FROM pagos WHERE reserva_id = ? ORDER BY fecha_pago ASC',
            [id]
        );
        
        res.json({
            success: true,
            data: {
                ...reserva,
                pagos: pagos
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/reservas - Crear nueva reserva
router.post('/', [
    body('cancha_id').isInt({ min: 1 }).withMessage('ID de cancha es requerido y debe ser válido'),
    body('cliente_id').isInt({ min: 1 }).withMessage('ID de cliente es requerido y debe ser válido'),
    body('fecha').isISO8601().withMessage('Fecha es requerida (formato YYYY-MM-DD)'),
    body('hora_inicio').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Hora de inicio debe tener formato HH:MM'),
    body('hora_fin').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Hora de fin debe tener formato HH:MM'),
    body('observaciones').optional().isString().isLength({ max: 500 })
        .withMessage('Observaciones no pueden exceder 500 caracteres'),
    handleValidationErrors
], reservaController.crearReserva);

// PUT /api/reservas/:id/confirmar - Confirmar reserva con pago
router.put('/:id/confirmar', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('monto_pagado').isFloat({ min: 0 }).withMessage('Monto pagado debe ser un número positivo'),
    body('metodo_pago').isIn(['efectivo', 'tarjeta', 'transferencia'])
        .withMessage('Método de pago inválido'),
    handleValidationErrors
], reservaController.confirmarReserva);

// PUT /api/reservas/:id/cancelar - Cancelar reserva
router.put('/:id/cancelar', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('razon').optional().isString().isLength({ max: 200 })
        .withMessage('Razón de cancelación no puede exceder 200 caracteres'),
    handleValidationErrors
], reservaController.cancelarReserva);

// PUT /api/reservas/:id/completar - Marcar reserva como completada
router.put('/:id/completar', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../config/database');
        
        const reserva = await db.get('SELECT * FROM reservas WHERE id = ?', [id]);
        
        if (!reserva) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada'
            });
        }
        
        if (reserva.estado_id !== 2) {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden completar reservas confirmadas'
            });
        }
        
        await db.run('UPDATE reservas SET estado_id = 4 WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Reserva marcada como completada'
        });
        
    } catch (error) {
        console.error('Error completando reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/reservas/:id/no-show - Marcar como no presentado
router.put('/:id/no-show', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../config/database');
        
        const reserva = await db.get('SELECT * FROM reservas WHERE id = ?', [id]);
        
        if (!reserva) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada'
            });
        }
        
        if (reserva.estado_id !== 2) {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden marcar como no-show reservas confirmadas'
            });
        }
        
        // Actualizar reserva y incrementar contador de no-shows del cliente
        await db.transaction(async (conn) => {
            await conn.query('UPDATE reservas SET estado_id = 5 WHERE id = ?', [id]);
            await conn.query('UPDATE clientes SET no_shows = no_shows + 1 WHERE id = ?', [reserva.cliente_id]);
        });
        
        res.json({
            success: true,
            message: 'Reserva marcada como no-show'
        });
        
    } catch (error) {
        console.error('Error marcando no-show:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// DELETE /api/reservas/:id - Eliminar reserva (solo admin)
router.delete('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const db = require('../config/database');
        
        const reserva = await db.get('SELECT * FROM reservas WHERE id = ?', [id]);
        
        if (!reserva) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada'
            });
        }
        
        await db.transaction(async (conn) => {
            // Eliminar pagos relacionados
            await conn.query('DELETE FROM pagos WHERE reserva_id = ?', [id]);
            // Eliminar reserva
            await conn.query('DELETE FROM reservas WHERE id = ?', [id]);
            // Decrementar contador del cliente
            await conn.query('UPDATE clientes SET total_reservas = total_reservas - 1 WHERE id = ?', [reserva.cliente_id]);
        });
        
        res.json({
            success: true,
            message: 'Reserva eliminada exitosamente'
        });
        
    } catch (error) {
        console.error('Error eliminando reserva:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;