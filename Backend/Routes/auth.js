// routes/auth.js - Rutas de autenticación
const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const { body, validationResult } = require('express-validator');

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

// POST /api/auth/login - Iniciar sesión
router.post('/login', [
    body('email').isEmail().withMessage('Email debe ser válido'),
    body('password').notEmpty().withMessage('Contraseña es requerida'),
    handleValidationErrors
], authController.login);

// POST /api/auth/registro - Registrar nuevo usuario
router.post('/registro', [
    body('nombre').notEmpty().isLength({ min: 2, max: 50 })
        .withMessage('Nombre debe tener entre 2 y 50 caracteres'),
    body('apellido').notEmpty().isLength({ min: 2, max: 50 })
        .withMessage('Apellido debe tener entre 2 y 50 caracteres'),
    body('email').isEmail().withMessage('Email debe ser válido'),
    body('telefono').notEmpty().withMessage('Teléfono es requerido'),
    body('password').isLength({ min: 6 })
        .withMessage('Contraseña debe tener al menos 6 caracteres'),
    handleValidationErrors
], authController.registro);

// POST /api/auth/verificar - Verificar sesión activa
router.post('/verificar', authController.verificarSesion);

module.exports = router;