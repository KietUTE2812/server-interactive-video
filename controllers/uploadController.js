import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Client } from "minio";
import Video from "../models/Video.js";
import {ModuleItem, Module} from "../models/Module.js";
import ErrorResponse from "../utils/ErrorResponse.js";
// Store upload sessions in memory (consider using Redis for production)
const uploadSessions = new Map();

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: parseInt(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});
console.log('minioClient', minioClient.host);

export const uploadController = {
    // Khởi tạo phiên upload
    async initializeUpload(req, res, next) {
        try {
            const { file, description, title, moduleId } = req.body;
            const uploadId = uuidv4();
            const objectName = `${Date.now()}-${file.name}`;

            uploadSessions.set(uploadId, {
                objectName,
                filename: file.name,
                mimeType: file.type,
                fileSize: file.size,
                description,
                title,
                moduleId,
                chunks: new Map(),
                uploadStartTime: Date.now(),
            });

            res.json({ uploadId });
        } catch (error) {
            return next(new ErrorResponse(`Error initializing upload: ${error.message}`, 500));
        }
    },

    // Xử lý từng chunk
    async uploadChunk(req, res, next) {
        try {
            const { uploadId, chunkIndex, totalChunks } = req.body;
            const chunk = req.file;

            if (!uploadId || !chunk) {
                return next(new ErrorResponse('Invalid request', 400));
            }

            const session = uploadSessions.get(uploadId);
            if (!session) {
                return next(new ErrorResponse('Upload session not found', 404));
            }

            // Lưu chunk tạm thời
            const chunkPath = path.join(TEMP_DIR, `${uploadId}-${chunkIndex}`);
            fs.writeFileSync(chunkPath, chunk.buffer);

            session.chunks.set(parseInt(chunkIndex), chunkPath);

            res.json({ success: true, chunk: chunkIndex });
        } catch (error) {
            return next(new ErrorResponse(`Error uploading chunk: ${error.message}`, 500));
        }
    },

    // Hoàn thành upload
    async completeUpload(req, res, next) {
        try {
            const { uploadId } = req.body;
            const session = uploadSessions.get(uploadId);

            if (!session) {
                return next(new ErrorResponse('Upload session not found', 404));
            }

            // Kiểm tra đủ chunks
            const totalChunks = session.chunks.size;
            if (totalChunks === 0) {
                return next(new ErrorResponse('No chunks uploaded', 400));
            }

            // Ghép file
            const finalFilePath = path.join(TEMP_DIR, session.objectName);
            const writeStream = await fs.createWriteStream(finalFilePath);

            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = session.chunks.get(i);
                const chunkData = await fs.readFileSync(chunkPath);
                writeStream.write(chunkData);
                // Xóa chunk tạm
                await fs.unlinkSync(chunkPath);
            }

            writeStream.end();

            // Upload lên MinIO
            await minioClient.fPutObject(
                process.env.MINIO_BUCKET_NAME,
                session.objectName,
                './temp/' + session.objectName,
                { 'Content-Type': session.mimeType }
            );

            // Xóa file tạm
            fs.unlinkSync(finalFilePath);

            // Lấy URL
            const protocol = minioClient.useSSL ? 'https://' : 'http://';
            const bucketName = process.env.MINIO_BUCKET_NAME;
            const objectName = session.objectName;
            const url = `${protocol}${minioClient.host}:${minioClient.port}/${bucketName}/${objectName}`;

            // Xóa session
            uploadSessions.delete(uploadId);

            // Ghi vao database
            const video = new Video({
                title: session.title,
                moduleId: session.moduleId,
                description: session.description,
                references: {
                    fileName: session.filename,
                    size: session.fileSize,
                    file: url
                },
                videoUrl: url,
                duration: session.duration || 0
            });

            await video.save();

            const moduleItem = await ModuleItem.create({
                module: session.moduleId,
                title: session.title,
                type: 'lecture',
                contentType: 'Video',
                icon: 'video',
                video: video._id,
            });

            const module = await Module.findById(session.moduleId);
            module.moduleItems.push(moduleItem._id);
            await module.save();

            res.json({
                success: true,
                url,
                objectName: session.objectName,
                video
            });
        } catch (error) {
            return next(new ErrorResponse(`Error completing upload: ${error.message}`, 500));
        }
    }
};