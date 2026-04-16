// Backend/gateway/server.js - API Gateway
// Sirve el frontend y enruta las peticiones a los microservicios
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Puertos de los microservicios
const SERVICES = {
    usuarios: process.env.PORT_USUARIOS || 3001,
    canchas: process.env.PORT_CANCHAS || 3002,
    turnos: process.env.PORT_TURNOS || 3003,
    pagos: process.env.PORT_PAGOS || 3004,
};

// Middlewares globales
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../../Frontend')));

// ============================================================
// PROXY A MICROSERVICIOS
// ============================================================

// Usuarios (Auth y Clientes) → puerto 3001
app.use(createProxyMiddleware({
    pathFilter: ['/api/auth', '/api/clientes'],
    target: `http://localhost:${SERVICES.usuarios}`,
    changeOrigin: true,
}));

// Canchas → puerto 3002
app.use(createProxyMiddleware({
    pathFilter: '/api/canchas',
    target: `http://localhost:${SERVICES.canchas}`,
    changeOrigin: true,
}));

// Reservas (Turnos) → puerto 3003
app.use(createProxyMiddleware({
    pathFilter: '/api/reservas',
    target: `http://localhost:${SERVICES.turnos}`,
    changeOrigin: true,
}));

// Pagos → puerto 3004
app.use(createProxyMiddleware({
    pathFilter: '/api/pagos',
    target: `http://localhost:${SERVICES.pagos}`,
    changeOrigin: true,
}));

// ============================================================
// RUTAS DEL GATEWAY
// ============================================================

// Ruta de prueba / estado de servicios
app.get('/api/test', async (req, res) => {
    const estados = {};

    for (const [nombre, puerto] of Object.entries(SERVICES)) {
        try {
            const response = await fetch(`http://localhost:${puerto}/health`);
            const data = await response.json();
            estados[nombre] = { status: 'ok', port: puerto };
        } catch (e) {
            estados[nombre] = { status: 'down', port: puerto };
        }
    }

    res.json({
        success: true,
        message: 'Gateway del Sistema de Reservas',
        version: '2.0.0 - Microservicios',
        timestamp: new Date().toISOString(),
        services: estados
    });
});

// Ruta raíz - info del sistema
app.get('/api', (req, res) => {
    res.json({
        message: 'Sistema de Reservas de Canchas de Fútbol - API Gateway',
        version: '2.0.0',
        services: {
            usuarios: `http://localhost:${SERVICES.usuarios}`,
            canchas: `http://localhost:${SERVICES.canchas}`,
            turnos: `http://localhost:${SERVICES.turnos}`,
            pagos: `http://localhost:${SERVICES.pagos}`,
        },
        endpoints: {
            auth: '/api/auth',
            clientes: '/api/clientes',
            canchas: '/api/canchas',
            reservas: '/api/reservas',
            pagos: '/api/pagos',
            test: '/api/test'
        }
    });
});

// Middleware para rutas no encontradas en la API
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado'
    });
});

// Para cualquier otra ruta, enviar el index.html (SPA-like)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../Frontend/index.html'));
});

// Iniciar Gateway
app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   🚀 GATEWAY - Sistema de Reservas       ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║   Gateway:    http://localhost:${PORT}        ║`);
    console.log(`║   Usuarios:   http://localhost:${SERVICES.usuarios}        ║`);
    console.log(`║   Canchas:    http://localhost:${SERVICES.canchas}        ║`);
    console.log(`║   Turnos:     http://localhost:${SERVICES.turnos}        ║`);
    console.log(`║   Pagos:      http://localhost:${SERVICES.pagos}        ║`);
    console.log('╚══════════════════════════════════════════╝');
});

module.exports = app;
