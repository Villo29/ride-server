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
  port: process.env.PG_Port, // Puerto predeterminado de PostgreSQL
  ssl: {
    rejectUnauthorized: false,
  },
});

const pendingRides = new Map();

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("requestRide", async (data) => {
    console.log("Nuevo viaje creado:", data);
  
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
        rideId,                          // ID único del viaje
        data.start.latitude,             // Latitud de inicio
        data.start.longitude,            // Longitud de inicio
        data.destination.latitude,       // Latitud de destino
        data.destination.longitude,      // Longitud de destino
        data.passengerName,              // Nombre del pasajero
        data.phoneNumber,                // Teléfono del pasajero
        data.passengerId,                // ID del pasajero
        new Date().toISOString()         // Fecha de creación
      ];
  
      await pool.query(query, values);
      console.log("Datos del viaje guardados en la base de datos.");
    } catch (error) {
      console.error("Error al guardar el viaje en la base de datos:", error.message);
    }

    socket.on("acceptRide", async (data) => {
      console.log("Viaje aceptado:", data);
    
      try {
        const query = `
          UPDATE rides
          SET
            driver_name = $1,
            driver_matricula = $2
          WHERE ride_id = $3
        `;
    
        const values = [
          data.driverName,      // Nombre del conductor
          data.driverMatricula, // Matrícula del conductor
          data.rideId           // ID del viaje
        ];
    
        const result = await pool.query(query, values);
    
        if (result.rowCount > 0) {
          console.log("Datos del conductor actualizados en la base de datos.");
        } else {
          console.error("No se encontró el viaje con rideId:", data.rideId);
        }
      } catch (error) {
        console.error("Error al actualizar los datos del conductor en la base de datos:", error.message);
      }
    
      // Emitir la aceptación al pasajero correspondiente
      io.to(data.passengerId).emit("rideAccepted", data);
    });

  socket.on("tripEnded", async (data) => {
    console.log("Trip ended recibido:", data);

    if (!data.passengerId) {
      console.error("Error: passengerId no está presente en los datos:", data);
      return;
    }

    console.log("Emitiendo tripEnded a passengerId:", data.passengerId);

    // Emitir al pasajero correspondiente
    io.to(data.passengerId).emit("tripEnded", data);

    console.log("TripEnded enviado al pasajero:", data.passengerId);

    // Obtener datos del viaje original de pendingRides
    const ride = pendingRides.get(data.rideId);

    if (!ride) {
      console.error(`No se encontró el ride con ID: ${data.rideId}`);
      return;
    }

    // Extraer los datos relevantes de pendingRides
    const passengerPhone = ride.phoneNumber || null;
    const startLatitude = ride.start?.latitude || null;
    const startLongitude = ride.start?.longitude || null;
    const destinationLatitude = ride.destination?.latitude || null;
    const destinationLongitude = ride.destination?.longitude || null;

    // Guardar datos adicionales en la base de datos
    try {
      const query = `
      UPDATE rides
      SET
        driver_name = $1,
        driver_matricula = $2,
        passenger_phone = $3,
        start_latitude = $4,
        start_longitude = $5,
        destination_latitude = $6,
        destination_longitude = $7
      WHERE ride_id = $8
    `;

      const values = [
        data.driverName || "Desconocido", // Nombre del conductor
        data.driverMatricula || "N/A", // Matrícula del conductor
        passengerPhone, // Teléfono del pasajero
        startLatitude, // Latitud de inicio
        startLongitude, // Longitud de inicio
        destinationLatitude, // Latitud de destino
        destinationLongitude, // Longitud de destino
        data.rideId, // ID del viaje
      ];

      const result = await pool.query(query, values);

      if (result.rowCount > 0) {
        console.log("Datos actualizados en la base de datos.");
      } else {
        console.log("No se encontró el ride_id para actualizar.");
      }
    } catch (error) {
      console.error("Error al actualizar en la base de datos:", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
});
