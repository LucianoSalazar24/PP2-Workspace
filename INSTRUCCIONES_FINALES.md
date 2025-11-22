# 🎯 INSTRUCCIONES FINALES - Ejecutar SQL en Supabase

## ✅ Tu proyecto está listo

Tu conexión a Supabase está funcionando perfectamente. Solo falta ejecutar el script SQL que creará todas las tablas.

---

## 📋 PASO A PASO (2 minutos):

### 1. Abrir el SQL Editor de Supabase

Copia este enlace en tu navegador:

```
https://supabase.com/dashboard/project/urohgbxhaghxekactoug/sql/new
```

### 2. Copiar el SQL

1. Abre el archivo: [BaseDeDatos/supabase_schema_clean.sql](BaseDeDatos/supabase_schema_clean.sql)
2. Selecciona TODO el contenido (Ctrl+A)
3. Cópialo (Ctrl+C)

**Este archivo:**
- Primero elimina cualquier objeto existente
- Luego crea todo desde cero
- No dará errores de "already exists"

### 3. Pegar y Ejecutar

1. En el SQL Editor de Supabase
2. Pega el código completo (Ctrl+V)
3. Haz clic en el botón **"Run"** ▶️ (esquina inferior derecha)
4. Espera 10-15 segundos

### 4. Verificar Éxito

Deberías ver mensajes como:

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

## 🔍 Verificar las Tablas

1. En Supabase, ve a **"Table Editor"** (menú lateral izquierdo)
2. Deberías ver estas 10 tablas:

   ✅ bloqueos_horarios
   ✅ canchas
   ✅ clientes
   ✅ configuraciones
   ✅ **dias_bloqueados** ⭐ (nueva funcionalidad)
   ✅ estados_reserva
   ✅ pagos
   ✅ reservas
   ✅ tipos_cliente
   ✅ usuarios

3. Haz clic en **"dias_bloqueados"**
4. Deberías ver 13 registros (feriados argentinos 2025)

---

## 🚀 Iniciar tu Proyecto

### 1. Instalar dependencias (si no lo hiciste):

```bash
cd Backend
npm install
```

### 2. Probar la conexión:

```bash
npm run test-connection
```

Deberías ver:

```
✅ CONEXIÓN EXITOSA
✅ Conectado a Supabase (PostgreSQL) exitosamente
📊 Base de datos: postgres
🌐 Host: db.urohgbxhaghxekactoug.supabase.co
✅ Todas las tablas están presentes
```

### 3. Iniciar el servidor:

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

## 🧪 Probar tu Aplicación

### 1. API de días bloqueados:

Abre en tu navegador:
```
http://localhost:3000/api/dias-bloqueados
```

Deberías ver un JSON con 13 feriados argentinos 2025.

### 2. Frontend de días bloqueados:

Abre en tu navegador:
```
http://localhost:3000/Pages/diasBloqueados.html
```

Deberías ver la interfaz de gestión de días bloqueados con:
- Lista de feriados
- Botón para agregar nuevos días bloqueados
- Filtros por mes y motivo
- Estadísticas

### 3. Otros endpoints:

```
http://localhost:3000/api/test
http://localhost:3000/api/canchas
http://localhost:3000/api/reservas
http://localhost:3000/api/clientes
```

---

## 📊 Datos Pre-cargados

El script SQL crea automáticamente:

### Tipos de Cliente:
- Regular
- Frecuente (>10 reservas)
- VIP (>50 reservas)

### Estados de Reserva:
- Pendiente
- Confirmada
- Completada
- Cancelada
- No show

### Canchas de Ejemplo:
- Cancha 1 (Fútbol 11 - césped sintético)
- Cancha 2 (Fútbol 7 - césped natural)
- Cancha 3 (Fútbol 5 - césped sintético)

### Feriados Argentinos 2025:
- 13 feriados nacionales pre-cargados
- Desde Año Nuevo hasta Navidad

### Configuraciones del Sistema:
- Horarios de apertura/cierre
- Duración mínima de reserva
- Tiempo de anticipación
- Porcentaje de seña
- Tiempo límite de cancelación

---

## ⚠️ Si hay Errores

### Error: "syntax error at or near..."

- No copiaste el SQL completo
- Asegúrate de copiar desde la línea 1 hasta el final del archivo

### Error: "permission denied"

- Ve a Settings → Database → Disable RLS temporarily
- Ejecuta el script
- Vuelve a habilitar RLS

### No veo el botón "Run"

- Asegúrate de estar en el SQL Editor
- El botón está en la esquina inferior derecha
- También puedes presionar `Ctrl+Enter`

---

## 🔄 Volver a MariaDB Local

Si en algún momento quieres volver a usar tu base de datos local:

1. Abre [Backend/.env](Backend/.env)
2. Cambia:
   ```
   DB_TYPE=supabase
   ```
   Por:
   ```
   DB_TYPE=mariadb
   ```
3. Reinicia el servidor

---

## 📝 Resumen de 3 Pasos:

1. ✅ Abrir SQL Editor de Supabase
2. ✅ Copiar y pegar `BaseDeDatos/supabase_schema_clean.sql`
3. ✅ Hacer clic en "Run" ▶️

Luego:

4. ✅ `npm run test-connection`
5. ✅ `npm start`
6. ✅ Abrir `http://localhost:3000/Pages/diasBloqueados.html`

---

## 🎉 ¡Listo!

Tu proyecto ahora funciona con Supabase (base de datos en la nube) y tiene la nueva funcionalidad de gestión de días bloqueados completamente integrada.

**Tiempo total:** 2-3 minutos
**Dificultad:** Muy fácil ⭐

---

## 🆘 Necesitas ayuda?

Si algo no funciona:

1. Verifica los logs en la consola del servidor
2. Ejecuta `npm run test-connection` para diagnóstico
3. Revisa que todas las tablas existan en el Table Editor

---

**Enlaces importantes:**

- SQL Editor: https://supabase.com/dashboard/project/urohgbxhaghxekactoug/sql/new
- Table Editor: https://supabase.com/dashboard/project/urohgbxhaghxekactoug/editor
- Archivo SQL: `BaseDeDatos/supabase_schema_clean.sql`

