document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const reservaId = params.get('id');
    const precioTotalStr = params.get('total');
    
    if (!reservaId || !precioTotalStr) {
        UIUtils.mostrarError('Faltan datos de la reserva.');
        setTimeout(() => window.location.href = 'mis-reservas.html', 2000);
        return;
    }

    const precioTotal = parseFloat(precioTotalStr);
    const senaMinima = Math.ceil(precioTotal * 0.30);

    // 2. Elementos del DOM
    const lblPrecioTotal = document.getElementById('lblPrecioTotal');
    const lblSenaMinima = document.getElementById('lblSenaMinima');
    const inputMonto = document.getElementById('inputMonto');
    const infoMonto = document.getElementById('infoMonto');
    const advertenciaEfectivo = document.getElementById('advertenciaEfectivo');
    const formPago = document.getElementById('formPago');
    const btnConfirmar = document.getElementById('btnConfirmarPago');
    
    // Radios
    const radiosTipoPago = document.querySelectorAll('input[name="tipoPago"]');
    const radiosFormaPago = document.querySelectorAll('input[name="formaPago"]');

    // 3. Inicializar valores
    lblPrecioTotal.textContent = MoneyUtils.formato(precioTotal);
    lblSenaMinima.textContent = MoneyUtils.formato(senaMinima);
    
    // Función para actualizar UI según selecciones
    function actualizarUI() {
        const tipoPago = document.querySelector('input[name="tipoPago"]:checked').value;
        const formaPagoNode = document.querySelector('input[name="formaPago"]:checked');
        const formaPago = formaPagoNode ? formaPagoNode.value : null;

        if (tipoPago === 'seña') {
            inputMonto.value = senaMinima;
            inputMonto.min = senaMinima;
            inputMonto.max = precioTotal;
            infoMonto.textContent = `Mínimo requerido: ${MoneyUtils.formato(senaMinima)} (30%)`;
            
            if (formaPago === 'efectivo') {
                advertenciaEfectivo.style.display = 'block';
            } else {
                advertenciaEfectivo.style.display = 'none';
            }
        } else {
            // Completo
            inputMonto.value = precioTotal;
            inputMonto.min = precioTotal;
            inputMonto.max = precioTotal;
            infoMonto.textContent = `Pago total: ${MoneyUtils.formato(precioTotal)}`;
            advertenciaEfectivo.style.display = 'none';
        }
    }

    // Event listeners para cambios
    radiosTipoPago.forEach(radio => radio.addEventListener('change', actualizarUI));
    radiosFormaPago.forEach(radio => radio.addEventListener('change', actualizarUI));

    // Inicializar estado
    actualizarUI();

    // 4. Manejar el submit del formulario
    formPago.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tipoPago = document.querySelector('input[name="tipoPago"]:checked').value;
        const formaPagoNode = document.querySelector('input[name="formaPago"]:checked');
        const monto = parseFloat(inputMonto.value);

        if (!formaPagoNode) {
            UIUtils.mostrarError('Por favor selecciona un método de pago');
            return;
        }

        const formaPago = formaPagoNode.value;

        if (isNaN(monto) || monto <= 0) {
            UIUtils.mostrarError('El monto debe ser mayor a cero');
            return;
        }

        if (tipoPago === 'seña' && monto < senaMinima) {
            UIUtils.mostrarError(`El monto mínimo para la seña es ${MoneyUtils.formato(senaMinima)} (30% del total)`);
            return;
        }

        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = 'Procesando... <div class="loader-inline"></div>';

        try {
            // Regla de 48 horas
            if (tipoPago === 'seña' && formaPago === 'efectivo') {
                await Swal.fire({
                    title: '¡Reserva Guardada!',
                    text: `Importante: Seleccionaste abonar la seña en efectivo. Tenés hasta 48hs antes del turno para acercarte al local a pagar ${MoneyUtils.formato(monto)}.\nSi no se registra el pago en ese plazo, la reserva será cancelada automáticamente.`,
                    icon: 'warning',
                    confirmButtonColor: '#f59e0b',
                    confirmButtonText: 'Entendido'
                });
                window.location.href = 'mis-reservas.html';
                return;
            }

            // Registrar el pago
            const responsePago = await PagosAPI.registrar({
                reserva_id: parseInt(reservaId),
                monto: monto,
                tipo_pago: tipoPago,
                metodo_pago: formaPago,
                observaciones: ''
            });

            if (!responsePago.success) {
                throw new Error('Reserva creada pero hubo un error al registrar el pago: ' + responsePago.message);
            }

            await Swal.fire({
                title: '¡Reserva Confirmada!',
                html: `Monto abonado: <strong>${MoneyUtils.formato(monto)}</strong><br>Forma de pago: <strong>${formaPago}</strong>`,
                icon: 'success',
                confirmButtonColor: '#2ecc71',
                confirmButtonText: 'Ver mis reservas'
            });

            window.location.href = 'mis-reservas.html';
            
        } catch (error) {
            console.error('Error registrando pago:', error);
            UIUtils.mostrarError(error.message || 'Error al procesar el pago');
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = 'Confirmar Pago y Reserva 🔒';
        }
    });
});
