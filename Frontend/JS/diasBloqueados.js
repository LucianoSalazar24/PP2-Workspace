// ============================================
// GESTIÓN DE DÍAS BLOQUEADOS - FRONTEND
// ============================================

// Estado global
const state = {
    diasBloqueados: [],
    canchas: [],
    filtros: {
        estado: 'futuros',
        fechaDesde: null,
        fechaHasta: null
    },
    diaBloqueadoEnEdicion: null,
    usuario: null,
    esAdmin: false
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    inicializarEventListeners();
    cargarCanchas();
    cargarDiasBloqueados();
});

// ============================================
// AUTENTICACIÓN Y PERMISOS
// ============================================

function verificarAutenticacion() {
    // Obtener datos del usuario desde localStorage
    const sesionStr = localStorage.getItem('sesion');

    if (sesionStr) {
        try {
            state.usuario = JSON.parse(sesionStr);
            state.esAdmin = state.usuario.rol === 'admin';

            // Mostrar u ocultar controles según el rol
            if (state.esAdmin) {
                document.getElementById('btnAbrirModal').style.display = 'inline-block';
                document.getElementById('userRoleLabel').textContent = `👤 Admin: ${state.usuario.nombre}`;
                document.getElementById('userRoleLabel').style.display = 'inline-block';
            } else {
                document.getElementById('btnAbrirModal').style.display = 'none';
                document.getElementById('columnAcciones').style.display = 'none';
                document.getElementById('userRoleLabel').textContent = `👤 ${state.usuario.nombre}`;
                document.getElementById('userRoleLabel').style.display = 'inline-block';
            }
        } catch (e) {
            console.error('Error al parsear sesión:', e);
        }
    } else {
        // Usuario no autenticado: solo lectura
        document.getElementById('btnAbrirModal').style.display = 'none';
        document.getElementById('columnAcciones').style.display = 'none';
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function inicializarEventListeners() {
    // Botones principales
    document.getElementById('btnAbrirModal')?.addEventListener('click', abrirModalAgregar);
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

    // Formulario
    document.getElementById('formDiaBloqueado').addEventListener('submit', handleSubmitFormulario);

    // Filtros
    document.getElementById('btnAplicarFiltros').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Motivo personalizado
    document.getElementById('motivo').addEventListener('change', handleMotivoChange);

    // Modal confirmación
    document.getElementById('btnCancelarEliminacion').addEventListener('click', cerrarModalConfirmacion);

    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('modalDiaBloqueado');
        const modalConfirmacion = document.getElementById('modalConfirmacion');
        if (e.target === modal) cerrarModal();
        if (e.target === modalConfirmacion) cerrarModalConfirmacion();
    });
}

function handleMotivoChange(e) {
    const grupoPersonalizado = document.getElementById('grupoMotivoPersonalizado');
    const motivoPersonalizado = document.getElementById('motivoPersonalizado');

    if (e.target.value === 'Otro') {
        grupoPersonalizado.style.display = 'block';
        motivoPersonalizado.required = true;
    } else {
        grupoPersonalizado.style.display = 'none';
        motivoPersonalizado.required = false;
        motivoPersonalizado.value = '';
    }
}

// ============================================
// CARGAR CANCHAS
// ============================================

async function cargarCanchas() {
    try {
        const response = await fetch(`${API_URL}/canchas`);
        if (!response.ok) throw new Error('Error al cargar canchas');

        const data = await response.json();
        state.canchas = data.data || [];

        // Llenar selector de canchas
        const selector = document.getElementById('cancha_id');
        selector.innerHTML = '<option value="">Todas las canchas</option>';

        state.canchas.forEach(cancha => {
            const option = document.createElement('option');
            option.value = cancha.id;
            option.textContent = cancha.nombre;
            selector.appendChild(option);
        });

    } catch (error) {
        console.error('Error cargando canchas:', error);
    }
}

// ============================================
// OPERACIONES CRUD
// ============================================

async function cargarDiasBloqueados() {
    mostrarLoading(true);

    try {
        const { estado, fechaDesde, fechaHasta } = state.filtros;

        // Construir query params
        const params = new URLSearchParams();
        if (estado === 'futuros') params.append('futuro_solo', 'true');
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);

        const url = `${API_URL}/dias-bloqueados?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Error al cargar días bloqueados');

        const data = await response.json();
        state.diasBloqueados = data.data || [];

        renderizarTabla();
        actualizarEstadisticas();

    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar días bloqueados', 'error');
    } finally {
        mostrarLoading(false);
    }
}

async function crearDiaBloqueado(datos) {
    try {
        const response = await fetch(`${API_URL}/dias-bloqueados`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.usuario?.access_token || ''}`
            },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al crear día bloqueado');
        }

        mostrarToast('Día bloqueado creado exitosamente', 'success');
        cerrarModal();
        cargarDiasBloqueados();

    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message, 'error');
    }
}

