import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // Giới hạn dung lượng tệp 2GB
    },
})

export default upload;