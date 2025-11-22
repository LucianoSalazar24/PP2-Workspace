# 🔐 Instrucciones para Crear y Usar el Usuario Administrador

Esta guía te explica cómo crear un usuario administrador con todos los permisos en Supabase.

---

## 📋 OPCIÓN 1: Autenticación Personalizada (RECOMENDADO)

Esta opción usa tu tabla `usuarios` directamente, sin depender de Supabase Auth.

### Paso 1: Instalar Dependencias

```bash
cd Backend
npm install jsonwebtoken bcrypt
```

### Paso 2: Ejecutar el Script SQL

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre **SQL Editor** en el menú lateral
3. Haz clic en **+ New query**
4. Copia y pega el contenido de [`BaseDeDatos/crear_admin.sql`](BaseDeDatos/crear_admin.sql)
5. Haz clic en **Run** (▶️)

Esto creará un usuario administrador con las siguientes credenciales:

```
📧 Email: admin@futbolreservas.com
🔑 Password: Admin123!
👤 Rol: admin
```

### Paso 3: Actualizar las Rutas de Autenticación

Edita el archivo [`Backend/Routes/auth.js`](Backend/Routes/auth.js) y cambia el import:

```javascript
// Cambia esto:
const authController = require('../controllers/authController');

// Por esto:
const authController = require('../controllers/authControllerCustom');
```

### Paso 4: Reiniciar el Servidor

```bash
cd Backend
npm start
```

### Paso 5: Probar el Login

Usa Postman, Thunder Client o curl:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@futbolreservas.com",
    "password": "Admin123!"
  }'
```

**Respuesta esperada:**

```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "id": 1,
    "email": "admin@futbolreservas.com",
    "nombre": "Administrador",
    "apellido": "Sistema",
    "rol": "admin",
    "cliente_id": null,
    "telefono": null,
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Paso 6: Usar el Token

Guarda el `access_token` y úsalo en las peticiones que requieran autenticación:

```bash
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "cancha_id": 1,
    "cliente_id": 1,
    "fecha": "2025-12-01",
    "hora_inicio": "14:00",
    "hora_fin": "16:00"
  }'
```

---

## 📋 OPCIÓN 2: Usar Supabase Auth (Requiere configuración adicional)

Si prefieres usar Supabase Auth, necesitas configurar las API Keys.

### Paso 1: Obtener las API Keys

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Ve a **Settings** > **API**
3. Copia las siguientes claves:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public**: Tu clave pública
   - **service_role**: Tu clave privada (⚠️ NUNCA la compartas)

### Paso 2: Configurar el archivo .env

Edita [`Backend/.env`](Backend/.env) y agrega:

```bash
SUPABASE_URL=https://urohgbxhaghxekactoug.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_KEY=tu-service-role-key-aqui
```

### Paso 3: Crear Usuario en Supabase Auth

1. Ve a **Authentication** en Supabase
2. Haz clic en **Add user** > **Create new user**
3. Completa:
   - Email: `admin@futbolreservas.com`
   - Password: `Admin123!`
   - Auto Confirm User: ✅ (activado)

### Paso 4: Ejecutar el Script SQL

Ejecuta [`BaseDeDatos/crear_admin.sql`](BaseDeDatos/crear_admin.sql) en el SQL Editor de Supabase.

### Paso 5: Reiniciar el Servidor

```bash
cd Backend
npm start
```

Deberías ver:

```
🔑 Supabase URL: https://urohgbxhaghxekactoug.supabase.co
🔑 Service Key existe: true
```

---

## 🔒 Permisos del Usuario Admin

El usuario administrador tiene acceso completo a:

### ✅ Puede hacer TODO:

- ✅ **Canchas**: Crear, modificar, eliminar, ver
- ✅ **Clientes**: Crear, modificar, eliminar, ver todos
- ✅ **Reservas**: Crear, modificar, eliminar, ver todas
- ✅ **Pagos**: Crear, modificar, eliminar, ver todos
- ✅ **Configuraciones**: Crear, modificar, eliminar, ver
- ✅ **Bloqueos de horarios**: Crear, modificar, eliminar, ver
- ✅ **Días bloqueados**: Crear, modificar, eliminar, ver
- ✅ **Usuarios**: Crear, modificar, eliminar, ver todos
- ✅ **Tipos de cliente**: Crear, modificar, eliminar, ver

### ⚙️ Cómo funciona

