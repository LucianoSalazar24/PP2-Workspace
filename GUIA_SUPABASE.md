# 🚀 Guía para Conectar tu Proyecto a Supabase

Esta guía te ayudará a migrar tu proyecto desde MariaDB local a Supabase (PostgreSQL en la nube).

---

## 📋 Paso 1: Instalar Dependencias

Abre una terminal en la carpeta `Backend` y ejecuta:

```bash
cd Backend
npm install pg dotenv
```

**Qué instala:**
- `pg` - Driver de PostgreSQL para Node.js
- `dotenv` - Ya debería estar instalado, pero por si acaso

---

## 🔑 Paso 2: Obtener Credenciales de Supabase

### 2.1 Ir a tu Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión
3. Selecciona tu proyecto (o crea uno nuevo)

### 2.2 Obtener Credenciales de Base de Datos

1. En el menú lateral, ve a **Settings** (⚙️)
2. Haz clic en **Database**
3. Busca la sección **Connection string**
4. Verás algo como:

```
Host: db.xxxxxxxxxxxxx.supabase.co
Database name: postgres
Port: 5432
User: postgres
Password: [tu contraseña]
```

### 2.3 Obtener API Keys (Opcional, para el frontend)

1. En el menú lateral, ve a **Settings** (⚙️)
2. Haz clic en **API**
3. Copia:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public**: Tu clave pública
   - **service_role**: Tu clave privada (NUNCA la compartas)

---

## 🔧 Paso 3: Configurar Variables de Entorno

### 3.1 Crear archivo .env

En la carpeta `Backend/`, crea un archivo llamado `.env` (sin extensión, solo `.env`)

### 3.2 Copiar y Completar las Variables

Abre el archivo `.env` y pega esto, **reemplazando con tus datos**:

```bash
# ============================================
# TIPO DE BASE DE DATOS
# ============================================
# Cambia a 'supabase' para usar Supabase
DB_TYPE=supabase

# ============================================
# MARIADB (Local)
# ============================================
DB_HOST=localhost
DB_PORT=3306
DB_USER=lucho
DB_PASSWORD=2448
DB_NAME=futbol_reservas

# ============================================
# SUPABASE (PostgreSQL)
# ============================================

# Reemplaza estos valores con los de tu proyecto
SUPABASE_HOST=db.xxxxxxxxxxxxx.supabase.co
SUPABASE_PORT=5432
SUPABASE_USER=postgres
SUPABASE_PASSWORD=TU-CONTRASEÑA-AQUI
SUPABASE_DB=postgres

# API Keys (opcional)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-key

# ============================================
# SERVIDOR
# ============================================
PORT=3000
FRONTEND_URL=http://localhost:3000
```

### 3.3 Ejemplo Real

Si tus credenciales son:
- Host: `db.abcdefghijk.supabase.co`
- Password: `MiContraseña123!`

Tu `.env` debería verse así:

```bash
DB_TYPE=supabase

SUPABASE_HOST=db.abcdefghijk.supabase.co
SUPABASE_PORT=5432
SUPABASE_USER=postgres
SUPABASE_PASSWORD=MiContraseña123!
SUPABASE_DB=postgres
```

---

## 💾 Paso 4: Ejecutar el Script SQL en Supabase

### 4.1 Abrir el SQL Editor

1. En tu proyecto de Supabase, ve a **SQL Editor** en el menú lateral
2. Haz clic en **+ New query**

### 4.2 Copiar el Script SQL

1. Abre el archivo `BaseDeDatos/supabase_schema.sql`
2. Copia **TODO** el contenido (Ctrl+A, Ctrl+C)
3. Pégalo en el SQL Editor de Supabase

### 4.3 Ejecutar el Script

1. Haz clic en el botón **Run** (▶️) o presiona `Ctrl+Enter`
2. Espera a que se complete (puede tardar unos segundos)
3. Deberías ver mensajes de éxito

### 4.4 Verificar que las Tablas se Crearon

1. Ve a **Table Editor** en el menú lateral
2. Deberías ver 10 tablas:
   - ✅ canchas
   - ✅ tipos_cliente
   - ✅ clientes
   - ✅ estados_reserva
   - ✅ reservas
   - ✅ pagos
   - ✅ configuraciones
   - ✅ bloqueos_horarios
   - ✅ usuarios
   - ✅ dias_bloqueados

---

## 🚀 Paso 5: Actualizar server.js

Abre `Backend/server.js` y asegúrate de que la línea que importa la base de datos use el nuevo sistema:

```javascript
// Cambiar esto:
const db = require('./config/database');

// Por esto:
const db = require('./config');
```

**Encuentra la línea 112** aproximadamente y verifica que diga:

```javascript
const db = require('./config');
await db.initialize();
```

---

## ▶️ Paso 6: Iniciar el Servidor

### 6.1 Detener el Servidor Actual

Si tu servidor está corriendo, deténlo con `Ctrl+C`

### 6.2 Iniciar con Supabase

```bash
cd Backend
npm start
```

