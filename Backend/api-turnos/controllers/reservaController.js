// Backend/api-turnos/controllers/reservaController.js
const supabase = require('../../shared/supabase');
const moment = require('moment');

class ReservaController {

    // Obtener todas las reservas con filtros
    async obtenerReservas(req, res) {
        try {
            const { fecha, cancha_id, cliente_id, estado, buscar, limite = 50 } = req.query;

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
            
            if (buscar) {
                // Búsqueda por nombre, apellido o teléfono del cliente
                query = query.or(`nombre.ilike.%${buscar}%,apellido.ilike.%${buscar}%,telefono.ilike.%${buscar}%`, { foreignTable: 'clientes' });
            }

            const { data: reservas, error } = await query;
            if (error) throw error;

            // Obtener pagos para estas reservas en una sola consulta
            const idsReservas = (reservas || []).map(r => r.id);
            let todosLosPagos = [];
            
            if (idsReservas.length > 0) {
                const { data: pagosData } = await supabase
                    .from('pagos')
                    .select('reserva_id, tipo_pago, metodo_pago, fecha_pago')
                    .in('reserva_id', idsReservas);
                todosLosPagos = pagosData || [];
            }

            // Aplanar para compatibilidad con frontend
            const formateadas = (reservas || []).map(r => {
                // Obtener el último pago para esta reserva específica
                const pagosDeReserva = todosLosPagos.filter(p => p.reserva_id === r.id);
                const ultimoPago = pagosDeReserva.length > 0 
                    ? pagosDeReserva.sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago))[0] 
                    : null;

                return {
                    ...r,
                    cancha_nombre: r.canchas?.nombre,
                    precio_por_hora: r.canchas?.precio_por_hora,
                    cliente_nombre: r.clientes?.nombre,
                    cliente_apellido: r.clientes?.apellido,
                    cliente_telefono: r.clientes?.telefono,
                    tipo_pago: ultimoPago ? ultimoPago.tipo_pago : (r.estado === 'pendiente' ? 'pendiente' : '-'),
                    metodo_pago: ultimoPago ? ultimoPago.metodo_pago : '-',
                    canchas: undefined,
                    clientes: undefined
                };
            });

