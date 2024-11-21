const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 4000;

app.use(express.json());

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

io.on("connection", (socket) => {
  console.log("New client connected");

  const pendingRides = new Map();

  // Listener para recibir solicitudes de viaje
  socket.on("requestRide", (data) => {
    console.log("Ride requested:", data);

    // Guardar el pasajero y sus datos en el mapa de viajes pendientes
    pendingRides.set(data.passengerId, data);

    // Emitir la solicitud de viaje a los conductores conectados
    io.emit("newRideRequest", data);
  });

  // Listener para recibir aceptación del conductor
  socket.on("acceptRide", (data) => {
    console.log("Ride accepted:", data);

    const passengerId = data.passengerId;

    // Verificar si el pasajero existe en los viajes pendientes
    if (pendingRides.has(passengerId)) {
      const rideData = pendingRides.get(passengerId);

      // Completar la información con datos del conductor
      const acceptedData = {
        ...rideData,
        driverInfo: {
          name: data.driverInfo.name,
          phone: data.driverInfo.phone,
        },
        driverLocation: data.driverLocation,
      };

      // Emitir la confirmación de aceptación al pasajero
      io.to(passengerId).emit("rideAccepted", acceptedData);

      // Eliminar el viaje de los pendientes
      pendingRides.delete(passengerId);

      console.log("RideAccepted sent to passenger:", passengerId);
    } else {
      console.log("Passenger not found for passengerId:", passengerId);
    }
  });

  // Listener para iniciar el viaje
  socket.on("startRide", (data) => {
    console.log("Ride started:", data);

    const rideStartedData = {
      passengerId: data.passengerId,
      driverId: data.driverId,
      timestamp: new Date().toISOString(),
    };

    // Emitir evento de inicio de viaje al pasajero
    io.to(data.passengerId).emit("rideStarted", rideStartedData);
    console.log("RideStarted sent to passenger:", data.passengerId);
  });

  // Listener para finalizar el viaje
  socket.on("endRide", (data) => {
    console.log("Ride ended:", data);

    const rideEndedData = {
      passengerId: data.passengerId,
      driverId: data.driverId,
      timestamp: new Date().toISOString(),
    };

    // Emitir evento de finalización de viaje al pasajero
    io.to(data.passengerId).emit("rideEnded", rideEndedData);
    console.log("RideEnded sent to passenger:", data.passengerId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
