import express from "express";
import { protect, authorize } from "../middlewares/auth.js";
import { verifyPassword } from "../controllers/authController.js";
const router = express.Router();

router.route('/verify-password')
    .post(protect, authorize('instructor', 'admin'), verifyPassword);

export default router;