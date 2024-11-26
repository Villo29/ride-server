require("dotenv").config(); 
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg"); // Importar pg

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER, // Reemplaza con tu usuario
  host: process.env.PG_HOST, // Cambia si tu base de datos no está en localhost
  database: process.env.PG_DB, // Reemplaza con el nombre de tu base de datos
  password: process.env.PG_PASSWORD, // Reemplaza con tu contraseña
  port: 5432, // Puerto predeterminado de PostgreSQL
});

const pendingRides = new Map();

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("requestRide", (data) => {
    console.log("Ride requested:", data);

    const rideId = uuidv4();

    const rideData = {
      ...data,
      rideId,
    };
    pendingRides.set(rideId, rideData);

    io.emit("newRideRequest", rideData);

    console.log("Nuevo viaje creado:", rideData);
  });

  socket.on("acceptRide", async (data) => {
    console.log("Ride accepted:", data);

    const ride = pendingRides.get(data.rideId);

    if (ride) {
      const passengerId = ride.passengerId;

      const acceptedData = {
        ...ride,
        driverInfo: data.driverInfo,
        driverLocation: data.driverLocation,
      };

      io.to(passengerId).emit("rideAccepted", acceptedData);
      pendingRides.delete(data.rideId);

      console.log("RideAccepted enviado al pasajero:", passengerId);

      // Guardar los datos en la base de datos
      try {
        const query = `
          INSERT INTO rides (
            ride_id,
            start_latitude,
            start_longitude,
            destination_latitude,
            destination_longitude,
            driver_name,
            driver_matricula,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        const values = [
          data.rideId,
          ride.startLatitude,
          ride.startLongitude,
          ride.destinationLatitude,
          ride.destinationLongitude,
          data.driverInfo.name,
          data.driverInfo.matricula,
          new Date().toISOString(), // Fecha de creación
        ];

        await pool.query(query, values);
        console.log("Datos del viaje guardados en la base de datos.");
      } catch (error) {
        console.error("Error al guardar en la base de datos:", error.message);
      }
    } else {
      console.log("RideId no encontrado:", data.rideId);
    }
  });

  socket.on("tripEnded", (data) => {
    console.log("Trip ended recibido:", data);

    if (!data.passengerId) {
      console.error("Error: passengerId no está presente en los datos:", data);
      return;
    }

    console.log("Emitiendo tripEnded a passengerId:", data.passengerId);

    io.to(data.passengerId).emit("tripEnded", data);

    console.log("TripEnded enviado al pasajero:", data.passengerId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
