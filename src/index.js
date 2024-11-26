const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid"); // Generar IDs únicos
const pool = require("./db"); // Conexión a la base de datos

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

const pendingRides = new Map(); // Almacena viajes pendientes temporalmente

io.on("connection", (socket) => {
  console.log("New client connected");

  // Evento para manejar solicitud de viaje
  socket.on("requestRide", async (data) => {
    console.log("Ride requested:", data);

    const rideId = uuidv4(); // Generar un ID único para el ride
    const rideData = { ...data, rideId }; // Agregar el rideId a los datos
    pendingRides.set(rideId, rideData);

    // Guardar en la base de datos
    try {
      await pool.query(
        `INSERT INTO rides (
          ride_id, 
          passenger_id, 
          passenger_name, 
          passenger_phone, 
          start_latitude, 
          start_longitude, 
          destination_latitude, 
          destination_longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rideData.rideId,
          rideData.passengerId,
          rideData.passengerName,
          rideData.phoneNumber,
          rideData.start.latitude,
          rideData.start.longitude,
          rideData.destination.latitude,
          rideData.destination.longitude,
        ]
      );
      console.log("Ride guardado en la base de datos");
    } catch (err) {
      console.error("Error guardando ride:", err);
    }

    // Emitir la solicitud de viaje a todos los conductores conectados
    io.emit("newRideRequest", rideData);
  });

  // Evento para manejar aceptación de viaje por el conductor
  socket.on("acceptRide", async (data) => {
    console.log("Ride accepted:", data);

    const ride = pendingRides.get(data.rideId);
    if (ride) {
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
      }

      const acceptedData = {
        ...ride,
        driverInfo: data.driverInfo,
        driverLocation: data.driverLocation,
      };

      // Notificar al pasajero sobre la aceptación
      io.to(ride.passengerId).emit("rideAccepted", acceptedData);

      // Eliminar el viaje de los pendientes
      pendingRides.delete(data.rideId);
    } else {
      console.log("RideId no encontrado:", data.rideId);
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
    } catch (err) {
      console.error("Error actualizando trip ended:", err);
    }

    // Notificar al pasajero que el viaje terminó
    io.to(data.passengerId).emit("tripEnded", data);
  });

  // Evento para manejar desconexión
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
