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

// Socket.io connection event
io.on("connection", (socket) => {
  console.log("New client connected");

  // Listener para recibir solicitudes de viaje
  socket.on("requestRide", (data) => {
    console.log("Ride requested:", data);

    // Emite la solicitud de viaje a los conductores conectados
    io.emit("newRideRequest", data);
  });

  // Listener para recibir aceptación del conductor
  socket.on("acceptRide", (data) => {
    console.log("Ride accepted:", data);

    // Emite la confirmación de aceptación al pasajero correspondiente
    io.to(data.passengerId).emit("rideAccepted", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