async function actualizarDiaBloqueado(id, datos) {
    try {
        const response = await fetch(`${API_URL}/dias-bloqueados/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.usuario?.access_token || ''}`
            },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al actualizar día bloqueado');
        }

        mostrarToast('Día bloqueado actualizado exitosamente', 'success');
        cerrarModal();
        cargarDiasBloqueados();

    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message, 'error');
    }
}

async function eliminarDiaBloqueado(id) {
    try {
        const response = await fetch(`${API_URL}/dias-bloqueados/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${state.usuario?.access_token || ''}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error al eliminar día bloqueado');
        }

        mostrarToast('Día bloqueado eliminado exitosamente', 'success');
        cerrarModalConfirmacion();
        cargarDiasBloqueados();

    } catch (error) {
        console.error('Error:', error);
        mostrarToast(error.message, 'error');
    }
}

// ============================================
// RENDERIZADO
// ============================================

function renderizarTabla() {
    const tbody = document.getElementById('tablaDiasBloqueados');
    const mensajeVacio = document.getElementById('mensajeVacio');
    const tablaContainer = document.getElementById('tablaContainer');

    if (state.diasBloqueados.length === 0) {
        tablaContainer.style.display = 'none';
        mensajeVacio.style.display = 'flex';
        return;
    }

    tablaContainer.style.display = 'block';
    mensajeVacio.style.display = 'none';

    tbody.innerHTML = state.diasBloqueados.map(dia => {
        const fecha = new Date(dia.fecha + 'T00:00:00');
        const nombreDia = formatearDiaSemana(fecha);
        const fechaFormateada = formatearFecha(fecha);
        const esProximo = fecha >= new Date();
        const estadoClase = esProximo ? 'badge-proxima' : 'badge-pasada';
        const estadoTexto = esProximo ? 'Próxima' : 'Pasada';

        // Determinar cancha afectada
        const canchaTexto = dia.cancha_id ?
            `<span class="badge badge-cancha">${dia.cancha_nombre || 'Cancha #' + dia.cancha_id}</span>` :
            `<span class="badge badge-todas">Todas las canchas</span>`;

        // Botones de acciones solo para admin
        const botonesAcciones = state.esAdmin ? `
            <button class="btn-icon btn-edit" onclick="abrirModalEditar(${dia.id})" title="Editar">
                ✏️
            </button>
            <button class="btn-icon btn-delete" onclick="confirmarEliminacion(${dia.id}, '${fechaFormateada}', '${dia.motivo}')" title="Eliminar">
                🗑️
            </button>
        ` : '-';

        return `
            <tr class="${esProximo ? 'row-proxima' : 'row-pasada'}">
                <td><strong>${fechaFormateada}</strong></td>
                <td>${nombreDia}</td>
                <td>${canchaTexto}</td>
                <td><span class="badge badge-motivo">${dia.motivo}</span></td>
                <td>${dia.descripcion || '-'}</td>
                <td><span class="badge ${estadoClase}">${estadoTexto}</span></td>
                <td class="acciones-column">
                    ${botonesAcciones}
                </td>
            </tr>
        `;
    }).join('');

    // Ocultar columna de acciones si no es admin
    if (!state.esAdmin) {
        document.querySelectorAll('.acciones-column').forEach(col => {
            col.style.display = 'none';
        });
    }
}

function actualizarEstadisticas() {
    const total = state.diasBloqueados.length;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const proximos = state.diasBloqueados.filter(dia => {
        const fecha = new Date(dia.fecha + 'T00:00:00');
        return fecha >= hoy;
    }).length;

    const esteMes = state.diasBloqueados.filter(dia => {
        const fecha = new Date(dia.fecha + 'T00:00:00');
        return fecha.getMonth() === hoy.getMonth() &&
               fecha.getFullYear() === hoy.getFullYear();
    }).length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statProximos').textContent = proximos;
    document.getElementById('statEsteMes').textContent = esteMes;
    document.getElementById('badgeTotal').textContent = `${total} registro${total !== 1 ? 's' : ''}`;
}

// ============================================
// MODAL
// ============================================

function abrirModalAgregar() {
    if (!state.esAdmin) {
        mostrarToast('Solo los administradores pueden agregar días bloqueados', 'error');
        return;
    }

    state.diaBloqueadoEnEdicion = null;
    document.getElementById('modalTitulo').textContent = 'Agregar Día Bloqueado';
    document.getElementById('btnGuardar').textContent = 'Guardar Día Bloqueado';
    document.getElementById('formDiaBloqueado').reset();
    document.getElementById('diaBloqueadoId').value = '';
    document.getElementById('grupoMotivoPersonalizado').style.display = 'none';
    document.getElementById('modalDiaBloqueado').style.display = 'flex';
}

async function abrirModalEditar(id) {
    if (!state.esAdmin) {
        mostrarToast('Solo los administradores pueden editar días bloqueados', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/dias-bloqueados/${id}`);
        const data = await response.json();

        if (!response.ok) throw new Error('Error al cargar día bloqueado');

        const dia = data.data;
        state.diaBloqueadoEnEdicion = dia;

        document.getElementById('modalTitulo').textContent = 'Editar Día Bloqueado';
        document.getElementById('btnGuardar').textContent = 'Guardar Cambios';
        document.getElementById('diaBloqueadoId').value = dia.id;
        document.getElementById('fecha').value = dia.fecha;
        document.getElementById('motivo').value = dia.motivo;
        document.getElementById('descripcion').value = dia.descripcion || '';
        document.getElementById('cancha_id').value = dia.cancha_id || '';

        // Si el motivo no está en las opciones, usar "Otro"
        const motivoSelect = document.getElementById('motivo');
        const opciones = Array.from(motivoSelect.options).map(opt => opt.value);
        if (!opciones.includes(dia.motivo)) {
            motivoSelect.value = 'Otro';
            document.getElementById('motivoPersonalizado').value = dia.motivo;
            document.getElementById('grupoMotivoPersonalizado').style.display = 'block';
        }

        document.getElementById('modalDiaBloqueado').style.display = 'flex';

    } catch (error) {
        console.error('Error:', error);
        mostrarToast('Error al cargar día bloqueado', 'error');
    }
}

