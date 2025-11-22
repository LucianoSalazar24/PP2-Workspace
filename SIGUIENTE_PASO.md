# 🎯 SIGUIENTE PASO - Conectar a Supabase

## ✅ Lo que ya está listo:

- ✅ Archivo `.env` creado en `Backend/.env`
- ✅ Credenciales de Supabase configuradas:
  - Host: `db.urohgbxhaghxekactoug.supabase.co`
  - Port: `5432`
  - User: `postgres`
  - Database: `postgres`
- ✅ Driver de PostgreSQL (`pg`) agregado a `package.json`
- ✅ Configuración de conexión lista en `Backend/config/supabase.js`

---

## 🔐 LO QUE NECESITAS HACER (1 minuto):

### Paso 1: Obtener tu Contraseña

1. Ve a: https://supabase.com/dashboard/project/urohgbxhaghxekactoug/settings/database
2. Busca la sección **"Database password"** o **"Connection string"**
3. Haz clic en el ícono del **ojo 👁️** para mostrar la contraseña
4. **Cópiala** (Ctrl+C)

### Paso 2: Agregar la Contraseña al .env

1. Abre el archivo `Backend/.env`
2. Busca esta línea:
   ```
   SUPABASE_PASSWORD=TU-CONTRASEÑA-AQUI
   ```
3. Reemplaza `TU-CONTRASEÑA-AQUI` con la contraseña que copiaste
4. Ejemplo: Si tu contraseña es `MiPass123!`, debe quedar:
   ```
   SUPABASE_PASSWORD=MiPass123!
   ```
5. **Guarda el archivo** (Ctrl+S)

---

## 📋 Ejemplo de cómo debe quedar:

```bash
# Backend/.env

DB_TYPE=supabase

SUPABASE_HOST=db.urohgbxhaghxekactoug.supabase.co
SUPABASE_PORT=5432
SUPABASE_USER=postgres
SUPABASE_PASSWORD=MiPasswordReal123!  ← Tu contraseña aquí
SUPABASE_DB=postgres

PORT=3000
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 Después de agregar la contraseña:

### 1. Instalar dependencias:
```bash
cd Backend
npm install
```

### 2. Ejecutar el SQL en Supabase:

**IMPORTANTE:** Antes de probar la conexión, debes crear las tablas:

1. Ve a: https://supabase.com/dashboard/project/urohgbxhaghxekactoug/sql/new
2. Copia **TODO** el contenido del archivo `BaseDeDatos/supabase_schema.sql`
3. Pégalo en el editor SQL
4. Haz clic en **Run** ▶️
5. Espera a que se complete (puede tardar 10-15 segundos)

### 3. Probar la conexión:
```bash
npm run test-connection
```

**Deberías ver:**
```
✅ CONEXIÓN EXITOSA
Tu proyecto está correctamente conectado a Supabase.
```

### 4. Iniciar el servidor:
```bash
npm start
```

---

## 🧪 Verificar que todo funciona:

### Endpoints para probar:

1. **Test general:**
   ```
   http://localhost:3000/api/test
   ```

2. **Días bloqueados:**
   ```
   http://localhost:3000/api/dias-bloqueados
   ```

   Deberías ver 13 feriados argentinos pre-cargados

3. **Frontend:**
   ```
   http://localhost:3000/Pages/diasBloqueados.html
   ```

   Deberías ver la interfaz con la lista de días bloqueados

---

## ⚠️ Si hay problemas:

### Error: "Cannot find module 'pg'"
```bash
npm install pg
```

### Error: "Faltan credenciales de Supabase"
- Verifica que guardaste el archivo `.env` después de agregar la contraseña
- Asegúrate de que el archivo esté en `Backend/.env` (no en la raíz)

### Error: "Connection timeout" o "Authentication failed"
- Verifica que la contraseña sea correcta
- Asegúrate de que no haya espacios antes o después de la contraseña
- Si no funciona, resetea la contraseña en Supabase y vuelve a intentar

### Error: "relation does not exist" o "table not found"
- No ejecutaste el SQL completo en Supabase
- Ve al SQL Editor y ejecuta `BaseDeDatos/supabase_schema.sql`

---

## 📊 ¿Qué se creará en Supabase?

Al ejecutar el SQL, se crearán:

✅ **10 Tablas:**
- canchas
- tipos_cliente
- clientes
- estados_reserva
- reservas
- pagos
- configuraciones
- bloqueos_horarios
- usuarios
- **dias_bloqueados** ⭐ (nueva funcionalidad)

✅ **Datos iniciales:**
- 3 tipos de cliente (regular, frecuente, vip)
- 5 estados de reserva
- 3 canchas de ejemplo
- 7 configuraciones del sistema
- **13 feriados nacionales argentinos 2025** 🇦🇷

✅ **5 Vistas optimizadas**
✅ **8 Triggers automáticos**
✅ **5 Funciones auxiliares**
✅ **Row Level Security (RLS) habilitado**

---

## 🎉 Resumen de 3 pasos:

1. ✅ Obtener contraseña de Supabase → Agregar a `Backend/.env`
2. ✅ Ejecutar `BaseDeDatos/supabase_schema.sql` en SQL Editor de Supabase
3. ✅ Ejecutar `npm install` y luego `npm start`

---

## 🆘 ¿Necesitas ayuda?

1. Ejecuta `npm run test-connection` para ver un diagnóstico detallado
2. Lee la guía completa en `GUIA_SUPABASE.md`
3. Revisa los mensajes de error en la consola del servidor

---

**Tiempo estimado:** 5 minutos
**Dificultad:** Fácil ⭐

¡Estás a solo 1 paso de tener tu proyecto conectado a Supabase! 🚀
