import roadmapCtrl from '../controllers/roadmapController.js';
import express from 'express';
import {isLoggedin} from "../middlewares/isLoggedin.js";

const router = express.Router();
router.post('/', isLoggedin, roadmapCtrl.createRoadmap);
router.get('/', isLoggedin, roadmapCtrl.getRoadmaps);
router.put('/:roadmapId', isLoggedin, roadmapCtrl.updateRoadmap);
router.post('/submit-test', isLoggedin, roadmapCtrl.submitTest);
router.post('/tests', isLoggedin, roadmapCtrl.createTest);
router.get('/review-test', isLoggedin, roadmapCtrl.getReviewTest);
export default router;