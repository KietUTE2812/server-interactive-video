import express from 'express';
import { handleChat, getChatHistory, deleteChatHistory } from '../controllers/chatbotController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Gửi câu hỏi tới chatbot
router.post('/ask', protect, handleChat);

// Lấy lịch sử chat của user (phân trang)
router.get('/history', protect, getChatHistory);

// Xóa toàn bộ lịch sử chat của user
router.delete('/history', protect, deleteChatHistory);

export default router;
