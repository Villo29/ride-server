require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Evento para solicitar un viaje
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("requestRide", async (data) => {
    console.log("Nuevo viaje solicitado:", data);

    const rideId = uuidv4(); // Generar un ID único para el viaje

    try {
      const query = `
        INSERT INTO rides (
          ride_id,
          start_latitude,
          start_longitude,
          destination_latitude,
          destination_longitude,
          passenger_name,
          passenger_phone,
          passenger_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        rideId,
        data.start.latitude,
        data.start.longitude,
        data.destination.latitude,
        data.destination.longitude,
        data.passengerName,
        data.phoneNumber,
        data.passengerId,
        new Date().toISOString(),
      ];

      await pool.query(query, values);
      console.log("Datos del viaje guardados en la base de datos.");
    } catch (error) {
      console.error("Error al guardar el viaje en la base de datos:", error.message);
      return;
    }

    // Emitir el nuevo viaje a los conductores
    io.emit("newRideRequest", { ...data, rideId });
  });

  // Evento para aceptar un viaje
  socket.on("acceptRide", async (data) => {
    console.log("Viaje aceptado:", data);

    if (!data.rideId) {
      console.error("Error: rideId no proporcionado en acceptRide.");
      return;
    }

    try {
      const query = `
        UPDATE rides
        SET driver_name = $1, driver_matricula = $2
        WHERE ride_id = $3
      `;

      const values = [data.driverName, data.driverMatricula, data.rideId];

      const result = await pool.query(query, values);

      if (result.rowCount > 0) {
        console.log("Datos del conductor actualizados en la base de datos.");
      } else {
        console.error("No se encontró el viaje con rideId:", data.rideId);
      }
    } catch (error) {
      console.error("Error al actualizar el viaje en la base de datos:", error.message);
      return;
    }

    // Emitir notificación al pasajero
    io.to(data.passengerId).emit("rideAccepted", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
