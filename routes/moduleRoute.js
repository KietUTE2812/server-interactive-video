import express from "express";
import quizController from "../controllers/quizController.js";
import videoController from "../controllers/videoController.js";
import {isLoggedin} from "../middlewares/isLoggedin.js";
import {authorize} from "../middlewares/auth.js";
import upload from "../config/fileUpload.js";

const router = express.Router();
router.post('/:moduleId/videos',isLoggedin, authorize('instructor'), upload.uploadMiniO.single('video'), videoController.createVideo);

export default router;