// Controlador adaptado para Supabase (PostgreSQL)
// Incluye soporte para bloqueo por cancha específica o todas las canchas
const db = require('../config');

const diasBloqueadosController = {
    /**
     * Obtener todos los días bloqueados con información de cancha
     * GET /api/dias-bloqueados
     */
    obtenerDiasBloqueados: async (req, res) => {
        try {
            const { fecha_desde, fecha_hasta, futuro_solo, cancha_id } = req.query;

            let query = `
                SELECT
                    db.id,
                    db.fecha,
                    db.motivo,
                    db.descripcion,
                    db.cancha_id,
                    c.nombre as cancha_nombre,
                    CASE
                        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
                        ELSE c.nombre
                    END as alcance,
                    (db.cancha_id IS NULL) as aplica_todas_canchas,
                    db.created_at,
                    db.updated_at
                FROM dias_bloqueados db
                LEFT JOIN canchas c ON db.cancha_id = c.id
                WHERE 1=1
            `;

            const params = [];
            let paramCount = 1;

            // Filtrar por cancha específica
            if (cancha_id) {
                query += ` AND (db.cancha_id = $${paramCount} OR db.cancha_id IS NULL)`;
                params.push(parseInt(cancha_id));
                paramCount++;
            }

            // Filtrar por fecha desde
            if (fecha_desde) {
                query += ` AND db.fecha >= $${paramCount}`;
                params.push(fecha_desde);
                paramCount++;
            }

            // Filtrar por fecha hasta
            if (fecha_hasta) {
                query += ` AND db.fecha <= $${paramCount}`;
                params.push(fecha_hasta);
                paramCount++;
            }

            // Solo días futuros o de hoy
            if (futuro_solo === 'true') {
                query += ` AND db.fecha >= CURRENT_DATE`;
            }

            query += ` ORDER BY db.fecha ASC`;

            const diasBloqueados = await db.query(query, params);

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
        }
    },

    /**
     * Obtener un día bloqueado por ID con información de cancha
     * GET /api/dias-bloqueados/:id
     */
    obtenerDiaBloqueadoPorId: async (req, res) => {
        try {
            const { id } = req.params;

            const diaBloqueado = await db.queryOne(
                `SELECT
                    db.id,
                    db.fecha,
                    db.motivo,
                    db.descripcion,
                    db.cancha_id,
                    c.nombre as cancha_nombre,
                    CASE
                        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
                        ELSE c.nombre
                    END as alcance,
                    db.created_at,
                    db.updated_at
                FROM dias_bloqueados db
                LEFT JOIN canchas c ON db.cancha_id = c.id
                WHERE db.id = $1`,
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
        }
    },

    /**
     * Verificar si una cancha específica está bloqueada en una fecha
     * GET /api/dias-bloqueados/verificar/:fecha?cancha_id=X
     */
    verificarDiaBloqueado: async (req, res) => {
        try {
            const { fecha } = req.params;
            const { cancha_id } = req.query;

            let query, params;

            if (cancha_id) {
                // Verificar cancha específica (incluye bloqueos globales)
                query = `
                    SELECT
                        db.*,
                        c.nombre as cancha_nombre,
                        (db.cancha_id IS NULL) as es_bloqueo_global
                    FROM dias_bloqueados db
                    LEFT JOIN canchas c ON db.cancha_id = c.id
                    WHERE db.fecha = $1
                    AND (db.cancha_id = $2 OR db.cancha_id IS NULL)
                    LIMIT 1
                `;
                params = [fecha, parseInt(cancha_id)];
            } else {
                // Verificar si existe algún bloqueo en esa fecha
                query = `
                    SELECT
                        db.*,
                        c.nombre as cancha_nombre,
                        (db.cancha_id IS NULL) as es_bloqueo_global
                    FROM dias_bloqueados db
                    LEFT JOIN canchas c ON db.cancha_id = c.id
                    WHERE db.fecha = $1
                    LIMIT 1
                `;
                params = [fecha];
            }

            const diaBloqueado = await db.queryOne(query, params);

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
        }
    },

    /**
     * Crear un nuevo día bloqueado
     * POST /api/dias-bloqueados
     * Body: { fecha, motivo, descripcion?, cancha_id? }
     * - cancha_id = null o no especificado: bloquea TODAS las canchas
     * - cancha_id = N: bloquea solo la cancha N
     */
    crearDiaBloqueado: async (req, res) => {
        try {
            const { fecha, motivo, descripcion, cancha_id } = req.body;

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

            // Si se especifica cancha_id, validar que existe
            if (cancha_id !== null && cancha_id !== undefined) {
                const canchaExiste = await db.queryOne(
                    `SELECT id FROM canchas WHERE id = $1`,
                    [cancha_id]
                );

                if (!canchaExiste) {
                    return res.status(404).json({
                        success: false,
                        message: 'La cancha especificada no existe'
                    });
                }
            }

            // Verificar si ya existe un bloqueo exacto
            const existente = await db.queryOne(
                `SELECT id FROM dias_bloqueados
                 WHERE fecha = $1 AND (
                    (cancha_id = $2) OR
                    (cancha_id IS NULL AND $2 IS NULL)
                 )`,
                [fecha, cancha_id || null]
            );

            if (existente) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un bloqueo para esta fecha y cancha'
                });
            }

            // Insertar nuevo día bloqueado
            const nuevoDiaBloqueado = await db.queryOne(
                `INSERT INTO dias_bloqueados (fecha, motivo, descripcion, cancha_id)
                 VALUES ($1, $2, $3, $4)
                 RETURNING
                    id,
                    fecha,
                    motivo,
                    descripcion,
                    cancha_id,
                    created_at,
                    updated_at`,
                [fecha, motivo, descripcion || null, cancha_id || null]
            );

            // Obtener información completa con nombre de cancha
            const diaBloqueadoCompleto = await db.queryOne(
                `SELECT
                    db.*,
                    c.nombre as cancha_nombre,
                    CASE
                        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
                        ELSE c.nombre
                    END as alcance
                FROM dias_bloqueados db
                LEFT JOIN canchas c ON db.cancha_id = c.id
                WHERE db.id = $1`,
                [nuevoDiaBloqueado.id]
            );

            res.status(201).json({
                success: true,
                message: 'Día bloqueado creado exitosamente',
                data: diaBloqueadoCompleto
            });

        } catch (error) {
            console.error('Error al crear día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear día bloqueado',
                error: error.message
            });
        }
    },

    /**
     * Actualizar un día bloqueado
     * PUT /api/dias-bloqueados/:id
     */
    actualizarDiaBloqueado: async (req, res) => {
        try {
            const { id } = req.params;
            const { fecha, motivo, descripcion, cancha_id } = req.body;

            // Verificar si existe
            const existente = await db.queryOne(
                `SELECT * FROM dias_bloqueados WHERE id = $1`,
                [id]
            );

            if (!existente) {
                return res.status(404).json({
                    success: false,
                    message: 'Día bloqueado no encontrado'
                });
            }

            // Si se especifica cancha_id, validar que existe
            if (cancha_id !== null && cancha_id !== undefined && cancha_id !== '') {
                const canchaExiste = await db.queryOne(
                    `SELECT id FROM canchas WHERE id = $1`,
                    [cancha_id]
                );

                if (!canchaExiste) {
                    return res.status(404).json({
                        success: false,
                        message: 'La cancha especificada no existe'
                    });
                }
            }

            // Construir query de actualización dinámica
            const updates = [];
            const params = [];
            let paramCount = 1;

            if (fecha !== undefined) {
                updates.push(`fecha = $${paramCount}`);
                params.push(fecha);
                paramCount++;
            }
            if (motivo !== undefined) {
                updates.push(`motivo = $${paramCount}`);
                params.push(motivo);
                paramCount++;
            }
            if (descripcion !== undefined) {
                updates.push(`descripcion = $${paramCount}`);
                params.push(descripcion);
                paramCount++;
            }
            if (cancha_id !== undefined) {
                updates.push(`cancha_id = $${paramCount}`);
                params.push(cancha_id === '' || cancha_id === 'null' ? null : cancha_id);
                paramCount++;
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos para actualizar'
                });
            }

            params.push(id);

            await db.queryOne(
                `UPDATE dias_bloqueados
                 SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $${paramCount}
                 RETURNING *`,
                params
            );

            // Obtener datos completos
            const diaBloqueadoActualizado = await db.queryOne(
                `SELECT
                    db.*,
                    c.nombre as cancha_nombre,
                    CASE
                        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
                        ELSE c.nombre
                    END as alcance
                FROM dias_bloqueados db
                LEFT JOIN canchas c ON db.cancha_id = c.id
                WHERE db.id = $1`,
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
        }
    },

    /**
     * Eliminar un día bloqueado
     * DELETE /api/dias-bloqueados/:id
     */
    eliminarDiaBloqueado: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar si existe y eliminarlo en una sola query
            const diaBloqueadoEliminado = await db.queryOne(
                `DELETE FROM dias_bloqueados WHERE id = $1 RETURNING *`,
                [id]
            );

            if (!diaBloqueadoEliminado) {
                return res.status(404).json({
                    success: false,
                    message: 'Día bloqueado no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Día bloqueado eliminado exitosamente',
                data: diaBloqueadoEliminado
            });

        } catch (error) {
            console.error('Error al eliminar día bloqueado:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar día bloqueado',
                error: error.message
            });
        }
    },

    /**
     * Obtener próximos días bloqueados
     * GET /api/dias-bloqueados/proximos/:cantidad?cancha_id=X
     */
    obtenerProximosDiasBloqueados: async (req, res) => {
        try {
            const { cantidad = 10 } = req.params;
            const { cancha_id } = req.query;

            let query = `
                SELECT
                    db.id,
                    db.fecha,
                    db.motivo,
                    db.descripcion,
                    db.cancha_id,
                    c.nombre as cancha_nombre,
                    CASE
                        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
                        ELSE c.nombre
                    END as alcance,
                    (db.cancha_id IS NULL) as aplica_todas_canchas,
                    db.fecha - CURRENT_DATE as dias_restantes
                FROM dias_bloqueados db
                LEFT JOIN canchas c ON db.cancha_id = c.id
                WHERE db.fecha >= CURRENT_DATE
            `;

            const params = [parseInt(cantidad)];

            if (cancha_id) {
                query += ` AND (db.cancha_id = $2 OR db.cancha_id IS NULL)`;
                params.unshift(parseInt(cancha_id));
                query += ` ORDER BY db.fecha ASC LIMIT $1`;
            } else {
                query += ` ORDER BY db.fecha ASC LIMIT $1`;
            }

            const diasBloqueados = await db.query(query, cancha_id ? [parseInt(cancha_id), parseInt(cantidad)] : [parseInt(cantidad)]);

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
        }
    }
};

module.exports = diasBloqueadosController;
