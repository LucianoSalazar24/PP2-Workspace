// src/routes/clientes.js - Rutas para el manejo de clientes
const express = require('express');
const router = express.Router();
const clienteController = require('../Controllers/clienteController');
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

// GET /api/clientes - Obtener todos los clientes
router.get('/', [
    query('limite').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
    query('buscar').optional().isString().isLength({ min: 2, max: 50 })
        .withMessage('Búsqueda debe tener entre 2 y 50 caracteres'),
    handleValidationErrors
], clienteController.obtenerClientes);

// GET /api/clientes/buscar-telefono - Buscar cliente por teléfono
router.get('/buscar-telefono', [
    query('telefono').notEmpty().isMobilePhone('any').withMessage('Teléfono es requerido y debe ser válido'),
    handleValidationErrors
], clienteController.buscarPorTelefono);

// GET /api/clientes/:id - Obtener cliente específico
router.get('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], clienteController.obtenerClientePorId);

// GET /api/clientes/:id/estadisticas - Obtener estadísticas del cliente
router.get('/:id/estadisticas', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    handleValidationErrors
], clienteController.obtenerEstadisticas);

// POST /api/clientes - Crear nuevo cliente
router.post('/', [
    body('nombre').notEmpty().isLength({ min: 2, max: 50 })
        .withMessage('Nombre es requerido y debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Nombre solo puede contener letras y espacios'),
    body('apellido').notEmpty().isLength({ min: 2, max: 50 })
        .withMessage('Apellido es requerido y debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Apellido solo puede contener letras y espacios'),
    body('telefono').notEmpty().isMobilePhone('any').withMessage('Teléfono es requerido y debe ser válido'),
    body('email').optional().isEmail().withMessage('Email debe tener formato válido'),
    handleValidationErrors
], clienteController.crearCliente);

// PUT /api/clientes/:id - Actualizar cliente
router.put('/:id', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('nombre').optional().isLength({ min: 2, max: 50 })
        .withMessage('Nombre debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Nombre solo puede contener letras y espacios'),
    body('apellido').optional().isLength({ min: 2, max: 50 })
        .withMessage('Apellido debe tener entre 2 y 50 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Apellido solo puede contener letras y espacios'),
    body('telefono').optional().isMobilePhone('any').withMessage('Teléfono debe ser válido'),
    body('email').optional().isEmail().withMessage('Email debe tener formato válido'),
    body('tipo_cliente_id').optional().isInt({ min: 1, max: 3 }).withMessage('Tipo de cliente inválido'),
    handleValidationErrors
], clienteController.actualizarCliente);

// PUT /api/clientes/:id/estado - Cambiar estado del cliente
router.put('/:id/estado', [
    param('id').isInt({ min: 1 }).withMessage('ID debe ser un número positivo'),
    body('estado').isIn(['activo', 'suspendido', 'bloqueado']).withMessage('Estado inválido'),
    body('razon').optional().isString().isLength({ max: 200 })
        .withMessage('Razón no puede exceder 200 caracteres'),
    handleValidationErrors
], clienteController.cambiarEstadoCliente);

// GET /api/clientes/tipos - Obtener tipos de cliente disponibles
router.get('/tipos/lista', async (req, res) => {
    try {
        const db = require('../config/database');
        
        const tipos = await db.all(`
            SELECT id, nombre, descuento_porcentaje, min_reservas_mes, descripcion
            FROM tipos_cliente
            ORDER BY id ASC
        `);
        
        res.json({
            success: true,
            data: tipos
        });
        
    } catch (error) {
        console.error('Error obteniendo tipos de cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/clientes/actualizar-tipos - Actualizar automáticamente tipos de cliente
router.post('/actualizar-tipos', async (req, res) => {
    try {
        const db = require('../config/database');
        
        // Obtener configuraciones
        const reservasFrec = await db.getConfiguracion('min_reservas_frecuente') || 4;
        const reservasVip = await db.getConfiguracion('min_reservas_vip') || 8;
        
        // Actualizar clientes a tipo frecuente
        await db.run(`
            UPDATE clientes c
            SET tipo_cliente_id = 2
            WHERE c.total_reservas >= ? AND c.total_reservas < ? AND c.tipo_cliente_id = 1
        `, [reservasFrec, reservasVip]);
    } catch (error) {
        console.error('Error al actualizar los tipos de cliente:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

module.exports = router;