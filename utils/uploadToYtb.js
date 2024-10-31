import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();


const oauth2Client = new google.auth.OAuth2(
    process.env.YTB_CLIENT_ID,
    process.env.YTB_SECRET_ID,
    process.env.YTB_REDIRECT_URL
);

oauth2Client.setCredentials({ refresh_token: process.env.YTB_REFRESH_TOKEN });

const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

async function uploadVideoToYouTube(title, description, filePath, privacyStatus = 'private') {
    try {
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title,
                    description,
                },
                status: {
                    privacyStatus,
                },
            },
            media: {
                body: fs.createReadStream(filePath),
            },
        });
        console.log('Video uploaded. Video ID:', res.data.id);
        return res.data.id;
    } catch (error) {
        console.error('Error uploading video:', error);
        throw error;
    }
}

export default uploadVideoToYouTube;