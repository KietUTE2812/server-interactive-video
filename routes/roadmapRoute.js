import roadmapCtrl from '../controllers/roadmapController.js';
import express from 'express';
import {isLoggedin} from "../middlewares/isLoggedin.js";

const router = express.Router();
router.post('/', isLoggedin, roadmapCtrl.createRoadmap);
router.get('/', isLoggedin, roadmapCtrl.getRoadmaps);

export default router;