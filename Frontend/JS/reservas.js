// js/reservas.js - Lógica del sistema de reservas

let clienteActual = null;
let canchaSeleccionada = null;
let disponibilidadActual = null;

// Inicializar cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    inicializarFormulario();
    cargarCanchas();
    configurarFechaMinima();
});

// Configurar fecha mínima (hoy)
function configurarFechaMinima() {
    const inputFecha = document.getElementById('fecha');
    inputFecha.min = DateUtils.hoy();
    inputFecha.value = DateUtils.hoy();
}

// Cargar lista de canchas disponibles
async function cargarCanchas() {
    try {
        const response = await CanchasAPI.obtenerTodas();
        const selectCancha = document.getElementById('cancha');
        
        if (response.success && response.data.length > 0) {
            response.data.forEach(cancha => {
                if (cancha.estado === 'disponible') {
                    const option = document.createElement('option');
                    option.value = cancha.id;
                    option.textContent = `${cancha.nombre} - ${MoneyUtils.formato(cancha.precio_por_hora)}/hora`;
                    option.dataset.precio = cancha.precio_por_hora;
                    selectCancha.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error cargando canchas:', error);
        UIUtils.mostrarError('Error al cargar las canchas disponibles');
    }
}

// Inicializar eventos del formulario
function inicializarFormulario() {
    // Botón buscar cliente
    document.getElementById('btnBuscarCliente').addEventListener('click', buscarCliente);
    
    // Navegación entre pasos
    document.getElementById('btnSiguiente1').addEventListener('click', () => cambiarPaso(2));
    document.getElementById('btnSiguiente2').addEventListener('click', () => cambiarPaso(3));
    document.getElementById('btnVolver1').addEventListener('click', () => cambiarPaso(1));
    document.getElementById('btnVolver2').addEventListener('click', () => cambiarPaso(2));
    
    // Cambios en fecha y cancha
    document.getElementById('fecha').addEventListener('change', verificarDisponibilidad);
    document.getElementById('cancha').addEventListener('change', verificarDisponibilidad);
    
    // Submit del formulario
    document.getElementById('formReserva').addEventListener('submit', crearReserva);
}

// Buscar cliente por teléfono
async function buscarCliente() {
    const telefono = document.getElementById('telefono').value.trim();
    
    if (!telefono) {
        UIUtils.mostrarError('Por favor ingresa un número de teléfono');
        return;
    }
    
    if (!Validacion.telefono(telefono)) {
        UIUtils.mostrarError('El número de teléfono no es válido');
        return;
    }
    
    try {
        const response = await ClientesAPI.buscarPorTelefono(telefono);
        
        if (response.success) {
            // Cliente encontrado
            clienteActual = response.data;
            document.getElementById('nombre').value = clienteActual.nombre;
            document.getElementById('apellido').value = clienteActual.apellido;
            document.getElementById('email').value = clienteActual.email || '';
            
            // Deshabilitar campos (cliente ya existe)
            document.getElementById('nombre').disabled = true;
            document.getElementById('apellido').disabled = true;
            document.getElementById('email').disabled = true;
            
            UIUtils.mostrarExito('Cliente encontrado');
        }
    } catch (error) {
        // Cliente no existe, habilitar campos para crear uno nuevo
        clienteActual = null;
        document.getElementById('nombre').value = '';
        document.getElementById('apellido').value = '';
        document.getElementById('email').value = '';
        document.getElementById('nombre').disabled = false;
        document.getElementById('apellido').disabled = false;
        document.getElementById('email').disabled = false;
        
        UIUtils.mostrarError('Cliente no encontrado. Complete los datos para crear uno nuevo.');
    }
    
    // Mostrar campos de datos del cliente
    document.getElementById('datosCliente').classList.remove('d-none');
}

// Verificar disponibilidad de la cancha
async function verificarDisponibilidad() {
    const fecha = document.getElementById('fecha').value;
    const canchaId = document.getElementById('cancha').value;
    
    if (!fecha || !canchaId) return;
    
    try {
        const response = await ReservasAPI.verificarDisponibilidad(fecha, canchaId);
        
        if (response.success) {
            disponibilidadActual = response.data;
            mostrarDisponibilidad(disponibilidadActual);
        }
    } catch (error) {
        console.error('Error verificando disponibilidad:', error);
        UIUtils.mostrarError('Error al verificar disponibilidad');
    }
}

// Mostrar horarios disponibles
function mostrarDisponibilidad(datos) {
    const container = document.getElementById('horariosDisponibles');
    const disponibilidadContainer = document.getElementById('disponibilidadContainer');
    const seleccionHorario = document.getElementById('seleccionHorario');
    
    disponibilidadContainer.classList.remove('d-none');
    seleccionHorario.classList.remove('d-none');
    
    const cancha = datos.find(c => c.id == document.getElementById('cancha').value);
    if (!cancha) return;
    
    const horariosOcupados = cancha.reservas || [];
    const todosHorarios = HorarioUtils.generarHorarios('08:00', '23:00', 60);
    
    container.innerHTML = '';
    
    todosHorarios.forEach(hora => {
        const estaOcupado = horariosOcupados.some(reserva => {
            return hora >= reserva.hora_inicio && hora < reserva.hora_fin;
        });
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${estaOcupado ? 'btn-danger' : 'btn-outline'}`;
        btn.textContent = hora;
        btn.disabled = estaOcupado;
        
        if (!estaOcupado) {
            btn.addEventListener('click', () => seleccionarHorario(hora));
        }
        
        container.appendChild(btn);
    });
}

// Seleccionar horario de inicio
function seleccionarHorario(hora) {
    document.getElementById('horaInicio').value = hora;
    
    // Calcular hora de fin sugerida (1 hora después)
    const horaInicio = HorarioUtils.parseHora(hora);
    const horaFin = new Date(horaInicio.getTime() + 60 * 60 * 1000);
    document.getElementById('horaFin').value = HorarioUtils.formatoHora(horaFin);
}

// Cambiar entre pasos del formulario
function cambiarPaso(numeroPaso) {
    // Validar paso actual antes de avanzar
    if (numeroPaso === 2) {
        if (!validarPaso1()) return;
    } else if (numeroPaso === 3) {
        if (!validarPaso2()) return;
        mostrarResumen();
    }
    
    // Ocultar todos los pasos
    document.getElementById('paso1').classList.add('d-none');
    document.getElementById('paso2').classList.add('d-none');
    document.getElementById('paso3').classList.add('d-none');
    
    // Mostrar paso seleccionado
    document.getElementById(`paso${numeroPaso}`).classList.remove('d-none');
}

// Validar paso 1 (datos del cliente)
function validarPaso1() {
    const telefono = document.getElementById('telefono').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    
    if (!telefono || !nombre || !apellido) {
        UIUtils.mostrarError('Por favor completa todos los campos requeridos');
        return false;
    }
    
    if (!Validacion.telefono(telefono)) {
        UIUtils.mostrarError('El teléfono no es válido');
        return false;
    }
    
    return true;
}

// Validar paso 2 (selección de cancha y horario)
function validarPaso2() {
    const fecha = document.getElementById('fecha').value;
    const canchaId = document.getElementById('cancha').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFin = document.getElementById('horaFin').value;
    
    if (!fecha || !canchaId || !horaInicio || !horaFin) {
        UIUtils.mostrarError('Por favor completa todos los campos de la reserva');
        return false;
    }
    
    const duracion = HorarioUtils.calcularDuracion(horaInicio, horaFin);
    if (duracion <= 0) {
        UIUtils.mostrarError('La hora de fin debe ser posterior a la hora de inicio');
        return false;
    }
    
    if (duracion > 3) {
        UIUtils.mostrarError('La duración máxima de una reserva es 3 horas');
        return false;
    }
    
    return true;
}

// Mostrar resumen de la reserva
function mostrarResumen() {
    const fecha = document.getElementById('fecha').value;
    const canchaId = document.getElementById('cancha').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFin = document.getElementById('horaFin').value;
    
    const selectCancha = document.getElementById('cancha');
    const opcionSeleccionada = selectCancha.options[selectCancha.selectedIndex];
    const nombreCancha = opcionSeleccionada.textContent.split(' - ')[0];
    const precioHora = parseFloat(opcionSeleccionada.dataset.precio);
    
    const duracion = HorarioUtils.calcularDuracion(horaInicio, horaFin);
    const precioTotal = precioHora * duracion;
    
    const resumen = `
        <div class="grid grid-2 gap-2">
            <div>
                <strong>Cliente:</strong><br>
                ${document.getElementById('nombre').value} ${document.getElementById('apellido').value}
            </div>
            <div>
                <strong>Teléfono:</strong><br>
                ${document.getElementById('telefono').value}
            </div>
            <div>
                <strong>Cancha:</strong><br>
                ${nombreCancha}
            </div>
            <div>
                <strong>Fecha:</strong><br>
                ${DateUtils.formatoLegible(fecha)}
            </div>
            <div>
                <strong>Horario:</strong><br>
                ${horaInicio} - ${horaFin}
            </div>
            <div>
                <strong>Duración:</strong><br>
                ${duracion} hora(s)
            </div>
        </div>
        <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border-color);">
        <div class="text-center">
            <h3 style="color: var(--primary-color); margin: 0;">
                Precio Total: ${MoneyUtils.formato(precioTotal)}
            </h3>
            <p class="text-secondary" style="margin-top: 0.5rem;">
                Se requiere una seña del 30% al confirmar
            </p>
        </div>
    `;
    
    document.getElementById('detallesResumen').innerHTML = resumen;
}

// Crear reserva
async function crearReserva(e) {
    e.preventDefault();
    
    const btnConfirmar = document.getElementById('btnConfirmar');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Procesando...';
    
    try {
        // Si no existe el cliente, crearlo primero
        if (!clienteActual) {
            const nuevoCliente = {
                nombre: document.getElementById('nombre').value.trim(),
                apellido: document.getElementById('apellido').value.trim(),
                telefono: document.getElementById('telefono').value.trim(),
                email: document.getElementById('email').value.trim() || null
            };
            
            const responseCliente = await ClientesAPI.crear(nuevoCliente);
            if (responseCliente.success) {
                clienteActual = responseCliente.data;
            } else {
                throw new Error('Error al crear el cliente');
            }
        }
        
        // Crear la reserva
        const datosReserva = {
            cancha_id: parseInt(document.getElementById('cancha').value),
            cliente_id: clienteActual.id,
            fecha: document.getElementById('fecha').value,
            hora_inicio: document.getElementById('horaInicio').value,
            hora_fin: document.getElementById('horaFin').value,
            observaciones: document.getElementById('observaciones').value.trim()
        };
        
        const response = await ReservasAPI.crear(datosReserva);
        
        if (response.success) {
            UIUtils.mostrarExito('Reserva creada exitosamente');
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        } else {
            throw new Error(response.message);
        }
        
    } catch (error) {
        console.error('Error creando reserva:', error);
        UIUtils.mostrarError(error.message || 'Error al crear la reserva');
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar Reserva';
    }
}