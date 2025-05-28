import express from 'express';
import { getSettings, updateSettings, getSettingByType, updateSettingByType, deleteSettings } from '../controllers/settingController.js';
import { protect, authorize } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
const router = express.Router();



router.get('/', protect, getSettings);
router.put('/', protect, authorize('admin'), upload.array('images', 10), updateSettings);
router.get('/:type', protect, authorize('admin'), getSettingByType);
router.put('/:type', protect, authorize('admin'), updateSettingByType);
router.delete('/', protect, authorize('admin'), deleteSettings);

export default router;
