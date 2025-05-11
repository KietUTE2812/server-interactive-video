import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn file JSON key tải về
const keyFilename = path.join(__dirname, './gcs_key.json');

const storage = new Storage({ keyFilename });
const bucket = storage.bucket('kltn-tankiet-bucket');

bucket.setCorsConfiguration([
    {
        maxAgeSeconds: 3600,
        method: ['GET', 'POST', 'PUT', 'DELETE'],
        origin: ['http://localhost:3000', 'http://localhost:5173'],
        responseHeader: ['Content-Type', 'Authorization'],
    },
]);

export default bucket;