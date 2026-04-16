// Backend/api-canchas/routes/canchas.js
const express = require('express');
const router = express.Router();
const canchaController = require('../controllers/canchaController');
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

// GET /api/canchas
router.get('/', canchaController.obtenerCanchas);

// GET /api/canchas/:id
router.get('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], canchaController.obtenerCanchaPorId);

// GET /api/canchas/:id/disponibilidad
router.get('/:id/disponibilidad', [
    param('id').isInt({ min: 1 }),
    query('fecha').notEmpty().isISO8601(),
    handleValidationErrors
], canchaController.obtenerDisponibilidad);

// POST /api/canchas
router.post('/', [
    body('nombre').notEmpty().isLength({ min: 3, max: 100 }),
    body('capacidad').isInt({ min: 1, max: 50 }),
    body('precio_por_hora').isFloat({ min: 0 }),
    body('descripcion').optional().isString().isLength({ max: 500 }),
    handleValidationErrors
], canchaController.crearCancha);

// PUT /api/canchas/:id
router.put('/:id', [
    param('id').isInt({ min: 1 }),
    body('nombre').optional().isLength({ min: 3, max: 100 }),
    body('capacidad').optional().isInt({ min: 1, max: 50 }),
    body('precio_por_hora').optional().isFloat({ min: 0 }),
    body('descripcion').optional().isString().isLength({ max: 500 }),
    body('estado').optional().isIn(['disponible', 'mantenimiento', 'fuera_servicio']),
    handleValidationErrors
], canchaController.actualizarCancha);

// PUT /api/canchas/:id/estado
router.put('/:id/estado', [
    param('id').isInt({ min: 1 }),
    body('estado').isIn(['disponible', 'mantenimiento', 'fuera_servicio']),
    handleValidationErrors
], canchaController.cambiarEstado);

// DELETE /api/canchas/:id
router.delete('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], canchaController.eliminarCancha);

module.exports = router;
