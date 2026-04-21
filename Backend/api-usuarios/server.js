// Backend/api-usuarios/server.js - Microservicio de Usuarios
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT_USUARIOS || 3001;

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'api-usuarios', status: 'ok', timestamp: new Date().toISOString() });
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('[api-usuarios] Error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🟢 API Usuarios corriendo en puerto ${PORT}`);
    console.log(`   Auth:     http://localhost:${PORT}/api/auth`);
    console.log(`   Clientes: http://localhost:${PORT}/api/clientes`);
    console.log('========================================');
});

module.exports = app;
