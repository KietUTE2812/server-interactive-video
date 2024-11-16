import reviewCtrl from '../controllers/reviewController.js';
import express from 'express';
import {isLoggedin} from "../middlewares/isLoggedin.js";

const router = express.Router();

router.post('/', isLoggedin,reviewCtrl.createReview);
router.get('/',isLoggedin, reviewCtrl.getReviews);
router.get('/:id',isLoggedin, reviewCtrl.getReview);
router.put('/:id',isLoggedin, reviewCtrl.updateReview);
router.delete('/:id',isLoggedin, reviewCtrl.deleteReview);

export default router;