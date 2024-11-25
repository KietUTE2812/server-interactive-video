import progressController from "../controllers/progressController.js";
import express from "express";
import {isLoggedin} from "../middlewares/isLoggedin.js";

const router = express.Router();

// router.route('/').get(isLoggedin, progressController.getProgress);
router.route('/:id/video').put(isLoggedin, progressController.updateVideoProgress);
router.route('/:id/supplement').put(isLoggedin, progressController.updateSupplementProgress);

export default router;