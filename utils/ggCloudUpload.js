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
      // const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      const publicUrl = getAuthUrl(folder + '/' + filename);
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

const getAuthUrl = async (filename) => {
  const [files] = await bucket.getFiles();
  const file = files.find(file => file.name === filename);
  if (!file) {
    return null;
  }
  const folder = file.id.split('%2F');
  const url = `https://storage.cloud.google.com/${bucket.name}/${folder[0]}/${folder[1]}?authuser=2`;
  return url;
};

// https://storage.cloud.google.com/kltn-tankiet-bucket/682bf39d74c417c7ac69058b/6160efb9-6e55-4f75-a52f-b839210aa182_ReactJS%20l%C3%83%C2%A0%20g%C3%83%C2%AC%20_%20T%C3%A1%C2%BA%C2%A1i%20sao%20n%C3%83%C2%AAn%20h%C3%A1%C2%BB%C2%8Dc%20ReactJS%20_%20Kh%C3%83%C2%B3a%20h%C3%A1%C2%BB%C2%8Dc%20ReactJS%20mi%C3%A1%C2%BB%C2%85n%20ph%C3%83%C2%AD.mp4?authuser=2

export default { uploadToGCS, updateFileOnGCS, getAuthUrl };