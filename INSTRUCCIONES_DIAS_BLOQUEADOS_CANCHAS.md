# 🔐 Gestión de Días Bloqueados por Cancha - Instrucciones Completas

## 📋 Resumen de Cambios Implementados

Se ha implementado un sistema completo para gestionar días bloqueados relacionados con canchas específicas, incluyendo:

1. ✅ **Relación entre días bloqueados y canchas** (una cancha o todas)
2. ✅ **Validación automática en reservas** (trigger en BD)
3. ✅ **Control de acceso por rol** (solo admin puede gestionar)
4. ✅ **Frontend actualizado** con selector de canchas y permisos

---

## 🗂️ Archivos Modificados/Creados

### Base de Datos:
- ✅ [BaseDeDatos/migracion_dias_bloqueados_cancha.sql](BaseDeDatos/migracion_dias_bloqueados_cancha.sql) - Script de migración
- ✅ [BaseDeDatos/crear_admin.sql](BaseDeDatos/crear_admin.sql) - Usuario admin

### Backend:
- ✅ [Backend/Controllers/diasBloqueadosControllerSupabase.js](Backend/Controllers/diasBloqueadosControllerSupabase.js) - Controlador actualizado
- ✅ [Backend/Controllers/reservaController.js](Backend/Controllers/reservaController.js) - Validación de bloqueos
- ✅ [Backend/Controllers/authControllerCustom.js](Backend/Controllers/authControllerCustom.js) - Autenticación personalizada

### Frontend:
- ✅ [Frontend/Pages/diasBloqueados.html](Frontend/Pages/diasBloqueados.html) - HTML con control de acceso
- ✅ [Frontend/JS/diasBloqueados.js](Frontend/JS/diasBloqueados.js) - JavaScript con permisos y canchas

---

## 🚀 Paso a Paso para Implementar

### 1️⃣ Ejecutar Migración de Base de Datos

