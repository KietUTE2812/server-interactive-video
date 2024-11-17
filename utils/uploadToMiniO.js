import * as Minio from 'minio'
import dotenv from "dotenv";
dotenv.config();

class MiniO {
    constructor() {
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_END_POINT,
            port: parseInt(process.env.MINIO_PORT) || 9000,
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY
        });
    }
    config = (bucketName) => {
        this.bucketName = bucketName
        return this;
    }
    uploadStream = async (bucketName, objectName, stream, size) => {
        return new Promise((resolve, reject) => {
            this.minioClient.putObject(bucketName, objectName, stream, size, (err, etag) => {
                if (err) {
                    reject(err);
                }
                resolve(() => {
                    console.log('File uploaded successfully.', etag);
                })
            });
        });
    }

}
const miniO = new MiniO();
miniO.config(process.env.MINIO_BUCKET_NAME)
export default miniO;