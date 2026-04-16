// Backend/api-turnos/server.js - Microservicio de Turnos (Reservas)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT_TURNOS || 3003;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const reservasRoutes = require('./routes/reservas');
app.use('/api/reservas', reservasRoutes);

app.get('/health', (req, res) => {
    res.json({ service: 'api-turnos', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    console.error('[api-turnos] Error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🟢 API Turnos corriendo en puerto ${PORT}`);
    console.log(`   Reservas: http://localhost:${PORT}/api/reservas`);
    console.log('========================================');
});

module.exports = app;
