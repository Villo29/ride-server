const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const { v4: uuidv4 } = require("uuid");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST"],
  },
});
const port = process.env.PORT || 4000;

// Seguridad adicional
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
}));
app.use(express.json());

// Límite de tasa para prevenir abusos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 solicitudes por IP
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
});
app.use(limiter);

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER || "",
  host: process.env.PG_HOST || "localhost",
  database: process.env.PG_DB || "",
  password: process.env.PG_PASSWORD || "",
  port: Number(process.env.PG_PORT) || 5432,
  ssl: {
    rejectUnauthorized: process.env.PG_SSL === "true",
  },
});

io.on("connection", (socket) => {
  console.log("New client connected");

  // Validación de datos
  const validateRideData = (data) => {
    if (!data || typeof data !== "object") return false;
    const requiredFields = [
      "passengerName",
      "phoneNumber",
      "passengerId",
      "start",
      "destination",
    ];
    return requiredFields.every((field) => data[field]);
  };

  // Manejar solicitud de viaje
  socket.on("requestRide", async (data) => {
    if (!validateRideData(data)) {
      return socket.emit("error", "Datos de solicitud de viaje inválidos");
    }

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
      console.error("Error guardando en la DB:", error.message);
      socket.emit("error", "Error guardando la solicitud de viaje");
    }
  });

  // Manejar aceptación de viaje
  socket.on("acceptRide", async (data) => {
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
      console.error("Error guardando aceptación en la DB:", error.message);
      socket.emit("error", "Error aceptando el viaje");
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
