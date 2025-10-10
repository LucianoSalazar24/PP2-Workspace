// src/controllers/reservaController.js - Lógica principal de reservas
const db = require('./Config/dataBase');
const moment = require('moment');

class ReservaController {
    
    // Obtener todas las reservas con filtros opcionales
    async obtenerReservas(req, res) {
        try {
            const { fecha, cancha_id, cliente_id, estado, limite = 50 } = req.query;
            
            let sql = `
                SELECT 
                    r.id,
                    r.fecha,
                    r.hora_inicio,
                    r.hora_fin,
                    r.precio_total,
                    r.descuento_aplicado,
                    r.sena_requerida,
                    r.sena_pagada,
                    r.pago_completo,
                    r.observaciones,
                    r.fecha_creacion,
                    c.nombre as cancha_nombre,
                    c.precio_por_hora,
                    cl.nombre as cliente_nombre,
                    cl.apellido as cliente_apellido,
                    cl.telefono as cliente_telefono,
                    er.nombre as estado,
                    er.descripcion as estado_descripcion
                FROM reservas r
                JOIN canchas c ON r.cancha_id = c.id
                JOIN clientes cl ON r.cliente_id = cl.id
                JOIN estados_reserva er ON r.estado_id = er.id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (fecha) {
                sql += ' AND r.fecha = ?';
                params.push(fecha);
            }
            
            if (cancha_id) {
                sql += ' AND r.cancha_id = ?';
                params.push(cancha_id);
            }
            
            if (cliente_id) {
                sql += ' AND r.cliente_id = ?';
                params.push(cliente_id);
            }
            
            if (estado) {
                sql += ' AND er.nombre = ?';
                params.push(estado);
            }
            
            sql += ' ORDER BY r.fecha DESC, r.hora_inicio ASC LIMIT ?';
            params.push(parseInt(limite));
            
            const reservas = await db.all(sql, params);
            
            res.json({
                success: true,
                data: reservas,
                total: reservas.length
            });
            
        } catch (error) {
            console.error('Error obteniendo reservas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Crear nueva reserva
    async crearReserva(req, res) {
        try {
            const {
                cancha_id,
                cliente_id,
                fecha,
                hora_inicio,
                hora_fin,
                observaciones = ''
            } = req.body;

            // Validaciones básicas
            if (!cancha_id || !cliente_id || !fecha || !hora_inicio || !hora_fin) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos obligatorios'
                });
            }

            // Validar formato de fecha y horas
            const fechaReserva = moment(fecha, 'YYYY-MM-DD');
            const horaInicio = moment(hora_inicio, 'HH:mm');
            const horaFin = moment(hora_fin, 'HH:mm');

            if (!fechaReserva.isValid() || !horaInicio.isValid() || !horaFin.isValid()) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de fecha u hora inválido'
                });
            }

            // Validar que la hora de fin sea posterior a la de inicio
            if (horaFin.isSameOrBefore(horaInicio)) {
                return res.status(400).json({
                    success: false,
                    message: 'La hora de fin debe ser posterior a la de inicio'
                });
            }

            // Validar que la reserva sea para el futuro
            const ahora = moment();
            const fechaHoraReserva = moment(`${fecha} ${hora_inicio}`, 'YYYY-MM-DD HH:mm');
            
            const horasAnticipacion = await db.getConfiguracion('horas_anticipacion_min') || 2;
            const minimoPermitido = ahora.clone().add(horasAnticipacion, 'hours');

            if (fechaHoraReserva.isBefore(minimoPermitido)) {
                return res.status(400).json({
                    success: false,
                    message: `Debes reservar con al menos ${horasAnticipacion} horas de anticipación`
                });
            }

            // Verificar disponibilidad de la cancha
            const disponible = await db.verificarDisponibilidad(
                cancha_id, fecha, hora_inicio, hora_fin
            );

            if (!disponible) {
                return res.status(409).json({
                    success: false,
                    message: 'La cancha no está disponible en el horario solicitado'
                });
            }

            // Obtener datos de la cancha y cliente
            const cancha = await db.get('SELECT * FROM canchas WHERE id = ?', [cancha_id]);
            const cliente = await db.get(`
                SELECT c.*, tc.descuento_porcentaje 
                FROM clientes c 
                JOIN tipos_cliente tc ON c.tipo_cliente_id = tc.id 
                WHERE c.id = ?
            `, [cliente_id]);

            if (!cancha || !cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cancha o cliente no encontrado'
                });
            }

            // Calcular precio y descuentos
            const duracionHoras = horaFin.diff(horaInicio, 'hours', true);
            const precioBase = cancha.precio_por_hora * duracionHoras;
            const descuentoPorcentaje = cliente.descuento_porcentaje || 0;
            const descuentoMonto = (precioBase * descuentoPorcentaje) / 100;
            const precioTotal = precioBase - descuentoMonto;
            
            // Calcular seña requerida
            const senaPorcentaje = await db.getConfiguracion('sena_porcentaje') || 30;
            const senaRequerida = (precioTotal * senaPorcentaje) / 100;

            // Crear la reserva en una transacción
            const resultado = await db.transaction(async () => {
                // Insertar la reserva
                const reservaResult = await db.run(`
                    INSERT INTO reservas (
                        cancha_id, cliente_id, fecha, hora_inicio, hora_fin,
                        precio_total, descuento_aplicado, sena_requerida,
                        estado_id, observaciones
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                `, [
                    cancha_id, cliente_id, fecha, hora_inicio, hora_fin,
                    precioTotal, descuentoPorcentaje, senaRequerida,
                    observaciones
                ]);

                // Actualizar contador de reservas del cliente
                await db.run(
                    'UPDATE clientes SET total_reservas = total_reservas + 1, ultima_reserva = ? WHERE id = ?',
                    [fecha, cliente_id]
                );

                return reservaResult.id;
            });

            // Obtener la reserva completa creada
            const reservaCreada = await db.get(`
                SELECT 
                    r.*,
                    c.nombre as cancha_nombre,
                    cl.nombre as cliente_nombre,
                    cl.apellido as cliente_apellido,
                    cl.telefono as cliente_telefono
                FROM reservas r
                JOIN canchas c ON r.cancha_id = c.id
                JOIN clientes cl ON r.cliente_id = cl.id
                WHERE r.id = ?
            `, [resultado]);

            res.status(201).json({
                success: true,
                message: 'Reserva creada exitosamente',
                data: reservaCreada
            });

        } catch (error) {
            console.error('Error creando reserva:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Confirmar reserva (con pago de seña)
    async confirmarReserva(req, res) {
        try {
            const { id } = req.params;
            const { monto_pagado, metodo_pago = 'efectivo' } = req.body;

            const reserva = await db.get('SELECT * FROM reservas WHERE id = ?', [id]);
            
            if (!reserva) {
                return res.status(404).json({
                    success: false,
                    message: 'Reserva no encontrada'
                });
            }

            if (reserva.estado_id !== 1) {
                return res.status(400).json({
                    success: false,
                    message: 'La reserva ya está confirmada o no se puede confirmar'
                });
            }

            const montoPagado = parseFloat(monto_pagado);
            if (montoPagado < reserva.sena_requerida) {
                return res.status(400).json({
                    success: false,
                    message: `El monto pagado debe ser al menos $${reserva.sena_requerida}`
                });
            }

            // Confirmar reserva y registrar pago
            await db.transaction(async () => {
                // Actualizar estado de la reserva
                await db.run(`
                    UPDATE reservas 
                    SET estado_id = 2, sena_pagada = ?, pago_completo = ?
                    WHERE id = ?
                `, [montoPagado, montoPagado >= reserva.precio_total, id]);

                // Registrar el pago
                await db.run(`
                    INSERT INTO pagos (reserva_id, monto, tipo_pago, metodo_pago)
                    VALUES (?, ?, ?, ?)
                `, [id, montoPagado, montoPagado >= reserva.precio_total ? 'completo' : 'seña', metodo_pago]);
            });

            res.json({
                success: true,
                message: 'Reserva confirmada exitosamente'
            });

        } catch (error) {
            console.error('Error confirmando reserva:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cancelar reserva
    async cancelarReserva(req, res) {
        try {
            const { id } = req.params;
            const { razon = 'Cancelación solicitada' } = req.body;

            const reserva = await db.get('SELECT * FROM reservas WHERE id = ?', [id]);
            
            if (!reserva) {
                return res.status(404).json({
                    success: false,
                    message: 'Reserva no encontrada'
                });
            }

            if (reserva.estado_id === 3) {
                return res.status(400).json({
                    success: false,
                    message: 'La reserva ya está cancelada'
                });
            }

            await db.run(`
                UPDATE reservas 
                SET estado_id = 3, fecha_cancelacion = NOW(), razon_cancelacion = ?
                WHERE id = ?
            `, [razon, id]);

            res.json({
                success: true,
                message: 'Reserva cancelada exitosamente'
            });

        } catch (error) {
            console.error('Error cancelando reserva:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener disponibilidad de canchas
    async obtenerDisponibilidad(req, res) {
        try {
            const { fecha, cancha_id } = req.query;
            
            if (!fecha) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha es requerida'
                });
            }

            let sql = `
                SELECT 
                    c.id as cancha_id,
                    c.nombre as cancha_nombre,
                    c.precio_por_hora,
                    r.hora_inicio,
                    r.hora_fin,
                    r.id as reserva_id
                FROM canchas c
                LEFT JOIN reservas r ON c.id = r.cancha_id 
                    AND r.fecha = ? 
                    AND r.estado_id IN (1, 2)
                WHERE c.estado = 'disponible'
            `;

            const params = [fecha];

            if (cancha_id) {
                sql += ' AND c.id = ?';
                params.push(cancha_id);
            }

            sql += ' ORDER BY c.id, r.hora_inicio';

            const resultados = await db.all(sql, params);
            
            // Organizar por cancha
            const disponibilidad = {};
            
            for (const row of resultados) {
                if (!disponibilidad[row.cancha_id]) {
                    disponibilidad[row.cancha_id] = {
                        id: row.cancha_id,
                        nombre: row.cancha_nombre,
                        precio_por_hora: row.precio_por_hora,
                        reservas: []
                    };
                }
                
                if (row.reserva_id) {
                    disponibilidad[row.cancha_id].reservas.push({
                        hora_inicio: row.hora_inicio,
                        hora_fin: row.hora_fin
                    });
                }
            }

            res.json({
                success: true,
                data: Object.values(disponibilidad),
                fecha: fecha
            });

        } catch (error) {
            console.error('Error obteniendo disponibilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new ReservaController();