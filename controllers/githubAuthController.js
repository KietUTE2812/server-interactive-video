import { getGithubAccessToken, getGithubLoginUrl } from '../services/githubOauthService.js';
import axios from 'axios';
import User from '../models/User.js';

export const githubCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing code from GitHub' });
  }

  try {
    const accessToken = await getGithubAccessToken(code);

    // Lấy thông tin user từ GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Lấy email user
    const emailResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const response = {
      accessToken,
      user: userResponse.data,
      emails: emailResponse.data,
    }
    return res.json(response);
  } catch (error) {
    console.log(error.response.data);
    return res.status(500).json({ error: 'Failed to authenticate with GitHub', details: error.message });
  }
}; 

export const githubLogin = async (req, res) => {
    const { user, emails, accessToken } = req.body;
    const userId = req.user._id;
    const userInfo = await User.findById(userId);
    if (!userInfo) {
        return res.status(400).json({ error: 'User not found' });
    }
    userInfo.githubAuth.username = user.login;
    userInfo.githubAuth.email = emails.find(email => email.primary).email;
    userInfo.githubAuth.accessToken = accessToken;
    await userInfo.save();
    console.log('userInfo111', userInfo);
    return res.json({
        success: true,
        message: 'GitHub account added successfully',
    });
}

export const githubLoginUrl = async (req, res) => {
    const loginUrl = getGithubLoginUrl();
    res.json({ loginUrl });
}
