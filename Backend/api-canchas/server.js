// Backend/api-canchas/server.js - Microservicio de Canchas
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT_CANCHAS || 3002;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const canchasRoutes = require('./routes/canchas');
app.use('/api/canchas', canchasRoutes);

app.get('/health', (req, res) => {
    res.json({ service: 'api-canchas', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('[api-canchas] Error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🟢 API Canchas corriendo en puerto ${PORT}`);
    console.log(`   Canchas: http://localhost:${PORT}/api/canchas`);
    console.log('========================================');
});

module.exports = app;
