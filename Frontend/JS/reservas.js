// js/reservas.js - Lógica del sistema de reservas

let clienteActual = null;
let canchaSeleccionada = null;
let disponibilidadActual = null;

// Inicializar cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== INICIANDO PÁGINA DE RESERVAS ===');
    
    // Verificar autenticación primero
    if (!verificarAutenticacion()) {
        console.log('Autenticación fallida, deteniendo carga');
        return;
    }
    
    console.log('Autenticación exitosa, continuando...');
    
    // Obtener datos del usuario logueado
    const sesion = obtenerSesionActual();
    console.log('Sesión recuperada:', sesion);
    
    if (sesion && sesion.cliente_id) {
        // Pre-cargar datos del cliente
        clienteActual = {
            id: sesion.cliente_id,
            nombre: sesion.nombre,
            apellido: sesion.apellido,
            telefono: sesion.telefono,
            email: sesion.email
        };
        console.log('Cliente actual configurado:', clienteActual);
    }
    
    inicializarFormulario();
    cargarCanchas();
    configurarFechaMinima();
});

// Configurar fecha mínima (hoy)
function configurarFechaMinima() {
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) {
        inputFecha.min = DateUtils.hoy();
        inputFecha.value = DateUtils.hoy();
    }
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
    console.log('=== INICIALIZANDO FORMULARIO ===');
    
    // Verificar que los elementos existan antes de agregar listeners
    const btnBuscarCliente = document.getElementById('btnBuscarCliente');
    const btnSiguiente1 = document.getElementById('btnSiguiente1');
    const btnSiguiente2 = document.getElementById('btnSiguiente2');
    const btnVolver1 = document.getElementById('btnVolver1');
    const btnVolver2 = document.getElementById('btnVolver2');
    const fecha = document.getElementById('fecha');
    const cancha = document.getElementById('cancha');
    const formReserva = document.getElementById('formReserva');
    
    // Botón buscar cliente (solo si existe)
    if (btnBuscarCliente) {
        btnBuscarCliente.addEventListener('click', buscarCliente);
    }
    
    // Navegación entre pasos
    if (btnSiguiente1) {
        btnSiguiente1.addEventListener('click', () => {
            console.log('Click en btnSiguiente1');
            cambiarPaso(2);
        });
    } else {
        console.error('ERROR: btnSiguiente1 no encontrado');
    }
    
    if (btnSiguiente2) {
        btnSiguiente2.addEventListener('click', () => {
            console.log('Click en btnSiguiente2');
            cambiarPaso(3);
        });
    }
    
    if (btnVolver1) {
        btnVolver1.addEventListener('click', () => cambiarPaso(1));
    }
    
    if (btnVolver2) {
        btnVolver2.addEventListener('click', () => cambiarPaso(2));
    }
    
    // Cambios en fecha y cancha
    if (fecha) {
        fecha.addEventListener('change', verificarDisponibilidad);
    }
    
    if (cancha) {
        cancha.addEventListener('change', verificarDisponibilidad);
    }
    
    // Submit del formulario
    if (formReserva) {
        formReserva.addEventListener('submit', crearReserva);
    }

    // Pre-cargar datos del cliente si ya está logueado
    precargarDatosCliente();
    
    console.log('Formulario inicializado correctamente');
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
    const datosCliente = document.getElementById('datosCliente');
    if (datosCliente) {
        datosCliente.classList.remove('d-none');
    }
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
    
    if (disponibilidadContainer) {
        disponibilidadContainer.classList.remove('d-none');
    }
    if (seleccionHorario) {
        seleccionHorario.classList.remove('d-none');
    }
    
    const cancha = datos.find(c => c.id == document.getElementById('cancha').value);
    if (!cancha || !container) return;
    
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
    console.log('Cambiando a paso:', numeroPaso);
    
    // Validar paso actual antes de avanzar
    if (numeroPaso === 2) {
        if (!validarPaso1()) {
            console.log('Validación paso 1 fallida');
            return;
        }
    } else if (numeroPaso === 3) {
        if (!validarPaso2()) {
            console.log('Validación paso 2 fallida');
            return;
        }
        mostrarResumen();
    }
    
    // Ocultar todos los pasos
    const paso1 = document.getElementById('paso1');
    const paso2 = document.getElementById('paso2');
    const paso3 = document.getElementById('paso3');
    
    if (paso1) paso1.classList.add('d-none');
    if (paso2) paso2.classList.add('d-none');
    if (paso3) paso3.classList.add('d-none');
    
    // Mostrar paso seleccionado
    const pasoActual = document.getElementById(`paso${numeroPaso}`);
    if (pasoActual) {
        pasoActual.classList.remove('d-none');
        console.log(`Paso ${numeroPaso} mostrado`);
    } else {
        console.error(`Paso ${numeroPaso} no encontrado`);
    }
}

// Validar paso 1 (datos del cliente)
function validarPaso1() {
    const telefono = document.getElementById('telefono').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    
    console.log('Validando paso 1:', { telefono, nombre, apellido });
    
    if (!telefono || !nombre || !apellido) {
        UIUtils.mostrarError('Por favor completa todos los campos requeridos');
        return false;
    }
    
    if (!Validacion.telefono(telefono)) {
        UIUtils.mostrarError('El teléfono no es válido');
        return false;
    }
    
    console.log('Paso 1 válido');
    return true;
}

// Validar paso 2 (selección de cancha y horario)
function validarPaso2() {
    const fecha = document.getElementById('fecha').value;
    const canchaId = document.getElementById('cancha').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFin = document.getElementById('horaFin').value;
    
    console.log('Validando paso 2:', { fecha, canchaId, horaInicio, horaFin });
    
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
    
    console.log('Paso 2 válido');
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
    
    const detallesResumen = document.getElementById('detallesResumen');
    if (detallesResumen) {
        detallesResumen.innerHTML = resumen;
    }
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

        console.log('Datos a enviar:', datosReserva);
        
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

// Pre-cargar datos del cliente logueado
function precargarDatosCliente() {
    const sesion = obtenerSesionActual();
    
    console.log('=== PRE-CARGA DE DATOS ===');
    console.log('Sesión actual:', sesion);
    
    if (sesion && sesion.cliente_id) {
        // Llenar automáticamente todos los campos
        const telefonoInput = document.getElementById('telefono');
        const nombreInput = document.getElementById('nombre');
        const apellidoInput = document.getElementById('apellido');
        const emailInput = document.getElementById('email');
        
        if (telefonoInput) telefonoInput.value = sesion.telefono || '';
        if (nombreInput) nombreInput.value = sesion.nombre || '';
        if (apellidoInput) apellidoInput.value = sesion.apellido || '';
        if (emailInput) emailInput.value = sesion.email || '';
        
        // Hacer campos de solo lectura
        if (telefonoInput) telefonoInput.readOnly = true;
        if (nombreInput) nombreInput.readOnly = true;
        if (apellidoInput) apellidoInput.readOnly = true;
        if (emailInput) emailInput.readOnly = true;
        
        // Mostrar mensaje de confirmación
        const alertDiv = document.getElementById('datosClienteAuto');
        const nombreSpan = document.getElementById('nombreCompleto');
        
        if (alertDiv && nombreSpan) {
            nombreSpan.textContent = `${sesion.nombre} ${sesion.apellido}`;
            alertDiv.style.display = 'block';
        }
        
        console.log('✓ Datos pre-cargados exitosamente');
    } else {
        console.warn('⚠ No hay sesión con cliente_id');
    }
}