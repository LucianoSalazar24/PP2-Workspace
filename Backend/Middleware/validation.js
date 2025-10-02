// middleware/validation.js - Validaciones reutilizables
const { body, param, query, validationResult } = require('express-validator');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: errors.array().map(err => ({
                campo: err.path,
                mensaje: err.msg,
                valor: err.value
            }))
        });
    }
    next();
};

// Validaciones comunes para nombres
const nombreValidacion = body('nombre')
    .notEmpty().withMessage('Nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('Nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Nombre solo puede contener letras y espacios')
    .trim();

const apellidoValidacion = body('apellido')
    .notEmpty().withMessage('Apellido es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('Apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/).withMessage('Apellido solo puede contener letras y espacios')
    .trim();

// Validaciones de contacto
const telefonoValidacion = body('telefono')
    .notEmpty().withMessage('Teléfono es requerido')
    .isMobilePhone('any').withMessage('Teléfono debe tener formato válido')
    .trim();

const emailValidacion = body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Email debe tener formato válido')
    .normalizeEmail();

// Validaciones de fecha y hora
const fechaValidacion = query('fecha')
    .notEmpty().withMessage('Fecha es requerida')
    .isISO8601().withMessage('Fecha debe tener formato YYYY-MM-DD')
    .custom((value) => {
        const fecha = new Date(value);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fecha < hoy) {
            throw new Error('La fecha no puede ser anterior a hoy');
        }
        return true;
    });

const horaValidacion = (campo) => body(campo)
    .notEmpty().withMessage(`${campo} es requerido`)
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage(`${campo} debe tener formato HH:MM (24 horas)`);

// Validación de ID
const idValidacion = param('id')
    .isInt({ min: 1 }).withMessage('ID debe ser un número positivo');

// Validaciones específicas para Reservas
const reservaValidaciones = [
    body('cancha_id').isInt({ min: 1 }).withMessage('ID de cancha es requerido'),
    body('cliente_id').isInt({ min: 1 }).withMessage('ID de cliente es requerido'),
    body('fecha').isISO8601().withMessage('Fecha inválida (formato YYYY-MM-DD)'),
    horaValidacion('hora_inicio'),
    horaValidacion('hora_fin'),
    body('observaciones').optional().isString().isLength({ max: 500 })
        .withMessage('Observaciones no pueden exceder 500 caracteres')
];

// Validaciones específicas para Clientes
const clienteValidaciones = [
    nombreValidacion,
    apellidoValidacion,
    telefonoValidacion,
    emailValidacion
];

// Validaciones específicas para Canchas
const canchaValidaciones = [
    body('nombre').notEmpty().isLength({ min: 3, max: 100 })
        .withMessage('Nombre de cancha debe tener entre 3 y 100 caracteres'),
    body('capacidad').isInt({ min: 1, max: 50 })
        .withMessage('Capacidad debe ser entre 1 y 50 jugadores'),
    body('precio_por_hora').isFloat({ min: 0 })
        .withMessage('Precio por hora debe ser un número positivo'),
    body('descripcion').optional().isString().isLength({ max: 500 })
        .withMessage('Descripción no puede exceder 500 caracteres')
];

// Validación de estado
const estadoValidacion = body('estado')
    .isIn(['disponible', 'mantenimiento', 'fuera_servicio'])
    .withMessage('Estado debe ser: disponible, mantenimiento o fuera_servicio');

// Validación de método de pago
const metodoPagoValidacion = body('metodo_pago')
    .isIn(['efectivo', 'tarjeta', 'transferencia'])
    .withMessage('Método de pago inválido');

// Validación de monto
const montoValidacion = body('monto_pagado')
    .isFloat({ min: 0 }).withMessage('Monto debe ser un número positivo');

// Exportar todas las validaciones
module.exports = {
    handleValidationErrors,
    
    // Validaciones individuales
    nombreValidacion,
    apellidoValidacion,
    telefonoValidacion,
    emailValidacion,
    fechaValidacion,
    horaValidacion,
    idValidacion,
    estadoValidacion,
    metodoPagoValidacion,
    montoValidacion,
    
    // Validaciones agrupadas
    reservaValidaciones,
    clienteValidaciones,
    canchaValidaciones,
    
    // Validaciones personalizadas
    validarHorario: (req, res, next) => {
        const { hora_inicio, hora_fin } = req.body;
        
        if (!hora_inicio || !hora_fin) {
            return next();
        }
        
        const inicio = new Date(`2000-01-01T${hora_inicio}`);
        const fin = new Date(`2000-01-01T${hora_fin}`);
        
        if (fin <= inicio) {
            return res.status(400).json({
                success: false,
                message: 'La hora de fin debe ser posterior a la hora de inicio'
            });
        }
        
        const duracionHoras = (fin - inicio) / (1000 * 60 * 60);
        const duracionMaxima = 3; // Puedes hacer esto configurable
        
        if (duracionHoras > duracionMaxima) {
            return res.status(400).json({
                success: false,
                message: `La duración máxima de una reserva es ${duracionMaxima} horas`
            });
        }
        
        next();
    },
    
    validarFechaFutura: (req, res, next) => {
        const { fecha } = req.body;
        
        if (!fecha) {
            return next();
        }
        
        const fechaReserva = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        if (fechaReserva < hoy) {
            return res.status(400).json({
                success: false,
                message: 'No se pueden hacer reservas en fechas pasadas'
            });
        }
        
        next();
    }
};