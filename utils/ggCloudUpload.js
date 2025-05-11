import { v4 as uuidv4 } from 'uuid';
import bucket from '../config/ggCloudClient.js';


/**
 * Uploads a file to Google Cloud Storage (GCS).
 * @param {Object} file - The file object to upload.
 * @param {string} [folder='uploads'] - The folder in GCS where the file will be uploaded.
 * @returns {Promise<string>} - A promise that resolves to the public URL of the uploaded file.
 */
const uploadToGCS = async (file, folder = 'uploads') => {
  return new Promise((resolve, reject) => {
    const filename = `${folder}/${uuidv4()}_${file.originalname}`;
    const blob = bucket.file(filename);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype
      }
    });

    blobStream.on('error', err => reject(err));

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

/** 
 * Updates a file on Google Cloud Storage (GCS) by new file and returns the public URL.
 * @param {string} [oldFileUrl] - The public URL of the old file to be replaced.
 * @param {Object} file - The new file object to upload.
 * @param {string} [folder='uploads'] - The folder in GCS where the file will be uploaded.
 * @returns {Promise<string>} - A promise that resolves to the public URL of the updated file.
 * @throws {Error} - If the file upload fails.
 */
const updateFileOnGCS = async (oldFileUrl, file, folder = 'uploads') => {
  try {
    // Delete the old file if it exists
    if (oldFileUrl) {
      const oldFileName = oldFileUrl.split('/').pop();
      const oldBlob = bucket.file(oldFileName);
      await oldBlob.delete().catch(err => console.error('Error deleting file:', err));
    }
    
    // Upload the new file and return its URL
    const publicUrl = await uploadToGCS(file, folder);
    console.log('File updated successfully:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('Error uploading file:', err);
    throw new Error('File upload failed');
  }
};

export default { uploadToGCS, updateFileOnGCS };