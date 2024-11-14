const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 4000;

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('requestRide', (data) => {
        console.log('Ride requested:', data);

        io.emit('newRideRequest', data);
    });

    socket.on('acceptRide', (data) => {
        console.log('Ride accepted:', data);

        io.to(data.passengerId).emit('rideAccepted', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(port, () => console.log(`Server running on port ${port}`));
