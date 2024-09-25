import express from 'express'
import dbConnect from "../config/dbConnect.js";
import userRoutes from "../routes/usersRoute.js";
import { globalErrHandler, notFound } from "../middlewares/globalErrHandler.js";
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { rateLimiter } from "../middlewares/rateLimiter.js";
import cors from 'cors';

// Use environment variables for Redis connection
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

export const Client = new Redis({
    host: redisHost,
    port: redisPort,
});
dotenv.config();
//db connect
dbConnect();


const app = express();

app.use(express.json())
// Enable CORS
app.use(cors({
    origin: 'http://localhost:5173', // Hoặc dùng '*' nếu muốn cho phép mọi nguồn
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Các phương thức được phép
    credentials: true, // Nếu bạn cần gửi cookie hoặc authentication headers
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Access-Control-Allow-Origin'], // Các header được phép
}));


// Load the userRoutes
app.use('/api/v1/users',rateLimiter , userRoutes)

app.use(notFound)
app.use(globalErrHandler)
export default app;