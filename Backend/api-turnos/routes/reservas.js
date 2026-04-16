// Backend/api-turnos/routes/reservas.js
const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
const { body, param, query, validationResult } = require('express-validator');

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

// GET /api/reservas
router.get('/', [
    query('fecha').optional().isISO8601(),
    query('cancha_id').optional().isInt({ min: 1 }),
    query('cliente_id').optional().isInt({ min: 1 }),
    query('estado').optional().isIn(['pendiente', 'confirmada', 'cancelada', 'completada', 'no_show']),
    query('limite').optional().isInt({ min: 1, max: 100 }),
    handleValidationErrors
], reservaController.obtenerReservas);

// GET /api/reservas/disponibilidad
router.get('/disponibilidad', [
    query('fecha').notEmpty().isISO8601(),
    query('cancha_id').optional().isInt({ min: 1 }),
    handleValidationErrors
], reservaController.obtenerDisponibilidad);

// GET /api/reservas/:id
router.get('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], reservaController.obtenerReservaPorId);

// POST /api/reservas
router.post('/', [
    body('cancha_id').isInt({ min: 1 }),
    body('cliente_id').isInt({ min: 1 }),
    body('fecha').isISO8601(),
    body('hora_inicio').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('hora_fin').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('observaciones').optional().isString().isLength({ max: 500 }),
    handleValidationErrors
], reservaController.crearReserva);

// PUT /api/reservas/:id/confirmar
router.put('/:id/confirmar', [
    param('id').isInt({ min: 1 }),
    body('monto_pagado').isFloat({ min: 0 }),
    body('metodo_pago').isIn(['efectivo', 'tarjeta', 'transferencia']),
    handleValidationErrors
], reservaController.confirmarReserva);

// PUT /api/reservas/:id/cancelar
router.put('/:id/cancelar', [
    param('id').isInt({ min: 1 }),
    body('razon').optional().isString().isLength({ max: 200 }),
    handleValidationErrors
], reservaController.cancelarReserva);

// PUT /api/reservas/:id/completar
router.put('/:id/completar', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], reservaController.completarReserva);

// PUT /api/reservas/:id/no-show
router.put('/:id/no-show', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], reservaController.marcarNoShow);

// DELETE /api/reservas/:id
router.delete('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], reservaController.eliminarReserva);

module.exports = router;
