const db = require('../config');

const diasBloqueadosController = {
    /**
     * Obtener todos los días bloqueados
     * GET /api/dias-bloqueados
     */
    obtenerDiasBloqueados: async (req, res) => {
        let conn;
        try {
            conn = await db.getConnection();

            // Parámetros de filtro opcionales
            const { fecha_desde, fecha_hasta, futuro_solo } = req.query;

            let query = `
                SELECT
                    id,
                    fecha,
                    motivo,
                    descripcion,
                    created_at,
                    updated_at
                FROM dias_bloqueados
                WHERE 1=1
            `;

            const params = [];

            // Filtrar por fecha desde
            if (fecha_desde) {
                query += ` AND fecha >= ?`;
                params.push(fecha_desde);
            }

            // Filtrar por fecha hasta
            if (fecha_hasta) {
                query += ` AND fecha <= ?`;
                params.push(fecha_hasta);
            }

            // Solo días futuros o de hoy
            if (futuro_solo === 'true') {
                query += ` AND fecha >= CURDATE()`;
            }

            query += ` ORDER BY fecha ASC`;

            const diasBloqueados = await conn.query(query, params);

            res.status(200).json({
                success: true,
                count: diasBloqueados.length,
                data: diasBloqueados
            });

        } catch (error) {
            console.error('Error al obtener días bloqueados:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener días bloqueados',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Obtener un día bloqueado por ID
     * GET /api/dias-bloqueados/:id
     */
    obtenerDiaBloqueadoPorId: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
            conn = await db.getConnection();

            const [diaBloqueado] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE id = ?`,
                [id]
            );

            if (!diaBloqueado) {
                return res.status(404).json({
                    success: false,
                    message: 'Día bloqueado no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                data: diaBloqueado
            });

        } catch (error) {
            console.error('Error al obtener día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener día bloqueado',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Verificar si una fecha específica está bloqueada
     * GET /api/dias-bloqueados/verificar/:fecha
     */
    verificarDiaBloqueado: async (req, res) => {
        let conn;
        try {
            const { fecha } = req.params;
            conn = await db.getConnection();

            const [diaBloqueado] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE fecha = ?`,
                [fecha]
            );

            res.status(200).json({
                success: true,
                bloqueado: !!diaBloqueado,
                data: diaBloqueado || null
            });

        } catch (error) {
            console.error('Error al verificar día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar día bloqueado',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Crear un nuevo día bloqueado
     * POST /api/dias-bloqueados
     */
    crearDiaBloqueado: async (req, res) => {
        let conn;
        try {
            const { fecha, motivo, descripcion } = req.body;

            // Validaciones
            if (!fecha || !motivo) {
                return res.status(400).json({
                    success: false,
                    message: 'Los campos fecha y motivo son obligatorios'
                });
            }

            // Validar formato de fecha
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!fechaRegex.test(fecha)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha inválido. Use YYYY-MM-DD'
                });
            }

            conn = await db.getConnection();

            // Verificar si ya existe
            const [existente] = await conn.query(
                `SELECT id FROM dias_bloqueados WHERE fecha = ?`,
                [fecha]
            );

            if (existente) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un bloqueo para esta fecha'
                });
            }

            // Insertar nuevo día bloqueado
            const result = await conn.query(
                `INSERT INTO dias_bloqueados (fecha, motivo, descripcion)
                 VALUES (?, ?, ?)`,
                [fecha, motivo, descripcion || null]
            );

            // Obtener el registro creado
            const [nuevoDiaBloqueado] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE id = ?`,
                [result.insertId]
            );

            res.status(201).json({
                success: true,
                message: 'Día bloqueado creado exitosamente',
                data: nuevoDiaBloqueado
            });

        } catch (error) {
            console.error('Error al crear día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear día bloqueado',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Actualizar un día bloqueado
     * PUT /api/dias-bloqueados/:id
     */
    actualizarDiaBloqueado: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
            const { fecha, motivo, descripcion } = req.body;

            conn = await db.getConnection();

            // Verificar si existe
            const [existente] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE id = ?`,
                [id]
            );

            if (!existente) {
                return res.status(404).json({
                    success: false,
                    message: 'Día bloqueado no encontrado'
                });
            }

            // Construir query de actualización dinámica
            const updates = [];
            const params = [];

            if (fecha !== undefined) {
                updates.push('fecha = ?');
                params.push(fecha);
            }
            if (motivo !== undefined) {
                updates.push('motivo = ?');
                params.push(motivo);
            }
            if (descripcion !== undefined) {
                updates.push('descripcion = ?');
                params.push(descripcion);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                });
            }

            params.push(id);

            await conn.query(
                `UPDATE dias_bloqueados SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            // Obtener el registro actualizado
            const [diaBloqueadoActualizado] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE id = ?`,
                [id]
            );

            res.status(200).json({
                success: true,
                message: 'Día bloqueado actualizado exitosamente',
                data: diaBloqueadoActualizado
            });

        } catch (error) {
            console.error('Error al actualizar día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar día bloqueado',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Eliminar un día bloqueado
     * DELETE /api/dias-bloqueados/:id
     */
    eliminarDiaBloqueado: async (req, res) => {
        let conn;
        try {
            const { id } = req.params;
            conn = await db.getConnection();

            // Verificar si existe
            const [existente] = await conn.query(
                `SELECT * FROM dias_bloqueados WHERE id = ?`,
                [id]
            );

            if (!existente) {
                return res.status(404).json({
                    success: false,
                    message: 'Día bloqueado no encontrado'
                });
            }

            // Eliminar
            await conn.query(
                `DELETE FROM dias_bloqueados WHERE id = ?`,
                [id]
            );

            res.status(200).json({
                success: true,
                message: 'Día bloqueado eliminado exitosamente',
                data: existente
            });

        } catch (error) {
            console.error('Error al eliminar día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar día bloqueado',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * Obtener próximos días bloqueados
     * GET /api/dias-bloqueados/proximos/:cantidad
     */
    obtenerProximosDiasBloqueados: async (req, res) => {
        let conn;
        try {
            const { cantidad = 10 } = req.params;
            conn = await db.getConnection();

            const diasBloqueados = await conn.query(
                `SELECT
                    id,
                    fecha,
                    motivo,
                    descripcion,
                    DATEDIFF(fecha, CURDATE()) as dias_restantes
                FROM dias_bloqueados
                WHERE fecha >= CURDATE()
                ORDER BY fecha ASC
                LIMIT ?`,
                [parseInt(cantidad)]
            );

            res.status(200).json({
                success: true,
                count: diasBloqueados.length,
                data: diasBloqueados
            });

        } catch (error) {
            console.error('Error al obtener próximos días bloqueados:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener próximos días bloqueados',
                error: error.message
            });
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = diasBloqueadosController;
