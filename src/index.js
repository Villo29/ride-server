const dotenv = require("dotenv");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const { connect } = require("http2");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER || "",
  host: process.env.PG_HOST || "localhost",
  database: process.env.PG_DB || "",
  password: process.env.PG_PASSWORD || "",
  port: Number(process.env.PG_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false,
},
});

app.use(express.json());

io.on("connection", (socket) => {
  console.log("New client connected");

  // Manejar solicitud de viaje
  socket.on("requestRide", async (data) => {
    console.log("Ride requested:", data);

    const rideId = uuidv4();
    const rideData = {
      ...data,
      rideId,
    };

    try {
      await pool.query(
        `INSERT INTO ride_requests
        (ride_id, passenger_name, phone_number, passenger_id, start_latitude, start_longitude, destination_latitude, destination_longitude) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rideId,
          data.passengerName,
          data.phoneNumber,
          data.passengerId,
          data.start.latitude,
          data.start.longitude,
          data.destination.latitude,
          data.destination.longitude,
        ]
      );

      io.emit("newRideRequest", rideData);
      console.log("Nuevo viaje creado y guardado en la DB:", rideData);
    } catch (error) {
      console.error("Error guardando en la DB:", error);
    }
  });

  // Manejar aceptación de viaje
  socket.on("acceptRide", async (data) => {
    console.log("Ride accepted:", data);

    try {
      await pool.query(
        `INSERT INTO accepted_rides 
        (ride_id, passenger_id, driver_name, driver_phone, matricula, driver_latitude, driver_longitude) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          data.rideId,
          data.passengerId,
          data.driverInfo.name,
          data.driverInfo.phone,
          data.driverInfo.matricula,
          data.driverLocation.latitude,
          data.driverLocation.longitude,
        ]
      );

      io.emit("rideAccepted", data);
      console.log("Ride aceptado y guardado en la DB:", data);
    } catch (error) {
      console.error("Error guardando aceptación en la DB:", error);
    }
  });

  socket.on("tripEnded", (data) => {
    console.log("Trip ended recibido:", data);
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
