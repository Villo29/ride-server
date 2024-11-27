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

// Evento para manejar la conexión de los clientes
io.on("connection", (socket) => {
  console.log("New client connected");

  // Evento para solicitar un viaje
  socket.on("requestRide", async (data) => {
    console.log("Nuevo viaje solicitado:", data);

    const rideId = uuidv4(); // Generar un ID único para el viaje

    try {
      // Guardar el viaje en la tabla rideUsuario
      const query = `
        INSERT INTO rideUsuario (
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
      console.log("Datos del viaje guardados en rideUsuario.");
    } catch (error) {
      console.error("Error al guardar el viaje en rideUsuario:", error.message);
      return;
    }

    // Emitir el nuevo viaje a los conductores
    io.emit("newRideRequest", { ...data, rideId });
  });

  // Evento para finalizar un viaje
  socket.on("endTrip", async (data) => {
    console.log("Viaje finalizado:", data);

    try {
      // Insertar los datos en la tabla rideChofer
      const query = `
        INSERT INTO rideChofer (
          ride_id,
          driver_name,
          driver_matricula,
          completed_at
        ) VALUES ($1, $2, $3, $4)
      `;

      const values = [
        data.rideId, // rideId generado durante la solicitud del viaje
        data.driverName,
        data.driverMatricula,
        new Date().toISOString(),
      ];

      await pool.query(query, values);
      console.log("Datos del final del viaje guardados en rideChofer.");

      // Emitir el evento a los clientes
      io.emit("tripEnded", {
        rideId: data.rideId,
        driverName: data.driverName,
        driverMatricula: data.driverMatricula,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error al guardar el final del viaje en rideChofer:", error.message);
      return;
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Iniciar el servidor
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
