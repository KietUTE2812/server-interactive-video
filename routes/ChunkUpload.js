// backend/routes/uploadRoutes.js
import express from 'express';
import { uploadController } from '../controllers/uploadController.js';
import multer from 'multer';
import aws from 'aws-sdk';

const s3 = new aws.S3({
    endpoint: process.env.MINIO_ENDPOINT,
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
    sslEnabled: false,
    s3ForcePathStyle: true, // Quan trọng cho MinIO
});
// Detailed logging middleware
const debugUploadMiddleware = (req, res, next) => {
    console.log('==== Upload Debug Info ====');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Log all fields in the request
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            console.log(`Body Field ${key}:`, req.body[key]);
        });
    }

    // Check for files using different methods
    console.log('req.file:', req.file);
    console.log('req.files:', req.files);

    // If using multer, check fields
    if (req.file) {
        console.log('File Details:');
        console.log('- Original Name:', req.file.originalname);
        console.log('- Mime Type:', req.file.mimetype);
        console.log('- Size:', req.file.size);
    }

    next();
};

const upload = multer({
    storage: multer.memoryStorage(),
});
console.log('upload', upload);
const router = express.Router();

router.post('/init', uploadController.initializeUpload);
router.post('/chunk',
    upload.single('chunk'),
    uploadController.uploadChunk);
router.post('/complete', uploadController.completeUpload);

export default router;