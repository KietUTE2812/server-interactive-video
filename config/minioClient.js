import { Client } from 'minio';
import dotenv from 'dotenv';
const minioClient = new Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
})

export default minioClient;