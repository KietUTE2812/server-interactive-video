import express from 'express';
import shortLinkController from '../controllers/shortLinkController.js';
import { protect, authorize } from '../middlewares/auth.js';
const router = express.Router();

// Tạo short link mới
router.post('/', protect, shortLinkController.createShortLink);

// Lấy tất cả short link (có thể lọc theo user)
router.get('/', protect, shortLinkController.getAllShortLinks);

// Lấy thông tin short link theo code
router.get('/info/:code', protect, shortLinkController.getShortLink);

// Chuyển hướng short link
router.get('/:code', shortLinkController.redirectShortLink);

// Xóa short link
router.delete('/:code', protect, authorize('admin'), shortLinkController.deleteShortLink);

export default router;
