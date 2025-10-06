// js/admin.js - Lógica del panel de administración

document.addEventListener('DOMContentLoaded', () => {
    inicializarAdmin();
});

function inicializarAdmin() {
    configurarNavegacion();
    cargarDashboard();
    configurarEventos();
}

// Navegación entre secciones
function configurarNavegacion() {
    const botones = document.querySelectorAll('.admin-nav-btn');
    
    botones.forEach(btn => {
        btn.addEventListener('click', () => {
            const seccion = btn.dataset.section;
            cambiarSeccion(seccion);
            
            // Actualizar botón activo
            botones.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function cambiarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.admin-section').forEach(s => {
        s.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    document.getElementById(seccion).classList.add('active');
    
    // Cargar datos de la sección
    switch(seccion) {
        case 'dashboard':
            cargarDashboard();
            break;
        case 'reservas':
            cargarReservas();
            break;
        case 'clientes':
            cargarClientes();
            break;
        case 'canchas':
            cargarCanchas();
            break;
    }
}

// Configurar eventos
function configurarEventos() {
    document.getElementById('btnFiltrarReservas').addEventListener('click', cargarReservas);
    document.getElementById('buscarCliente').addEventListener('input', debounce(cargarClientes, 500));
}

// Debounce para búsquedas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// DASHBOARD
async function cargarDashboard() {
    try {
        const hoy = DateUtils.hoy();
        
        // Cargar reservas de hoy
        const reservasHoy = await ReservasAPI.obtenerTodas({ fecha: hoy });
        document.getElementById('statReservasHoy').textContent = reservasHoy.data.length;
        
        // Cargar todas las reservas para estadísticas
        const todasReservas = await ReservasAPI.obtenerTodas();
        
        // Calcular ingresos del mes
        const mesActual = new Date().getMonth();
        const ingresosMes = todasReservas.data
            .filter(r => {
                const fechaReserva = new Date(r.fecha);
                return fechaReserva.getMonth() === mesActual && r.estado === 'completada';
            })
            .reduce((sum, r) => sum + r.precio_total, 0);
        
        document.getElementById('statIngresosMes').textContent = MoneyUtils.formato(ingresosMes);
        
        // Cargar clientes
        const clientes = await ClientesAPI.obtenerTodos();
        document.getElementById('statClientes').textContent = clientes.total;
        
        // Calcular ocupación de hoy
        const ocupacion = reservasHoy.data.length > 0 ? 
            Math.round((reservasHoy.data.length / 10) * 100) : 0;
        document.getElementById('statOcupacion').textContent = `${ocupacion}%`;
        
        // Mostrar tabla de reservas de hoy
        mostrarReservasHoy(reservasHoy.data);
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        UIUtils.mostrarError('Error al cargar el dashboard');
    }
}

function mostrarReservasHoy(reservas) {
    const container = document.getElementById('reservasHoyContainer');
    
    if (reservas.length === 0) {
        container.innerHTML = '<p class="no-data">No hay reservas para hoy</p>';
        return;
    }
    
    const tabla = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Horario</th>
                        <th>Cancha</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservas.map(r => `
                        <tr>
                            <td>${r.hora_inicio} - ${r.hora_fin}</td>
                            <td>${r.cancha_nombre}</td>
                            <td>${r.cliente_nombre} ${r.cliente_apellido}</td>
                            <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                            <td>${MoneyUtils.formato(r.precio_total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tabla;
}

// RESERVAS
async function cargarReservas() {
    const container = document.getElementById('reservasTableContainer');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    try {
        const fecha = document.getElementById('filtroFecha').value;
        const estado = document.getElementById('filtroEstado').value;
        
        const params = {};
        if (fecha) params.fecha = fecha;
        if (estado) params.estado = estado;
        
        const response = await ReservasAPI.obtenerTodas(params);
        
        if (response.data.length === 0) {
            container.innerHTML = '<p class="no-data">No se encontraron reservas</p>';
            return;
        }
        
        const tabla = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Fecha</th>
                            <th>Horario</th>
                            <th>Cancha</th>
                            <th>Cliente</th>
                            <th>Estado</th>
                            <th>Precio</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.map(r => `
                            <tr>
                                <td>${r.id}</td>
                                <td>${DateUtils.formatoLegible(r.fecha)}</td>
                                <td>${r.hora_inicio} - ${r.hora_fin}</td>
                                <td>${r.cancha_nombre}</td>
                                <td>${r.cliente_nombre} ${r.cliente_apellido}<br>
                                    <small>${r.cliente_telefono}</small>
                                </td>
                                <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                                <td>${MoneyUtils.formato(r.precio_total)}</td>
                                <td>
                                    <div class="table-actions">
                                        ${r.estado === 'pendiente' ? 
                                            `<button class="btn btn-small btn-primary" onclick="confirmarReserva(${r.id})">
                                                Confirmar
                                            </button>` : ''}
                                        ${r.estado === 'confirmada' ? 
                                            `<button class="btn btn-small btn-secondary" onclick="completarReserva(${r.id})">
                                                Completar
                                            </button>` : ''}
                                        ${['pendiente', 'confirmada'].includes(r.estado) ? 
                                            `<button class="btn btn-small btn-danger" onclick="cancelarReserva(${r.id})">
                                                Cancelar
                                            </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tabla;
        
    } catch (error) {
        console.error('Error cargando reservas:', error);
        container.innerHTML = '<p class="error-message">Error al cargar las reservas</p>';
    }
}

// Confirmar reserva
async function confirmarReserva(id) {
    const montoPagado = prompt('Ingrese el monto pagado como seña:');
    if (!montoPagado) return;
    
    const metodoPago = prompt('Método de pago (efectivo/tarjeta/transferencia):');
    if (!metodoPago) return;
    
    try {
        await ReservasAPI.confirmar(id, parseFloat(montoPagado), metodoPago);
        UIUtils.mostrarExito('Reserva confirmada exitosamente');
        cargarReservas();
    } catch (error) {
        UIUtils.mostrarError('Error al confirmar la reserva');
    }
}

// Completar reserva
async function completarReserva(id) {
    if (!await UIUtils.confirmar('¿Marcar esta reserva como completada?')) return;
    
    try {
        await ReservasAPI.completar(id);
        UIUtils.mostrarExito('Reserva completada');
        cargarReservas();
    } catch (error) {
        UIUtils.mostrarError('Error al completar la reserva');
    }
}

// Cancelar reserva
async function cancelarReserva(id) {
    const razon = prompt('Motivo de la cancelación (opcional):');
    
    if (!await UIUtils.confirmar('¿Confirmar la cancelación de esta reserva?')) return;
    
    try {
        await ReservasAPI.cancelar(id, razon);
        UIUtils.mostrarExito('Reserva cancelada');
        cargarReservas();
    } catch (error) {
        UIUtils.mostrarError('Error al cancelar la reserva');
    }
}

// CLIENTES
async function cargarClientes() {
    const container = document.getElementById('clientesTableContainer');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    try {
        const busqueda = document.getElementById('buscarCliente').value;
        const params = busqueda ? { buscar: busqueda } : {};
        
        const response = await ClientesAPI.obtenerTodos(params);
        
        if (response.data.length === 0) {
            container.innerHTML = '<p class="no-data">No se encontraron clientes</p>';
            return;
        }
        
        const tabla = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Tipo</th>
                            <th>Reservas</th>
                            <th>Descuento</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${response.data.map(c => `
                            <tr>
                                <td>${c.id}</td>
                                <td>${c.nombre} ${c.apellido}</td>
                                <td>${c.telefono}</td>
                                <td>${c.email || '-'}</td>
                                <td><span class="badge badge-info">${c.tipo_cliente}</span></td>
                                <td>${c.total_reservas}</td>
                                <td>${c.descuento_porcentaje}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tabla;
        
    } catch (error) {
        console.error('Error cargando clientes:', error);
        container.innerHTML = '<p class="error-message">Error al cargar los clientes</p>';
    }
}

// CANCHAS
async function cargarCanchas() {
    const container = document.getElementById('canchasAdminContainer');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    
    try {
        const response = await CanchasAPI.obtenerTodas();
        
        container.innerHTML = '';
        
        response.data.forEach(cancha => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="cancha-header">
                    <h3>${cancha.nombre}</h3>
                    <span class="cancha-badge ${cancha.estado}">${cancha.estado}</span>
                </div>
                <div class="card-body">
                    <p><strong>Capacidad:</strong> ${cancha.capacidad} jugadores</p>
                    <p><strong>Precio:</strong> ${MoneyUtils.formato(cancha.precio_por_hora)}/hora</p>
                    <p><strong>Descripción:</strong> ${cancha.descripcion || 'Sin descripción'}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-small btn-secondary" onclick="cambiarEstadoCancha(${cancha.id})">
                        Cambiar Estado
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error cargando canchas:', error);
        container.innerHTML = '<p class="error-message">Error al cargar las canchas</p>';
    }
}

// Cambiar estado de cancha
async function cambiarEstadoCancha(id) {
    const nuevoEstado = prompt('Nuevo estado (disponible/mantenimiento/fuera_servicio):');
    
    if (!nuevoEstado) return;
    
    if (!['disponible', 'mantenimiento', 'fuera_servicio'].includes(nuevoEstado)) {
        UIUtils.mostrarError('Estado inválido');
        return;
    }
    
    try {
        await CanchasAPI.cambiarEstado(id, nuevoEstado);
        UIUtils.mostrarExito('Estado actualizado');
        cargarCanchas();
    } catch (error) {
        UIUtils.mostrarError('Error al cambiar el estado');
    }
}

// Hacer funciones globales para poder llamarlas desde onclick
window.confirmarReserva = confirmarReserva;
window.completarReserva = completarReserva;
window.cancelarReserva = cancelarReserva;
window.cambiarEstadoCancha = cambiarEstadoCancha;