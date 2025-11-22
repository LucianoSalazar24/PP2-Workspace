# 🚨 SIGUIENTE PASO: Ejecutar SQL en Supabase

## ✅ Buenas Noticias

¡Tu conexión a Supabase está funcionando perfectamente! 🎉

```
✅ Conectado a Supabase (PostgreSQL) exitosamente
📊 Base de datos: postgres
🌐 Host: db.urohgbxhaghxekactoug.supabase.co
```

---

## ⚠️ Falta crear las tablas

El mensaje de error `relation "dias_bloqueados" does not exist` significa que **aún no has ejecutado el script SQL** para crear las tablas.

---

## 📋 Instrucciones (2 minutos):

### Paso 1: Abrir el SQL Editor

Haz clic en este enlace o cópialo en tu navegador:

```
https://supabase.com/dashboard/project/urohgbxhaghxekactoug/sql/new
```

### Paso 2: Copiar el SQL

1. Abre el archivo: `BaseDeDatos/supabase_schema.sql`
2. Selecciona TODO el contenido (Ctrl+A)
3. Cópialo (Ctrl+C)

**El archivo tiene 1,056 líneas y crea:**
- 10 tablas
- 5 vistas
- 8 triggers
- 5 funciones
- Datos de ejemplo (feriados, configuraciones, etc.)

### Paso 3: Pegar y Ejecutar

1. En el SQL Editor de Supabase (el enlace de arriba)
2. Pega el código completo (Ctrl+V)
3. Haz clic en el botón **"Run"** ▶️ (esquina inferior derecha)
4. Espera 10-15 segundos mientras se ejecuta

### Paso 4: Verificar

Deberías ver un mensaje de éxito como:

```
Schema creado exitosamente
Base de datos: Sistema de Reservas de Canchas
Versión: 1.1
Tablas: 10 principales + 5 vistas
Triggers: 8 automáticos
Funciones: 5 auxiliares
RLS: Habilitado en todas las tablas
```

---

## 🔍 Verificar que se crearon las tablas

1. En Supabase, ve a **"Table Editor"** (menú lateral izquierdo)
2. Deberías ver estas 10 tablas:

   ✅ bloqueos_horarios
   ✅ canchas
   ✅ clientes
   ✅ configuraciones
   ✅ **dias_bloqueados** ⭐
   ✅ estados_reserva
   ✅ pagos
   ✅ reservas
   ✅ tipos_cliente
   ✅ usuarios

3. Haz clic en **"dias_bloqueados"**
4. Deberías ver 13 registros (feriados argentinos 2025)

---

## ✅ Después de ejecutar el SQL

Vuelve a la terminal y ejecuta:

```bash
npm run test-connection
```

Ahora deberías ver:

```
✅ CONEXIÓN EXITOSA
Tu proyecto está correctamente conectado a Supabase.
Puedes iniciar el servidor con: npm start
```

---

## 🚀 Iniciar el servidor

```bash
npm start
```

Deberías ver:

```
🚀 Usando Supabase (PostgreSQL)
✅ Conectado a Supabase (PostgreSQL) exitosamente
📊 Base de datos: postgres
🌐 Host: db.urohgbxhaghxekactoug.supabase.co
✅ Todas las tablas están presentes
========================================
Servidor corriendo en puerto 3000
URL: http://localhost:3000
API: http://localhost:3000/api
========================================
```

---

## 🧪 Probar que todo funciona

### 1. API de días bloqueados:

Abre en tu navegador:
```
http://localhost:3000/api/dias-bloqueados
```

Deberías ver un JSON con 13 feriados.

### 2. Frontend:

Abre en tu navegador:
```
http://localhost:3000/Pages/diasBloqueados.html
```

Deberías ver la interfaz de gestión de días bloqueados.

---

## ⚠️ Si hay problemas

### Error: "syntax error at or near..."

- No copiaste el SQL completo
- Asegúrate de copiar TODAS las 1,056 líneas
- Desde la línea 1 hasta el final

### Error: "type already exists"

- Las tablas ya existen parcialmente
- Opción 1: Elimina todas las tablas manualmente y vuelve a ejecutar
- Opción 2: Crea un nuevo proyecto en Supabase

### No veo el botón "Run"

- Asegúrate de estar en el SQL Editor
- El botón está en la esquina inferior derecha
- También puedes presionar `Ctrl+Enter`

---

## 📊 Resumen:

1. ✅ Conexión funcionando
2. ⏳ Ejecutar SQL (hazlo ahora)
3. ⏳ Verificar tablas
4. ⏳ `npm run test-connection`
5. ⏳ `npm start`
6. ⏳ Probar en el navegador

---

**Enlace directo al SQL Editor:**
https://supabase.com/dashboard/project/urohgbxhaghxekactoug/sql/new

**Archivo a copiar:**
`BaseDeDatos/supabase_schema.sql`

---

¡Estás muy cerca! Solo ejecuta el SQL y listo. 🚀
