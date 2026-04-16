// js/mis-reservas.js - Lógica para mostrar las reservas del cliente logueado

document.addEventListener('DOMContentLoaded', () => {
    console.log('=== CARGANDO MIS RESERVAS ===');
    
    // Verificar autenticación
    if (!verificarAutenticacion()) {
        return;
    }
    
    // Cargar reservas
    cargarMisReservas();
});

async function cargarMisReservas() {
    const container = document.getElementById('reservasClienteContainer');
    const sesion = obtenerSesion();
    
    if (!sesion || !sesion.cliente_id) {
        container.innerHTML = '<div class="alert alert-error">Error al recuperar información del cliente.</div>';
        return;
    }

    try {
        // Obtener historial de reservas filtrado por cliente_id
        const response = await ReservasAPI.obtenerTodas({ cliente_id: sesion.cliente_id });
        
        if (response.success && response.data.length > 0) {
            mostrarTablaReservas(response.data);
        } else {
            container.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-secondary mb-3">Aún no tienes reservas realizadas.</p>
                    <a href="reservar.html" class="btn btn-primary">Hacer mi primera reserva</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error cargando reservas del cliente:', error);
        container.innerHTML = '<div class="alert alert-error">No pudimos cargar tus reservas. Por favor intenta más tarde.</div>';
    }
}

function mostrarTablaReservas(reservas) {
    const container = document.getElementById('reservasClienteContainer');
    
    const tabla = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Horario</th>
                        <th>Cancha</th>
                        <th>Estado</th>
                        <th>Monto Total</th>
                        <th>Seña Pagada</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservas.map(r => {
                        const esCancelable = ['pendiente', 'confirmada'].includes(r.estado);
                        return `
                            <tr>
                                <td>${DateUtils.formatoLegible(r.fecha)}</td>
                                <td>${r.hora_inicio} - ${r.hora_fin}</td>
                                <td>${r.cancha_nombre || 'Cancha'}</td>
                                <td>${EstadoUtils.obtenerBadge(r.estado)}</td>
                                <td>${MoneyUtils.formato(r.precio_total)}</td>
                                <td>${MoneyUtils.formato(r.sena_pagada || 0)}</td>
                                <td>
                                    ${esCancelable ? 
                                        `<button onclick="solicitarCancelacion(${r.id})" class="btn btn-small btn-outline text-danger">Cancelar</button>` 
                                        : '-'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tabla;
}

async function solicitarCancelacion(id) {
    if (confirm('¿Estás seguro que deseas cancelar esta reserva?')) {
        try {
            const response = await ReservasAPI.cancelar(id, 'Cancelado por el cliente desde el portal');
            if (response.success) {
                UIUtils.mostrarExito('Reserva cancelada correctamente');
                cargarMisReservas();
            } else {
                UIUtils.mostrarError('No se pudo cancelar la reserva.');
            }
        } catch (error) {
            UIUtils.mostrarError('Error al procesar la cancelación.');
        }
    }
}

// Global para los botones
window.solicitarCancelacion = solicitarCancelacion;
