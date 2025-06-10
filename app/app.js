import express from 'express'
import dbConnect from "../config/dbConnect.js";
import userRoute from "../routes/usersRoute.js";
const { userRoutes, groupRoutes, statsRoutes } = userRoute;
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
import studentRoute from '../routes/studentRoute.js';
import programRoute from '../routes/programRoute.js';
import streamRoute from '../routes/streamRoute.js';
import authRoute from '../routes/authRoute.js';
import reviewRoute from "../routes/reviewRoute.js";
import quizRoute from "../routes/quizRoute.js";
import roadmapRoute from "../routes/roadmapRoute.js";
import moduleRoute from "../routes/moduleRoute.js";
// import chunkUpload from "../routes/ChunkUpload.js";
import notificationRoute from "../routes/notificationRoute.js";
import notificationRoutes from "../routes/notificationRoutes.js"; // New Kafka-based notification routes
import videoRoute from "../routes/videoRoute.js";
import progressRoute from "../routes/progressRoute.js";
import moduleItemRoute from "../routes/moduleItemRoute.js";

import searchRoute from "../routes/searchRoute.js";
import messageRoute from "../routes/messageRoute.js";
import chatbotRoute from '../routes/chatbotRoute.js';
import categoryRoute from "../routes/categoryRoute.js";
import settingRoute from "../routes/settingRoute.js";
import shortLinkRoute from '../routes/shortLinkRoute.js';
import codespaceRoute from '../routes/codespaceRoute.js';
import githubAuthRoutes from '../routes/githubAuth.js';
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
// app.use(cors({
//   origin: [process.env.CLIENT_URL, 'http://localhost:5173'], // Use environment variable for client URL
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Các phương thức được phép
//   credentials: true, // Nếu bạn cần gửi cookie hoặc authentication headers
// }));
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ];

    // Cho phép requests không có origin (mobile apps, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200 // Cho IE11
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
app.use('/api/v1/groups', groupRoutes)
app.use('/api/v1/stats', statsRoutes)
app.use('/', authRoutes)
app.use('/api/v1/auth', authRoute)
app.use('/api/v1/coursegrades', courseGradeRoute);
app.use('/api/v1/learns', courseRoute);
app.use('/api/v1/problem', programRoute);
app.use('/api/v1/payments', paymentsRoute);
app.use('/api/v1/conversations', conversationRoute);
app.use('/api/v1/messages', messageRoute);
app.use('/api/v1/reviews', reviewRoute)
app.use('/api/v1/quizzes', quizRoute)
app.use('/api/v1/roadmap', roadmapRoute)
app.use('/api/v1/modules', moduleRoute)
// app.use('/api/v1/uploads', chunkUpload)
app.use('/api/v1/videos', videoRoute)
app.use('/api/v1/notifications', notificationRoute) // Legacy notification route
app.use('/api/v1/progress', progressRoute)
app.use('/api/v1/student', studentRoute)

app.use('/api/v1/moduleitem', moduleItemRoute)
app.use('/api/v1/search', searchRoute)
app.use('/api/v1/chatbot', chatbotRoute);
app.use('/api/v1/categories', categoryRoute);
app.use('/api/v1/settings', settingRoute);
app.use('/api/v1/shortlinks', shortLinkRoute);
app.use('/api/v1/codespaces', codespaceRoute);
app.use('/api/v1/github/auth', githubAuthRoutes);

// Middleware xử lý lỗi
app.use((req, res, next) => {
  next(new ErrorResponse(`Not found - ${req.originalUrl}`, 404));
});
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
    error: 'Server error'
  });
});

app.use(notFound)
app.use(globalErrHandler)
export default app;