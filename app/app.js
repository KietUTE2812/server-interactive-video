import express from 'express'
import dbConnect from "../config/dbConnect.js";
import userRoutes from "../routes/usersRoute.js";
import { globalErrHandler, notFound } from "../middlewares/globalErrHandler.js";
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { rateLimiter } from "../middlewares/Ratelimiter.js";


// Use environment variables for Redis connection
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

export const Client = new Redis({
    host: redisHost,
    port: redisPort,
});
dotenv.config();
console.log(process.env.MONGO_URI)
//db connect
dbConnect();


const app = express();

app.use(express.json())
app.use('/api/v1/users', rateLimiter, userRoutes)

app.use(notFound)
app.use(globalErrHandler)
export default app;