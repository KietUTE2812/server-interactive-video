import express from 'express'
import dbConnect from "../config/dbConnect.js";
import userRoutes from "../routes/usersRoute.js";
import paymentsRoute from "../routes/paymentsRoute.js";
import conversationRoute from "../routes/conversationRoute.js";
import { globalErrHandler, notFound } from "../middlewares/globalErrHandler.js";
import dotenv from 'dotenv';
// import Redis from 'ioredis';
// import { rateLimiter } from "../middlewares/rateLimiter.js";
import cors from 'cors';
import ErrorResponse from '../utils/ErrorResponse.js';

//route
import authRoutes from '../routes/authRouteGithub.js';
import courseGradeRoute from '../routes/courseGradeRoute.js';
import courseRoute from '../routes/courseRoute.js';
import programRoute from '../routes/programRoute.js';
import streamRoute from '../routes/streamRoute.js';
import authRoute from '../routes/authRoute.js';
import reviewRoute from "../routes/reviewRoute.js";
import quizRoute from "../routes/quizRoute.js";
import roadmapRoute from "../routes/roadmapRoute.js";
import moduleRoute from "../routes/moduleRoute.js";
// import chunkUpload from "../routes/ChunkUpload.js";
import notificationRoute from "../routes/notificationRoute.js";

// // Use environment variables for Redis connection
// const redisHost = process.env.REDIS_HOST || 'localhost';
// const redisPort = process.env.REDIS_PORT || 6379;

// export const Client = new Redis({
//   host: redisHost,
//   port: redisPort,
// });
dotenv.config();
//db connect
dbConnect();


const app = express();

app.use(express.json({
    limit: '*'
}))
// Enable CORS
app.use(cors({
  origin: 'http://localhost:5173', // Hoặc dùng '*' nếu muốn cho phép mọi nguồn
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Các phương thức được phép
  credentials: true, // Nếu bạn cần gửi cookie hoặc authentication headers
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
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Load the userRoutes
app.use('/api/v1/users', userRoutes)
app.use('/', authRoutes)
app.use('/api/v1/auth', authRoute)
app.use('/api/v1/coursegrades', courseGradeRoute);
app.use('/api/v1/learns', courseRoute);
app.use('/api/v1/problem', programRoute);
app.use('/api/v1/payments', paymentsRoute);
app.use('/api/v1/livestreams', streamRoute);
app.use('/api/v1/conversations', conversationRoute);
app.use('/api/v1/reviews', reviewRoute)
app.use('/api/v1/quizzes', quizRoute)
app.use('/api/v1/roadmap', roadmapRoute)
app.use('/api/v1/modules', moduleRoute)
// app.use('/api/v1/uploads', chunkUpload)
app.use('/api/v1/notifications', notificationRoute)
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