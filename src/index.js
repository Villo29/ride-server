const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid"); // Importar uuid

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

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

  socket.on("acceptRide", (data) => {
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