Ve a tu proyecto en [Supabase](https://supabase.com) y ejecuta:

```sql
-- Archivo: migracion_dias_bloqueados_cancha.sql

-- Agregar columna cancha_id
ALTER TABLE dias_bloqueados
ADD COLUMN cancha_id INTEGER DEFAULT NULL;

-- Agregar clave foránea
ALTER TABLE dias_bloqueados
ADD CONSTRAINT fk_dias_bloqueados_cancha
    FOREIGN KEY (cancha_id)
    REFERENCES canchas(id)
    ON DELETE CASCADE;

-- Crear índices
CREATE INDEX idx_dias_bloqueados_cancha_id ON dias_bloqueados(cancha_id);
CREATE INDEX idx_dias_bloqueados_fecha_cancha ON dias_bloqueados(fecha, cancha_id);

-- Función para verificar bloqueos
CREATE OR REPLACE FUNCTION es_cancha_bloqueada(p_cancha_id INTEGER, p_fecha DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM dias_bloqueados
        WHERE fecha = p_fecha
        AND (cancha_id = p_cancha_id OR cancha_id IS NULL)
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar reservas
CREATE OR REPLACE FUNCTION validar_dia_bloqueado_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_bloqueado BOOLEAN;
    v_motivo VARCHAR;
BEGIN
    SELECT es_cancha_bloqueada(NEW.cancha_id, NEW.fecha) INTO v_bloqueado;

    IF v_bloqueado THEN
        SELECT motivo INTO v_motivo
        FROM dias_bloqueados
        WHERE fecha = NEW.fecha
        AND (cancha_id = NEW.cancha_id OR cancha_id IS NULL)
        LIMIT 1;

        RAISE EXCEPTION 'No se puede reservar en esta fecha. Motivo: %', v_motivo;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_dia_bloqueado ON reservas;
CREATE TRIGGER trigger_validar_dia_bloqueado
    BEFORE INSERT OR UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION validar_dia_bloqueado_reserva();
```

### 2️⃣ Crear Usuario Administrador

Ejecuta el script [BaseDeDatos/crear_admin.sql](BaseDeDatos/crear_admin.sql) en Supabase:

```sql
INSERT INTO usuarios (
    email,
    password,
    nombre,
    apellido,
    rol,
    estado
) VALUES (
    'admin@futbolreservas.com',
    crypt('Admin123!', gen_salt('bf', 10)),
    'Administrador',
    'Sistema',
    'admin',
    'activo'
)
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    rol = 'admin',
    estado = 'activo';
```

**Credenciales:**
- Email: `admin@futbolreservas.com`
- Password: `Admin123!`

### 3️⃣ Actualizar Autenticación en el Backend

Edita [Backend/Routes/auth.js](Backend/Routes/auth.js):

```javascript
// Cambiar esta línea:
const authController = require('../controllers/authController');

// Por esta:
const authController = require('../controllers/authControllerCustom');
```

### 4️⃣ Instalar Dependencias

```bash
cd Backend
npm install jsonwebtoken bcrypt
```

### 5️⃣ Reiniciar el Servidor

```bash
cd Backend
npm start
```

---

## 🎯 Funcionalidades Implementadas

### 1. Bloqueos Flexibles

**Bloquear TODAS las canchas:**
```javascript
{
  "fecha": "2025-12-25",
  "motivo": "Navidad",
  "descripcion": "Feriado nacional",
  "cancha_id": null  // o no incluir este campo
}
```

**Bloquear UNA cancha específica:**
```javascript
{
  "fecha": "2025-12-15",
  "motivo": "Mantenimiento",
  "descripcion": "Cambio de césped sintético",
  "cancha_id": 1  // Solo bloquea Cancha 1
}
```

### 2. Validación Automática en Reservas

El trigger `validar_dia_bloqueado_reserva` se ejecuta automáticamente al:
- ✅ Crear nueva reserva (INSERT)
- ✅ Modificar fecha/cancha de reserva existente (UPDATE)

Si la cancha está bloqueada, la operación falla con un mensaje claro.

### 3. Control de Acceso por Rol

#### Usuario Admin (rol = 'admin'):
- ✅ Ver todos los días bloqueados
- ✅ Crear nuevos bloqueos
- ✅ Editar bloqueos existentes
- ✅ Eliminar bloqueos
- ✅ Seleccionar cancha específica o todas

#### Usuario Cliente (rol = 'cliente'):
- ✅ Ver días bloqueados (solo lectura)
- ❌ NO puede crear/editar/eliminar

#### Usuario No Autenticado:
- ✅ Ver días bloqueados (solo lectura)
- ❌ NO puede crear/editar/eliminar

---

## 🧪 Pruebas

### Probar Login como Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@futbolreservas.com",
    "password": "Admin123!"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "admin@futbolreservas.com",
    "nombre": "Administrador",
    "apellido": "Sistema",
    "rol": "admin",
    "access_token": "eyJhbGc..."
  }
}
```

### Probar Crear Bloqueo (Admin)

```bash
curl -X POST http://localhost:3000/api/dias-bloqueados \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -d '{
    "fecha": "2025-12-31",
    "motivo": "Fin de Año",
    "descripcion": "Cerrado por celebración",
    "cancha_id": null
  }'
```

### Probar Bloqueo Solo para Cancha Específica

```bash
curl -X POST http://localhost:3000/api/dias-bloqueados \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -d '{
    "fecha": "2025-12-15",
    "motivo": "Mantenimiento",
    "descripcion": "Cambio de césped",
    "cancha_id": 1
  }'
```

### Probar Validación en Reserva

Intentar crear una reserva en un día bloqueado:

```bash
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "cancha_id": 1,
    "cliente_id": 1,
    "fecha": "2025-12-25",
    "hora_inicio": "14:00",
    "hora_fin": "16:00"
  }'
```

Respuesta esperada (error 403):
```json
{
  "success": false,
  "message": "No se puede reservar en esta fecha. Navidad",
  "motivo": "Navidad",
  "descripcion": "Feriado nacional",
  "alcance": "Todas las canchas"
}
```

---

## 🎨 Uso del Frontend

### Acceder a la Página

```
http://localhost:3000/Pages/diasBloqueados.html
```

### Como Admin:

1. **Login** en el sistema con credenciales admin
2. El token se guarda automáticamente en `localStorage`
3. Al abrir la página de días bloqueados:
   - ✅ Botón "Agregar Día Bloqueado" visible
   - ✅ Botones de Editar/Eliminar en cada fila
   - ✅ Selector de cancha en el formulario

### Como Cliente o No Autenticado:

- ✅ Solo visualización (modo lectura)
- ❌ Sin botones de acciones
- ❌ Sin opción de agregar/editar/eliminar

---

## 📊 Estructura de la Base de Datos

### Tabla `dias_bloqueados`:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER | ID único |
| `fecha` | DATE | Fecha bloqueada |
| `motivo` | VARCHAR(200) | Motivo del bloqueo |
| `descripcion` | TEXT | Descripción adicional (opcional) |
| `cancha_id` | INTEGER | ID de cancha (NULL = todas) |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |

### Relaciones:

```
dias_bloqueados ──┐
                  ├──[FK]──> canchas
