const express = require('express');
const router = express.Router();

// Usar el controlador apropiado según el tipo de base de datos
const DB_TYPE = process.env.DB_TYPE || 'mariadb';
const diasBloqueadosController = DB_TYPE === 'supabase'
    ? require('../Controllers/diasBloqueadosControllerSupabase')
    : require('../Controllers/diasBloqueadosController');

/**
 * @route   GET /api/dias-bloqueados
 * @desc    Obtener todos los días bloqueados (con filtros opcionales)
 * @access  Public
 * @query   fecha_desde, fecha_hasta, futuro_solo
 */
router.get('/', diasBloqueadosController.obtenerDiasBloqueados);

/**
 * @route   GET /api/dias-bloqueados/proximos/:cantidad
 * @desc    Obtener próximos días bloqueados
 * @access  Public
 * @params  cantidad (default: 10)
 */
router.get('/proximos/:cantidad?', diasBloqueadosController.obtenerProximosDiasBloqueados);

/**
 * @route   GET /api/dias-bloqueados/verificar/:fecha
 * @desc    Verificar si una fecha está bloqueada
 * @access  Public
 * @params  fecha (YYYY-MM-DD)
 */
router.get('/verificar/:fecha', diasBloqueadosController.verificarDiaBloqueado);

/**
 * @route   GET /api/dias-bloqueados/:id
 * @desc    Obtener un día bloqueado por ID
 * @access  Public
 */
router.get('/:id', diasBloqueadosController.obtenerDiaBloqueadoPorId);

/**
 * @route   POST /api/dias-bloqueados
 * @desc    Crear un nuevo día bloqueado
 * @access  Admin only (agregar middleware de autenticación)
 * @body    { fecha, motivo, descripcion }
 */
router.post('/', diasBloqueadosController.crearDiaBloqueado);

/**
 * @route   PUT /api/dias-bloqueados/:id
 * @desc    Actualizar un día bloqueado
 * @access  Admin only (agregar middleware de autenticación)
 * @body    { fecha, motivo, descripcion }
 */
router.put('/:id', diasBloqueadosController.actualizarDiaBloqueado);

/**
 * @route   DELETE /api/dias-bloqueados/:id
 * @desc    Eliminar un día bloqueado
 * @access  Admin only (agregar middleware de autenticación)
 */
router.delete('/:id', diasBloqueadosController.eliminarDiaBloqueado);

module.exports = router;
