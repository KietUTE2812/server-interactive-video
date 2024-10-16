import express from 'express'
import dbConnect from "../config/dbConnect.js";
import userRoutes from "../routes/usersRoute.js";
import courseRoutes from '../routes/coursesRoute.js';
import { globalErrHandler, notFound } from "../middlewares/globalErrHandler.js";
import dotenv from 'dotenv';
import Redis from 'ioredis';
import { rateLimiter } from "../middlewares/rateLimiter.js";
import cors from 'cors';
import ErrorResponse from '../utils/ErrorResponse.js';

//route
import authRoutes from '../routes/authRouteGithub.js';
import userRoutes from "../routes/usersRoute.js";
import courseGradeRoute from '../routes/courseGradeRoute.js';
import courseRoute from '../routes/courseRoute.js';
import programRoute from '../routes/programRoute.js';

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

const verifyRecaptcha = async (token) => {
  const secretKey = process.env.SITE_SECRET;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

  try {
    const response = await fetch(url, { method: 'POST' });
    return response.status; // true nếu token hợp lệ
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
};

// Xử lý request khi người dùng submit form
app.post('/api/v1/users/verifyCaptcha', async (req, res) => {
  const token = req.body.captchaToken;

  const isCaptchaValid = await verifyRecaptcha(token);
  if (!isCaptchaValid) {
    return res.status(400).send('Captcha verification failed');
  }

  // Xử lý form bình thường nếu captcha hợp lệ
  res.status(200).json({
    message: "Successfully"
  })
});

// Load the userRoutes
app.use('/api/v1/users', userRoutes)
app.use('/', authRoutes)
app.use('/api/v1/coursegrades', courseGradeRoute);
app.use('/api/v1/learns', courseRoute);
app.use('/api/v1/problem', programRoute);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Nếu lỗi là instance của ErrorResponse
  if (err instanceof ErrorResponse) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // Nếu là lỗi khác
  res.status(500).json({
    success: false,
    error: 'Lỗi máy chủ'
  });
});

app.use(notFound)
app.use(globalErrHandler)
export default app;