            res.json({ success: true, data: formateadas, total: formateadas.length });

        } catch (error) {
            console.error('❌ Error obteniendo reservas:', error.message || error);
            res.status(500).json({ 
                success: false, 
                message: 'Error al obtener las reservas',
                error: error.message 
            });
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

            if (!['pendiente', 'confirmada'].includes(reserva.estado)) {
                return res.status(400).json({ success: false, message: 'No se pueden registrar pagos en este estado' });
            }

            const montoPagado = parseFloat(monto_pagado);
            if (montoPagado < parseFloat(reserva.sena_requerida)) {
                return res.status(400).json({
                    success: false,
                    message: `El monto pagado debe ser al menos $${reserva.sena_requerida}`
                });
            }

            // Calcular nuevo estado y acumulados
            const nuevoTotalPagado = parseFloat(reserva.sena_pagada) + montoPagado;
            const esPagoCompleto = nuevoTotalPagado >= parseFloat(reserva.precio_total);
            
            // Si ya se pagó el total, pasa a estado completada automáticamente
            const nuevoEstado = esPagoCompleto ? 'completada' : 'confirmada';

            // Actualizar reserva
            const { error: updateError } = await supabase
                .from('reservas')
                .update({
                    estado: nuevoEstado,
                    sena_pagada: nuevoTotalPagado,
                    pago_completo: esPagoCompleto
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Registrar pago
            const { error: pagoError } = await supabase
                .from('pagos')
                .insert({
                    reserva_id: id,
                    monto: montoPagado,
                    tipo_pago: esPagoCompleto ? 'completo' : 'seña',
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
                    razon_cancelacion: razon,
                    observaciones: `${reserva.observaciones || ''}\n[NOTIFICACION_CANCELACION]: ${razon}`.trim()
                })
                .eq('id', id);

            if (error) throw error;

            res.json({ 
                success: true, 
                message: 'Reserva cancelada exitosamente. Se ha registrado la notificación para el cliente.',
                notificacion: razon
            });

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

    // Ocultar reserva del dashboard (soft-delete visual)
    async ocultarReserva(req, res) {
        try {
            const { id } = req.params;

            const { data: reserva } = await supabase
                .from('reservas')
                .select('observaciones')
                .eq('id', id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            const nuevasObs = `${reserva.observaciones || ''}\n[OCULTO_DASHBOARD]`.trim();

            const { error } = await supabase
                .from('reservas')
                .update({ observaciones: nuevasObs })
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva ocultada del dashboard' });

        } catch (error) {
            console.error('Error ocultando reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Eliminar reserva de la base de datos
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

            // Eliminar pagos y reserva
            await supabase.from('pagos').delete().eq('reserva_id', id);
            const { error } = await supabase.from('reservas').delete().eq('id', id);

            if (error) throw error;

            res.json({ success: true, message: 'Reserva eliminada definitivamente de la base de datos' });

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

    // ============================================================
    // REGLAS DE NEGOCIO - SEÑA EN EFECTIVO (48hs)
    // ============================================================

    // Procesar vencimientos de reservas (cancelar si faltan < 48hs y sigue pendiente)
    async procesarVencimientos(req, res) {
        try {
            console.log('🔄 Ejecutando procesamiento de vencimientos de reservas (48hs)...');
            
            // Límite: 48 horas a partir de ahora
            const limiteVencimiento = moment().add(48, 'hours');
            
            // Buscar reservas pendientes donde la fecha/hora es ANTERIOR al límite 
            // (es decir, faltan menos de 48 horas para el turno)
            // Tenemos que combinar fecha y hora_inicio para comparar bien
            
            const { data: pendientes } = await supabase
                .from('reservas')
                .select('id, fecha, hora_inicio')
                .eq('estado', 'pendiente');
                
            if (!pendientes || pendientes.length === 0) {
                if (res) return res.json({ success: true, message: 'No hay reservas pendientes para procesar' });
                return;
            }
            
            let canceladas = 0;
            
            for (const reserva of pendientes) {
                const fechaHoraReserva = moment(`${reserva.fecha} ${reserva.hora_inicio}`, 'YYYY-MM-DD HH:mm');
                
                // Si la fecha/hora de la reserva es ANTES del límite de 48h desde ahora, se vence
                if (fechaHoraReserva.isBefore(limiteVencimiento)) {
                    console.log(`⚠️ Cancelando reserva ${reserva.id}: Pasó el límite de 48hs sin pago de seña.`);
                    await supabase
                        .from('reservas')
                        .update({
                            estado: 'cancelada',
                            fecha_cancelacion: new Date().toISOString(),
                            razon_cancelacion: 'Cancelación automática: Falta de pago de seña en el plazo de 48hs previas.'
                        })
                        .eq('id', reserva.id);
                        
                    canceladas++;
                }
            }
            
            console.log(`✅ Proceso finalizado. Reservas canceladas: ${canceladas}`);
            if (res) res.json({ success: true, message: `Proceso completado. Canceladas: ${canceladas}` });
            
        } catch (error) {
            console.error('Error procesando vencimientos:', error);
            if (res) res.status(500).json({ success: false, message: 'Error procesando vencimientos' });
        }
    }

    // Obtener alertas para el dashboard (reservas que vencen en menos de 1 hora, o sea entre 48h y 49h)
    async obtenerAlertasAdmin(req, res) {
        try {
            const limite48h = moment().add(48, 'hours');
            const limite49h = moment().add(49, 'hours');
            
            const { data: pendientes } = await supabase
                .from('reservas')
                .select(`
                    id, fecha, hora_inicio, precio_total, sena_requerida,
                    clientes(nombre, apellido, telefono)
                `)
                .eq('estado', 'pendiente');
                
            if (!pendientes) return res.json({ success: true, data: [] });
            
            const alertas = pendientes.filter(reserva => {
                const fechaHora = moment(`${reserva.fecha} ${reserva.hora_inicio}`, 'YYYY-MM-DD HH:mm');
                // Está entre 48h y 49h de distancia
                return fechaHora.isAfter(limite48h) && fechaHora.isBefore(limite49h);
            }).map(r => ({
                id: r.id,
                fecha: r.fecha,
                hora_inicio: r.hora_inicio,
                monto_sena: r.sena_requerida,
                cliente: `${r.clientes?.nombre} ${r.clientes?.apellido}`,
                telefono: r.clientes?.telefono,
                horas_restantes: moment(`${r.fecha} ${r.hora_inicio}`, 'YYYY-MM-DD HH:mm').diff(moment(), 'hours', true).toFixed(1)
            }));
            
            res.json({ success: true, data: alertas });
            
        } catch (error) {
            console.error('Error obteniendo alertas:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new ReservaController();