reservas ────────┘
```

---

## 🔍 Consultas Útiles

### Ver todos los bloqueos con información de cancha:

```sql
SELECT
    db.id,
    db.fecha,
    db.motivo,
    db.descripcion,
    CASE
        WHEN db.cancha_id IS NULL THEN 'Todas las canchas'
        ELSE c.nombre
    END as alcance
FROM dias_bloqueados db
LEFT JOIN canchas c ON db.cancha_id = c.id
ORDER BY db.fecha DESC;
```

### Verificar si una cancha está bloqueada:

```sql
SELECT es_cancha_bloqueada(1, '2025-12-25');  -- TRUE o FALSE
```

### Ver próximos días bloqueados:

```sql
SELECT * FROM dias_bloqueados
WHERE fecha >= CURRENT_DATE
ORDER BY fecha ASC
LIMIT 10;
```

---

## ⚠️ Consideraciones Importantes

### 1. Jerarquía de Bloqueos

- **`cancha_id = NULL`** → Bloquea TODAS las canchas
- **`cancha_id = N`** → Bloquea solo la cancha N

Si existen ambos tipos de bloqueo para la misma fecha, **ambos se respetan**.

### 2. Validación en Reservas

El trigger valida automáticamente:
- ✅ Al crear nueva reserva
- ✅ Al modificar fecha de reserva existente
- ✅ Al cambiar cancha de reserva existente

### 3. Eliminación en Cascada

Si eliminas una cancha:
- ✅ Los bloqueos específicos de esa cancha también se eliminan
- ✅ Los bloqueos globales (cancha_id = NULL) NO se ven afectados

### 4. Seguridad

- ✅ Solo usuarios admin pueden crear/editar/eliminar bloqueos
- ✅ El backend valida el rol antes de permitir operaciones
- ✅ El trigger de BD es la última capa de validación

---

## 🆘 Solución de Problemas

### Error: "Column 'cancha_id' does not exist"

**Causa:** No ejecutaste la migración de BD.

**Solución:** Ejecuta [migracion_dias_bloqueados_cancha.sql](BaseDeDatos/migracion_dias_bloqueados_cancha.sql)

---

### Error: "Solo los administradores pueden..."

**Causa:** No estás autenticado como admin o el token expiró.

**Solución:**
1. Haz login con credenciales admin
2. Verifica que el token esté en localStorage: `localStorage.getItem('sesion')`

---

### Los botones admin no aparecen

**Causa:** El frontend no detecta que eres admin.

**Solución:**
1. Abre la consola del navegador
2. Ejecuta: `JSON.parse(localStorage.getItem('sesion')).rol`
3. Debe mostrar `"admin"`
4. Si no, haz login nuevamente

---

### Error: "No se puede reservar en esta fecha"

**Causa:** La fecha/cancha está bloqueada (funcionando correctamente).

**Solución:**
1. Verifica los bloqueos: `GET /api/dias-bloqueados`
2. Elige otra fecha o elimina el bloqueo (como admin)

---

## ✅ Checklist Final

- [ ] Migración SQL ejecutada en Supabase
- [ ] Usuario admin creado y probado
- [ ] Dependencias instaladas (`jsonwebtoken`, `bcrypt`)
- [ ] Rutas de autenticación actualizadas
- [ ] Servidor reiniciado
- [ ] Login admin probado
- [ ] Creación de bloqueo probada
- [ ] Validación en reservas probada
- [ ] Frontend con permisos funcionando

---

## 🎉 ¡Listo!

Ya tienes un sistema completo de gestión de días bloqueados con:

1. ✅ Relación con canchas (específica o todas)
2. ✅ Validación automática en reservas
3. ✅ Control de acceso por rol (admin vs cliente)
4. ✅ Frontend funcional con permisos
5. ✅ Triggers de base de datos para integridad

**Próximos pasos sugeridos:**
- Agregar notificaciones cuando se intente reservar en día bloqueado
- Implementar log de auditoría para cambios en bloqueos
- Crear reportes de días bloqueados históricos
