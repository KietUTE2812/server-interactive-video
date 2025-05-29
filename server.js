import http from "http";
import app from "./app/app.js";
import { handleSocketConnection } from "./config/socketHandlersV2.js";
import { initNotificationService } from "./services/notificationService.js";
import { initEmailService } from "./services/emailService.js";
import connectDB from "./config/dbConnect.js";
import dotenv from 'dotenv';
import { Server } from "socket.io";
import minio from "./utils/uploadToMiniO.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const PORT = process.env.PORT || 2003;
const server = http.createServer(app);

// Initialize Minio
minio.config(process.env.MINIO_BUCKET_NAME);
minio.setPolicyForBucket(process.env.MINIO_BUCKET_NAME);
// Initialize Socket.IO
const io = new Server(server);
handleSocketConnection(io);

// Initialize email service
const emailService = initEmailService();

// Initialize notification service with Socket.IO instance
initNotificationService(io);

// Test email connection if email credentials are provided
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  emailService.testConnection()
    .then(connected => {
      if (connected) {
        console.log('Email service is connected and ready');
      } else {
        console.warn('Email service failed to connect. Check your email credentials.');
      }
    })
    .catch(err => {
      console.error('Error connecting to email service:', err);
    });
} else {
  console.warn('Email credentials not provided. Email notifications will not work.');
}

// Start server
server.listen(PORT, () => {
  console.log(`Server is up and running on port ${PORT}`);
});