// ./config/supabase.js - Configuración y conexión a Supabase (PostgreSQL)
const { Pool } = require('pg');

class SupabaseDatabase {
    constructor() {
        this.pool = null;
        this.config = {
            // Credenciales de Supabase
            host: process.env.SUPABASE_HOST,           // ejemplo: db.xxxxxxxxxxxx.supabase.co
            port: process.env.SUPABASE_PORT || 5432,
            user: process.env.SUPABASE_USER || 'postgres',
            password: process.env.SUPABASE_PASSWORD,   // Tu contraseña de Supabase
            database: process.env.SUPABASE_DB || 'postgres',

            // Configuración de SSL (requerido para Supabase)
            ssl: {
                rejectUnauthorized: false
            },

            // Pool de conexiones
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 60000
        };
    }

    async initialize() {
        try {
            // Validar que las credenciales existan
            if (!this.config.host || !this.config.password) {
                throw new Error('Faltan credenciales de Supabase. Verifica tu archivo .env');
            }

            // Crear pool de conexiones
            this.pool = new Pool(this.config);

            // Probar la conexión
            const client = await this.pool.connect();
            console.log('✅ Conectado a Supabase (PostgreSQL) exitosamente');
            console.log(`📊 Base de datos: ${this.config.database}`);
            console.log(`🌐 Host: ${this.config.host}`);

            client.release();

            // Verificar que las tablas existen
            await this.verifyTables();

        } catch (error) {
            console.error('❌ Error conectando a Supabase:', error.message);
            throw error;
        }
    }

    async verifyTables() {
        try {
            const query = `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
            `;

            const result = await this.pool.query(query);
            const tableNames = result.rows.map(row => row.table_name);

            const expectedTables = [
                'canchas', 'tipos_cliente', 'clientes', 'estados_reserva',
                'reservas', 'pagos', 'configuraciones', 'bloqueos_horarios',
                'usuarios', 'dias_bloqueados'
            ];

            const missingTables = expectedTables.filter(table => !tableNames.includes(table));

            if (missingTables.length > 0) {
                console.warn('⚠️  Tablas faltantes:', missingTables.join(', '));
                console.log('💡 Ejecuta el script supabase_schema.sql en el SQL Editor de Supabase');
            } else {
                console.log('✅ Todas las tablas están presentes');
            }

        } catch (error) {
            console.error('Error verificando tablas:', error);
        }
    }

    // Obtener conexión del pool
    async getConnection() {
        return await this.pool.connect();
    }

    // Convertir placeholders de MariaDB (?) a PostgreSQL ($1, $2, $3)
    convertPlaceholders(sql) {
        let index = 0;
        return sql.replace(/\?/g, () => `$${++index}`);
    }

    // Ejecutar consulta que retorna múltiples filas
    async query(sql, params = []) {
        try {
            // Convertir placeholders si hay ?
            const convertedSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(convertedSql, params);
            return result.rows;
        } catch (error) {
            console.error('Error en consulta:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    // Ejecutar consulta que retorna una sola fila
    async queryOne(sql, params = []) {
        try {
            // Convertir placeholders si hay ?
            const convertedSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(convertedSql, params);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error en consulta:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    // Alias para compatibilidad con código MariaDB
    async all(sql, params = []) {
        return this.query(sql, params);
    }

    async get(sql, params = []) {
        return this.queryOne(sql, params);
    }

    async run(sql, params = []) {
        try {
            // Convertir placeholders si hay ?
            const convertedSql = this.convertPlaceholders(sql);
            const result = await this.pool.query(convertedSql, params);
            return {
                id: result.rows[0]?.id || null,
                affectedRows: result.rowCount
            };
        } catch (error) {
            console.error('Error en run:', sql);
            console.error('Params:', params);
            throw error;
        }
    }

    // Método para transacciones
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Verificar disponibilidad de cancha
    async verificarDisponibilidad(cancha_id, fecha, hora_inicio, hora_fin, reserva_id = null) {
        let sql = `
            SELECT COUNT(*) as conflictos
            FROM reservas r
            WHERE r.cancha_id = $1
            AND r.fecha = $2
            AND r.estado_id IN (
                SELECT id FROM estados_reserva
                WHERE nombre IN ('pendiente', 'confirmada')
            )
            AND NOT (r.hora_fin <= $3 OR r.hora_inicio >= $4)
        `;

        let params = [cancha_id, fecha, hora_inicio, hora_fin];

        // Si es una actualización, excluir la reserva actual
        if (reserva_id) {
            sql += ' AND r.id != $5';
            params.push(reserva_id);
        }

        try {
            const result = await this.queryOne(sql, params);
            return parseInt(result.conflictos) === 0;
        } catch (error) {
            console.error('Error en verificarDisponibilidad:', error);
            throw error;
        }
    }

    // Obtener configuración del sistema
    async getConfiguracion(clave) {
        const config = await this.queryOne(
            'SELECT valor, tipo FROM configuraciones WHERE clave = $1',
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

        await this.pool.query(`
            INSERT INTO configuraciones (clave, valor, tipo, updated_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (clave)
            DO UPDATE SET
                valor = EXCLUDED.valor,
                tipo = EXCLUDED.tipo,
                updated_at = CURRENT_TIMESTAMP
        `, [clave, valorString, tipo]);
    }

    // Obtener estadísticas del sistema
    async getEstadisticas() {
        const stats = {};

        // Total de reservas por estado
        const reservasPorEstado = await this.query(`
            SELECT er.nombre::text, COUNT(*) as cantidad
            FROM reservas r
            JOIN estados_reserva er ON r.estado_id = er.id
            GROUP BY er.nombre
        `);
        stats.reservasPorEstado = reservasPorEstado;

        // Ingresos del mes actual
        const ingresosMes = await this.queryOne(`
            SELECT
                COALESCE(SUM(precio_total), 0) as ingresos_mes,
                COUNT(*) as reservas_mes
            FROM reservas
            WHERE EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND estado_id IN (
                SELECT id FROM estados_reserva
                WHERE nombre IN ('confirmada', 'completada')
            )
        `);
        stats.ingresosMes = ingresosMes;

        // Cancha más popular
        const canchaPopular = await this.queryOne(`
            SELECT
                c.nombre,
                COUNT(*) as total_reservas
            FROM reservas r
            JOIN canchas c ON r.cancha_id = c.id
            WHERE r.estado_id IN (
                SELECT id FROM estados_reserva
                WHERE nombre IN ('confirmada', 'completada')
            )
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
            console.log('✅ Pool de conexiones Supabase cerrado');
        }
    }
}

// Singleton de la base de datos
const supabaseDbInstance = new SupabaseDatabase();

module.exports = supabaseDbInstance;
