Reglas de Negocio del Proyecto
Restricciones
1. Restricción de solapamiento de horarios

Qué significa: No se puede reservar una cancha en un horario ya ocupado.

Ejemplo: Si la cancha 5A ya está reservada el 20/09/2025 de 19:00 a 20:00, otro usuario no debería poder reservar de 19:30 a 20:30.

2. Pago de seña obligatorio

La reserva queda en estado PENDIENTE hasta que el usuario pague una seña (ej.: 30%).

Si no paga en 1 hora, la reserva se cancela automáticamente.

3. Canchas exclusivas por deporte

Si existen distintos tipos de canchas (fútbol 5, fútbol 7, fútbol 11), cada reserva debe coincidir con el tipo definido para esa cancha.

Validaciones
1. Validación de duración de la reserva

Qué significa: Toda reserva debe cumplir con una duración mínima y máxima.

Ejemplo: La cancha solo se alquila en bloques de al menos 1 hora y máximo 3 horas.

2. Validación de horario de apertura y cierre

Qué significa: Una reserva debe realizarse dentro del horario operativo de la cancha.

Ejemplo: Si la cancha abre a las 08:00 y cierra a las 23:00, no se puede reservar de 22:30 a 23:30.

3. Formato de datos al registrar usuario

Validar que el email sea correcto (ej.: usuario@gmail.com
).

Validar que la contraseña tenga al menos:

8 caracteres

Un número

Una letra mayúscula

Inferencias
1. Penalización por no presentarse (no-show)

Qué significa: El sistema puede deducir mal comportamiento si el usuario no se presenta.

Ejemplo: Si un usuario tiene 3 reservas con estado NO_SHOW en el último mes, el sistema le bloquea nuevas reservas hasta que pague una multa o hable con el administrador.

2. Horarios de alta demanda

El sistema detecta qué horarios (ej.: viernes 20:00) se reservan primero y puede sugerir precio dinámico más alto.

3. Recomendación de horarios libres

Si el horario elegido está ocupado, el sistema sugiere alternativas cercanas.

Ejemplo: “No disponible 19:00, pero sí 21:00”.