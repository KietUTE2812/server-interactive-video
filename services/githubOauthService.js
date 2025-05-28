import axios from 'axios';
import querystring from 'querystring';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5173/github/callback';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

const getGithubLoginUrl = (state = '') => {
  const params = {
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'read:user user:email repo codespace admin:codespace', // Thay đổi scope nếu cần
    state,
  };
  return `${GITHUB_AUTHORIZE_URL}?${querystring.stringify(params)}`;
};

const getGithubAccessToken = async (code) => {
  const params = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  };
  const headers = {
    Accept: 'application/json',
  };
  const response = await axios.post(GITHUB_TOKEN_URL, params, { headers });
  console.log('response', response.data);
  return response.data.access_token;
};

export {
  getGithubLoginUrl,
  getGithubAccessToken,
};
