// js/utils.js - Funciones auxiliares reutilizables

// Formateo de fechas
const DateUtils = {
    // Convertir fecha a formato YYYY-MM-DD
    formatoSQL(fecha) {
        if (typeof fecha === 'string') {
            fecha = new Date(fecha);
        }
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    // Convertir fecha a formato legible (DD/MM/YYYY)
    formatoLegible(fecha) {
        if (typeof fecha === 'string') {
            fecha = new Date(fecha);
        }
        const day = String(fecha.getDate()).padStart(2, '0');
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const year = fecha.getFullYear();
        return `${day}/${month}/${year}`;
    },
    
    // Obtener fecha de hoy en formato SQL
    hoy() {
        return this.formatoSQL(new Date());
    },
    
    // Verificar si una fecha es hoy
    esHoy(fecha) {
        return this.formatoSQL(fecha) === this.hoy();
    },
    
    // Verificar si una fecha es futura
    esFutura(fecha) {
        const fechaObj = new Date(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        return fechaObj >= hoy;
    }
};

// Formateo de moneda
const MoneyUtils = {
    // Formatear como moneda argentina
    formato(monto) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(monto);
    },
    
    // Parsear string a número
    parse(texto) {
        return parseFloat(texto.replace(/[^0-9.-]+/g, ''));
    }
};

// Validaciones
const Validacion = {
    // Validar email
    email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },
    
    // Validar teléfono (formato argentino flexible)
    telefono(telefono) {
        const limpio = telefono.replace(/\D/g, '');
        return limpio.length >= 8 && limpio.length <= 15;
    },
    
    // Validar formato de hora HH:MM
    hora(hora) {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(hora);
    },
    
    // Validar que campos requeridos no estén vacíos
    camposRequeridos(objeto, campos) {
        const faltantes = [];
        campos.forEach(campo => {
            if (!objeto[campo] || objeto[campo].trim() === '') {
                faltantes.push(campo);
            }
        });
        return faltantes;
    }
};

// Manejo de UI
const UIUtils = {
    // Mostrar mensaje de éxito
    mostrarExito(mensaje, duracion = 3000) {
        this.mostrarAlerta(mensaje, 'success', duracion);
    },
    
    // Mostrar mensaje de error
    mostrarError(mensaje, duracion = 5000) {
        this.mostrarAlerta(mensaje, 'error', duracion);
    },
    
    // Mostrar alerta genérica
    mostrarAlerta(mensaje, tipo, duracion) {
        const alerta = document.createElement('div');
        alerta.className = `alerta alerta-${tipo}`;
        alerta.textContent = mensaje;
        alerta.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        if (tipo === 'success') {
            alerta.style.backgroundColor = '#4CAF50';
            alerta.style.color = 'white';
        } else if (tipo === 'error') {
            alerta.style.backgroundColor = '#f44336';
            alerta.style.color = 'white';
        } else {
            alerta.style.backgroundColor = '#2196F3';
            alerta.style.color = 'white';
        }
        
        document.body.appendChild(alerta);
        
        setTimeout(() => {
            alerta.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => alerta.remove(), 300);
        }, duracion);
    },
    
    // Mostrar loader
    mostrarLoader(elemento) {
        elemento.innerHTML = '<div class="loader">Cargando...</div>';
        elemento.classList.add('loading');
    },
    
    // Ocultar loader
    ocultarLoader(elemento) {
        elemento.classList.remove('loading');
    },
    
    // Confirmar acción
    async confirmar(mensaje) {
        return confirm(mensaje);
    }
};

// Generación de horarios
const HorarioUtils = {
    // Generar array de horarios cada X minutos
    generarHorarios(inicio, fin, intervaloMinutos = 30) {
        const horarios = [];
        let actual = this.parseHora(inicio);
        const finHora = this.parseHora(fin);
        
        while (actual < finHora) {
            horarios.push(this.formatoHora(actual));
            actual = new Date(actual.getTime() + intervaloMinutos * 60000);
        }
        
        return horarios;
    },
    
    // Parsear hora string a Date
    parseHora(horaStr) {
        const [horas, minutos] = horaStr.split(':');
        const fecha = new Date();
        fecha.setHours(parseInt(horas), parseInt(minutos), 0, 0);
        return fecha;
    },
    
    // Formatear Date a HH:MM
    formatoHora(fecha) {
        const horas = String(fecha.getHours()).padStart(2, '0');
        const minutos = String(fecha.getMinutes()).padStart(2, '0');
        return `${horas}:${minutos}`;
    },
    
    // Calcular duración entre dos horarios en horas
    calcularDuracion(horaInicio, horaFin) {
        const inicio = this.parseHora(horaInicio);
        const fin = this.parseHora(horaFin);
        return (fin - inicio) / (1000 * 60 * 60);
    }
};

// Estado de reserva helpers
const EstadoUtils = {
    obtenerTexto(estado) {
        const textos = {
            'pendiente': 'Pendiente',
            'confirmada': 'Confirmada',
            'cancelada': 'Cancelada',
            'completada': 'Completada',
            'no_show': 'No se presentó'
        };
        return textos[estado] || estado;
    },
    
    obtenerColor(estado) {
        const colores = {
            'pendiente': '#FFA726',
            'confirmada': '#66BB6A',
            'cancelada': '#EF5350',
            'completada': '#42A5F5',
            'no_show': '#8D6E63'
        };
        return colores[estado] || '#757575';
    },
    
    obtenerBadge(estado) {
        const texto = this.obtenerTexto(estado);
        const color = this.obtenerColor(estado);
        return `<span class="badge" style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${texto}</span>`;
    }
};

// Storage helpers (sin usar localStorage por restricción de artifacts)
const StorageUtils = {
    // Guardar en memoria temporal de la sesión
    cache: {},
    
    guardar(clave, valor) {
        this.cache[clave] = valor;
    },
    
    obtener(clave) {
        return this.cache[clave];
    },
    
    eliminar(clave) {
        delete this.cache[clave];
    },
    
    limpiar() {
        this.cache = {};
    }
};