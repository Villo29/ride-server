require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

// Evento para solicitar un viaje
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("requestRide", (data) => {
    console.log("Nuevo viaje solicitado:", data);

    const rideId = uuidv4(); // Generar un ID único para el viaje

    // Emitir el nuevo viaje a los conductores
    io.emit("newRideRequest", { ...data, rideId });
  });

  // Evento para aceptar un viaje
  socket.on("acceptRide", (data) => {
    console.log("Viaje aceptado:", data);

    if (!data.rideId) {
      console.error("Error: rideId no proporcionado en acceptRide.");
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
