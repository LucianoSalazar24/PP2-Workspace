// Backend/api-usuarios/controllers/clienteController.js
const supabase = require('../../shared/supabase');

class ClienteController {

    // Obtener todos los clientes
    async obtenerClientes(req, res) {
        try {
            const { limite = 50, buscar = '' } = req.query;

            let query = supabase
                .from('clientes')
                .select('*, tipos_cliente(nombre, descuento_porcentaje)')
                .order('created_at', { ascending: false })
                .limit(parseInt(limite));

            if (buscar) {
                query = query.or(
                    `nombre.ilike.%${buscar}%,apellido.ilike.%${buscar}%,telefono.ilike.%${buscar}%,email.ilike.%${buscar}%`
                );
            }

            const { data: clientes, error } = await query;

            if (error) throw error;

            // Aplanar la relación para compatibilidad con el frontend
            const clientesFormateados = clientes.map(c => ({
                ...c,
                tipo_cliente: c.tipos_cliente?.nombre || 'regular',
                descuento_porcentaje: c.tipos_cliente?.descuento_porcentaje || 0,
                tipos_cliente: undefined
            }));

            res.json({
                success: true,
                data: clientesFormateados,
                total: clientesFormateados.length
            });

        } catch (error) {
            console.error('Error obteniendo clientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener cliente por ID
    async obtenerClientePorId(req, res) {
        try {
            const { id } = req.params;

            const { data: cliente, error } = await supabase
                .from('clientes')
                .select('*, tipos_cliente(nombre, descuento_porcentaje)')
                .eq('id', id)
                .single();

            if (error || !cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Obtener reservas recientes
            const { data: reservas } = await supabase
                .from('reservas')
                .select('id, fecha, hora_inicio, hora_fin, precio_total, estado, canchas(nombre)')
                .eq('cliente_id', id)
                .order('fecha', { ascending: false })
                .order('hora_inicio', { ascending: false })
                .limit(10);

            const reservasFormateadas = (reservas || []).map(r => ({
                ...r,
                cancha_nombre: r.canchas?.nombre,
                canchas: undefined
            }));

            res.json({
                success: true,
                data: {
                    ...cliente,
                    tipo_cliente: cliente.tipos_cliente?.nombre || 'regular',
                    descuento_porcentaje: cliente.tipos_cliente?.descuento_porcentaje || 0,
                    tipos_cliente: undefined,
                    reservas_recientes: reservasFormateadas
                }
            });

        } catch (error) {
            console.error('Error obteniendo cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Crear nuevo cliente
    async crearCliente(req, res) {
        try {
            const { nombre, apellido, telefono, email } = req.body;

            // Verificar teléfono duplicado
            const { data: telExiste } = await supabase
                .from('clientes')
                .select('id')
                .eq('telefono', telefono)
                .maybeSingle();

            if (telExiste) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con ese número de teléfono'
                });
            }

            // Verificar email duplicado
            if (email) {
                const { data: emailExiste } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();

                if (emailExiste) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese email'
                    });
                }
            }

            const { data: clienteCreado, error } = await supabase
                .from('clientes')
                .insert({
                    nombre,
                    apellido,
                    telefono,
                    email: email || null,
                    tipo_cliente_id: 1
                })
                .select('*, tipos_cliente(nombre, descuento_porcentaje)')
                .single();

            if (error) throw error;

            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                data: {
                    ...clienteCreado,
                    tipo_cliente: clienteCreado.tipos_cliente?.nombre,
                    descuento_porcentaje: clienteCreado.tipos_cliente?.descuento_porcentaje,
                    tipos_cliente: undefined
                }
            });

        } catch (error) {
            console.error('Error creando cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Actualizar cliente
    async actualizarCliente(req, res) {
        try {
            const { id } = req.params;
            const { nombre, apellido, telefono, email, tipo_cliente_id } = req.body;

            // Verificar que existe
            const { data: cliente } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single();

            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Verificar teléfono duplicado
            if (telefono && telefono !== cliente.telefono) {
                const { data: telExiste } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('telefono', telefono)
                    .neq('id', id)
                    .maybeSingle();

                if (telExiste) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese número de teléfono'
                    });
                }
            }

            // Verificar email duplicado
            if (email && email !== cliente.email) {
                const { data: emailExiste } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('email', email)
                    .neq('id', id)
                    .maybeSingle();

                if (emailExiste) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese email'
                    });
                }
            }

            const { data: clienteActualizado, error } = await supabase
                .from('clientes')
                .update({
                    nombre: nombre || cliente.nombre,
                    apellido: apellido || cliente.apellido,
                    telefono: telefono || cliente.telefono,
                    email: email || cliente.email,
                    tipo_cliente_id: tipo_cliente_id || cliente.tipo_cliente_id
                })
                .eq('id', id)
                .select('*, tipos_cliente(nombre, descuento_porcentaje)')
                .single();

            if (error) throw error;

            res.json({
                success: true,
                message: 'Cliente actualizado exitosamente',
                data: {
                    ...clienteActualizado,
                    tipo_cliente: clienteActualizado.tipos_cliente?.nombre,
                    descuento_porcentaje: clienteActualizado.tipos_cliente?.descuento_porcentaje,
                    tipos_cliente: undefined
                }
            });

        } catch (error) {
            console.error('Error actualizando cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Buscar por teléfono
    async buscarPorTelefono(req, res) {
        try {
            const { telefono } = req.query;

            if (!telefono) {
                return res.status(400).json({
                    success: false,
                    message: 'Teléfono es requerido'
                });
            }

            const { data: cliente, error } = await supabase
                .from('clientes')
                .select('*, tipos_cliente(nombre, descuento_porcentaje)')
                .eq('telefono', telefono)
                .single();

            if (error || !cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado con ese teléfono'
                });
            }

            res.json({
                success: true,
                data: {
                    ...cliente,
                    tipo_cliente: cliente.tipos_cliente?.nombre,
                    descuento_porcentaje: cliente.tipos_cliente?.descuento_porcentaje,
                    tipos_cliente: undefined
                }
            });

        } catch (error) {
            console.error('Error buscando cliente por teléfono:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cambiar estado del cliente
    async cambiarEstadoCliente(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body;

            const { data: cliente } = await supabase
                .from('clientes')
                .select('id')
                .eq('id', id)
                .single();

            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            const { error } = await supabase
                .from('clientes')
                .update({ estado })
                .eq('id', id);

            if (error) throw error;

            res.json({
                success: true,
                message: `Cliente ${estado === 'suspendido' ? 'suspendido' : 'activado'} exitosamente`
            });

        } catch (error) {
            console.error('Error cambiando estado del cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener estadísticas del cliente
    async obtenerEstadisticas(req, res) {
        try {
            const { id } = req.params;

            // Obtener todas las reservas del cliente
            const { data: reservas, error } = await supabase
                .from('reservas')
                .select('estado, precio_total, fecha')
                .eq('cliente_id', id);

            if (error) throw error;

            const stats = {
                general: {
                    total_reservas: reservas.length,
                    completadas: reservas.filter(r => r.estado === 'completada').length,
                    no_shows: reservas.filter(r => r.estado === 'no_show').length,
                    canceladas: reservas.filter(r => r.estado === 'cancelada').length,
                    gasto_promedio: reservas.length > 0
                        ? reservas.reduce((sum, r) => sum + parseFloat(r.precio_total || 0), 0) / reservas.length
                        : 0,
                    gasto_total: reservas.reduce((sum, r) => sum + parseFloat(r.precio_total || 0), 0)
                }
            };

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas del cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = new ClienteController();
