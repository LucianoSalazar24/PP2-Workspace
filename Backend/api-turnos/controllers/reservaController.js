// Backend/api-turnos/controllers/reservaController.js
const supabase = require('../../shared/supabase');
const moment = require('moment');

class ReservaController {

    // Obtener todas las reservas con filtros
    async obtenerReservas(req, res) {
        try {
            const { fecha, cancha_id, cliente_id, estado, limite = 50 } = req.query;

            let query = supabase
                .from('reservas')
                .select(`
                    id, fecha, hora_inicio, hora_fin, precio_total,
                    descuento_aplicado, sena_requerida, sena_pagada,
                    pago_completo, observaciones, fecha_creacion, estado,
                    canchas(nombre, precio_por_hora),
                    clientes(nombre, apellido, telefono)
                `)
                .order('fecha', { ascending: false })
                .order('hora_inicio')
                .limit(parseInt(limite));

            if (fecha) query = query.eq('fecha', fecha);
            if (cancha_id) query = query.eq('cancha_id', cancha_id);
            if (cliente_id) query = query.eq('cliente_id', cliente_id);
            if (estado) query = query.eq('estado', estado);

            const { data: reservas, error } = await query;
            if (error) throw error;

            // Aplanar para compatibilidad con frontend
            const formateadas = (reservas || []).map(r => ({
                ...r,
                cancha_nombre: r.canchas?.nombre,
                precio_por_hora: r.canchas?.precio_por_hora,
                cliente_nombre: r.clientes?.nombre,
                cliente_apellido: r.clientes?.apellido,
                cliente_telefono: r.clientes?.telefono,
                canchas: undefined,
                clientes: undefined
            }));

            res.json({ success: true, data: formateadas, total: formateadas.length });

        } catch (error) {
            console.error('Error obteniendo reservas:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener reserva por ID
    async obtenerReservaPorId(req, res) {
        try {
            const { id } = req.params;

            const { data: reserva, error } = await supabase
                .from('reservas')
                .select(`
                    *,
                    canchas(nombre, precio_por_hora),
                    clientes(nombre, apellido, telefono, email)
                `)
                .eq('id', id)
                .single();

            if (error || !reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            // Obtener pagos
            const { data: pagos } = await supabase
                .from('pagos')
                .select('*')
                .eq('reserva_id', id)
                .order('fecha_pago');

            const formateada = {
                ...reserva,
                cancha_nombre: reserva.canchas?.nombre,
                precio_por_hora: reserva.canchas?.precio_por_hora,
                cliente_nombre: reserva.clientes?.nombre,
                cliente_apellido: reserva.clientes?.apellido,
                cliente_telefono: reserva.clientes?.telefono,
                cliente_email: reserva.clientes?.email,
                canchas: undefined,
                clientes: undefined,
                pagos: pagos || []
            };

            res.json({ success: true, data: formateada });

        } catch (error) {
            console.error('Error obteniendo reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Crear nueva reserva
    async crearReserva(req, res) {
        try {
            const { cancha_id, cliente_id, fecha, hora_inicio, hora_fin, observaciones = '' } = req.body;

            if (!cancha_id || !cliente_id || !fecha || !hora_inicio || !hora_fin) {
                return res.status(400).json({ success: false, message: 'Faltan datos obligatorios' });
            }

            // Validar formato
            const fechaReserva = moment(fecha, 'YYYY-MM-DD');
            const horaInicio = moment(hora_inicio, 'HH:mm');
            const horaFin = moment(hora_fin, 'HH:mm');

            if (!fechaReserva.isValid() || !horaInicio.isValid() || !horaFin.isValid()) {
                return res.status(400).json({ success: false, message: 'Formato de fecha u hora inválido' });
            }

            if (horaFin.isSameOrBefore(horaInicio)) {
                return res.status(400).json({ success: false, message: 'La hora de fin debe ser posterior a la de inicio' });
            }

            // Validar anticipación mínima
            const ahora = moment();
            const fechaHoraReserva = moment(`${fecha} ${hora_inicio}`, 'YYYY-MM-DD HH:mm');

            // Leer configuración de horas de anticipación
            const { data: configAnticipacion } = await supabase
                .from('configuraciones')
                .select('valor')
                .eq('clave', 'horas_anticipacion_min')
                .single();

            const horasAnticipacion = configAnticipacion ? parseFloat(configAnticipacion.valor) : 2;
            const minimoPermitido = ahora.clone().add(horasAnticipacion, 'hours');

            if (fechaHoraReserva.isBefore(minimoPermitido)) {
                return res.status(400).json({
                    success: false,
                    message: `Debes reservar con al menos ${horasAnticipacion} horas de anticipación`
                });
            }

            // Verificar que la cancha y el cliente existan
            const { data: cancha } = await supabase
                .from('canchas')
                .select('id, precio_por_hora')
                .eq('id', cancha_id)
                .single();

            const { data: cliente } = await supabase
                .from('clientes')
                .select('id, estado')
                .eq('id', cliente_id)
                .single();

            if (!cancha || !cliente) {
                return res.status(404).json({ success: false, message: 'Cancha o cliente no encontrado' });
            }

            // Insertar la reserva
            // El trigger de la BD calcula precio, descuento, seña y verifica disponibilidad + estado del cliente
            const { data: reservaCreada, error } = await supabase
                .from('reservas')
                .insert({
                    cancha_id,
                    cliente_id,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    precio_total: 0, // Se recalcula por el trigger
                    observaciones
                })
                .select(`
                    *,
                    canchas(nombre),
                    clientes(nombre, apellido, telefono)
                `)
                .single();

            if (error) {
                console.error('Error creando reserva:', error);
                // Manejar errores de constraints de la BD
                if (error.message.includes('solapamiento') || error.message.includes('excl_solapamiento')) {
                    return res.status(409).json({ success: false, message: 'La cancha no está disponible en el horario solicitado' });
                }
                if (error.message.includes('bloqueado') || error.message.includes('suspendido')) {
                    return res.status(403).json({ success: false, message: error.message });
                }
                if (error.message.includes('chk_duracion')) {
                    return res.status(400).json({ success: false, message: 'La duración debe ser entre 1 y 3 horas' });
                }
                if (error.message.includes('chk_horario')) {
                    return res.status(400).json({ success: false, message: 'El horario debe estar entre 08:00 y 23:00' });
                }
                throw error;
            }

            const formateada = {
                ...reservaCreada,
                cancha_nombre: reservaCreada.canchas?.nombre,
                cliente_nombre: reservaCreada.clientes?.nombre,
                cliente_apellido: reservaCreada.clientes?.apellido,
                cliente_telefono: reservaCreada.clientes?.telefono,
                canchas: undefined,
                clientes: undefined
            };

            res.status(201).json({
                success: true,
                message: 'Reserva creada exitosamente',
                data: formateada
            });

        } catch (error) {
            console.error('Error creando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Confirmar reserva con pago de seña
    async confirmarReserva(req, res) {
        try {
            const { id } = req.params;
            const { monto_pagado, metodo_pago = 'efectivo' } = req.body;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('*')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            if (reserva.estado !== 'pendiente') {
                return res.status(400).json({ success: false, message: 'La reserva ya está confirmada o no se puede confirmar' });
            }

            const montoPagado = parseFloat(monto_pagado);
            if (montoPagado < parseFloat(reserva.sena_requerida)) {
                return res.status(400).json({
                    success: false,
                    message: `El monto pagado debe ser al menos $${reserva.sena_requerida}`
                });
            }

            // Actualizar reserva
            const { error: updateError } = await supabase
                .from('reservas')
                .update({
                    estado: 'confirmada',
                    sena_pagada: montoPagado,
                    pago_completo: montoPagado >= parseFloat(reserva.precio_total)
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Registrar pago
            const { error: pagoError } = await supabase
                .from('pagos')
                .insert({
                    reserva_id: id,
                    monto: montoPagado,
                    tipo_pago: montoPagado >= parseFloat(reserva.precio_total) ? 'completo' : 'seña',
                    metodo_pago
                });

            if (pagoError) throw pagoError;

            res.json({ success: true, message: 'Reserva confirmada exitosamente' });

        } catch (error) {
            console.error('Error confirmando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Cancelar reserva
    async cancelarReserva(req, res) {
        try {
            const { id } = req.params;
            const { razon = 'Cancelación solicitada' } = req.body;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('estado')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            if (reserva.estado === 'cancelada') {
                return res.status(400).json({ success: false, message: 'La reserva ya está cancelada' });
            }

            const { error } = await supabase
                .from('reservas')
                .update({
                    estado: 'cancelada',
                    fecha_cancelacion: new Date().toISOString(),
                    razon_cancelacion: razon
                })
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva cancelada exitosamente' });

        } catch (error) {
            console.error('Error cancelando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Completar reserva
    async completarReserva(req, res) {
        try {
            const { id } = req.params;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('estado')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            if (reserva.estado !== 'confirmada') {
                return res.status(400).json({ success: false, message: 'Solo se pueden completar reservas confirmadas' });
            }

            const { error } = await supabase
                .from('reservas')
                .update({ estado: 'completada' })
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva marcada como completada' });

        } catch (error) {
            console.error('Error completando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Marcar no-show
    async marcarNoShow(req, res) {
        try {
            const { id } = req.params;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('estado, cliente_id')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            if (reserva.estado !== 'confirmada') {
                return res.status(400).json({ success: false, message: 'Solo se pueden marcar como no-show reservas confirmadas' });
            }

            // Actualizar estado de reserva (el trigger incrementa no_shows del cliente)
            const { error } = await supabase
                .from('reservas')
                .update({ estado: 'no_show' })
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva marcada como no-show' });

        } catch (error) {
            console.error('Error marcando no-show:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Eliminar reserva
    async eliminarReserva(req, res) {
        try {
            const { id } = req.params;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('id, cliente_id')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            // Eliminar pagos y reserva (CASCADE debería manejar esto,
            // pero lo hacemos explícito por seguridad)
            await supabase.from('pagos').delete().eq('reserva_id', id);
            const { error } = await supabase.from('reservas').delete().eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva eliminada exitosamente' });

        } catch (error) {
            console.error('Error eliminando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener disponibilidad general
    async obtenerDisponibilidad(req, res) {
        try {
            const { fecha, cancha_id } = req.query;

            if (!fecha) {
                return res.status(400).json({ success: false, message: 'La fecha es requerida' });
            }

            // Obtener canchas disponibles
            let canchasQuery = supabase
                .from('canchas')
                .select('id, nombre, precio_por_hora')
                .eq('estado', 'disponible');

            if (cancha_id) {
                canchasQuery = canchasQuery.eq('id', cancha_id);
            }

            const { data: canchas } = await canchasQuery;

            // Obtener reservas del día
            let reservasQuery = supabase
                .from('reservas')
                .select('cancha_id, hora_inicio, hora_fin, id')
                .eq('fecha', fecha)
                .in('estado', ['pendiente', 'confirmada']);

            if (cancha_id) {
                reservasQuery = reservasQuery.eq('cancha_id', cancha_id);
            }

            const { data: reservas } = await reservasQuery;

            // Organizar por cancha
            const disponibilidad = (canchas || []).map(cancha => ({
                id: cancha.id,
                nombre: cancha.nombre,
                precio_por_hora: cancha.precio_por_hora,
                reservas: (reservas || [])
                    .filter(r => r.cancha_id === cancha.id)
                    .map(r => ({ hora_inicio: r.hora_inicio, hora_fin: r.hora_fin }))
            }));

            res.json({ success: true, data: disponibilidad, fecha });

        } catch (error) {
            console.error('Error obteniendo disponibilidad:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new ReservaController();