Las políticas RLS (Row Level Security) verifican el rol del usuario:

```sql
-- Ejemplo de política
CREATE POLICY "Solo admins pueden crear canchas"
ON canchas FOR INSERT
WITH CHECK (es_admin());
```

La función `es_admin()` retorna `true` cuando:

```sql
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (SELECT rol = 'admin' FROM usuarios WHERE email = auth.email()),
        false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔄 Cambiar Contraseña del Admin

### Con Autenticación Personalizada:

```bash
curl -X POST http://localhost:3000/api/auth/cambiar-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@futbolreservas.com",
    "password_actual": "Admin123!",
    "password_nueva": "NuevaPasswordSegura123!"
  }'
```

### Desde SQL (Supabase):

```sql
UPDATE usuarios
SET password = crypt('NuevaPasswordSegura123!', gen_salt('bf', 10)),
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@futbolreservas.com';
```

---

## 👥 Crear Más Usuarios Admin

### Opción 1: Desde SQL

```sql
-- Crear admin sin cliente vinculado
INSERT INTO usuarios (
    email,
    password,
    nombre,
    apellido,
    rol,
    estado
) VALUES (
    'otro.admin@futbolreservas.com',
    crypt('OtraPassword123!', gen_salt('bf', 10)),
    'Otro',
    'Administrador',
    'admin',
    'activo'
);
```

### Opción 2: Desde la API (requiere estar logueado como admin)

```bash
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -d '{
    "email": "otro.admin@futbolreservas.com",
    "password": "OtraPassword123!",
    "nombre": "Otro",
    "apellido": "Administrador",
    "rol": "admin"
  }'
```

---

## ⚠️ Seguridad

### ✅ Buenas Prácticas:

1. **Cambia la contraseña por defecto inmediatamente**
2. Usa contraseñas fuertes (mínimo 12 caracteres, mayúsculas, minúsculas, números, símbolos)
3. No compartas las credenciales de administrador
4. Implementa autenticación de dos factores (2FA) en producción
5. Revisa los logs de acceso regularmente
6. Crea usuarios admin específicos para cada persona (no compartan cuentas)

### 🔐 Variables de Entorno Seguras:

Para producción, cambia el JWT_SECRET en [`Backend/controllers/authControllerCustom.js`](Backend/controllers/authControllerCustom.js):

```javascript
// Agregar en .env
JWT_SECRET=una-clave-super-secreta-de-al-menos-32-caracteres-random

// Y en el código:
const JWT_SECRET = process.env.JWT_SECRET;
```

---

## 🧪 Verificar que Funciona

### 1. Verificar que el usuario existe:

```sql
SELECT id, email, nombre, apellido, rol, estado, created_at
FROM usuarios
WHERE email = 'admin@futbolreservas.com';
```

### 2. Probar login desde el frontend:

Abre la consola del navegador y ejecuta:

```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@futbolreservas.com',
    password: 'Admin123!'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 🆘 Solución de Problemas

### Error: "Credenciales incorrectas"

**Causa:** La contraseña no coincide o el usuario no existe.

**Solución:**
1. Verifica que ejecutaste el script SQL
2. Revisa que el email sea exactamente `admin@futbolreservas.com`
3. La contraseña es case-sensitive: `Admin123!`

---

### Error: "Usuario inactivo"

**Causa:** El campo `estado` no está en `'activo'`.

**Solución:**
```sql
UPDATE usuarios
SET estado = 'activo'
WHERE email = 'admin@futbolreservas.com';
```

---

### Error: "Token inválido"

**Causa:** El token JWT expiró o es inválido.

**Solución:** Haz login nuevamente para obtener un nuevo token.

---

### Error: "Cannot find module 'jsonwebtoken'"

**Causa:** Falta instalar dependencias.

**Solución:**
```bash
cd Backend
npm install jsonwebtoken bcrypt
```

---

## ✅ Checklist Final

- [ ] Script SQL ejecutado en Supabase
- [ ] Usuario admin visible en la tabla `usuarios`
- [ ] Dependencias instaladas (`jsonwebtoken`, `bcrypt`)
- [ ] Rutas actualizadas para usar `authControllerCustom`
- [ ] Servidor reiniciado
- [ ] Login probado con Postman/curl
- [ ] Token recibido correctamente
- [ ] Contraseña cambiada a una segura

---

¡Listo! Ya tienes un usuario administrador con todos los permisos. 🎉
