import { Client } from 'minio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if all required variables are present
if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT || !process.env.MINIO_USE_SSL || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY || !process.env.MINIO_BUCKET_NAME) {
    console.error('Missing required environment variables for MinIO configuration.');
    process.exit(1);
}

const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

export default minioClient;