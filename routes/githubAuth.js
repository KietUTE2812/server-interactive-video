import express from 'express';
import { githubCallback, githubLoginUrl, githubLogin } from '../controllers/githubAuthController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/login/url', protect, githubLoginUrl); // Get the login URL
router.get('/callback', githubCallback); // Handle the callback from GitHub
router.post('/login', protect, githubLogin); // Login with GitHub

export default router; 