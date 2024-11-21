import cloudinaryPackage from "cloudinary";
import multer from "multer";
import dotenv from 'dotenv';
dotenv.config();
import { CloudinaryStorage } from "multer-storage-cloudinary";
//configure cloudinary
const cloudinary = cloudinaryPackage.v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET_KEY,
});

// Create storage engine for Multer
const storage = new CloudinaryStorage({
    cloudinary,
    allowedFormats: ["jpg", "png", "jpeg", "PNG", "JPG", "JPEG"],
    params: {
        folder: "ProfileImages_API",
    },
});

// Init Multer with the storage engine
const uploadCloudinary = multer({ storage: storage });
const uploadMiniO = multer({ storage: multer.memoryStorage() });
export default { uploadCloudinary, uploadMiniO };