// js/config.js - Configuración centralizada del frontend

const CONFIG = {
    // URL base de tu API
    API_URL: 'http://localhost:3000/api',
    
    // Endpoints específicos
    ENDPOINTS: {
        // Reservas
        RESERVAS: '/reservas',
        RESERVAS_DISPONIBILIDAD: '/reservas/disponibilidad',
        
        // Clientes
        CLIENTES: '/clientes',
        CLIENTES_BUSCAR: '/clientes/buscar-telefono',
        
        // Canchas
        CANCHAS: '/canchas'
    },
    
    // Configuraciones de la aplicación
    APP: {
        NOMBRE: 'Sistema de Reservas de Canchas',
        VERSION: '1.0.0',
        HORARIO_APERTURA: '08:00',
        HORARIO_CIERRE: '23:00',
        DURACION_MINIMA_MINUTOS: 60,
        DURACION_MAXIMA_HORAS: 3
    },
    
    // Estados de reserva
    ESTADOS_RESERVA: {
        PENDIENTE: 'pendiente',
        CONFIRMADA: 'confirmada',
        CANCELADA: 'cancelada',
        COMPLETADA: 'completada',
        NO_SHOW: 'no_show'
    },
    
    // Métodos de pago
    METODOS_PAGO: {
        EFECTIVO: 'efectivo',
        TARJETA: 'tarjeta',
        TRANSFERENCIA: 'transferencia'
    },
    
    // Mensajes del sistema
    MENSAJES: {
        ERROR_CONEXION: 'Error de conexión con el servidor. Verifica tu conexión.',
        ERROR_GENERICO: 'Ocurrió un error. Por favor, intenta nuevamente.',
        CARGANDO: 'Cargando...',
        SIN_DATOS: 'No hay datos disponibles',
        OPERACION_EXITOSA: 'Operación realizada exitosamente',
        CAMPOS_REQUERIDOS: 'Por favor completa todos los campos requeridos'
    }
};

// Función auxiliar para construir URLs completas
CONFIG.getURL = function(endpoint, params = {}) {
    let url = this.API_URL + endpoint;
    
    // Agregar parámetros de consulta si existen
    const queryParams = new URLSearchParams(params).toString();
    if (queryParams) {
        url += '?' + queryParams;
    }
    
    return url;
};

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}