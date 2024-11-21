const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid"); // Para generar IDs únicos

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

// Mapa para almacenar los pasajeros y sus solicitudes activas
const passengers = {};

app.post("/webhook", (req, res) => {
  const { start, destination, passengerName, phoneNumber } = req.body;

  console.log("Webhook received data:");
  console.log(
    `Start: Latitude: ${start.latitude}, Longitude: ${start.longitude}`
  );
  console.log(
    `Destination: Latitude: ${destination.latitude}, Longitude: ${destination.longitude}`
  );
  console.log(`Passenger: ${passengerName}`);
  console.log(`Phone: ${phoneNumber}`);

  res.status(200).send({ status: "Success", message: "Data received" });
});

// Socket.io connection event
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Listener para recibir solicitudes de viaje
  socket.on("requestRide", (data) => {
    console.log("Ride requested:", data);

    // Generar un passengerId único para esta solicitud
    const passengerId = uuidv4();
    passengers[passengerId] = {
      socketId: socket.id,
      ...data, // Incluye datos adicionales (nombre, ubicación, etc.)
    };

    // Emitir el evento de nueva solicitud de viaje
    io.emit("newRideRequest", { ...data, passengerId });
    console.log(`Passenger ID generated: ${passengerId}`);
  });

  // Listener para recibir aceptación del conductor
  socket.on("acceptRide", (data) => {
    console.log("Ride accepted:", data);

    // Verificar si el passengerId existe
    const passenger = passengers[data.passengerId];
    if (passenger) {
      // Enviar los datos al pasajero correspondiente
      io.to(passenger.socketId).emit("rideAccepted", {
        rideId: data.rideId || uuidv4(), // Generar un rideId si no se proporciona
        driverLocation: data.driverLocation,
        driverInfo: data.driverInfo,
        passengerInfo: {
          name: passenger.passengerName,
          phone: passenger.phoneNumber,
        },
      });

      console.log("Ride accepted and emitted to passenger:", passengerId);
    } else {
      console.error("Passenger ID not found:", data.passengerId);
    }
  });

  // Desconexión del cliente
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Eliminar al pasajero del mapa si estaba registrado
    for (const passengerId in passengers) {
      if (passengers[passengerId].socketId === socket.id) {
        delete passengers[passengerId];
        console.log("Passenger removed:", passengerId);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
