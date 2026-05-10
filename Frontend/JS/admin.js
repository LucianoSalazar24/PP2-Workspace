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

    // Configurar pestañas internas (para Reservas)
    const tabBotones = document.querySelectorAll('.tab-btn');
    tabBotones.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            const parentSection = btn.closest('.admin-section');

            // Actualizar botones de pestaña
            parentSection.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Actualizar paneles
            parentSection.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');

            // Cargar datos específicos del tab
            if (tabId === 'futuras-reservas') {
                cargarReservasFuturas();
            } else if (tabId === 'todas-reservas') {
                cargarReservas();
            }
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
    switch (seccion) {
        case 'dashboard':
            cargarDashboard();
            break;
        case 'reservas':
            // Por defecto cargar la pestaña activa de reservas
            const activeTab = document.querySelector('#reservas .tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'futuras-reservas') {
                cargarReservasFuturas();
            } else {
                cargarReservas();
            }
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

                // Parseo seguro evitando desfase de zona horaria
                const [y, m, d] = r.fecha.split('-').map(Number);
                const mesReserva = m - 1; // getMonth() es 0-11
                const anioReserva = y;

                return mesReserva === mesActual &&
                    anioReserva === anioActual &&
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

        // Mostrar tabla de reservas de hoy (filtrando las ocultas)
        const reservasVisibles = reservasHoy.data.filter(r => !r.observaciones || !r.observaciones.includes('[OCULTO_DASHBOARD]'));
        mostrarReservasHoy(reservasVisibles);

        // Cargar alertas de vencimiento de seña
        await cargarAlertasVencimiento();

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

    // Ordenar por horario para hoy
    reservas.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

    const tabla = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Horario</th>
                        <th>Cancha</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Pago</th>
                        <th>Precio</th>
                        <th class="text-center">Saldo Pendiente</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservas.map(r => `
                        <tr>
                            <td>${(r.hora_inicio || '').substring(0, 5)} - ${(r.hora_fin || '').substring(0, 5)}</td>
                            <td>${r.cancha_nombre}</td>
                            <td>${r.cliente_nombre} ${r.cliente_apellido}</td>
                            <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                            <td>
                                <div style="font-size: 0.85rem;">
                                    <strong>${r.tipo_pago || '-'}</strong><br>
                                    <small>${r.metodo_pago || '-'}</small>
                                </div>
                            </td>
                            <td>${MoneyUtils.formato(r.precio_total)}</td>
                            <td class="text-center">
                                ${r.pago_completo ? 
                                    `<div class="saldo-badge pagado">
                                        <span class="icon">✅</span>
                                        <span class="amount">PAGADO</span>
                                    </div>` : 
                                    `<div class="saldo-badge pendiente">
                                        <span class="icon">⚠️</span>
                                        <span class="amount">${MoneyUtils.formato(Math.max(0, r.precio_total - r.sena_pagada))}</span>
                                    </div>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tabla;
}

// Cargar y mostrar alertas de vencimiento (seña en efectivo 48hs)
async function cargarAlertasVencimiento() {
    try {
        const container = document.getElementById('alertasDashboardContainer');
        if (!container) return; // Si no existe el contenedor en el HTML, no hacemos nada

        // Procesar vencimientos automáticamente para asegurar limpieza (simula el cron si falla)
        try {
            await request(CONFIG.getURL(`${CONFIG.ENDPOINTS.RESERVAS}/procesar-vencimientos`), { method: 'POST' });
        } catch (e) {
            console.warn('Error al ejecutar procesar-vencimientos desde frontend', e);
        }

        const response = await ReservasAPI.obtenerAlertas();

        if (response.success && response.data.length > 0) {
            let html = `
                <div class="alerta-vencimiento" style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px;">
                    <h3 style="color: #b91c1c; margin-top: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span>⚠️</span> Atención: Reservas próximas a expirar por falta de seña
                    </h3>
                    <p style="color: #7f1d1d; margin-bottom: 1rem; font-size: 0.9rem;">
                        Las siguientes reservas serán canceladas automáticamente cuando falten menos de 48hs para el turno.
                    </p>
                    <ul style="list-style: none; padding: 0; margin: 0;">
            `;

            response.data.forEach(alerta => {
                html += `
                    <li style="background: white; padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; border: 1px solid #fca5a5; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${DateUtils.formatoLegible(alerta.fecha)} ${alerta.hora_inicio}</strong> - 
                            ${alerta.cliente} (${alerta.telefono || 'Sin tel.'})
                            <div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;">
                                Faltan ${alerta.horas_restantes} horas • Seña: ${MoneyUtils.formato(alerta.monto_sena)}
                            </div>
                        </div>
                        <button class="btn btn-small btn-primary" onclick="confirmarReserva(${alerta.id}, ${alerta.monto_sena}, ${alerta.monto_sena * (10 / 3)})" style="background-color: #ef4444; border: none;">
                            Confirmar Pago
                        </button>
                    </li>
                `;
            });

            html += `</ul></div>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = ''; // Sin alertas
        }
    } catch (error) {
        console.error('Error cargando alertas:', error);
    }
}

// RESERVAS
async function cargarReservas() {
    const container = document.getElementById('reservasTableContainer');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    try {
        const fecha = document.getElementById('filtroFecha').value;
        const estado = document.getElementById('filtroEstado').value;
        const buscar = document.getElementById('filtroCliente').value;

        const params = {};
        if (fecha) params.fecha = fecha;
        if (estado) params.estado = estado;
        if (buscar) params.buscar = buscar;

        const response = await ReservasAPI.obtenerTodas(params);

        // Filtrar las reservas que el administrador decidió ocultar
        let reservasVisibles = response.data.filter(r => !r.observaciones || !r.observaciones.includes('[OCULTO_DASHBOARD]'));

        console.log('ADMIN: Reservas antes de ordenar:', reservasVisibles.map(r => `${r.fecha} ${r.hora_inicio}`));

        // Asegurar orden por fecha descendente (lo más reciente arriba)
        reservasVisibles.sort((a, b) => {
            const f1 = `${a.fecha}T${a.hora_inicio}`;
            const f2 = `${b.fecha}T${b.hora_inicio}`;
            return f2.localeCompare(f1);
        });

        console.log('ADMIN: Reservas después de ordenar:', reservasVisibles.map(r => `${r.fecha} ${r.hora_inicio}`));

        if (reservasVisibles.length === 0) {
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
                            <th>Pago</th>
                            <th>Precio</th>
                            <th class="text-center">Saldo Pendiente</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reservasVisibles.map(r => `
                            <tr>
                                <td>${r.id}</td>
                                <td>${DateUtils.formatoLegible(r.fecha)}</td>
                                <td>${r.hora_inicio} - ${r.hora_fin}</td>
                                <td>${r.cancha_nombre}</td>
                                <td>${r.cliente_nombre} ${r.cliente_apellido}<br>
                                    <small>${r.cliente_telefono}</small>
                                </td>
                                <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                                <td>
                                    <div style="font-size: 0.85rem;">
                                        <strong>${r.tipo_pago || '-'}</strong><br>
                                        <small>${r.metodo_pago || '-'}</small>
                                    </div>
                                </td>
                                <td>${MoneyUtils.formato(r.precio_total)}</td>
                                <td class="text-center">
                                    ${r.pago_completo ? 
                                        `<div class="saldo-badge pagado">
                                            <span class="icon">✅</span>
                                            <span class="amount">PAGADO</span>
                                        </div>` : 
                                        `<div class="saldo-badge pendiente">
                                            <span class="icon">⚠️</span>
                                            <span class="amount">${MoneyUtils.formato(Math.max(0, r.precio_total - r.sena_pagada))}</span>
                                        </div>`}
                                </td>
                                <td class="text-center">
                                    <div class="table-actions" style="justify-content: center;">
                                        ${['pendiente', 'confirmada'].includes(r.estado) && !r.pago_completo ?
                                            `<button class="btn btn-small btn-primary" title="Registrar Pago Recibido" onclick="confirmarReserva(${r.id}, ${r.sena_requerida}, ${r.precio_total})">
                                                Pago Recibido
                                            </button>` : ''}
                                        ${['pendiente', 'confirmada'].includes(r.estado) && !r.pago_completo ?
                                            `<button class="btn btn-small btn-danger" title="Cancelar con Notificación" onclick="cancelarReserva(${r.id})">
                                                Cancelar Reserva
                                            </button>` : ''}
                                        ${r.estado === 'completada' && r.pago_completo ? 
                                            `<button class="btn btn-small btn-outline" title="Quitar de esta vista (Dashboard)" onclick="ocultarReserva(${r.id})">
                                                🧹
                                            </button>` : ''}
                                        <button class="btn btn-small btn-danger" title="Eliminar definitivamente de la Base de Datos" onclick="eliminarReservaPermanente(${r.id})">
                                            🗑️
                                        </button>
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

// RESERVAS FUTURAS
async function cargarReservasFuturas() {
    const container = document.getElementById('reservasFuturasContainer');
    container.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';

    try {
        const response = await ReservasAPI.obtenerTodas();
        const hoy = DateUtils.hoy();

        // Filtrar reservas que sean posteriores a hoy y que no estén ocultas ni canceladas
        const futuras = response.data.filter(r => {
            const esFutura = r.fecha > hoy;
            const noOculta = !r.observaciones || !r.observaciones.includes('[OCULTO_DASHBOARD]');
            const noCancelada = r.estado !== 'cancelada';
            return esFutura && noOculta && noCancelada;
        });

        // Ordenar por fecha descendente (la más reciente arriba)
        futuras.sort((a, b) => {
            if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
            return b.hora_inicio.localeCompare(a.hora_inicio);
        });

        if (futuras.length === 0) {
            container.innerHTML = '<p class="no-data">No hay reservas programadas para el futuro</p>';
            return;
        }

        const tabla = `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Horario</th>
                            <th>Cancha</th>
                            <th>Cliente</th>
                            <th>Estado</th>
                            <th>Seña Pagada</th>
                            <th class="text-center">Saldo Pendiente</th>
                            <th class="text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${futuras.map(r => `
                            <tr>
                                <td><strong>${DateUtils.formatoLegible(r.fecha)}</strong></td>
                                <td>${(r.hora_inicio || '').substring(0, 5)} - ${(r.hora_fin || '').substring(0, 5)}</td>
                                <td>${r.cancha_nombre}</td>
                                <td>${r.cliente_nombre} ${r.cliente_apellido}</td>
                                <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                                <td>${r.sena_pagada > 0 ? '✅ SI' : '❌ NO'}</td>
                                <td class="text-center">
                                    ${r.pago_completo ? 
                                        `<div class="saldo-badge pagado">
                                            <span class="icon">✅</span>
                                            <span class="amount">PAGADO</span>
                                        </div>` : 
                                        `<div class="saldo-badge pendiente">
                                            <span class="icon">⚠️</span>
                                            <span class="amount">${MoneyUtils.formato(Math.max(0, r.precio_total - r.sena_pagada))}</span>
                                        </div>`}
                                </td>
                                <td class="text-center">
                                    <div class="table-actions" style="justify-content: center;">
                                        ${!r.pago_completo ? 
                                            `<button class="btn btn-small btn-primary" onclick="confirmarReserva(${r.id}, ${r.sena_requerida}, ${r.precio_total})">
                                                Pago Recibido
                                            </button>` : ''}
                                        ${!r.pago_completo ? 
                                            `<button class="btn btn-small btn-danger" onclick="cancelarReserva(${r.id})">
                                                Cancelar Reserva
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
        console.error('Error cargando reservas futuras:', error);
        container.innerHTML = '<p class="error-message">Error al cargar las reservas futuras</p>';
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
    if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
            title: 'Cancelar Reserva',
            input: 'text',
            inputLabel: 'Motivo de la cancelación (opcional):',
            inputPlaceholder: 'Ingresa el motivo aquí...',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Confirmar Cancelación',
            cancelButtonText: 'Atrás'
        });

        if (result.isConfirmed) {
            try {
                const motivo = result.value || 'Cancelación por parte de la administración';
                const mensajeNotificacion = `Hola! Lamentamos informarte que hemos tenido que cancelar tu turno por el siguiente motivo: ${motivo}. Por favor, contáctanos para coordinar la devolución de tu pago por el mismo medio que realizaste la transacción.`;

                await ReservasAPI.cancelar(id, mensajeNotificacion);
                UIUtils.mostrarExito('Reserva cancelada y notificación registrada');
                cargarReservas();
                cargarDashboard();
            } catch (error) {
                UIUtils.mostrarError('Error al cancelar la reserva');
            }
        }
    } else {
        const razon = prompt('Motivo de la cancelación (opcional):');
        if (!await UIUtils.confirmar('¿Confirmar la cancelación de esta reserva?')) return;

        try {
            const mensajeNotificacion = `Cancelación administrativa: ${razon}. Devolución pendiente.`;
            await ReservasAPI.cancelar(id, mensajeNotificacion);
            UIUtils.mostrarExito('Reserva cancelada');
            cargarReservas();
            cargarDashboard();
        } catch (error) {
            UIUtils.mostrarError('Error al cancelar la reserva');
        }
    }
}

// Ocultar reserva del dashboard
async function ocultarReserva(id) {
    if (!await UIUtils.confirmar('¿Quitar esta reserva del dashboard? (Se mantendrá en la base de datos)')) return;

    try {
        await ReservasAPI.ocultar(id);
        UIUtils.mostrarExito('Reserva ocultada del dashboard');
        cargarReservas();
        cargarDashboard();
    } catch (error) {
        UIUtils.mostrarError('Error al ocultar la reserva');
    }
}

// Eliminar reserva permanentemente de la base de datos
async function eliminarReservaPermanente(id) {
    const result = await Swal.fire({
        title: '¿Eliminar definitivamente?',
        text: "Esta acción borrará la reserva y todos sus pagos de la base de datos de forma permanente. ¡No podrás deshacer esto!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, borrar de la BD',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await ReservasAPI.eliminar(id);
            UIUtils.mostrarExito('Reserva eliminada definitivamente');
            cargarReservas();
            cargarDashboard();
            // Si la sección de futuras está activa, recargarla también
            const btnFuturas = document.querySelector('.admin-nav-btn[data-section="reservas-futuras"]');
            if (btnFuturas && btnFuturas.classList.contains('active')) {
                cargarReservasFuturas();
            }
        } catch (error) {
            UIUtils.mostrarError('Error al eliminar la reserva: ' + error.message);
        }
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
                            <th class="text-center">Acciones</th>
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
                                <td class="text-center">
                                    <button class="btn btn-small btn-primary" onclick='mostrarModalEditarCliente(${JSON.stringify(c)})'>
                                        ✏️ Editar
                                    </button>
                                </td>
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
                <div class="card-footer" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-small btn-secondary" onclick="cambiarEstadoCancha(${cancha.id})">
                        🚥 Estado
                    </button>
                    <button class="btn btn-small btn-primary" onclick='mostrarModalEditarCancha(${JSON.stringify(cancha)})'>
                        ✏️ Editar Datos
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
window.ocultarReserva = ocultarReserva;
window.eliminarReservaPermanente = eliminarReservaPermanente;

/** FUNCIONES DE EDICIÓN DE CANCHAS **/
async function mostrarModalEditarCancha(cancha) {
    const modalHTML = `
        <div id="modalEditarCancha" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: var(--primary-color);">✏️ Editar Cancha: ${cancha.nombre}</h3>
                
                <div class="form-group">
                    <label class="form-label">Nombre de la Cancha:</label>
                    <input type="text" id="editCanchaNombre" class="form-input" value="${cancha.nombre}">
                </div>

                <div class="form-group">
                    <label class="form-label">Capacidad (Jugadores):</label>
                    <input type="number" id="editCanchaCapacidad" class="form-input" value="${cancha.capacidad}">
                </div>

                <div class="form-group">
                    <label class="form-label">Precio por Hora ($):</label>
                    <input type="number" id="editCanchaPrecio" class="form-input" value="${cancha.precio_por_hora}">
                </div>

                <div class="form-group">
                    <label class="form-label">Descripción:</label>
                    <textarea id="editCanchaDesc" class="form-input" style="min-height: 80px;">${cancha.descripcion || ""}</textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditarCancha').remove()">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="guardarEdicionCancha(${cancha.id})">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

async function guardarEdicionCancha(id) {
    const data = {
        nombre: document.getElementById("editCanchaNombre").value,
        capacidad: parseInt(document.getElementById("editCanchaCapacidad").value),
        precio_por_hora: parseFloat(document.getElementById("editCanchaPrecio").value),
        descripcion: document.getElementById("editCanchaDesc").value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/canchas/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            UIUtils.mostrarExito("Cancha actualizada correctamente");
            document.getElementById("modalEditarCancha").remove();
            cargarCanchas();
        } else {
            UIUtils.mostrarError(result.message || "Error al actualizar");
        }
    } catch (error) {
        console.error("Error:", error);
        UIUtils.mostrarError("Error de conexión");
    }
}

/** FUNCIONES DE EDICIÓN DE CLIENTES **/
async function mostrarModalEditarCliente(cliente) {
    const modalHTML = `
        <div id="modalEditarCliente" class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: var(--primary-color);">✏️ Editar Cliente: ${cliente.nombre} ${cliente.apellido}</h3>
                
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Nombre:</label>
                        <input type="text" id="editClienteNombre" class="form-input" value="${cliente.nombre}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Apellido:</label>
                        <input type="text" id="editClienteApellido" class="form-input" value="${cliente.apellido}">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Teléfono:</label>
                    <input type="text" id="editClienteTel" class="form-input" value="${cliente.telefono}">
                </div>

                <div class="form-group">
                    <label class="form-label">Email:</label>
                    <input type="email" id="editClienteEmail" class="form-input" value="${cliente.email || ""}">
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditarCliente').remove()">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="guardarEdicionCliente(${cliente.id})">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

async function guardarEdicionCliente(id) {
    const data = {
        nombre: document.getElementById("editClienteNombre").value,
        apellido: document.getElementById("editClienteApellido").value,
        telefono: document.getElementById("editClienteTel").value,
        email: document.getElementById("editClienteEmail").value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/clientes/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            UIUtils.mostrarExito("Cliente actualizado correctamente");
            document.getElementById("modalEditarCliente").remove();
            cargarClientes();
        } else {
            UIUtils.mostrarError(result.message || "Error al actualizar");
        }
    } catch (error) {
        console.error("Error:", error);
        UIUtils.mostrarError("Error de conexión");
    }
}

window.mostrarModalEditarCancha = mostrarModalEditarCancha;
window.guardarEdicionCancha = guardarEdicionCancha;
window.mostrarModalEditarCliente = mostrarModalEditarCliente;
window.guardarEdicionCliente = guardarEdicionCliente;