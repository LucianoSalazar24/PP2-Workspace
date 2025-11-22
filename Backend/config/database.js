// ./config/database.js - Configuración y conexión a MariaDB (driver oficial)
const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.pool = null;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'lucho',
            password: process.env.DB_PASSWORD || '2448',
            database: process.env.DB_NAME || 'futbol_reservas',
            acquireTimeout: 60000,
            timeout: 60000,
            connectionLimit: 10
        };
    }

    async initialize() {
        try {
            // Crear pool de conexiones
            this.pool = mariadb.createPool(this.config);
            
            // Probar la conexión
            const conn = await this.pool.getConnection();
            console.log('✅ Conectado a MariaDB exitosamente');
            console.log(`📊 Base de datos: ${this.config.database}`);
            
            conn.release();
            
            // Verificar que las tablas existen
            await this.verifyTables();
            
        } catch (error) {
            console.error('❌ Error conectando a MariaDB:', error.message);
            throw error;
        }
    }

    async verifyTables() {
        try {
            const tables = await this.all('SHOW TABLES');
            const tableNames = tables.map(row => Object.values(row)[0]);
            
            const expectedTables = [
                'canchas', 'tipos_cliente', 'clientes', 'estados_reserva', 
                'reservas', 'pagos', 'configuraciones', 'bloqueos_horarios'
            ];
            
            const missingTables = expectedTables.filter(table => !tableNames.includes(table));
            
            if (missingTables.length > 0) {
                console.warn('⚠️  Tablas faltantes:', missingTables.join(', '));
            } else {
                console.log('✅ Todas las tablas están presentes');
            }
            
        } catch (error) {
            console.error('Error verificando tablas:', error);
        }
    }

    // Ejecutar consulta (INSERT, UPDATE, DELETE)
    async run(sql, params = []) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            const result = await conn.query(sql, params);
            
            return {
                id: result.insertId,
                changes: result.affectedRows,
                info: result
            };
        } catch (error) {
            console.error('Error en consulta run:', sql, params);
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    // Obtener una fila
    async get(sql, params = []) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            const rows = await conn.query(sql, params);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error en consulta get:', sql, params);
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    // Obtener múltiples filas
    async all(sql, params = []) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            const rows = await conn.query(sql, params);
            return rows;
        } catch (error) {
            console.error('Error en consulta all:', sql, params);
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    // Método para transacciones
    async transaction(callback) {
        let conn;
        try {
            conn = await this.pool.getConnection();
            await conn.beginTransaction();
            
            // Pasar la conexión al callback para que use la misma transacción
            const result = await callback(conn);
            
            await conn.commit();
            return result;
        } catch (error) {
            if (conn) await conn.rollback();
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    // Verificar disponibilidad de cancha
    async verificarDisponibilidad(cancha_id, fecha, hora_inicio, hora_fin, reserva_id = null) {
        let sql = `
            SELECT COUNT(*) as conflictos
            FROM reservas r
            WHERE r.cancha_id = ?
            AND r.fecha = ?
            AND r.estado_id IN (1, 2)
            AND NOT (r.hora_fin <= ? OR r.hora_inicio >= ?)
        `;
        
        let params = [
            cancha_id,
            fecha,
            hora_inicio,    // La reserva existente termina ANTES o IGUAL a cuando inicia la nueva (OK)
            hora_fin,     // la reserva existente inicia DESPUÉS o IGUAL a cuando termina la nueva (OK)
        ];

        // Si es una actualización, excluir la reserva actual
        if (reserva_id) {
            sql += ' AND r.id != ?';
            params.push(reserva_id);
        }

        console.log('=== DEBUG DISPONIBILIDAD ===');
        console.log('SQL:', sql);
        console.log('Params:', params);

        try {
            const result = await this.get(sql, params);
            console.log('Resultado:', result);
            
            // Convertir BigInt a número para la comparación
            const numConflictos = Number(result.conflictos);
            console.log('Conflictos (convertido):', numConflictos);
            console.log('Disponible:', numConflictos === 0);
            
            return numConflictos === 0;
        } catch (error) {
            console.error('Error en verificarDisponibilidad:', error);
            throw error;
        }
    }

    // Obtener configuración del sistema
    async getConfiguracion(clave) {
        const config = await this.get(
            'SELECT valor, tipo FROM configuraciones WHERE clave = ?',
            [clave]
        );
        
        if (!config) return null;
        
        // Convertir según el tipo
        switch (config.tipo) {
            case 'number':
                return parseFloat(config.valor);
            case 'boolean':
                return config.valor === 'true';
            case 'json':
                return JSON.parse(config.valor);
            default:
                return config.valor;
        }
    }

    // Actualizar configuración
    async setConfiguracion(clave, valor, tipo = 'string') {
        const valorString = typeof valor === 'object' ? 
            JSON.stringify(valor) : 
            valor.toString();

        await this.run(`
            INSERT INTO configuraciones (clave, valor, tipo, updated_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                valor = VALUES(valor),
                tipo = VALUES(tipo),
                updated_at = NOW()
        `, [clave, valorString, tipo]);
    }

    // Obtener estadísticas del sistema
    async getEstadisticas() {
        const stats = {};
        
        // Total de reservas por estado
        const reservasPorEstado = await this.all(`
            SELECT er.nombre, COUNT(*) as cantidad
            FROM reservas r
            JOIN estados_reserva er ON r.estado_id = er.id
            GROUP BY er.nombre
        `);
        stats.reservasPorEstado = reservasPorEstado;

        // Ingresos del mes actual
        const ingresosMes = await this.get(`
            SELECT 
                COALESCE(SUM(precio_total), 0) as ingresos_mes,
                COUNT(*) as reservas_mes
            FROM reservas 
            WHERE YEAR(fecha) = YEAR(CURDATE()) 
            AND MONTH(fecha) = MONTH(CURDATE())
            AND estado_id IN (2, 4)
        `);
        stats.ingresosMes = ingresosMes;

        // Cancha más popular
        const canchaPopular = await this.get(`
            SELECT 
                c.nombre,
                COUNT(*) as total_reservas
            FROM reservas r
            JOIN canchas c ON r.cancha_id = c.id
            WHERE r.estado_id IN (2, 4)
            GROUP BY c.id, c.nombre
            ORDER BY total_reservas DESC
            LIMIT 1
        `);
        stats.canchaPopular = canchaPopular;

        return stats;
    }

    // Cerrar conexión
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ Pool de conexiones MariaDB cerrado');
        }
    }
}

// Singleton de la base de datos
const dbInstance = new Database();

module.exports = dbInstance;