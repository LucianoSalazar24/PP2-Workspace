const usuarios = [
  { id: 101, nombre: "Juan", email: "juan@gmail.com", role: "jugador" },
  { id: 102, nombre: "Martín", email: "martin@gmail.com", role: "jugador" },
  { id: 103, nombre: "Ana", email: "ana@gmail.com", role: "jugador" },
  { id: 104, nombre: "Carla", email: "carla@gmail.com", role: "admin" }
];

const cancha = [
  {
    id: 1,
    nombre: "Cancha 5 A",
    tipo: "5x5",
    precioPorHora: 3000,
    apertura: "08:00",
    cierre: "23:00",
    disponible: true
  },
  {
    id: 2,
    nombre: "Cancha 5 B",
    tipo: "5x5",
    precioPorHora: 3500,
    apertura: "08:00",
    cierre: "23:00",
    disponible: false
  },
  {
    id: 3,
    nombre: "Cancha 7",
    tipo: "7x7",
    precioPorHora: 5000,
    apertura: "09:00",
    cierre: "22:00",
    disponible: true
  },
  {
    id: 4,
    nombre: "Cancha 11",
    tipo: "11x11",
    precioPorHora: 8000,
    apertura: "10:00",
    cierre: "21:00",
    disponible: true
  }
];

const reservas = [
  {
    id: 1,
    canchaId: 1,
    userId: 101,
    fecha: "2025-09-20",
    inicio: "18:00",
    fin: "19:00",
    estado: "CONFIRMADA",
    seña: 1000
  },
  {
    id: 2,
    canchaId: 1,
    userId: 102,
    fecha: "2025-09-20",
    inicio: "20:00",
    fin: "21:00",
    estado: "CONFIRMADA",
    seña: 1500
  },
  {
    id: 3,
    canchaId: 2,
    userId: 103,
    fecha: "2025-09-21",
    inicio: "19:00",
    fin: "20:30",
    estado: "PENDIENTE",
    seña: 2000
  },
  {
    id: 4,
    canchaId: 3,
    userId: 104,
    fecha: "2025-09-21",
    inicio: "21:00",
    fin: "22:00",
    estado: "CANCELADA",
    seña: 0
  }
];

/* POSIBLES ESTADOS DE UNA RESERVA

PENDIENTE: creada pero aun no confirmada (Por ej: falta pagar la seña).

CONFIRMADA: validada y asegurada.

CANCELADA: anulada por el usuario o admin.

COMPLETADA: ya se jugó el partido.

NO_SHOW: usuario no se presentó. */

canchas.forEach(cancha => {
  console.log(`${cancha.nombre} (${cancha.tipo}) - $${cancha.precioPorHora}/hora`);
});
