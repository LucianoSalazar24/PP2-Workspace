// Backend/api-pagos/routes/pagos.js
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
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

// GET /api/pagos
router.get('/', [
    query('reserva_id').optional().isInt({ min: 1 }),
    query('tipo_pago').optional().isIn(['seña', 'saldo', 'completo', 'devolucion']),
    query('metodo_pago').optional().isIn(['efectivo', 'tarjeta', 'transferencia']),
    query('limite').optional().isInt({ min: 1, max: 100 }),
    handleValidationErrors
], pagoController.obtenerPagos);

// GET /api/pagos/estadisticas
router.get('/estadisticas', pagoController.obtenerEstadisticas);

// GET /api/pagos/reserva/:reserva_id
router.get('/reserva/:reserva_id', [
    param('reserva_id').isInt({ min: 1 }),
    handleValidationErrors
], pagoController.obtenerPagosPorReserva);

// GET /api/pagos/:id
router.get('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], pagoController.obtenerPagoPorId);

// POST /api/pagos
router.post('/', [
    body('reserva_id').isInt({ min: 1 }).withMessage('ID de reserva es requerido'),
    body('monto').isFloat({ min: 0.01 }).withMessage('Monto debe ser positivo'),
    body('tipo_pago').isIn(['seña', 'saldo', 'completo', 'devolucion']).withMessage('Tipo de pago inválido'),
    body('metodo_pago').isIn(['efectivo', 'tarjeta', 'transferencia']).withMessage('Método de pago inválido'),
    body('observaciones').optional().isString().isLength({ max: 500 }),
    handleValidationErrors
], pagoController.registrarPago);

module.exports = router;
