// Backend/api-pagos/controllers/pagoController.js
const supabase = require('../../shared/supabase');

class PagoController {

    // Obtener todos los pagos con filtros
    async obtenerPagos(req, res) {
        try {
            const { reserva_id, tipo_pago, metodo_pago, limite = 50 } = req.query;

            let query = supabase
                .from('pagos')
                .select(`
                    *,
                    reservas(
                        id, fecha, hora_inicio, hora_fin, precio_total, estado,
                        canchas(nombre),
                        clientes(nombre, apellido, telefono)
                    )
                `)
                .order('fecha_pago', { ascending: false })
                .limit(parseInt(limite));

            if (reserva_id) query = query.eq('reserva_id', reserva_id);
            if (tipo_pago) query = query.eq('tipo_pago', tipo_pago);
            if (metodo_pago) query = query.eq('metodo_pago', metodo_pago);

            const { data: pagos, error } = await query;
            if (error) throw error;

            // Formatear para el frontend
            const formateados = (pagos || []).map(p => ({
                id: p.id,
                reserva_id: p.reserva_id,
                monto: p.monto,
                tipo_pago: p.tipo_pago,
                metodo_pago: p.metodo_pago,
                fecha_pago: p.fecha_pago,
                observaciones: p.observaciones,
                reserva: p.reservas ? {
                    id: p.reservas.id,
                    fecha: p.reservas.fecha,
                    hora_inicio: p.reservas.hora_inicio,
                    hora_fin: p.reservas.hora_fin,
                    precio_total: p.reservas.precio_total,
                    estado: p.reservas.estado,
                    cancha_nombre: p.reservas.canchas?.nombre,
                    cliente_nombre: p.reservas.clientes?.nombre,
                    cliente_apellido: p.reservas.clientes?.apellido,
                    cliente_telefono: p.reservas.clientes?.telefono,
                } : null
            }));

            res.json({ success: true, data: formateados, total: formateados.length });

        } catch (error) {
            console.error('Error obteniendo pagos:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener pago por ID
    async obtenerPagoPorId(req, res) {
        try {
            const { id } = req.params;

            const { data: pago, error } = await supabase
                .from('pagos')
                .select(`
                    *,
                    reservas(id, fecha, hora_inicio, hora_fin, precio_total, estado,
                        canchas(nombre),
                        clientes(nombre, apellido)
                    )
                `)
                .eq('id', id)
                .single();

            if (error || !pago) {
                return res.status(404).json({ success: false, message: 'Pago no encontrado' });
            }

            res.json({ success: true, data: pago });

        } catch (error) {
            console.error('Error obteniendo pago:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Registrar un nuevo pago
    async registrarPago(req, res) {
        try {
            const { reserva_id, monto, tipo_pago, metodo_pago, observaciones = '' } = req.body;

            // Verificar que la reserva existe
            const { data: reserva } = await supabase
                .from('reservas')
                .select('id, precio_total, sena_pagada, estado')
                .eq('id', reserva_id)
                .single();

            if (!reserva) {
                return res.status(404).json({ success: false, message: 'Reserva no encontrada' });
            }

            if (reserva.estado === 'cancelada') {
                return res.status(400).json({ success: false, message: 'No se pueden registrar pagos en reservas canceladas' });
            }

            // Registrar el pago
            const { data: pagoCreado, error } = await supabase
                .from('pagos')
                .insert({
                    reserva_id,
                    monto: parseFloat(monto),
                    tipo_pago,
                    metodo_pago,
                    observaciones
                })
                .select('*')
                .single();

            if (error) throw error;

            // Actualizar la seña pagada en la reserva
            const nuevaSenaPagada = parseFloat(reserva.sena_pagada || 0) + parseFloat(monto);
            const updateData = {
                sena_pagada: nuevaSenaPagada,
                pago_completo: nuevaSenaPagada >= parseFloat(reserva.precio_total)
            };

            // Si es el primer pago y la reserva está pendiente, confirmarla
            if (reserva.estado === 'pendiente' && tipo_pago !== 'devolucion') {
                updateData.estado = 'confirmada';
            }

            await supabase
                .from('reservas')
                .update(updateData)
                .eq('id', reserva_id);

            res.status(201).json({
                success: true,
                message: 'Pago registrado exitosamente',
                data: pagoCreado
            });

        } catch (error) {
            console.error('Error registrando pago:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener pagos de una reserva específica
    async obtenerPagosPorReserva(req, res) {
        try {
            const { reserva_id } = req.params;

            const { data: pagos, error } = await supabase
                .from('pagos')
                .select('*')
                .eq('reserva_id', reserva_id)
                .order('fecha_pago');

            if (error) throw error;

            // Obtener resumen de la reserva
            const { data: reserva } = await supabase
                .from('reservas')
                .select('precio_total, sena_requerida, sena_pagada, pago_completo')
                .eq('id', reserva_id)
                .single();

            const totalPagado = (pagos || []).reduce((sum, p) => sum + parseFloat(p.monto), 0);

            res.json({
                success: true,
                data: {
                    pagos: pagos || [],
                    resumen: {
                        precio_total: reserva?.precio_total || 0,
                        sena_requerida: reserva?.sena_requerida || 0,
                        total_pagado: totalPagado,
                        saldo_pendiente: Math.max(0, parseFloat(reserva?.precio_total || 0) - totalPagado),
                        pago_completo: reserva?.pago_completo || false
                    }
                }
            });

        } catch (error) {
            console.error('Error obteniendo pagos de reserva:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // Obtener resumen/estadísticas de pagos
    async obtenerEstadisticas(req, res) {
        try {
            const { data: pagos, error } = await supabase
                .from('pagos')
                .select('monto, tipo_pago, metodo_pago, fecha_pago');

            if (error) throw error;

            const ahora = new Date();
            const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();

            const pagosDelMes = (pagos || []).filter(p => p.fecha_pago >= inicioMes);

            const stats = {
                total_general: (pagos || []).reduce((s, p) => s + parseFloat(p.monto), 0),
                total_mes: pagosDelMes.reduce((s, p) => s + parseFloat(p.monto), 0),
                cantidad_pagos_mes: pagosDelMes.length,
                por_metodo: {
                    efectivo: pagosDelMes.filter(p => p.metodo_pago === 'efectivo').reduce((s, p) => s + parseFloat(p.monto), 0),
                    tarjeta: pagosDelMes.filter(p => p.metodo_pago === 'tarjeta').reduce((s, p) => s + parseFloat(p.monto), 0),
                    transferencia: pagosDelMes.filter(p => p.metodo_pago === 'transferencia').reduce((s, p) => s + parseFloat(p.monto), 0),
                }
            };

            res.json({ success: true, data: stats });

        } catch (error) {
            console.error('Error obteniendo estadísticas de pagos:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new PagoController();
