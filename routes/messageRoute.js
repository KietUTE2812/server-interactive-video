
import { getMessages } from "../controllers/messageController.js";
import { protect } from "../middlewares/auth.js";
import express from 'express';

const router = express.Router();

router.route('/').get(getMessages)


export default router;