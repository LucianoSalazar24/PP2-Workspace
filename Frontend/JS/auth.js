// js/auth.js - Sistema de autenticación

// Funciones auxiliares para manejar sesión
function guardarSesion(sesion) {
    sessionStorage.setItem('sesion', JSON.stringify(sesion));
}

function obtenerSesion() {
    const sesionStr = sessionStorage.getItem('sesion');
    return sesionStr ? JSON.parse(sesionStr) : null;
}

function eliminarSesion() {
    sessionStorage.removeItem('sesion');
}

// Almacenar sesión actual
let sesionActual = obtenerSesion();

document.addEventListener('DOMContentLoaded', () => {
    inicializarAuth();
});

function inicializarAuth() {
    // Configurar tabs
    configurarTabs();
    
    // Configurar formularios
    document.getElementById('formLogin').addEventListener('submit', handleLogin);
    document.getElementById('formRegistro').addEventListener('submit', handleRegistro);
    
    // Verificar si ya hay sesión activa
    if (sesionActual) {
        redirigirSegunRol();
    }
}

// Configurar tabs de login/registro
function configurarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Actualizar botones activos
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Mostrar contenido correspondiente
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            if (targetTab === 'login') {
                document.getElementById('loginTab').classList.add('active');
            } else {
                document.getElementById('registroTab').classList.add('active');
            }
        });
    });
}

// Manejar login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        UIUtils.mostrarError('Por favor completa todos los campos');
        return;
    }
    
    mostrarCargando(true);
    
    try {
        // Llamar al endpoint de login (lo crearemos en el backend)
        const response = await fetch(CONFIG.API_URL + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Guardar sesión
            sesionActual = data.data;
            StorageUtils.guardar('sesion', sesionActual);
            
            UIUtils.mostrarExito('¡Bienvenido!');
            
            setTimeout(() => {
                redirigirSegunRol();
            }, 1000);
        } else {
            UIUtils.mostrarError(data.message || 'Credenciales incorrectas');
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        UIUtils.mostrarError('Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
        mostrarCargando(false);
    }
}

// Manejar registro
async function handleRegistro(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('regNombre').value.trim();
    const apellido = document.getElementById('regApellido').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const telefono = document.getElementById('regTelefono').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    
    // Validaciones
    if (!nombre || !apellido || !email || !telefono || !password) {
        UIUtils.mostrarError('Por favor completa todos los campos');
        return;
    }
    
    if (!Validacion.email(email)) {
        UIUtils.mostrarError('El email no es válido');
        return;
    }
    
    if (!Validacion.telefono(telefono)) {
        UIUtils.mostrarError('El teléfono no es válido');
        return;
    }
    
    if (password.length < 6) {
        UIUtils.mostrarError('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    if (password !== passwordConfirm) {
        UIUtils.mostrarError('Las contraseñas no coinciden');
        return;
    }
    
    mostrarCargando(true);
    
    try {
        const response = await fetch(CONFIG.API_URL + '/auth/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, apellido, email, telefono, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            UIUtils.mostrarExito('Cuenta creada exitosamente. Iniciando sesión...');
            
            // Auto-login después del registro
            sesionActual = data.data;
            StorageUtils.guardar('sesion', sesionActual);
            
            setTimeout(() => {
                redirigirSegunRol();
            }, 1500);
        } else {
            UIUtils.mostrarError(data.message || 'Error al crear la cuenta');
        }
        
    } catch (error) {
        console.error('Error en registro:', error);
        UIUtils.mostrarError('Error al crear la cuenta');
    } finally {
        mostrarCargando(false);
    }
}

// Redirigir según el rol del usuario
function redirigirSegunRol() {
    if (!sesionActual) return;
    
    if (sesionActual.rol === 'admin') {
        window.location.href = '../pages/admin.html';
    } else {
        window.location.href = '../pages/reservar.html';
    }
}

// Mostrar overlay de carga
function mostrarCargando(mostrar) {
    let overlay = document.querySelector('.loading-overlay');
    
    if (mostrar) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="loading-spinner"></div>';
            document.body.appendChild(overlay);
        }
    } else {
        if (overlay) {
            overlay.remove();
        }
    }
}

// Función para cerrar sesión (usada en otras páginas)
function cerrarSesion() {
    StorageUtils.eliminar('sesion');
    sesionActual = null;
    window.location.href = '../pages/login.html';
}

// Verificar si el usuario está autenticado (para proteger páginas)
function verificarAutenticacion(rolRequerido = null) {
    const sesion = StorageUtils.obtener('sesion');
    
    if (!sesion) {
        window.location.href = '../pages/login.html';
        return false;
    }
    
    if (rolRequerido && sesion.rol !== rolRequerido) {
        UIUtils.mostrarError('No tienes permisos para acceder a esta página');
        window.location.href = '../index.html';
        return false;
    }
    
    return true;
}

// Exportar funciones globales
window.cerrarSesion = cerrarSesion;
window.verificarAutenticacion = verificarAutenticacion;