### 6.3 Verificar la Conexión

Deberías ver en la consola:

```
🚀 Usando Supabase (PostgreSQL)
✅ Conectado a Supabase (PostgreSQL) exitosamente
📊 Base de datos: postgres
🌐 Host: db.xxxxxxxxxxxxx.supabase.co
✅ Todas las tablas están presentes
```

---

## 🔍 Paso 7: Probar la Conexión

### 7.1 Probar el Endpoint de Test

Abre tu navegador o Postman y ve a:

```
http://localhost:3000/api/test
```

Deberías ver:

```json
{
  "success": true,
  "message": "API funcionando correctamente",
  "timestamp": "2025-11-22T..."
}
```

### 7.2 Probar Días Bloqueados

```
http://localhost:3000/api/dias-bloqueados
```

Deberías ver la lista de feriados pre-cargados:

```json
{
  "success": true,
  "count": 13,
  "data": [
    {
      "id": 1,
      "fecha": "2025-01-01",
      "motivo": "Feriado Nacional",
      "descripcion": "Año Nuevo",
      ...
    },
    ...
  ]
}
```

---

## 🎯 Paso 8: Configurar el Frontend

### 8.1 Actualizar config.js

Abre `Frontend/JS/config.js` y verifica que la URL de la API sea correcta:

```javascript
const API_URL = 'http://localhost:3000/api';
```

### 8.2 Abrir la Página de Días Bloqueados

Navega a:

```
http://localhost:3000/Pages/diasBloqueados.html
```

Deberías ver la interfaz con los feriados cargados.

---

## 🔄 Cambiar entre MariaDB y Supabase

Para alternar entre bases de datos, solo necesitas cambiar **una línea** en tu `.env`:

### Usar Supabase:
```bash
DB_TYPE=supabase
```

### Usar MariaDB local:
```bash
DB_TYPE=mariadb
```

Reinicia el servidor después de cambiar.

---

## ⚠️ Solución de Problemas

### Error: "Faltan credenciales de Supabase"

**Problema:** No configuraste el archivo `.env` correctamente

**Solución:**
1. Verifica que el archivo `.env` esté en `Backend/.env`
2. Asegúrate de que tenga las variables `SUPABASE_HOST` y `SUPABASE_PASSWORD`
3. Reinicia el servidor

---

### Error: "Cannot find module 'pg'"

**Problema:** No instalaste el driver de PostgreSQL

**Solución:**
```bash
cd Backend
npm install pg
```

---

### Error: "Connection timeout"

**Problema:** Las credenciales son incorrectas o hay un problema de red

**Solución:**
1. Verifica que copiaste bien el **Host** y la **Password**
2. Verifica que tu proyecto de Supabase esté activo
3. Prueba la conexión desde el SQL Editor de Supabase primero

---

### Error: "Tablas faltantes"

**Problema:** No ejecutaste el script SQL completo

**Solución:**
1. Ve al SQL Editor de Supabase
2. Ejecuta el archivo `supabase_schema.sql` completo
3. Verifica en Table Editor que todas las tablas existan

---

### Error: "SSL connection required"

**Problema:** Supabase requiere SSL

**Solución:** Ya está configurado en `config/supabase.js`. Si el error persiste, verifica que la configuración SSL esté presente:

```javascript
ssl: {
    rejectUnauthorized: false
}
```

---

## 📊 Verificar que Todo Funciona

### ✅ Checklist Final

- [ ] Archivo `.env` creado con credenciales correctas
- [ ] `npm install pg` ejecutado
- [ ] Script SQL ejecutado en Supabase
- [ ] 10 tablas visibles en Table Editor
- [ ] Servidor inicia sin errores
- [ ] Mensaje "✅ Conectado a Supabase" en consola
- [ ] `/api/test` responde correctamente
- [ ] `/api/dias-bloqueados` retorna datos
- [ ] Frontend carga los días bloqueados

---

## 🎉 ¡Listo!

Tu proyecto ahora está conectado a Supabase. Puedes:

1. ✅ Gestionar días bloqueados desde el frontend
2. ✅ Las tablas están en la nube (accesibles desde cualquier lugar)
3. ✅ Backups automáticos de Supabase
4. ✅ Panel de administración en Supabase Dashboard

---

## 📝 Notas Adicionales

### Datos de Ejemplo

El script SQL ya incluye:
- 3 tipos de cliente (regular, frecuente, vip)
- 5 estados de reserva
- 3 canchas de ejemplo
- 7 configuraciones del sistema
- 13 feriados nacionales argentinos 2025

### Seguridad

- ✅ Row Level Security (RLS) habilitado
- ✅ Solo admins pueden crear/modificar/eliminar
- ✅ Triggers automáticos para updated_at
- ✅ Validaciones en base de datos

### Performance

- ✅ 20+ índices optimizados
- ✅ Pool de conexiones
- ✅ Búsquedas de texto con pg_trgm

---

¿Necesitas ayuda? Revisa los logs del servidor para ver mensajes de error específicos.
