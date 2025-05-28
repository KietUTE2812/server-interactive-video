import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn file JSON key tải về
const keyFilename = path.join(__dirname, './gcs_key.json');

// Khởi tạo Storage
const storage = new Storage({ keyFilename });
const bucket = storage.bucket('kltn-tankiet-bucket');

// Thiết lập CORS
async function setCors() {
  await bucket.setMetadata({
    cors: [
      {
        origin: ['http://localhost:5173'],
        method: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
        responseHeader: [
          'Content-Type',
        ],
        maxAgeSeconds: 3600
      }
    ]
  });

  console.log('✅ CORS configuration set successfully.');
}

setCors().catch(console.error);

export default bucket;
