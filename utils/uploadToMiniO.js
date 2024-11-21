import * as Minio from 'minio'
import dotenv from "dotenv";
dotenv.config();

class MiniO {
    constructor() {
        this.minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT,
            port: parseInt(process.env.MINIO_PORT) || 9000,
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY
        });
    }
    config = (bucketName) => {
        this.bucketName = bucketName
        this.setPolicyForBucket(bucketName).then(() => {
        }).catch((err) => {
            console.error('Error setting policy for bucket', err);
        });
        return this;
    }
    uploadStream = async (objectName, stream, size) => {
        return new Promise((resolve, reject) => {
            this.minioClient.putObject(this.bucketName, objectName, stream, size, (err, etag) => {
                if (err) {
                    reject(err);
                }
                resolve({ etag, objectName });
                })
            });
    }
    getFile = async (objectName) => {
        return new Promise((resolve, reject) => {
            this.minioClient.getObject(this.bucketName, objectName, (err, stream) => {
                if (err) {
                    reject(err);
                }
                resolve(stream);
            });
        });
    }
    genegatePresignedUrl = async (objectName, time) => {
        const reqParams = {
            'response-content-disposition': 'attachment',
            // Add policy conditions
            'ip-address': '127.0.0.1',
            'host': 'localhost:5173'
        };
        return new Promise((resolve, reject) => {
            this.minioClient.presignedGetObject(this.bucketName, objectName, time, reqParams, (err, presignedUrl) => {
                if (err) {
                    reject(err);
                }
                resolve(presignedUrl);
            });
        });
    }
    setPolicyForBucket = async (bucketName) => {
        const policy = {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid:"Allow only GET requests originating from client(localhost:5173).",
                    Effect: 'Allow',
                    Principal: '*',
                    Action: 's3:GetObject',
                    Resource: `arn:aws:s3:::${bucketName}/*`,
                    Condition:{
                        "StringLike": {
                            "aws:Referer":["http://localhost:5173/*"]
                        }
                    }
                },
            ],
        };

        const stringPolicy = JSON.stringify(policy);

        try {
            await this.minioClient.setBucketPolicy(bucketName, stringPolicy);
            console.log(`Policy set for bucket: ${bucketName}`);
        } catch (err) {
            console.error(`Error setting policy for bucket: ${bucketName}`, err);
        }
    }


}
const miniO = new MiniO();
export default miniO;