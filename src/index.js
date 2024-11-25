const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid"); // Importar uuid

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

const pendingRides = new Map(); // Almacena viajes pendientes

io.on("connection", (socket) => {
  console.log("New client connected");

  // Listener para recibir solicitudes de viaje
  socket.on("requestRide", (data) => {
    console.log("Ride requested:", data);

    // Generar un rideId único
    const rideId = uuidv4();

    // Guardar el viaje con el rideId
    const rideData = {
      ...data,
      rideId, // Añadir el rideId generado
    };
    pendingRides.set(rideId, rideData);

    // Emitir la solicitud de viaje a todos los conductores conectados
    io.emit("newRideRequest", rideData);

    console.log("Nuevo viaje creado:", rideData);
  });

  // Listener para recibir aceptación del conductor
  socket.on("acceptRide", (data) => {
    console.log("Ride accepted:", data);

    // Verificar si el rideId existe en los viajes pendientes
    const ride = pendingRides.get(data.rideId);

    if (ride) {
      const passengerId = ride.passengerId;

      // Combinar datos del viaje con datos del conductor
      const acceptedData = {
        ...ride,
        driverInfo: data.driverInfo,
        driverLocation: data.driverLocation,
      };

      // Emitir al pasajero correspondiente
      io.to(passengerId).emit("rideAccepted", acceptedData);

      // Eliminar el viaje de los pendientes
      pendingRides.delete(data.rideId);

      console.log("RideAccepted enviado al pasajero:", passengerId);
    } else {
      console.log("RideId no encontrado:", data.rideId);
    }
  });


  socket.on("tripEnded", (data) => {
    console.log("Trip ended:", data);

    // Emitir al pasajero correspondiente
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
