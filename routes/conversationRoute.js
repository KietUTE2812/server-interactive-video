import { createConversation, getConversation, getConversations } from "../controllers/conversationController.js";
import { protect } from "../middlewares/auth.js";
import express from 'express';

const router = express.Router();

router.route('/').get(protect, getConversations)
router.route('/:conversationId').get(protect, getConversation);
router.route('/').post(protect, createConversation);

export default router;