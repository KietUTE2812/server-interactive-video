import express from 'express';
import videoCtrl from '../controllers/videoController.js';
import { protect, authorize } from '../middlewares/auth.js';
import upload from '../config/fileUpload.js';
import BodyParser from "express";
const router = express.Router();
router.use(BodyParser.json());

router.post('/', protect, authorize('instructor'), upload.uploadMiniO.single('video'), videoCtrl.createVideo);

export default router;