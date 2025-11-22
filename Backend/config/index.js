// ./config/index.js - Configuración unificada de base de datos
require('dotenv').config();

// Determinar qué base de datos usar
const DB_TYPE = process.env.DB_TYPE || 'mariadb'; // 'mariadb' o 'supabase'

let db;

if (DB_TYPE === 'supabase') {
    console.log('🚀 Usando Supabase (PostgreSQL)');
    db = require('./supabase');
} else {
    console.log('🚀 Usando MariaDB (Local)');
    db = require('./database');
}

module.exports = db;
