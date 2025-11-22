# ⚡ EJECUTAR AHORA - Crear Usuario Admin

## 🎯 Pasos Rápidos (5 minutos)

### 1️⃣ Ejecutar SQL en Supabase

1. Ve a https://supabase.com
2. Abre tu proyecto
3. Ve a **SQL Editor** (icono de base de datos)
4. Haz clic en **+ New query**
5. Copia y pega este código:

```sql
-- Crear usuario administrador
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Verificar
SELECT id, email, nombre, apellido, rol, estado
FROM usuarios
WHERE email = 'admin@futbolreservas.com';
```

6. Haz clic en **Run** (▶️)

Deberías ver:

```
id | email                        | nombre        | apellido | rol   | estado
---|------------------------------|---------------|----------|-------|--------
1  | admin@futbolreservas.com     | Administrador | Sistema  | admin | activo
```

---

### 2️⃣ Instalar Dependencias

Abre una terminal en la carpeta del proyecto:

```bash
cd Backend
npm install jsonwebtoken bcrypt
```

---

### 3️⃣ Actualizar Rutas (IMPORTANTE)

Abre el archivo `Backend/Routes/auth.js` y busca esta línea:

```javascript
const authController = require('../controllers/authController');
```

**Cámbiala por:**

```javascript
const authController = require('../controllers/authControllerCustom');
```

---

### 4️⃣ Reiniciar Servidor

```bash
cd Backend
npm start
```

---

### 5️⃣ Probar Login

**Opción A: Con curl (terminal)**

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@futbolreservas.com\",\"password\":\"Admin123!\"}"
```

**Opción B: Con JavaScript (consola del navegador)**

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

**Resultado esperado:**

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
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## ✅ Checklist

- [ ] SQL ejecutado en Supabase ✅
- [ ] Usuario visible en tabla `usuarios` ✅
- [ ] `npm install jsonwebtoken bcrypt` ejecutado ✅
- [ ] Archivo `auth.js` actualizado ✅
- [ ] Servidor reiniciado ✅
- [ ] Login probado ✅

---

## 🔐 Credenciales del Admin

```
Email:    admin@futbolreservas.com
Password: Admin123!
Rol:      admin
```

⚠️ **IMPORTANTE:** Cambia la contraseña después del primer login!

---

## 🆘 Si algo falla

### Error: "module 'jsonwebtoken' not found"
```bash
cd Backend
npm install jsonwebtoken bcrypt
```

### Error: "Credenciales incorrectas"
Verifica que ejecutaste el SQL en Supabase:
```sql
SELECT * FROM usuarios WHERE email = 'admin@futbolreservas.com';
```

### Error: "ECONNREFUSED" al hacer login
Verifica que el servidor esté corriendo:
```bash
cd Backend
npm start
```

---

¡Listo! Ya puedes usar el admin. 🎉
