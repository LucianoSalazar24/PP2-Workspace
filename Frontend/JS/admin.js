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
        
        // Calcular ingresos del mes (con validación de datos)
        const mesActual = new Date().getMonth();
        const anioActual = new Date().getFullYear();
        
        const ingresosMes = todasReservas.data
            .filter(r => {
                if (!r.fecha || !r.estado) return false;
                const fechaReserva = new Date(r.fecha);
                return fechaReserva.getMonth() === mesActual && 
                       fechaReserva.getFullYear() === anioActual &&
                       r.estado === 'completada';
            })
            .reduce((sum, r) => {
                const precio = parseFloat(r.precio_total) || 0;
                return sum + precio;
            }, 0);
        
        document.getElementById('statIngresosMes').textContent = MoneyUtils.formato(ingresosMes);
        
        // Cargar clientes
        const clientes = await ClientesAPI.obtenerTodos();
        document.getElementById('statClientes').textContent = clientes.total || clientes.data.length;
        
        // Calcular ocupación de hoy
        const ocupacion = reservasHoy.data.length > 0 ? 
            Math.round((reservasHoy.data.length / 10) * 100) : 0;
        document.getElementById('statOcupacion').textContent = `${ocupacion}%`;
        
        // Mostrar tabla de reservas de hoy
        mostrarReservasHoy(reservasHoy.data);
        
        console.log('Dashboard cargado:', {
            reservasHoy: reservasHoy.data.length,
            ingresosMes,
            totalClientes: clientes.total || clientes.data.length
        });
        
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
                                            `<button class="btn btn-small btn-primary" onclick="confirmarReserva(${r.id}, ${r.sena_requerida}, ${r.precio_total})">
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

// Modal mejorado para confirmar reserva
async function confirmarReserva(id, senaRequerida, precioTotal) {
    const modalHTML = `
        <div id="modalConfirmarPago" class="modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div class="modal-content" style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <h3 style="margin-top: 0; color: var(--primary-color);">💰 Confirmar Pago</h3>
                
                <div style="background: #f0f7ff; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="margin: 0.5rem 0;"><strong>Precio Total:</strong> ${MoneyUtils.formato(precioTotal)}</p>
                    <p style="margin: 0.5rem 0;"><strong>Seña Requerida (30%):</strong> ${MoneyUtils.formato(senaRequerida)}</p>
                </div>

                <div class="form-group">
                    <label class="form-label">Monto a cobrar:</label>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <button type="button" class="btn btn-outline" onclick="establecerMonto(${senaRequerida}, 'inputMonto')">
                            Seña ${MoneyUtils.formato(senaRequerida)}
                        </button>
                        <button type="button" class="btn btn-outline" onclick="establecerMonto(${precioTotal}, 'inputMonto')">
                            Total ${MoneyUtils.formato(precioTotal)}
                        </button>
                    </div>
                    <input 
                        type="number" 
                        id="inputMonto" 
                        class="form-input" 
                        placeholder="Ej: 6000"
                        step="100"
                        min="0"
                        style="font-size: 1.2rem; font-weight: bold;"
                    >
                    <small style="color: #666;">Solo ingresa el número sin puntos ni comas (ej: 6000)</small>
                </div>

                <div class="form-group" style="margin-top: 1.5rem;">
                    <label class="form-label">Método de pago:</label>
                    <select id="selectMetodoPago" class="form-select">
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                        <option value="transferencia">🏦 Transferencia</option>
                    </select>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalPago()">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="procesarConfirmacion(${id}, ${senaRequerida})">
                        Confirmar Pago
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('inputMonto').focus();
}

// Establecer monto con botón rápido
function establecerMonto(monto, inputId) {
    document.getElementById(inputId).value = Math.round(monto);
}

// Procesar confirmación
async function procesarConfirmacion(id, senaRequerida) {
    const monto = parseFloat(document.getElementById('inputMonto').value);
    const metodoPago = document.getElementById('selectMetodoPago').value;
    
    if (!monto || monto <= 0) {
        UIUtils.mostrarError('Ingresa un monto válido');
        return;
    }
    
    if (monto < senaRequerida) {
        if (!confirm(`El monto es menor a la seña requerida (${MoneyUtils.formato(senaRequerida)}). ¿Continuar de todos modos?`)) {
            return;
        }
    }
    
    try {
        cerrarModalPago();
        await ReservasAPI.confirmar(id, monto, metodoPago);
        UIUtils.mostrarExito('Reserva confirmada exitosamente');
        cargarReservas();
    } catch (error) {
        UIUtils.mostrarError('Error al confirmar la reserva');
    }
}

// Cerrar modal
function cerrarModalPago() {
    const modal = document.getElementById('modalConfirmarPago');
    if (modal) modal.remove();
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
            const estadoInfo = obtenerInfoEstado(cancha.estado);
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="cancha-header">
                    <h3>${cancha.nombre}</h3>
                    <span class="cancha-badge ${estadoInfo.clase}">${estadoInfo.texto}</span>
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

// Obtener info de estado con textos profesionales
function obtenerInfoEstado(estado) {
    const estados = {
        'disponible': { texto: '✅ Disponible', clase: 'disponible' },
        'reservada': { texto: '⌛ Reservada', clase: 'reservada' },
        'fuera_servicio': { texto: '⛔ Fuera de Servicio', clase: 'fuera_servicio' }
    };
    return estados[estado] || { texto: estado, clase: '' };
}

// Modal mejorado para cambiar estado de cancha
async function cambiarEstadoCancha(id) {
    const modalHTML = `
        <div id="modalEstadoCancha" class="modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        ">
            <div class="modal-content" style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            ">
                <h3 style="margin-top: 0; color: var(--primary-color);">Cambiar Estado de Cancha</h3>
                
                <div class="form-group">
                    <label class="form-label">Selecciona el nuevo estado:</label>
                    <select id="selectEstadoCancha" class="form-select" style="font-size: 1.1rem;">
                        <option value="disponible">✅ Disponible</option>
                        <option value="reservada">⌛ Reservada</option>
                        <option value="fuera_servicio">⛔ Fuera de Servicio</option>
                    </select>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" onclick="cerrarModalEstado()">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="procesarCambioEstado(${id})">
                        Cambiar Estado
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Procesar cambio de estado
async function procesarCambioEstado(id) {
    const nuevoEstado = document.getElementById('selectEstadoCancha').value;
    
    try {
        cerrarModalEstado();
        await CanchasAPI.cambiarEstado(id, nuevoEstado);
        UIUtils.mostrarExito('Estado actualizado correctamente');
        cargarCanchas();
    } catch (error) {
        UIUtils.mostrarError('Error al cambiar el estado');
    }
}

// Cerrar modal de estado
function cerrarModalEstado() {
    const modal = document.getElementById('modalEstadoCancha');
    if (modal) modal.remove();
}

// Hacer funciones globales
window.confirmarReserva = confirmarReserva;
window.completarReserva = completarReserva;
window.cancelarReserva = cancelarReserva;
window.cambiarEstadoCancha = cambiarEstadoCancha;
window.establecerMonto = establecerMonto;
window.procesarConfirmacion = procesarConfirmacion;
window.cerrarModalPago = cerrarModalPago;
window.procesarCambioEstado = procesarCambioEstado;
window.cerrarModalEstado = cerrarModalEstado;