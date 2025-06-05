import axios from 'axios';
import Codespace from '../models/Codespace.js';
import dotenv from 'dotenv';
import User from '../models/User.js';
import asyncHandler from '../middlewares/asyncHandler.js';

dotenv.config();

const GITHUB_API = 'https://api.github.com';
const GITHUB_USERNAME = 'kietute2812';
const GITHUB_REPO = process.env.GITHUB_REPO || 'codechef_space';
const GITHUB_PAT = process.env.GITHUB_PAT;

// Lấy danh sách codespaces của tài khoản github (admin)
export const listCodespaces = asyncHandler (async (req, res) => {
  try {
    const response = await axios.get(`${GITHUB_API}/user/codespaces`, {
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: 'application/vnd.github+json',
      },
    });

    // Đồng bộ với DB
    for (const cs of response.data.codespaces) {
      await Codespace.findOneAndUpdate(
        { codespaceId: cs.id },
        {
          githubUsername: GITHUB_USERNAME,
          codespaceId: cs.id,
          repository: cs.repository.full_name,
          state: cs.state,
          machine: cs.machine,
          createdAt: cs.created_at,
          updatedAt: cs.updated_at,
          webUrl: cs.web_url,
          lastUsedAt: cs.last_used_at,
        },
        { upsert: true }
      );
    }

    res.json(response.data.codespaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy danh sách codespaces của tài khoản cá nhân
export const listCodespacesByUser = asyncHandler (async (req, res) => {
    const userId = req.user._id;
    const codespaces = await Codespace.find({ userId });
    if (codespaces.length === 0) {
        return res.status(404).json({ error: 'No codespaces found' });
    }
    res.json(codespaces);
});


// Lấy chi tiết một codespace
export const getCodespaceDetail = asyncHandler (async (req, res) => {
  try {
    const { codespaceId } = req.params;
    const response = await axios.get(`${GITHUB_API}/user/codespaces/${codespaceId}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: 'application/vnd.github+json',
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Tạo mới codespace, giới hạn tối đa 2 codespace cho tài khoản
export const createCodespace = asyncHandler (async (req, res) => {
  const { codespaceName, repositoryId } = req.body;
  console.log('codespaceName', codespaceName);
  console.log('repositoryId', repositoryId);
  try {
    const userId = req.user._id;
    const userInfo = await User.findById(userId);
    // Đếm số lượng codespace hiện tại của user
    const count = await Codespace.countDocuments({ userId });
    if (count >= 2) {
      return res.status(400).json({ error: 'You can only create a maximum of 2 Codespace.' });
    }
    const response = await axios.post(`${GITHUB_API}/user/codespaces`, {
        "repository_id": repositoryId,
        "ref":`main`,
        "geo":"UsWest"
    }, {
      headers: {
        Authorization: `Bearer ${userInfo.githubAuth.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    // Lưu vào DB
    const cs = response.data;
    const codespace = await Codespace.create({
      userId: userId,
      codespaceId: cs.id,
      codespaceName: codespaceName,
      state: cs.state,
      machine: cs.machine,
      createdAt: cs.created_at,
      updatedAt: cs.updated_at,
      webUrl: cs.web_url,
      lastUsedAt: cs.last_used_at,
    });

    res.json(codespace);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

export const startCodespace = asyncHandler (async (req, res) => {
    try {
        const { codespaceId } = req.params;
        const response = await axios.post(`${GITHUB_API}/user/codespaces/${codespaceId}/start`, {
            headers: {
                Authorization: `Bearer ${GITHUB_PAT}`,
                Accept: 'application/vnd.github+json',
            },
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export const stopCodespace = asyncHandler (async (req, res) => {
    try {
        const { codespaceId } = req.params;
        const response = await axios.post(`${GITHUB_API}/user/codespaces/${codespaceId}/stop`, {
            headers: {
                Authorization: `Bearer ${GITHUB_PAT}`,
                Accept: 'application/vnd.github+json',
            },
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});  

// Xoá codespace
export const deleteCodespace = asyncHandler (async (req, res) => {
  const userId = req.user._id;
  const userInfo = await User.findById(userId);
  console.log('userInfo', userInfo.githubAuth);
  try {
    const { codespaceId } = req.params;
    console.log('codespaceId', codespaceId);
    const listCodespace = await axios.get(`${GITHUB_API}/user/codespaces`, {
      headers: {
        Authorization: `Bearer ${userInfo.githubAuth.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    console.log('listCodespace', listCodespace.data.codespaces);
    const codespace = listCodespace.data.codespaces.find(cs => cs.id == codespaceId);
    console.log('codespace', codespace);
    const deleteCodespace = await axios.delete(`${GITHUB_API}/user/codespaces/${codespace.name}`, {
      headers: {
        Authorization: `Bearer ${userInfo.githubAuth.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    console.log('deleteCodespace', deleteCodespace.data);
    await Codespace.deleteOne({ codespaceId });
    res.json({ message: 'Codespace deleted' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

export const listPublicRepositories = asyncHandler (async (req, res) => {
  const userId = req.user._id;
  const userInfo = await User.findById(userId);
  console.log('userInfo', userInfo.githubAuth);
  try {
    const response = await axios.get(`${GITHUB_API}/user/repos`, {
      headers: {
        Authorization: `Bearer ${userInfo.githubAuth.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    res.json(response.data);
  } catch (err) {
    console.log(err.response.data);
    res.status(500).json({ error: err.message });
  }
});

export const createRepository = asyncHandler (async (req, res) => {
  const userId = req.user._id;
  const userInfo = await User.findById(userId);
  console.log('userInfo', userInfo.githubAuth.accessToken);
  const { name, description } = req.body;
  console.log('name', name);
  console.log('description', description);


  try {
    const response = await axios.post(`${GITHUB_API}/user/repos`, {
      
      "name": name,
      "description": description,
      "private": false,
      "auto_init": true,
    }, {
      headers: {
        Authorization: `Bearer ${userInfo.githubAuth.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    res.json({
      success: true,
      message: 'Repository created successfully',
      data: response.data
    });
  } catch (err) {
    console.log(err.response.data);
    res.status(500).json({ error: err.message });
  }
});
