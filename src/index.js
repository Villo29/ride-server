const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

const passengerSockets = new Map(); // Mapa para asociar passengerId -> socket.id

// Verificar conexión a la base de datos al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error conectando a la base de datos:", err);
  } else {
    console.log("Conexión exitosa a la base de datos PostgreSQL.");
    release();
  }
});

io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  // Escuchar cuando un pasajero se registra
  socket.on("registerPassenger", (passengerId) => {
    passengerSockets.set(passengerId, socket.id);
    console.log(`Pasajero registrado: ${passengerId}, Socket ID: ${socket.id}`);
  });

  // Evento para manejar solicitud de viaje
  socket.on("requestRide", async (data) => {
    console.log("Ride requested:", data);

    const rideId = uuidv4(); // Generar un ID único para el ride
    const rideData = { ...data, rideId }; // Agregar el rideId a los datos

    try {
      // Guardar en la base de datos
      await pool.query(
        `INSERT INTO rides (
          ride_id, 
          passenger_id, 
          start_latitude, 
          start_longitude, 
          destination_latitude, 
          destination_longitude
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          rideData.rideId,
          rideData.passengerId,
          rideData.start.latitude,
          rideData.start.longitude,
          rideData.destination.latitude,
          rideData.destination.longitude,
        ]
      );
      console.log("Ride guardado correctamente en la base de datos");
      socket.emit("dbStatus", {
        message: "El viaje fue guardado correctamente en la base de datos.",
      });
    } catch (err) {
      console.error("Error guardando ride:", err);
      socket.emit("dbStatus", {
        message: "Hubo un error guardando el viaje en la base de datos.",
        error: err.message,
      });
    }

    // Emitir la solicitud de viaje a todos los conductores conectados
    io.emit("newRideRequest", rideData);
  });

  // Evento para manejar aceptación de viaje por el conductor
  socket.on("acceptRide", async (data) => {
    console.log("Ride accepted:", data);

    try {
      // Actualizar datos del conductor en la base de datos
      await pool.query(
        `UPDATE rides 
        SET driver_name = $1, 
            driver_matricula = $2 
        WHERE ride_id = $3`,
        [data.driverInfo.name, data.driverInfo.matricula, data.rideId]
      );
      console.log("Datos del conductor actualizados en la base de datos");
    } catch (err) {
      console.error("Error actualizando datos del conductor:", err);
      socket.emit("dbStatus", {
        message: "Hubo un error actualizando los datos del conductor.",
        error: err.message,
      });
    }

    const acceptedData = {
      rideId: data.rideId,
      driverInfo: data.driverInfo,
    };

    // Notificar al pasajero sobre la aceptación
    const passengerSocketId = passengerSockets.get(data.passengerId);
    if (passengerSocketId) {
      io.to(passengerSocketId).emit("rideAccepted", acceptedData);
      console.log(`Notificación enviada al pasajero: ${data.passengerId}`);
    } else {
      console.log(
        `No se pudo notificar al pasajero: ${data.passengerId}, socket no encontrado.`
      );
    }
  });

  // Evento para manejar finalización de viaje
  socket.on("tripEnded", async (data) => {
    console.log("Trip ended recibido:", data);

    try {
      // Actualizar la hora de finalización en la base de datos
      await pool.query(
        `UPDATE rides 
        SET created_at = NOW() 
        WHERE ride_id = $1`,
        [data.rideId]
      );
      console.log("Viaje finalizado guardado en la base de datos");
      socket.emit("dbStatus", {
        message: "El viaje fue finalizado correctamente en la base de datos.",
      });
    } catch (err) {
      console.error("Error actualizando trip ended:", err);
      socket.emit("dbStatus", {
        message: "Hubo un error finalizando el viaje en la base de datos.",
        error: err.message,
      });
    }

    // Notificar al pasajero que el viaje terminó
    const passengerSocketId = passengerSockets.get(data.passengerId);
    if (passengerSocketId) {
      io.to(passengerSocketId).emit("tripEnded", data);
      console.log(
        `Notificación de fin de viaje enviada al pasajero: ${data.passengerId}`
      );
    } else {
      console.log(
        `No se pudo notificar al pasajero: ${data.passengerId}, socket no encontrado.`
      );
    }
  });

  // Evento para manejar desconexión
  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
    // Eliminar al pasajero del mapa si se desconecta
    for (const [passengerId, socketId] of passengerSockets.entries()) {
      if (socketId === socket.id) {
        passengerSockets.delete(passengerId);
        console.log(`Pasajero desconectado: ${passengerId}`);
        break;
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor ejecutándose en el puerto ${port}`);
});
