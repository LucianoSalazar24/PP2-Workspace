// Backend/api-pagos/server.js - Microservicio de Pagos
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT_PAGOS || 3004;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const pagosRoutes = require('./routes/pagos');
app.use('/api/pagos', pagosRoutes);

app.get('/health', (req, res) => {
    res.json({ service: 'api-pagos', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('[api-pagos] Error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🟢 API Pagos corriendo en puerto ${PORT}`);
    console.log(`   Pagos: http://localhost:${PORT}/api/pagos`);
    console.log('========================================');
});

module.exports = app;
