import http from "http";
import app from "./app/app.js";
import { Server } from "socket.io";

const PORT = process.env.PORT || 2003
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
    }
});

// Sử dụng để lưu trữ danh sách phòng và các streamer trong phòng
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  // Khi streamer tạo phòng mới
  socket.on('create-room', (roomId) => {
    socket.join(roomId);
    rooms[roomId] = socket.id; // Lưu socket của streamer
    socket.to(roomId).emit('room-created', roomId);
    console.log('rooms', rooms);
    console.log(`Streamer created room: ${roomId}`);
  });

  socket.on('close-room', (roomId) => {
    socket.to(roomId).emit('room-closed');
    delete rooms[roomId];
    console.log(`Streamer closed room: ${roomId}`);
  });

  // Khi viewer tham gia phòng
  socket.on('join-room', (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      console.log(`Viewer joined room: ${roomId}`);
      // Thông báo cho streamer rằng viewer đã tham gia
      io.to(rooms[roomId]).emit('viewer-joined', socket.id);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  // Xử lý WebRTC offer từ streamer
  socket.on('offer', (roomId, offer) => {
    console.log(`Offer from ${socket.id} in room ${roomId}`);
    socket.to(roomId).emit('offer', offer); // Gửi offer cho các viewer trong phòng
  });

  // Xử lý WebRTC answer từ viewer
  socket.on('answer', (roomId, answer) => {
    socket.to(roomId).emit('answer', answer); // Gửi answer cho streamer
  });

  // Xử lý ICE Candidate từ các peer
  socket.on('ice-candidate', (roomId, candidate) => {
    socket.to(roomId).emit('ice-candidate', candidate); // Gửi ICE candidate đến tất cả peer trong phòng
  });

  // Khi một socket ngắt kết nối
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Xóa socket khu ỏi danh sách phòng nếu nó là streamer
    for (let roomId in rooms) {
      console.log('rooms 67', rooms);
      if (rooms[roomId] === socket.id) {
        delete rooms[roomId]; 
        io.to(roomId).emit('streamer-disconnected'); // Thông báo cho viewer trong phòng
      }
    }
  });
});

server.listen(PORT, console.log(`Server is up and running on port ${PORT}`))