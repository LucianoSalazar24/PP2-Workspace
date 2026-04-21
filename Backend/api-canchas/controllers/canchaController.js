// Backend/api-canchas/controllers/canchaController.js
const supabase = require('../../shared/supabase');

class CanchaController {

    // Obtener todas las canchas
    async obtenerCanchas(req, res) {
        try {
            const { data: canchas, error } = await supabase
                .from('canchas')
                .select('id, nombre, capacidad, precio_por_hora, descripcion, estado, created_at')
                .order('id');

            if (error) throw error;

            res.json({
                success: true,
                data: canchas,
                total: canchas.length
            });

        } catch (error) {
            console.error('Error obteniendo canchas:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener cancha por ID
    async obtenerCanchaPorId(req, res) {
        try {
            const { id } = req.params;

            const { data: cancha, error } = await supabase
                .from('canchas')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !cancha) {
                return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
            }

            // Obtener estadísticas de reservas
            const { data: reservas } = await supabase
                .from('reservas')
                .select('precio_total, estado')
                .eq('cancha_id', id);

            const estadisticas = {
                total_reservas: (reservas || []).length,
                reservas_completadas: (reservas || []).filter(r => r.estado === 'completada').length,
                ingreso_promedio: (reservas || []).length > 0
                    ? (reservas || []).reduce((s, r) => s + parseFloat(r.precio_total || 0), 0) / reservas.length
                    : 0,
                ingresos_totales: (reservas || []).reduce((s, r) => s + parseFloat(r.precio_total || 0), 0)
            };

            res.json({
                success: true,
                data: { ...cancha, estadisticas }
            });

        } catch (error) {
            console.error('Error obteniendo cancha:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Crear nueva cancha
    async crearCancha(req, res) {
        try {
            const { nombre, capacidad, precio_por_hora, descripcion = '' } = req.body;

            // Verificar duplicados
            const { data: existente } = await supabase
                .from('canchas')
                .select('id')
                .eq('nombre', nombre)
                .maybeSingle();

            if (existente) {
                return res.status(400).json({ success: false, message: 'Ya existe una cancha con ese nombre' });
            }

            const { data: canchaCreada, error } = await supabase
                .from('canchas')
                .insert({ nombre, capacidad, precio_por_hora, descripcion })
                .select('*')
                .single();

            if (error) throw error;

            res.status(201).json({
                success: true,
                message: 'Cancha creada exitosamente',
                data: canchaCreada
            });

        } catch (error) {
            console.error('Error creando cancha:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Actualizar cancha
    async actualizarCancha(req, res) {
        try {
            const { id } = req.params;
            const { nombre, capacidad, precio_por_hora, descripcion, estado } = req.body;

            const { data: cancha } = await supabase
                .from('canchas')
                .select('*')
                .eq('id', id)
                .single();

            if (!cancha) {
                return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
            }

            // Verificar conflicto de nombre
            if (nombre && nombre !== cancha.nombre) {
                const { data: dup } = await supabase
                    .from('canchas')
                    .select('id')
                    .eq('nombre', nombre)
                    .neq('id', id)
                    .maybeSingle();

                if (dup) {
                    return res.status(400).json({ success: false, message: 'Ya existe una cancha con ese nombre' });
                }
            }

            const { data: canchaActualizada, error } = await supabase
                .from('canchas')
                .update({
                    nombre: nombre || cancha.nombre,
                    capacidad: capacidad || cancha.capacidad,
                    precio_por_hora: precio_por_hora || cancha.precio_por_hora,
                    descripcion: descripcion !== undefined ? descripcion : cancha.descripcion,
                    estado: estado || cancha.estado
                })
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            res.json({
                success: true,
                message: 'Cancha actualizada exitosamente',
                data: canchaActualizada
            });

        } catch (error) {
            console.error('Error actualizando cancha:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Cambiar estado
    async cambiarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body;

            const { data: cancha } = await supabase
                .from('canchas')
                .select('id')
                .eq('id', id)
                .single();

            if (!cancha) {
                return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
            }

            const { error } = await supabase
                .from('canchas')
                .update({ estado })
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: `Estado cambiado a: ${estado}` });

        } catch (error) {
            console.error('Error cambiando estado:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener disponibilidad de una cancha
    async obtenerDisponibilidad(req, res) {
        try {
            const { id } = req.params;
            const { fecha } = req.query;

            const { data: cancha } = await supabase
                .from('canchas')
                .select('*')
                .eq('id', id)
                .single();

            if (!cancha) {
                return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
            }

            // Reservas activas del día
            const { data: reservas } = await supabase
                .from('reservas')
                .select('hora_inicio, hora_fin, clientes(nombre, apellido)')
                .eq('cancha_id', id)
                .eq('fecha', fecha)
                .in('estado', ['pendiente', 'confirmada'])
                .order('hora_inicio');

            const reservasFormateadas = (reservas || []).map(r => ({
                hora_inicio: r.hora_inicio,
                hora_fin: r.hora_fin,
                cliente: r.clientes ? `${r.clientes.nombre} ${r.clientes.apellido}` : 'N/A'
            }));

            res.json({
                success: true,
                data: {
                    cancha,
                    fecha,
                    reservas: reservasFormateadas,
                    total_reservas: reservasFormateadas.length
                }
            });

        } catch (error) {
            console.error('Error obteniendo disponibilidad:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Eliminar cancha
    async eliminarCancha(req, res) {
        try {
            const { id } = req.params;

            const { data: cancha } = await supabase
                .from('canchas')
                .select('id')
                .eq('id', id)
                .single();

            if (!cancha) {
                return res.status(404).json({ success: false, message: 'Cancha no encontrada' });
            }

            // Verificar reservas futuras activas
            const hoy = new Date().toISOString().split('T')[0];
            const { data: reservasFuturas } = await supabase
                .from('reservas')
                .select('id')
                .eq('cancha_id', id)
                .gte('fecha', hoy)
                .in('estado', ['pendiente', 'confirmada']);

            if (reservasFuturas && reservasFuturas.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar: tiene reservas futuras activas'
                });
            }

            const { error } = await supabase
                .from('canchas')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Cancha eliminada exitosamente' });

        } catch (error) {
            console.error('Error eliminando cancha:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new CanchaController();
