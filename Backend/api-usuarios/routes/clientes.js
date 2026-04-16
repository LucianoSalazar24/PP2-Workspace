// Backend/api-usuarios/routes/clientes.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
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

// GET /api/clientes
router.get('/', [
    query('limite').optional().isInt({ min: 1, max: 100 }),
    query('buscar').optional().isString().isLength({ min: 2, max: 50 }),
    handleValidationErrors
], clienteController.obtenerClientes);

// GET /api/clientes/buscar-telefono
router.get('/buscar-telefono', [
    query('telefono').notEmpty().withMessage('Teléfono es requerido'),
    handleValidationErrors
], clienteController.buscarPorTelefono);

// GET /api/clientes/tipos/lista
router.get('/tipos/lista', async (req, res) => {
    try {
        const supabase = require('../../shared/supabase');
        const { data: tipos, error } = await supabase
            .from('tipos_cliente')
            .select('id, nombre, descuento_porcentaje, min_reservas_mes, descripcion')
            .order('id');

        if (error) throw error;

        res.json({ success: true, data: tipos });
    } catch (error) {
        console.error('Error obteniendo tipos de cliente:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// GET /api/clientes/:id
router.get('/:id', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], clienteController.obtenerClientePorId);

// GET /api/clientes/:id/estadisticas
router.get('/:id/estadisticas', [
    param('id').isInt({ min: 1 }),
    handleValidationErrors
], clienteController.obtenerEstadisticas);

// POST /api/clientes
router.post('/', [
    body('nombre').notEmpty().isLength({ min: 2, max: 50 }),
    body('apellido').notEmpty().isLength({ min: 2, max: 50 }),
    body('telefono').notEmpty(),
    body('email').optional().isEmail(),
    handleValidationErrors
], clienteController.crearCliente);

// PUT /api/clientes/:id
router.put('/:id', [
    param('id').isInt({ min: 1 }),
    body('nombre').optional().isLength({ min: 2, max: 50 }),
    body('apellido').optional().isLength({ min: 2, max: 50 }),
    body('telefono').optional(),
    body('email').optional().isEmail(),
    handleValidationErrors
], clienteController.actualizarCliente);

// PUT /api/clientes/:id/estado
router.put('/:id/estado', [
    param('id').isInt({ min: 1 }),
    body('estado').isIn(['activo', 'suspendido', 'bloqueado']),
    handleValidationErrors
], clienteController.cambiarEstadoCliente);

module.exports = router;
