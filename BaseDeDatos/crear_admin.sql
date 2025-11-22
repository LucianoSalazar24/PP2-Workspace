-- ============================================
-- SCRIPT PARA CREAR USUARIO ADMINISTRADOR
-- Para Supabase (PostgreSQL)
-- ============================================

-- Este script crea un usuario administrador con todos los permisos
-- La contraseña está hasheada con bcrypt

-- ============================================
-- PASO 1: CREAR USUARIO ADMINISTRADOR
-- ============================================

-- Primero, instalamos la extensión pgcrypto si no está disponible
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insertar usuario administrador
-- Email: admin@futbolreservas.com
-- Password: Admin123!
-- Hash generado con bcrypt (10 rounds)

INSERT INTO usuarios (
    email,
    password,
    nombre,
    apellido,
    rol,
    cliente_id,
    estado,
    ultimo_acceso,
    created_at,
    updated_at
) VALUES (
    'admin@futbolreservas.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'Administrador',
    'Sistema',
    'admin',
    NULL,
    'activo',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    rol = 'admin',
    estado = 'activo',
    updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- PASO 2: VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- ============================================

-- Mostrar el usuario creado
SELECT
    id,
    email,
    nombre,
    apellido,
    rol,
    estado,
    created_at
FROM usuarios
WHERE email = 'admin@futbolreservas.com';

-- ============================================
-- INFORMACIÓN IMPORTANTE
-- ============================================

-- 📧 EMAIL: admin@futbolreservas.com
-- 🔑 PASSWORD: Admin123!
-- 👤 ROL: admin
-- ✅ ESTADO: activo

-- ⚠️  IMPORTANTE:
-- 1. Cambia la contraseña después del primer inicio de sesión
-- 2. Este usuario tiene acceso completo al sistema
-- 3. Puede crear, modificar y eliminar cualquier registro
-- 4. No está vinculado a ningún cliente específico

-- ============================================
-- OPCIONAL: CREAR USUARIOS ADICIONALES
-- ============================================

-- Descomenta las siguientes líneas para crear más usuarios admin:

/*
-- Usuario Admin 2
INSERT INTO usuarios (email, password, nombre, apellido, rol, estado)
VALUES (
    'admin2@futbolreservas.com',
    crypt('OtraPassword123!', gen_salt('bf', 10)),
    'Segundo',
    'Administrador',
    'admin',
    'activo'
);
*/

-- ============================================
-- VERIFICAR PERMISOS RLS
-- ============================================

-- Este usuario automáticamente tiene todos los permisos porque:
-- 1. Su rol es 'admin'
-- 2. Las políticas RLS verifican esto con la función es_admin()
-- 3. La función es_admin() retorna true para usuarios con rol = 'admin'

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Usuario administrador creado exitosamente';
    RAISE NOTICE '';
    RAISE NOTICE 'Email: admin@futbolreservas.com';
    RAISE NOTICE 'Password: Admin123!';
    RAISE NOTICE 'Rol: admin';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  CAMBIA LA CONTRASEÑA DESPUÉS DEL PRIMER LOGIN';
    RAISE NOTICE '============================================';
END $$;
