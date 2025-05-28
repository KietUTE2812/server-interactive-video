import express from 'express';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Admin only
router.post('/', protect, authorize('admin'), createCategory);
router.get('/', protect, getCategories);
router.get('/:id', protect, authorize('admin'), getCategoryById);
router.put('/:id', protect, authorize('admin'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

export default router; 