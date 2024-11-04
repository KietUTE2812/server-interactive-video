import http from "http";
import app from "./app/app.js";
import { Server } from "socket.io";
import { handleSocketConnection } from "./config/socketHandlers.js";

const PORT = process.env.PORT || 2003
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
    }
});

handleSocketConnection(io);

server.listen(PORT, console.log(`Server is up and running on port ${PORT}`))