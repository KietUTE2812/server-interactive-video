import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();
const uploadConfig = multer({ dest: 'uploads/' });

// Hàm tải lên tệp
async function uploadFile(filePath) {
    const accessToken = process.env.ONE_DR_ACCESS_TOKEN;

    // Lấy tên tệp từ đường dẫn
    const fileName = path.basename(filePath);

    // Tạo URL tải lên tệp
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/Avatar/${fileName}:/content`;

    // Tạo luồng tệp
    const fileStream = fs.createReadStream(filePath);

    try {
        // Gửi yêu cầu tải lên tệp
        const uploadResponse = await axios.put(uploadUrl, fileStream, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
            },
        });

        console.log(`Tải lên thành công: ${uploadResponse.data.id}`);

        // Tạo liên kết chia sẻ chỉ đọc sau khi tải lên thành công
        const fileId = uploadResponse.data.id;
        const shareLinkResponse = await createShareLink(fileId, accessToken);
        
        if (shareLinkResponse) {
            console.log(`Liên kết chia sẻ chỉ đọc: ${shareLinkResponse.webUrl}`);
            return shareLinkResponse.webUrl;
        }
    } catch (error) {
        console.error('Lỗi khi tải lên:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Hàm tạo liên kết chia sẻ chỉ đọc
async function createShareLink(fileId, accessToken) {
    const shareUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/createLink`;
    
    try {
        const response = await axios.post(shareUrl, {
            type: "view", // Loại liên kết là "view" để chỉ cho phép xem
            scope: "anonymous" // Bạn có thể dùng "anonymous" (bất kỳ ai có liên kết) hoặc "organization" (chỉ trong tổ chức)
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data.link;
    } catch (error) {
        throw error;
    }
}
// Đường dẫn đến tệp cần tải lên
const fileToUpload = "C:/Users/huynh/Downloads/offers_details1.png"; // Thay đổi đường dẫn tệp

uploadFile(fileToUpload);
// export default { uploadFile, uploadConfig };

