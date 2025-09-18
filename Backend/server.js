// server.js - Servidor Principal del Sistema de Reservas
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad y configuración
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Importar rutas
const reservasRoutes = require('./src/routes/reservas');
const clientesRoutes = require('./src/routes/clientes');
const canchasRoutes = require('./src/routes/canchas');
const configRoutes = require('./src/routes/config');

// Usar rutas de la API
app.use('/api/reservas', reservasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/canchas', canchasRoutes);
app.use('/api/config', configRoutes);

// Ruta raíz - servir la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Ruta para el panel de administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/admin.html'));
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
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({
            success: false,
            message: 'Conflicto en los datos - posible duplicado'
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
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    }
});

// Inicializar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    
    // Inicializar base de datos
    const db = require('./src/config/database');
    db.initialize().then(() => {
        console.log('✅ Base de datos inicializada correctamente');
    }).catch(err => {
        console.error('❌ Error inicializando base de datos:', err);
    });
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    const db = require('./src/config/database');
    db.close().then(() => {
        console.log('✅ Conexiones cerradas correctamente');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Error cerrando conexiones:', err);
        process.exit(1);
    });
});

module.exports = app;