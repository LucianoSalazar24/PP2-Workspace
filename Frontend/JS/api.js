// js/api.js - Funciones para comunicarse con el backend

// Función auxiliar para hacer peticiones HTTP
async function request(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || CONFIG.MENSAJES.ERROR_GENERICO);
        }
        
        return data;
        
    } catch (error) {
        console.error('Error en petición:', error);
        throw error;
    }
}

// API de Canchas
const CanchasAPI = {
    // Obtener todas las canchas
    async obtenerTodas() {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.CANCHAS);
        return await request(url);
    },
    
    // Obtener una cancha por ID
    async obtenerPorId(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CANCHAS}/${id}`);
        return await request(url);
    },
    
    // Crear nueva cancha
    async crear(datos) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.CANCHAS);
        return await request(url, {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },
    
    // Actualizar cancha
    async actualizar(id, datos) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CANCHAS}/${id}`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    },
    
    // Cambiar estado de cancha
    async cambiarEstado(id, estado) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CANCHAS}/${id}/estado`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify({ estado })
        });
    },
    
    // Ver disponibilidad de una cancha específica
    async verDisponibilidad(id, fecha) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CANCHAS}/${id}/disponibilidad`, { fecha });
        return await request(url);
    }
};

// API de Clientes
const ClientesAPI = {
    // Obtener todos los clientes
    async obtenerTodos(params = {}) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.CLIENTES, params);
        return await request(url);
    },
    
    // Buscar cliente por teléfono
    async buscarPorTelefono(telefono) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.CLIENTES_BUSCAR, { telefono });
        return await request(url);
    },
    
    // Obtener cliente por ID
    async obtenerPorId(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CLIENTES}/${id}`);
        return await request(url);
    },
    
    // Crear nuevo cliente
    async crear(datos) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.CLIENTES);
        return await request(url, {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },
    
    // Actualizar cliente
    async actualizar(id, datos) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CLIENTES}/${id}`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    },
    
    // Cambiar estado del cliente
    async cambiarEstado(id, estado, razon = '') {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CLIENTES}/${id}/estado`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify({ estado, razon })
        });
    },
    
    // Obtener estadísticas del cliente
    async obtenerEstadisticas(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.CLIENTES}/${id}/estadisticas`);
        return await request(url);
    }
};

// API de Reservas
const ReservasAPI = {
    // Obtener todas las reservas con filtros
    async obtenerTodas(params = {}) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.RESERVAS, params);
        return await request(url);
    },
    
    // Obtener reserva por ID
    async obtenerPorId(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}`);
        return await request(url);
    },
    
    // Verificar disponibilidad de canchas
    async verificarDisponibilidad(fecha, canchaId = null) {
        const params = { fecha };
        if (canchaId) params.cancha_id = canchaId;
        
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.RESERVAS_DISPONIBILIDAD, params);
        return await request(url);
    },
    
    // Crear nueva reserva
    async crear(datos) {
        const url = CONFIG.getURL(CONFIG.ENDPOINTS.RESERVAS);
        return await request(url, {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },
    
    // Confirmar reserva (con pago)
    async confirmar(id, montoPagado, metodoPago) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}/confirmar`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify({ 
                monto_pagado: montoPagado, 
                metodo_pago: metodoPago 
            })
        });
    },
    
    // Cancelar reserva
    async cancelar(id, razon = '') {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}/cancelar`);
        return await request(url, {
            method: 'PUT',
            body: JSON.stringify({ razon })
        });
    },
    
    // Marcar como completada
    async completar(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}/completar`);
        return await request(url, {
            method: 'PUT'
        });
    },
    
    // Marcar como no-show
    async marcarNoShow(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}/no-show`);
        return await request(url, {
            method: 'PUT'
        });
    },
    
    // Eliminar reserva
    async eliminar(id) {
        const url = CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/${id}`);
        return await request(url, {
            method: 'DELETE'
        });
    }
};

// Exportar APIs
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CanchasAPI, ClientesAPI, ReservasAPI };
}