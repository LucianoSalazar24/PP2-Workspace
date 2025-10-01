const express = require('express');
const app = express();

app.use(express.json());

// Agregar solo canchas para probar
const canchasRoutes = require('./src/routes/canchas');
app.use('/api/canchas', canchasRoutes);

app.get('/', (req, res) => {
    res.send('Servidor con canchas funcionando');
});

app.listen(3001, () => {
    console.log('Servidor con canchas en puerto 3001');
});