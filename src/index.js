// index.js
const express = require("express");
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json()); // Middleware para analizar JSON en el cuerpo de la solicitud

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

  // Puedes agregar lógica adicional aquí para procesar los datos
  // Ejemplo: almacenar en la base de datos o emitir eventos a otros servicios

  res.status(200).send({ status: "Success", message: "Data received" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
