import express from 'express';
import videoCtrl from '../controllers/videoController.js';
import { protect, authorize } from '../middlewares/auth.js';
import upload from '../config/fileUpload.js';
import BodyParser from "express";
import { getStudentEnrollCourse } from '../controllers/studentController.js';
const router = express.Router();
router.use(BodyParser.json());

router.route('/enroll-courses')
    .get(protect, authorize('instructor'), getStudentEnrollCourse)

// router.get('/', videoCtrl.getVideos);
// router.put('/:id', protect, authorize('instructor'), upload.uploadMiniO.single('video'), videoCtrl.updateVideo)
// router.put('/:id/progress', protect, videoCtrl.updateProgress)
// router.delete('/:id', protect, authorize('instructor'), videoCtrl.deleteVideo)



export default router;