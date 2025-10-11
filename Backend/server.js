// server.js - Servidor Principal del Sistema de Reservas
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de configuración
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../Frontend')));

// Importar rutas - Ajustado a tu estructura de carpetas
const authRoutes = require('../routes/auth');
const reservasRoutes = require('../routes/reservas');
const clientesRoutes = require('../routes/clientes');
const canchasRoutes = require('../routes/canchas');

// Usar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/canchas', canchasRoutes);

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Ruta raíz - servir la página principal
app.get('/', (req, res) => {
    res.json({
        message: 'Sistema de Reservas de Canchas de Fútbol',
        version: '1.0.0',
        endpoints: {
            reservas: '/api/reservas',
            clientes: '/api/clientes',
            canchas: '/api/canchas',
            test: '/api/test'
        }
    });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Error de validación
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Datos inválidos',
            errors: err.details
        });
    }
    
    // Error de base de datos
    if (err.code && err.code.includes('ER_')) {
        return res.status(409).json({
            success: false,
            message: 'Error en la base de datos',
            details: err.message
        });
    }
    
    // Error genérico del servidor
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
});

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
    if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            message: 'Endpoint no encontrado'
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'Página no encontrada'
        });
    }
});

// Inicializar servidor
app.listen(PORT, async () => {
    console.log('========================================');
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
    console.log('========================================');
    
    // Inicializar base de datos
    try {
        const db = require('../Config/dataBase');
        await db.initialize();
        console.log('Base de datos conectada exitosamente');
    } catch (err) {
        console.error('Error conectando base de datos:', err.message);
        console.log('Asegurate de que XAMPP este corriendo');
    }
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\nCerrando servidor...');
    try {
        const db = require('./config/database');
        await db.close();
        console.log('Conexiones cerradas correctamente');
        process.exit(0);
    } catch (err) {
        console.error('Error cerrando conexiones:', err);
        process.exit(1);
    }
});

module.exports = app;