import fs from 'fs';
import path from 'path';

/**
 * Hợp nhất các chunk thành file lớn.
 * @param {string} chunksDir - Thư mục chứa các chunk.
 * @param {string} filename - Tên file gốc (sau khi merge).
 * @param {number} totalChunks - Tổng số chunk.
 * @param {string} outputDir - Thư mục lưu file sau khi merge.
 * @returns {Promise<string>} - Đường dẫn file đã merge.
 */
async function mergeChunks(chunksDir = 'temp', filename, totalChunks, outputDir) {
  const filePath = path.join(outputDir, filename);
  const writeStream = fs.createWriteStream(filePath);

  for (let i = 1; i <= totalChunks; i++) {
    const chunkPath = path.join(chunksDir, `${filename}.part${i}`);
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(chunkPath);
      readStream.pipe(writeStream, { end: false });
      readStream.on('end', () => {
        fs.unlink(chunkPath, resolve); // Xóa chunk sau khi merge
      });
      readStream.on('error', reject);
    });
  }

  writeStream.end();
  return filePath;
}

export default mergeChunks;
