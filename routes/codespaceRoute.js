import express from 'express';
import {
  listCodespacesByUser,
  deleteCodespace,
  getCodespaceDetail,
  createCodespace,
  startCodespace,
  stopCodespace,
  listPublicRepositories,
} from '../controllers/codespaceController.js';
import { protect } from '../middlewares/auth.js';
const router = express.Router();

router.get('/', protect, listCodespacesByUser);
router.get('/:codespaceId', protect, getCodespaceDetail);
router.delete('/:codespaceId', protect, deleteCodespace);
router.post('/', protect, createCodespace);
router.post('/:codespaceId/start', protect, startCodespace);
router.post('/:codespaceId/stop', protect, stopCodespace);
router.get('/public-repositories/get', protect, listPublicRepositories);


export default router;
