# ⚡ Conexión Rápida a Supabase - 5 Pasos

## 1️⃣ Instalar PostgreSQL Driver

```bash
cd Backend
npm install pg
```

## 2️⃣ Crear archivo .env

✅ **Ya está creado en `Backend/.env`** - Solo necesitas agregar tu contraseña:

1. Abre el archivo `Backend/.env`
2. Busca la línea: `SUPABASE_PASSWORD=TU-CONTRASEÑA-AQUI`
3. Reemplaza `TU-CONTRASEÑA-AQUI` con tu contraseña real
4. Guarda el archivo

**Tus credenciales:**
```bash
DB_TYPE=supabase

SUPABASE_HOST=db.urohgbxhaghxekactoug.supabase.co
SUPABASE_PORT=5432
SUPABASE_USER=postgres
SUPABASE_PASSWORD=TU-CONTRASEÑA-AQUI  ← Reemplaza esto
SUPABASE_DB=postgres

PORT=3000
FRONTEND_URL=http://localhost:3000
```

## 3️⃣ Ejecutar SQL en Supabase

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre **SQL Editor**
3. Copia TODO el contenido de `BaseDeDatos/supabase_schema.sql`
4. Pégalo y haz clic en **Run** ▶️

## 4️⃣ Verificar Tablas

Ve a **Table Editor** y verifica que existan estas 10 tablas:
- ✅ canchas
- ✅ tipos_cliente
- ✅ clientes
- ✅ estados_reserva
- ✅ reservas
- ✅ pagos
- ✅ configuraciones
- ✅ bloqueos_horarios
- ✅ usuarios
- ✅ **dias_bloqueados** ⭐ (nueva)

## 5️⃣ Iniciar el Servidor

```bash
cd Backend
npm start
```

Deberías ver:
```
🚀 Usando Supabase (PostgreSQL)
✅ Conectado a Supabase (PostgreSQL) exitosamente
📊 Base de datos: postgres
🌐 Host: db.xxxxxxxxxxxxx.supabase.co
✅ Todas las tablas están presentes
```

---

## 🧪 Probar la Conexión

### Endpoint de Test:
```
http://localhost:3000/api/test
```

### Días Bloqueados:
```
http://localhost:3000/api/dias-bloqueados
```

### Frontend:
```
http://localhost:3000/Pages/diasBloqueados.html
```

---

## 🔄 Cambiar a MariaDB Local

Solo cambia en `.env`:
```bash
DB_TYPE=mariadb
```

Y reinicia el servidor.

---

## 🆘 ¿Problemas?

Lee la guía completa en: [GUIA_SUPABASE.md](GUIA_SUPABASE.md)

### Errores Comunes:

**"Cannot find module 'pg'"**
```bash
npm install pg
```

**"Faltan credenciales de Supabase"**
- Verifica que el archivo `.env` esté en `Backend/.env`
- Verifica que `SUPABASE_HOST` y `SUPABASE_PASSWORD` estén correctos

**"Connection timeout"**
- Verifica tus credenciales en Supabase Dashboard
- Asegúrate de que tu proyecto de Supabase esté activo

---

## 📝 Obtener Credenciales de Supabase

1. Supabase Dashboard → Tu Proyecto
2. **Settings** → **Database**
3. Copia:
   - Host
   - Database name
   - Port
   - User
   - Password (la que configuraste al crear el proyecto)

---

¡Listo! 🎉