function cerrarModal() {
    document.getElementById('modalDiaBloqueado').style.display = 'none';
    document.getElementById('formDiaBloqueado').reset();
    state.diaBloqueadoEnEdicion = null;
}

// ============================================
// FORMULARIO
// ============================================

async function handleSubmitFormulario(e) {
    e.preventDefault();

    if (!state.esAdmin) {
        mostrarToast('Solo los administradores pueden realizar esta acción', 'error');
        return;
    }

    const formData = new FormData(e.target);
    let motivo = formData.get('motivo');

    // Si eligió "Otro", usar el motivo personalizado
    if (motivo === 'Otro') {
        motivo = formData.get('motivoPersonalizado');
    }

    const datos = {
        fecha: formData.get('fecha'),
        motivo: motivo,
        descripcion: formData.get('descripcion') || null,
        cancha_id: formData.get('cancha_id') || null
    };

    const id = document.getElementById('diaBloqueadoId').value;

    if (id) {
        // Actualizar existente
        await actualizarDiaBloqueado(id, datos);
    } else {
        // Crear nuevo
        await crearDiaBloqueado(datos);
    }
}

// ============================================
// FILTROS
// ============================================

function aplicarFiltros() {
    state.filtros.estado = document.getElementById('filtroEstado').value;
    state.filtros.fechaDesde = document.getElementById('filtroFechaDesde').value || null;
    state.filtros.fechaHasta = document.getElementById('filtroFechaHasta').value || null;

    cargarDiasBloqueados();
}

function limpiarFiltros() {
    document.getElementById('filtroEstado').value = 'futuros';
    document.getElementById('filtroFechaDesde').value = '';
    document.getElementById('filtroFechaHasta').value = '';

    state.filtros = {
        estado: 'futuros',
        fechaDesde: null,
        fechaHasta: null
    };

    cargarDiasBloqueados();
}

// ============================================
// CONFIRMACIÓN DE ELIMINACIÓN
// ============================================

function confirmarEliminacion(id, fecha, motivo) {
    if (!state.esAdmin) {
        mostrarToast('Solo los administradores pueden eliminar días bloqueados', 'error');
        return;
    }

    document.getElementById('detallesEliminacion').innerHTML = `
        <strong>Fecha:</strong> ${fecha}<br>
        <strong>Motivo:</strong> ${motivo}
    `;

    document.getElementById('btnConfirmarEliminacion').onclick = () => {
        eliminarDiaBloqueado(id);
    };

    document.getElementById('modalConfirmacion').style.display = 'flex';
}

function cerrarModalConfirmacion() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

// ============================================
// UTILIDADES
// ============================================

function formatearFecha(fecha) {
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return fecha.toLocaleDateString('es-AR', opciones);
}

function formatearDiaSemana(fecha) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[fecha.getDay()];
}

function mostrarLoading(mostrar) {
    const loadingContainer = document.getElementById('loadingContainer');
    loadingContainer.style.display = mostrar ? 'flex' : 'none';
}

function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = mensaje;
    toast.className = `toast toast-${tipo} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
